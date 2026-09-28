# 작품 상세 두 열 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 뎁스(작품 상세 → 장면 상세)로 구현된 상세 페이지를 밀리의서재식 한 페이지 두 열(왼쪽 작품 정보·여정, 오른쪽 sticky 장면 패널, 휴대폰은 장면 시트 + 하단 바)로 바꾼다.

**Architecture:** `client/detail.js` 가 페이지 전체(`bookDetail`)와 패널 안쪽(`scenePanel`)·하단 바(`sceneBar`)·상태 문구(`sceneStatus`)를 순수 함수로 만든다. `client/main.js` 는 화면 상태를 `home`·`book`·`world` 셋으로 줄이고, 장면 선택은 `book` 상태의 `chapter` + `sceneAddressed` 로 들고 `selectScene()` 이 커튼 없이 패널만 다시 그리며 `history.replaceState` 로 `&scene=` 을 반영한다. 휴대폰(850px 이하)은 기존 `modal()` 로 장면 시트를 연다. 서버·스키마·홈(`landing.js`)·`book-meta.js` 는 바뀌지 않는다.

**Tech Stack:** Vite 7(멀티 페이지), 바닐라 JS(ES 모듈), three 0.180(변경 없음), node:test, @playwright/test(Edge 채널).

**스펙:** `docs/superpowers/specs/2026-09-28-detail-pages-design.md` (18절이 두 뎁스 구현과의 차이표다)

**계획 작성 중 확인해 둔 사실과 스펙과 다른 점:**
- 현재 브랜치(`claude/detail-page-structure-27ccf7`, HEAD 97c1845)는 두 뎁스 구현이 끝나 PR #3 으로 열려 있다. 이 계획은 그 위에 얹는 차이(delta)다.
- 패널 마크업은 휴대폰 시트에도 그대로 들어가므로 같은 id 가 문서에 둘 생긴다. 그래서 `scenePanel()` 은 `prefix`(기본 `"panel"`, 시트는 `"sheet"`)로 id 를 만든다: `#panel-scene-title`, `#panel-figures`, `#panel-preview`, `#sheet-scene-title`…. 스펙 7절·14절이 적은 `#scene-panel-title`, `#detail-figures`, `#detail-preview` 는 Task 3 에서 이 이름으로 고친다.
- `bookDetail()` 은 `library` 를 받는다(패널의 모델 색). `chapter` 를 넘기지 않으면 `defaultScene(book, progress)`(저장된 장면 또는 첫 장면)이다.
- 시드에는 표지·썸네일이 없다. `tests/catalog.mjs` 의 "Studio covers…" 단계는 가로챈 응답으로 앨리스 표지와 **1장면** 썸네일을 준다. 그래서 두 열 페이지에서는 기본 선택(1장면)의 패널에 썸네일이 바로 보인다.
- `tests/mobile-entry.mjs` 는 바꾸지 않는다. 휴대폰 폭에서 `.detail-cta .primary-button`(하단 바)이 그대로 있기 때문이다.
- `tests/capture.mjs` 는 4173 포트를 하드코딩했는데, 그 포트는 사용자의 메인 체크아웃 서버가 쓰고 있을 수 있다. Task 3 에서 `PREVIEW_URL` 환경 변수를 받게 하고 워크트리의 완성본 서버를 다른 포트로 띄워 찍는다.
- 계획을 실행하는 동안 이 워크트리의 개발 서버가 4180 포트에 떠 있을 수 있다(사용자 확인용). 검사는 4336·4321·4341 포트를 쓰므로 부딪히지 않는다. 그 서버를 끄지 않는다.

## Global Constraints

- 기준 스택: 현재 client 의 Vite 멀티 페이지 + 바닐라 JS + npm `three` 0.180. React, TypeScript, 새 npm 의존성을 추가하지 않는다.
- 바꾸지 않는 것: `server/**`, `shared/**`, `admin/**`(Task 3 의 도움말 한 줄 제외), `client/landing.js`, `client/landing.css`, `client/book-meta.js`, `client/index.html`, `client/vercel.json`, `vite.config.js`, 3D 월드 안 "작품 소개"·"이야기의 지도" 모달, `otb-reader` 저장 구조.
- `client/detail.js` 는 CSS·이미지·`document` 를 쓰지 않는다. `node --test` 가 import 한다. `client/detail.css` 는 `main.js` 가 import 한다.
- 주소 규칙: `home` `/client/`, `book` `?book=<id>`(기본 선택) 또는 `?book=<id>&scene=<chapterId>`(선택 장면), `world` `?book=<id>&chapter=<chapterId>`. `?preview=draft` 는 모든 주소에 이어 붙인다. 주소 문자열은 `detailUrl()` 한 곳에서만 만든다. 장면 선택은 `replaceState` 이고 히스토리 항목을 만들지 않는다.
- 화면 상태는 `home`·`book`·`world` 셋. `document.title` 은 `book` 이 `{책 제목} — On the Book`, 나머지는 기존 제목.
- 커튼 문구는 "작품을 펼치는 중이에요…" 하나(상세 진입). 3D 진입·홈 복귀 문구는 기존 그대로.
- 문구(스펙 11절): CTA "이 장면부터 걷기"; 섹션 "이 책의 여정"·"원작 정보"·"이 장면에서 만나는 것들"·"미리 읽기"; 설명 "장면을 고르면 오른쪽에서 그 장면을 먼저 볼 수 있어요."(851px 이상)·"장면을 고르면 그 장면을 먼저 볼 수 있어요."(850px 이하)·"가까이 다가가면 움직여요."; 배지 "마지막에 머문 장면"·"장면의 중심"; 안내 "이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요."; 상태 문구 "`{번호} {장면 제목}` 장면을 골랐어요"; 패널 eyebrow "장면 02 / 06"; 하단 바 "`02 · 장면 제목`"; 이미지 자리 "표지 이미지 준비 중"·"장면 이미지 준비 중"·썸네일이 있으면 "`{장면} 장면 이미지`"; `aria-label` "이어지는 장면".
- 분기점: 1100(패널 340px), 850(한 열·시트·하단 바), 600, 370px. 패널 폭 400px(1101px 이상), 간격 48px(32px). 테마 칩 색 meadow `#cad7aa`, night `#929aaf`, tea `#d7c9b6`, rose `#d8c6b7`, gold `#dcca98`.
- 포트: `tests/catalog.mjs` 4336, `tests/mobile-entry.mjs` 4321, `tests/home-admin.mjs` 4341, 스크린샷 임시 스크립트 4338, 미리보기 완성본 서버 4181. 임시 스크립트는 gitignore 된 `test-results/` 에 두고 커밋하지 않는다.
- 브라우저 검사는 `channel: "msedge"`, `headless: true`. 명령은 워크트리 루트에서 Git Bash 로 실행한다. `tests/helpers.js` 의 서버 기동 한도는 8초다. "Test server did not start" 가 나오면 한 번만 다시 시도한다.
- 커밋 메시지는 영어 명령형 한 줄 + 본문, 마지막 줄 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 회귀 검사가 다시 쓰는 `docs/screenshots/about-*.png`, `docs/browser-results.json` 등은 `git restore` 로 되돌리고, 이 계획이 새로 만들거나 갱신하라고 한 파일만 커밋한다. 푸시는 컨트롤러가 한다.
- 문서 문체: README·ADMIN-GUIDE 는 "~합니다", 스펙·계획은 "~다". 코드 주석은 영어, 화면 문구는 한국어.

---

## 파일 구조

