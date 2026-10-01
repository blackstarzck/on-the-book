import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
import { imageUrls, publicAssetNames, publicLibrary } from "../server/publication.js";

const upload = (c, ext = "png") => `/uploads/${c.repeat(8)}-${c.repeat(4)}-${c.repeat(4)}-${c.repeat(4)}-${c.repeat(12)}.${ext}`;
const names = (...urls) => new Set(urls.map((url) => path.basename(url)));
// The allowlist before home management, kept to prove the new one matches it on existing fields.
function previousAssetNames(db) {
  const books = db.live.books.filter((book) => book.published);
  const models = new Set(books.flatMap((book) => book.chapters.flatMap((chapter) => chapter.placements.map((p) => p.modelId))));
  return new Set([
    ...db.live.models.filter((model) => models.has(model.id)).flatMap((model) => [model.url, model.thumbnail]),
    ...books.flatMap((book) => [book.cover, ...(book.floorAssets || []).map((item) => item.asset), ...book.chapters.flatMap((chapter) => (chapter.floorDecals || []).map((item) => item.asset))]),
  ].filter(Boolean).map((url) => path.basename(url)));
}
function library() {
  const live = structuredClone(seed);
  const [alice, oz] = live.books;
  const used = alice.chapters[0].placements[0].modelId;
  Object.assign(live.models.find((m) => m.id === used), { url: upload("1", "glb"), thumbnail: upload("2") });
  live.models.push({ id: "unused-model", name: "쓰지 않는 모델", kind: "glb", url: upload("3", "glb"), thumbnail: upload("4"), credit: "Test", color: "#123456" });
  alice.cover = upload("5");
  alice.floorAssets = [{ asset: upload("6"), name: "바닥 그림" }];
  alice.chapters[0].floorDecals = [
    { id: "decal-upload", asset: upload("7"), x: 0, z: 0, width: 2, height: 2, rotation: 0 },
    { id: "decal-builtin", asset: "leaves", x: 1, z: 1, width: 2, height: 2, rotation: 0 },
  ];
  oz.published = false;
  oz.cover = upload("8");
  return live;
}

test("a stored library without home fields still gives readers a home", () => {
  const live = structuredClone(seed);
  live.books[1].published = false;
  const result = publicLibrary({ live, publishedAt: "2026-09-28T00:00:00.000Z" });
  assert.deepEqual(result.home, { hero: [] });
  assert.deepEqual(result.books.map((b) => b.id), ["alice"]);
  assert.equal(result.publishedAt, "2026-09-28T00:00:00.000Z");
  assert.deepEqual(publicAssetNames({ live }), new Set());
});

test("the allowlist matches the previous one for covers, floor images and models", () => {
  const db = { live: library() };
  // The previous set also held built-in decal names such as "leaves", which the upload route never serves.
  const servable = [...previousAssetNames(db)].filter((name) => /^[a-f0-9-]{36}\.(png|glb)$/.test(name));
  assert.deepEqual(publicAssetNames(db), new Set(servable));
  assert.deepEqual(publicAssetNames(db), names(upload("1", "glb"), upload("2"), upload("5"), upload("6"), upload("7")));
});

test("main thumbnails, chapter thumbnails and hero images are public only for published books", () => {
  const live = library();
  const [alice, oz] = live.books;
  alice.thumbnail = upload("e");
  oz.thumbnail = upload("f");
  alice.chapters[1].thumbnail = upload("9");
  oz.chapters[0].thumbnail = upload("a");
  alice.description = `본문에 적힌 주소 ${upload("b")} 는 공개하지 않는다`;
  live.home = { hero: [
    { id: "slide-oz", bookId: "oz", image: upload("c") },
    { id: "slide-alice", bookId: "alice", image: upload("d"), kicker: "이번 주" },
  ] };
  const db = { live: librarySchema.parse(live) };
  assert.deepEqual(publicLibrary(db).home.hero.map((s) => s.id), ["slide-alice"]);
  const allowed = publicAssetNames(db);
  for (const url of [upload("e"), upload("9"), upload("d")]) assert(allowed.has(path.basename(url)), url);
  for (const url of [upload("f"), upload("a"), upload("b"), upload("c"), upload("8"), upload("3", "glb"), upload("4")]) assert(!allowed.has(path.basename(url)), url);
});

test("saved images are collected from books and hero slides, not models", () => {
  const live = library();
  live.books[0].thumbnail = upload("e");
  live.books[0].chapters[1].thumbnail = upload("9");
  live.home = { hero: [{ id: "slide-oz", bookId: "oz", image: upload("c") }] };
  assert.deepEqual(imageUrls(live), new Set([upload("5"), upload("e"), upload("6"), upload("7"), upload("8"), upload("9"), upload("c")]));
  assert.deepEqual(imageUrls({ books: [] }), new Set());
});

test("standalone banners expose both images, but a navigation URL cannot expose a private upload", () => {
  const live = { models: [], books: [], home: { hero: [{ id: "banner", url: upload("a"), image: upload("b"), imageMobile: upload("c") }] } };
  assert.equal(publicLibrary({ live }).home.hero.length, 1);
  assert.deepEqual(publicAssetNames({ live }), names(upload("b"), upload("c")));
  assert.deepEqual(imageUrls(live), new Set([upload("b"), upload("c")]));
});
