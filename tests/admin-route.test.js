import { test } from "node:test";
import assert from "node:assert/strict";
import { notices, parseRoute, resolveRoute, routeHref } from "../admin/route.js";

const at = (href) => { const url = new URL(href, "http://studio.test"); return parseRoute(url.pathname, url.search); };
const library = {
  models: [{ id: "rabbit" }, { id: "clock" }],
  books: [
    { id: "alice", chapters: [
      { id: "alice-1", placements: [{ id: "a1-rabbit" }, { id: "a1-clock" }] },
      { id: "alice-2", placements: [{ id: "a2-key" }], floorDecals: [{ id: "decal-x" }] },
      { id: "alice-3", placements: [{ id: "a3-tree" }], floorDecor: "none" },
    ] },
    { id: "empty", chapters: [] },
  ],
};

test("paths name the four pages and the world editor", () => {
  assert.deepEqual(at("/admin/"), { view: "books" });
  assert.deepEqual(at("/admin"), { view: "books" });
  assert.deepEqual(at("/"), { view: "books" });
  assert.deepEqual(at("/admin/home"), { view: "home" });
  assert.deepEqual(at("/admin/models/"), { view: "models" });
  assert.deepEqual(at("/admin/settings"), { view: "settings" });
  assert.deepEqual(at("/admin/zzz"), { view: "books" });
  assert.deepEqual(at("/admin/books/alice?chapter=alice-2&object=a2-key"), { view: "editor", bookId: "alice", chapterId: "alice-2", objectId: "a2-key" });
  assert.deepEqual(at("/admin/books/%EC%B1%85%201"), { view: "editor", bookId: "책 1" });
});

test("each page keeps only its own query parameters and known values", () => {
  assert.deepEqual(at("/admin/?q=%EC%95%A8%EB%A6%AC%EC%8A%A4&status=draft&chapter=x"), { view: "books", q: "앨리스", status: "draft" });
  assert.deepEqual(at("/admin/?status=xyz&modal=bogus&foo=1"), { view: "books" });
  assert.deepEqual(at("/admin/home?q=x&modal=home-preview"), { view: "home", modal: "home-preview" });
  assert.deepEqual(at("/admin/models?q=%ED%86%A0%EB%81%BC&status=draft"), { view: "models", q: "토끼" });
  assert.deepEqual(at("/admin/settings?modal=book&q=x"), { view: "settings" });
  assert.deepEqual(at("/admin/books/alice?mode=reader&q=%ED%86%A0%EB%81%BC"), { view: "editor", bookId: "alice", reader: true, q: "토끼" });
  assert.deepEqual(at("/admin/books/alice?mode=edit"), { view: "editor", bookId: "alice" });
});

test("dialogs belong to their page, carry an id when they target one, and never open over the reader", () => {
  assert.deepEqual(at("/admin/?modal=new-book"), { view: "books", modal: "new-book" });
  assert.deepEqual(at("/admin/?modal=model&id=rabbit"), { view: "books" });
  assert.deepEqual(at("/admin/models?modal=model-preview&id=rabbit"), { view: "models", modal: "model-preview", modalId: "rabbit" });
  assert.deepEqual(at("/admin/models?modal=model"), { view: "models" });
  assert.deepEqual(at("/admin/models?modal=new-model&id=rabbit"), { view: "models", modal: "new-model" });
  assert.deepEqual(at("/admin/books/alice?modal=chapter&id=alice-3"), { view: "editor", bookId: "alice", modal: "chapter", modalId: "alice-3" });
  assert.deepEqual(at("/admin/books/alice?modal=book"), { view: "editor", bookId: "alice", modal: "book" });
  assert.deepEqual(at("/admin/books/alice?modal=model-preview&id=rabbit"), { view: "editor", bookId: "alice" });
  assert.deepEqual(at("/admin/books/alice?mode=reader&modal=book"), { view: "editor", bookId: "alice", reader: true });
});