```
client/detail.js       수정. detailUrl(), defaultScene(), scenePanel(), sceneBar(), sceneStatus(), bookDetail(). sceneDetail() 삭제
client/main.js         수정. view 셋, sceneAddressed, resolveView, openDetail, selectScene, setupDetail(document 위임), 시트
client/detail.css      전면 교체. 두 열 격자, sticky 패널, 선택 행, 패널 안 묶음, 장면 시트, 하단 바
client/transitions.js  수정. .detail-page 등장 그룹
tests/detail.test.js   전면 교체. 순수 함수 검사 16개
tests/catalog.mjs      수정. 상세 블록 6곳(카드 → 상세 → 패널 → CTA, 저장 장면, 장면 카드, 주소 직접 열기, 스튜디오 표지, 휴대폰 시트)
tests/capture.mjs      수정. PREVIEW_URL, 패널 CTA
admin/main.js          수정. 장면 썸네일 도움말 한 줄
docs/screenshots/detail-book-desktop.png, detail-book-mobile.png, detail-scene-desktop.png, detail-scene-mobile.png   갱신
docs/preview/detail.png, explore.png                                                                                     갱신
README.md, docs/ADMIN-GUIDE.md, docs/superpowers/specs/2026-09-11-react-next-migration-design.md,
docs/superpowers/specs/2026-09-28-detail-pages-design.md                                                                  수정
```

한 파일의 책임: `detail.js` 는 데이터 → HTML 문자열(이벤트 없음). `main.js` 는 상태·주소·전환·이벤트. `detail.css` 는 상세 페이지 모양. 홈은 손대지 않는다.

---

### Task 1: `detail.js` 를 두 열 마크업으로 바꾸고 단위 검사를 새로 쓴다

이 Task 뒤에도 빌드는 성공하고 앱은 뜬다(`main.js` 의 import 두 줄만 맞춘다). 브라우저 검사는 Task 2 에서 함께 고친다.

**Files:**
- Modify: `client/detail.js`(전체 교체), `client/main.js:8`(import), `client/main.js:94-95`(`page()` 의 `book`·`scene` 갈래)
- Test: `tests/detail.test.js`(전체 교체)

**Interfaces:**
- Consumes: `esc`, `icon`(`shared/ui.js`), `edition`, `bookCover`(`client/book-meta.js`), `librarySchema.parse(seed)` 픽스처(검사).
- Produces(Task 2 가 그대로 쓴다):
  - `detailUrl({ book, scene, chapter, preview = false }) → string`(변경 없음)
  - `defaultScene(book, progress = {}) → chapter`: 저장된 장면이 이 책의 챕터면 그것, 아니면 `book.chapters[0]`
  - `scenePanel({ book, chapter, library, progress = {}, preview = false, prefix = "panel" }) → string`: `aside.scene-panel` 안쪽. 요소 id 는 `${prefix}-scene-title`, `${prefix}-figures`, `${prefix}-figures-title`, `${prefix}-preview`, `${prefix}-preview-title`. 이웃 링크는 `a.neighbor-link[data-scene]`. `chapter` 가 책에 없으면 `Error`
  - `sceneBar({ book, chapter }) → string`: `.detail-cta` 안쪽(`small.detail-cta-scene` + `button.primary-button.detail-enter[data-enter][data-enter-chapter]`)
  - `sceneStatus({ book, chapter }) → string`: "02 작아지는 문, 커지는 세계 장면을 골랐어요"
  - `bookDetail({ book, library, progress = {}, preview = false, chapter = defaultScene(book, progress) }) → string`: `main.detail-page[data-view="book"]` > `div.detail-main`(hero·`#detail-journey`·`.detail-source`) + `aside.scene-panel[aria-labelledby="panel-scene-title"]` + `div.detail-cta` + `p.reader-sr-only#scene-status[role="status"]`. 여정 행은 `a.journey-row[data-scene][aria-current="true|false"]`

- [ ] **Step 1: `tests/detail.test.js` 를 다음 내용으로 전체 교체(실패하는 검사)**

```js
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
  assert.doesNotMatch(sheet, /panel-/);
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/detail.test.js`
Expected: 파일 전체가 실패한다. `does not provide an export named 'defaultScene'`(또는 `scenePanel`). 기존 `sceneDetail` 검사는 이 파일에서 사라졌다.

- [ ] **Step 3: `client/detail.js` 를 다음 내용으로 전체 교체**

```js
// Markup for the book detail page: the scrolling left column (hero, journey, source), the sticky scene
// panel, the phone bar and the phone sheet. No CSS or image imports here: `node --test` loads this file;
// main.js imports detail.css.
import { esc, icon } from "../shared/ui.js";
import { edition, bookCover } from "./book-meta.js";

// The only place that spells reader addresses. `?book=` is the book detail, `&scene=` selects a scene on it
// and `&chapter=` is the 3D world. The draft preview flag rides along on every address.
export function detailUrl({ book, scene, chapter, preview = false }) {
  const params = new URLSearchParams({ book });
  if (chapter) params.set("chapter", chapter);
  else if (scene) params.set("scene", scene);
  if (preview) params.set("preview", "draft");
  return `?${params}`;
}

const two = n => String(n).padStart(2, "0");

const indexOf = (book, chapter) => {
  const index = book.chapters.findIndex(c => c.id === chapter.id);
  if (index < 0) throw new Error(`Chapter ${chapter.id} is not part of ${book.id}`);
  return index;
};

// The chapter's main placement, falling back to the first one. Null when the chapter has no placements.
const mainPlacement = chapter =>
  chapter.placements.find(p => p.id === chapter.mainPlacementId) || chapter.placements[0] || null;

// The chapter the reader last stood in, or null when the record is missing or points at a removed chapter.
const savedChapter = (book, progress) =>
  book.chapters.find(c => c.id === progress?.[book.id]?.chapter) || null;

// The scene the panel opens on: the saved chapter while it exists, otherwise the first chapter.
export const defaultScene = (book, progress = {}) => savedChapter(book, progress) || book.chapters[0];

const themeChip = theme => `<span class="theme-chip" data-theme="${esc(theme)}" aria-hidden="true"></span>`;

const savedBadge = '<span class="journey-badge">마지막에 머문 장면</span>';

const sourceNote = book =>
  `<section class="detail-source" aria-labelledby="detail-source-title"><h2 id="detail-source-title">원작 정보</h2><p class="source-note">${esc(book.rights)}<br><a href="${esc(book.source)}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a></p></section>`;

// The single 3D entry button: it always names the scene it enters.
const enterButton = (book, chapter) =>
  `<button class="primary-button detail-enter" data-enter="${esc(book.id)}" data-enter-chapter="${esc(chapter.id)}">이 장면부터 걷기 ${icon("arrow-up-right")}</button>`;

// The inside of the scene panel. `prefix` keeps element ids unique when the same markup also fills the phone sheet.
export function scenePanel({ book, chapter, library, progress = {}, preview = false, prefix = "panel" }) {
  const index = indexOf(book, chapter);
  const previous = book.chapters[index - 1], next = book.chapters[index + 1];
  const saved = savedChapter(book, progress);
  const paragraphs = chapter.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const main = mainPlacement(chapter);
  const figures = main ? [main, ...chapter.placements.filter(p => p !== main)] : [];
  const colorOf = placement => library.models.find(m => m.id === placement.modelId)?.color || "var(--accent)";
  const sceneLink = (target, label) =>
    `<a class="neighbor-link" href="${esc(detailUrl({ book: book.id, scene: target.id, preview }))}" data-scene="${esc(target.id)}">${label}</a>`;
  const figureSection = figures.length
    ? `<section class="panel-section" id="${prefix}-figures" aria-labelledby="${prefix}-figures-title"><h3 id="${prefix}-figures-title">이 장면에서 만나는 것들</h3><p class="panel-hint">가까이 다가가면 움직여요.</p><ul class="figure-list">${figures.map(p => `<li><span class="figure-chip" style="background:${esc(colorOf(p))}" aria-hidden="true"></span><span class="figure-copy"><strong>${esc(p.title)}</strong>${p === main ? '<span class="journey-badge">장면의 중심</span>' : ""}${p.story ? `<span class="figure-story">${esc(p.story)}</span>` : ""}</span></li>`).join("")}</ul></section>`
    : "";
  // Only the first paragraph is shown; the rest waits on the floor inside the 3D world.
  const previewSection = paragraphs.length
    ? `<section class="panel-section" id="${prefix}-preview" aria-labelledby="${prefix}-preview-title"><h3 id="${prefix}-preview-title">미리 읽기</h3><div class="reading-text"><p>${esc(paragraphs[0])}</p></div>${paragraphs.length > 1 && chapter.floorEnabled !== false ? '<p class="muted detail-note">이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요.</p>' : ""}</section>`
    : "";
  // The image slot is always 16:10 in the panel; a studio thumbnail fills it over the theme tint.
  return `<span class="scene-image image-placeholder${chapter.thumbnail ? " has-image" : ""}" data-theme="${esc(chapter.theme)}" role="img" aria-label="${chapter.thumbnail ? `${esc(chapter.title)} 장면 이미지` : "장면 이미지 준비 중"}">${chapter.thumbnail ? `<img src="${esc(chapter.thumbnail)}" alt="" decoding="async" draggable="false">` : ""}<span class="scene-number">${two(index + 1)}</span></span><span class="eyebrow">장면 ${two(index + 1)} / ${two(book.chapters.length)}</span><h2 id="${prefix}-scene-title">${esc(chapter.title)}</h2>${chapter.subtitle ? `<p class="detail-meta">${esc(chapter.subtitle)}</p>` : ""}${saved?.id === chapter.id ? savedBadge : ""}${enterButton(book, chapter)}${figureSection}${previewSection}<nav class="neighbor-nav" aria-label="이어지는 장면">${previous ? sceneLink(previous, `${icon("arrow-left")} ${two(index)} ${esc(previous.title)}`) : "<span></span>"}${next ? sceneLink(next, `${two(index + 2)} ${esc(next.title)} ${icon("arrow-right")}`) : "<span></span>"}</nav>`;
}

