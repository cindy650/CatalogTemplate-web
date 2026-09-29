import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import TextToSVG from 'text-to-svg';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
const primary = TextToSVG.loadSync();
const heartFallback = TextToSVG.loadSync('src/image-map-editor/assets/fallback-fonts/seguisym-heart.ttf');
const ampFallback = TextToSVG.loadSync('src/image-map-editor/assets/fallback-fonts/microsoft-yahei-amp.ttf');
// A font with no heart and an empty .notdef outline reproduces silent loss.
primary.font.glyphs.get(0).path.commands = [];
// A separate font with no ampersand reproduces the order's GreatDay font.
const missingAmp = primary.font.charToGlyph('&');
missingAmp.index = 0;
missingAmp.path.commands = [];
const originalLoad = TextToSVG.load;
TextToSVG.load = (url, callback) => {
  if (url === 'fixture:heart-fallback') return callback(null, heartFallback);
  if (url === 'fixture:amp-fallback') return callback(null, ampFallback);
  callback(null, primary);
};

try {
  const built = await build({
    entryPoints: ['src/image-map-editor/canvas/utils/exportTextToSvg.ts'],
    bundle: true, write: false, platform: 'node', format: 'cjs',
    packages: 'external', loader: { '.ttf': 'dataurl' },
  });
  const { createRequire } = await import('node:module');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', built.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  const exportSvg = (content, fontSources = [{ family: 'Fixture', url: 'fixture:primary' }], family = 'Fixture') => module.exports.exportTextToSvg({
    rawSvg: `<svg xmlns="http://www.w3.org/2000/svg"><text font-family="${family}" font-size="40" fill="#123456"><tspan x="10" y="50">${content.replaceAll('&', '&amp;')}</tspan></text></svg>`,
    bounds: { left: 0, top: 0, width: 500, height: 100 },
    backgroundColor: '#ffffff', layerNames: new Map(),
    fontSources,
    fallbackFontSources: [
      { family: 'Heart Fallback', url: 'fixture:heart-fallback' },
      { family: 'Amp Fallback', url: 'fixture:amp-fallback' },
    ],
  });
  const output = await exportSvg('A❤︎B');
  const document = new DOMParser().parseFromString(output, 'image/svg+xml');
  const paths = [...document.querySelectorAll('path')];
  assert.equal(paths.length, 3, 'A, the fallback heart, and B should all be converted');
  assert.equal(document.querySelectorAll('text[data-symbol-fallback]').length, 0);
  assert(paths.every(path => path.getAttribute('fill') === '#123456'));
  // Ampersands must be converted to a real outline, never left as an XML
  // entity (CorelDRAW may import `&amp;` as visible text).
  const ampDocument = new DOMParser().parseFromString(await exportSvg('A & B', [
    { family: 'Fallback', url: 'fixture:primary' },
  ], 'Fallback'), 'image/svg+xml');
  assert.equal(ampDocument.querySelectorAll('text').length, 0);
  const ampPath = ampFallback.getD('&', {
    x: 10 + primary.getWidth('A ', { fontSize: 40, kerning: true }),
    y: 50,
    fontSize: 40,
    kerning: true,
  });
  assert(
    [...ampDocument.querySelectorAll('path')].some(path => path.getAttribute('d')?.includes(ampPath)),
    'Missing ampersand outline in converted SVG',
  );
  assert(!ampDocument.documentElement.outerHTML.includes('&amp;'));
  const fallbackAmp = new DOMParser().parseFromString(await exportSvg('&', [
    { family: 'Missing', url: 'fixture:primary' },
  ], 'Missing'), 'image/svg+xml');
  assert.equal(fallbackAmp.querySelectorAll('path').length, 1, 'A missing ampersand should use the Microsoft YaHei fallback outline');
  assert.equal(fallbackAmp.querySelectorAll('text').length, 0);
  assert(!fallbackAmp.documentElement.outerHTML.includes('&amp;'));
  // A heart that exists in the selected font must retain that font's outline.
  const supported = new DOMParser().parseFromString(await exportSvg('♥'), 'image/svg+xml');
  assert.equal(supported.querySelector('path').getAttribute('d'), primary.getD('♥', { x: 10, y: 50, fontSize: 40, kerning: true }));
  console.log('SVG symbol export passed: browser fallback heart/amp glyphs convert to paths, supported glyphs convert to paths, and styling is retained.');
} finally {
  TextToSVG.load = originalLoad;
  dom.window.close();
}
