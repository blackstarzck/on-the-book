import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, put, del, issueSignedToken, presignUrl } from '@vercel/blob';
import { librarySchema } from '../shared/schema.js';
import { seed } from './seed.js';
import { upgrade } from './upgrade.js';

export const cloud = process.env.VERCEL === '1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = process.env.DATA_DIR || path.join(root, 'data');
export const uploadDir = path.join(dataDir, 'uploads');
const dbFile = path.join(dataDir, 'library.json');
const initial = () => ({ version: 1, draft: librarySchema.parse(seed), live: librarySchema.parse(seed), publishedAt: new Date().toISOString() });
const blobKey = name => (process.env.BLOB_NAMESPACE || '') + name;
let localDb, queue = Promise.resolve();

if (!cloud) {
  await mkdir(uploadDir, { recursive: true });
  try {
    localDb = JSON.parse(await readFile(dbFile, 'utf8'));
    const previous = JSON.stringify(localDb, null, 2);
    localDb.draft = librarySchema.parse(upgrade(localDb.draft));
    localDb.live = librarySchema.parse(upgrade(localDb.live));
    if (previous !== JSON.stringify(localDb, null, 2)) {
      await writeFile(path.join(dataDir, `library-before-free-world-${Date.now()}.json`), previous);
      localDb.version++;
      await writeFile(dbFile + '.tmp', JSON.stringify(localDb, null, 2));
      await rename(dbFile + '.tmp', dbFile);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    localDb = initial();
    await writeFile(dbFile, JSON.stringify(localDb, null, 2));
  }
}

export async function readLibrary() {
  if (!cloud) return { db: localDb };
  const result = await get(blobKey('library.json'), { access: 'private', useCache: false, headers: { 'Accept-Encoding': 'identity' } });
  if (!result) return { db: initial() };
  return { db: await new Response(result.stream).json(), etag: result.blob.etag.replace(/^W\//, '') };
}

export function persist(next, snapshot) {
  if (cloud) return put(blobKey('library.json'), JSON.stringify(next), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false,
    allowOverwrite: !!snapshot.etag, ...(snapshot.etag ? { ifMatch: snapshot.etag } : {}),
  });
  const operation = queue.then(async () => {
    if (localDb.version !== snapshot.db.version) throw Object.assign(new Error('Save conflict'), { status: 409 });
    await writeFile(dbFile + '.tmp', JSON.stringify(next, null, 2));
    await rename(dbFile + '.tmp', dbFile);
    localDb = next;
  });
  queue = operation.catch(() => {});
  return operation;
}

export async function readAsset(filename, staging = false) {
  if (!cloud) return readFile(path.join(uploadDir, path.basename(filename)));
  const result = await get(blobKey(`${staging ? 'staging' : 'uploads'}/${path.basename(filename)}`), { access: 'private', useCache: false });
  if (!result) throw Object.assign(new Error('Missing asset'), { code: 'ENOENT' });
  if (result.blob.size > 25 * 1024 * 1024) throw new Error('File too large');
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function writeAsset(filename, buffer) {
  if (!cloud) return writeFile(path.join(uploadDir, filename), buffer);
  return put(blobKey(`uploads/${filename}`), buffer, { access: 'private', addRandomSuffix: false, contentType: filename.endsWith('.png') ? 'image/png' : 'model/gltf-binary' });
}

export async function signedAsset(pathname, operation = 'get', maximumSizeInBytes) {
  pathname = blobKey(pathname);
  const validUntil = Date.now() + 10 * 60 * 1000;
  const limits = operation === 'put' ? { maximumSizeInBytes, allowedContentTypes: [pathname.endsWith('.png') ? 'image/png' : 'model/gltf-binary'] } : {};
  const token = await issueSignedToken({ pathname, operations: [operation], validUntil, ...limits });
  return (await presignUrl(token, { operation, pathname, access: 'private', validUntil, ...limits, ...(operation === 'put' ? { addRandomSuffix: false, allowOverwrite: false } : {}) })).presignedUrl;
}

export async function removeStaging(filename) {
  if (cloud) await del(blobKey(`staging/${path.basename(filename)}`));
}

const sessions = new Map();
export async function saveSession(token, expiry) {
  if (!cloud) return sessions.set(token, expiry);
  await put(blobKey(`sessions/${token}.json`), JSON.stringify({ expiry }), { access: 'private', addRandomSuffix: false });
}
export async function validSession(token) {
  if (!/^[a-f0-9-]{36}$/.test(token || '')) return false;
  if (!cloud) return (sessions.get(token) || 0) > Date.now();
  const result = await get(blobKey(`sessions/${token}.json`), { access: 'private', useCache: false });
  return !!result && (await new Response(result.stream).json()).expiry > Date.now();
}
export async function removeSession(token) {
  if (!/^[a-f0-9-]{36}$/.test(token || '')) return;
  if (!cloud) return sessions.delete(token);
  await del(blobKey(`sessions/${token}.json`));
}

export function publicAssetNames(db) {
  const books = db.live.books.filter(book => book.published);
  const models = new Set(books.flatMap(book => book.chapters.flatMap(chapter => chapter.placements.map(p => p.modelId))));
  return new Set([
    ...db.live.models.filter(model => models.has(model.id)).map(model => model.url),
    ...books.flatMap(book => [book.cover, ...(book.floorAssets || []).map(item => item.asset), ...book.chapters.flatMap(chapter => (chapter.floorDecals || []).map(item => item.asset))]),
  ].filter(Boolean).map(url => path.basename(url)));
}
