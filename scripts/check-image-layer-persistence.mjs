import assert from 'node:assert/strict';

const { getImageSource, serializeImageLayer } = await import('../src/image-map-editor/canvas/utils/imageSource.ts');

const file = new File(['image-bytes'], 'photo.png', { type: 'image/png' });
const uploadFile = {
  uid: 'upload-1',
  name: file.name,
  status: 'done',
  originFileObj: file,
};

assert.equal(getImageSource(uploadFile), file, 'UploadFile must resolve to originFileObj');
assert.equal(getImageSource({ uid: 'upload-1', name: file.name }), undefined, 'serialized file metadata is not an image source');

const persisted = serializeImageLayer({
  id: 'image-1',
  type: 'Image',
  src: 'data:image/png;base64,AAAA',
  file: uploadFile,
});
assert.equal(persisted.src, 'data:image/png;base64,AAAA');
assert.equal('file' in persisted, false, 'file metadata must not be persisted with an image layer');

const workarea = serializeImageLayer({ id: 'workarea', type: 'Image', src: 'data:image/png;base64,AAAA' });
assert.equal('src' in workarea, false, 'workarea source is editor-only');

console.log('image-layer persistence checks passed');
