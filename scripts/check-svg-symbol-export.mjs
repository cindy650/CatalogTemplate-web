import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import TextToSVG from 'text-to-svg';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
const primary = TextToSVG.loadSync();
const fallback = TextToSVG.loadSync();
// A font with no heart and an empty .notdef outline reproduces silent loss.
primary.font.glyphs.get(0).path.commands = [];
// A separate font with no ampersand reproduces the order's GreatDay font.
const missingAmp = primary.font.charToGlyph('&');
missingAmp.index = 0;
missingAmp.path.commands = [];
const originalLoad = TextToSVG.load;
TextToSVG.load = (url, callback) => callback(null, url === 'fixture:fallback' ? fallback : primary);

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
  });
  const output = await exportSvg('A❤︎B');
  const document = new DOMParser().parseFromString(output, 'image/svg+xml');
  const paths = [...document.querySelectorAll('path')];
  assert.equal(paths.length, 2, 'A and B should be converted while the missing heart stays as text');
  assert.equal(document.querySelector('text[data-symbol-fallback]')?.textContent, '❤︎');
  assert(paths.every(path => path.getAttribute('fill') === '#123456'));
  // Ampersands must be converted to a real outline, never left as an XML
  // entity (CorelDRAW may import `&amp;` as visible text).
  const ampDocument = new DOMParser().parseFromString(await exportSvg('A & B', [
    { family: 'Fallback', url: 'fixture:fallback' },
  ], 'Fallback'), 'image/svg+xml');
  assert.equal(ampDocument.querySelectorAll('text').length, 0);
  const ampPath = fallback.getD('&', {
    x: 10 + fallback.getWidth('A ', { fontSize: 40, kerning: true }),
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
  assert.equal(fallbackAmp.querySelectorAll('path').length, 0, 'A missing ampersand must not use another font outline');
  assert.equal(fallbackAmp.querySelector('text[data-symbol-fallback]')?.textContent, '&');
  const textHeart = await exportSvg('❤︎');
  assert(textHeart.includes('❤︎'), 'VS15 must be preserved for a text fallback symbol');
  assert((await exportSvg('❤️')).includes('❤️'), 'VS16 must be preserved for a text fallback symbol');
  // A heart that exists in the selected font must retain that font's outline.
  const supported = new DOMParser().parseFromString(await exportSvg('♥'), 'image/svg+xml');
  assert.equal(supported.querySelector('path').getAttribute('d'), primary.getD('♥', { x: 10, y: 50, fontSize: 40, kerning: true }));
  console.log('SVG symbol export passed: missing symbols preserve original text fallback, supported glyphs convert to paths, and styling is retained.');
} finally {
  TextToSVG.load = originalLoad;
  dom.window.close();
}
