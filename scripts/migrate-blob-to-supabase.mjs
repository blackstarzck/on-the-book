// One-time copy of the production library from Vercel Blob (prod/) into the Supabase project.
// Run from the repository root with both credentials in the environment:
//   node --env-file=.env --env-file=<file with BLOB_READ_WRITE_TOKEN> scripts/migrate-blob-to-supabase.mjs
// It refuses to run against a Supabase project that already holds a saved library.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";
import { librarySchema } from "../shared/schema.js";
import { upgrade } from "../server/upgrade.js";
import { toRows, fromRows } from "../server/rows.js";
import { modelInfo } from "../server/model-info.js";

const namespace = process.env.MIGRATE_BLOB_NAMESPACE ?? "prod/";
for (const name of ["BLOB_READ_WRITE_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!process.env[name]) throw Error(`${name} is missing`);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const uploads = db.storage.from("uploads");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const parse = (library) => librarySchema.parse(upgrade(library));
const check = (error, what) => { if (error) throw Error(`${what}: ${error.message}`); };

async function blob(pathname) {
  const result = await get(namespace + pathname, { access: "private", useCache: false });
  if (!result) throw Error(`Blob ${namespace}${pathname} is missing`);
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

const { data: before, error: beforeError } = await db.rpc("load_draft");
check(beforeError, "load_draft");
if (before.version !== 1 || before.books.length || before.models.length)
  throw Error(`Supabase already holds a library (version ${before.version}); nothing was changed.`);

const stored = JSON.parse((await blob("library.json")).toString("utf8"));
const draft = parse(stored.draft);
const live = parse(stored.live);
console.log(`Blob ${namespace}library.json: version ${stored.version}, published ${stored.publishedAt}`);
console.log(`  draft: ${draft.books.map((b) => b.id).join(", ")} / ${draft.models.length} models`);
console.log(`  live:  ${live.books.map((b) => b.id).join(", ")} / ${live.models.length} models`);

// Who uses each file, so every stored object has an owner in the assets table.
const owners = new Map();
const own = (url, owner) => { if (url && url.startsWith("/uploads/") && !owners.has(url)) owners.set(url, owner); };
for (const library of [draft, live]) {
  for (const model of library.models) { own(model.url, `model:${model.id}`); own(model.thumbnail, `model:${model.id}`); }
  for (const book of library.books) {
    own(book.cover, `book:${book.id}`);
    for (const asset of book.floorAssets ?? []) own(asset.asset, `book:${book.id}`);
    for (const chapter of book.chapters) {
      own(chapter.thumbnail, `chapter:${chapter.id}`);
      for (const decal of chapter.floorDecals ?? []) own(decal.asset, `chapter:${chapter.id}`);
    }
  }
  for (const slide of library.home.hero) own(slide.image, `hero:${slide.id}`);
}

const hashes = new Map();
for (const [url, owner] of owners) {
  const name = url.slice("/uploads/".length);
  const buffer = await blob(`uploads/${name}`);
  const glb = name.endsWith(".glb");
  const type = glb ? "model/gltf-binary" : "image/png";
  const { error } = await uploads.upload(name, buffer, { contentType: type, upsert: false });
  check(error, `upload ${name}`);
  const info = glb ? modelInfo(buffer) : null;
  const { error: rowError } = await db.from("assets").insert({
    bucket: "uploads", path: name, kind: glb ? "glb" : "png", content_type: type, bytes: buffer.length, sha256: sha256(buffer),
    width: glb ? null : buffer.readUInt32BE(16), height: glb ? null : buffer.readUInt32BE(20),
    rigged: info ? info.rigged : null, clips: info ? info.clips : null, owner, note: `Vercel Blob ${namespace}uploads`,
  });
  check(rowError, `assets ${name}`);
  hashes.set(name, sha256(buffer));
  console.log(`  copied ${name} (${(buffer.length / 1048576).toFixed(1)}MB, ${owner})`);
}

const { data: saved, error: saveError } = await db.rpc("save_draft", { p_version: 1, p_schema: 1, p_rows: toRows(draft), p_live: null });
check(saveError, "save_draft");
const { error: publishError } = await db.from("publications").insert({ library: live, published_at: stored.publishedAt });
check(publishError, "publications");

// Read everything back and compare with the source.
const { data: after, error: afterError } = await db.rpc("load_draft");
check(afterError, "load_draft");
assert.deepEqual(parse(fromRows(after)), draft, "draft rows differ from the Blob draft");
const { data: latest, error: latestError } = await db.from("publications").select("library, published_at").order("id", { ascending: false }).limit(1).single();
check(latestError, "publications");
assert.deepEqual(latest.library, live, "published snapshot differs from the Blob live library");
assert.equal(new Date(latest.published_at).toISOString(), new Date(stored.publishedAt).toISOString());
for (const [name, hash] of hashes) {
  const { data, error } = await uploads.download(name);
  check(error, `download ${name}`);
  assert.equal(sha256(Buffer.from(await data.arrayBuffer())), hash, `${name} differs after upload`);
}
console.log(`Done: draft version ${saved.version}, ${hashes.size} files verified by SHA-256, draft and live match the source.`);
