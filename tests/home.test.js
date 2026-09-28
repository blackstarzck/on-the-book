import { test } from "node:test";
import assert from "node:assert/strict";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
import { bookCategory, heroKicker, heroSlides } from "../shared/home.js";

const image = "/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png";
const withHome = (hero) => ({ ...structuredClone(seed), home: { hero } });
const issues = (library) => librarySchema.safeParse(library).error?.issues.map((i) => i.message) ?? [];

test("home fields default and parses never share the default slide list", () => {
  const first = librarySchema.parse(structuredClone(seed));
  assert.deepEqual(first.home, { hero: [] });
  assert.equal(first.books[0].chapters[0].thumbnail, "");
  first.home.hero.push({ id: "leak" });
  assert.deepEqual(librarySchema.parse(structuredClone(seed)).home, { hero: [] });
  const legacy = structuredClone(seed);
  delete legacy.books[0].category;
  assert.equal(librarySchema.parse(legacy).books[0].category, "");
});

test("hero slides fill in their defaults and keep their order", () => {
  const parsed = librarySchema.parse(withHome([
    { id: "slide-oz", bookId: "oz", image, focus: "left", kicker: " 새로 공개 " },
    { id: "slide-alice", bookId: "alice" },
  ]));
  assert.deepEqual(parsed.home.hero, [
    { id: "slide-oz", bookId: "oz", image, focus: "left", kicker: "새로 공개", title: "", description: "" },
    { id: "slide-alice", bookId: "alice", image: "", focus: "center", kicker: "", title: "", description: "" },
  ]);
});

test("slides must point at an existing book and stay within five", () => {
  assert.deepEqual(issues(withHome([{ id: "slide-x", bookId: "missing-book" }])), ["추천 슬라이드에 연결된 책을 찾을 수 없습니다."]);
  assert.deepEqual(issues(withHome([{ id: "alice", bookId: "oz" }])), ["중복된 항목 ID가 있습니다."]);
  const six = Array.from({ length: 6 }, (_, i) => ({ id: `slide-${i}`, bookId: "alice" }));
  assert.equal(librarySchema.safeParse(withHome(six)).success, false);
  assert.equal(librarySchema.safeParse(withHome([{ id: "slide-a", bookId: "alice", focus: "top" }])).success, false);
});

test("image paths, categories and reserved filter names are validated", () => {
  for (const edit of [
    (s) => (s.books[0].chapters[0].thumbnail = "https://example.com/a.png"),
    (s) => (s.books[0].chapters[0].thumbnail = "/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg"),
    (s) => (s.home = { hero: [{ id: "slide-a", bookId: "alice", image: "/floor-assets/leaves.svg" }] }),
    (s) => (s.books[0].category = "아홉 글자 분류입니다"),
    (s) => (s.books[0].category = "all"),
    (s) => (s.books[0].category = " reading "),
  ]) {
    const s = structuredClone(seed);
    edit(s);
    assert.equal(librarySchema.safeParse(s).success, false);
  }
  const s = structuredClone(seed);
  s.books[0].category = " 고전 ";
  s.books[0].chapters[0].thumbnail = image;
  const parsed = librarySchema.parse(s);
  assert.equal(parsed.books[0].category, "고전");
  assert.equal(parsed.books[0].chapters[0].thumbnail, image);
});

test("book categories fall back to the former fixed list, then to 문학", () => {
  assert.equal(bookCategory({ id: "alice", category: "고전" }), "고전");
  assert.equal(bookCategory({ id: "alice", category: "" }), "판타지");
  assert.equal(bookCategory({ id: "oz" }), "모험");
  assert.equal(bookCategory({ id: "new-book", category: "" }), "문학");
  assert.equal(bookCategory({ id: "constructor" }), "문학");
});

test("hero slides skip missing books and fall back to the first two books", () => {
  const books = [{ id: "alice" }, { id: "oz" }, { id: "third" }];
  assert.deepEqual(heroSlides(books, undefined).map((s) => s.book.id), ["alice", "oz"]);
  assert.deepEqual(heroSlides(books.slice(1, 2), { hero: [] }).map((s) => s.book.id), ["oz"]);
  assert.deepEqual(heroSlides([], { hero: [] }), []);
  const configured = heroSlides(books, { hero: [
    { id: "slide-hidden", bookId: "unpublished" },
    { id: "slide-third", bookId: "third", kicker: "이번 주" },
    { id: "slide-alice", bookId: "alice" },
  ] });
  assert.deepEqual(configured.map((s) => [s.id, s.book.id]), [["slide-third", "third"], ["slide-alice", "alice"]]);
  assert.deepEqual(heroSlides(books, { hero: [{ id: "slide-hidden", bookId: "unpublished" }] }).map((s) => s.book.id), ["alice", "oz"]);
});

test("hero kickers use the written text or the former defaults", () => {
  assert.equal(heroKicker({ kicker: "이번 주" }, 0), "이번 주");
  assert.equal(heroKicker({ kicker: "" }, 0), "오늘의 이야기");
  assert.equal(heroKicker({}, 3), "한 걸음, 새로운 모험");
});
