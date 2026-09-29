# 관리자 주소(경로·쿼리) 상태 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 화면의 탭, 월드 편집기의 책·챕터·선택, 대화상자, 검색·필터, 독자 체험을 주소의 경로·쿼리에 담고, 스크롤·패널 접힘도 기억해서 새로고침·직접 주소·뒤로·앞으로 가기에서 그 자리에 머물게 한다.

**Architecture:** 새 순수 모듈 `admin/route.js` 가 주소 ↔ 경로 객체 변환(`parseRoute`, `routeHref`)과 데이터 보정(`resolveRoute`)을 맡고 `node --test` 로 검사한다. `admin/main.js` 는 모듈 상태에서 경로 객체를 만들어 `history.replaceState`·`pushState` 로 주소에 쓰고, 불러오기와 `popstate` 에서 주소를 상태에 적용한다. 대화상자는 열 때 기록을 쌓고 닫을 때 `history.back()` 으로 되돌리며, 되돌리기가 끝날 때까지 다른 기록 쓰기를 미룬다. 서버와 Vercel 은 `/admin/home|models|settings`, `/admin/books/:id` 에 관리자 HTML 을 돌려준다.

**Tech Stack:** Vite 7(멀티 페이지), 바닐라 JS(ES 모듈), three 0.180(변경 없음), Express 5, node:test, @playwright/test(Edge 채널).

**스펙:** `docs/superpowers/specs/2026-09-28-admin-url-state-design.md`

**계획 작성 중 확인해 둔 사실:**
- 워크트리에는 `node_modules` 가 없었다. `npm ci` 로 설치한다(16초, 134개 패키지).
- 계획 기준 커밋은 `f9071e7`(2026-09-28 origin/main 과 같음)이다. 실행 전에 main 이 움직였으면 앱의 `sync_with_base_branch` 로 들여온 뒤 "찾을 코드"가 그대로인지 다시 확인한다. 같은 날 다른 세션의 `claude/supabase-storage`(미커밋)가 정적 GLB 허용으로 `admin/workspace.js` 의 `eligible`·모델 타일과 `admin/main.js` 의 `editModel` 을 바꿨고, PR #3(상세 페이지)은 README·ADMIN-GUIDE·전환 스펙·`tests/home-admin.mjs` 를 바꾼다.
- 작업 트리의 기존 파일은 CRLF 줄 끝이다(git `autocrlf`). 이 계획의 "찾을 코드"는 줄 끝을 LF 로 맞춰 비교하면 모두 파일에 한 번씩만 나온다(2026-09-28 확인). 편집 도구로 바꾸고, `sed` 같은 줄 단위 도구로 여러 줄을 바꾸지 않는다.
- 브라우저 검사는 `startServer()` 가 `server/index.js --production` 으로 띄운 완성본(`dist`)을 쓴다. 코드를 바꾼 뒤에는 `npm run build` 를 먼저 한다.
- `admin/index.html` 의 스크립트를 `/admin/main.js` 로 바꿔도 `npx vite build` 결과는 `<script type="module" crossorigin src="/assets/admin-….js">` 로 같다. 임시로 서버에 6.6절 미들웨어를 넣어 보니 개발·완성본 모두 `/admin/`, `/admin/models`, `/admin/settings/`, `/admin/books/alice`, `/admin/books/alice/` 는 200 과 `<div id="app"></div>`, `/admin/zzz`, `/admin/books/`, `/admin/books/alice/edit` 는 404, 개발 모드 `/admin/main.js` 는 200 `text/javascript` 였다(확인 후 되돌림).
- Edge 에서 확인: 새로고침 전에 `pushState` 로 쌓은 기록으로 `history.back()` 하면 같은 문서 안의 이동(`popstate` 1회, 문서 유지)이고 `history.state` 도 새로고침 뒤에 남는다. 같은 출처 iframe 이 `pushState` 한 뒤 iframe 을 지우고 `history.back()` 하면 주소가 그대로이고 `popstate` 가 오지 않으며, 한 번 더 `back()` 해야 돌아간다.
- 관리자 셸은 창 전체가 스크롤된다(`.studio-content` 에 `overflow` 없음). 편집기는 전체 화면이다. 표지 `.book-cover` 는 높이 290px 고정, 슬라이드 사진은 `aspect-ratio: 12 / 5` 라 그린 직후 스크롤을 복원해도 된다.
- `tests/workspace.mjs` 5번 줄은 빌드 결과를 정규식 `return\{world:(\w+),dispose\(\)` 와 `(\w+)\.setActive\(!0\)` 로 고쳐 `window.__editorWorld`, `window.__testReader` 를 만든다. `mountWorkspace` 반환 객체는 `world`, `dispose` 를 이 순서로 앞에 둬야 한다.
- `client/journey.js` 의 `jump(index, notify = true)` 와 걷다가 구역이 바뀔 때 `onChapter(index)` 를 부른다. `.inplace-reader` 는 편집기를 덮는다(`position:absolute; inset:0; z-index:50`). 독자 체험 중에는 대화상자를 열 수 없다.
- 기본 바닥 장식의 id 는 `decor-<배치 순서>` 이고(`shared/landscape.js` `defaultDecals`), 클릭으로 선택할 때 `chapter.floorDecals` 에 채워진다(`admin/workspace.js` `onSelectFloor`). 채워지면 `hasUnsavedChanges()` 가 참이 되는 것은 지금도 같다. 스키마의 `floorDecor` 기본값은 `"auto"`, `"none"` 이면 장식이 없다.
- 시드 id: 책 `alice`(챕터 `alice-1`~`alice-6`), `oz`(`oz-1`~`oz-3`). 모델 `rabbit`(하얀 토끼), `clock`(토끼의 회중시계) 등 9개. 이름에 '토끼'가 든 모델은 2개다.
- 새 도서 폼은 제목·영문 제목·연도·분류(`문학`)·출처가 미리 채워져 바로 제출된다.
- 작업 전 기준(2026-09-28, 이 브랜치 머리에서 `npm ci`·빌드 뒤): 통과 `npm test`, `leave-guard`, `home-admin`, `model-thumbnails`, `catalog`, `mobile-entry`, `about`. 실패 `floor-editor.mjs:10`(클릭 20초 초과), `collision.mjs:10`(체크 해제 30초 초과), `browser.mjs:61`(`toBeVisible` 요소 없음), `workspace.mjs:39`(클릭 20초 초과), `admin-parity.mjs:17`(클릭 20초 초과), `floor-reading.mjs`(카메라 거리 31.64, 기대 39.17 초과). 모두 옛 관리자 첫 화면이나 카메라 값 문제다. Git Bash 에서 검사가 종료 코드 127 로 끝나면 메모리 부족에 따른 fork 실패이니 PowerShell 로 다시 실행한다.

## Global Constraints

- 기준 스택: 현재 admin 의 Vite 멀티 페이지 + 바닐라 JS. React, TypeScript, 새 npm 의존성을 추가하지 않는다.
- 바꾸지 않는 것: `client/**`, `shared/**`, `server/**` 중 `server/index.js` 의 미들웨어 한 개 외 전부, `client/vercel.json`, `vite.config.js`, API, 스키마, 저장 데이터 구조, 쓰지 않는 옛 편집 화면 코드(`booksView`, `bindBooks`, `inspectorView`, `makePreview`, `addPlacement`, `previewClient`).
- 경로: `/admin/`(도서 보관함), `/admin/home`, `/admin/models`, `/admin/settings`, `/admin/books/:bookId`(월드 편집기, `encodeURIComponent`). 끝 빗금 주소도 같은 화면으로 읽고 빗금 없는 주소로 고친다.
- 쿼리와 순서: 도서 보관함 `q, status, modal`, 모델 보관함 `q, modal, id`, 홈 화면 `modal`, 공개 및 안내 없음, 월드 편집기 `chapter, object, mode, q, modal, id`. `status` 는 `draft`·`public`, `mode` 는 `reader`. 기본값은 쓰지 않는다.
- `modal` 값: `new-book`(도서 보관함), `book`(편집기), `chapter`+`id`(편집기), `new-model`(모델 보관함·편집기), `model`+`id`(모델 보관함·편집기), `model-preview`+`id`(모델 보관함), `home-preview`(홈 화면). `mode=reader` 와 함께 오면 `modal` 을 버린다.
- 알림 문구(스펙 5절 그대로): "요청한 도서를 찾을 수 없어 도서 보관함을 열었어요.", "요청한 챕터를 찾을 수 없어 첫 챕터를 열었어요.", "요청한 오브젝트를 찾을 수 없어 선택하지 않았어요.", "요청한 항목을 찾을 수 없어 창을 열지 않았어요." 한 번에 하나, 책 → 챕터 → 오브젝트 → 대상 순.
- 기록 규칙: push 는 탭 이동, 로고, 표지로 편집기 열기, **← 도서 보관함**, 대화상자 열기. 나머지는 replace. 검색어는 250ms, 스크롤은 150ms 멈춘 뒤 쓴다. 대화상자 닫기의 `history.back()` 은 1초 안에 `popstate` 가 없으면 주소에서 `modal`·`id` 를 지우는 것으로 대신한다.
- 주소 밖 저장: 스크롤 `history.state.scroll`(`history.scrollRestoration = "manual"`), 대화상자 항목 표시 `history.state.modalEntry`, 패널 접힘 `localStorage` 키 `otb-studio-panels` 값 `{ "assets"|"tiles"|"chapters"|"chapter-models"|"inspector": boolean }`(`true` 가 펼침).
- 포트: `tests/admin-routes.mjs` 4353(실행 기록 2026-09-29: 계획은 4351 이었으나 main 의 `tests/still-model.mjs` 가 그 포트를 써서 병합 때 옮겼다. 아래 Task 코드 블록의 4351 은 실행 당시 기록이다), 임시 개발 서버 확인 4352. 임시 스크립트는 gitignore 된 `test-results/` 에 두고 커밋하지 않는다.
- 브라우저 검사는 `channel: "msedge"`, `headless: true`. 명령은 워크트리 루트에서 실행한다.
- 커밋 메시지는 영어 명령형 한 줄 + 필요하면 본문, 마지막 줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 회귀 검사가 다시 쓰는 `docs/screenshots/*`, `docs/floor-evidence/*`, `docs/improvement-evidence/*`, `docs/preview/*`, `docs/browser-results.json`, `docs/portal-results.json` 은 `git restore` 로 되돌린다.
- 문체: README·관리자 안내·배포 안내는 "~합니다", 스펙·계획은 "~다". 코드 주석은 영어, 화면 문구는 한국어. 주변 코드처럼 짧은 한 줄 함수와 기존 들여쓰기를 따른다.

---

## 파일 구조

```
admin/route.js               새 파일. parseRoute·routeHref·resolveRoute·notices. DOM·history 없음
admin/main.js                수정. 주소 ↔ 상태, 이동·기록, 대화상자 기록, 독자 체험 상태, 스크롤
admin/workspace.js           수정. 패널 검색어 초기값·훅, 기본 장식 선택 복원, 패널 접힘 저장, openReader·reader 훅
admin/viewport-tools.js      수정. inlineReader 의 챕터 변경 콜백
admin/index.html             수정. 스크립트 경로 /admin/main.js
admin/vercel.json            수정. 깊은 경로 rewrite 네 개
server/index.js              수정. 깊은 경로를 /admin/index.html 로 넘기는 미들웨어
tests/admin-route.test.js    새 파일. route.js 단위 검사(npm test 에 자동 포함)
tests/admin-routes.mjs       새 파일. 깊은 경로 제공과 브라우저 흐름 검사(4351)
tests/workspace.mjs          수정. 94번 줄 reload → goto('/admin/')
tests/floor-reading.mjs      수정. 86번 줄 reload → goto('/admin/')
README.md, docs/ADMIN-GUIDE.md, docs/DEPLOYMENT.md,
docs/superpowers/specs/2026-09-11-react-next-migration-design.md   수정. 스펙 8절
```

