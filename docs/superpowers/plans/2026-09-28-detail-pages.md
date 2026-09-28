# 작품 상세·장면 상세 페이지 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 책장 홈의 도서·장면·추천 카드가 작품 상세 또는 장면 상세 페이지로 이동하고, 그 페이지의 CTA 로만 3D 월드에 들어가게 한다.

**Architecture:** `client/main.js` 의 `exploring` 참·거짓을 `view`(`home`·`book`·`scene`·`world`) 로 바꾸고, 주소 쿼리 `?book=`·`?book=&scene=`·`?book=&chapter=` 를 한 함수로 해석한다. 상세 마크업은 CSS·이미지 import 가 없는 순수 모듈 `client/detail.js` 가 만들어 `node --test` 로 검사하고, 화면 전환·초점·히스토리는 기존 `transitionPage` 커튼과 `popstate` 처리를 확장한다. 서버·스키마·관리자·배포 설정은 바꾸지 않는다.

**Tech Stack:** Vite 7(멀티 페이지), 바닐라 JS(ES 모듈), three 0.180(변경 없음), Express 5(변경 없음), node:test, @playwright/test(Edge 채널).

**스펙:** `docs/superpowers/specs/2026-09-28-detail-pages-design.md`

**계획 작성 중 확인해 둔 사실:**
- `server/seed.js` 의 `seed` 는 `upgrade()` 만 거치므로 `mainPlacementId`, `floorEnabled`, `cover` 가 없다. `/api/library` 는 `librarySchema.parse()` 를 거친 값을 준다(`server/storage.js`). 단위 검사는 `librarySchema.parse(seed)` 로 같은 모양을 만든다.
- `shared/ui.js` 는 Node 에서 import 된다(lucide 는 순수 모듈). `client/landing.js` 는 PNG·CSS 를 import 해서 Node 에서 열 수 없다. 그래서 `edition()`·`bookCover()` 를 `client/book-meta.js` 로 옮긴다.
- `shared/style.css` 의 전역 규칙은 `a { color: inherit; text-decoration: none }`, `a:hover { text-decoration: underline }` 이다. 카드와 여정 행이 `a` 가 되면 hover 밑줄만 막으면 된다.
- 3D 월드 테마 바닥색(`shared/world.js` `themes[*].ground`): meadow `#cad7aa`, night `#929aaf`, tea `#d7c9b6`, rose `#d8c6b7`, gold `#dcca98`.
- HTML 속성에 넣는 주소는 `esc()` 를 거쳐 `&` 가 `&amp;` 로 나간다. 단위 검사의 기대값도 `&amp;` 다. 브라우저 검사의 `toHaveURL` 은 실제 주소를 보므로 `&` 다.
- 기존 `tests/catalog.mjs` 는 Task 5 까지 그대로 통과해야 한다(홈 카드가 아직 3D 로 직행하므로). Task 6 에서 카드와 검사를 함께 바꾼다.

## Global Constraints

- 기준 스택: 현재 client 의 Vite 멀티 페이지 + 바닐라 JS + npm `three` 0.180. React, TypeScript, 새 npm 의존성을 추가하지 않는다.
- 바꾸지 않는 것: `server/**`, `shared/schema.js`, `admin/**`, `client/vercel.json`, `vite.config.js`, 3D 월드 안 "작품 소개"·"이야기의 지도" 모달의 마크업, `otb-reader` 저장 구조 `{ [bookId]: { chapter } }`.
- 표지·장면 이미지는 자리만 둔다. `book.cover`, 모델 `thumbnail` 을 표시하지 않고 `<img>` 를 만들지 않는다.
- `client/detail.js` 와 `client/book-meta.js` 는 CSS·이미지·`document` 를 쓰지 않는다. `node --test` 가 import 하기 때문이다.
- 주소 규칙: `home` `/client/`, `book` `?book=<id>`, `scene` `?book=<id>&scene=<chapterId>`, `world` `?book=<id>&chapter=<chapterId>`. `?preview=draft` 는 모든 주소에 이어 붙인다. 주소 문자열은 `detailUrl()` 한 곳에서만 만든다.
- 문구는 스펙 11절 표의 것을 그대로 쓴다. 커튼 "작품을 펼치는 중이에요…"·"장면을 펼치는 중이에요…", CTA "이야기 속으로 들어가기"·"이어 읽기"·"처음부터 시작하기"·"이 장면부터 걷기", 섹션 "이 책의 여정"·"원작 정보"·"미리 읽기"·"이 장면에서 만나는 것들"·"이어지는 장면", 배지 "마지막에 머문 장면"·"장면의 중심", 안내 "이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요.", 설명 "장면을 고르면 그 장면의 이야기를 먼저 볼 수 있어요."·"가까이 다가가면 움직여요.", 이미지 자리 "표지 이미지 준비 중"·"장면 이미지 준비 중", 링크 "작품 전체 보기"·"원작 정보 보기 ↗", 히어로 카드 "작품 살펴보기".
- 반응형 분기점은 `landing.css` 와 같은 1100, 850, 600, 370px.
- 포트: `tests/catalog.mjs` 4336, `tests/mobile-entry.mjs` 4321, 임시 확인 스크립트 4337, 스크린샷 스크립트 4338. 임시 스크립트는 gitignore 된 `test-results/` 에 두고 커밋하지 않는다.
- 브라우저 검사는 `channel: "msedge"`, `headless: true`. 명령은 저장소(워크트리) 루트에서 Git Bash 로 실행한다. `npm start` 처럼 계속 떠 있어야 하는 서버는 PowerShell 탭에서 띄운다.
- 커밋 메시지는 영어 명령형 한 줄 + 본문, 마지막 줄 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 회귀 검사가 다시 쓰는 `docs/screenshots/*.png`, `docs/floor-evidence/*.png`, `docs/browser-results.json` 은 `git restore` 로 되돌리고, 이 계획이 새로 만들거나 스펙 10절이 갱신하라고 한 파일만 커밋한다.
- 문서 문체: README 는 "~합니다", 스펙·계획은 "~다". 코드 주석은 영어, 화면 문구는 한국어(기존 관례).

---

## 파일 구조

```
client/book-meta.js   새 파일. edition(book) → { category }, bookCover() → 빈 표지 자리. 자산 import 없음
client/detail.js      새 파일. detailUrl(), bookDetail(), sceneDetail(). 순수 마크업 함수
client/detail.css     새 파일. 상세 페이지 스타일. main.js 가 import
client/landing.js     수정. edition·bookCover 를 book-meta 에서 가져옴. 카드 → a 링크, onOpen, 히어로 문구
client/landing.css    수정. a 카드의 hover 밑줄 제거
client/main.js        수정. view 상태, resolveView/applyResolved/currentUrl, render 4갈래, openDetail, setupDetail, header·title
client/transitions.js 수정. .detail-page 등장 그룹, 기본 초점 대상에 #detail-title
client/index.html     수정. 설명 메타 문구
tests/detail.test.js  새 파일. book-meta·detail 순수 함수 단위 검사(npm test 에 자동 포함)
tests/catalog.mjs     수정. 카드 → 상세 → CTA → 월드, 히스토리, 장면 상세, 히어로 카드
tests/mobile-entry.mjs 수정. 표지 탭 → 상세 → 고정 CTA 탭 → 월드
tests/capture.mjs     수정. [data-book], docs/preview/detail.png
docs/preview/detail.png            새 파일. client.png·explore.png·mobile.png 는 다시 만든다
docs/screenshots/detail-book-desktop.png, detail-book-mobile.png,
                 detail-scene-desktop.png, detail-scene-mobile.png   새 파일
README.md             수정. 첫 화면·장면 목록·작품 소개·확인 순서 문장
docs/superpowers/specs/2026-09-11-react-next-migration-design.md   수정. 10절 주소 규칙
```

한 파일의 책임
- `book-meta.js`: 도서 파생 정보만. `landing.js`, `detail.js`, `main.js` 가 쓴다.
- `detail.js`: 데이터 → HTML 문자열. 이벤트를 달지 않는다. 이벤트는 `main.js` 의 `setupDetail()`.
- `main.js`: 상태·주소·전환·이벤트 연결. 마크업은 `landing.js`·`detail.js` 가 만든다.

---

### Task 1: `edition()`·`bookCover()` 를 `client/book-meta.js` 로 옮기기

**Files:**
- Create: `client/book-meta.js`
- Modify: `client/landing.js:23-30` (두 함수 정의 삭제, import 추가), `client/main.js:6` (import 경로)
- Test: `tests/detail.test.js`

**Interfaces:**
- Produces: `edition(book) → { category: string }`, `bookCover() → string`(HTML). 이후 모든 Task 가 `../client/book-meta.js` 에서 가져온다.

- [ ] **Step 1: 실패하는 단위 검사 작성**

`tests/detail.test.js` 를 새로 만든다.

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/detail.test.js`
Expected: 실패. `Cannot find module '.../client/book-meta.js'` (ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: `client/book-meta.js` 작성**

```js
// Book metadata that both the bookshelf and the detail pages derive from library data.
// Keep this file free of CSS and image imports so `node --test` can load it.
export function edition(book) {
  return { category: ({ alice: "판타지", oz: "모험" })[book.id] || "문학" };
}