// The phone bar: the selected scene's number and title beside the entry button.
export function sceneBar({ book, chapter }) {
  return `<small class="detail-cta-scene">${two(indexOf(book, chapter) + 1)} · ${esc(chapter.title)}</small>${enterButton(book, chapter)}`;
}

// The status-line text announced when a scene is chosen.
export const sceneStatus = ({ book, chapter }) => `${two(indexOf(book, chapter) + 1)} ${chapter.title} 장면을 골랐어요`;

// The whole book detail page. `chapter` is the scene the panel shows; it defaults to the saved or first scene.
export function bookDetail({ book, library, progress = {}, preview = false, chapter = defaultScene(book, progress) }) {
  const saved = savedChapter(book, progress);
  const rows = book.chapters.map((scene, index) => {
    const main = mainPlacement(scene);
    return `<li><a class="journey-row" href="${esc(detailUrl({ book: book.id, scene: scene.id, preview }))}" data-scene="${esc(scene.id)}" aria-current="${scene.id === chapter.id ? "true" : "false"}">${themeChip(scene.theme)}<span class="journey-number">${two(index + 1)}</span><span class="journey-copy"><strong>${esc(scene.title)}</strong>${scene.subtitle ? `<small>${esc(scene.subtitle)}</small>` : ""}</span>${main ? `<span class="journey-model">· ${esc(main.title)}</span>` : ""}${scene.id === saved?.id ? savedBadge : ""}${icon("chevron-right")}</a></li>`;
  }).join("");
  return `<main class="detail-page store-content" id="main-content" data-view="book">
    <div class="detail-main">
      <section class="detail-hero" aria-labelledby="detail-title"><span class="detail-cover">${bookCover(book)}</span><div class="detail-copy"><span class="eyebrow">${esc(edition(book).category)} · ${book.chapters.length}개의 장면 · ${book.year}</span><h1 id="detail-title" tabindex="-1">${esc(book.title)}</h1><p class="detail-meta">${esc(book.englishTitle)} · ${esc(book.author)}</p><p class="detail-description">${esc(book.description)}</p></div></section>
      <section class="detail-section" id="detail-journey" aria-labelledby="detail-journey-title"><div class="section-heading"><div><h2 id="detail-journey-title">이 책의 여정</h2><p><span class="journey-hint journey-hint--wide">장면을 고르면 오른쪽에서 그 장면을 먼저 볼 수 있어요.</span><span class="journey-hint journey-hint--narrow">장면을 고르면 그 장면을 먼저 볼 수 있어요.</span></p></div></div><ol class="journey-list">${rows}</ol></section>
      ${sourceNote(book)}
    </div>
    <aside class="scene-panel" aria-labelledby="panel-scene-title">${scenePanel({ book, chapter, library, progress, preview })}</aside>
    <div class="detail-cta">${sceneBar({ book, chapter })}</div>
    <p class="reader-sr-only" id="scene-status" role="status"></p>
  </main>`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/detail.test.js`
Expected: `ℹ tests 16`, `ℹ pass 16`, `ℹ fail 0`. 실패하면 정규식과 마크업의 속성 순서·공백을 글자 단위로 맞춘다(마크업이 정답이 아니라 이 계획의 코드가 정답이다).

- [ ] **Step 5: `client/main.js` 의 import 와 `page()` 를 임시로 맞춰 빌드를 살린다**

8행

```js
import { bookDetail, sceneDetail, detailUrl } from "./detail.js";
```

을

```js
import { bookDetail, detailUrl } from "./detail.js";
```

로 바꾸고, `page()` 의 두 줄

```js
  if (view === "book") return bookDetail({ book, progress, preview: draftPreview });
  if (view === "scene") return sceneDetail({ book, chapter, library, preview: draftPreview });
```

을

```js
  if (view === "book") return bookDetail({ book, library, progress, preview: draftPreview });
  // Until Task 2 folds the scene view into the book view, a scene address renders the same page on that scene.
  if (view === "scene") return bookDetail({ book, chapter, library, progress, preview: draftPreview });
```

로 바꾼다. 다른 곳은 손대지 않는다.

- [ ] **Step 6: 단위 검사 전체와 빌드**

Run: `npm test`
Expected: 모두 통과(`tests/detail.test.js` 16개 포함, 합계 55).

Run: `npm run build`
Expected: 성공(three.js 청크 크기 경고는 기존과 같음). `sceneDetail` 관련 오류가 없어야 한다.

- [ ] **Step 7: 커밋**

```bash
git add client/detail.js client/main.js tests/detail.test.js
git commit -F - <<'EOF'
Render the book detail as one page with a scene panel

bookDetail() now builds the scrolling column, the scene panel, the
phone bar and the status line, and scenePanel(), sceneBar() and
sceneStatus() render the selected scene. sceneDetail() is gone; the
scene address renders the same page on that scene until the reader's
state machine follows in the next commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: `main.js` 를 세 화면 상태로 바꾸고, 두 열 CSS 와 브라우저 검사를 맞춘다

**Files:**
- Modify: `client/main.js`(아래 9곳), `client/transitions.js:39-43`(등장 그룹), `client/detail.css`(전체 교체)
- Test: `tests/catalog.mjs`(6개 블록 교체), 기존 `tests/mobile-entry.mjs`·`tests/home-admin.mjs`(변경 없이 통과해야 함)

**Interfaces:**
- Consumes: Task 1 의 `bookDetail`, `scenePanel`, `sceneBar`, `sceneStatus`, `defaultScene`, `detailUrl`; `modal(content)`(`shared/ui.js`: `dialog.modal` 을 만들어 `showModal()` 하고 닫히면 스스로 제거하며 이전 초점을 되돌린다); `transitionPage`.
- Produces: `main.js` 안의 `selectScene(sceneId, { sheet })`, `setupDetail()`(document 위임), 모듈 변수 `sceneAddressed`·`sceneSheet`. DOM 계약(Task 3 의 스크린샷·문서가 의존): 데스크톱은 `aside.scene-panel` 이 보이고 `.detail-cta` 는 숨김, 850px 이하는 반대. 휴대폰에서 `a.journey-row` 를 누르면 `dialog.modal.scene-sheet[open]` 이 열리고 그 안에 `#sheet-scene-title` 이 있다.

- [ ] **Step 1: `client/main.js` 를 아홉 군데 바꾼다**

(1) 8행 import:

```js
import { bookDetail, scenePanel, sceneBar, sceneStatus, defaultScene, detailUrl } from "./detail.js";
```

(2) 10~20행의 `let` 선언. 주석을 고치고 변수 둘을 더한다.

```js
let library,
  book,
  chapter,
  world,
  // Which screen is on: the bookshelf ("home"), the book detail ("book", with `chapter` as the panel's scene) or the 3D world.
  view = "home",
  // Whether the address names the panel's scene (`&scene=`). False while the panel shows the default scene.
  sceneAddressed = false,
  // The phone's scene sheet while it is open.
  sceneSheet = null,
  sound = false,
  audioContext,
  ambient,
  saveTimer,
  disposeView;
```

(3) `currentUrl()` 의 `scene:` 줄:

```js
    scene: view === "book" && sceneAddressed ? chapter.id : undefined,
```

(4) `resolveView()` 전체:

```js
// Which screen a query string asks for. Unknown ids fall back to the nearest screen;
// `clean` says the address had unusable parts and should be rewritten.
function resolveView(params) {
  const selected = library.books.find(b => b.id === params.get("book"));
  if (!selected) return { view: "home", book: library.books[0], chapter: library.books[0].chapters[0], sceneAddressed: false, clean: params.has("book") || params.has("scene") || params.has("chapter") };
  const explored = selected.chapters.find(c => c.id === params.get("chapter"));
  if (explored) return { view: "world", book: selected, chapter: explored, sceneAddressed: false, clean: false };
  const scene = selected.chapters.find(c => c.id === params.get("scene"));
  if (scene) return { view: "book", book: selected, chapter: scene, sceneAddressed: true, clean: false };
  return { view: "book", book: selected, chapter: defaultScene(selected, progress), sceneAddressed: false, clean: params.has("scene") || params.has("chapter") };
}
```

(5) `applyResolved()` 에 한 줄:

```js
function applyResolved(state) {
  view = state.view;
  book = state.book;
  chapter = state.chapter;
  sceneAddressed = state.sceneAddressed;
  if (view === "world") { record().chapter = chapter.id; remember(); }
  if (state.clean) history.replaceState(null, "", currentUrl());
}
```

(6) `pageTitle()` 에서 `scene` 줄을 지운다:

```js
function pageTitle() {
  if (view === "book") return `${book.title} — On the Book`;
  return baseTitle;
}
```

(7) `page()` 의 두 줄(Task 1 의 임시 갈래 포함)을 한 줄로:

```js
  if (view === "book") return bookDetail({ book, chapter, library, progress, preview: draftPreview });
```

(8) `setupDetail()` 전체를 다음으로 바꾸고 그 앞에 `narrow`, 뒤에 `selectScene` 을 둔다:

```js
const narrow = () => matchMedia("(max-width: 850px)").matches;
// One delegated click handler for the book detail. It sits on the document because the phone's scene sheet is a
// <dialog> appended to <body>, outside <main>. CTA buttons enter the world; scene links swap the panel in place.
function setupDetail() {
  const abort = new AbortController();
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-enter], a[data-scene]");
    if (!target) return;
    if (target.dataset.enter) { sceneSheet?.close(); enterBook(target.dataset.enter, target.dataset.enterChapter); return; }
    if (modifiedClick(event)) return;
    event.preventDefault();
    selectScene(target.dataset.scene, { sheet: target.classList.contains("journey-row") && narrow() });
  }, { signal: abort.signal });
  return () => { abort.abort(); sceneSheet?.close(); };
}
// Shows a scene in the panel (and in the phone sheet when asked) without leaving the page or adding history.
function selectScene(sceneId, { sheet = false } = {}) {
  const next = book.chapters.find(c => c.id === sceneId);
  if (!next) return;
  chapter = next;
  sceneAddressed = true;
  history.replaceState(null, "", currentUrl());
  const options = { book, chapter, library, progress, preview: draftPreview };
  const panel = document.querySelector(".scene-panel");
  panel.innerHTML = scenePanel(options);
  panel.scrollTop = 0;
  document.querySelector(".detail-cta").innerHTML = sceneBar({ book, chapter });
  for (const row of document.querySelectorAll(".journey-row")) row.setAttribute("aria-current", String(row.dataset.scene === chapter.id));
  document.querySelector("#scene-status").textContent = sceneStatus({ book, chapter });
  if (sceneSheet?.open) {
    for (const node of sceneSheet.querySelectorAll(":scope > :not(.close-modal)")) node.remove();
    sceneSheet.insertAdjacentHTML("beforeend", scenePanel({ ...options, prefix: "sheet" }));
    sceneSheet.scrollTop = 0;
  } else if (sheet) {
    sceneSheet = modal(scenePanel({ ...options, prefix: "sheet" }));
    sceneSheet.classList.add("scene-sheet");
    sceneSheet.setAttribute("aria-labelledby", "sheet-scene-title");
    sceneSheet.addEventListener("close", () => { sceneSheet = null; }, { once: true });
  }
  icons();
}
```

(9) `openDetail()` 전체:

```js
// Opens the book detail with a history entry: on the default scene, or on the scene a home card named.
async function openDetail(target, bookId, sceneId) {
  const selected = library.books.find(b => b.id === bookId);
  if (!selected) return;
  const scene = target === "scene" ? selected.chapters.find(c => c.id === sceneId) : null;
  if (target === "scene" && !scene) return;
  await transitionPage(app, () => {
    view = "book";
    book = selected;
    chapter = scene || defaultScene(selected, progress);
    sceneAddressed = Boolean(scene);
    history.pushState(null, "", currentUrl());
    render();
  }, { label: "작품을 펼치는 중이에요…" });
}
```

`render()` 의 마지막 `else { disposeView = setupDetail(); }`, `enterBook`, `openLibrary`, `popstate`, `init` 은 그대로다. 파일 안에 `"scene"` 이라는 view 값이 남지 않았는지 `grep -n '"scene"' client/main.js` 로 확인한다(결과가 없어야 한다).

- [ ] **Step 2: `client/transitions.js` 의 등장 그룹**

```js
    : app.querySelector(".detail-page")
      ? [".site-header", ".detail-hero", "#detail-journey, .detail-source", ".scene-panel, .detail-cta", ".site-footer"]
```

- [ ] **Step 3: `client/detail.css` 를 다음 내용으로 전체 교체**

```css
/* The book detail: a scrolling left column and a sticky scene panel. Phones get a scene sheet and a pinned bar.
   Type, gutters (.store-content) and section headings come from the bookshelf. */
.detail-page { display: grid; grid-template-columns: minmax(0, 1fr) 400px; column-gap: 48px; align-items: start; }
.detail-page h1, .detail-page h2, .detail-page h3 { font-family: inherit; letter-spacing: -.05em; font-weight: 650; }
.detail-main { min-width: 0; }
.detail-hero { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 28px; align-items: center; margin-top: 12px; }
/* An uploaded cover fills its .catalog-cover slot through landing.css's `.catalog-cover img` rule. */
.detail-cover { display: block; width: 160px; }
.detail-copy { min-width: 0; }
.detail-copy .eyebrow { margin-bottom: 14px; font-size: 12px; letter-spacing: .08em; color: #75867a; }
.detail-copy h1 { margin: 0 0 12px; font-size: 36px; line-height: 1.2; word-break: keep-all; outline: none; }
.detail-meta { margin: 0 0 12px; font-size: 15px; color: #6b7567; }
.detail-description { max-width: 560px; margin: 0; font-size: 17px; line-height: 1.7; color: #3f4a44; word-break: keep-all; }
.detail-section { padding-top: 36px; margin-top: 34px; border-top: 1px solid #edf0ec; }
.detail-section .section-heading { margin-bottom: 16px; }
.journey-hint--narrow { display: none; }
.journey-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid #e7ebe7; }
.journey-row { display: flex; align-items: center; gap: 14px; min-height: 64px; padding: 12px 10px; border-bottom: 1px solid #e7ebe7; border-left: 3px solid transparent; }
.journey-row:hover { background: #f6f8f5; text-decoration: none; }
/* The row the panel shows. */
.journey-row[aria-current="true"] { background: #f0f4ef; border-left-color: var(--accent); }
.journey-number { flex: none; width: 28px; font-size: 13px; color: #75867a; font-variant-numeric: tabular-nums; }
.journey-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.journey-copy strong { font-size: 16px; font-weight: 650; letter-spacing: -.025em; overflow-wrap: anywhere; }
.journey-copy small { font-size: 13px; color: #768079; }
.journey-model { font-size: 13px; color: #75867a; white-space: nowrap; }
.journey-badge { flex: none; padding: 4px 9px; border-radius: 20px; background: #e8f0e6; color: #2f5a41; font-size: 11px; font-weight: 650; white-space: nowrap; }
.journey-row svg { flex: none; width: 16px; height: 16px; margin-left: auto; color: #93a094; }
/* Theme colours mirror the 3D floor (shared/world.js themes[*].ground). meadow is the default. */
.theme-chip { flex: none; width: 14px; height: 14px; border-radius: 4px; }
.theme-chip, .scene-image[data-theme] { background: #cad7aa; }
.theme-chip[data-theme="night"], .scene-image[data-theme="night"] { background: #929aaf; }
.theme-chip[data-theme="tea"], .scene-image[data-theme="tea"] { background: #d7c9b6; }
.theme-chip[data-theme="rose"], .scene-image[data-theme="rose"] { background: #d8c6b7; }
.theme-chip[data-theme="gold"], .scene-image[data-theme="gold"] { background: #dcca98; }
.detail-source { padding-top: 34px; margin-top: 34px; border-top: 1px solid #edf0ec; }
.detail-source h2 { margin: 0 0 10px; font-size: 15px; color: #4f5f56; }
.detail-source .source-note { padding: 0; border: 0; font-size: 12px !important; line-height: 1.8; color: #7f8982; }
/* The scene panel follows the scroll; when it is taller than the screen it scrolls inside. */
.scene-panel { position: sticky; top: 24px; max-height: calc(100dvh - 48px); overflow-y: auto; padding: 20px; border: 1px solid #e7ebe7; border-radius: 14px; background: #fff; }
/* Panel and sheet share their inner layout. The image slot is always 16:10; a thumbnail fills it (landing.css:
   `.scene-image img` covers the slot and `.scene-image.has-image .scene-number` becomes a light pill). */
.scene-panel .scene-image, .scene-sheet .scene-image { display: block; width: 100%; aspect-ratio: 16 / 10; border-radius: 10px; }
.scene-panel .scene-number, .scene-sheet .scene-number { font-size: 13px; color: #3a4a40; }
.scene-panel .eyebrow, .scene-sheet .eyebrow { margin: 16px 0 8px; font-size: 12px; letter-spacing: .08em; color: #75867a; }
.scene-panel h2, .scene-sheet h2 { margin: 0 0 6px; font-size: 22px; line-height: 1.3; word-break: keep-all; }
.scene-panel .detail-meta, .scene-sheet .detail-meta { margin: 0 0 10px; font-size: 14px; }
.scene-panel > .journey-badge, .scene-sheet > .journey-badge { display: inline-block; margin-bottom: 12px; }
.scene-panel .detail-enter, .scene-sheet .detail-enter { width: 100%; margin: 6px 0 4px; justify-content: space-between; }
.panel-section { padding-top: 18px; margin-top: 18px; border-top: 1px solid #edf0ec; }
.panel-section h3 { margin: 0 0 4px; font-size: 14px; }
.panel-hint { margin: 0 0 8px; font-size: 12px; color: #75867a; }
.figure-list { list-style: none; margin: 0; padding: 0; }
.figure-list li { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; border-top: 1px solid #eef1ec; }
.figure-list li:first-child { border-top: 0; padding-top: 4px; }
.figure-chip { flex: none; width: 18px; height: 18px; margin-top: 2px; border: 1px solid #0000000f; border-radius: 6px; }
.figure-copy { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.figure-copy strong { font-size: 14px; font-weight: 650; }
.figure-copy .journey-badge { align-self: flex-start; }
.figure-story { font-size: 12px; line-height: 1.65; color: #6b776f; }
.panel-section .reading-text { margin: 0; font-size: 14px; line-height: 1.9; }
.detail-note { margin: 10px 0 0; font-size: 12px; }
.neighbor-nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 14px; border-top: 1px solid #edf0ec; font-size: 13px; }
.neighbor-link { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: #3f5a49; }
.neighbor-link:hover { color: var(--accent); text-decoration: none; }
.neighbor-link svg { width: 15px; height: 15px; }
.neighbor-nav > :last-child { text-align: right; }
.detail-enter { gap: 14px; padding: 14px 20px; font-size: 14px; font-weight: 600; }
.detail-enter svg { width: 17px; height: 17px; }
/* The phone bar exists in the markup at every width but only shows in the one-column layout. */
.detail-cta { display: none; }
/* The phone's scene sheet reuses the modal dialog, pinned to the bottom edge. */
.scene-sheet { position: fixed; inset: auto 0 0 0; width: auto; max-width: none; max-height: 88dvh; margin: 0; padding: 22px 20px calc(20px + env(safe-area-inset-bottom)); overflow-y: auto; border: 0; border-radius: 18px 18px 0 0; background: #fff; }
@media (max-width: 1100px) {
  .detail-page { grid-template-columns: minmax(0, 1fr) 340px; column-gap: 32px; }
  .detail-copy h1 { font-size: 32px; }
}
@media (max-width: 850px) {
  .detail-page { display: flex; flex-direction: column; }
  .scene-panel { display: none; }
  .journey-hint--wide { display: none; }
  .journey-hint--narrow { display: inline; }
  .detail-cta { display: flex; align-items: center; justify-content: space-between; gap: 12px; order: 99; position: sticky; bottom: 0; z-index: 5; margin: 0 -24px; padding: 10px 24px calc(10px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid var(--line); }
  .detail-cta-scene { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #4f5f56; }
  .detail-cta .primary-button { flex: none; }
  .detail-source { padding-bottom: 8px; }
}
@media (max-width: 600px) {
  .detail-hero { grid-template-columns: 112px minmax(0, 1fr); gap: 18px; align-items: start; }
  .detail-cover { width: 112px; }
  .detail-copy .eyebrow { margin-bottom: 8px; font-size: 11px; }
  .detail-copy h1 { margin-bottom: 8px; font-size: 26px; letter-spacing: -.045em; }
  .detail-meta { font-size: 13px; }
  .detail-description { font-size: 15px; }
  .detail-cta { margin: 0 -20px; padding-left: 20px; padding-right: 20px; }
  .detail-section { padding-top: 30px; margin-top: 28px; }
  .detail-section .section-heading h2 { font-size: 21px; }
  .journey-row { gap: 12px; min-height: 58px; }
  .journey-model { display: none; }
}
@media (max-width: 370px) {
  .detail-hero { grid-template-columns: minmax(0, 1fr); }
  .detail-cover { width: 130px; margin: 0 auto; }
  .detail-cta { margin: 0 -14px; padding-left: 14px; padding-right: 14px; }
}
```

- [ ] **Step 4: 빌드하고 눈으로 한 번 본다**

Run: `npm run build`
Expected: 성공.

임시 확인(커밋하지 않음): `PORT=4339 node server/index.js --production` 을 백그라운드로 띄우고 `http://127.0.0.1:4339/client/?book=alice` 를 헤드리스로 찍어 두 열이 나오는지 본다.

```js
// test-results/two-column-look.mjs
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
for (const [name, viewport] of [['desktop', { width: 1440, height: 960 }], ['phone', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://127.0.0.1:4339/client/?book=alice&scene=alice-2');
  await page.waitForSelector('.detail-page');
  await page.waitForFunction(() => !document.querySelector('.reader-curtain'));
  await page.screenshot({ path: `test-results/two-column-${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
```

Run: `node test-results/two-column-look.mjs` 뒤 두 PNG 를 Read 로 열어 본다.
Expected: 데스크톱은 왼쪽에 표지·여정(2행 강조), 오른쪽에 패널(16:10 테마 색 자리, "작아지는 문, 커지는 세계", CTA). 휴대폰은 한 열이고 아래에 "02 · 작아지는 문, 커지는 세계" 바가 보인다. 확인 뒤 4339 서버를 끈다(`netstat -ano | grep ":4339 " | grep LISTENING` → `taskkill //PID <pid> //F`).

- [ ] **Step 5: `tests/catalog.mjs` 의 여섯 블록을 바꾼다**

(A) `await expect(page.locator('[data-book="alice"]')).toHaveAttribute('href', '?book=alice');` 로 시작해 `pass('Book cards open the book detail page');` 다음의 커튼 단정(`await expect(page.locator('.reader-curtain')).toHaveCount(0);` 로 끝나는 3D 진입 4줄)까지를 다음으로 바꾼다.

```js
  await expect(page.locator('[data-book="alice"]')).toHaveAttribute('href', '?book=alice');
  await expect(page.locator('[data-scene-chapter="alice-3"]')).toHaveAttribute('href', '?book=alice&scene=alice-3');
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('.journey-row')).toHaveCount(6);
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-1');
  await expect(page.locator('.scene-panel')).toBeVisible();
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('흰 토끼를 따라서');
  await expect(page.locator('.detail-cta')).toBeHidden();
  await expect(page.locator('.detail-page img')).toHaveCount(0);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  pass('Book cards open the book detail with the first scene in the panel');
  // Choosing a scene swaps the panel in place: no curtain, no history entry, the address follows.
  const entries = await page.evaluate(() => history.length);
  await page.locator('.journey-row[data-scene="alice-2"]').click();
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page).toHaveURL(/\?book=alice&scene=alice-2$/);
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await expect(page.locator('.journey-row[data-scene="alice-2"]')).toBeFocused();
  await expect(page.locator('#scene-status')).toContainText('02');
  await page.locator('.scene-panel .neighbor-link[data-scene="alice-3"]').click();
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('버섯 숲의 수수께끼');
  await expect(page).toHaveURL(/scene=alice-3$/);
  await page.locator('.journey-row[data-scene="alice-1"]').click();
  await expect(page).toHaveURL(/scene=alice-1$/);
  await expect(page.locator('.scene-panel .detail-enter')).toHaveAttribute('data-enter-chapter', 'alice-1');
  pass('Journey rows and neighbour links swap the scene panel without leaving the page');
  await page.locator('.scene-panel .detail-enter').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page).toHaveURL(/book=alice&chapter=alice-1/);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
```

(B) `await page.getByRole('button', { name: '읽던 작품 이어 보기', exact: true }).click();`(두 번째 것, `await expect(page.locator('canvas')).toHaveCount(0);` 다음 줄)부터 `pass('Detail CTA resumes the saved chapter; history keeps the detail page between home and world');` 까지를 다음으로 바꾼다.

```js
  await page.getByRole('button', { name: '읽던 작품 이어 보기', exact: true }).click();
  await expect(page.locator('.book-title')).toHaveText('이상한 나라의 앨리스');
  await page.locator('[data-book="alice"]').click();
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await expect(page.locator('.journey-row[data-scene="alice-2"] .journey-badge')).toHaveText('마지막에 머문 장면');
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page.locator('.scene-panel .journey-badge', { hasText: '마지막에 머문 장면' })).toHaveCount(1);
  await page.locator('.scene-panel .detail-enter').click();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.reload();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.goBack();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await page.goBack();
  await expect(page.locator('.library-page')).toBeVisible();
  await page.goForward();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#map-button')).toContainText('02');
  pass('The panel opens on the saved scene; history keeps the detail page between home and world');
```

(C) 오즈 진입: `await page.locator('.detail-cta .primary-button').click();`(`await expect(page.locator('.journey-row')).toHaveCount(3);` 다음 줄)을 `await page.locator('.scene-panel .detail-enter').click();` 로 바꾼다.

(D) `await page.locator('[data-scene-chapter="alice-3"]').click();` 부터 `pass('Blank image slots; scene cards open the scene detail and its CTA enters that chapter');` 까지를 다음으로 바꾼다.

```js
  await page.locator('[data-scene-chapter="alice-3"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page).toHaveURL(/book=alice&scene=alice-3$/);
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-3');
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('버섯 숲의 수수께끼');
  await expect(page.locator('.scene-panel #panel-preview .reading-text p')).toHaveCount(1);
  await expect(page.locator('.scene-panel .figure-list li')).toHaveCount(3);
  await expect(page.locator('.scene-panel .figure-list li').first()).toContainText('장면의 중심');
  await expect(page.locator('.scene-panel .neighbor-link').first()).toContainText('02');
  await expect(page.locator('.scene-panel .neighbor-link').last()).toContainText('04');
  await expect(page.locator('.detail-page img')).toHaveCount(0);
  await page.locator('.scene-panel .detail-enter').click();
  await expect(page.locator('#map-button')).toContainText('03');
  await expect(page).toHaveURL(/book=alice&chapter=alice-3/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  pass('Blank image slots; scene cards open the book detail on that scene and its CTA enters that chapter');
```

(E) 주소 직접 열기 블록에서 `?book=alice&scene=alice-2` 의 네 줄

```js
  await page.goto(`${server.url}/client/?book=alice&scene=alice-2`);
  await expect(page.locator('.detail-page[data-view="scene"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page).toHaveTitle('작아지는 문, 커지는 세계 · 이상한 나라의 앨리스 — On the Book');
```

을 다음으로 바꾼다.

```js
  await page.goto(`${server.url}/client/?book=alice&scene=alice-2`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page).toHaveTitle('이상한 나라의 앨리스 — On the Book');
```

(F) 스튜디오 표지 묶음에서 `// The detail pages show the same studio cover and chapter thumbnail.` 부터 두 번째 `await expect(home.locator('.library-page')).toBeVisible();`(`const single = …` 바로 앞)까지를 다음으로 바꾼다.

```js
  // The book detail shows the same studio cover, and its panel opens on the first chapter, which carries the thumbnail.
  await home.locator('[data-book="alice"]').click();
  await expect(home.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(home.locator('.detail-cover img')).toHaveCount(1);
  await expect.poll(() => loaded(home.locator('.detail-cover img'))).toBe(true);
  await expect(home.locator('.scene-panel .scene-image.has-image img')).toHaveCount(1);
  // In the panel a thumbnail keeps its 16:10 shape inside the 400px column.
  const thumbBox = await home.locator('.scene-panel .scene-image.has-image').evaluate(element => {
    const r = element.getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  expect(thumbBox.width).toBeLessThanOrEqual(400);
  expect(Math.abs(thumbBox.width / thumbBox.height - 1.6)).toBeLessThan(0.02);
  await expect.poll(() => loaded(home.locator('.scene-panel .scene-image img'))).toBe(true);
  await home.screenshot({ path: 'test-results/catalog/managed-book-detail.png' });
  // Another scene has no thumbnail: the slot goes back to the theme tint.
  await home.locator('.journey-row[data-scene="alice-2"]').click();
  await expect(home.locator('.scene-panel .scene-image.has-image')).toHaveCount(0);
  await expect(home.locator('.scene-panel .scene-image[data-theme="night"]')).toHaveCount(1);
  await home.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(home.locator('.library-page')).toBeVisible();
  await home.locator('a.scene-card', { has: home.locator('.scene-image.has-image') }).click();
  await expect(home.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(home.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-1');
  await expect(home.locator('.scene-panel .scene-image.has-image img')).toHaveCount(1);
  await home.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(home.locator('.library-page')).toBeVisible();
```

(G) 휴대폰 반복문에서 `await mobile.locator('[data-book="oz"]').tap();` 부터 `await expect(mobile.locator('#map-button')).toContainText('02');` 까지를 다음으로 바꾼다(`oz` 의 2장면 제목은 위에서 받아 둔 `original` 에서 읽는다).

```js
    await mobile.locator('[data-book="oz"]').tap();
    await expect(mobile.locator('.detail-page[data-view="book"]')).toBeVisible();
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
    await expect(mobile.locator('.scene-panel')).toBeHidden();
    await expect(mobile.locator('.detail-cta-scene')).toContainText('01');
    // The pinned bar must be reachable without scrolling and span the full width at every one-column size.
    const measure = () => mobile.locator('.detail-cta .primary-button').evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(x, y)) };
    });
    const cta = await measure();
    expect(cta.visible).toBe(true);
    expect(cta.reachable).toBe(true);
    const bar = await mobile.locator('.detail-cta').evaluate(element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, width: innerWidth };
    });
    expect(bar.left).toBe(0);
    expect(bar.right).toBe(bar.width);
    // A journey row opens the scene sheet with the same panel content and moves the bar to that scene.
    const ozSecond = original.books.find(b => b.id === 'oz').chapters[1].title;
    await mobile.locator('.journey-row[data-scene="oz-2"]').tap();
    await expect(mobile.locator('dialog.scene-sheet[open] #sheet-scene-title')).toHaveText(ozSecond);
    await expect(mobile.locator('.detail-cta-scene')).toContainText('02');
    await expect(mobile).toHaveURL(/scene=oz-2$/);
    await mobile.locator('dialog.scene-sheet .close-modal').tap();
    await expect(mobile.locator('dialog.scene-sheet')).toHaveCount(0);
    await expect(mobile.locator('.journey-row[data-scene="oz-2"]')).toBeFocused();
    const after = await measure();
    expect(after.reachable).toBe(true);
    await mobile.touchscreen.tap(after.x, after.y);
    await expect(mobile.locator('#world canvas')).toBeVisible();
    await expect(mobile).toHaveURL(/chapter=oz-2/);
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
    const target = await mobile.locator('#next-chapter').evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(x, y)) };
    });
    expect(target.visible).toBe(true);
    expect(target.reachable).toBe(true);
    await mobile.touchscreen.tap(target.x, target.y);
    await expect(mobile.locator('#map-button')).toContainText('03');
```

바꾼 뒤 파일에 `data-view="scene"`, `.detail-cta .primary-button')).click()`, `.detail-hero--scene`, `neighbor-all` 이 남아 있지 않은지 `grep -n` 으로 확인한다. `pass(` 는 18곳이어야 한다(A 가 한 곳 늘었다).

- [ ] **Step 6: 브라우저 검사와 단위 검사**

Run: `npm run build && node tests/catalog.mjs`
Expected: 18줄 PASS, 종료 코드 0. 처음 실패하면 원인을 마크업·CSS 와 대조한다. 자주 있는 원인: `toBeFocused()` 가 앵커 클릭 뒤 초점을 기대하는데 브라우저가 초점을 주지 않는 경우(Chromium 은 마우스 클릭한 링크에 초점을 준다), 시트를 닫은 뒤 초점이 행으로 돌아오는 `modal()` 의 `previous?.focus()`.

Run: `node tests/mobile-entry.mjs`
Expected: 4줄 PASS(바꾸지 않은 파일. 850px 이하에서 `.detail-cta .primary-button` 이 그대로 있으므로 통과해야 한다).

Run: `node tests/home-admin.mjs`
Expected: 8줄 PASS(바꾸지 않은 파일).

Run: `npm test`
Expected: 55 통과.

- [ ] **Step 7: 커밋**

```bash
git add client/main.js client/transitions.js client/detail.css tests/catalog.mjs
git commit -F - <<'EOF'
Fold the scene detail into a sticky panel on the book detail

The reader now has three views: home, book and world. The book detail
lays out a scrolling column beside a sticky scene panel; choosing a
journey row or a neighbour link swaps the panel without a curtain and
records the scene in the address without a history entry. On phones
the panel becomes a bottom sheet and a pinned bar enters the selected
scene. The catalog check follows the new flow.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: 문서·관리자 도움말·스펙 동기화·미리보기·스크린샷·최종 회귀

**Files:**
- Modify: `README.md:29,31,33,34,47`, `docs/ADMIN-GUIDE.md:27`, `admin/main.js:399`(도움말 문구), `docs/superpowers/specs/2026-09-11-react-next-migration-design.md:216`, `docs/superpowers/specs/2026-09-28-detail-pages-design.md`(id 이름 4곳), `tests/capture.mjs`
- Regenerate: `docs/preview/detail.png`, `docs/preview/explore.png`, `docs/screenshots/detail-book-desktop.png`, `detail-book-mobile.png`, `detail-scene-desktop.png`, `detail-scene-mobile.png`
- Test: `npm test`, `npm run build`, `node tests/catalog.mjs`, `node tests/mobile-entry.mjs`, `node tests/home-admin.mjs`, `npm run test:about`

**Interfaces:**
- Consumes: Task 2 의 DOM 계약(`aside.scene-panel`, `.scene-panel .detail-enter`, `dialog.scene-sheet`, `.journey-row[data-scene]`).
- Produces: 문서와 증거 파일뿐.

- [ ] **Step 1: README 다섯 문장**

Grep 으로 각 문장을 찾아 바꾼다. 문체는 "~합니다".

- 29행: `그곳의 '이야기 속으로 들어가기' 버튼으로 3D 공간에 들어갑니다.` → `오른쪽 장면 패널의 '이 장면부터 걷기' 버튼으로 3D 공간에 들어갑니다.`
- 31행: `장면 썸네일은 장면 목록과 장면 상세에 표시됩니다.` → `장면 썸네일은 장면 목록과 작품 상세의 장면 패널에 표시됩니다.`
- 33행: `장면을 누르면 첫 문단과 그 장면의 모델을 미리 보여 주는 장면 상세 페이지가 열립니다. '이 장면부터 걷기' 버튼으로 그 장면의 3D 공간에 들어갑니다.` → `장면을 누르면 그 장면이 선택된 작품 상세가 열리고, 장면 패널이 첫 문단과 그 장면의 모델을 미리 보여 줍니다. '이 장면부터 걷기' 버튼으로 그 장면의 3D 공간에 들어갑니다.`
- 34행: `작품 상세 페이지에서 원작 정보와 장면 목록을 확인하고, 3D 공간 안에서는` → `작품 상세 페이지에서 원작 정보와 장면 목록을 확인하고 오른쪽 패널(휴대폰에서는 아래에서 올라오는 시트)에서 장면을 고른 뒤 '이 장면부터 걷기'로 3D 공간에 들어가며, 3D 공간 안에서는`; 같은 행의 `` `?book=<책>&scene=<장면>`은 장면 상세 `` → `` `?book=<책>&scene=<장면>`은 그 장면이 선택된 작품 상세 ``
- 47행: `'이야기 속으로 들어가기'를 누른 뒤` → `'이 장면부터 걷기'를 누른 뒤`

- [ ] **Step 2: 관리자 안내서와 스튜디오 도움말**

`docs/ADMIN-GUIDE.md` 27행: `장면 상세 페이지에서도 썸네일은 16:10 비율 그대로 보입니다.` → `작품 상세의 장면 패널에서도 썸네일은 16:10 비율 그대로 보입니다.`

`admin/main.js` 399행의 `imageField("chapter-thumbnail", …)` 도움말: `"사용자 화면의 장면 목록에 16:10 비율로 보여요(예: 1280×800). 없으면 빈 자리로 둡니다."` → `"사용자 화면의 장면 목록과 작품 상세의 장면 패널에 16:10 비율로 보여요(예: 1280×800). 없으면 빈 자리로 둡니다."`

- [ ] **Step 3: 전환 스펙 10절과 상세 스펙의 id 이름**

`docs/superpowers/specs/2026-09-11-react-next-migration-design.md` 216행에서 `화면 상태는 넷이다: ` 로 시작하는 문장을 다음으로 바꾼다(그 뒤의 "상세 페이지의 구성…" 문장은 그대로 둔다).

```
화면 상태는 셋이다: `/`(책장 홈), `?book=<id>`(작품 상세. `&scene=<chapterId>` 는 오른쪽 장면 패널의 선택이며 히스토리 항목을 만들지 않는다), `?book=<id>&chapter=<chapterId>`(3D 월드).
```

`docs/superpowers/specs/2026-09-28-detail-pages-design.md` 에서 다음을 모두 치환한다(Grep 으로 개수를 확인한다).

- `scene-panel-title` → `panel-scene-title`
- `#detail-figures` → `#panel-figures`
- `#detail-preview` → `#panel-preview`
- `h2#scene-panel-title` 처럼 이미 앞 항목으로 바뀐 것은 그대로 둔다.
- 14.4절의 `.scene-panel .primary-button` 은 `.scene-panel .detail-enter` 로.

- [ ] **Step 4: `tests/capture.mjs`**

두 줄을 고친다. 서버 주소를 환경 변수로 받고, 3D 진입은 패널의 CTA 로 한다.

```js
// The previews come from a running server: PREVIEW_URL (for a worktree's own build) or the local default.
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
```

를 `chromium.launch(...)` 줄 앞에 두고, 파일 안의 `'http://127.0.0.1:4173/client/'` 두 곳(데스크톱·휴대폰)을 `` `${base}/client/` `` 로, `'http://127.0.0.1:4173/admin/'` 한 곳을 `` `${base}/admin/` `` 로 바꾼다. `await page.locator('.detail-cta .primary-button').click();` 은 `await page.locator('.scene-panel .detail-enter').click();` 로 바꾼다.

- [ ] **Step 5: 미리보기 다시 만들기**

```bash
npm run build
```

완성본 서버를 4181 포트로 백그라운드에 띄운다: `PORT=4181 node server/index.js --production`. `curl -s http://127.0.0.1:4181/api/library` 가 JSON 을 주면:

Run: `PREVIEW_URL=http://127.0.0.1:4181 node tests/capture.mjs`
Expected: `client.png`, `detail.png`, `explore.png`, `mobile.png` 가 새로 써지고, 스튜디오 단계(`#studio-world canvas`)에서 실패한다(기존 문제, 후속 작업 등록됨). 서버를 끈다(`netstat -ano | grep ":4181 " | grep LISTENING` → `taskkill //PID <pid> //F`). `docs/preview/detail.png` 을 Read 로 열어 두 열 화면인지 본다. `git restore docs/preview/client.png docs/preview/mobile.png docs/preview/admin.png` 로 화면이 같은 셋은 되돌리고 `detail.png`·`explore.png` 만 남긴다.

- [ ] **Step 6: 스크린샷 네 장**

`test-results/two-column-shots.mjs`(커밋하지 않음):

```js
import { chromium, expect } from '@playwright/test';
import { startServer } from '../tests/helpers.js';

const server = await startServer(4338);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const settle = async page => {
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.waitForFunction(() => document.getAnimations().length === 0);
  await page.mouse.move(0, 0);
};
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await desktop.goto(`${server.url}/client/?book=alice`);
  await expect(desktop.locator('.detail-page[data-view="book"]')).toBeVisible();
  await settle(desktop);
  await desktop.screenshot({ path: 'docs/screenshots/detail-book-desktop.png', fullPage: true });
  await desktop.goto(`${server.url}/client/?book=alice&scene=alice-2`);
  await expect(desktop.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await settle(desktop);
  await desktop.screenshot({ path: 'docs/screenshots/detail-scene-desktop.png', fullPage: true });
  await desktop.close();
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(`${server.url}/client/?book=alice`);
  await expect(phone.locator('.detail-page[data-view="book"]')).toBeVisible();
  await settle(phone);
  await phone.screenshot({ path: 'docs/screenshots/detail-book-mobile.png', fullPage: true });
  await phone.locator('.journey-row[data-scene="alice-2"]').tap();
  await expect(phone.locator('dialog.scene-sheet[open] #sheet-scene-title')).toHaveText('작아지는 문, 커지는 세계');
  await phone.waitForFunction(() => document.getAnimations().length === 0);
  await phone.screenshot({ path: 'docs/screenshots/detail-scene-mobile.png' });
  await phone.close();
  console.log('Saved four detail screenshots in docs/screenshots');
} finally {
  await browser.close();
  await server.stop();
}
```

Run: `node test-results/two-column-shots.mjs`
Expected: `Saved four detail screenshots in docs/screenshots`. 네 장을 Read 로 열어 본다. 데스크톱 두 장은 두 열과 패널(두 번째는 2행 강조·패널 2장면), 휴대폰 첫 장은 한 열과 화면 아래 바, 둘째 장은 시트가 열린 화면이어야 한다. 가로 스크롤이 없어야 한다(장면 시트 화면은 뷰포트 크기라 `fullPage` 가 아니다).

- [ ] **Step 7: 최종 회귀**

Run: `npm test` → 55 통과. `npm run build` → 성공. `node tests/catalog.mjs` → 18 PASS. `node tests/mobile-entry.mjs` → 4 PASS. `node tests/home-admin.mjs` → 8 PASS. `npm run test:about` → 15/16(워크트리에서만 실패하는 기존 vite 경로 문제).

`git status --short` 에 아래 커밋 목록 밖의 파일이 있으면(`docs/screenshots/about-*.png`, `docs/browser-results.json` 등) `git restore` 로 되돌린다.

- [ ] **Step 8: 커밋**

```bash
git add README.md docs/ADMIN-GUIDE.md admin/main.js docs/superpowers/specs/2026-09-11-react-next-migration-design.md docs/superpowers/specs/2026-09-28-detail-pages-design.md tests/capture.mjs docs/preview/detail.png docs/preview/explore.png docs/screenshots/detail-book-desktop.png docs/screenshots/detail-book-mobile.png docs/screenshots/detail-scene-desktop.png docs/screenshots/detail-scene-mobile.png
git commit -F - <<'EOF'
Document the two-column book detail

README, the studio guide and hint, and the migration spec describe the
scene panel, the phone sheet and the three reader addresses; the detail
spec names the panel ids the code uses. The preview capture takes a
server address and enters the world from the panel, and the four
screenshots show the new layout.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

## 스펙 대조

| 스펙 절 | 구현 위치 |
| --- | --- |
| 3 화면 상태 셋, `sceneAddressed`, 주소 해석, 문서 제목 | Task 2 (1)(3)(4)(5)(6) |
| 4 이동 흐름(커튼 문구 하나, 장면 선택은 `replaceState`, 초점·상태 문구, 시트 닫힘) | Task 2 (8)(9), `popstate`·`enterBook` 기존 |
| 5 두 열 뼈대, sticky 패널, 850px 규칙, 등장 그룹, 초점 | Task 1 `bookDetail`, Task 2 CSS·transitions |
| 6 왼쪽 열(히어로에 버튼 없음, 여정 행 `aria-current`, 설명 문구 둘) | Task 1 `bookDetail`, Task 2 CSS |
| 7 장면 패널 순서·16:10·배지·CTA·이웃, 장면 시트, 하단 바 | Task 1 `scenePanel`·`sceneBar`, Task 2 `selectScene`·CSS |
| 8 홈(변경 없음) | — |
| 9 `main.js`·`detail.js` 정리 | Task 1, Task 2 |
| 11 문구 | Task 1 문자열, Global Constraints |
| 12 오류 처리(잘못된 id, 사라진 저장 장면, 새 탭, 시트와 폭) | Task 2 `resolveView`, Task 1 `defaultScene`, `setupDetail` |
| 13 접근성 | Task 1 마크업(`aria-current`, `role="status"`, `aria-labelledby`), Task 2 시트(`modal()`) |
| 14.1 단위 검사 15개 | Task 1 |
| 14.2 브라우저 검사 | Task 2 Step 5 |
| 14.3·14.4 | Task 2 Step 6(변경 없이 통과), Task 3 Step 4 |
| 14.5 회귀·스크린샷 | Task 3 Step 5~7 |
| 15 문서 | Task 3 Step 1~3 |
| 17 완료 기준 | Task 2 Step 6, Task 3 Step 6·7 |
| 18 차이표 | 세 Task 전체 |
