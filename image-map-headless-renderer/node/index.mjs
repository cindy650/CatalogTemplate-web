import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from 'playwright-core';

const directory = path.dirname(fileURLToPath(import.meta.url));
const runnerUrl = pathToFileURL(path.resolve(directory, '../browser/runner.html')).href;

export async function renderImageMapJson(options = {}) {
  const inputPath = typeof options.json === 'string'
    ? path.resolve(options.baseDirectory || process.cwd(), options.json)
    : undefined;
  const baseDirectory = path.resolve(
    options.baseDirectory || (inputPath ? path.dirname(inputPath) : process.cwd()),
  );
  const json = await loadJson(inputPath ?? options.json, baseDirectory);
  const preparedJson = await embedLocalResources(json, baseDirectory);
  const outputs = normalizeOutputs(options, baseDirectory);
  const browser = await launchBrowser(options.browserExecutable);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.goto(runnerUrl);
    await page.waitForFunction(() => Boolean(globalThis.ImageMapHeadlessRenderer));
    const result = await page.evaluate(async payload => (
      globalThis.ImageMapHeadlessRenderer.render(payload)
    ), {
      json: preparedJson,
      dpi: options.dpi ?? 300,
      quality: options.quality ?? 0.95,
      backgroundColor: options.backgroundColor,
      formats: Object.keys(outputs),
    });
    for (const [format, outputPath] of Object.entries(outputs)) {
      await writeDataUrl(outputPath, result.images[format]);
    }
    return {
      outputs,
      width: result.width,
      height: result.height,
      cssWidth: result.cssWidth,
      cssHeight: result.cssHeight,
      dpi: result.dpi,
      objectCount: result.objectCount,
      geometry: result.geometry,
      warnings: result.warnings,
      fabricVersion: result.fabricVersion,
    };
  } finally {
    await browser.close();
  }
}

async function launchBrowser(explicitPath) {
  const requested = explicitPath ? path.resolve(explicitPath) : undefined;
  if (requested) return chromium.launch({ headless: true, executablePath: requested });
  for (const candidate of systemBrowserCandidates()) {
    try {
      await fs.access(candidate);
      return await chromium.launch({ headless: true, executablePath: candidate });
    } catch {
      // Try the next installed Chromium browser.
    }
  }
  try {
    return await chromium.launch({ headless: true });
  } catch (managedError) {
    throw new Error(`没有可用的 Chromium。可执行 npm exec playwright install chromium，或传 browserExecutable。\n${managedError.message}`);
  }
}

function systemBrowserCandidates() {
  if (process.platform === 'win32') {
    return [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      `${process.env.LOCALAPPDATA || ''}/Microsoft/Edge/Application/msedge.exe`,
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
    ];
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

async function loadJson(value, baseDirectory) {
  if (typeof value === 'string') {
    const inputPath = path.resolve(baseDirectory, value);
    return JSON.parse(await fs.readFile(inputPath, 'utf8'));
  }
  if (Array.isArray(value) || (value && typeof value === 'object')) return structuredClone(value);
  throw new Error('json 必须是 JSON 文件路径、对象或对象数组');
}

function normalizeOutputs(options, baseDirectory) {
  const outputs = {};
  if (options.jpgPath) outputs.jpg = path.resolve(baseDirectory, options.jpgPath);
  if (options.pngPath) outputs.png = path.resolve(baseDirectory, options.pngPath);
  if (!Object.keys(outputs).length) throw new Error('至少需要 jpgPath 或 pngPath');
  return outputs;
}

async function embedLocalResources(json, baseDirectory) {
  const copy = structuredClone(json);
  const objects = Array.isArray(copy) ? copy : copy.objects || copy.layers?.objects || [];
  await Promise.all(collectJobs(objects, baseDirectory, new Map()));
  return copy;
}

function collectJobs(objects, baseDirectory, cache) {
  const jobs = [];
  for (const object of objects) {
    if (!object || typeof object !== 'object') continue;
    for (const key of ['src', 'fontUrl', 'font_url']) {
      const value = object[key];
      if (typeof value !== 'string' || !value || /^(?:data:|blob:)/i.test(value)) continue;
      const resourceKey = value;
      let pending = cache.get(resourceKey);
      if (!pending) {
        pending = /^https?:/i.test(value)
          ? remoteToDataUrl(value)
          : fileToDataUrl(/^file:/i.test(value) ? fileURLToPath(value) : path.resolve(baseDirectory, value));
        cache.set(resourceKey, pending);
      }
      jobs.push(pending.then(data => { object[key] = data; }));
    }
    if (Array.isArray(object.objects)) jobs.push(...collectJobs(object.objects, baseDirectory, cache));
  }
  return jobs;
}

async function remoteToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`资源下载失败 ${response.status}: ${url}`);
  const mime = response.headers.get('content-type')?.split(';', 1)[0] || mimeForPath(new URL(url).pathname);
  return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
}

async function fileToDataUrl(filePath) {
  return `data:${mimeForPath(filePath)};base64,${(await fs.readFile(filePath)).toString('base64')}`;
}

function mimeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.ttf': 'font/ttf', '.otf': 'font/otf',
  }[extension] || 'application/octet-stream';
}

async function writeDataUrl(outputPath, dataUrl) {
  const match = /^data:[^;]+;base64,(.*)$/s.exec(String(dataUrl || ''));
  if (!match) throw new Error(`无头渲染器没有返回 ${path.extname(outputPath)} 图片`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(match[1], 'base64'));
}
