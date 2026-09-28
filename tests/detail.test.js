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
  const html = bookDetail({ book: alice, library, progress: {} });
  assert.match(html, /<main class="detail-page store-content" id="main-content" data-view="book">/);
  assert.match(html, /<div class="detail-main">/);
  assert.match(html, /<h1 id="detail-title" tabindex="-1">이상한 나라의 앨리스<\/h1>/);
  assert.match(html, /판타지 · 6개의 장면 · 1865/);
  assert.match(html, /Alice in Wonderland · 루이스 캐럴/);
  assert.match(html, /흰 토끼의 발자국을 따라, 상상이 피어나는 세계로\./);
  assert.match(html, /aria-label="표지 이미지 준비 중"/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /이야기 속으로 들어가기|이어 읽기|처음부터 시작하기|detail-crumbs|neighbor-all/);
  assert.equal(count(html, 'class="journey-row"'), 6);
  assert.equal(count(html, 'aria-current="true"'), 1);
  assert.match(html, /data-scene="alice-1" aria-current="true"/);
  assert.match(html, /<h2 id="detail-journey-title">이 책의 여정<\/h2><p><span class="journey-hint journey-hint--wide">장면을 고르면 오른쪽에서 그 장면을 먼저 볼 수 있어요\.<\/span><span class="journey-hint journey-hint--narrow">장면을 고르면 그 장면을 먼저 볼 수 있어요\.<\/span><\/p>/);
  assert.match(html, /<span class="journey-model">· 조끼 입은 흰 토끼<\/span>/);
  assert.match(html, /<aside class="scene-panel" aria-labelledby="panel-scene-title">/);
  assert.match(html, /<h2 id="panel-scene-title">흰 토끼를 따라서<\/h2>/);
  assert.equal(count(html, 'data-enter="alice"'), 2);
  assert.equal(count(html, 'data-enter-chapter="alice-1"'), 2);
  assert.match(html, /<div class="detail-cta"><small class="detail-cta-scene">01 · 흰 토끼를 따라서<\/small><button class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-1">이 장면부터 걷기 /);
  assert.match(html, /<p class="reader-sr-only" id="scene-status" role="status"><\/p>/);
  assert.match(html, /<h2 id="detail-source-title">원작 정보<\/h2>/);
  assert.match(html, /href="https:\/\/www\.gutenberg\.org\/ebooks\/11" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗/);
  assert.doesNotMatch(html, /마지막에 머문 장면/);
});

test("bookDetail opens on the saved scene and marks it in the journey and the panel", () => {
  const html = bookDetail({ book: alice, library, progress: { alice: { chapter: "alice-2" } }, preview: true });
  assert.match(html, /data-scene="alice-2" aria-current="true"/);
  assert.equal(count(html, 'aria-current="true"'), 1);
  assert.equal(count(html, "마지막에 머문 장면"), 2);
  const savedRow = html.split("<li>").find(row => row.includes('data-scene="alice-2"'));
  assert.ok(savedRow.includes("마지막에 머문 장면"));
  assert.match(html, /<h2 id="panel-scene-title">작아지는 문, 커지는 세계<\/h2>/);
  assert.equal(count(html, 'data-enter-chapter="alice-2"'), 2);
  assert.match(html, /href="\?book=alice&amp;scene=alice-2&amp;preview=draft" data-scene="alice-2"/);
  const gone = bookDetail({ book: alice, library, progress: { alice: { chapter: "gone" } } });
  assert.match(gone, /data-scene="alice-1" aria-current="true"/);
  assert.doesNotMatch(gone, /마지막에 머문 장면/);
});

test("bookDetail takes an explicit scene from the address", () => {
  const html = bookDetail({ book: alice, library, chapter: alice.chapters[2] });
  assert.match(html, /data-scene="alice-3" aria-current="true"/);
  assert.equal(count(html, 'aria-current="true"'), 1);
  assert.match(html, /<h2 id="panel-scene-title">버섯 숲의 수수께끼<\/h2>/);
  assert.match(html, /<small class="detail-cta-scene">03 · 버섯 숲의 수수께끼<\/small>/);
});

test("bookDetail shows the studio cover when one is registered", () => {
  const html = bookDetail({ book: { ...alice, cover: upload }, library });
  assert.ok(html.includes(`<span class="detail-cover"><span class="catalog-cover image-placeholder"><img src="${upload}"`));
  assert.equal(count(html, "<img"), 1);
  assert.doesNotMatch(html, /표지 이미지 준비 중/);
});

