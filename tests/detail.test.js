import { test } from "node:test";
import assert from "node:assert/strict";
import { edition, bookCover } from "../client/book-meta.js";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
import { detailUrl, defaultScene, scenePanel, sceneBar, sceneStatus, bookDetail } from "../client/detail.js";

// /api/library serves the seed after schema parsing, which fills mainPlacementId, floorEnabled, cover and
// thumbnail. The seed registers no cover or chapter thumbnail, so its pages keep the empty image slots.
const library = librarySchema.parse(seed);
const alice = library.books.find(b => b.id === "alice");
const count = (html, needle) => html.split(needle).length - 1;
const upload = "/uploads/0123456789abcdef0123456789abcdef.png";

test("edition uses the studio category, then the legacy table for the two seeded books, then 문학", () => {
  assert.equal(edition({ id: "alice" }).category, "판타지");
  assert.equal(edition({ id: "oz" }).category, "모험");
  assert.equal(edition({ id: "new-book" }).category, "문학");
  assert.equal(edition({ id: "new-book", category: "동화" }).category, "동화");
});

test("bookCover shows an uploaded cover and keeps the labelled empty slot without one", () => {
  const html = bookCover({ cover: upload });
  assert.match(html, /^<span class="catalog-cover image-placeholder"><img /);
  assert.ok(html.includes(`<img src="${upload}"`));
  const empty = bookCover({ cover: "" });
  assert.match(empty, /class="catalog-cover image-placeholder"/);
  assert.match(empty, /role="img" aria-label="표지 이미지 준비 중"/);
  assert.doesNotMatch(empty, /<img/);
});

test("detailUrl builds the three reader addresses and keeps the draft preview flag", () => {
  assert.equal(detailUrl({ book: "alice" }), "?book=alice");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2" }), "?book=alice&scene=alice-2");
  assert.equal(detailUrl({ book: "alice", chapter: "alice-1" }), "?book=alice&chapter=alice-1");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2", chapter: "alice-1" }), "?book=alice&chapter=alice-1");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2", preview: true }), "?book=alice&scene=alice-2&preview=draft");
  assert.equal(detailUrl({ book: "alice", preview: false }), "?book=alice");
});

test("defaultScene is the saved chapter while it exists, otherwise the first chapter", () => {
  assert.equal(defaultScene(alice, {}).id, "alice-1");
  assert.equal(defaultScene(alice, { alice: { chapter: "alice-2" } }).id, "alice-2");
  assert.equal(defaultScene(alice, { alice: { chapter: "gone" } }).id, "alice-1");
  assert.equal(defaultScene(alice).id, "alice-1");
});

