import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sampleGLB } from './helpers.js';

// Live check against the shared Supabase project, run as the Vercel apps run:
//   node --env-file=.env tests/supabase.mjs
// It saves the draft unchanged (the version goes up by two) and removes the model it uploads.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (for example with --env-file=.env).');
process.env.VERCEL = '1';
process.env.DEPLOYMENT_APP = 'admin';
process.env.ADMIN_PASSWORD = randomUUID();
const { default: app } = await import('../server/index.js');
const { readDraft, saveDraft } = await import('../server/storage.js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '';
let uploaded;
const request = (url, options = {}) => fetch(base + url, { ...options, redirect: 'manual', headers: { 'X-On-The-Book': 'studio', 'Content-Type': 'application/json', Cookie: cookie, ...options.headers } });
try {
  assert.equal((await request('/api/studio')).status, 401);
  assert.equal((await request('/api/login', { method: 'POST', body: JSON.stringify({ password: 'incorrect' }) })).status, 401);
  const login = await request('/api/login', { method: 'POST', body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
  const studio = await (await request('/api/studio')).json();
  const save = await request('/api/studio', { method: 'PUT', body: JSON.stringify({ version: studio.version, library: studio.library }) });
  assert.equal(save.status, 200, await save.text());
  const current = await readDraft();
  const concurrent = await Promise.allSettled([1, 2].map(() => saveDraft({ version: current.version, library: current.library })));
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.find(result => result.status === 'rejected').reason.status, 409);
  assert.deepEqual((await readDraft()).library, studio.library);
  console.log('PASS: login, durable save and concurrent save protection');

  const small = sampleGLB();
  const model = Buffer.alloc(6 * 1024 * 1024);
  small.copy(model);
  model.writeUInt32LE(model.length, 8);
  const binOffset = model.readUInt32LE(12) + 20;
  model.writeUInt32LE(model.length - binOffset - 8, binOffset);
  const prepareResponse = await request('/api/uploads/prepare', { method: 'POST', body: JSON.stringify({ kind: 'model', size: model.length }) });
  assert.equal(prepareResponse.status, 200);
  const prepared = await prepareResponse.json();
  const upload = await fetch(prepared.url, { method: 'PUT', body: model, headers: { 'Content-Type': 'model/gltf-binary' } });
  assert.equal(upload.status, 200, await upload.text());
  const finish = await request('/api/models/upload', { method: 'POST', body: JSON.stringify({ filename: prepared.filename }) });
  const registered = await finish.json();
  assert.equal(finish.status, 201, JSON.stringify(registered));
  uploaded = registered.url.slice('/uploads/'.length);
  const { data: record } = await db.from('assets').select('bytes, rigged, clips').eq('bucket', 'uploads').eq('path', uploaded).single();
  assert.deepEqual(record, { bytes: model.length, rigged: true, clips: registered.clips });
  const asset = await request(registered.url);
  assert.equal(asset.status, 307);
  const bytes = await fetch(asset.headers.get('location'));
  assert.equal(bytes.status, 200);
  assert.equal((await bytes.arrayBuffer()).byteLength, model.length);
  console.log('PASS: 6MB direct model upload, upload record and signed download');

  process.env.DEPLOYMENT_APP = 'client';
  assert.equal((await request('/api/library')).status, 200);
  assert.equal((await request('/api/site/about-journey')).status, 200);
  assert.equal((await request('/api/studio')).status, 404);
  assert.equal((await request('/api/login', { method: 'POST', body: '{}' })).status, 404);
  assert.equal((await request(registered.url)).status, 404);
  process.env.DEPLOYMENT_APP = 'admin';
  assert.equal((await request('/api/logout', { method: 'POST', body: '{}' })).status, 200);
  assert.equal((await request('/api/studio')).status, 401);
  console.log('PASS: client isolation, unpublished asset protection and logout');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  if (uploaded) {
    await db.storage.from('uploads').remove([uploaded]);
    await db.from('assets').delete().eq('bucket', 'uploads').eq('path', uploaded);
  }
}