한 파일의 책임
- `route.js`: 주소 문자열과 경로 객체 사이의 변환, 데이터 기준 보정. `main.js` 만 쓴다.
- `main.js`: 상태 ↔ 주소 동기화와 방문 기록 조작. 주소 규칙은 `route.js` 에만 둔다.
- `workspace.js`: 편집기 안의 상태(패널 검색어, 선택, 독자 체험, 패널 접힘)를 훅으로 알리고 초기값을 받는다. 주소를 직접 만지지 않는다.

---

### Task 1: 주소 규칙 모듈 `admin/route.js`

**Files:**
- Create: `admin/route.js`
- Test: `tests/admin-route.test.js`

**Interfaces:**
- Produces:
  - `parseRoute(pathname: string, search = "") → Route`. `Route` 는 `{ view, bookId?, chapterId?, objectId?, reader?, q?, status?, modal?, modalId? }`, `view` 는 `"books"|"home"|"models"|"settings"|"editor"`. 값이 없는 필드는 키 자체가 없다(`reader` 는 `true` 일 때만).
  - `routeHref(route: Route) → string`. 예: `"/admin/books/alice?chapter=alice-1&mode=reader"`.
  - `resolveRoute(route: Route, library) → { route: Route, notice: string | null }`.
  - `notices: { book, chapter, object, item }` 알림 문구.

- [ ] **Step 1: 의존성 설치와 기준 확인**

Run: `npm ci --no-audit --no-fund`
Expected: `added 134 packages` 비슷한 한 줄.

Run: `npm test`
Expected: 모든 검사 통과(`# fail 0`).

- [ ] **Step 2: 실패하는 단위 검사 작성**

`tests/admin-route.test.js` 를 새로 만든다.

```js
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
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/admin-route.test.js`
Expected: 실패. `Cannot find module '…/admin/route.js'`(ERR_MODULE_NOT_FOUND).

- [ ] **Step 4: `admin/route.js` 작성**

```js
// The studio's address: the path names the page, the query what is open on it.
// Pure functions with no DOM, history or storage access, so `node --test` can load them.

const tabs = ["home", "models", "settings"];
// Dialogs each page can name in `modal`; those in `targeted` also need an `id`.
const dialogs = {
  books: ["new-book"],
  home: ["home-preview"],
  models: ["new-model", "model", "model-preview"],
  settings: [],
  editor: ["book", "chapter", "new-model", "model"],
};
const targeted = ["chapter", "model", "model-preview"];
// Query parameters each page writes, in address order.
const order = {
  books: ["q", "status", "modal"],
  home: ["modal"],
  models: ["q", "modal", "id"],
  settings: [],
  editor: ["chapter", "object", "mode", "q", "modal", "id"],
};
export const notices = {
  book: "요청한 도서를 찾을 수 없어 도서 보관함을 열었어요.",
  chapter: "요청한 챕터를 찾을 수 없어 첫 챕터를 열었어요.",
  object: "요청한 오브젝트를 찾을 수 없어 선택하지 않았어요.",
  item: "요청한 항목을 찾을 수 없어 창을 열지 않았어요.",
};

const decode = (text) => {
  try { return decodeURIComponent(text); } catch { return text; }
};
// Keeps only the fields that say something, so equal places compare equal.
const compact = (route) => Object.fromEntries(Object.entries(route).filter(([, value]) => value != null && value !== "" && value !== false));

export function parseRoute(pathname, search = "") {
  const params = new URLSearchParams(search);
  const path = pathname.replace(/\/+$/, "");
  const book = path.match(/^\/admin\/books\/([^/]+)$/)?.[1];
  const tab = path.match(/^\/admin\/([^/]+)$/)?.[1];
  const view = book ? "editor" : tabs.includes(tab) ? tab : "books";
  const route = { view };
  if (book) Object.assign(route, { bookId: decode(book), chapterId: params.get("chapter"), objectId: params.get("object"), reader: params.get("mode") === "reader" });
  if (order[view].includes("q")) route.q = params.get("q");
  if (view === "books" && ["draft", "public"].includes(params.get("status"))) route.status = params.get("status");
  const modal = params.get("modal"), id = params.get("id");
  if (dialogs[view].includes(modal) && !route.reader && (!targeted.includes(modal) || id))
    Object.assign(route, { modal, modalId: targeted.includes(modal) ? id : undefined });
  return compact(route);
}

export function routeHref(route) {
  const path = route.view === "editor" ? `/admin/books/${encodeURIComponent(route.bookId)}` : route.view === "books" ? "/admin/" : `/admin/${route.view}`;
  const values = { q: route.q, status: route.status, chapter: route.chapterId, object: route.objectId, mode: route.reader ? "reader" : "", modal: route.modal, id: route.modalId };
  const params = new URLSearchParams();
  for (const name of order[route.view]) if (values[name]) params.set(name, values[name]);
  const query = String(params);
  return query ? `${path}?${query}` : path;
}

// Floor images count as objects: the chapter's stored ones, or else the defaults it draws, whose ids
// follow the placement order (shared/landscape.js defaultDecals).
const objectIds = (chapter) => [
  ...chapter.placements.map((p) => p.id),
  ...(chapter.floorDecals ? chapter.floorDecals.map((d) => d.id) : chapter.floorDecor === "none" ? [] : chapter.placements.map((_, i) => `decor-${i}`)),
];

export function resolveRoute(route, library) {
  const next = { ...route };
  let notice = null;
  const miss = (key) => { notice ??= notices[key]; };
  const dropDialog = () => { delete next.modal; delete next.modalId; miss("item"); };
  if (next.view === "editor") {
    const book = library.books.find((b) => b.id === next.bookId);
    if (!book?.chapters.length) return { route: { view: "books" }, notice: notices.book };
    let chapter = book.chapters.find((c) => c.id === next.chapterId);
    if (!chapter) {
      if (next.chapterId) miss("chapter");
      chapter = book.chapters[0];
      next.chapterId = chapter.id;
    }
    if (next.objectId && !objectIds(chapter).includes(next.objectId)) { delete next.objectId; miss("object"); }
    if (next.modal === "chapter" && !book.chapters.some((c) => c.id === next.modalId)) dropDialog();
  }
  if ((next.modal === "model" || next.modal === "model-preview") && !library.models.some((m) => m.id === next.modalId)) dropDialog();
  return { route: next, notice };
}
```

- [ ] **Step 5: 통과 확인**

Run: `node --test tests/admin-route.test.js`
Expected: 6개 모두 통과(`# pass 6`, `# fail 0`).

Run: `npm test`
Expected: 기존 검사와 함께 모두 통과.

- [ ] **Step 6: 커밋**

```bash
git add admin/route.js tests/admin-route.test.js
git commit -m "Read and write the studio address in admin/route.js" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 깊은 경로 제공 (서버·Vercel·HTML)

**Files:**
- Modify: `admin/index.html:14`
- Modify: `server/index.js:287` 다음(`app.get("/about", …)` 와 `if (!cloud && process.argv.includes("--production"))` 사이)
- Modify: `admin/vercel.json` rewrites
- Create: `tests/admin-routes.mjs`

**Interfaces:**
- Produces: 로컬 서버(개발·완성본)가 `^/admin/(?:home|models|settings|books/[^/]+)/?$` GET·HEAD 에 관리자 HTML 을 준다. `tests/admin-routes.mjs` 는 이후 Task 가 브라우저 검사를 덧붙이는 파일이다.

- [ ] **Step 1: 실패하는 검사 작성**

`tests/admin-routes.mjs` 를 새로 만든다.

```js
import { expect } from "@playwright/test";
import { startServer } from "./helpers.js";

// The studio's address. The server hands out the studio page at its deep paths.
const password = "test-only-password";
const server = await startServer(4351, password);
const pass = (message) => console.log(`PASS ${message}`);
try {
  for (const path of ["/admin/home", "/admin/models", "/admin/settings/", "/admin/books/alice", "/admin/books/alice/"]) {
    const response = await fetch(server.url + path);
    expect(response.status, path).toBe(200);
    expect(await response.text(), path).toContain('<div id="app"></div>');
  }
  for (const path of ["/admin/zzz", "/admin/books/", "/admin/books/alice/edit"])
    expect((await fetch(server.url + path)).status, path).toBe(404);
  pass("Deep studio paths serve the studio page and unknown ones stay 404");
} finally {
  await server.stop();
}
```

- [ ] **Step 2: 실패 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: 실패. `/admin/home` 에서 `Expected: 200`, `Received: 404`.

- [ ] **Step 3: 스크립트 경로를 절대 경로로**

`admin/index.html` 에서

```html
    <script type="module" src="./main.js"></script>
```

를 다음으로 바꾼다.

```html
    <script type="module" src="/admin/main.js"></script>
```

- [ ] **Step 4: 서버 미들웨어 추가**

`server/index.js` 에서

```js
app.get("/about", (req, res) => res.redirect("/client/about/"));
```

바로 다음 줄에 넣는다.

```js
// The studio is one page: its deep addresses (/admin/models, /admin/books/:id) all get admin/index.html.
const studioPage = /^\/admin\/(?:home|models|settings|books\/[^/]+)\/?$/;
app.use((req, res, next) => {
  if ((req.method === "GET" || req.method === "HEAD") && studioPage.test(req.path)) req.url = "/admin/index.html";
  next();
});
```

- [ ] **Step 5: Vercel rewrite 추가**

`admin/vercel.json` 의 `"rewrites"` 에서

```json
    { "source": "/admin/", "destination": "/admin/index.html" },
```

바로 다음에 네 줄을 넣는다.

```json
    { "source": "/admin/:section(home|models|settings)", "destination": "/admin/index.html" },
    { "source": "/admin/:section(home|models|settings)/", "destination": "/admin/index.html" },
    { "source": "/admin/books/:bookId", "destination": "/admin/index.html" },
    { "source": "/admin/books/:bookId/", "destination": "/admin/index.html" },
```

Run: `node -e "JSON.parse(require('fs').readFileSync('admin/vercel.json','utf8'));console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: 완성본 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: `PASS Deep studio paths serve the studio page and unknown ones stay 404`

- [ ] **Step 7: 개발 서버 확인(커밋하지 않는 임시 스크립트)**

`test-results/dev-deep-path.mjs` 를 만든다.

```js
// One-off check of the development server's deep studio paths (not committed).
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
const child = spawn(process.execPath, ["server/index.js"], { env: { ...process.env, DATA_DIR: dir, PORT: "4352", ADMIN_PASSWORD: "" }, stdio: "ignore", windowsHide: true });
const url = "http://127.0.0.1:4352";
for (let i = 0; i < 150; i++) { try { if ((await fetch(url + "/api/library")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
const html = await (await fetch(url + "/admin/books/alice")).text();
console.log((await fetch(url + "/admin/models")).status, html.includes('src="/admin/main.js"'), (await fetch(url + "/admin/main.js")).status, (await fetch(url + "/admin/zzz")).status);
child.kill();
await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)));
await rm(dir, { recursive: true, force: true });
```

Run: `node test-results/dev-deep-path.mjs`
Expected: `200 true 200 404`

- [ ] **Step 8: 커밋**

```bash
git add admin/index.html server/index.js admin/vercel.json tests/admin-routes.mjs
git commit -m "Serve the studio at its deep paths" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 페이지와 편집기 위치를 주소에 담기

탭, 도서 보관함 검색·필터, 모델 검색, 편집기의 책·챕터·선택·패널 검색어를 주소와 잇는다. 뒤로·앞으로 가기와 편집기를 떠날 때의 나가기 확인, 잘못된 주소 알림도 이 Task 에서 한다. 대화상자는 Task 4, 독자 체험·패널 접힘은 Task 5, 스크롤은 Task 6 이다.

**Files:**
- Modify: `admin/main.js`
- Modify: `admin/workspace.js:32`, `:39`, `:107`, `:158`
- Test: `tests/admin-routes.mjs`

**Interfaces:**
- Consumes: `parseRoute`, `routeHref`, `resolveRoute` (Task 1).
- Produces (`admin/main.js` 안):
  - 상태 `shelfQuery`, `shelfStatus`, `assetQuery`, `shelfReturn = { q, status }`, `applying`, `urlTimer`.
  - `currentRoute() → Route`, `syncUrl()`, `syncUrlSoon()`, `navigate(change: () => void)`, `applyRoute(route)`, `openAddress()`.
  - `render()` 는 `draw()`(기존 본문)를 부른 뒤 대기 중인 검색어 쓰기가 없으면 `syncUrl()` 한다.
- Produces (`admin/workspace.js`): `mountWorkspace(app, { …, assetQuery = "", hooks })`, 훅 `hooks.search(q)`.

- [ ] **Step 1: 실패하는 브라우저 검사 작성**

`tests/admin-routes.mjs` 전체를 다음으로 바꾼다.

```js
import { chromium, expect } from "@playwright/test";
import { startServer } from "./helpers.js";

