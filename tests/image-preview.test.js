import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { rename, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { imagePreview, PREVIEW_LIMIT } from '../server/image-preview.js';
import { startServer } from './helpers.js';

test('a preview keeps aspect ratio, stays inline and within budget', async () => {
  const buffer = await sharp({ create: { width: 180, height: 120, channels: 4, background: '#167fc7' } }).png().toBuffer();
  const preview = await imagePreview(buffer);
  assert.equal(preview.color, '#167fc7');
  assert.equal(preview.width, 180); assert.equal(preview.height, 120);
  assert(Buffer.byteLength(preview.lqip) <= PREVIEW_LIMIT);
  const info = await sharp(Buffer.from(preview.lqip.split(',')[1], 'base64')).metadata();
  assert.equal(info.width, 32); assert.equal(info.height, 21);
});

test('transparent pixels do not dominate the colour, and alpha is preserved', async () => {
  const data = Buffer.alloc(100 * 100 * 4);
  for (let y = 30; y < 70; y++) for (let x = 30; x < 70; x++) {
    const i = (y * 100 + x) * 4; data[i] = 240; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
  }
  const buffer = await sharp(data, { raw: { width: 100, height: 100, channels: 4 } }).png().toBuffer();
  const preview = await imagePreview(buffer);
  assert.equal(preview.color, '#f02828');
  assert((await sharp(Buffer.from(preview.lqip.split(',')[1], 'base64')).metadata()).hasAlpha);
  const blank = await imagePreview(await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer());
  assert.equal(blank.color, null);
});

test('uploads persist previews outside the library and public responses exclude private previews', async () => {
  const server = await startServer();
  const json = async (url, method = 'GET', body) => (await fetch(server.url + url, { method, headers: { 'X-On-The-Book': 'studio', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })).json();
  try {
    const urls = [];
    for (const color of ['#119944', '#3355bb']) {
      const png = await sharp({ create: { width: 80, height: 120, channels: 3, background: color } }).png().toBuffer();
      const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'cover.png');
      const response = await fetch(server.url + '/api/floor/upload', { method: 'POST', headers: { 'X-On-The-Book': 'studio' }, body: form });
      assert.equal(response.status, 201);
      const uploaded = await response.json(); assert(uploaded.preview.lqip); urls.push(uploaded.url);
    }
    const draft = await json('/api/studio');
    draft.library.books[0].cover = urls[0]; draft.library.books[1].cover = urls[1]; draft.library.books[1].published = false;
    // A file address typed into prose must never disclose a private inline preview.
    draft.library.books[0].description = urls[1];
    const saved = await json('/api/studio', 'PUT', { ...draft, publish: true }); assert(saved.version);
    const publicData = await json('/api/library');
    assert(publicData.imagePreviews[urls[0]]?.lqip); assert(!publicData.imagePreviews[urls[1]]);
    const studio = await json('/api/studio'); assert(studio.imagePreviews[urls[1]]?.lqip);
    assert(!Object.hasOwn(studio.library, 'imagePreviews'));
    assert.equal((await fetch(server.url + '/uploads/' + urls[0].slice(9) + '.json')).status, 404);
    // Metadata read and write failures cannot break the existing shelf or upload path.
    const previewDir = path.join(server.dir, 'image-previews');
    await rename(previewDir, previewDir + '-backup');
    await writeFile(previewDir, 'unavailable');
    const fallback = await json('/api/library');
    assert.equal(fallback.books[0].cover, urls[0]);
    assert.deepEqual(fallback.imagePreviews, {});
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#123456' } }).png().toBuffer();
    const form = new FormData(); form.append('image', new Blob([png], { type: 'image/png' }), 'fallback.png');
    const uploaded = await fetch(server.url + '/api/floor/upload', { method: 'POST', headers: { 'X-On-The-Book': 'studio' }, body: form });
    assert.equal(uploaded.status, 201);
    assert.equal((await fetch(server.url + (await uploaded.json()).url)).status, 200);
    await rm(previewDir);
    await rename(previewDir + '-backup', previewDir);
  } finally { await server.stop(); }
});