test("bookDetail opens the panel on the first scene when nothing is saved", () => {
  const html = bookDetail({ book: alice, progress: {} });
  assert.match(html, /<main class="detail-page store-content" id="main-content" data-view="book">/);
  assert.match(html, /<div class="detail-main">/);
  // The hero keeps the year, the Korean title and the author, in that order, and nothing else beside the cover.
  assert.match(html, /<div class="detail-copy"><span class="eyebrow">1865<\/span><h1 id="detail-title" tabindex="-1">이상한 나라의 앨리스<\/h1><p class="detail-meta">루이스 캐럴<\/p><\/div><\/section>/);
  assert.doesNotMatch(html, /판타지|개의 장면|Alice in Wonderland|흰 토끼의 발자국을 따라|detail-description/);
  assert.match(html, /aria-label="표지 이미지 준비 중"/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /이야기 속으로 들어가기|이어 읽기|처음부터 시작하기|detail-crumbs|neighbor-all/);
  assert.equal(count(html, 'class="journey-row"'), 6);
  assert.equal(count(html, 'aria-current="true"'), 1);
  assert.match(html, /data-scene="alice-1" aria-current="true"/);
  assert.match(html, /<h2 id="detail-journey-title">이 책의 여정<\/h2><p><span class="journey-hint journey-hint--wide">장면을 고르면 오른쪽에서 그 장면을 먼저 볼 수 있어요\.<\/span><span class="journey-hint journey-hint--narrow">장면을 고르면 그 장면을 먼저 볼 수 있어요\.<\/span><\/p>/);
  // A journey row names the scene only; the scene's main model is left to the panel.
  assert.match(html, /<span class="journey-copy"><strong>흰 토끼를 따라서<\/strong><small>익숙한 오후, 낯선 모험의 시작<\/small><\/span><i data-lucide="chevron-right" aria-hidden="true"><\/i><\/a>/);
  assert.doesNotMatch(html, /journey-model/);
  assert.match(html, /<aside class="scene-panel" aria-labelledby="panel-scene-title">/);
  assert.match(html, /<h2 id="panel-scene-title">흰 토끼를 따라서<\/h2>/);
  assert.equal(count(html, 'data-enter="alice"'), 2);
  assert.equal(count(html, 'data-enter-chapter="alice-1"'), 2);
  assert.match(html, /<div class="detail-cta"><small class="detail-cta-scene">01 · 흰 토끼를 따라서<\/small><button class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-1">이 장면부터 걷기 /);
  assert.match(html, /<p class="reader-sr-only" id="scene-status" role="status"><\/p>/);
  // The left column ends with the intros; the source and rights stay in the 3D world's 작품 소개 window.
  assert.doesNotMatch(html, /detail-source|원작 정보|gutenberg/);
  assert.doesNotMatch(html, /마지막에 머문 장면/);
});

test("bookDetail opens on the saved scene and marks it in the journey and the panel", () => {
  const html = bookDetail({ book: alice, progress: { alice: { chapter: "alice-2" } }, preview: true });
  assert.match(html, /data-scene="alice-2" aria-current="true"/);
  assert.equal(count(html, 'aria-current="true"'), 1);
  assert.equal(count(html, "마지막에 머문 장면"), 2);
  const savedRow = html.split("<li>").find(row => row.includes('data-scene="alice-2"'));
  assert.ok(savedRow.includes("마지막에 머문 장면"));
  assert.match(html, /<h2 id="panel-scene-title">작아지는 문, 커지는 세계<\/h2>/);
  assert.equal(count(html, 'data-enter-chapter="alice-2"'), 2);
  assert.match(html, /href="\?book=alice&amp;scene=alice-2&amp;preview=draft" data-scene="alice-2"/);
  const gone = bookDetail({ book: alice, progress: { alice: { chapter: "gone" } } });
  assert.match(gone, /data-scene="alice-1" aria-current="true"/);
  assert.doesNotMatch(gone, /마지막에 머문 장면/);
});

test("bookDetail takes an explicit scene from the address", () => {
  const html = bookDetail({ book: alice, chapter: alice.chapters[2] });
  assert.match(html, /data-scene="alice-3" aria-current="true"/);
  assert.equal(count(html, 'aria-current="true"'), 1);
  assert.match(html, /<h2 id="panel-scene-title">버섯 숲의 수수께끼<\/h2>/);
  assert.match(html, /<small class="detail-cta-scene">03 · 버섯 숲의 수수께끼<\/small>/);
});

test("bookDetail shows the studio cover when one is registered", () => {
  const html = bookDetail({ book: { ...alice, cover: upload } });
  assert.ok(html.includes(`<span class="detail-cover"><span class="catalog-cover image-placeholder"><img src="${upload}"`));
  assert.equal(count(html, "<img"), 1);
  assert.doesNotMatch(html, /표지 이미지 준비 중/);
});

test("bookDetail escapes text and survives a chapter without placements", () => {
  const spiky = { ...alice, title: "<b>앨리스</b>", chapters: [{ ...alice.chapters[0], placements: [], mainPlacementId: null }] };
  const html = bookDetail({ book: spiky });
  assert.match(html, /&lt;b&gt;앨리스&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>앨리스/);
  assert.doesNotMatch(html, /journey-model|panel-figures/);
  assert.equal(count(html, 'class="journey-row"'), 1);
  assert.match(html, /장면 01 \/ 01/);
});

test("bookDetail puts the author and book intros after the journey, closing the left column", () => {
  const book = { ...alice, authorIntro: "첫 문단\n같은 문단의 둘째 줄\n\n  둘째 문단  ", bookIntro: "<b>책</b> 소개" };
  const html = bookDetail({ book });
  assert.match(html, /<section class="detail-section detail-intro" id="detail-author" aria-labelledby="detail-author-title"><div class="section-heading"><h2 id="detail-author-title">저자 소개<\/h2><\/div><p class="detail-intro-name">루이스 캐럴<\/p><div class="detail-prose"><p>첫 문단\n같은 문단의 둘째 줄<\/p><p>둘째 문단<\/p><\/div><\/section>/);
  assert.match(html, /<section class="detail-section detail-intro" id="detail-book-intro" aria-labelledby="detail-book-intro-title"><div class="section-heading"><h2 id="detail-book-intro-title">책 소개<\/h2><\/div><div class="detail-prose"><p>&lt;b&gt;책&lt;\/b&gt; 소개<\/p><\/div><\/section>/);
  const at = needle => html.indexOf(needle);
  assert.ok(at('id="detail-journey"') < at('id="detail-author"'));
  assert.ok(at('id="detail-author"') < at('id="detail-book-intro"'));
  assert.match(html, /<p>&lt;b&gt;책&lt;\/b&gt; 소개<\/p><\/div><\/section>\s*<\/div>\s*<aside class="scene-panel"/);
  assert.doesNotMatch(html, /detail-intro-empty|준비 중이에요/);
});

test("bookDetail keeps an empty or missing intro as a 준비 중 line and drops a missing author name", () => {
  // Stored data is not re-parsed, so a book saved before the fields existed has neither of them.
  const stored = structuredClone(alice);
  delete stored.authorIntro;
  delete stored.bookIntro;
  for (const book of [stored, { ...alice, authorIntro: " \n\n ", bookIntro: "" }]) {
    const html = bookDetail({ book });
    assert.match(html, /<h2 id="detail-author-title">저자 소개<\/h2><\/div><p class="detail-intro-name">루이스 캐럴<\/p><p class="detail-intro-empty">저자 소개를 준비 중이에요\.<\/p><\/section>/);
    assert.match(html, /<h2 id="detail-book-intro-title">책 소개<\/h2><\/div><p class="detail-intro-empty">책 소개를 준비 중이에요\.<\/p><\/section>/);
    assert.doesNotMatch(html, /detail-prose/);
  }
  const nameless = bookDetail({ book: { ...alice, author: "", authorIntro: "소개" } });
  assert.doesNotMatch(nameless, /detail-intro-name/);
  // Without an author the hero ends at the title.
  assert.match(nameless, /<\/h1><\/div><\/section>/);
  assert.match(nameless, /<h2 id="detail-author-title">저자 소개<\/h2><\/div><div class="detail-prose"><p>소개<\/p><\/div><\/section>/);
  assert.match(nameless, /<p class="detail-intro-empty">책 소개를 준비 중이에요\.<\/p>/);
});

test("the book schema keeps the intros, fills them in for older data and caps their length", () => {
  assert.equal(alice.authorIntro, "");
  assert.equal(alice.bookIntro, "");
  const withIntro = (field, length) => {
    const next = structuredClone(seed);
    next.books[0][field] = "가".repeat(length);
    return librarySchema.safeParse(next);
  };
  for (const field of ["authorIntro", "bookIntro"]) {
    assert.equal(withIntro(field, 5000).data?.books[0][field].length, 5000);
    assert.equal(withIntro(field, 5001).success, false);
  }
});

test("scenePanel shows the scene and ends with the neighbour buttons under the CTA", () => {
  const html = scenePanel({ book: alice, chapter: alice.chapters[1] });
  assert.match(html, /^<span class="scene-image image-placeholder" data-theme="night" role="img" aria-label="장면 이미지 준비 중"><span class="scene-number">02<\/span><\/span><span class="eyebrow">장면 02 \/ 06<\/span><h2 id="panel-scene-title">작아지는 문, 커지는 세계<\/h2><p class="detail-meta">작은 열쇠가 열어 준 커다란 호기심<\/p><button class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-2">이 장면부터 걷기 /);
  // Previous and next come straight after the CTA and close the panel; the visible words stay the start of each
  // accessible name.
  assert.match(html, /이 장면부터 걷기 <i data-lucide="arrow-up-right" aria-hidden="true"><\/i><\/button><nav class="neighbor-nav" aria-label="이어지는 장면"><a class="neighbor-link" href="\?book=alice&amp;scene=alice-1" data-scene="alice-1" aria-label="이전 장면: 01 흰 토끼를 따라서"><i data-lucide="arrow-left" aria-hidden="true"><\/i> 이전 장면<\/a><a class="neighbor-link" href="\?book=alice&amp;scene=alice-3" data-scene="alice-3" aria-label="다음 장면: 03 버섯 숲의 수수께끼">다음 장면 <i data-lucide="arrow-right" aria-hidden="true"><\/i><\/a><\/nav>$/);
  assert.equal(count(html, 'class="neighbor-link"'), 2);
  // No placement list, no preview reading, no story text, no floor-reading note.
  assert.doesNotMatch(html, /panel-figures|figure-|panel-section|이 장면에서 만나는 것들|장면의 중심|정원으로 가는 열쇠/);
  assert.doesNotMatch(html, /미리 읽기|reading-text|detail-note|바닥 글귀|panel-preview|굴 아래에는/);
  assert.doesNotMatch(html, /<main|detail-crumbs|neighbor-all|data-scene-book|마지막에 머문 장면|<img/);
});

test("scenePanel marks the saved scene and keeps its ids unique with a prefix", () => {
  const saved = scenePanel({ book: alice, chapter: alice.chapters[1], progress: { alice: { chapter: "alice-2" } } });
  assert.match(saved, /<p class="detail-meta">작은 열쇠가 열어 준 커다란 호기심<\/p><span class="journey-badge">마지막에 머문 장면<\/span><button /);
  assert.equal(count(saved, "마지막에 머문 장면"), 1);
  const sheet = scenePanel({ book: alice, chapter: alice.chapters[1], prefix: "sheet" });
  assert.match(sheet, /<h2 id="sheet-scene-title">/);
  assert.doesNotMatch(sheet, /id="panel-|aria-labelledby="panel-/);
});

test("scenePanel shows the studio thumbnail over the theme tint when one is registered", () => {
  const thumbnail = "/uploads/fedcba9876543210fedcba9876543210.png";
  const html = scenePanel({ book: alice, chapter: { ...alice.chapters[1], thumbnail } });
  assert.match(html, /^<span class="scene-image image-placeholder has-image" data-theme="night" role="img" aria-label="작아지는 문, 커지는 세계 장면 이미지">/);
  assert.ok(html.includes(`aria-label="작아지는 문, 커지는 세계 장면 이미지"><img src="${thumbnail}" alt="" decoding="async" draggable="false"><span class="scene-number">02</span></span>`));
  assert.equal(count(html, "<img"), 1);
  assert.doesNotMatch(html, /장면 이미지 준비 중/);
  const spiky = scenePanel({ book: alice, chapter: { ...alice.chapters[1], title: 'a"<b>', thumbnail } });
  assert.match(spiky, /aria-label="a&quot;&lt;b&gt; 장면 이미지"/);
  assert.doesNotMatch(spiky, /aria-label="a"<b>/);
});

test("scenePanel keeps a dimmed slot for a missing neighbour so both buttons stay the same width", () => {
  const first = scenePanel({ book: alice, chapter: alice.chapters[0] });
  assert.equal(count(first, 'class="neighbor-link"'), 1);
  assert.match(first, /<nav class="neighbor-nav" aria-label="이어지는 장면"><span class="neighbor-link is-disabled" aria-hidden="true"><i data-lucide="arrow-left" aria-hidden="true"><\/i> 이전 장면<\/span><a class="neighbor-link" href="\?book=alice&amp;scene=alice-2" data-scene="alice-2" aria-label="다음 장면: 02 작아지는 문, 커지는 세계">다음 장면 /);
  assert.match(first, /장면 01 \/ 06/);
  const last = scenePanel({ book: alice, chapter: alice.chapters[5] });
  assert.equal(count(last, 'class="neighbor-link"'), 1);
  assert.match(last, /data-scene="alice-5" aria-label="이전 장면: 05 장미 정원의 여왕"><i data-lucide="arrow-left" aria-hidden="true"><\/i> 이전 장면<\/a><span class="neighbor-link is-disabled" aria-hidden="true">다음 장면 <i data-lucide="arrow-right" aria-hidden="true"><\/i><\/span><\/nav>/);
});

test("scenePanel is the same with or without placements and story text", () => {
  const bare = { ...alice.chapters[2], body: "", placements: [], mainPlacementId: null };
  assert.equal(scenePanel({ book: alice, chapter: bare }), scenePanel({ book: alice, chapter: alice.chapters[2] }));
  assert.match(scenePanel({ book: alice, chapter: bare }), /data-scene="alice-2"[^]*data-scene="alice-4"/);
});

test("scenePanel keeps the draft preview flag on its links and refuses a foreign chapter", () => {
  const html = scenePanel({ book: alice, chapter: alice.chapters[1], preview: true });
  assert.equal(count(html, "&amp;preview=draft"), 2);
  assert.match(html, /href="\?book=alice&amp;scene=alice-1&amp;preview=draft" data-scene="alice-1"/);
  assert.throws(() => scenePanel({ book: alice, chapter: { ...alice.chapters[0], id: "elsewhere" } }), /elsewhere/);
});

test("sceneBar and sceneStatus name the selected scene", () => {
  const bar = sceneBar({ book: alice, chapter: alice.chapters[1] });
  assert.match(bar, /^<small class="detail-cta-scene">02 · 작아지는 문, 커지는 세계<\/small><button class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-2">이 장면부터 걷기 <i data-lucide="arrow-up-right" aria-hidden="true"><\/i><\/button>$/);
  assert.equal(sceneStatus({ book: alice, chapter: alice.chapters[1] }), "02 작아지는 문, 커지는 세계 장면을 골랐어요");
  assert.throws(() => sceneBar({ book: alice, chapter: { ...alice.chapters[0], id: "elsewhere" } }), /elsewhere/);
});