test("bookDetail escapes text and survives a chapter without placements", () => {
  const spiky = { ...alice, title: "<b>앨리스</b>", chapters: [{ ...alice.chapters[0], placements: [], mainPlacementId: null }] };
  const html = bookDetail({ book: spiky, library });
  assert.match(html, /&lt;b&gt;앨리스&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>앨리스/);
  assert.doesNotMatch(html, /journey-model|panel-figures/);
  assert.match(html, /1개의 장면/);
  assert.match(html, /장면 01 \/ 01/);
});

test("scenePanel shows the scene, the first paragraph only and the placements with the main one first", () => {
  const html = scenePanel({ book: alice, chapter: alice.chapters[1], library });
  assert.match(html, /^<span class="scene-image image-placeholder" data-theme="night" role="img" aria-label="장면 이미지 준비 중"><span class="scene-number">02<\/span><\/span><span class="eyebrow">장면 02 \/ 06<\/span><h2 id="panel-scene-title">작아지는 문, 커지는 세계<\/h2><p class="detail-meta">작은 열쇠가 열어 준 커다란 호기심<\/p><button class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-2">이 장면부터 걷기 /);
  assert.match(html, /<h3 id="panel-figures-title">이 장면에서 만나는 것들<\/h3><p class="panel-hint">가까이 다가가면 움직여요\.<\/p>/);
  assert.equal(count(html, 'class="figure-chip"'), 3);
  assert.match(html, /<strong>정원으로 가는 열쇠<\/strong><span class="journey-badge">장면의 중심<\/span><span class="figure-story">아주 작은 문 너머에 햇살 가득한 정원이 기다립니다\.<\/span>/);
  assert.equal(count(html, '<span class="journey-badge">장면의 중심</span>'), 1);
  assert.match(html, /class="figure-chip" style="background:#d4aa56"/);
  assert.match(html, /<h3 id="panel-preview-title">미리 읽기<\/h3><div class="reading-text"><p>굴 아래에는 문이 가득한 긴 복도가 있었습니다\./);
  assert.doesNotMatch(html, /작은 병과 케이크를 만난 앨리스/);
  assert.match(html, /<p class="muted detail-note">이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요\.<\/p>/);
  assert.equal(count(html, 'class="neighbor-link"'), 2);
  assert.match(html, /<nav class="neighbor-nav" aria-label="이어지는 장면"><a class="neighbor-link" href="\?book=alice&amp;scene=alice-1" data-scene="alice-1"><i data-lucide="arrow-left" aria-hidden="true"><\/i> 01 흰 토끼를 따라서<\/a><a class="neighbor-link" href="\?book=alice&amp;scene=alice-3" data-scene="alice-3">03 버섯 숲의 수수께끼 <i data-lucide="arrow-right" aria-hidden="true"><\/i><\/a><\/nav>$/);
  assert.doesNotMatch(html, /<main|detail-crumbs|neighbor-all|data-scene-book|마지막에 머문 장면|<img/);
});

test("scenePanel marks the saved scene and keeps its ids unique with a prefix", () => {
  const saved = scenePanel({ book: alice, chapter: alice.chapters[1], library, progress: { alice: { chapter: "alice-2" } } });
  assert.match(saved, /<p class="detail-meta">작은 열쇠가 열어 준 커다란 호기심<\/p><span class="journey-badge">마지막에 머문 장면<\/span><button /);
  assert.equal(count(saved, "마지막에 머문 장면"), 1);
  const sheet = scenePanel({ book: alice, chapter: alice.chapters[1], library, prefix: "sheet" });
  assert.match(sheet, /<h2 id="sheet-scene-title">/);
  assert.match(sheet, /id="sheet-figures" aria-labelledby="sheet-figures-title"/);
  assert.match(sheet, /id="sheet-preview" aria-labelledby="sheet-preview-title"/);
  assert.doesNotMatch(sheet, /id="panel-|aria-labelledby="panel-/);
});

test("scenePanel shows the studio thumbnail over the theme tint when one is registered", () => {
  const thumbnail = "/uploads/fedcba9876543210fedcba9876543210.png";
  const html = scenePanel({ book: alice, chapter: { ...alice.chapters[1], thumbnail }, library });
  assert.match(html, /^<span class="scene-image image-placeholder has-image" data-theme="night" role="img" aria-label="작아지는 문, 커지는 세계 장면 이미지">/);
  assert.ok(html.includes(`aria-label="작아지는 문, 커지는 세계 장면 이미지"><img src="${thumbnail}" alt="" decoding="async" draggable="false"><span class="scene-number">02</span></span>`));
  assert.equal(count(html, "<img"), 1);
  assert.doesNotMatch(html, /장면 이미지 준비 중/);
  const spiky = scenePanel({ book: alice, chapter: { ...alice.chapters[1], title: 'a"<b>', thumbnail }, library });
  assert.match(spiky, /aria-label="a&quot;&lt;b&gt; 장면 이미지"/);
  assert.doesNotMatch(spiky, /aria-label="a"<b>/);
});

test("scenePanel drops the missing neighbour and the floor-reading note when the floor is off", () => {
  const first = scenePanel({ book: alice, chapter: alice.chapters[0], library });
  assert.equal(count(first, 'class="neighbor-link"'), 1);
  assert.match(first, /<nav class="neighbor-nav" aria-label="이어지는 장면"><span><\/span><a class="neighbor-link" href="\?book=alice&amp;scene=alice-2" data-scene="alice-2">02 작아지는 문, 커지는 세계/);
  assert.match(first, /장면 01 \/ 06/);
  const last = scenePanel({ book: alice, chapter: alice.chapters[5], library });
  assert.equal(count(last, 'class="neighbor-link"'), 1);
  assert.match(last, /data-scene="alice-5">.*<\/a><span><\/span><\/nav>$/);
  const silent = scenePanel({ book: alice, chapter: { ...alice.chapters[1], floorEnabled: false }, library });
  assert.match(silent, /굴 아래에는 문이 가득한/);
  assert.doesNotMatch(silent, /바닥 글귀로 읽을 수 있어요/);
});

test("scenePanel omits the sections that have nothing to show and escapes the placement colour", () => {
  const bare = { ...alice.chapters[2], body: "", placements: [], mainPlacementId: null };
  const html = scenePanel({ book: alice, chapter: bare, library });
  assert.doesNotMatch(html, /id="panel-preview"|id="panel-figures"/);
  assert.match(html, /class="neighbor-nav"/);
  assert.match(html, /data-scene="alice-2"/);
  assert.match(html, /data-scene="alice-4"/);
  const single = scenePanel({ book: alice, chapter: { ...alice.chapters[2], body: "한 문단만 있어요." }, library });
  assert.match(single, /<div class="reading-text"><p>한 문단만 있어요\.<\/p><\/div>/);
  assert.doesNotMatch(single, /바닥 글귀로 읽을 수 있어요/);
  const unknownModel = scenePanel({ book: alice, chapter: { ...alice.chapters[2], placements: [{ ...alice.chapters[2].placements[0], modelId: "missing\">" }] }, library });
  assert.match(unknownModel, /style="background:var\(--accent\)"/);
  assert.doesNotMatch(unknownModel, /missing">/);
});

test("scenePanel keeps the draft preview flag on its links and refuses a foreign chapter", () => {
  const html = scenePanel({ book: alice, chapter: alice.chapters[1], library, preview: true });
  assert.equal(count(html, "&amp;preview=draft"), 2);
  assert.match(html, /href="\?book=alice&amp;scene=alice-1&amp;preview=draft" data-scene="alice-1"/);
  assert.throws(() => scenePanel({ book: alice, chapter: { ...alice.chapters[0], id: "elsewhere" }, library }), /elsewhere/);
});

test("sceneBar and sceneStatus name the selected scene", () => {
  const bar = sceneBar({ book: alice, chapter: alice.chapters[1] });
  assert.match(bar, /^<small class="detail-cta-scene">02 · 작아지는 문, 커지는 세계<\/small><button class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-2">이 장면부터 걷기 <i data-lucide="arrow-up-right" aria-hidden="true"><\/i><\/button>$/);
  assert.equal(sceneStatus({ book: alice, chapter: alice.chapters[1] }), "02 작아지는 문, 커지는 세계 장면을 골랐어요");
  assert.throws(() => sceneBar({ book: alice, chapter: { ...alice.chapters[0], id: "elsewhere" } }), /elsewhere/);
});
