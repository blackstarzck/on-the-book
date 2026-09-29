import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { librarySchema } from '../shared/schema.js';
import { seed } from './seed.js';
import { upgrade } from './upgrade.js';
import { toRows, fromRows } from './rows.js';
import { modelInfo } from './model-info.js';

export const cloud = process.env.VERCEL === '1';
// Raise this when the library shape changes, so an older studio cannot save over fields it does not know.
// 2: books carry authorIntro and bookIntro (저자 소개·책 소개).
export const SCHEMA_VERSION = 2;

const parse = library => librarySchema.parse(upgrade(library));
const conflict = () => Object.assign(new Error('Save conflict'), { status: 409 });
const outdated = () => Object.assign(new Error('Studio is older than the stored library'), { status: 426 });
const missing = () => Object.assign(new Error('Missing asset'), { code: 'ENOENT' });
const iso = value => value ? new Date(value).toISOString() : value;
const contentType = name => name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'model/gltf-binary';
const validToken = token => /^[a-f0-9-]{36}$/.test(token || '');

// Tests pass DATA_DIR and keep everything in that throwaway folder.
// The local studio and both Vercel apps share the Supabase project instead.
const dataDir = process.env.DATA_DIR;
if (!dataDir && !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY))
  throw Error('Supabase 설정이 필요합니다. .env 에 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 넣어 주세요.');

const backend = dataDir ? await folderBackend(dataDir) : supabaseBackend(createClient(
  process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
));
export const {
  staging, uploadDir, readDraft, readLive, saveDraft, assetInfo, prepareUpload, takeStaged, storeUpload,
  signedDownload, saveSession, validSession, removeSession, readSite, siteAssetNames,
} = backend;