test("addresses drop defaults, keep a fixed order and read back as the same place", () => {
  assert.equal(routeHref({ view: "books" }), "/admin/");
  assert.equal(routeHref({ view: "home", modal: "home-preview" }), "/admin/home?modal=home-preview");
  assert.equal(routeHref({ view: "books", modal: "new-book", status: "public", q: "앨리스" }), "/admin/?q=%EC%95%A8%EB%A6%AC%EC%8A%A4&status=public&modal=new-book");
  assert.equal(routeHref({ view: "editor", bookId: "alice", modalId: "rabbit", modal: "model", q: "토끼", reader: false, objectId: "a1-key", chapterId: "alice-1" }), "/admin/books/alice?chapter=alice-1&object=a1-key&q=%ED%86%A0%EB%81%BC&modal=model&id=rabbit");
  assert.equal(routeHref({ view: "editor", bookId: "책 1", chapterId: "c1", reader: true }), "/admin/books/%EC%B1%85%201?chapter=c1&mode=reader");
  for (const route of [
    { view: "books", q: "a b", status: "draft", modal: "new-book" },
    { view: "models", q: "토끼", modal: "model", modalId: "rabbit" },
    { view: "settings" },
    { view: "editor", bookId: "alice", chapterId: "alice-2", objectId: "a2-key", reader: true, q: "x" },
    { view: "editor", bookId: "alice", chapterId: "alice-2", modal: "chapter", modalId: "alice-3" },
  ]) assert.deepEqual(at(routeHref(route)), route);
});

test("addresses resolve against the library and fall back to the nearest place with one notice", () => {
  const resolve = (href) => resolveRoute(at(href), library);
  assert.deepEqual(resolve("/admin/books/alice"), { route: { view: "editor", bookId: "alice", chapterId: "alice-1" }, notice: null });
  assert.deepEqual(resolve("/admin/books/nope?chapter=x&modal=book"), { route: { view: "books" }, notice: notices.book });
  assert.deepEqual(resolve("/admin/books/empty"), { route: { view: "books" }, notice: notices.book });
  assert.deepEqual(resolve("/admin/books/alice?chapter=nope&object=a1-rabbit"), { route: { view: "editor", bookId: "alice", chapterId: "alice-1", objectId: "a1-rabbit" }, notice: notices.chapter });
  assert.deepEqual(resolve("/admin/books/alice?chapter=alice-1&object=a2-key"), { route: { view: "editor", bookId: "alice", chapterId: "alice-1" }, notice: notices.object });
  assert.deepEqual(resolve("/admin/books/alice?chapter=nope&object=zzz&modal=chapter&id=zzz"), { route: { view: "editor", bookId: "alice", chapterId: "alice-1" }, notice: notices.chapter });
  assert.deepEqual(resolve("/admin/books/alice?chapter=alice-1&modal=chapter&id=zzz"), { route: { view: "editor", bookId: "alice", chapterId: "alice-1" }, notice: notices.item });
  assert.deepEqual(resolve("/admin/models?modal=model&id=zzz"), { route: { view: "models" }, notice: notices.item });
  assert.deepEqual(resolve("/admin/models?modal=model-preview&id=clock").route, { view: "models", modal: "model-preview", modalId: "clock" });
  assert.equal(resolve("/admin/books/alice?chapter=alice-2&modal=model&id=zzz").notice, notices.item);
  assert.equal(notices.book, "요청한 도서를 찾을 수 없어 도서 보관함을 열었어요.");
});

test("floor images count as objects: stored decals, or the default ones the chapter draws", () => {
  const object = (chapterId, objectId) => resolveRoute({ view: "editor", bookId: "alice", chapterId, objectId }, library).route.objectId;
  assert.equal(object("alice-1", "decor-1"), "decor-1");
  assert.equal(object("alice-1", "decor-2"), undefined);
  assert.equal(object("alice-2", "decal-x"), "decal-x");
  assert.equal(object("alice-2", "decor-0"), undefined);
  assert.equal(object("alice-3", "decor-0"), undefined);
});
