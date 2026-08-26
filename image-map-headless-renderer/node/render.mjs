#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';

import { renderImageMapJson } from './index.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  const inputPath = path.resolve(args.input);
  const baseDirectory = path.dirname(inputPath);
  const name = path.basename(inputPath, path.extname(inputPath));
  const result = await renderImageMapJson({
    json: inputPath,
    baseDirectory,
    jpgPath: args.jpg === true ? `${name}.jpg` : args.jpg,
    pngPath: args.png === true ? `${name}.png` : args.png,
    dpi: args.dpi ?? 300,
    quality: args.quality ?? 0.95,
    backgroundColor: args.background,
    browserExecutable: args.browser,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '-h' || value === '--help') result.help = true;
    else if (value === '--jpg' || value === '--png') {
      const key = value.slice(2);
      const next = argv[index + 1];
      result[key] = next && !next.startsWith('-') ? argv[++index] : true;
    } else if (['--dpi', '--quality', '--background', '--browser'].includes(value)) {
      const next = argv[++index];
      if (!next) throw new Error(`${value} 缺少参数`);
      result[value.slice(2)] = next;
    } else if (value.startsWith('-')) throw new Error(`未知参数: ${value}`);
    else if (!result.input) result.input = value;
    else throw new Error(`多余参数: ${value}`);
  }
  if (result.input && !result.jpg && !result.png) {
    result.jpg = true;
    result.png = true;
  }
  return result;
}

function printHelp() {
  process.stdout.write(`用法:\n  node ./node/render.mjs input.json [--jpg [输出.jpg]] [--png [输出.png]]\n\n参数:\n  --dpi <数值>          输出 DPI，默认 300\n  --quality <0..1>      JPG 质量，默认 0.95\n  --background <颜色>   覆盖画布背景色\n  --browser <路径>      Chromium/Chrome/Edge 可执行文件\n  -h, --help            显示帮助\n\n不写 --jpg/--png 时，两种格式都会生成在 JSON 所在目录。\n`);
}