// Image slots are deliberately empty, including when a cover exists in the library.
export function bookCover() {
  return '<span class="catalog-cover image-placeholder" role="img" aria-label="표지 이미지 준비 중"></span>';
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/detail.test.js`
Expected: `# pass 2`, `# fail 0`.

- [ ] **Step 5: `client/landing.js` 에서 정의를 지우고 import 로 바꾸기**

`client/landing.js` 첫 부분의 import 목록에 한 줄을 더한다.

```js
import { esc, icon, icons } from "../shared/ui.js";
import { edition, bookCover } from "./book-meta.js";
import openBookClay from "./assets/quick-menu/open-book-clay.png";
```

그리고 23~30행의 다음 블록을 삭제한다.

```js
export function edition(book) {
  return { category: ({ alice: "판타지", oz: "모험" })[book.id] || "문학" };
}

// Image slots are deliberately empty, including when a cover exists in the library.
export function bookCover() {
  return '<span class="catalog-cover image-placeholder" role="img" aria-label="표지 이미지 준비 중"></span>';
}
```

`landing.js` 안에서 `edition(book)`, `bookCover()` 를 쓰는 `bookCard()`, `feature()`, `landing()`, `setupCatalog()` 는 그대로 동작한다.

- [ ] **Step 6: `client/main.js` 의 import 바꾸기**

6행

```js
import { announcementBanner, landing, setupCatalog, bookCover, edition } from "./landing.js";
```

을 두 줄로 바꾼다.

```js
import { announcementBanner, landing, setupCatalog } from "./landing.js";
import { bookCover, edition } from "./book-meta.js";
```

- [ ] **Step 7: 빌드와 기존 검사로 확인**

Run: `npm run build && npm test`
Expected: 빌드 성공(`dist/client/index.html`, `dist/about/…`, `dist/admin/index.html` 생성). `npm test` 에 `tests/detail.test.js` 의 2개가 포함되어 모두 통과. 기존 실패 항목이 없어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add client/book-meta.js client/landing.js client/main.js tests/detail.test.js
git commit -F - <<'EOF'
Move book metadata helpers into client/book-meta.js

edition() and bookCover() are needed by the upcoming detail pages and
by their node tests. landing.js imports PNG and CSS files, so the two
helpers move to a module without asset imports.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 2: `detailUrl()` — 주소 생성 한 곳

**Files:**
- Create: `client/detail.js`
- Test: `tests/detail.test.js`

**Interfaces:**
- Produces: `detailUrl({ book, scene, chapter, preview = false }) → string`. `"?book=alice"`, `"?book=alice&scene=alice-2"`, `"?book=alice&chapter=alice-1"`, preview 면 `"&preview=draft"` 를 끝에 붙인다. `chapter` 가 있으면 `scene` 은 무시한다. 반환값은 `?` 로 시작하고 경로는 포함하지 않는다. Task 3~5 가 쓴다.

- [ ] **Step 1: 실패하는 단위 검사 추가**

`tests/detail.test.js` 의 import 아래에 한 줄을 더하고 파일 끝에 검사를 붙인다.

```js
import { detailUrl } from "../client/detail.js";
```

```js
test("detailUrl builds the three reader addresses and keeps the draft preview flag", () => {
  assert.equal(detailUrl({ book: "alice" }), "?book=alice");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2" }), "?book=alice&scene=alice-2");
  assert.equal(detailUrl({ book: "alice", chapter: "alice-1" }), "?book=alice&chapter=alice-1");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2", chapter: "alice-1" }), "?book=alice&chapter=alice-1");
  assert.equal(detailUrl({ book: "alice", scene: "alice-2", preview: true }), "?book=alice&scene=alice-2&preview=draft");
  assert.equal(detailUrl({ book: "alice", preview: false }), "?book=alice");
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/detail.test.js`
Expected: 실패. `Cannot find module '.../client/detail.js'`.

- [ ] **Step 3: `client/detail.js` 작성**

```js
// Markup for the book and scene detail pages, built from library data.
// No CSS or image imports here: `node --test` loads this file. main.js imports detail.css.
import { esc, icon } from "../shared/ui.js";
import { edition, bookCover } from "./book-meta.js";

// The only place that spells reader addresses. `?book=` is the book detail, `&scene=` the scene
// detail and `&chapter=` the 3D world. The draft preview flag rides along on every address.
export function detailUrl({ book, scene, chapter, preview = false }) {
  const params = new URLSearchParams({ book });
  if (chapter) params.set("chapter", chapter);
  else if (scene) params.set("scene", scene);
  if (preview) params.set("preview", "draft");
  return `?${params}`;
}
```

`esc`, `icon`, `edition`, `bookCover` 는 Task 3 부터 쓴다. 지금은 import 만 둔다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/detail.test.js`
Expected: `# pass 3`, `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add client/detail.js tests/detail.test.js
git commit -F - <<'EOF'
Add detailUrl for the reader's query addresses

One function spells ?book=, ?book=&scene= and ?book=&chapter= and
carries the draft preview flag, so no page can drop it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 3: `bookDetail()` — 작품 상세 마크업

**Files:**
- Modify: `client/detail.js`
- Test: `tests/detail.test.js`

**Interfaces:**
- Consumes: `detailUrl()`(Task 2), `edition()`·`bookCover()`(Task 1), `esc()`·`icon()`(`shared/ui.js`).
- Produces: `bookDetail({ book, progress = {}, preview = false }) → string`. 반환 HTML 의 뼈대: `main.detail-page.store-content#main-content[data-view="book"]` > `section.detail-hero` + `div.detail-cta` + `section.detail-section#detail-journey` + `section.detail-source`. CTA 는 `button.primary-button.detail-enter[data-enter=<bookId>]`, 재시작은 `button.text-button.detail-restart[data-enter][data-enter-chapter]`, 장면 행은 `a.journey-row[data-scene-book][data-scene-chapter]`. Task 5 의 `setupDetail()` 이 이 속성에 이벤트를 단다.

- [ ] **Step 1: 실패하는 단위 검사 추가**

`tests/detail.test.js` 의 import 를 아래처럼 바꾸고(`detailUrl` 옆에 `bookDetail`), 시드 준비 코드를 import 아래에, 검사를 파일 끝에 붙인다.

```js
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
import { detailUrl, bookDetail } from "../client/detail.js";

// /api/library serves the seed after schema parsing, which fills mainPlacementId, floorEnabled and cover.
const library = librarySchema.parse(seed);
const alice = library.books.find(b => b.id === "alice");
const count = (html, needle) => html.split(needle).length - 1;
```

```js
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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/detail.test.js`
Expected: 새 검사 5개 실패. `does not provide an export named 'bookDetail'`(파일 전체가 SyntaxError 로 실패해도 된다. 새 export 가 없다는 뜻이다).

- [ ] **Step 3: `client/detail.js` 에 도우미와 `bookDetail()` 추가**

`detailUrl()` 아래에 붙인다.

```js
const two = n => String(n).padStart(2, "0");

// The chapter's main placement, falling back to the first one. Null when the chapter has no placements.
const mainPlacement = chapter =>
  chapter.placements.find(p => p.id === chapter.mainPlacementId) || chapter.placements[0] || null;

// The chapter the reader last stood in, or null when the record is missing or points at a removed chapter.
const savedChapter = (book, progress) =>
  book.chapters.find(c => c.id === progress?.[book.id]?.chapter) || null;

const themeChip = theme => `<span class="theme-chip" data-theme="${esc(theme)}" aria-hidden="true"></span>`;

const sectionHeading = (id, title, description) =>
  `<div class="section-heading"><div><h2 id="${id}">${title}</h2>${description ? `<p>${description}</p>` : ""}</div></div>`;

const sourceNote = book =>
  `<section class="detail-source" aria-labelledby="detail-source-title"><h2 id="detail-source-title">원작 정보</h2><p class="source-note">${esc(book.rights)}<br><a href="${esc(book.source)}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a></p></section>`;

// The 3D entry button. Without a chapter, main.js resumes the saved chapter or starts at the first one.
const enterButton = (book, chapter, label) =>
  `<button class="primary-button detail-enter" data-enter="${esc(book.id)}"${chapter ? ` data-enter-chapter="${esc(chapter.id)}"` : ""}>${label} ${icon("arrow-up-right")}</button>`;

export function bookDetail({ book, progress = {}, preview = false }) {
  const saved = savedChapter(book, progress);
  const cta = saved
    ? `${enterButton(book, null, `<span class="detail-enter-copy"><strong>이어 읽기</strong><small>${two(book.chapters.indexOf(saved) + 1)} · ${esc(saved.title)}</small></span>`)}<button class="text-button detail-restart" data-enter="${esc(book.id)}" data-enter-chapter="${esc(book.chapters[0].id)}">처음부터 시작하기</button>`
    : enterButton(book, null, "이야기 속으로 들어가기");
  const rows = book.chapters.map((chapter, index) => {
    const main = mainPlacement(chapter);
    return `<li><a class="journey-row" href="${esc(detailUrl({ book: book.id, scene: chapter.id, preview }))}" data-scene-book="${esc(book.id)}" data-scene-chapter="${esc(chapter.id)}">${themeChip(chapter.theme)}<span class="journey-number">${two(index + 1)}</span><span class="journey-copy"><strong>${esc(chapter.title)}</strong>${chapter.subtitle ? `<small>${esc(chapter.subtitle)}</small>` : ""}</span>${main ? `<span class="journey-model">· ${esc(main.title)}</span>` : ""}${chapter === saved ? '<span class="journey-badge">마지막에 머문 장면</span>' : ""}${icon("chevron-right")}</a></li>`;
  }).join("");
  return `<main class="detail-page store-content" id="main-content" data-view="book">
    <section class="detail-hero" aria-labelledby="detail-title"><span class="detail-cover">${bookCover()}</span><div class="detail-copy"><span class="eyebrow">${esc(edition(book).category)} · ${book.chapters.length}개의 장면 · ${book.year}</span><h1 id="detail-title" tabindex="-1">${esc(book.title)}</h1><p class="detail-meta">${esc(book.englishTitle)} · ${esc(book.author)}</p><p class="detail-description">${esc(book.description)}</p></div></section>
    <div class="detail-cta">${cta}</div>
    <section class="detail-section" id="detail-journey" aria-labelledby="detail-journey-title">${sectionHeading("detail-journey-title", "이 책의 여정", "장면을 고르면 그 장면의 이야기를 먼저 볼 수 있어요.")}<ol class="journey-list">${rows}</ol></section>
    ${sourceNote(book)}
  </main>`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/detail.test.js`
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: 커밋**

```bash
git add client/detail.js tests/detail.test.js
git commit -F - <<'EOF'
Add the book detail markup

bookDetail() renders the hero with an empty cover slot, the entry CTA
that resumes a saved chapter, the chapter journey with theme chips and
main models, and the source note.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 4: `sceneDetail()` — 장면 상세 마크업

**Files:**
- Modify: `client/detail.js`
- Test: `tests/detail.test.js`

**Interfaces:**
- Consumes: Task 3 의 `two`, `mainPlacement`, `sectionHeading`, `sourceNote`, `enterButton`, `detailUrl`.
- Produces: `sceneDetail({ book, chapter, library, preview = false }) → string`. 뼈대: `main.detail-page.store-content#main-content[data-view="scene"]` > `nav.detail-crumbs` + `section.detail-hero.detail-hero--scene` + `div.detail-cta` + (`section#detail-preview`) + (`section#detail-figures`) + `section#detail-neighbors` + `section.detail-source`. 이웃 장면과 브레드크럼 링크는 `a[data-scene-book][data-scene-chapter]`, `a[data-book]` 이다. 장면은 `chapter.id` 로 찾으므로 복사한 객체를 넘겨도 된다.

- [ ] **Step 1: 실패하는 단위 검사 추가**

import 행을 바꾸고

```js
import { detailUrl, bookDetail, sceneDetail } from "../client/detail.js";
```

파일 끝에 붙인다.

```js
test("sceneDetail shows the scene, the first paragraph only and the placements with the main one first", () => {
  const html = sceneDetail({ book: alice, chapter: alice.chapters[1], library });
  assert.match(html, /<main class="detail-page store-content" id="main-content" data-view="scene">/);
  assert.match(html, /<nav class="detail-crumbs" aria-label="현재 위치"><a href="\?book=alice" data-book="alice">이상한 나라의 앨리스<\/a><span aria-hidden="true">›<\/span><span aria-current="page">장면 02<\/span><\/nav>/);
  assert.match(html, /<span class="scene-image image-placeholder" data-theme="night" role="img" aria-label="장면 이미지 준비 중"><span class="scene-number">02<\/span><\/span>/);
  assert.match(html, /<span class="eyebrow">장면 02 \/ 06 · 이상한 나라의 앨리스<\/span>/);
  assert.match(html, /<h1 id="detail-title" tabindex="-1">작아지는 문, 커지는 세계<\/h1><p class="detail-meta">작은 열쇠가 열어 준 커다란 호기심<\/p>/);
  assert.match(html, /class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-2">이 장면부터 걷기/);
  assert.match(html, /<h2 id="detail-preview-title">미리 읽기<\/h2>/);
  assert.match(html, /<div class="reading-text"><p>굴 아래에는 문이 가득한 긴 복도가 있었습니다\./);
  assert.doesNotMatch(html, /작은 병과 케이크를 만난 앨리스/);
  assert.match(html, /<p class="muted detail-note">이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요\.<\/p>/);
  assert.match(html, /<h2 id="detail-figures-title">이 장면에서 만나는 것들<\/h2><p>가까이 다가가면 움직여요\.<\/p>/);
  assert.equal(count(html, 'class="figure-chip"'), 3);
  assert.match(html, /<strong>정원으로 가는 열쇠<\/strong><span class="journey-badge">장면의 중심<\/span><span class="figure-story">아주 작은 문 너머에 햇살 가득한 정원이 기다립니다\.<\/span>/);
  assert.equal(count(html, "장면의 중심"), 1);
  assert.match(html, /class="figure-chip" style="background:#d4aa56"/);
  assert.equal(count(html, 'class="neighbor-link"'), 2);
  assert.match(html, /href="\?book=alice&amp;scene=alice-1" data-scene-book="alice" data-scene-chapter="alice-1"><i data-lucide="arrow-left" aria-hidden="true"><\/i> 01 흰 토끼를 따라서<\/a>/);
  assert.match(html, /href="\?book=alice&amp;scene=alice-3" data-scene-book="alice" data-scene-chapter="alice-3">03 버섯 숲의 수수께끼 <i data-lucide="arrow-right" aria-hidden="true"><\/i><\/a>/);
  assert.match(html, /<a class="neighbor-all" href="\?book=alice" data-book="alice">작품 전체 보기<\/a>/);
  assert.match(html, /<h2 id="detail-source-title">원작 정보<\/h2>/);
  assert.doesNotMatch(html, /<img/);
});

test("sceneDetail drops the missing neighbour and the floor-reading note when the floor is off", () => {
  const first = sceneDetail({ book: alice, chapter: alice.chapters[0], library });
  assert.equal(count(first, 'class="neighbor-link"'), 1);
  assert.match(first, /data-scene-chapter="alice-2">02 작아지는 문, 커지는 세계/);
  assert.match(first, /장면 01 \/ 06/);
  const last = sceneDetail({ book: alice, chapter: alice.chapters[5], library });
  assert.equal(count(last, 'class="neighbor-link"'), 1);
  assert.match(last, /data-scene-chapter="alice-5"/);
  const silent = sceneDetail({ book: alice, chapter: { ...alice.chapters[1], floorEnabled: false }, library });
  assert.match(silent, /굴 아래에는 문이 가득한/);
  assert.doesNotMatch(silent, /바닥 글귀로 읽을 수 있어요/);
  assert.match(silent, /장면 02 \/ 06/);
});

test("sceneDetail omits the sections that have nothing to show and escapes the placement colour", () => {
  const bare = { ...alice.chapters[2], body: "", placements: [], mainPlacementId: null };
  const html = sceneDetail({ book: alice, chapter: bare, library });
  assert.doesNotMatch(html, /id="detail-preview"/);
  assert.doesNotMatch(html, /id="detail-figures"/);
  assert.match(html, /id="detail-neighbors"/);
  assert.match(html, /data-scene-chapter="alice-2"/);
  assert.match(html, /data-scene-chapter="alice-4"/);
  const single = sceneDetail({ book: alice, chapter: { ...alice.chapters[2], body: "한 문단만 있어요." }, library });
  assert.match(single, /<div class="reading-text"><p>한 문단만 있어요\.<\/p><\/div>/);
  assert.doesNotMatch(single, /바닥 글귀로 읽을 수 있어요/);
  const unknownModel = sceneDetail({ book: alice, chapter: { ...alice.chapters[2], placements: [{ ...alice.chapters[2].placements[0], modelId: "missing\">" }] }, library });
  assert.match(unknownModel, /style="background:var\(--accent\)"/);
  assert.doesNotMatch(unknownModel, /missing">/);
});

test("sceneDetail keeps the draft preview flag on every link", () => {
  const html = sceneDetail({ book: alice, chapter: alice.chapters[1], library, preview: true });
  assert.equal(count(html, "&amp;preview=draft"), 4);
  assert.match(html, /href="\?book=alice&amp;preview=draft" data-book="alice">이상한 나라의 앨리스/);
});
```

`&amp;preview=draft` 4개는 브레드크럼, 이전 장면, 작품 전체 보기, 다음 장면이다.

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/detail.test.js`
Expected: 실패. `does not provide an export named 'sceneDetail'`.

- [ ] **Step 3: `client/detail.js` 에 `sceneDetail()` 추가**

`bookDetail()` 아래에 붙인다.

```js
export function sceneDetail({ book, chapter, library, preview = false }) {
  const index = book.chapters.findIndex(c => c.id === chapter.id);
  const previous = book.chapters[index - 1], next = book.chapters[index + 1];
  const paragraphs = chapter.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const main = mainPlacement(chapter);
  const figures = main ? [main, ...chapter.placements.filter(p => p !== main)] : [];
  const colorOf = placement => library.models.find(m => m.id === placement.modelId)?.color || "var(--accent)";
  const bookHref = `href="${esc(detailUrl({ book: book.id, preview }))}" data-book="${esc(book.id)}"`;
  const sceneLink = (target, label) =>
    `<a class="neighbor-link" href="${esc(detailUrl({ book: book.id, scene: target.id, preview }))}" data-scene-book="${esc(book.id)}" data-scene-chapter="${esc(target.id)}">${label}</a>`;
  // Only the first paragraph is shown here; the rest waits on the floor inside the 3D world.
  const previewSection = paragraphs.length
    ? `<section class="detail-section" id="detail-preview" aria-labelledby="detail-preview-title">${sectionHeading("detail-preview-title", "미리 읽기")}<div class="reading-text"><p>${esc(paragraphs[0])}</p></div>${paragraphs.length > 1 && chapter.floorEnabled !== false ? '<p class="muted detail-note">이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요.</p>' : ""}</section>`
    : "";
  const figureSection = figures.length
    ? `<section class="detail-section" id="detail-figures" aria-labelledby="detail-figures-title">${sectionHeading("detail-figures-title", "이 장면에서 만나는 것들", "가까이 다가가면 움직여요.")}<ul class="figure-list">${figures.map(p => `<li><span class="figure-chip" style="background:${esc(colorOf(p))}" aria-hidden="true"></span><span class="figure-copy"><strong>${esc(p.title)}</strong>${p === main ? '<span class="journey-badge">장면의 중심</span>' : ""}${p.story ? `<span class="figure-story">${esc(p.story)}</span>` : ""}</span></li>`).join("")}</ul></section>`
    : "";
  return `<main class="detail-page store-content" id="main-content" data-view="scene">
    <nav class="detail-crumbs" aria-label="현재 위치"><a ${bookHref}>${esc(book.title)}</a><span aria-hidden="true">›</span><span aria-current="page">장면 ${two(index + 1)}</span></nav>
    <section class="detail-hero detail-hero--scene" aria-labelledby="detail-title"><span class="scene-image image-placeholder" data-theme="${esc(chapter.theme)}" role="img" aria-label="장면 이미지 준비 중"><span class="scene-number">${two(index + 1)}</span></span><div class="detail-copy"><span class="eyebrow">장면 ${two(index + 1)} / ${two(book.chapters.length)} · ${esc(book.title)}</span><h1 id="detail-title" tabindex="-1">${esc(chapter.title)}</h1>${chapter.subtitle ? `<p class="detail-meta">${esc(chapter.subtitle)}</p>` : ""}</div></section>
    <div class="detail-cta">${enterButton(book, chapter, "이 장면부터 걷기")}</div>
    ${previewSection}
    ${figureSection}
    <section class="detail-section" id="detail-neighbors"><nav class="neighbor-nav" aria-label="이어지는 장면">${previous ? sceneLink(previous, `${icon("arrow-left")} ${two(index)} ${esc(previous.title)}`) : "<span></span>"}<a class="neighbor-all" ${bookHref}>작품 전체 보기</a>${next ? sceneLink(next, `${two(index + 2)} ${esc(next.title)} ${icon("arrow-right")}`) : "<span></span>"}</nav></section>
    ${sourceNote(book)}
  </main>`;
}
```

`two(index)` 는 이전 장면 번호(현재 `index + 1` 의 앞), `two(index + 2)` 는 다음 장면 번호다. 빈 `<span></span>` 은 이웃이 없을 때 3열 격자의 자리를 지킨다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/detail.test.js`
Expected: `# pass 12`, `# fail 0`. 실패하면 기대 문자열의 속성 순서(`class` → `href` → `data-*`)와 아이콘 마크업 `<i data-lucide="…" aria-hidden="true"></i>` 를 검사와 맞춘다.

- [ ] **Step 5: 전체 단위 검사와 커밋**

Run: `npm test`
Expected: 모두 통과.

```bash
git add client/detail.js tests/detail.test.js
git commit -F - <<'EOF'
Add the scene detail markup

sceneDetail() renders the breadcrumb, a theme-tinted empty scene slot,
the entry CTA for that chapter, the first paragraph as a preview, the
placements with the main one first, and links to the neighbouring
scenes.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 5: `main.js` 를 네 화면 상태로 바꾸고 상세 페이지를 주소로 열기

이 Task 가 끝나면 `?book=alice`, `?book=alice&scene=alice-2` 가 상세 페이지를 열고 CTA 로 3D 월드에 들어간다. 홈 카드는 아직 3D 로 직행한다(Task 6). 그래서 기존 `tests/catalog.mjs` 가 그대로 통과해야 한다.

**Files:**
- Create: `client/detail.css`
- Modify: `client/main.js`(전체 교체), `client/transitions.js:36-40`(등장 그룹), `client/transitions.js:76-77`(기본 초점)
- Test: 기존 `tests/catalog.mjs`, 임시 `test-results/detail-smoke.mjs`

**Interfaces:**
- Consumes: `bookDetail()`, `sceneDetail()`, `detailUrl()`(Task 2~4), `edition()`·`bookCover()`(Task 1), `setupCatalog({ onEnter, onOpen, … })`(onOpen 은 Task 6 에서 landing.js 가 부르기 시작한다).
- Produces: `main.js` 내부 함수 `openDetail(target, bookId, sceneId)`(`target` 은 `"book"`|`"scene"`), `setupDetail() → dispose`, `resolveView(params)`, `applyResolved(state)`, `currentUrl()`. Task 6 의 `landing.js` 는 `onOpen("book", id)` / `onOpen("scene", bookId, chapterId)` 로 `openDetail` 을 부른다.

- [ ] **Step 1: `client/transitions.js` 등장 그룹과 기본 초점 대상 넓히기**

36~38행

```js
  const groups = app.querySelector(".library-page")
    ? [".site-header", ".featured-section", ".quick-menu", ".catalog", ".scene-section, .experience-banner", ".site-footer"]
    : [".site-header", ".journey-controls", ".touch-pad, .move-hint", ".site-footer"];
```

을 다음으로 바꾼다.

```js
  const groups = app.querySelector(".library-page")
    ? [".site-header", ".featured-section", ".quick-menu", ".catalog", ".scene-section, .experience-banner", ".site-footer"]
    : app.querySelector(".detail-page")
      ? [".site-header", ".detail-crumbs, .detail-hero", ".detail-cta", ".detail-section, .detail-source", ".site-footer"]
      : [".site-header", ".journey-controls", ".touch-pad, .move-hint", ".site-footer"];
```

`transitionPage()` 끝부분의

```js
    const target = focus ? app.querySelector(focus)
      : app.querySelector("#library-title") || app.querySelector("#world canvas, #fallback-read");
```

을 다음으로 바꾼다.

```js
    const target = focus ? app.querySelector(focus)
      : app.querySelector("#library-title") || app.querySelector("#detail-title") || app.querySelector("#world canvas, #fallback-read");
```

- [ ] **Step 2: `client/detail.css` 작성**

```css
/* Book and scene detail pages. They share the bookshelf's type, gutters (.store-content) and section headings. */
.detail-page { display: flex; flex-direction: column; }
.detail-page h1, .detail-page h2 { font-family: inherit; letter-spacing: -.05em; font-weight: 650; }
.detail-crumbs { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 22px; font-size: 13px; color: #76837b; }
.detail-crumbs a { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 550; color: #4f5f56; }
.detail-crumbs a:hover { color: var(--accent); text-decoration: none; }
.detail-crumbs [aria-current] { white-space: nowrap; }
.detail-hero { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 30px; align-items: center; margin-top: 12px; }
.detail-cover { display: block; width: 180px; }
.detail-copy { min-width: 0; }
.detail-copy .eyebrow { margin-bottom: 14px; font-size: 12px; letter-spacing: .08em; color: #75867a; }
.detail-copy h1 { margin: 0 0 12px; font-size: 40px; line-height: 1.2; word-break: keep-all; outline: none; }
.detail-meta { margin: 0 0 12px; font-size: 15px; color: #6b7567; }
.detail-description { max-width: 560px; margin: 0; font-size: 17px; line-height: 1.7; color: #3f4a44; word-break: keep-all; }
/* One CTA block per page. On desktop it sits under the hero copy; the book page indents it past the cover column. */
.detail-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin: 26px 0 0 210px; }
.detail-page[data-view="scene"] .detail-cta { margin-left: 0; }
.detail-enter { gap: 14px; padding: 14px 22px; font-size: 14px; font-weight: 600; }
.detail-enter svg { width: 17px; height: 17px; }
.detail-enter-copy { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; }
.detail-enter-copy small { font-size: 12px; font-weight: 500; opacity: .85; }
.detail-restart { font-size: 13px; color: #5e6c63; }
.detail-section { padding-top: 40px; margin-top: 36px; border-top: 1px solid #edf0ec; }
.detail-section .section-heading { margin-bottom: 18px; }
.journey-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid #e7ebe7; }
.journey-row { display: flex; align-items: center; gap: 16px; min-height: 64px; padding: 12px 6px; border-bottom: 1px solid #e7ebe7; }
.journey-row:hover { background: #f6f8f5; text-decoration: none; }
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
.detail-hero--scene { display: block; }
.detail-hero--scene .scene-image { display: block; width: 100%; height: clamp(180px, 26vw, 340px); aspect-ratio: auto; border-radius: 10px; }
.detail-hero--scene .scene-number { font-size: 14px; color: #3a4a40; }
.detail-hero--scene .detail-copy { margin-top: 22px; }
#detail-preview .reading-text { max-width: 680px; margin: 0; }
.detail-note { margin: 14px 0 0; font-size: 13px; }
.figure-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; list-style: none; margin: 0; padding: 0; }
.figure-list li { display: flex; gap: 14px; align-items: flex-start; padding: 14px 0; border-top: 1px solid #e7ebe7; }
.figure-chip { flex: none; width: 18px; height: 18px; margin-top: 2px; border: 1px solid #0000000f; border-radius: 6px; }
.figure-copy { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.figure-copy strong { font-size: 15px; font-weight: 650; }
.figure-copy .journey-badge { align-self: flex-start; }
.figure-story { font-size: 13px; line-height: 1.65; color: #6b776f; }
.neighbor-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; font-size: 14px; }
.neighbor-link { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: #3f5a49; }
.neighbor-link:hover { color: var(--accent); text-decoration: none; }
.neighbor-link svg { width: 15px; height: 15px; }
.neighbor-nav > :last-child { justify-self: end; text-align: right; }
.neighbor-all { font-size: 13px; color: #75867a; }
.detail-source { padding-top: 34px; margin-top: 34px; border-top: 1px solid #edf0ec; }
.detail-source h2 { margin: 0 0 10px; font-size: 15px; color: #4f5f56; }
.detail-source .source-note { padding: 0; border: 0; font-size: 12px !important; line-height: 1.8; color: #7f8982; }
@media (max-width: 1100px) { .detail-copy h1 { font-size: 36px; } }
@media (max-width: 850px) {
  .detail-copy h1 { font-size: 32px; }
  .figure-list { grid-template-columns: minmax(0, 1fr); }
  .neighbor-nav { grid-template-columns: 1fr 1fr; }
  .neighbor-all { grid-column: 1 / -1; justify-self: center; order: 3; }
}
@media (max-width: 600px) {
  .detail-hero { grid-template-columns: 112px minmax(0, 1fr); gap: 18px; align-items: start; }
  .detail-cover { width: 112px; }
  .detail-copy .eyebrow { margin-bottom: 8px; font-size: 11px; }
  .detail-copy h1 { margin-bottom: 8px; font-size: 26px; letter-spacing: -.045em; }
  .detail-meta { font-size: 13px; }
  .detail-description { font-size: 15px; }
  /* The CTA moves to the end of the page and stays pinned to the bottom of the screen. */
  .detail-cta { order: 99; position: sticky; bottom: 0; z-index: 5; gap: 6px 14px; margin: 0 -20px; padding: 12px 20px calc(12px + env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid var(--line); }
  .detail-cta .primary-button { flex: 1 1 auto; }
  .detail-section { padding-top: 30px; margin-top: 28px; }
  .detail-section .section-heading h2 { font-size: 21px; }
  .journey-row { gap: 12px; min-height: 58px; }
  .journey-model { display: none; }
  .detail-crumbs a { max-width: 60vw; }
  .detail-hero--scene .scene-image { height: 200px; }
  .detail-source { padding-bottom: 8px; }
}
@media (max-width: 370px) {
  .detail-hero { grid-template-columns: minmax(0, 1fr); }
  .detail-cover { width: 130px; margin: 0 auto; }
  .detail-cta { margin: 0 -14px; padding-left: 14px; padding-right: 14px; }
}
```

- [ ] **Step 3: `client/main.js` 전체를 다음 내용으로 바꾸기**

바뀌지 않은 함수(`remember`, `record`, `showFloorReading`, `help`, `readChapter`, `showTrailer`, `chapterMap`, `toggleSound`, `visibilitychange`)도 함께 적어 파일 전체를 한 번에 맞춘다.

```js
import { revealReading } from "../shared/floor-reading.js";
import { Journey } from "./journey.js";
import { showLoading, clearLoading, transitionPage } from "./transitions.js";
import { api, esc, icon, icons, logo, modal, toast } from "../shared/ui.js";
import "../shared/style.css";
import { announcementBanner, landing, setupCatalog } from "./landing.js";
import { bookCover, edition } from "./book-meta.js";
import { bookDetail, sceneDetail, detailUrl } from "./detail.js";
import "./detail.css";
let library,
  book,
  chapter,
  world,
  // Which screen is on: the bookshelf ("home"), a book detail, a scene detail or the 3D world.
  view = "home",
  sound = false,
  audioContext,
  ambient,
  saveTimer,
  disposeView;
const catalogState = { query: "", category: "all", sort: "default", scroll: 0, selected: null };
const draftPreview = new URLSearchParams(location.search).get("preview") === "draft";
// The studio's Vercel project serves the reader for previews but has no /about page.
const aboutLink = !draftPreview && import.meta.env.MODE !== "admin";
const baseTitle = document.title;
let progress;
try {
  progress = JSON.parse(localStorage.getItem("otb-reader") || "{}");
} catch {
  progress = {};
}
if (!progress || typeof progress !== "object" || Array.isArray(progress))
  progress = {};
const app = document.querySelector("#app");
const remember = () => {
  if (draftPreview) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem("otb-reader", JSON.stringify(progress));
    } catch {
      toast("이 브라우저에서는 탐험 기록을 저장할 수 없습니다.");
    }
  }, 100);
};
function record() {
  if (!progress[book.id] || typeof progress[book.id] !== "object")
    progress[book.id] = { chapter: book.chapters[0].id };
  return progress[book.id];
}
// The address of the current screen, carrying the draft preview flag when it is on.
function currentUrl() {
  if (view === "home") return `${location.pathname}${draftPreview ? "?preview=draft" : ""}`;
  return location.pathname + detailUrl({
    book: book.id,
    scene: view === "scene" ? chapter.id : undefined,
    chapter: view === "world" ? chapter.id : undefined,
    preview: draftPreview,
  });
}
// Which screen a query string asks for. Unknown ids fall back to the nearest screen;
// `clean` says the address had unusable parts and should be rewritten.
function resolveView(params) {
  const selected = library.books.find(b => b.id === params.get("book"));
  if (!selected) return { view: "home", book: library.books[0], chapter: library.books[0].chapters[0], clean: params.has("book") };
  const explored = selected.chapters.find(c => c.id === params.get("chapter"));
  if (explored) return { view: "world", book: selected, chapter: explored, clean: false };
  const scene = selected.chapters.find(c => c.id === params.get("scene"));
  if (scene) return { view: "scene", book: selected, chapter: scene, clean: false };
  return { view: "book", book: selected, chapter: selected.chapters[0], clean: params.has("scene") || params.has("chapter") };
}
function applyResolved(state) {
  view = state.view;
  book = state.book;
  chapter = state.chapter;
  if (view === "world") { record().chapter = chapter.id; remember(); }
  if (state.clean) history.replaceState(null, "", currentUrl());
}
function pageTitle() {
  if (view === "book") return `${book.title} — On the Book`;
  if (view === "scene") return `${chapter.title} · ${book.title} — On the Book`;
  return baseTitle;
}
function header() {
  const compact = view !== "home";
  return `<header class="site-header${compact ? " reader-header" : ""}"><a class="brand" href="/client/${draftPreview ? "?preview=draft" : ""}" aria-label="On the Book 홈">${logo}</a>${compact ? "" : `<label class="header-search">${icon("search")}<input id="book-search" type="search" aria-label="도서 제목 또는 작가 검색" placeholder="어떤 이야기를 찾으세요?" value="${esc(catalogState.query)}" autocomplete="off"></label>`}<nav aria-label="주 메뉴">${aboutLink ? '<a id="about-link" class="text-button" href="/about">소개</a>' : ""}<button id="library-button" class="${compact ? "text-button" : "icon-button"}" aria-label="${compact ? "책장으로" : "책장 홈"}">${icon(compact ? "arrow-left" : "book-open")}${compact ? "책장으로" : ""}</button>${view === "world" ? `<button id="sound-button" class="icon-button" aria-label="${sound ? "소리 끄기" : "소리 켜기"}" aria-pressed="${sound}">${icon(sound ? "volume-2" : "volume-x")}</button>` : ""}<button id="help-button" class="icon-button" aria-label="이용 방법">${icon("help-circle")}</button></nav></header>`;
}
function page() {
  if (view === "home") return landing(library, progress, catalogState);
  if (view === "book") return bookDetail({ book, progress, preview: draftPreview });
  if (view === "scene") return sceneDetail({ book, chapter, library, preview: draftPreview });
  const index = book.chapters.indexOf(chapter);
  return `<main class="reader is-exploring"><div class="scene-wrap" id="world"></div>
 <div class="explore-topline"><span class="live-dot"></span> ${esc(book.title)}<button id="reader-book-info" aria-label="${esc(book.title)} 작품 소개">작품 소개 ${icon("chevron-right")}</button></div>
 <div class="touch-pad" aria-label="이동 방향"><button data-dir="up" aria-label="앞으로 이동">↑</button><div><button data-dir="left" aria-label="왼쪽 이동">←</button><button data-dir="down" aria-label="뒤로 이동">↓</button><button data-dir="right" aria-label="오른쪽 이동">→</button></div></div>
 <div class="journey-controls"><button id="prev-chapter" class="icon-button" aria-label="이전 챕터" ${index === 0 ? "disabled" : ""}>${icon("arrow-left")}</button><button id="map-button" class="chapter-switch"><span><small>지금 걷고 있는 페이지</small>${String(index + 1).padStart(2, "0")} — ${esc(chapter.title)}</span></button><button id="next-chapter" class="icon-button" aria-label="다음 챕터" ${index === book.chapters.length - 1 ? "disabled" : ""}>${icon("arrow-right")}</button></div>
 <div class="move-hint">${icon("move")} 땅을 클릭 · 방향키로 이동 <span>물체 가까이 다가가 보세요</span></div></main>`;
}
function render() {
  disposeView?.();
  disposeView = undefined;
  world?.dispose();
  world = undefined;
  const exploring = view === "world";
  if (audioContext) exploring && sound ? audioContext.resume() : audioContext.suspend();
  document.title = pageTitle();
  app.innerHTML = `${view === "home" ? announcementBanner() : ""}${header()}${page()}
 <footer class="site-footer"><span>${exploring ? "문장 너머의 세계를, 천천히." : "오래된 이야기, 새로운 발견."}</span>${exploring ? `<div><span>땅을 클릭 · 방향키로 이동 · 가까이서 움직임 감상</span></div>` : ""}<span class="footer-brand">ON THE BOOK © 2026</span></footer>`;
  if (exploring) try {
    world = new Journey(document.querySelector("#world"), {
      chapter,
      chapters: book.chapters,
      onChapter: syncChapter,
      onReading: showFloorReading,
      models: library.models,
      hero: false,
      onError: toast,
    });
    world.setActive(true);
    const panel = document.createElement("aside"); panel.className = "floor-reading-controls"; panel.hidden = true;
    panel.innerHTML = '<h2 id="floor-title"></h2><img class="story-divider" src="/ornaments/story-divider.png" alt="" aria-hidden="true"><p id="floor-accessible" tabindex="0" aria-label="이야기 본문" aria-live="polite"></p><div class="floor-pagination"><button id="floor-prev" class="icon-button" aria-label="이전 글귀">←</button><span id="floor-page"></span><button id="floor-next" class="icon-button" aria-label="다음 글귀">→</button></div>';
    document.querySelector(".reader").append(panel);
    panel.querySelector("#floor-prev").onclick = () => world.turnReadingPage(-1);
    panel.querySelector("#floor-next").onclick = () => world.turnReadingPage(1);
  } catch (e) {
    document.querySelector("#world").innerHTML =
      `<div class="world-error"><h2>3D 화면을 불러오지 못했어요</h2><p>${esc(e.message)}</p><button id="fallback-read" class="primary-button">이야기 읽기</button></div>`;
    document.querySelector("#fallback-read").onclick = readChapter;
  }
  icons();
  document.querySelector("#library-button").onclick = openLibrary;
  document.querySelector(".site-header .brand").onclick = (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openLibrary();
  };
  document.querySelector("#help-button").onclick = help;
  const soundButton = document.querySelector("#sound-button");
  if (soundButton) soundButton.onclick = toggleSound;
  if (view === "home") {
    disposeView = setupCatalog({ library, progress, state: catalogState, onEnter: enterBook, onOpen: openDetail, onTrailer: showTrailer, onHelp: help });
  } else if (exploring) {
    document.querySelector("#reader-book-info").onclick = () => bookDetails(book.id);
    document.querySelector("#map-button").onclick = chapterMap;
    document.querySelector("#prev-chapter").onclick = () =>
      goChapter(book.chapters.indexOf(chapter) - 1);
    document.querySelector("#next-chapter").onclick = nextChapter;
    for (const button of document.querySelectorAll("[data-dir]")) {
      const keys = {
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
      };
      button.onpointerdown = (e) => {
        button.setPointerCapture(e.pointerId);
        world?.keys.add(keys[button.dataset.dir]);
      };
      button.onpointerup = button.onpointercancel = () =>
        world?.keys.delete(keys[button.dataset.dir]);
    }
  } else {
    disposeView = setupDetail();
  }
}
// One delegated click handler for a detail page: CTA buttons enter the world, links open another detail.
function setupDetail() {
  const abort = new AbortController();
  document.querySelector(".detail-page").addEventListener("click", event => {
    const target = event.target.closest("[data-enter], a[data-book], a[data-scene-book]");
    if (!target) return;
    if (target.dataset.enter) { enterBook(target.dataset.enter, target.dataset.enterChapter); return; }
    // Modified clicks keep the browser's own behaviour, such as opening the link in a new tab.
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (target.dataset.sceneBook) openDetail("scene", target.dataset.sceneBook, target.dataset.sceneChapter);
    else openDetail("book", target.dataset.book);
  }, { signal: abort.signal });
  return () => abort.abort();
}
function showFloorReading(state) {
  const panel = document.querySelector(".floor-reading-controls"); if (!panel) return;
  panel.hidden = !state; if (!state) return;
  panel.querySelector("#floor-title").textContent = state.title;
  panel.querySelector("#floor-page").textContent = `${state.page + 1} / ${state.count}`;
  panel.querySelector("#floor-prev").disabled = state.page === 0;
  panel.querySelector("#floor-next").disabled = state.page === state.count - 1;
  panel.querySelector("#floor-accessible").textContent = state.text;
  panel.querySelector("#floor-accessible").scrollTop = 0;
  const settings = state.settings || {};
  if (settings.floorStagger !== false) revealReading(panel);
}
function syncChapter(index) {
  chapter = book.chapters[index]; record().chapter = chapter.id; remember();
  document.querySelector("#map-button span").innerHTML = `<small>이야기의 지도</small>${String(index + 1).padStart(2, "0")} — ${esc(chapter.title)}`;
  document.querySelector("#prev-chapter").disabled = index === 0;
  document.querySelector("#next-chapter").disabled = index === book.chapters.length - 1;
  history.replaceState(null, "", currentUrl());
}
function goChapter(index) {
  if (index < 0 || index >= book.chapters.length) return;
  if (view === "world" && world instanceof Journey) {
    if (index === book.chapters.indexOf(chapter)) return;
    transitionPage(app, () => world.jump(index), { label: "다음 장면을 펼치는 중이에요…", focus: "#map-button" });
    return;
  }
  transitionPage(app, () => {
    chapter = book.chapters[index];
    record().chapter = chapter.id;
    remember();
    view = "world";
    render();
    history.replaceState(null, "", currentUrl());
  });
}
function nextChapter() { goChapter(book.chapters.indexOf(chapter) + 1); }
function help() {
  modal(
    `<span class="eyebrow">HOW TO WANDER</span><h2>정해진 속도는 없어요.</h2><div class="instruction"><b>01</b><p><strong>가고 싶은 곳을 눌러요</strong>땅을 클릭하거나 마우스를 누른 채 움직이면 그 위치를 따라가요. 방향키·W A S D로도 이동해요. 휴대폰에서는 화면의 방향 버튼도 사용할 수 있어요.</p></div><div class="instruction"><b>02</b><p><strong>작은 물체에 다가가요</strong>챕터의 3D 모델에 가까워지면 애니메이션이 재생돼요. 멀어지면 멈추고, 다시 가까워지면 처음부터 재생돼요.</p></div><div class="instruction"><b>03</b><p><strong>다음 이야기를 만나요</strong>넓게 이어진 공간을 자유롭게 걸어요. 이동을 위한 조건은 없어요. 지도에서 원하는 챕터를 바로 열 수도 있어요.</p></div><p class="muted">소리는 오른쪽 위에서 켤 수 있어요. 탐험 기록은 이 브라우저에 저장돼요.</p>`,
  );
}
function readChapter() {
  modal(
    `<span class="eyebrow">CHAPTER ${String(book.chapters.indexOf(chapter) + 1).padStart(2, "0")}</span><h2>${esc(chapter.title)}</h2><div class="reading-text">${chapter.body
      .split("\n\n")
      .map((p) => `<p>${esc(p)}</p>`)
      .join(
        "",
      )}</div><p class="source-note">${esc(book.rights)}<br><a href="${esc(book.source)}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a></p>`,
  );
}
async function enterBook(id, chapterId) {
  const selected = library.books.find(b => b.id === id);
  if (!selected) return;
  await transitionPage(app, () => {
    book = selected;
    chapter = book.chapters.find(c => c.id === chapterId) || book.chapters.find(c => c.id === progress[id]?.chapter) || book.chapters[0];
    view = "world";
    record().chapter = chapter.id;
    remember();
    history.pushState(null, "", currentUrl());
    render();
  }, { label: "이야기 속으로 들어가는 중이에요…" });
}
// Opens the book detail ("book") or a scene detail ("scene") in the same document, with a history entry.
async function openDetail(target, bookId, sceneId) {
  const selected = library.books.find(b => b.id === bookId);
  if (!selected) return;
  const scene = target === "scene" ? selected.chapters.find(c => c.id === sceneId) : null;
  if (target === "scene" && !scene) return;
  await transitionPage(app, () => {
    view = scene ? "scene" : "book";
    book = selected;
    chapter = scene || selected.chapters[0];
    history.pushState(null, "", currentUrl());
    render();
  }, { label: scene ? "장면을 펼치는 중이에요…" : "작품을 펼치는 중이에요…" });
}
async function openLibrary() {
  if (view === "home") {
    catalogState.query = "";
    catalogState.category = "all";
    render();
    document.querySelector("#catalog-title").focus();
    return;
  }
  const changed = await transitionPage(app, () => {
    view = "home";
    history.pushState(null, "", currentUrl());
    render();
  }, { label: "책장으로 돌아가는 중이에요…", focus: "#catalog-title" });
  if (changed) restoreCatalogPosition();
}
function restoreCatalogPosition() {
  window.scrollTo({ top: catalogState.scroll, behavior: "instant" });
  if (catalogState.selected) document.querySelector(`[data-enter="${CSS.escape(catalogState.selected)}"]`)?.focus({ preventScroll: true });
}
// Work information inside the 3D world. The bookshelf reaches the same information through the book detail page.
function bookDetails(id) {
  const selected = library.books.find(b => b.id === id);
  if (!selected) return;
  const d = modal(`<div class="book-detail-heading">${bookCover(selected)}<div><span class="eyebrow">${edition(selected).category} · ${selected.chapters.length}개의 장면</span><h2 id="book-detail-title">${esc(selected.title)}</h2><p>${esc(selected.author)} · ${selected.year}</p><p>${esc(selected.englishTitle)}</p></div></div><p class="book-detail-copy">${esc(selected.description)}</p><h3>이 책에서 만날 장면</h3><ol class="book-detail-chapters">${selected.chapters.map(c => `<li>${esc(c.title)}</li>`).join("")}</ol><p class="source-note">${esc(selected.rights)}<br><a href="${esc(selected.source)}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a></p><button class="primary-button book-detail-enter">이야기로 돌아가기 ${icon("arrow-up-right")}</button>`);
  d.setAttribute("aria-labelledby", "book-detail-title");
  d.querySelector(".book-detail-enter").onclick = () => d.close();
}
function showTrailer() {
  const d = modal('<h2 id="trailer-title">먼저 만나는 온더북</h2><video src="/trailer-web.mp4" controls playsinline preload="none" aria-label="On the Book 브랜드 트레일러"></video><p class="trailer-error" role="status" hidden>영상을 불러오지 못했어요. 책장에서는 계속 작품을 둘러볼 수 있어요.</p>');
  d.classList.add("trailer-modal");
  d.setAttribute("aria-labelledby", "trailer-title");
  const video = d.querySelector("video");
  video.addEventListener("error", () => d.querySelector(".trailer-error").hidden = false);
  d.addEventListener("close", () => { video.pause(); video.removeAttribute("src"); video.load(); });
}
function chapterMap() {
  const d = modal(
    `<span class="eyebrow">YOUR JOURNEY</span><h2>이야기의 지도</h2><div class="chapter-list">${book.chapters.map((c, i) => `<button data-chapter="${i}" class="${c === chapter ? "selected" : ""}"><b>${String(i + 1).padStart(2, "0")}</b><span><strong>${esc(c.title)}</strong><small>${esc(c.subtitle)}</small></span>${icon(c === chapter ? "check" : "arrow-right")}</button>`).join("")}</div>`,
  );
  for (const b of d.querySelectorAll("[data-chapter]"))
    b.onclick = () => {
      d.close();
      goChapter(+b.dataset.chapter);
    };
}
async function toggleSound() {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
      ambient = audioContext.createGain();
      ambient.gain.value = 0;
      ambient.connect(audioContext.destination);
      for (const frequency of [130.81, 196, 261.63]) {
        const o = audioContext.createOscillator();
        o.type = "sine";
        o.frequency.value = frequency;
        o.connect(ambient);
        o.start();
      }
    }
    await audioContext.resume();
    sound = !sound;
    ambient.gain.setTargetAtTime(
      sound ? 0.014 : 0,
      audioContext.currentTime,
      0.3,
    );
    const b = document.querySelector("#sound-button");
    b.innerHTML = icon(sound ? "volume-2" : "volume-x");
    b.setAttribute("aria-label", sound ? "소리 끄기" : "소리 켜기");
    b.setAttribute("aria-pressed", String(sound));
    icons();
  } catch {
    toast("이 브라우저에서 소리를 재생할 수 없습니다.");
  }
}
document.addEventListener("visibilitychange", () => {
  if (audioContext)
    document.hidden || view !== "world" ? audioContext.suspend() : sound && audioContext.resume();
});
let navigationVersion = 0;
window.addEventListener("popstate", async () => {
  if (!library?.books.length) return;
  const version = ++navigationVersion;
  // Browser Back remains available while the visual transition blocks page clicks.
  while (app.inert) await new Promise(resolve => setTimeout(resolve, 40));
  if (version !== navigationVersion) return;
  document.querySelectorAll("dialog[open]").forEach(d => d.close());
  const state = resolveView(new URLSearchParams(location.search));
  const changed = await transitionPage(app, () => {
    applyResolved(state);
    render();
  }, { focus: state.view === "home" ? "#catalog-title" : undefined });
  if (changed && view === "home" && version === navigationVersion) restoreCatalogPosition();
});
async function init() {
  if (draftPreview) document.documentElement.dataset.draftPreview = "true";
  app.innerHTML = "";
  showLoading();
  app.setAttribute("aria-busy", "true");
  try {
    library = draftPreview ? (await api("/api/studio")).library : await api("/api/library");
    if (!library.books.length) {
      clearLoading();
      app.removeAttribute("aria-busy");
      app.innerHTML =
        '<div class="loading-screen"><h1>새로운 이야기를 준비하고 있어요.</h1><p>관리자가 책을 공개하면 이곳에 나타나요.</p></div>';
      return;
    }
    const params = new URLSearchParams(location.search);
    applyResolved(resolveView(params));
    await transitionPage(app, render, { initial: true });
    if (draftPreview && params.get('model') && world instanceof Journey) {
      const object = world.objects.find(o => o.p.id === params.get('model'));
      if (object) world.moveTo(object.p.x, object.p.z);
    }
  } catch (e) {
    clearLoading();
    app.removeAttribute("aria-busy");
    app.innerHTML = `<div class="loading-screen"><h1>책장을 불러오지 못했어요.</h1><p>${esc(e.message)}</p><button class="primary-button" id="retry">다시 시도</button></div>`;
    document.querySelector("#retry").onclick = init;
  }
}
init();
```

바뀐 점 요약(검토용): `exploring` → `view`; `readerUrl()` → `currentUrl()`; `resolveView`·`applyResolved` 를 `init` 과 `popstate` 가 공유; `page()` 로 마크업 갈래 분리; `setupDetail`·`openDetail` 추가; `bookDetails()` 의 홈 진입 갈래 삭제; `Journey` 의 `hero: !exploring`(항상 거짓) → `hero: false`; `setupCatalog` 에 `onOpen` 전달(landing.js 는 Task 6 에서 사용). `restoreCatalogPosition()` 은 아직 `[data-enter]` 를 찾는다(Task 6 에서 선택자 저장으로 바꾼다).

- [ ] **Step 4: 빌드**

Run: `npm run build`
Expected: 성공. `dist/client/assets/client-*.js` 에 `detail.css` 내용이 `client-*.css` 로 합쳐진다. 경고나 "is not exported" 오류가 없어야 한다.

- [ ] **Step 5: 기존 책장 검사가 그대로 통과하는지 확인**

Run: `node tests/catalog.mjs`
Expected: 다음 12줄이 모두 `PASS` 로 출력되고 프로세스가 0 으로 끝난다(4336 포트).

```
PASS Readable type scale on desktop
PASS Hero swipe, progress and staggered text animation
PASS Search, category, sort and empty results
PASS Work information remains available inside the 3D reader
PASS Direct 3D entry, movement, chapters, saved progress and browser history
PASS Both real books enter their own world; trailer opens and closes
PASS Blank image slots, featured entry and scene carousel with direct chapter entry
PASS 18-book responsive grid without changing real library
PASS 320px: no horizontal overflow, touch entry and chapter navigation
PASS 390px: no horizontal overflow, touch entry and chapter navigation
PASS 768px: no horizontal overflow, touch entry and chapter navigation
PASS No browser exceptions; saved library still contains only two books
```

홈 카드가 아직 3D 로 직행하므로 이 검사는 바뀐 것이 없어야 한다. 실패하면 `main.js` 의 `world` 갈래 마크업이나 `openLibrary`·`popstate` 를 원본과 다시 비교한다.

- [ ] **Step 6: 상세 페이지를 주소로 열어 보는 임시 확인 스크립트**

`test-results/detail-smoke.mjs` 를 만든다(gitignore 대상, 커밋하지 않는다).

```js
import { chromium, expect } from '@playwright/test';
import { startServer } from '../tests/helpers.js';

const server = await startServer(4337);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`${server.url}/client/?book=alice`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page).toHaveTitle('이상한 나라의 앨리스 — On the Book');
  await expect(page.locator('.journey-row')).toHaveCount(6);
  await expect(page.locator('.header-search')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '책장으로', exact: true })).toBeVisible();
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  console.log('PASS book detail by address');

  await page.locator('.journey-row').nth(1).click();
  await expect(page.locator('.detail-page[data-view="scene"]')).toBeVisible();
  await expect(page).toHaveURL(/book=alice&scene=alice-2$/);
  await expect(page.locator('#detail-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page).toHaveTitle('작아지는 문, 커지는 세계 · 이상한 나라의 앨리스 — On the Book');
  await expect(page.locator('.figure-list li')).toHaveCount(3);
  await page.locator('.neighbor-link').last().click();
  await expect(page).toHaveURL(/book=alice&scene=alice-3$/);
  await page.locator('.detail-crumbs a').click();
  await expect(page).toHaveURL(/\?book=alice$/);
  console.log('PASS scene detail, neighbours and breadcrumb');

  await page.locator('.journey-row').nth(1).click();
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page).toHaveURL(/book=alice&chapter=alice-2/);
  await expect(page).toHaveTitle('On the Book — 책 속을 걷는 시간');
  await page.goBack();
  await expect(page.locator('.detail-page[data-view="scene"]')).toBeVisible();
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(page.locator('.library-page')).toBeVisible();
  await expect(page).toHaveURL(/\/client\/$/);
  console.log('PASS CTA enters the world, Back returns to the scene, 책장으로 returns home');

  await page.goto(`${server.url}/client/?book=nope`);
  await expect(page.locator('.library-page')).toBeVisible();
  await expect(page).toHaveURL(/\/client\/$/);
  await page.goto(`${server.url}/client/?book=alice&chapter=nope`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page).toHaveURL(/\?book=alice$/);
  await page.goto(`${server.url}/client/?book=alice&scene=nope&preview=draft`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page).toHaveURL(/\?book=alice&preview=draft$/);
  await expect(page.locator('.journey-row').first()).toHaveAttribute('href', '?book=alice&scene=alice-1&preview=draft');
  console.log('PASS unknown ids fall back and the address is cleaned');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.goto(`${server.url}/client/?book=alice&scene=alice-2`);
  await expect(mobile.locator('.detail-page[data-view="scene"]')).toBeVisible();
  expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const cta = await mobile.locator('.detail-cta .primary-button').evaluate(element => {
    const r = element.getBoundingClientRect();
    return { visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
  });
  expect(cta).toEqual({ visible: true, reachable: true });
  console.log('PASS 390px scene detail has no overflow and the CTA is pinned in view');
  expect(errors).toEqual([]);
} finally {
  await browser.close();
  await server.stop();
}
```

Run: `node test-results/detail-smoke.mjs`
Expected: `PASS` 5줄, 예외 없음. `?preview=draft` 는 `/api/studio` 를 부르는데 비밀번호 없는 테스트 서버는 인증 없이 응답한다(`tests/helpers.js` 가 `ADMIN_PASSWORD` 를 빈 값으로 둔다).

- [ ] **Step 7: 커밋**

```bash
git add client/main.js client/transitions.js client/detail.css
git commit -F - <<'EOF'
Open book and scene detail pages from the reader address

main.js now tracks four views (home, book, scene, world). ?book= opens
the book detail, ?book=&scene= the scene detail, and the existing
?book=&chapter= the 3D world. One resolver serves the first load and
Back/Forward, unknown ids fall back to the nearest view, and the curtain
transition reveals and focuses the detail pages. Home cards still enter
the world directly; the next commit routes them through the details.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 6: 홈 카드를 상세 링크로 바꾸고 브라우저 검사를 새 흐름에 맞추기

카드 동작과 그 검사는 한 커밋에서 바뀐다. 이 Task 뒤에는 홈에서 3D 로 직행하는 경로가 없다.

**Files:**
- Modify: `client/landing.js`(`bookCard`, `feature`, `landing`, `setupCatalog`), `client/landing.css:87`(a 카드 규칙), `client/main.js`(`landing()`·`setupCatalog()` 호출, `restoreCatalogPosition`)
- Test: `tests/catalog.mjs`, `tests/mobile-entry.mjs`

**Interfaces:**
- Consumes: `detailUrl()`(Task 2), `openDetail(target, bookId, sceneId)`(Task 5).
- Produces: `landing(library, progress, state, preview = false)`, `setupCatalog({ library, progress, state, preview, onOpen, onTrailer, onHelp })`. 홈 카드 속성: 도서 `a.book-entry[data-book]`, 장면 `a.scene-card[data-scene-book][data-scene-chapter]`, 히어로 `button.feature-card[data-feature-book]`(유지). `catalogState.selected` 는 이제 CSS 선택자 문자열이다.

- [ ] **Step 1: `tests/catalog.mjs` 를 새 흐름으로 고치기 (먼저 실패하게 둔다)**

다섯 군데를 바꾼다. 각 블록은 파일 안에서 한 번씩만 나온다.

(A) `await page.locator('[data-enter="alice"]').click();` 로 시작하는 5줄

```js
  await page.locator('[data-enter="alice"]').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page).toHaveURL(/book=alice&chapter=alice-1/);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
```

을 다음으로 바꾼다.

```js
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('.journey-row')).toHaveCount(6);
  await expect(page.locator('.detail-cta .primary-button')).toHaveText(/이야기 속으로 들어가기/);
  await expect(page.locator('.detail-cover img, .detail-page img')).toHaveCount(0);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  pass('Book cards open the book detail page');
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page).toHaveURL(/book=alice&chapter=alice-1/);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
```

(B) `await page.getByRole('button', { name: '읽던 작품 이어 보기', exact: true }).click();` 로 시작해 `pass('Direct 3D entry, movement, chapters, saved progress and browser history');` 로 끝나는 블록(두 번째 '읽던 작품 이어 보기' 클릭. 첫 번째는 검색 단계의 빈 결과 확인이다)

```js
  await page.getByRole('button', { name: '읽던 작품 이어 보기', exact: true }).click();
  await expect(page.locator('.book-title')).toHaveText('이상한 나라의 앨리스');
  await page.locator('[data-enter="alice"]').click();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.reload();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.goBack();
  await expect(page.locator('.library-page')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#map-button')).toContainText('02');
  pass('Direct 3D entry, movement, chapters, saved progress and browser history');
```

을 다음으로 바꾼다.

```js
  await page.getByRole('button', { name: '읽던 작품 이어 보기', exact: true }).click();
  await expect(page.locator('.book-title')).toHaveText('이상한 나라의 앨리스');
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-cta .primary-button')).toContainText('이어 읽기');
  await expect(page.locator('.detail-cta .primary-button')).toContainText('02');
  await expect(page.locator('.journey-badge', { hasText: '마지막에 머문 장면' })).toHaveCount(1);
  await expect(page.locator('.detail-restart')).toHaveText('처음부터 시작하기');
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.reload();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.goBack();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.library-page')).toBeVisible();
  await page.goForward();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#map-button')).toContainText('02');
  pass('Detail CTA resumes the saved chapter; history keeps the detail page between home and world');
```

(C) `await page.locator('[data-enter="oz"]').click();` 로 시작하는 3줄

```js
  await page.locator('[data-enter="oz"]').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page).toHaveURL(/book=oz&chapter=oz-1/);
```

을 다음으로 바꾼다.

```js
  await page.locator('[data-book="oz"]').click();
  await expect(page.locator('#detail-title')).toHaveText('오즈의 마법사');
  await expect(page.locator('.journey-row')).toHaveCount(3);
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page).toHaveURL(/book=oz&chapter=oz-1/);
```

(D) `await page.locator('[data-scene-chapter="alice-3"]').click();` 로 시작해 `pass('Blank image slots, featured entry and scene carousel with direct chapter entry');` 로 끝나는 블록

```js
  await page.locator('[data-scene-chapter="alice-3"]').click();
  await expect(page.locator('#map-button')).toContainText('03');
  await expect(page).toHaveURL(/book=alice&chapter=alice-3/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'oz') {
    await page.getByRole('button', { name: '다음 추천 작품', exact: true }).click();
  }
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'oz');
  await page.locator('.feature-card.is-active').evaluate(element => element.click());
  await expect(page).toHaveURL(/book=oz&chapter=oz-1/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  pass('Blank image slots, featured entry and scene carousel with direct chapter entry');
```

을 다음으로 바꾼다.

```js
  await page.locator('[data-scene-chapter="alice-3"]').click();
  await expect(page.locator('.detail-page[data-view="scene"]')).toBeVisible();
  await expect(page).toHaveURL(/book=alice&scene=alice-3$/);
  await expect(page.locator('#detail-title')).toHaveText('버섯 숲의 수수께끼');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page.locator('.detail-crumbs a')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-preview .reading-text p')).toHaveCount(1);
  await expect(page.locator('.figure-list li')).toHaveCount(3);
  await expect(page.locator('.figure-list li').first()).toContainText('장면의 중심');
  await expect(page.locator('.neighbor-link').first()).toContainText('02');
  await expect(page.locator('.neighbor-link').last()).toContainText('04');
  await expect(page.locator('.detail-page img')).toHaveCount(0);
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('#map-button')).toContainText('03');
  await expect(page).toHaveURL(/book=alice&chapter=alice-3/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'alice') {
    await page.getByRole('button', { name: '이전 추천 작품', exact: true }).click();
  }
  await page.locator('.feature-card.is-active').evaluate(element => element.click());
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  await expect(page.locator('.feature-card.is-active')).toBeFocused();
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'oz') {
    await page.getByRole('button', { name: '다음 추천 작품', exact: true }).click();
  }
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'oz');
  await page.locator('.feature-card.is-active').evaluate(element => element.click());
  await expect(page).toHaveURL(/\?book=oz$/);
  await expect(page.locator('#detail-title')).toHaveText('오즈의 마법사');
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(page.locator('.library-page')).toBeVisible();
  pass('Blank image slots, scene cards open the scene detail and the hero opens the book detail');
```

(E) 휴대폰 반복문 안의

```js
    await mobile.locator('[data-enter="oz"]').tap();
    await expect(mobile.locator('#world canvas')).toBeVisible();
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
```

을 다음으로 바꾼다.

```js
    await mobile.locator('[data-book="oz"]').tap();
    await expect(mobile.locator('.detail-page[data-view="book"]')).toBeVisible();
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
    // The CTA must be reachable without scrolling: pinned at the bottom on phones, under the hero on tablets.
    const cta = await mobile.locator('.detail-cta .primary-button').evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(x, y)) };
    });
    expect(cta.visible).toBe(true);
    expect(cta.reachable).toBe(true);
    await mobile.touchscreen.tap(cta.x, cta.y);
    await expect(mobile.locator('#world canvas')).toBeVisible();
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
```

- [ ] **Step 2: `tests/mobile-entry.mjs` 를 새 흐름으로 고치기**

```js
    await page.locator('[data-enter="alice"] .cover-stage').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.locator('[data-enter="alice"] .cover-stage').scrollIntoViewIfNeeded();
    await tapVisible('[data-enter="alice"] .cover-stage');
    await expect(page.locator('.reader-curtain')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.library-page')).toHaveCount(0);
```

을 다음으로 바꾼다.

```js
    await page.locator('[data-book="alice"] .cover-stage').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.locator('[data-book="alice"] .cover-stage').scrollIntoViewIfNeeded();
    await tapVisible('[data-book="alice"] .cover-stage');
    await expect(page.locator('.reader-curtain')).toHaveCount(0);
    await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    // The pinned CTA must be tappable without scrolling, like the chapter controls below.
    await tapVisible('.detail-cta .primary-button');
    await expect(page.locator('.reader-curtain')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.library-page')).toHaveCount(0);
    await expect(page.locator('.detail-page')).toHaveCount(0);
```

마지막 `console.log` 문구를 바꾼다.

```js
    console.log(`PASS ${viewport.width}x${viewport.height}: book cover opens the detail, its pinned CTA enters the world and chapter controls fit the viewport`);
```

- [ ] **Step 3: 실패 확인**

Run: `npm run build && node tests/catalog.mjs`
Expected: 'Search, category, sort and empty results' 까지 PASS 뒤 `[data-book="alice"]` 를 찾지 못해 timeout 으로 실패한다(아직 카드가 `data-enter` 다).

- [ ] **Step 4: `client/landing.js` 카드를 링크로 바꾸기**

import 에 `detailUrl` 을 더한다.

```js
import { esc, icon, icons } from "../shared/ui.js";
import { edition, bookCover } from "./book-meta.js";
import { detailUrl } from "./detail.js";
```

`bookCard()` 를 바꾼다.

```js
function bookCard(book, preview) {
  return `<article class="catalog-card"><a class="book-entry" href="${esc(detailUrl({ book: book.id, preview }))}" data-book="${esc(book.id)}" aria-label="${esc(book.title)} — 작품 상세">
    <span class="cover-stage">${bookCover()}</span>
    <strong class="book-title">${esc(book.title)}</strong>
    <span class="book-author">${esc(book.author)}</span>
    </a></article>`;
}
```

`feature()` 의 `aria-label` 과 행동 문구를 바꾼다. 버튼은 그대로 둔다(슬라이드 전환·스와이프·`inert` 처리가 버튼 전제다).

```js
  return `<button class="feature-card feature-card-${index % 2}${active ? " is-active" : ""}" data-feature-book="${esc(book.id)}" data-feature-index="${index}" aria-label="${esc(book.title)} 작품 상세" aria-hidden="${String(!active)}" tabindex="${active ? 0 : -1}">
    <span class="feature-copy"><span class="feature-kicker">${index ? "한 걸음, 새로운 모험" : "오늘의 이야기"}</span><strong>${esc(book.title)}</strong><span class="feature-description">${esc(book.description)}</span><span class="feature-action">작품 살펴보기 ${icon("arrow-right")}</span></span>
```

(`feature-art`, `feature-number` 줄은 그대로.)

`landing()` 의 서명과 장면 카드를 바꾼다.

```js
export function landing(library, progress, state, preview = false) {
```

장면 카드 한 줄(`scenes.map(...)`)을 다음으로 바꾼다.

```js
${scenes.map(({ book, chapter, index }) => `<a class="scene-card" href="${esc(detailUrl({ book: book.id, scene: chapter.id, preview }))}" data-scene-book="${esc(book.id)}" data-scene-chapter="${esc(chapter.id)}" aria-label="${esc(book.title)} · ${esc(chapter.title)} — 장면 상세"><span class="scene-image image-placeholder" aria-hidden="true"><span class="scene-number">${String(index + 1).padStart(2, "0")}</span><span class="scene-arrow">${icon("arrow-up-right")}</span></span><span class="scene-book">${esc(book.title)}</span><strong>${esc(chapter.title)}</strong><span class="scene-subtitle">${esc(chapter.subtitle)}</span></a>`).join("")}
```

`setupCatalog()` 의 서명을 바꾸고

```js
export function setupCatalog({ library, progress, state, preview = false, onOpen, onTrailer, onHelp }) {
```

`update()` 안의 `books.map(bookCard)` 를 `books.map(b => bookCard(b, preview))` 로 바꾼다.

`enter` 도우미

```js
  const enter = (id, chapter) => {
    state.scroll = scrollY; state.selected = id;
    onEnter(id, chapter);
  };
```

를 다음으로 바꾼다.

```js
  // Remember where the reader was so "책장으로" can scroll back and refocus the card.
  const open = (target, bookId, sceneId, selector) => {
    state.scroll = scrollY; state.selected = selector;
    onOpen(target, bookId, sceneId);
  };
```

클릭 위임 핸들러를 다음으로 바꾼다.

```js
  page.addEventListener("click", event => {
    const link = event.target.closest("a[data-book], a[data-scene-book]");
    if (link) {
      // Modified clicks keep the browser's own behaviour, such as opening the link in a new tab.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (link.dataset.sceneBook) open("scene", link.dataset.sceneBook, link.dataset.sceneChapter, `[data-scene-chapter="${link.dataset.sceneChapter}"]`);
      else open("book", link.dataset.book, undefined, `[data-book="${link.dataset.book}"]`);
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.category) { state.category = button.dataset.category; update(); }
    if (button.dataset.quickView) showCatalog(button.dataset.quickView);
    if (button.dataset.quickCategory) showCatalog(button.dataset.quickCategory);
    if (button.dataset.featureDirection) showHero(Number(button.dataset.featureDirection));
    if (button.hasAttribute("data-feature-autoplay")) {
      heroPaused = !heroPaused;
      button.querySelector("span").textContent = heroPaused ? "▶" : "Ⅱ";
      button.setAttribute("aria-label", heroPaused ? "히어로 자동 재생 시작" : "히어로 자동 재생 중지");
      startHeroTimer();
    }
    if (button.hasAttribute("data-reset")) { showCatalog("all"); search.focus(); }
    if (button.dataset.featureBook) open("book", button.dataset.featureBook, undefined, `[data-feature-book="${button.dataset.featureBook}"]`);
    if (button.hasAttribute("data-help")) onHelp();
    if (button.hasAttribute("data-scenes")) showScenes();
    if (button.dataset.rail) rail.scrollBy({ left: Number(button.dataset.rail) * rail.clientWidth * .8, behavior: motion() });
    if (button.id === "trailer-button") onTrailer();
  }, options);
```

`button.dataset.enter` 와 `button.dataset.sceneBook` 갈래는 없어진다. id 는 스키마가 `[a-zA-Z0-9_-]` 로 제한하므로 선택자 문자열에 그대로 넣는다.

- [ ] **Step 5: `client/landing.css` 에 링크 카드 규칙 추가**

`.book-entry { … }` 규칙 바로 아래에 두 줄을 더한다.

```css
a.book-entry, a.scene-card { color: inherit; text-decoration: none; }
a.book-entry:hover, a.scene-card:hover { text-decoration: none; }
```

- [ ] **Step 6: `client/main.js` 호출부와 초점 복원 고치기**

`page()` 의 홈 갈래

```js
  if (view === "home") return landing(library, progress, catalogState);
```

를

```js
  if (view === "home") return landing(library, progress, catalogState, draftPreview);
```

로, `render()` 의

```js
    disposeView = setupCatalog({ library, progress, state: catalogState, onEnter: enterBook, onOpen: openDetail, onTrailer: showTrailer, onHelp: help });
```

를

```js
    disposeView = setupCatalog({ library, progress, state: catalogState, preview: draftPreview, onOpen: openDetail, onTrailer: showTrailer, onHelp: help });
```

로, `restoreCatalogPosition()` 을 다음으로 바꾼다.

```js
function restoreCatalogPosition() {
  window.scrollTo({ top: catalogState.scroll, behavior: "instant" });
  // `selected` is the CSS selector of the card that opened the detail. An inert hero slide simply keeps the title focus.
  if (catalogState.selected) document.querySelector(catalogState.selected)?.focus({ preventScroll: true });
}
```

- [ ] **Step 7: 빌드와 두 브라우저 검사**

Run: `npm run build && node tests/catalog.mjs`
Expected: 13줄 PASS, 종료 코드 0.

```
PASS Readable type scale on desktop
PASS Hero swipe, progress and staggered text animation
PASS Search, category, sort and empty results
PASS Book cards open the book detail page
PASS Work information remains available inside the 3D reader
PASS Detail CTA resumes the saved chapter; history keeps the detail page between home and world
PASS Both real books enter their own world; trailer opens and closes
PASS Blank image slots, scene cards open the scene detail and the hero opens the book detail
PASS 18-book responsive grid without changing real library
PASS 320px: no horizontal overflow, touch entry and chapter navigation
PASS 390px: no horizontal overflow, touch entry and chapter navigation
PASS 768px: no horizontal overflow, touch entry and chapter navigation
PASS No browser exceptions; saved library still contains only two books
```

Run: `node tests/mobile-entry.mjs`
Expected: `PASS 393x700: …`, `PASS 360x640: …`, `PASS 320x560: …`, `PASS 412x800: …` 네 줄.

`tapVisible('.detail-cta .primary-button')` 이 `must fit in …` 로 실패하면 600px 이하 `.detail-cta` 의 `position: sticky; bottom: 0` 과 `order: 99` 가 적용되는지(`main.detail-page` 가 `display: flex; flex-direction: column` 인지) 확인한다.

Run: `npm test`
Expected: 모두 통과(단위 검사는 이 Task 에서 바뀌지 않는다).

- [ ] **Step 8: 커밋**

```bash
git add client/landing.js client/landing.css client/main.js tests/catalog.mjs tests/mobile-entry.mjs
git commit -F - <<'EOF'
Route the bookshelf cards through the detail pages

Book and scene cards are now links to ?book= and ?book=&scene=, the
featured hero opens the book detail, and the bookshelf remembers the
card's selector to refocus it on return. The catalog and mobile entry
checks follow the new card → detail → CTA → world flow.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

### Task 7: 미리보기·스크린샷·문서 갱신과 최종 회귀

**Files:**
- Modify: `tests/capture.mjs`, `README.md:29,32,33,45`, `client/index.html:7`, `docs/superpowers/specs/2026-09-11-react-next-migration-design.md:214`
- Create: `docs/preview/detail.png`, `docs/screenshots/detail-book-desktop.png`, `docs/screenshots/detail-book-mobile.png`, `docs/screenshots/detail-scene-desktop.png`, `docs/screenshots/detail-scene-mobile.png`
- Regenerate: `docs/preview/client.png`, `docs/preview/explore.png`, `docs/preview/mobile.png`
- Test: `npm test`, `npm run build`, `node tests/catalog.mjs`, `node tests/mobile-entry.mjs`, `npm run test:about`

**Interfaces:**
- Consumes: Task 6 까지의 홈 카드 속성 `[data-book]`, 상세 페이지 `.detail-page[data-view]`, `.detail-cta .primary-button`.
- Produces: 문서와 증거 파일뿐. 코드 인터페이스는 바뀌지 않는다.

- [ ] **Step 1: `tests/capture.mjs` 를 새 흐름으로 고치기**

```js
  await expect(page.locator('[data-enter="alice"]')).toBeVisible();
  await page.screenshot({ path: 'docs/preview/client.png', fullPage: true });
  await page.locator('[data-enter="alice"]').click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'docs/preview/explore.png', fullPage: true });
```

을 다음으로 바꾼다.

```js
  await expect(page.locator('[data-book="alice"]')).toBeVisible();
  await page.screenshot({ path: 'docs/preview/client.png', fullPage: true });
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.screenshot({ path: 'docs/preview/detail.png', fullPage: true });
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'docs/preview/explore.png', fullPage: true });
```

휴대폰 부분의 `await expect(mobile.locator('[data-enter="alice"]')).toBeVisible();` 을 `await expect(mobile.locator('[data-book="alice"]')).toBeVisible();` 로, 마지막 `console.log('Saved four clean previews in docs/preview');` 를 `console.log('Saved five clean previews in docs/preview');` 로 바꾼다.

- [ ] **Step 2: 미리보기 다시 만들기**

`capture.mjs` 는 4173 포트의 실행 중인 서버를 쓴다. PowerShell 탭에서 완성본 서버를 띄운다.

```powershell
npm run build; npm start
```

Git Bash 에서:

Run: `node tests/capture.mjs`
Expected: `Saved five clean previews in docs/preview`. `docs/preview/detail.png` 이 새로 생기고 `client.png`, `explore.png`, `mobile.png`, `admin.png` 가 다시 써진다. 끝나면 PowerShell 탭의 서버를 Ctrl+C 로 멈춘다.

`docs/preview/admin.png` 는 관리자 화면이라 이 작업과 무관하다. 픽셀이 달라졌더라도 `git restore docs/preview/admin.png` 로 되돌린다.

- [ ] **Step 3: 상세 페이지 스크린샷 네 장**

`test-results/detail-shots.mjs` 를 만든다(커밋하지 않는다).

```js
import { chromium, expect } from '@playwright/test';
import { startServer } from '../tests/helpers.js';

const server = await startServer(4338);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [suffix, viewport] of [['desktop', { width: 1440, height: 960 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, isMobile: suffix === 'mobile', hasTouch: suffix === 'mobile' });
    for (const [name, query, view] of [['book', '?book=alice', 'book'], ['scene', '?book=alice&scene=alice-2', 'scene']]) {
      await page.goto(`${server.url}/client/${query}`);
      await expect(page.locator(`.detail-page[data-view="${view}"]`)).toBeVisible();
      await expect(page.locator('.reader-curtain')).toHaveCount(0);
      await page.waitForFunction(() => document.getAnimations().length === 0);
      await page.screenshot({ path: `docs/screenshots/detail-${name}-${suffix}.png`, fullPage: true });
    }
    await page.close();
  }
  console.log('Saved four detail screenshots in docs/screenshots');
} finally {
  await browser.close();
  await server.stop();
}
```

Run: `node test-results/detail-shots.mjs`
Expected: `Saved four detail screenshots in docs/screenshots`. 네 파일을 열어 표지·장면 자리가 비어 있고, 휴대폰 두 장에서 CTA 가 화면 아래에 붙어 있으며, 가로 스크롤이 없는지 눈으로 확인한다.

- [ ] **Step 4: `README.md` 네 문장 고치기**

29행에서

```
제목·작가 검색, 분류, 제목·출간연도 정렬을 지원하며 도서를 누르면 해당 작품의 3D 공간으로 바로 들어갑니다.
```

를

```
제목·작가 검색, 분류, 제목·출간연도 정렬을 지원하며 도서를 누르면 작품 상세 페이지가 열리고, 그곳의 '이야기 속으로 들어가기' 버튼으로 3D 공간에 들어갑니다. 읽던 작품은 마지막에 머문 장면에서 이어 읽을 수 있습니다.
```

로 바꾼다. 32행

```
- 장면 목록은 가로로 넘겨 볼 수 있고, 선택한 장면의 3D 공간으로 바로 들어갑니다. 이전·다음 버튼, 터치 스크롤, 목록에 초점을 둔 상태에서 방향키·Home·End를 지원합니다.
```

을

```
- 장면 목록은 가로로 넘겨 볼 수 있고, 장면을 누르면 첫 문단과 그 장면의 모델을 미리 보여 주는 장면 상세 페이지가 열립니다. '이 장면부터 걷기' 버튼으로 그 장면의 3D 공간에 들어갑니다. 이전·다음 버튼, 터치 스크롤, 목록에 초점을 둔 상태에서 방향키·Home·End를 지원합니다.
```

으로 바꾼다. 33행의 첫 문장

```
**작품 소개**에서 원작 정보와 장면 목록을 확인합니다.
```

을

```
작품 상세 페이지에서 원작 정보와 장면 목록을 확인하고, 3D 공간 안에서는 **작품 소개** 창으로 같은 정보를 봅니다. 주소 `?book=<책>`은 작품 상세, `?book=<책>&scene=<장면>`은 장면 상세, `?book=<책>&chapter=<장면>`은 3D 공간입니다.
```

으로 바꾼다. 45행

```
1. 사용자 화면에서 표지를 눌러 작품 속으로 들어간 뒤 땅을 누르거나 방향키로 이동합니다. 휴대폰에서는 방향 버튼도 사용할 수 있습니다.
```

를

```
1. 사용자 화면에서 표지를 눌러 작품 상세를 열고 '이야기 속으로 들어가기'를 누른 뒤 땅을 누르거나 방향키로 이동합니다. 휴대폰에서는 방향 버튼도 사용할 수 있습니다.
```

으로 바꾼다.

- [ ] **Step 5: `client/index.html` 설명 메타 고치기**

7행의 `content` 에서

```
작품을 탐색하고 표지를 누르면 바로 3D 이야기 속으로 들어가는 On the Book 데모 서재.
```

를

```
작품과 장면을 살펴보고 원하는 곳에서 3D 이야기 속으로 들어가는 On the Book 데모 서재.
```

로 바꾼다.

- [ ] **Step 6: 전환 스펙 10절에 화면 상태와 주소 규칙 적기**

`docs/superpowers/specs/2026-09-11-react-next-migration-design.md` 214행

```
- `ReaderApp` 컴포넌트가 URL 쿼리를 읽어 시작한다. `preview=draft` 면 `/api/studio`, 아니면 `/api/library`. 책이 없으면 "새로운 이야기를 준비하고 있어요." 화면.
```

을 다음으로 바꾼다.

```
- `ReaderApp` 컴포넌트가 URL 쿼리를 읽어 시작한다. `preview=draft` 면 `/api/studio`, 아니면 `/api/library`. 책이 없으면 "새로운 이야기를 준비하고 있어요." 화면. 화면 상태는 넷이다: `/`(책장 홈), `?book=<id>`(작품 상세), `?book=<id>&scene=<chapterId>`(장면 상세), `?book=<id>&chapter=<chapterId>`(3D 월드). 상세 페이지의 구성·CTA·주소 해석·잘못된 id 처리는 2026-09-28 에 바닐라 client 에 추가한 `2026-09-28-detail-pages-design.md` 를 따르며, App Router 경로(`/books/[id]`)로 바꿀지는 6단계 계획에서 정한다.
```

- [ ] **Step 7: 최종 회귀**

Run: `npm test`
Expected: 모두 통과(`tests/detail.test.js` 12개 포함).

Run: `npm run build`
Expected: 성공.

Run: `node tests/catalog.mjs`
Expected: Task 6 Step 7 의 13줄 PASS.

Run: `node tests/mobile-entry.mjs`
Expected: 4줄 PASS.

Run: `npm run test:about`
Expected: 통과. 소개 페이지의 'On the Book 시작하기' 는 `/` 로 가므로 이 변경에 영향받지 않는다.

Run: `git status --short`
Expected: 아래 커밋 목록의 파일만 바뀌어 있어야 한다. `docs/screenshots/about-*.png`, `docs/browser-results.json` 같은 검사 부산물이 바뀌었으면 `git restore <파일>` 로 되돌린다. `test-results/` 는 gitignore 대상이라 보이지 않는다.

- [ ] **Step 8: 커밋**

```bash
git add tests/capture.mjs docs/preview/client.png docs/preview/detail.png docs/preview/explore.png docs/preview/mobile.png docs/screenshots/detail-book-desktop.png docs/screenshots/detail-book-mobile.png docs/screenshots/detail-scene-desktop.png docs/screenshots/detail-scene-mobile.png README.md client/index.html docs/superpowers/specs/2026-09-11-react-next-migration-design.md
git commit -F - <<'EOF'
Document the detail pages and refresh the previews

README, the page description and the migration spec now describe the
card → detail → CTA → world flow and the four reader addresses. The
preview capture passes through the book detail, and four screenshots
show both detail pages on desktop and on a phone.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

---

## 스펙 대조

| 스펙 절 | 구현 위치 |
| --- | --- |
| 3 화면 상태와 주소, `document.title` | Task 5 `resolveView`·`applyResolved`·`currentUrl`·`pageTitle`, Task 2 `detailUrl` |
| 4 이동 흐름, 커튼 문구, `catalogState.selected` 선택자 | Task 5 `openDetail`·`openLibrary`·`popstate`, Task 6 `open()`·`restoreCatalogPosition` |
| 5 공통 셸, 등장 그룹, 초점, 고정 CTA | Task 5 `header()`·`transitions.js`·`detail.css`(`.detail-cta` 600px 규칙) |
| 6 작품 상세 | Task 3 `bookDetail`, Task 5 `detail.css` |
| 7 장면 상세 | Task 4 `sceneDetail`, Task 5 `detail.css` |
| 8 홈 변경(카드 링크, 히어로 문구, `landing.css`, `index.html`) | Task 6, Task 7 Step 5 |
| 9 `main.js` 정리(`view`, `disposeView`, 모달 갈래 삭제, `hero: false`, CSS import 위치) | Task 5, Task 1(`book-meta.js`) |
| 11 문구 | Task 3·4·6 의 문자열, Global Constraints |
| 12 오류 처리(잘못된 id, 사라진 저장 장면, 새 탭, preview) | Task 5 `resolveView`·`setupDetail`, Task 3 `savedChapter`, Task 5 Step 6 확인 |
| 13 접근성·반응형 | Task 3·4 마크업(`nav`·`aria-current`·`role="img"`), Task 5 `detail.css` |
| 14.1 단위 검사 | Task 1~4 `tests/detail.test.js` |
| 14.2~14.4 브라우저 검사·capture | Task 6, Task 7 Step 1 |
| 14.5 회귀와 스크린샷 | Task 7 Step 3·7 |
| 15 문서 | Task 7 Step 4~6 |
| 17 완료 기준 | Task 6 Step 7(직행 경로 없음, CTA 동작), Task 5 Step 6(주소 새로고침·뒤로가기), Task 7(문서·스크린샷) |
