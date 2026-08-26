import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { renderImageMapJson } from '../node/index.mjs';

test('renders CatalogTemplate scene JSON to 300 DPI JPG and PNG', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'image-map-render-'));
  const jpgPath = path.join(output, 'sample.jpg');
  const pngPath = path.join(output, 'sample.png');
  const result = await renderImageMapJson({
    json: path.resolve('test/sample.json'),
    jpgPath,
    pngPath,
    dpi: 300,
  });
  const jpg = await fs.readFile(jpgPath);
  const png = await fs.readFile(pngPath);
  assert.deepEqual([...jpg.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(jpegSize(jpg), { width: 1250, height: 625 });
  assert.deepEqual(pngSize(png), { width: 1250, height: 625 });
  assert.equal(result.fabricVersion, '7.4.0');
  assert.equal(result.objectCount, 2);
  assert.equal(result.geometry[0].left, 200);
  assert.equal(result.geometry[0].top, 100);
});

test('Textbox never wraps because of its serialized width', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'image-map-nowrap-'));
  const result = await renderImageMapJson({
    json: {
      objects: [
        {
          id: 'workarea', type: 'Image', originX: 'center', originY: 'center',
          left: 250, top: 150, width: 400, height: 200, scaleX: 1, scaleY: 1,
          workareaWidth: 400, workareaHeight: 200, backgroundColor: '#ffffff', src: '',
        },
        {
          id: 'names', type: 'Textbox', originX: 'center', originY: 'center',
          left: 250, top: 150, width: 80, height: 30, fontFamily: 'Arial',
          fontSize: 27, charSpacing: 190, wordSpacing: 240, text: 'DUNCAN & KATIE',
        },
      ],
    },
    pngPath: path.join(output, 'nowrap.png'),
    dpi: 96,
  });
  const names = result.geometry.find(item => item.id === 'names');
  assert.equal(names.type, 'text');
  assert.ok(names.width > 80);
  assert.ok(names.height < 40);
});

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer) {
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error('JPEG size marker not found');
}