// Upload addresses inside a site asset record, such as the about page journey model and its photos.
const uploadNames = (value, found = new Set()) => {
  if (typeof value === 'string' && /^\/uploads\/[a-f0-9-]{36}\.(png|glb|webp)$/.test(value)) found.add(path.basename(value));
  else if (Array.isArray(value)) value.forEach(item => uploadNames(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => uploadNames(item, found));
  return found;
};

function supabaseBackend(db) {
  const uploads = db.storage.from('uploads');
  const check = (error, what) => {
    if (error) throw Object.assign(new Error(`${what}: ${error.message}`), { cause: error });
  };
  return {
    staging: true,
    uploadDir: null,
    async readDraft() {
      const { data, error } = await db.rpc('load_draft');
      check(error, 'load_draft');
      // A project nobody has saved to yet starts from the sample shelf, like a new data folder did.
      const untouched = data.version === 1 && !data.books.length && !data.models.length;
      return { library: parse(untouched ? seed : fromRows(data)), version: data.version, publishedAt: iso(data.publishedAt) };
    },
    async readLive() {
      const { data, error } = await db.from('publications').select('library, published_at')
        .order('id', { ascending: false }).limit(1).maybeSingle();
      check(error, 'publications');
      return data
        ? { live: data.library, publishedAt: iso(data.published_at) }
        : { live: parse(seed), publishedAt: new Date().toISOString() };
    },
    async saveDraft({ version, library, publish }) {
      const { data, error } = await db.rpc('save_draft', {
        p_version: version, p_schema: SCHEMA_VERSION, p_rows: toRows(library), p_live: publish ? library : null,
      });
      if (error?.code === 'PT409') throw conflict();
      if (error?.code === 'PT426') throw outdated();
      check(error, 'save_draft');
      return { version: data.version, publishedAt: iso(data.publishedAt) ?? undefined };
    },
    // Upload records answer "is this file stored" and "does this model move" without downloading it.
    async assetInfo(names) {
      const found = new Map();
      const wanted = [...new Set(names)];
      if (!wanted.length) return found;
      const { data, error } = await db.from('assets').select('path, rigged, clips').eq('bucket', 'uploads').in('path', wanted);
      check(error, 'assets');
      for (const row of data) found.set(row.path, { rigged: !!row.rigged, clips: row.clips ?? [] });
      return found;
    },
    async prepareUpload(extension) {
      const filename = randomUUID() + extension;
      const { data, error } = await uploads.createSignedUploadUrl(`staging/${filename}`);
      check(error, 'signed upload');
      return { filename, url: data.signedUrl };
    },
    async takeStaged(filename) {
      const { data, error } = await uploads.download(`staging/${filename}`);
      if (error) throw missing();
      await uploads.remove([`staging/${filename}`]);
      return Buffer.from(await data.arrayBuffer());
    },
    async storeUpload(filename, buffer, details = {}) {
      const { error } = await uploads.upload(filename, buffer, { contentType: contentType(filename), upsert: false });
      check(error, 'upload');
      const { error: rowError } = await db.from('assets').insert({
        bucket: 'uploads', path: filename, kind: path.extname(filename).slice(1), content_type: contentType(filename),
        bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'),
        width: details.width ?? null, height: details.height ?? null, rigged: details.rigged ?? null, clips: details.clips ?? null,
      });
      check(rowError, 'assets');
    },
    async signedDownload(filename) {
      const { data, error } = await uploads.createSignedUrl(filename, 10 * 60);
      if (error) throw missing();
      return data.signedUrl;
    },
    async saveSession(token, expiry) {
      await db.from('sessions').delete().lt('expires_at', new Date().toISOString());
      const { error } = await db.from('sessions').insert({ token, expires_at: new Date(expiry).toISOString() });
      check(error, 'sessions');
    },
    async validSession(token) {
      if (!validToken(token)) return false;
      const { data, error } = await db.from('sessions').select('token').eq('token', token)
        .gt('expires_at', new Date().toISOString()).maybeSingle();
      check(error, 'sessions');
      return !!data;
    },
    async removeSession(token) {
      if (!validToken(token)) return;
      const { error } = await db.from('sessions').delete().eq('token', token);
      check(error, 'sessions');
    },
    async readSite(key) {
      const { data, error } = await db.from('site_assets').select('data').eq('key', key).maybeSingle();
      check(error, 'site_assets');
      return data?.data ?? null;
    },
    // Site assets are public: the about page is open to everyone.
    async siteAssetNames() {
      const { data, error } = await db.from('site_assets').select('data');
      check(error, 'site_assets');
      return uploadNames(data.map(row => row.data));
    },
  };
}

async function folderBackend(dir) {
  const uploadDir = path.join(dir, 'uploads');
  const dbFile = path.join(dir, 'library.json');
  await mkdir(uploadDir, { recursive: true });
  let db, queue = Promise.resolve();
  try {
    db = JSON.parse(await readFile(dbFile, 'utf8'));
    const previous = JSON.stringify(db, null, 2);
    db.draft = parse(db.draft);
    db.live = parse(db.live);
    if (previous !== JSON.stringify(db, null, 2)) {
      await writeFile(path.join(dir, `library-before-free-world-${Date.now()}.json`), previous);
      db.version++;
      await writeFile(dbFile + '.tmp', JSON.stringify(db, null, 2));
      await rename(dbFile + '.tmp', dbFile);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    db = { version: 1, draft: parse(seed), live: parse(seed), publishedAt: new Date().toISOString() };
    await writeFile(dbFile, JSON.stringify(db, null, 2));
  }
  const sessions = new Map();
  return {
    staging: false,
    uploadDir,
    async readDraft() { return { library: db.draft, version: db.version, publishedAt: db.publishedAt }; },
    async readLive() { return { live: db.live, publishedAt: db.publishedAt }; },
    saveDraft({ version, library, publish }) {
      const operation = queue.then(async () => {
        if (db.version !== version) throw conflict();
        const next = { ...db, draft: library, version: db.version + 1 };
        if (publish) {
          next.live = structuredClone(library);
          next.publishedAt = new Date().toISOString();
        }
        await writeFile(dbFile + '.tmp', JSON.stringify(next, null, 2));
        await rename(dbFile + '.tmp', dbFile);
        db = next;
        return { version: next.version, publishedAt: next.publishedAt };
      });
      queue = operation.catch(() => {});
      return operation;
    },
    async assetInfo(names) {
      const found = new Map();
      for (const name of new Set(names)) {
        try {
          const buffer = await readFile(path.join(uploadDir, path.basename(name)));
          found.set(name, name.endsWith('.glb') ? modelInfo(buffer) : {});
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      return found;
    },
    async storeUpload(filename, buffer) { await writeFile(path.join(uploadDir, filename), buffer); },
    async saveSession(token, expiry) { sessions.set(token, expiry); },
    async validSession(token) { return validToken(token) && (sessions.get(token) || 0) > Date.now(); },
    async removeSession(token) { if (validToken(token)) sessions.delete(token); },
    // A test that needs a site asset writes site/<key>.json and its files into the data folder first.
    async readSite(key) {
      try { return JSON.parse(await readFile(path.join(dir, 'site', `${key}.json`), 'utf8')); }
      catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    async siteAssetNames() { return new Set(); },
  };
}
