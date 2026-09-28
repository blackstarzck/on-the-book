import { test } from "node:test";
import assert from "node:assert/strict";
import { edition, bookCover } from "../client/book-meta.js";

test("edition maps the two seeded books to their categories and everything else to 문학", () => {
  assert.equal(edition({ id: "alice" }).category, "판타지");
  assert.equal(edition({ id: "oz" }).category, "모험");
  assert.equal(edition({ id: "new-book" }).category, "문학");
});

test("bookCover is an empty labelled slot without an image, even when a cover exists", () => {
  const html = bookCover({ cover: "/uploads/0123456789abcdef0123456789abcdef.png" });
  assert.match(html, /class="catalog-cover image-placeholder"/);
  assert.match(html, /role="img" aria-label="표지 이미지 준비 중"/);
  assert.doesNotMatch(html, /<img/);
});
