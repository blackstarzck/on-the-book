import { test } from "node:test";
import assert from "node:assert/strict";
import { edition, bookCover } from "../client/book-meta.js";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
import { detailUrl, bookDetail } from "../client/detail.js";

// /api/library serves the seed after schema parsing, which fills mainPlacementId, floorEnabled and cover.
const library = librarySchema.parse(seed);
const alice = library.books.find(b => b.id === "alice");
const count = (html, needle) => html.split(needle).length - 1;

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

test("detailUrl builds the three reader addresses and keeps the draft preview flag", () => {
  assert.equal(detailUrl({ book: "alice" }), "?book=alice");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2" }), "?book=alice&scene=alice-2");
  assert.equal(detailUrl({ book: "alice", chapter: "alice-1" }), "?book=alice&chapter=alice-1");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2", chapter: "alice-1" }), "?book=alice&chapter=alice-1");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2", preview: true }), "?book=alice&scene=alice-2&preview=draft");
  assert.equal(detailUrl({ book: "alice", preview: false }), "?book=alice");
});

test("bookDetail shows the work information and a single entry button when nothing is saved", () => {
  const html = bookDetail({ book: alice, progress: {} });
  assert.match(html, /<main class="detail-page store-content" id="main-content" data-view="book">/);
  assert.match(html, /<h1 id="detail-title" tabindex="-1">이상한 나라의 앨리스<\/h1>/);
  assert.match(html, /판타지 · 6개의 장면 · 1865/);
  assert.match(html, /Alice in Wonderland · 루이스 캐럴/);
  assert.match(html, /흰 토끼의 발자국을 따라, 상상이 피어나는 세계로\./);
  assert.match(html, /aria-label="표지 이미지 준비 중"/);
  assert.doesNotMatch(html, /<img/);
  assert.equal(count(html, 'data-enter="alice"'), 1);
  assert.match(html, /class="primary-button detail-enter" data-enter="alice">이야기 속으로 들어가기/);
  assert.doesNotMatch(html, /이어 읽기|처음부터 시작하기|마지막에 머문 장면/);
  assert.match(html, /<h2 id="detail-source-title">원작 정보<\/h2>/);
  assert.match(html, /href="https:\/\/www\.gutenberg\.org\/ebooks\/11" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗/);
});

test("bookDetail lists every chapter as a scene link with its theme, number and main model", () => {
  const html = bookDetail({ book: alice, progress: {} });
  assert.equal(count(html, 'class="journey-row"'), 6);
  for (const chapter of alice.chapters)
    assert.match(html, new RegExp(`href="\\?book=alice&amp;scene=${chapter.id}" data-scene-book="alice" data-scene-chapter="${chapter.id}"`));
  assert.match(html, /<span class="theme-chip" data-theme="meadow" aria-hidden="true"><\/span><span class="journey-number">01<\/span>/);
  assert.match(html, /data-theme="night"/);
  assert.match(html, /<span class="journey-model">· 조끼 입은 흰 토끼<\/span>/);
  assert.match(html, /<h2 id="detail-journey-title">이 책의 여정<\/h2><p>장면을 고르면 그 장면의 이야기를 먼저 볼 수 있어요\.<\/p>/);
});

test("bookDetail resumes the saved chapter, offers a restart and marks the saved row", () => {
  const html = bookDetail({ book: alice, progress: { alice: { chapter: "alice-2" } }, preview: true });
  assert.match(html, /<strong>이어 읽기<\/strong><small>02 · 작아지는 문, 커지는 세계<\/small>/);
  assert.match(html, /class="text-button detail-restart" data-enter="alice" data-enter-chapter="alice-1">처음부터 시작하기<\/button>/);
  assert.equal(count(html, '<span class="journey-badge">마지막에 머문 장면</span>'), 1);
  const savedRow = html.split('<li>').find(row => row.includes('data-scene-chapter="alice-2"'));
  assert.ok(savedRow.includes("마지막에 머문 장면"));
  assert.match(html, /href="\?book=alice&amp;scene=alice-2&amp;preview=draft"/);
});

test("bookDetail treats a saved chapter that no longer exists as no saved progress", () => {
  const html = bookDetail({ book: alice, progress: { alice: { chapter: "gone" } } });
  assert.match(html, /이야기 속으로 들어가기/);
  assert.doesNotMatch(html, /이어 읽기|마지막에 머문 장면/);
});

test("bookDetail escapes text and survives a chapter without placements", () => {
  const spiky = { ...alice, title: "<b>앨리스</b>", chapters: [{ ...alice.chapters[0], placements: [], mainPlacementId: null }] };
  const html = bookDetail({ book: spiky, progress: {} });
  assert.match(html, /&lt;b&gt;앨리스&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>앨리스/);
  assert.doesNotMatch(html, /journey-model/);
  assert.match(html, /1개의 장면/);
});
