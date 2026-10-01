import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
import { browseDefaults, browseUrl, readBrowseState, filterBooks, browsePage } from "../client/browse.js";

const { books } = librarySchema.parse(seed);
const progress = { alice: { chapter: "alice-2" }, oz: { chapter: "deleted" } };
const ids = options => filterBooks(books, progress, { ...browseDefaults, ...options }).map(book => book.id);

test("browse search combines words across title, author, English title and chapters", () => {
  assert.deepEqual(ids({ query: "  앨리스  캐럴 " }), ["alice"]);
  assert.deepEqual(ids({ query: "ALICE" }), ["alice"]);
  assert.deepEqual(ids({ query: books[1].chapters[0].title }), ["oz"]);
  assert.deepEqual(ids({ query: "존재하지 않는 도서" }), []);
  assert.deepEqual(ids({ query: "  " }), ["alice", "oz"]);
});

test("category, reading status and search intersect; deleted progress is unread", () => {
  assert.deepEqual(ids({ category: "판타지", reading: "reading", query: "앨리스" }), ["alice"]);
  assert.deepEqual(ids({ category: "모험", reading: "reading" }), []);
  assert.deepEqual(ids({ reading: "unread" }), ["oz"]);
  assert.deepEqual(ids({ reading: "reading" }), ["alice"]);
});

test("each sort uses book data and leaves the library's order untouched", () => {
  for (const sort of ["title", "author"]) {
    const expected = [...books].sort((a, b) => a[sort].localeCompare(b[sort], "ko")).map(book => book.id);
    assert.deepEqual(ids({ sort }), expected);
  }
  assert.deepEqual(ids({ sort: "year" }), ["oz", "alice"]);
  assert.deepEqual(ids({ sort: "oldest" }), ["alice", "oz"]);
  assert.deepEqual(books.map(book => book.id), ["alice", "oz"]);
});

test("list URLs round-trip combined conditions, special characters and draft previews", () => {
  const state = { query: "앨리스 & 캐럴", category: "판타지", reading: "reading", sort: "year", layout: "list", scroll: 450 };
  const url = browseUrl(state, true);
  assert.equal(browseUrl(), "?view=books");
  assert.match(url, /preview=draft/);
  assert.doesNotMatch(url, /scroll/);
  const { scroll, ...expected } = state;
  assert.deepEqual(readBrowseState(new URLSearchParams(url), books), expected);
  assert.deepEqual(readBrowseState(new URLSearchParams("category=gone&reading=bad&sort=__proto__&layout=bad"), books), browseDefaults);
});

test("the list page safely renders supplied categories and search text, including an empty library", () => {
  const html = browsePage({ books: [{ ...books[0], category: '<img src=x>' }] }, { ...browseDefaults, query: '\"><script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>|<img src=x>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /aria-label="그리드 보기" aria-pressed="true"/);
  assert.match(browsePage({ books: [] }, browseDefaults), /도서 둘러보기<span>0<\/span>/);
});
