import fs from 'node:fs';
import assert from 'node:assert/strict';

const stylesheet = fs.readFileSync('src/image-map-editor/styles/app.css', 'utf8');
const objectProperties = stylesheet.match(/\.rde-imagemap-object-properties\s*\{([\s\S]*?)\}/)?.[1] ?? '';
const layerPanel = stylesheet.match(/\.rde-imagemap-layer-panel\s*\{([\s\S]*?)\}/)?.[1] ?? '';
const layerList = stylesheet.match(/\.rde-imagemap-layer-list\s*\{([\s\S]*?)\}/)?.[1] ?? '';

assert.match(objectProperties, /flex:\s*1\s+1\s+0(?:px)?\s*;/, 'object properties must use a zero flex basis');
assert.match(layerPanel, /flex:\s*0\s+0\s+460px\s*;/, 'layer panel must not shrink when properties expand');
assert.match(layerList, /overflow:\s*hidden\s*;/, 'layer list must keep scrolling inside its own container');

console.log('inspector layout checks passed');