// The studio's address. The server hands out the studio page at its deep paths, and every page, selection
// and dialog survives a reload, a direct address and the browser's back and forward buttons.
const password = "test-only-password";
const server = await startServer(4351, password);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
context.setDefaultTimeout(20000);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const pass = (message) => console.log(`PASS ${message}`);
// An absolute address with its query written the way the studio writes it.
const at = (path, query) => server.url + path + (query ? `?${new URLSearchParams(query)}` : "");
const entries = () => page.evaluate(() => history.length);
try {
  for (const path of ["/admin/home", "/admin/models", "/admin/settings/", "/admin/books/alice", "/admin/books/alice/"]) {
    const response = await fetch(server.url + path);
    expect(response.status, path).toBe(200);
    expect(await response.text(), path).toContain('<div id="app"></div>');
  }
  for (const path of ["/admin/zzz", "/admin/books/", "/admin/books/alice/edit"])
    expect((await fetch(server.url + path)).status, path).toBe(404);
  pass("Deep studio paths serve the studio page and unknown ones stay 404");

  await page.goto(at("/admin/books/alice", { chapter: "alice-2" }));
  await page.getByLabel("관리자 비밀번호").fill(password);
  await page.getByRole("button", { name: /스튜디오 들어가기/ }).click();
  await expect(page.locator("#studio-world canvas")).toBeVisible();
  await expect(page.locator('[data-chapter-row="alice-2"]')).toHaveClass(/active/);
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-2" }));
  pass("A deep address waits through the login screen");

  await page.locator("#back-library").click();
  await expect(page.locator(".book-shelf")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/"));
  for (const [name, path, ready] of [["home", "/admin/home", ".home-slides"], ["models", "/admin/models", ".model-grid"], ["settings", "/admin/settings", "#export"]]) {
    await page.locator(`[data-tab="${name}"]`).click();
    await expect(page).toHaveURL(at(path));
    await page.reload();
    await expect(page.locator(ready)).toBeVisible();
    await expect(page.locator(`[data-tab="${name}"]`)).toHaveClass(/active/);
  }
  const tabEntries = await entries();
  await page.locator('[data-tab="settings"]').click();
  expect(await entries()).toBe(tabEntries);
  await page.goBack();
  await expect(page.locator(".model-grid")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/models"));
  await page.goBack();
  await expect(page.locator(".home-slides")).toBeVisible();
  await page.goForward();
  await expect(page.locator(".model-grid")).toBeVisible();
  await page.goto(at("/admin/settings/"));
  await expect(page.locator("#export")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/settings"));
  pass("Each tab has its own path, stays put on reload and follows back and forward");

  await page.locator('[data-tab="books"]').click();
  await page.locator("#book-search").fill("앨리스");
  await expect(page).toHaveURL(at("/admin/", { q: "앨리스" }));
  await page.locator("#book-filter").selectOption("public");
  await expect(page).toHaveURL(at("/admin/", { q: "앨리스", status: "public" }));
  await page.reload();
  await expect(page.locator("#book-search")).toHaveValue("앨리스");
  await expect(page.locator("#book-filter")).toHaveValue("public");
  await expect(page.locator(".book-tile-row:not([hidden])")).toHaveCount(1);
  await page.locator('[data-tab="models"]').click();
  await page.locator("#model-search").fill("토끼");
  await expect(page).toHaveURL(at("/admin/models", { q: "토끼" }));
  await page.reload();
  await expect(page.locator("#model-search")).toHaveValue("토끼");
  await expect(page.locator(".model-card")).toHaveCount(2);
  await page.goBack();
  await expect(page.locator("#book-search")).toHaveValue("앨리스");
  await expect(page.locator(".book-tile-row:not([hidden])")).toHaveCount(1);
  await page.locator("#book-search").fill("");
  await page.locator("#book-filter").selectOption("all");
  await expect(page).toHaveURL(at("/admin/"));
  pass("The shelf search and state filter and the model search live in the query");

  await page.locator('[data-open-book="alice"]').click();
  await expect(page.locator("#studio-world canvas")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  const editorEntries = await entries();
  await page.locator('[data-chapter="alice-2"]').click();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-2" }));
  const object = await page.locator("#chapter-model-list [data-select-model]").first().getAttribute("data-select-model");
  await page.locator(`#chapter-model-list [data-select-model="${object}"]`).click();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-2", object }));
  await page.locator("#asset-search").fill("토끼");
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-2", object, q: "토끼" }));
  expect(await entries()).toBe(editorEntries);
  await page.reload();
  await expect(page.locator('[data-chapter-row="alice-2"]')).toHaveClass(/active/);
  await expect(page.locator(`#chapter-model-list [data-select-model="${object}"]`)).toHaveClass(/active/);
  await expect(page.locator("#object-form")).toBeVisible();
  await expect(page.locator("#asset-search")).toHaveValue("토끼");
  await expect(page.locator(".asset-tile:not([hidden])")).toHaveCount(2);
  await page.goto(at("/admin/books/oz", { chapter: "oz-2" }));
  await expect(page.locator('[data-chapter-row="oz-2"]')).toHaveClass(/active/);
  await expect(page.locator("#asset-search")).toHaveValue("");
  await page.goBack();
  await expect(page.locator(`#chapter-model-list [data-select-model="${object}"]`)).toHaveClass(/active/);
  await page.locator("#back-library").click();
  await expect(page).toHaveURL(at("/admin/"));
  pass("The editor keeps its book, chapter, selection and model search in the address");

  await page.goto(at("/admin/books/nope", { chapter: "x", modal: "book" }));
  await expect(page.locator(".book-shelf")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/"));
  await expect(page.locator("#toast")).toHaveText("요청한 도서를 찾을 수 없어 도서 보관함을 열었어요.");
  await page.goto(at("/admin/books/alice", { chapter: "nope" }));
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  await expect(page.locator("#toast")).toHaveText("요청한 챕터를 찾을 수 없어 첫 챕터를 열었어요.");
  await page.goto(at("/admin/books/alice", { chapter: "alice-1", object: "nope" }));
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  await expect(page.locator("#toast")).toHaveText("요청한 오브젝트를 찾을 수 없어 선택하지 않았어요.");
  await page.goto(at("/admin/books/alice", { chapter: "alice-1", object: "decor-0" }));
  await expect(page.locator("#delete-floor-object")).toBeVisible();
  await page.goto(at("/admin/", { status: "xyz", modal: "bogus", foo: "1" }));
  await expect(page.locator(".book-shelf")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/"));
  pass("Unknown books, chapters and objects fall back with a notice and stray parameters drop out");

  await page.locator('[data-open-book="alice"]').click();
  await page.locator("#chapter-model-list [data-select-model]").first().click();
  await page.locator('#object-form [name="title"]').fill("저장하지 않은 이름");
  await page.locator('#object-form [name="title"]').press("Tab");
  const editorUrl = page.url();
  await page.goBack();
  await expect(page.locator(".leave-editor-dialog")).toBeVisible();
  await expect(page).toHaveURL(editorUrl);
  await page.getByRole("button", { name: "계속 편집", exact: true }).click();
  await expect(page.locator(".leave-editor-dialog")).toHaveCount(0);
  await expect(page.locator("#studio-world canvas")).toBeVisible();
  await page.goBack();
  await page.getByRole("button", { name: "저장하지 않고 나가기", exact: true }).click();
  await expect(page.locator(".book-shelf")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/"));
  pass("Back out of an editor with unsaved changes asks first and keeps the editor's address while asking");

  expect(errors).toEqual([]);
} finally {
  await browser.close();
  await server.stop();
}
```

- [ ] **Step 2: 실패 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: 깊은 경로 PASS 뒤 실패. 로그인 뒤 `#studio-world canvas` 를 기다리다 시간 초과(지금은 주소와 상관없이 로그인 뒤 도서 보관함이 열린다).

- [ ] **Step 3: `route.js` 가져오기와 상태 추가**

`admin/main.js` 1번 줄 다음에 넣는다.

```js
import { parseRoute, resolveRoute, routeHref } from "./route.js";
```

31번 줄

```js
let workspace=null, inEditor=false, baseline=null, savedLibrary=null, leaveDialog=null, undoStack=[], redoStack=[];
```

바로 다음 줄에 넣는다.

```js
// Shelf filters and the editor's model search live here so redraws keep them; the address mirrors them (admin/route.js).
let shelfQuery="", shelfStatus="", assetQuery="", shelfReturn={q:"",status:""}, applying=false, urlTimer=null;
```

- [ ] **Step 4: 나가기 확인의 기본 이동을 기록 이동으로**

```js
  const leave = destination || (() => { inEditor=false; placementId=null; render(); });
```

를 다음으로 바꾼다.

```js
  const leave = destination || (() => navigate(() => { inEditor=false; placementId=null; shelfQuery=shelfReturn.q; shelfStatus=shelfReturn.status; }));
```

- [ ] **Step 5: 주소 블록 추가와 `render` 나누기**

```js
function render() {
  disposeModelThumbnails?.(); disposeModelThumbnails=null;
```

를 다음으로 바꾼다(아래 `function draw()` 의 나머지 본문은 기존 `render` 본문 그대로다).

```js
// ---- The address (admin/route.js): the path names the page, the query what is open on it. ----
function currentRoute() {
  if (tab === "books" && inEditor && book() && chapter())
    return { view: "editor", bookId, chapterId, objectId: placementId || undefined, q: assetQuery || undefined };
  if (tab === "books") return { view: "books", q: shelfQuery || undefined, status: shelfStatus || undefined };
  return tab === "models" ? { view: "models", q: query || undefined } : { view: tab };
}
// Writes the current place into this history entry's address.
function syncUrl() {
  clearTimeout(urlTimer); urlTimer = null;
  if (applying) return;
  const href = routeHref(currentRoute());
  if (href !== location.pathname + location.search) history.replaceState(history.state, "", href);
}
// Typing writes the address once it pauses: Safari limits how often replaceState may run.
function syncUrlSoon() { clearTimeout(urlTimer); urlTimer = setTimeout(syncUrl, 250); }
// A page move: the entry being left gets its latest address, then a new entry is pushed and drawn.
function navigate(change) {
  if (urlTimer) syncUrl();
  change();
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  history.pushState({}, "", routeHref(currentRoute()));
  render();
}
// Shows the place an address names, on load and when the browser moves through history.
function applyRoute(route) {
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  const entering = route.view === "editor" && !(inEditor && bookId === route.bookId);
  tab = route.view === "editor" ? "books" : route.view;
  inEditor = route.view === "editor";
  if (entering) { undoStack = []; redoStack = []; baseline = structuredClone(library); }
  if (inEditor) { bookId = route.bookId; chapterId = route.chapterId; placementId = route.objectId ?? null; assetQuery = route.q ?? ""; }
  else placementId = null;
  if (route.view === "books") { shelfQuery = route.q ?? ""; shelfStatus = route.status ?? ""; }
  if (route.view === "models") query = route.q ?? "";
  applying = true;
  try { render(); } finally { applying = false; }
  syncUrl();
}
function openAddress() {
  const { route, notice } = resolveRoute(parseRoute(location.pathname, location.search), library);
  applyRoute(route);
  if (notice) toast(notice);
}
function render() {
  draw();
  if (!urlTimer) syncUrl();
}
function draw() {
  disposeModelThumbnails?.(); disposeModelThumbnails=null;
```

- [ ] **Step 6: 편집기 훅에서 주소 고치기**

`draw()` 안의 `mountWorkspace` 호출에서

```js
    workspace=mountWorkspace(app,{book:book(),chapter:chapter(),models:library.models,selectedId:placementId,hooks:{
      select:id=>placementId=id,change:mark,back:()=>requestLeaveEditor(),editBook:()=>editBook(),editChapter,addChapter,
```

를 다음으로 바꾼다.

```js
    workspace=mountWorkspace(app,{book:book(),chapter:chapter(),models:library.models,selectedId:placementId,assetQuery,hooks:{
      select:id=>{placementId=id;syncUrl();},change:mark,back:()=>requestLeaveEditor(),editBook:()=>editBook(),editChapter,addChapter,search:q=>{assetQuery=q;syncUrlSoon();},
```

```js
      chapter:id=>{chapterId=id;placementId=null;},undo:()=>historyMove('undo'),redo:()=>historyMove('redo'),canUndo:undoStack.length,canRedo:redoStack.length
```

를 다음으로 바꾼다.

```js
      chapter:id=>{chapterId=id;placementId=null;syncUrl();},undo:()=>historyMove('undo'),redo:()=>historyMove('redo'),canUndo:undoStack.length,canRedo:redoStack.length
```

- [ ] **Step 7: 탭과 로고를 기록 이동으로**

```js
  for (const b of document.querySelectorAll("[data-tab]"))
    b.onclick = () => {
      tab = b.dataset.tab;
      render();
    };
```

를 다음으로 바꾼다.

```js
  for (const b of document.querySelectorAll("[data-tab]"))
    b.onclick = () => { if (b.dataset.tab !== tab) navigate(() => { tab = b.dataset.tab; }); };
  // The logo moves within the studio like the 도서 보관함 tab; modified clicks keep the browser's own handling.
  document.querySelector(".studio-sidebar .brand").onclick = (e) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (tab !== "books") navigate(() => { tab = "books"; });
  };
```

- [ ] **Step 8: 도서 보관함 표지·검색·필터**

```js
    document.querySelectorAll('[data-open-book]').forEach(button=>button.onclick=()=>{bookId=button.dataset.openBook;chapterId=book().chapters[0]?.id;placementId=null;inEditor=true;undoStack=[];redoStack=[];baseline=structuredClone(library);render();});
    const filter=()=>{const query=document.querySelector('#book-search').value.toLowerCase(),state=document.querySelector('#book-filter').value;let count=0;
```

를 다음으로 바꾼다.

```js
    document.querySelectorAll('[data-open-book]').forEach(button=>button.onclick=()=>{shelfReturn={q:shelfQuery,status:shelfStatus};navigate(()=>{bookId=button.dataset.openBook;chapterId=book().chapters[0]?.id;placementId=null;assetQuery="";inEditor=true;undoStack=[];redoStack=[];baseline=structuredClone(library);});});
    const filter=()=>{const query=shelfQuery.toLowerCase(),state=shelfStatus||'all';let count=0;
```

```js
    document.querySelector('#book-search').oninput=filter;document.querySelector('#book-filter').onchange=filter;filter();
```

를 다음으로 바꾼다.

```js
    const search=document.querySelector('#book-search'),status=document.querySelector('#book-filter');search.value=shelfQuery;status.value=shelfStatus||'all';
    search.oninput=()=>{shelfQuery=search.value;filter();syncUrlSoon();};status.onchange=()=>{shelfStatus=status.value==='all'?'':status.value;filter();syncUrl();};filter();
```

- [ ] **Step 9: 새 도서는 편집기로 기록 이동**

`editBook` 제출 처리에서

```js
    if (isNew) {library.books.push(original);inEditor=true;}
    bookId = original.id;
    chapterId = original.chapters[0].id;
    placementId = original.chapters[0].placements[0]?.id;
    mark();
    d.close();
    render();
  };
```

를 다음으로 바꾼다.

```js
    if (isNew) {library.books.push(original);shelfReturn={q:shelfQuery,status:shelfStatus};}
    bookId = original.id;
    chapterId = original.chapters[0].id;
    placementId = original.chapters[0].placements[0]?.id;
    mark();
    d.close();
    if (isNew) navigate(() => { inEditor = true; assetQuery = ""; });
    else render();
  };
```

- [ ] **Step 10: 모델 검색어는 멈춘 뒤 주소에**

`bindModels` 에서

```js
    query = e.target.value;
    const pos = e.target.selectionStart;
    render();
```

를 다음으로 바꾼다.

```js
    query = e.target.value;
    const pos = e.target.selectionStart;
    syncUrlSoon();
    render();
```

- [ ] **Step 11: 불러오기와 뒤로·앞으로 가기**

`load()` 에서

```js
    bookId = library.books[0]?.id;
    chapterId = book()?.chapters[0]?.id;
    placementId = chapter()?.placements[0]?.id;
    render();
```

를 다음으로 바꾼다.

```js
    openAddress();
```

`beforeunload` 리스너 블록

```js
window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
```

바로 다음에 넣는다.

```js
window.addEventListener("popstate", () => {
  if (!library) return; // the login and loading screens read the address themselves once the studio loads
  const { route, notice } = resolveRoute(parseRoute(location.pathname, location.search), library);
  const current = currentRoute();
  if (current.view === "editor" && !(route.view === "editor" && route.bookId === current.bookId) && (leaveDialog || busy || hasUnsavedChanges())) {
    // Keep the editor's address while the leave dialog decides; leaving then steps back to where the browser was going.
    history.pushState({}, "", routeHref(current));
    if (!leaveDialog) requestLeaveEditor(() => history.back());
    return;
  }
  applyRoute(route);
  if (notice) toast(notice);
});
```

- [ ] **Step 12: 편집기의 패널 검색어와 기본 장식 선택**

`admin/workspace.js` 32번 줄

```js
export function mountWorkspace(app, {book,chapter,models,selectedId,hooks}) {
```

를 다음으로 바꾼다.

```js
export function mountWorkspace(app, {book,chapter,models,selectedId,assetQuery='',hooks}) {
```

39번 줄 안의

```js
<input id="asset-search" placeholder="모델 검색" aria-label="모델 검색">
```

를 다음으로 바꾼다.

```js
<input id="asset-search" placeholder="모델 검색" aria-label="모델 검색" value="${esc(assetQuery)}">
```

107번 줄

```js
 el('asset-search').oninput=e=>app.querySelectorAll('[data-model]').forEach(c=>c.hidden=!c.dataset.name.includes(e.target.value.toLowerCase()));
```

를 다음으로 바꾼다.

```js
 const filterAssets=q=>app.querySelectorAll('[data-model]').forEach(c=>c.hidden=!c.dataset.name.includes(q.toLowerCase()));
 el('asset-search').oninput=e=>{filterAssets(e.target.value);hooks.search?.(e.target.value);};filterAssets(assetQuery);
```

158~159번 줄

```js
 selectObject(selected);
 const disposeThumbnails=thumbnails(app,models);
```

를 다음으로 바꾼다.

```js
 // A restored address may name a default floor image, which exists once the chapter's decals are materialized (as a click does).
 if(selected&&!current()&&!chapter.floorDecals&&defaultDecals(chapter).some(d=>d.id===selected))chapter.floorDecals=defaultDecals(chapter);
 selectObject(selected);
 const disposeThumbnails=thumbnails(app,models);
```

- [ ] **Step 13: 통과 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: PASS 7줄(깊은 경로, 로그인, 탭, 검색, 편집기, 잘못된 주소, 나가기 확인), 오류 없이 종료.

Run: `npm test`
Expected: 모두 통과.

- [ ] **Step 14: 커밋**

```bash
git add admin/main.js admin/workspace.js tests/admin-routes.mjs
git commit -m "Keep the studio's page, editor place and searches in the address" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 대화상자를 주소와 방문 기록에 담기

**Files:**
- Modify: `admin/main.js`
- Test: `tests/admin-routes.mjs`

**Interfaces:**
- Consumes: Task 3 의 `currentRoute`, `syncUrl`, `syncUrlSoon`, `navigate`, `applyRoute`, `openAddress`, 상태 변수.
- Produces (`admin/main.js` 안):
  - 상태 `routeModal = { modal, modalId } | null`, `backPending = { done: Promise, resolve, timer } | null`.
  - `writeHistory(write: () => void)`, `stepBack()`, `settleBack(timedOut: boolean)`, `closeDialogs()`.
  - `routeDialog(dialog, modal: string, modalId?: string, push = !applying)`, `openRouteDialog(route)`, `syncDialog(route)`.
  - `previewHome(saveFirst = true)`, `openPreview(query, heading, note, saveFirst = true)`.

- [ ] **Step 1: 실패하는 브라우저 검사 작성**

`tests/admin-routes.mjs` 의 `  expect(errors).toEqual([]);` 줄 바로 앞에 넣는다.

```js
  await page.locator('[data-open-book="alice"]').click();
  await page.evaluate(() => { window.__canvas = document.querySelector("#studio-world canvas"); });
  await page.locator("#edit-book").click();
  await expect(page.locator("#book-form")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1", modal: "book" }));
  await page.goBack();
  await expect(page.locator("#book-form")).toHaveCount(0);
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  expect(await page.evaluate(() => document.querySelector("#studio-world canvas") === window.__canvas)).toBe(true);
  await page.goForward();
  await expect(page.locator("#book-form")).toBeVisible();
  await page.reload();
  await expect(page.locator("#book-form")).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  await page.goBack();
  await expect(page.locator(".book-shelf")).toBeVisible();
  pass("A dialog gets its own entry: back closes it without rebuilding the editor, and a reloaded one steps back on close");

  await page.locator('[data-open-book="alice"]').click();
  await page.locator('[data-chapter-edit="alice-2"]').click();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1", modal: "chapter", id: "alice-2" }));
  await page.reload();
  await expect(page.locator("dialog .eyebrow")).toHaveText("CHAPTER 2");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.locator("#edit-book").click();
  await expect(page.locator("#book-form")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1", modal: "book" }));
  await page.goBack();
  await expect(page.locator("#book-form")).toHaveCount(0);
  await expect(page.locator("#chapter-form")).toHaveCount(0);
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  await page.locator('[data-model-edit="rabbit"]').click();
  await expect(page.locator("#model-form")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1", modal: "model", id: "rabbit" }));
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  await page.locator("#new-model").click();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1", modal: "new-model" }));
  await page.goBack();
  await expect(page.locator("#model-form")).toHaveCount(0);
  await page.locator("#back-library").click();
  await page.locator('[data-tab="models"]').click();
  await page.locator('[data-preview-model="rabbit"]').click();
  await expect(page.locator("#single-preview")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/models", { modal: "model-preview", id: "rabbit" }));
  await page.reload();
  await expect(page.locator("#single-preview")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#single-preview")).toHaveCount(0);
  await expect(page).toHaveURL(at("/admin/models"));
  await page.goto(at("/admin/models", { modal: "model", id: "rabbit" }));
  await expect(page.locator("#model-form")).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page).toHaveURL(at("/admin/models"));
  await page.goto(at("/admin/models", { modal: "model", id: "nope" }));
  await expect(page.locator("#toast")).toHaveText("요청한 항목을 찾을 수 없어 창을 열지 않았어요.");
  await expect(page).toHaveURL(at("/admin/models"));
  pass("Chapter, model and model preview dialogs keep their address, even when one opens right after another closes");

  const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const guest = await fresh.newPage();
  guest.on("pageerror", (error) => errors.push(error.message));
  await guest.goto(at("/admin/models", { modal: "model", id: "rabbit" }));
  await guest.getByLabel("관리자 비밀번호").fill(password);
  await guest.getByRole("button", { name: /스튜디오 들어가기/ }).click();
  await expect(guest.locator("#model-form")).toBeVisible();
  await expect(guest).toHaveURL(at("/admin/models", { modal: "model", id: "rabbit" }));
  await fresh.close();
  pass("A dialog's address also waits through the login screen");

  await page.locator('[data-tab="books"]').click();
  await page.locator("#new-book").click();
  await expect(page).toHaveURL(at("/admin/", { modal: "new-book" }));
  await page.locator('#book-form [name="title"]').fill("주소 검사 책");
  await page.locator('#book-form button[type="submit"]').click();
  await expect(page.locator("#studio-world canvas")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/books\/[0-9a-f-]{36}\?chapter=[0-9a-f-]{36}$/);
  await page.goBack();
  await page.getByRole("button", { name: "저장하지 않고 나가기", exact: true }).click();
  await expect(page.locator(".book-shelf")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/"));
  pass("A new book's editor takes over the dialog's entry, so back returns to the shelf");

  const puts = [];
  page.on("request", (request) => { if (request.method() === "PUT" && request.url().endsWith("/api/studio")) puts.push(request.url()); });
  const frameHistory = () => page.evaluate(() => document.querySelector(".client-preview-dialog iframe")?.contentWindow?.history.pushState.name);
  const preview = () => page.frames().find((frame) => frame.url().includes("preview=draft"));
  await page.locator('[data-tab="home"]').click();
  await page.locator("#preview-home").click();
  await expect(page.locator(".client-preview-dialog iframe")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/home", { modal: "home-preview" }));
  expect(puts.length).toBe(1);
  await page.reload();
  await expect(page.locator(".client-preview-dialog iframe")).toBeVisible();
  expect(puts.length).toBe(1);
  await expect.poll(frameHistory).toBe("bound replaceState");
  await preview().evaluate(() => history.pushState(null, "", `${location.pathname}${location.search}&probe=1`));
  await page.goBack();
  await expect(page.locator(".client-preview-dialog")).toHaveCount(0);
  await expect(page).toHaveURL(at("/admin/home"));
  await page.locator("#preview-home").click();
  await expect.poll(frameHistory).toBe("bound replaceState");
  await preview().evaluate(() => { setTimeout(() => location.assign(`${location.pathname}${location.search}&probe=2`)); });
  await expect.poll(() => preview()?.url() ?? "").toContain("probe=2");
  await expect.poll(frameHistory).toBe("bound replaceState");
  await page.locator(".client-preview-dialog .close-modal").click();
  await expect(page).toHaveURL(at("/admin/home"));
  await page.locator('[data-tab="models"]').click();
  await expect(page).toHaveURL(at("/admin/models"));
  pass("The home preview reopens without saving, its frame keeps no history, and closing it never stalls later moves");
```

- [ ] **Step 2: 실패 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: Task 3 의 PASS 7줄 뒤 실패. `#edit-book` 을 누른 뒤 `toHaveURL` 이 `…&modal=book` 을 기다리다 시간 초과.

- [ ] **Step 3: 상태에 대화상자와 되돌리기 추가**

```js
let shelfQuery="", shelfStatus="", assetQuery="", shelfReturn={q:"",status:""}, applying=false, urlTimer=null;
```

를 다음으로 바꾼다.

```js
let shelfQuery="", shelfStatus="", assetQuery="", shelfReturn={q:"",status:""}, applying=false, urlTimer=null, routeModal=null, backPending=null;
```

- [ ] **Step 4: 주소 블록 교체**

`// ---- The address (admin/route.js)` 줄부터 `function openAddress() { … }` 의 닫는 `}` 까지를 다음으로 바꾼다.

```js
// ---- The address (admin/route.js): the path names the page, the query what is open on it. ----
function currentRoute() {
  const route = tab === "books" && inEditor && book() && chapter()
    ? { view: "editor", bookId, chapterId, objectId: placementId || undefined, q: assetQuery || undefined }
    : tab === "books" ? { view: "books", q: shelfQuery || undefined, status: shelfStatus || undefined }
    : tab === "models" ? { view: "models", q: query || undefined } : { view: tab };
  if (routeModal) Object.assign(route, { modal: routeModal.modal, modalId: routeModal.modalId });
  return route;
}
// Every history write waits for a dialog-closing history.back() to land, so it never hits the entry being left.
function writeHistory(write) {
  if (backPending) backPending.done.then(() => writeHistory(write));
  else write();
}
// Steps back over a closed dialog's own entry. Without a popstate within a second (a preview iframe's
// entries can swallow the step), the dialog is dropped from this entry's address instead.
function stepBack() {
  writeHistory(() => {
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    backPending = { done, resolve, timer: setTimeout(() => settleBack(true), 1000) };
    history.back();
  });
}
function settleBack(timedOut) {
  const pending = backPending;
  if (!pending) return;
  clearTimeout(pending.timer);
  backPending = null;
  if (timedOut) history.replaceState({}, "", routeHref(currentRoute()));
  pending.resolve();
}
// Writes the current place into this history entry's address.
function syncUrl() {
  clearTimeout(urlTimer); urlTimer = null;
  if (applying) return;
  writeHistory(() => {
    const href = routeHref(currentRoute());
    if (href !== location.pathname + location.search) history.replaceState(history.state, "", href);
  });
}
// Typing writes the address once it pauses: Safari limits how often replaceState may run.
function syncUrlSoon() { clearTimeout(urlTimer); urlTimer = setTimeout(syncUrl, 250); }
// Closes every open dialog without touching history: the page they belong to is going away.
function closeDialogs() {
  routeModal = null;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
}
// A page move: the entry being left gets its latest address, then a new entry is pushed and drawn.
function navigate(change) {
  if (urlTimer) syncUrl();
  change();
  closeDialogs();
  writeHistory(() => history.pushState({}, "", routeHref(currentRoute())));
  render();
}
// Ties a dialog to the address. Opened from the page it pushes its own entry; opened while an address is
// being shown, that entry already exists. Closing steps back over a pushed entry, or drops the dialog from the address.
function routeDialog(dialog, modal, modalId, push = !applying) {
  const entry = { modal, modalId };
  if (push && urlTimer) syncUrl();
  routeModal = entry;
  if (push) writeHistory(() => { if (routeModal === entry) history.pushState({ modalEntry: true }, "", routeHref(currentRoute())); });
  dialog.addEventListener("close", () => {
    if (routeModal !== entry) return;
    routeModal = null;
    if (history.state?.modalEntry) stepBack();
    else syncUrl();
  });
}
// Opens the dialog an address names.
function openRouteDialog(route) {
  const model = library.models.find((m) => m.id === route.modalId);
  if (route.modal === "new-book") editBook(true);
  else if (route.modal === "book") editBook();
  else if (route.modal === "chapter") editChapter(route.modalId);
  else if (route.modal === "new-model") editModel();
  else if (route.modal === "model") editModel(model);
  else if (route.modal === "model-preview") previewModel(model);
  else if (route.modal === "home-preview") previewHome(hasUnsavedChanges());
}
// Shows the place an address names, on load and when the browser moves to another page.
function applyRoute(route) {
  closeDialogs();
  const entering = route.view === "editor" && !(inEditor && bookId === route.bookId);
  tab = route.view === "editor" ? "books" : route.view;
  inEditor = route.view === "editor";
  if (entering) { undoStack = []; redoStack = []; baseline = structuredClone(library); }
  if (inEditor) { bookId = route.bookId; chapterId = route.chapterId; placementId = route.objectId ?? null; assetQuery = route.q ?? ""; }
  else placementId = null;
  if (route.view === "books") { shelfQuery = route.q ?? ""; shelfStatus = route.status ?? ""; }
  if (route.view === "models") query = route.q ?? "";
  applying = true;
  try {
    render();
    if (route.modal) openRouteDialog(route);
  } finally { applying = false; }
  syncUrl();
}
// Back or forward within one page: only the dialog differs, so the page (and the editor's 3D view) stays.
function syncDialog(route) {
  if (routeModal?.modal === route.modal && routeModal?.modalId === route.modalId) return;
  closeDialogs();
  if (route.modal) {
    applying = true;
    try { openRouteDialog(route); } finally { applying = false; }
  }
  syncUrl();
}
function openAddress() {
  const { route, notice } = resolveRoute(parseRoute(location.pathname, location.search), library);
  applyRoute(route);
  if (notice) toast(notice);
}
```

- [ ] **Step 5: `popstate` 에 자기 되돌리기와 같은 페이지 처리 추가**

Task 3 의 `popstate` 리스너 전체를 다음으로 바꾼다.

```js
window.addEventListener("popstate", () => {
  if (backPending) return settleBack(false); // our own step back over a closed dialog's entry
  if (!library) return; // the login and loading screens read the address themselves once the studio loads
  const { route, notice } = resolveRoute(parseRoute(location.pathname, location.search), library);
  const current = currentRoute();
  if (current.view === "editor" && !(route.view === "editor" && route.bookId === current.bookId) && (leaveDialog || busy || hasUnsavedChanges())) {
    // Keep the editor's address while the leave dialog decides; leaving then steps back to where the browser was going.
    history.pushState({}, "", routeHref(current));
    if (!leaveDialog) requestLeaveEditor(() => history.back());
    return;
  }
  const page = (r) => routeHref({ ...r, modal: undefined, modalId: undefined });
  if (page(route) === page(current)) syncDialog(route);
  else applyRoute(route);
  if (notice) toast(notice);
});
```

- [ ] **Step 6: 대화상자 다섯 곳 등록**

`editBook` 에서

```js
  bindImageField(d, "book-cover", "cover", { busy: holdActions(d) });
```

바로 앞에 넣는다.

```js
  routeDialog(d, isNew ? "new-book" : "book");
```

`editChapter` 에서

```js
  const apply = () => {
    const values = Object.fromEntries(new FormData(d.querySelector("form")));
```

바로 앞에 넣는다.

```js
  routeDialog(d, "chapter", c.id);
```

`editModel` 에서

```js
  const form = d.querySelector("form");
  const update = () => {
```

바로 앞에 넣는다.

```js
  routeDialog(d, existing ? "model" : "new-model", existing?.id);
```

`previewModel` 에서

```js
  const p = {
    id: "preview",
```

바로 앞에 넣는다.

```js
  routeDialog(d, "model-preview", m.id);
```

- [ ] **Step 7: 새 도서는 대화상자 기록 자리를 편집기로**

Task 3 에서 바꾼

```js
    if (isNew) {library.books.push(original);shelfReturn={q:shelfQuery,status:shelfStatus};}
    bookId = original.id;
    chapterId = original.chapters[0].id;
    placementId = original.chapters[0].placements[0]?.id;
    mark();
    d.close();
    if (isNew) navigate(() => { inEditor = true; assetQuery = ""; });
    else render();
  };
```

를 다음으로 바꾼다.

```js
    if (isNew) {library.books.push(original);shelfReturn={q:shelfQuery,status:shelfStatus};}
    bookId = original.id;
    chapterId = original.chapters[0].id;
    placementId = original.chapters[0].placements[0]?.id;
    mark();
    // A new book's editor takes over the dialog's history entry, so Back from it returns to the shelf.
    if (isNew) { routeModal = null; inEditor = true; assetQuery = ""; writeHistory(() => history.replaceState({}, "")); }
    d.close();
    render();
  };
```

- [ ] **Step 8: 홈 미리보기**

`bindHome` 에서

```js
  app.querySelector("#preview-home").onclick = () => openPreview("", "공개 전 홈 화면 체험", "임시 저장한 홈 화면을 확인합니다. 공개 대상 책만 보이며, 공개 중인 화면에는 영향을 주지 않습니다.");
}
```

를 다음으로 바꾼다.

```js
  app.querySelector("#preview-home").onclick = () => previewHome();
}
function previewHome(saveFirst = true) {
  return openPreview("", "공개 전 홈 화면 체험", "임시 저장한 홈 화면을 확인합니다. 공개 대상 책만 보이며, 공개 중인 화면에는 영향을 주지 않습니다.", saveFirst);
}
```

`openPreview` 전체

```js
// Saves the draft first, then shows the reader in a frame at desktop or phone width.
async function openPreview(query, heading, note) {
  if (!await save(false)) return;
  const d = modal(`<h2>${esc(heading)}</h2><p>${esc(note)}</p><div class="preview-size-controls"><button id="preview-desktop" class="outline-button">넓은 화면</button><button id="preview-mobile" class="outline-button">모바일 화면</button></div><iframe title="공개 전 독자 화면" src="/client/?preview=draft${query}"></iframe>`);
  d.classList.add('client-preview-dialog');
  d.querySelector('#preview-mobile').onclick = () => d.classList.add('mobile-preview');
  d.querySelector('#preview-desktop').onclick = () => d.classList.remove('mobile-preview');
  d.addEventListener('close', () => { d.querySelector('iframe')?.remove(); }, {once:true});
}
```

를 다음으로 바꾼다.

```js
// Saves the draft first, then shows the reader in a frame at desktop or phone width. Reopened from its
// address, the home preview saves only when something is unsaved.
async function openPreview(query, heading, note, saveFirst = true) {
  const push = !applying;
  if (saveFirst && !await save(false)) return;
  if (!query && tab !== "home") return;
  const d = modal(`<h2>${esc(heading)}</h2><p>${esc(note)}</p><div class="preview-size-controls"><button id="preview-desktop" class="outline-button">넓은 화면</button><button id="preview-mobile" class="outline-button">모바일 화면</button></div><iframe title="공개 전 독자 화면" src="/client/?preview=draft${query}"></iframe>`);
  d.classList.add('client-preview-dialog');
  d.querySelector('#preview-mobile').onclick = () => d.classList.add('mobile-preview');
  d.querySelector('#preview-desktop').onclick = () => d.classList.remove('mobile-preview');
  // Frames share the window's history: the preview moves by replacing its entry, so Back closes the dialog.
  const frame = d.querySelector('iframe');
  frame.addEventListener('load', () => { try { const h = frame.contentWindow.history; h.pushState = h.replaceState.bind(h); } catch {} });
  d.addEventListener('close', () => { d.querySelector('iframe')?.remove(); }, {once:true});
  if (!query) routeDialog(d, "home-preview", undefined, push);
}
```

- [ ] **Step 9: 통과 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: PASS 12줄, 오류 없이 종료.

Run: `node tests/home-admin.mjs`
Expected: 기존 PASS 8줄 그대로(홈 미리보기 저장, 슬라이드, 책 삭제 흐름 포함).

- [ ] **Step 10: 커밋**

```bash
git add admin/main.js tests/admin-routes.mjs
git commit -m "Give studio dialogs an address and a history entry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

실행 기록(2026-09-29): 검토에서 두 가지가 드러나 수정 라운드(443a11a)를 거쳤다.
- 창의 `close` 이벤트는 비동기라, 책 정보 변경 적용 뒤의 새 위치가 떠나는 대화상자 항목에 쓰였다. 그래서 기록 주소를 요청 시점에 잡고, 되돌리기로 도착한 항목에 창이 닫힐 때의 페이지 주소를 쓰게 했다(`stepBack(href)`, `settleBack`). `modalEntry` 판정은 `writeHistory` 콜백 안으로 옮겼다.
- 새 책을 버린 뒤의 `stale` 판정, 나가기 확인 창의 `leaveDialog?.open` 판정, 저장 중인 홈 미리보기의 주소 유지를 더했다.
- 검사 "Applying a dialog leaves the page's new place in the address" 를 추가해 PASS 는 13줄이다.

---

### Task 5: 독자 체험과 편집기 패널 접힘

**Files:**
- Modify: `admin/viewport-tools.js` (`inlineReader`)
- Modify: `admin/workspace.js`
- Modify: `admin/main.js`
- Test: `tests/admin-routes.mjs`

**Interfaces:**
- Consumes: Task 4 의 `currentRoute`, `applyRoute`, `syncUrl`.
- Produces:
  - `inlineReader(container, world, book, chapter, models, onExit, onChapter = () => {})`. `onChapter(chapterId)` 는 체험 속 챕터가 바뀔 때마다 불린다.
  - `mountWorkspace(...)` 반환 `{ world, dispose(), openReader() }`. 훅 `hooks.reader(chapterId | null)`.
  - `admin/main.js` 상태 `readerChapterId`(체험 중인 챕터 id 또는 `null`).
  - 패널 접힘 저장 `localStorage["otb-studio-panels"]`.

- [ ] **Step 1: 실패하는 브라우저 검사 작성**

`tests/admin-routes.mjs` 의 `  expect(errors).toEqual([]);` 줄 바로 앞에 넣는다.

```js
  await page.locator('[data-tab="books"]').click();
  await page.locator('[data-open-book="alice"]').click();
  const readerEntries = await entries();
  await page.locator("#preview-client").click();
  await expect(page.locator(".inplace-reader")).toBeVisible();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1", mode: "reader" }));
  await page.locator(".reader-mode-bar select").selectOption("2");
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-3", mode: "reader" }));
  expect(await entries()).toBe(readerEntries);
  await page.locator("#exit-reader").click();
  await expect(page.locator(".inplace-reader")).toHaveCount(0);
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1" }));
  await page.locator("#preview-client").click();
  await page.locator(".reader-mode-bar select").selectOption("2");
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-3", mode: "reader" }));
  await page.reload();
  await expect(page.locator(".inplace-reader")).toBeVisible();
  await expect(page.locator(".reader-mode-bar select")).toHaveValue("2");
  await page.locator("#exit-reader").click();
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-3" }));
  await expect(page.locator('[data-chapter-row="alice-3"]')).toHaveClass(/active/);
  await page.goto(at("/admin/books/alice", { chapter: "alice-1", mode: "reader", modal: "book" }));
  await expect(page.locator(".inplace-reader")).toBeVisible();
  await expect(page.locator("#book-form")).toHaveCount(0);
  await expect(page).toHaveURL(at("/admin/books/alice", { chapter: "alice-1", mode: "reader" }));
  pass("Reader mode and its chapter live in the address and come back after a reload");

  const tilesOpen = () => page.locator(".world-tiles details").evaluate((details) => details.open);
  await page.locator("#exit-reader").click();
  await page.locator(".world-tiles summary").click();
  await expect.poll(tilesOpen).toBe(false);
  await page.reload();
  await expect(page.locator("#studio-world canvas")).toBeVisible();
  expect(await tilesOpen()).toBe(false);
  expect(await page.locator(".world-assets details").evaluate((details) => details.open)).toBe(true);
  await page.locator("[data-chapter-drag]").first().press("Alt+ArrowDown");
  await expect(page.locator("[data-chapter-row]").first()).toHaveAttribute("data-chapter-row", "alice-2");
  expect(await tilesOpen()).toBe(false);
  await page.locator("#undo").click();
  await expect(page.locator("[data-chapter-row]").first()).toHaveAttribute("data-chapter-row", "alice-1");
  await page.locator("#back-library").click();
  await page.locator('[data-open-book="oz"]').click();
  await expect(page.locator("#studio-world canvas")).toBeVisible();
  expect(await tilesOpen()).toBe(false);
  await page.locator(".world-tiles summary").click();
  await expect.poll(tilesOpen).toBe(true);
  await page.locator("#back-library").click();
  pass("Editor panels stay folded through reloads, redraws and other books");
```

- [ ] **Step 2: 실패 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: PASS 13줄 뒤 실패. `#preview-client` 를 누른 뒤 `toHaveURL` 이 `…&mode=reader` 를 기다리다 시간 초과.

- [ ] **Step 3: `inlineReader` 가 챕터 변경을 알리게**

`admin/viewport-tools.js` 에서

```js
export function inlineReader(container,world,book,chapter,models,onExit){
```

를 다음으로 바꾼다.

```js
export function inlineReader(container,world,book,chapter,models,onExit,onChapter=()=>{}){
```

```js
onChapter:index=>{host.querySelector('select').value=index;}
```

를 다음으로 바꾼다.

```js
onChapter:index=>{host.querySelector('select').value=index;onChapter(book.chapters[index].id);}
```

- [ ] **Step 4: 편집기의 독자 체험 함수와 반환 객체**

`admin/workspace.js` 144번 줄

```js
 for(const [id,fn] of Object.entries({'back-library':hooks.back,'edit-book':hooks.editBook,'add-chapter':hooks.addChapter,'preview-client':()=>{if(readerMode)return;stopTravel();transform.detach();try{readerMode=inlineReader(app.querySelector(".world-workspace"),world,book,chapter,models,()=>{readerMode=null;selectObject(selected);});}catch(error){toast(error.message);selectObject(selected);}},'new-model':hooks.addModel,save:hooks.save,publish:hooks.publish,undo:hooks.undo,redo:hooks.redo}))el(id).onclick=fn;
```

를 다음으로 바꾼다.

```js
 // Reader mode reports its chapter (null once it ends) so the address can follow; a dispose ends it quietly.
 function openReader(){if(readerMode||dead)return;stopTravel();transform.detach();try{readerMode=inlineReader(app.querySelector(".world-workspace"),world,book,chapter,models,()=>{readerMode=null;if(dead)return;hooks.reader?.(null);selectObject(selected);},id=>hooks.reader?.(id));hooks.reader?.(chapter.id);}catch(error){toast(error.message);selectObject(selected);}}
 for(const [id,fn] of Object.entries({'back-library':hooks.back,'edit-book':hooks.editBook,'add-chapter':hooks.addChapter,'preview-client':openReader,'new-model':hooks.addModel,save:hooks.save,publish:hooks.publish,undo:hooks.undo,redo:hooks.redo}))el(id).onclick=fn;
```

186번 줄 끝의

```js
transform.dispose();world.dispose();}};
```

를 다음으로 바꾼다(`world`, `dispose` 뒤에 붙여 `tests/workspace.mjs` 의 정규식이 계속 맞게 한다).

```js
transform.dispose();world.dispose();},openReader};
```

- [ ] **Step 5: 패널 접힘 저장**

`admin/workspace.js` 의 `export function mountWorkspace` 바로 앞(31번 줄 `}` 다음 줄)에 넣는다.

```js
// Which editor panels are folded, kept per browser (not in the address): { assets: true, tiles: false, … }.
const panelKey='otb-studio-panels';
function readPanels(){try{const saved=JSON.parse(localStorage.getItem(panelKey));return saved&&typeof saved==='object'?saved:{};}catch{return {};}}
function writePanels(panels){try{localStorage.setItem(panelKey,JSON.stringify(panels));}catch{}}
```

```js
 const eligible=m=>m&&(m.kind!=='glb'||(m.rigged&&m.clips?.length));
```

바로 다음 줄에 넣는다.

```js
 const panels=readPanels(),panelOpen=name=>panels[name]===false?'':'open';
```

`app.innerHTML=…` 템플릿 안의 다섯 곳을 바꾼다.

| 찾을 코드 | 바꿀 코드 |
| --- | --- |
| `<aside class="world-assets floating-panel"><details open>` | `<aside class="world-assets floating-panel"><details data-panel="assets" ${panelOpen('assets')}>` |
| `<aside class="world-tiles floating-panel"><details open>` | `<aside class="world-tiles floating-panel"><details data-panel="tiles" ${panelOpen('tiles')}>` |
| `<aside class="world-chapters floating-panel"><details open>` | `<aside class="world-chapters floating-panel"><details data-panel="chapters" ${panelOpen('chapters')}>` |
| `<aside class="world-chapter-models floating-panel"><details open>` | `<aside class="world-chapter-models floating-panel"><details data-panel="chapter-models" ${panelOpen('chapter-models')}>` |
| `<aside class="world-inspector floating-panel"><details open>` | `<aside class="world-inspector floating-panel"><details data-panel="inspector" ${panelOpen('inspector')}>` |

```js
 const el=id=>app.querySelector('#'+id);
```

바로 다음 줄에 넣는다.

```js
 app.querySelectorAll('[data-panel]').forEach(details=>details.addEventListener('toggle',()=>{panels[details.dataset.panel]=details.open;writePanels(panels);}));
```

- [ ] **Step 6: 주소에 독자 체험 담기**

`admin/main.js` 에서

```js
let shelfQuery="", shelfStatus="", assetQuery="", shelfReturn={q:"",status:""}, applying=false, urlTimer=null, routeModal=null, backPending=null;
```

를 다음으로 바꾼다.

```js
let shelfQuery="", shelfStatus="", assetQuery="", readerChapterId=null, shelfReturn={q:"",status:""}, applying=false, urlTimer=null, routeModal=null, backPending=null;
```

`currentRoute` 에서

```js
    ? { view: "editor", bookId, chapterId, objectId: placementId || undefined, q: assetQuery || undefined }
```

를 다음으로 바꾼다.

```js
    ? { view: "editor", bookId, chapterId: readerChapterId || chapterId, objectId: placementId || undefined, reader: readerChapterId ? true : undefined, q: assetQuery || undefined }
```

`applyRoute` 에서

```js
  applying = true;
  try {
    render();
    if (route.modal) openRouteDialog(route);
  } finally { applying = false; }
  syncUrl();
}
```

를 다음으로 바꾼다.

```js
  readerChapterId = null;
  applying = true;
  try {
    render();
    if (route.reader) workspace?.openReader();
    if (route.modal) openRouteDialog(route);
  } finally { applying = false; }
  syncUrl();
}
```

`draw()` 의 `mountWorkspace` 훅에서

```js
search:q=>{assetQuery=q;syncUrlSoon();},
```

를 다음으로 바꾼다.

```js
search:q=>{assetQuery=q;syncUrlSoon();},reader:id=>{readerChapterId=id;syncUrl();},
```

- [ ] **Step 7: 통과 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: PASS 15줄, 오류 없이 종료.

Run: `node tests/leave-guard.mjs`
Expected: 기존 PASS 줄 그대로, 종료 코드 0.

- [ ] **Step 8: 커밋**

```bash
git add admin/viewport-tools.js admin/workspace.js admin/main.js tests/admin-routes.mjs
git commit -m "Keep reader mode in the address and remember folded editor panels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 스크롤 위치

**Files:**
- Modify: `admin/main.js`
- Test: `tests/admin-routes.mjs`

**Interfaces:**
- Consumes: Task 4 의 `navigate`, `routeDialog`, `settleBack`, `applyRoute`, `requestLeaveEditor` 기본 이동, 새 도서 제출.
- Produces: `saveScroll()`, `restoreScroll(top = history.state?.scroll ?? 0)`, `navigate(change, scroll = 0)`, `shelfReturn = { q, status, scroll }`, 상태 `scrollTimer`.

- [ ] **Step 1: 실패하는 브라우저 검사 작성**

`tests/admin-routes.mjs` 의 `  expect(errors).toEqual([]);` 줄 바로 앞에 넣는다.

```js
  await page.route("**/api/studio", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const body = await response.json();
    const alice = body.library.books[0];
    body.library.books = Array.from({ length: 18 }, (_, i) => ({ ...structuredClone(alice), id: `shelf-${i}`, title: `${alice.title} ${i + 1}` }));
    body.library.home = { hero: [] };
    await route.fulfill({ response, json: body });
  });
  await page.goto(at("/admin/"));
  await expect(page.locator(".book-tile")).toHaveCount(18);
  const middle = await page.evaluate(() => { const top = Math.floor((document.documentElement.scrollHeight - innerHeight) / 2); scrollTo(0, top); return top; });
  expect(middle).toBeGreaterThan(300);
  await expect.poll(() => page.evaluate(() => history.state?.scroll)).toBe(middle);
  await page.reload();
  await expect(page.locator(".book-tile")).toHaveCount(18);
  expect(await page.evaluate(() => scrollY)).toBe(middle);
  await page.evaluate(() => document.querySelector('[data-open-book="shelf-5"]').click());
  await expect(page.locator("#studio-world canvas")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".book-tile")).toHaveCount(18);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(middle);
  await page.evaluate(() => document.querySelector('[data-open-book="shelf-5"]').click());
  await page.locator("#back-library").click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(middle);
  await page.locator('[data-tab="home"]').click();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.unroute("**/api/studio");
  pass("The shelf returns to its scroll after a reload, back and the 도서 보관함 button, and a new page starts at the top");
```

- [ ] **Step 2: 실패 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: PASS 15줄 뒤 실패. `history.state?.scroll` 을 기다리는 `expect.poll` 이 `undefined` 로 시간 초과.

- [ ] **Step 3: 상태와 저장·복원 함수**

`admin/main.js` 에서

```js
let shelfQuery="", shelfStatus="", assetQuery="", readerChapterId=null, shelfReturn={q:"",status:""}, applying=false, urlTimer=null, routeModal=null, backPending=null;
```

를 다음으로 바꾼다.

```js
let shelfQuery="", shelfStatus="", assetQuery="", readerChapterId=null, shelfReturn={q:"",status:"",scroll:0}, applying=false, urlTimer=null, routeModal=null, backPending=null, scrollTimer=null;
// The window's scroll lives in the history entry: the browser's own restoring runs before the studio has loaded.
history.scrollRestoration="manual";
```

`// Typing writes the address once it pauses` 줄 바로 앞에 넣는다.

```js
function saveScroll() {
  clearTimeout(scrollTimer); scrollTimer = null;
  if (!backPending) history.replaceState({ ...history.state, scroll: scrollY }, "");
}
function restoreScroll(top = history.state?.scroll ?? 0) { window.scrollTo({ top, behavior: "instant" }); }
```

- [ ] **Step 4: 이동·대화상자·되돌리기·주소 적용에 스크롤 반영**

(Task 4 수정 라운드(443a11a)에서 기록 주소를 요청 시점에 잡도록 바뀐 코드 기준이다.)

`navigate` 전체

```js
function navigate(change) {
  if (urlTimer) syncUrl();
  change();
  closeDialogs();
  const href = routeHref(currentRoute());
  writeHistory(() => history.pushState({}, "", href));
  render();
}
```

를 다음으로 바꾼다.

```js
function navigate(change, scroll = 0) {
  if (urlTimer) syncUrl();
  saveScroll();
  change();
  closeDialogs();
  const href = routeHref(currentRoute());
  writeHistory(() => history.pushState({ scroll }, "", href));
  render();
  restoreScroll(scroll);
}
```

`routeDialog` 에서

```js
  if (push && urlTimer) syncUrl();
  routeModal = entry;
  const href = routeHref(currentRoute());
  if (push) writeHistory(() => { if (routeModal === entry) history.pushState({ modalEntry: true }, "", href); });
```

를 다음으로 바꾼다.

```js
  if (push && urlTimer) syncUrl();
  if (push) saveScroll();
  routeModal = entry;
  const href = routeHref(currentRoute()), scroll = scrollY;
  if (push) writeHistory(() => { if (routeModal === entry) history.pushState({ scroll, modalEntry: true }, "", href); });
```

`settleBack` 에서

```js
  history.replaceState(timedOut ? {} : history.state, "", pending.href);
```

를 다음으로 바꾼다.

```js
  history.replaceState(timedOut ? { scroll: history.state?.scroll ?? 0 } : history.state, "", pending.href);
```

`applyRoute` 끝의

```js
  } finally { applying = false; }
  syncUrl();
}
// Back or forward within one page
```

를 다음으로 바꾼다.

```js
  } finally { applying = false; }
  syncUrl();
  restoreScroll();
}
// Back or forward within one page
```

`popstate` 리스너 바로 다음에 넣는다.

```js
window.addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveScroll, 150); }, { passive: true });
window.addEventListener("pagehide", () => { if (urlTimer) syncUrl(); saveScroll(); });
```

- [ ] **Step 5: 도서 보관함으로 돌아올 때 위치 되살리기**

```js
  const leave = destination || (() => navigate(() => { inEditor=false; placementId=null; shelfQuery=shelfReturn.q; shelfStatus=shelfReturn.status; }));
```

를 다음으로 바꾼다.

```js
  const leave = destination || (() => navigate(() => { inEditor=false; placementId=null; shelfQuery=shelfReturn.q; shelfStatus=shelfReturn.status; }, shelfReturn.scroll));
```

표지 클릭의

```js
button.onclick=()=>{shelfReturn={q:shelfQuery,status:shelfStatus};navigate(
```

를 다음으로 바꾼다.

```js
button.onclick=()=>{shelfReturn={q:shelfQuery,status:shelfStatus,scroll:scrollY};navigate(
```

새 도서 제출의

```js
    if (isNew) {library.books.push(original);shelfReturn={q:shelfQuery,status:shelfStatus};}
```

를 다음으로 바꾼다.

```js
    if (isNew) {library.books.push(original);shelfReturn={q:shelfQuery,status:shelfStatus,scroll:scrollY};}
```

```js
    if (isNew) { routeModal = null; inEditor = true; assetQuery = ""; writeHistory(() => history.replaceState({}, "")); }
```

를 다음으로 바꾼다.

```js
    if (isNew) { routeModal = null; inEditor = true; assetQuery = ""; writeHistory(() => history.replaceState({ scroll: 0 }, "")); }
```

- [ ] **Step 6: 통과 확인**

Run: `npm run build && node tests/admin-routes.mjs`
Expected: PASS 16줄, 오류 없이 종료.

- [ ] **Step 7: 커밋**

```bash
git add admin/main.js tests/admin-routes.mjs
git commit -m "Return studio lists to their scroll position" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 기존 검사 맞추기와 회귀 확인

**Files:**
- Modify: `tests/workspace.mjs:94`
- Modify: `tests/floor-reading.mjs:86`

**Interfaces:**
- Consumes: Task 1~6 의 결과 전체.
- Produces: 없음(검사만).

- [ ] **Step 1: 새로고침 뒤 표지를 다시 누르던 두 줄 고치기**

`tests/workspace.mjs` 94번 줄 앞부분

```js
 await page.reload();await page.getByRole('button',{name:/격자 월드 테스트/}).click();
```

를 다음으로 바꾼다.

```js
 await page.goto(server.url+'/admin/');await page.getByRole('button',{name:/격자 월드 테스트/}).click();
```

`tests/floor-reading.mjs` 86번 줄 앞부분

```js
  await admin.reload(); await admin.locator('[data-open-book="alice"]').click();
```

를 다음으로 바꾼다.

```js
  await admin.goto(server.url + "/admin/"); await admin.locator('[data-open-book="alice"]').click();
```

두 검사는 그 앞(각 39번 줄, 37번 줄)에서 이미 실패하므로 이 줄은 해당 검사를 고칠 때 실행된다. 이제 편집기에서 새로고침하면 편집기에 머물기 때문에, 도서 보관함을 새로 불러오던 원래 의도를 `goto` 로 지킨다.

- [ ] **Step 2: 단위 검사와 빌드**

Run: `npm test`
Expected: 모두 통과(`tests/admin-route.test.js` 6개 포함).

Run: `npm run build`
Expected: `✓ built in` 으로 끝남.

- [ ] **Step 3: 원래 통과하던 브라우저 검사**

Run(각각): `node tests/admin-routes.mjs`, `node tests/leave-guard.mjs`, `node tests/home-admin.mjs`, `node tests/model-thumbnails.mjs`, `node tests/catalog.mjs`, `node tests/mobile-entry.mjs`, `node tests/about.mjs`
Expected: 모두 종료 코드 0. `model-thumbnails.mjs` 57번 줄의 새로고침은 이제 모델 보관함에 머물고, 이어서 누르는 '3D 모델 보관함' 탭은 이미 보고 있는 탭이라 아무 일도 하지 않는다.

- [ ] **Step 4: 원래 실패하던 검사의 실패 지점이 그대로인지**

Run(각각): `node tests/floor-editor.mjs`, `node tests/collision.mjs`, `node tests/browser.mjs`, `node tests/workspace.mjs`, `node tests/floor-reading.mjs`, `node tests/admin-parity.mjs`
Expected: 기준과 같은 지점에서 실패. `floor-editor.mjs:10`, `collision.mjs:10`, `browser.mjs:61`, `workspace.mjs:39`, `admin-parity.mjs:17`, `floor-reading.mjs` 는 카메라 거리 31.64(기대 39.17 초과). 다른 지점이면 새 회귀로 보고 원인을 찾는다. 종료 코드 127 은 PowerShell 로 다시 실행한다.

- [ ] **Step 5: 검사가 다시 찍은 이미지 되돌리기**

Run: `git restore docs/screenshots docs/floor-evidence docs/improvement-evidence docs/preview docs/browser-results.json docs/portal-results.json && git status --short`
Expected: `tests/workspace.mjs`, `tests/floor-reading.mjs` 만 수정됨으로 남는다.

- [ ] **Step 6: 커밋**

```bash
git add tests/workspace.mjs tests/floor-reading.mjs
git commit -m "Reopen the shelf explicitly where old checks reloaded the editor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 문서

**Files:**
- Modify: `README.md`
- Modify: `docs/ADMIN-GUIDE.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `docs/superpowers/specs/2026-09-11-react-next-migration-design.md`

**Interfaces:**
- Consumes: 스펙 3~5·8절, Task 1~7 의 동작.
- Produces: 없음.

- [ ] **Step 1: README**

`## 바로 확인하기` 의

```markdown
- 관리자 화면: http://127.0.0.1:4173/admin/
```

바로 다음 줄에 넣는다.

```markdown
- 관리자 화면의 탭과 편집 위치는 주소에 남습니다. 예: http://127.0.0.1:4173/admin/models, http://127.0.0.1:4173/admin/books/alice?chapter=alice-2 (규칙은 [관리자 안내](docs/ADMIN-GUIDE.md#주소와-새로고침))
```

`## 현재 경험과 관리 기능` 의

```markdown
- 관리자 미리보기와 사용자 공간은 같은 좌표와 지형을 사용합니다. 임시 저장과 공개는 분리됩니다.
```

바로 다음 줄에 넣는다.

```markdown
- 관리자는 새로고침하거나 주소를 직접 입력해도 보던 탭, 편집 중인 책·챕터·선택한 오브젝트, 열린 창, 검색 조건, 독자 체험, 스크롤 위치로 돌아옵니다. 뒤로 가기는 열린 창을 닫거나 이전 화면으로 돌아가며, 저장하지 않은 변경이 있으면 편집기를 떠나기 전에 확인합니다. 저장하지 않은 편집 내용은 새로고침으로 되살리지 않습니다.
```

`## 검증 실행` 의 코드 블록에서

```powershell
node tests/home-admin.mjs
```

바로 다음 줄에 `node tests/admin-routes.mjs` 를 넣는다.

```markdown
테스트는 4274~4276, 4283, 4285, 4291, 4292, 4294, 4297, 4321, 4331, 4332, 4336, 4341번 포트에
```

를 다음으로 바꾼다.

```markdown
테스트는 4274~4276, 4283, 4285, 4291, 4292, 4294, 4297, 4321, 4331, 4332, 4336, 4341, 4351번 포트에
```

```markdown
책장 검증은 4336번, 모바일 진입 검증은 4321번, 홈 화면 관리 검증은 4341번 포트를 사용합니다.
```

를 다음으로 바꾼다.

```markdown
책장 검증은 4336번, 모바일 진입 검증은 4321번, 홈 화면 관리 검증은 4341번, 관리자 주소 검증은 4351번 포트를 사용합니다. 관리자 주소 검증은 비밀번호를 켠 서버에서 깊은 주소 제공과 404, 로그인 뒤 원래 주소, 탭·검색·편집기·창의 새로고침과 뒤로·앞으로 가기, 잘못된 주소 보정, 독자 체험·패널 접힘·스크롤 유지를 확인합니다.
```

- [ ] **Step 2: 관리자 안내**

`docs/ADMIN-GUIDE.md` 의

```markdown
관리자 주소: http://127.0.0.1:4173/admin/
```

바로 다음에 빈 줄과 함께 넣는다.

```markdown
## 주소와 새로고침

관리자 화면은 보고 있는 위치를 주소에 담습니다. 새로고침하거나 주소를 직접 입력해도 같은 자리가 열리고, 로그인 화면을 거쳐도 원래 가려던 자리로 갑니다.

| 주소 | 화면과 쿼리 |
| --- | --- |
| `/admin/` | 도서 보관함. `q`(제목 검색어), `status`(`draft` 비공개 초안 · `public` 공개 대상) |
| `/admin/home` | 홈 화면 |
| `/admin/models` | 3D 모델 보관함. `q`(모델 이름 검색어) |
| `/admin/settings` | 공개 및 안내 |
| `/admin/books/<책 id>` | 월드 편집기. `chapter`(챕터 id), `object`(선택한 모델·바닥 이미지 id), `mode=reader`(독자 체험), `q`(모델 보관함 패널 검색어) |

열린 창은 `modal`과 `id`로 남습니다. 새 도서 `modal=new-book`, 도서 정보 `modal=book`, 챕터 편집 `modal=chapter&id=<챕터 id>`, 모델 등록 `modal=new-model`, 모델 정보 `modal=model&id=<모델 id>`, 모델 미리보기 `modal=model-preview&id=<모델 id>`, 홈 미리보기 `modal=home-preview`입니다. 예: `/admin/books/alice?chapter=alice-2&modal=chapter&id=alice-3`.

- 탭 이동, 편집기 열기, 창 열기는 브라우저 방문 기록에 남습니다. 창이 열린 채 뒤로 가기를 누르면 창만 닫히고, 편집기에서 누르면 이전 화면으로 돌아갑니다. 챕터 전환, 오브젝트 선택, 검색어, 독자 체험은 기록을 늘리지 않고 주소만 바꿉니다.
- 저장하지 않은 변경이 있는 채로 뒤로 가기로 편집기를 떠나면 나가기 확인 창이 뜹니다. 새로고침하면 마지막 임시 저장본을 같은 자리로 열며, 저장하지 않은 변경은 되살리지 않습니다.
- 목록의 스크롤 위치는 새로고침, 뒤로 가기, **← 도서 보관함** 뒤에도 유지됩니다. 편집기 패널을 접은 상태는 이 브라우저에 기억됩니다.
- 없는 책·챕터·오브젝트를 가리키는 주소는 도서 보관함·첫 챕터·선택 없음으로 열고 알림을 띄웁니다. 삭제 확인처럼 한 번 쓰고 닫는 확인 창은 주소에 남지 않습니다.
- 홈 미리보기 안에서의 이동은 방문 기록을 늘리지 않습니다. 미리보기가 열린 채 뒤로 가기를 누르면 미리보기가 닫힙니다.
```

- [ ] **Step 3: 배포 안내**

`docs/DEPLOYMENT.md` 에서

```markdown
두 프로젝트 모두 Root Directory 바깥의 소스 포함을 켭니다.
```

로 시작하는 문단 바로 다음에 빈 줄과 함께 넣는다.

```markdown
관리자 프로젝트는 `admin/vercel.json`의 rewrite로 `/admin/home`, `/admin/models`, `/admin/settings`, `/admin/books/<책 id>`(끝의 `/` 포함)도 관리자 화면에 연결합니다. 이 주소에서 새로고침해도 같은 화면이 열립니다. 주소 규칙은 [관리자 안내](ADMIN-GUIDE.md#주소와-새로고침)를 참고하세요.
```

```markdown
관리자 화면의 `/admin/`은 200,
```

를 다음으로 바꾼다.

```markdown
관리자 화면의 `/admin/`, `/admin/models`, `/admin/books/<아무 책 id>`는 200, `/admin/zzz`는 404,
```

- [ ] **Step 4: 전환 스펙**

`docs/superpowers/specs/2026-09-11-react-next-migration-design.md` 에서 여섯 곳을 바꾼다.

(1) 3절

```markdown
- 사용자 진행 기록 localStorage 키 `otb-reader` 와 값 구조 `{ [bookId]: { chapter } }`.
```

를 다음으로 바꾼다.

```markdown
- 사용자 진행 기록 localStorage 키 `otb-reader` 와 값 구조 `{ [bookId]: { chapter } }`. 관리자 편집기 패널 접힘 키 `otb-studio-panels` 와 값 구조 `{ [panel]: boolean }`(`assets`·`tiles`·`chapters`·`chapter-models`·`inspector`, `true` 가 펼침).
```

```markdown
관리자 URL: `/admin/`.
```

를 다음으로 바꾼다.

```markdown
관리자 URL: `/admin/`(도서 보관함, 쿼리 `q`·`status`·`modal`), `/admin/home`(`modal`), `/admin/models`(`q`·`modal`·`id`), `/admin/settings`, `/admin/books/:bookId`(월드 편집기, `chapter`·`object`·`mode=reader`·`q`·`modal`·`id`). `modal` 값, 매개변수 순서, 보정 규칙은 `2026-09-28-admin-url-state-design.md` 3·5절을 따른다.
```

(2) 4절

```
  app/admin/page.tsx         도서 보관함 + 전체화면 월드 편집기(클라이언트 상태)
```

를 다음 두 줄로 바꾼다.

```
  app/admin/page.tsx         도서 보관함(?q&status&modal)
  app/admin/books/[bookId]/page.tsx  전체화면 월드 편집기(?chapter&object&mode&q&modal&id)
```

(3) 8.1절 `액션: \`load\`` 로 시작하는 문단 바로 다음에 빈 줄과 함께 넣는다.

```markdown
선택(`selection`)과 독자 체험 여부(`editor.readerMode`)의 원본은 주소다. 페이지가 주소를 읽어 store 에 넣고, store 의 이동 액션은 주소를 바꾼다(9절).
```

(4) 9절 `- \`StudioShell\`:` 항목 바로 다음에 넣는다.

```markdown
- 주소 상태(`2026-09-28-admin-url-state-design.md`): 탭과 편집기 열기는 `Link`·`router.push`, 같은 페이지의 챕터·선택·검색어·독자 체험은 `window.history.replaceState`(검색어는 250ms 멈춘 뒤)로 쓴다. Next 14.1 이상은 이 호출을 `useSearchParams` 와 맞춘다. 대화상자는 열 때 `window.history.pushState` 로 항목 상태 `modalEntry` 를 남기고, 닫을 때 `history.back()` 으로 되돌리며, 직접 주소로 연 창은 `modal`·`id` 만 지운다. 되돌리기가 끝나기 전의 기록 쓰기는 미루고, 1초 안에 `popstate` 가 없으면 주소만 고친다. 저장하지 않은 변경이 있을 때 뒤로 가기로 편집기를 떠나면 주소를 편집기로 되돌리고 `LeaveEditorDialog` 를 띄운다. 없는 책·챕터·오브젝트·대상은 도서 보관함·첫 챕터·선택 없음·창 없음으로 보정하고 알림을 띄운다. 홈 미리보기 iframe 은 불러올 때마다 안쪽 `pushState` 를 `replaceState` 로 바꿔 끼운다. 스크롤은 `history.state.scroll`(`scrollRestoration = "manual"`), 편집기 패널 접힘은 `otb-studio-panels` 에 둔다.
```

(5) 14절

```markdown
현재 14개 스크립트(`admin-parity`, `browser`,
```

를 다음으로 바꾼다.

```markdown
현재 15개 스크립트(`admin-parity`, `admin-routes`, `browser`,
```

(6) 16절

```markdown
`home-admin` 의 도서 보관함 정렬·홈 화면 탭 검증 이관 통과.
```

를 다음으로 바꾼다.

```markdown
`home-admin` 의 도서 보관함 정렬·홈 화면 탭 검증 이관 통과, `admin-routes` 의 깊은 경로·탭·검색·편집기 밖 대화상자·스크롤 검증 이관 통과.
```

```markdown
`home-admin` 의 나머지(편집기 안의 도서 정보·장면 썸네일) 이관 통과, 스크린샷.
```

를 다음으로 바꾼다.

```markdown
`home-admin` 의 나머지(편집기 안의 도서 정보·장면 썸네일) 이관 통과, `admin-routes` 의 편집기(챕터·선택·나가기 확인)·편집기 안 대화상자·독자 체험·패널 접힘 검증 이관 통과, 스크린샷.
```

- [ ] **Step 5: 문서 확인**

Run: `git diff --stat`
Expected: 네 문서만 바뀜.

Run: `grep -n "admin-routes\|otb-studio-panels\|주소와 새로고침\|주소와-새로고침" README.md docs/ADMIN-GUIDE.md docs/DEPLOYMENT.md docs/superpowers/specs/2026-09-11-react-next-migration-design.md`
Expected: README 2곳 이상, ADMIN-GUIDE 1곳, DEPLOYMENT 1곳, 전환 스펙 4곳 이상. README 와 DEPLOYMENT 는 링크 조각 `#주소와-새로고침`(하이픈)으로 걸린다. 실행 기록(2026-09-29): 처음 계획의 패턴에는 하이픈 표기가 없어 두 문서가 덜 잡혔다. 패턴을 고친 뒤 2·1·1·5 로 확인했다.

- [ ] **Step 6: 커밋**

```bash
git add README.md docs/ADMIN-GUIDE.md docs/DEPLOYMENT.md docs/superpowers/specs/2026-09-11-react-next-migration-design.md
git commit -m "Document the studio's addresses and carry them into the migration plans" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
