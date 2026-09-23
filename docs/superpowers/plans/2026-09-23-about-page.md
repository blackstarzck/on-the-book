# 소개 페이지(/about) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브랜드 시안 sample-02 를 사용자 화면(client)의 `/about` 소개 페이지로 옮기고, 로컬 서버·Vercel·client 헤더와 연결한다.

**Architecture:** 시안의 바닐라 ES 모듈을 `client/about/` 에 새 Vite 진입점으로 옮기고, 폴더에 복사된 Three.js 대신 npm `three` 를 import 한다. 에셋은 Vite 가 해시 파일로 내보내도록 `client/about/assets/` 에 두고, 로컬은 Express 가 `/about` 을 `/client/about/` 으로 보내며 Vercel 은 rewrite 로 연결한다. client 헤더에는 '소개' 링크를 더한다.

**Tech Stack:** Vite 7.3(멀티 페이지), 바닐라 JS(ES 모듈), three 0.180, Express 5, node:test, @playwright/test(Edge 채널), ffmpeg(libwebp, 한 번만 사용).

**스펙:** `docs/superpowers/specs/2026-09-23-about-page-design.md`

**계획 작성 중 확인해 스펙에도 반영한 내용:**
- 단위 검사는 `tests/about.test.js` 한 파일이다. 1단계 계획이 `tests/server.test.js` 의 모든 케이스를 새 API 테스트로 옮기므로 그 파일에 넣지 않는다.
- 갤러리 '다음' 뒤 카운트는 스크롤 비율로 정해져 1440 폭에서 `03 / 04` 다. 검사는 이전 버튼 켜짐·카운트 변화·End 키 `04 / 04` 로 한다.
- 시험 빌드에서 `.glb`·`.json`·`.mp4` 가 해시 파일로 나가는 것을 확인했으므로 `assetsInclude` 를 쓰지 않는다.
- 320px 헤더는 '소개'를 넣으면 10px 모자라므로 359px 이하 규칙을 둔다(측정값은 Task 3).

## Global Constraints

- 기준 스택: 현재 client 의 Vite 멀티 페이지 + 바닐라 JS + npm `three` 0.180. React, TypeScript, 새 npm 의존성을 추가하지 않는다.
- 시안 경로 `SAMPLE=C:/Users/admin/Documents/temporary/on-the-book-brand/sample-02`. 시안 폴더는 읽기만 한다(서버 실행 포함).
- 소개 페이지 코드는 `client/about/` 안에만 두고 `shared/` 를 import 하지 않는다.
- 시안의 로직·문구·클래스·데이터 속성·글꼴·색·로고는 바꾸지 않는다. 바꾸는 것은 Task 1 Step 8~10 의 조정(스펙 5절 표)뿐이다.
- 주소: 로컬 `/about`·`/about/` → 302 `/client/about/`. Vercel client `/about`, `/about/`, `/client/about/` → `/client/about/index.html`. 관리자 빌드에는 소개 페이지를 넣지 않는다.
- 포트: `tests/about.mjs` 4331, `tests/about.test.js` 4332, 개발 서버 확인 4334, 비교용 완성본 서버 4335, 시안 서버 4380.
- 브라우저 검사는 `channel: "msedge"`, `headless: true`, `args: ["--enable-webgl", "--ignore-gpu-blocklist"]`.
- 명령은 저장소(워크트리) 루트에서 Git Bash 로 실행한다. PowerShell 이 필요한 단계는 따로 적는다.
- 회귀 검사가 다시 쓰는 기존 증거 파일(`docs/screenshots/*.png`, `docs/floor-evidence/*.png`, `docs/browser-results.json`)은 커밋하지 않고 `git restore` 로 되돌린다. Task 1 이 새로 만드는 `docs/screenshots/about-desktop.png`, `docs/screenshots/about-mobile.png` 만 Task 1 에서 커밋한다.
- 커밋 메시지는 영어 명령형 한 줄 + 본문, 마지막 줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 문서 문체: 사용자 문서(README, DEPLOYMENT, ABOUT-PAGE)는 "~합니다", 스펙·계획은 "~다".

---

## 파일 구조

```
client/about/index.html            새 파일. 시안 index.html (구조·문구 유지)
client/about/main.js               새 파일. 시안 app.js (CSS·트레일러 import, 설정 코드 제거)
client/about/style.css             새 파일. 시안 styles.css 그대로
client/about/scene.js              새 파일. 시안 scene.js (three import 교체)
client/about/clay-scene.js         새 파일. 시안 clay-scene.js (three·GLTFLoader import, 정적 에셋 경로)
client/about/journey-camera.js     새 파일. 시안 그대로
client/about/journey-labels.js     새 파일. 시안 그대로
client/about/journey-presentation.js  새 파일. 시안 journey-presentation.js (three import 교체)
client/about/assets/**             새 파일 17개. 시안 참조 에셋(카드 4장·대체 이미지는 WebP 변환)
vite.config.js                     수정: about 입력(admin 모드 제외)
package.json                       수정: test:about 스크립트
server/index.js                    수정: /about → /client/about/ 302
client/vercel.json                 수정: /about rewrite 3개
client/main.js                     수정: header() 에 '소개' 링크(초안 미리보기 제외)
shared/style.css                   수정: #about-link 휴대폰 규칙
tests/about.test.js                새 파일: 빌드 입력·로컬 이동 단위 검사
tests/about.mjs                    새 파일: 브라우저 검사
tests/about-compare.mjs            새 파일: 두 페이지를 같은 위치에서 찍는 비교 도구
docs/screenshots/about-desktop.png, about-mobile.png  새 파일: 검사 스크린샷
docs/ABOUT-PAGE.md                 새 파일: 출처·동작·차이·에셋·검증·비교 결과
README.md, docs/DEPLOYMENT.md      수정: 주소와 검증 명령
docs/superpowers/specs/2026-09-11-react-next-migration-design.md  수정: /about 을 전환 범위에 추가
docs/superpowers/plans/2026-09-14-phase1-monorepo-api.md          수정: legacy:test:about, 검사 수 26
```

---

### Task 1: 시안을 client/about 으로 옮기고 빌드에 넣기

**Files:**
- Create: `client/about/{index.html,main.js,style.css,scene.js,clay-scene.js,journey-camera.js,journey-labels.js,journey-presentation.js}`, `client/about/assets/**`
- Create: `tests/about.test.js`, `tests/about.mjs`
- Modify: `vite.config.js`, `package.json`
- Create(검사 산출물): `docs/screenshots/about-desktop.png`, `docs/screenshots/about-mobile.png`

**Interfaces:**
- Consumes: `tests/helpers.js` 의 `startServer(port, password?)` → `{ url, dir, child, stop() }`(완성본 모드 `server/index.js --production`, 임시 `DATA_DIR`).
- Produces:
  - 빌드 입력 키 `about`(`client/about/index.html`). 기본 빌드 결과 `dist/client/about/index.html`.
  - `tests/about.mjs` 의 모듈 상수 `server`(`{ url, stop }`), `aboutUrl`(`server.url + "/client/about/"`), `slow`(`{ timeout: 20000 }`), 함수 `pass(name)`, `open(options = {}, init)` → `{ context, page, problems }`. 환경변수 `ABOUT_BASE_URL` 이 있으면 서버를 띄우지 않고 그 주소를 쓴다.
  - npm 스크립트 `test:about` = `npm run build && node tests/about.mjs`.

- [ ] **Step 1: 의존성을 확인한다**

Run: `test -f node_modules/three/package.json && test -f node_modules/@playwright/test/package.json && echo deps-ok || npm ci`
Expected: `deps-ok`(없으면 `npm ci` 가 설치한다). `ffmpeg -hide_banner -encoders | grep -c libwebp` 가 1 이상이어야 한다.

- [ ] **Step 2: 빌드 입력을 검사하는 실패 테스트를 쓴다**

`tests/about.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.js";

// vite.config.js exports a function of the build mode; list the HTML entries each build produces.
const entries = (mode) => Object.keys(config({ mode, command: "build" }).build.rollupOptions.input).sort();

test("the about page is built with the reader but not with the studio", () => {
  assert.deepEqual(entries("production"), ["about", "admin", "client"]);
  assert.deepEqual(entries("client"), ["about", "client"]);
  assert.deepEqual(entries("admin"), ["admin", "client"]);
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `node --test tests/about.test.js 2>&1 | grep -E "✔|✖|ℹ (pass|fail)"`
Expected: `✖ the about page is built with the reader but not with the studio (…ms)`, `ℹ pass 0`, `ℹ fail 1`. 실패 이유는 `production` 입력이 `['admin', 'client']` 이기 때문이다.

- [ ] **Step 4: 브라우저 검사를 쓰고 스크립트를 등록한다**

`tests/about.mjs`
```js
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startServer } from "./helpers.js";

// Browser checks for the /about page ported from the sample-02 brand page.
// ABOUT_BASE_URL runs them against a server that is already running, such as `npm run dev`.
const base = process.env.ABOUT_BASE_URL?.replace(/\/$/, "");
const server = base ? { url: base, stop: async () => {} } : await startServer(4331);
const browser = await chromium.launch({
  headless: true,
  channel: "msedge",
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const aboutUrl = server.url + "/client/about/";
const slow = { timeout: 20000 };
const pass = (name) => console.log("PASS " + name);
await mkdir("docs/screenshots", { recursive: true });
await mkdir("test-results", { recursive: true });

// Records script errors and failed responses from the test server; external font requests do not count.
async function open(options = {}, init) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  context.setDefaultTimeout(20000);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(server.url) && response.status() >= 400)
      problems.push(`${response.status()} ${response.url()}`);
  });
  return { context, page, problems };
}

try {
  {
    const { context, page, problems } = await open();
    await page.goto(aboutUrl);
    await expect(page).toHaveTitle("On the Book — 책 속을 걷다");
    await expect(page.locator(".hero")).toHaveAttribute("data-book-world", "ready", slow);
    await page.screenshot({ path: "docs/screenshots/about-desktop.png" });
    const hit = await page.locator(".hero-object-hit").boundingBox();
    await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(hit.x + hit.width / 2 + i * 20, hit.y + hit.height / 2);
    await page.mouse.up();
    expect(Number(await page.locator(".hero").getAttribute("data-rotation"))).toBeGreaterThan(0.2);
    pass("Hero book renders and turns when dragged");

    const world = await page.evaluate(() => {
      const section = document.querySelector(".world");
      const stage = document.querySelector(".world-stage");
      return { top: section.getBoundingClientRect().top + scrollY, range: section.offsetHeight - stage.offsetHeight * 2 };
    });
    for (const [fraction, step] of [[0.05, "0"], [0.4, "1"], [0.75, "2"]]) {
      await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), world.top + world.range * fraction);
      await expect(page.locator(".world")).toHaveAttribute("data-journey", "ready", slow);
      await expect(page.locator(".world")).toHaveAttribute("data-step", step);
    }
    pass("Clay journey loads and walks past its three photos");

    await page.evaluate(() => document.querySelector("#experience").scrollIntoView({ behavior: "instant" }));
    await page.locator('[data-way="1"]').click();
    await expect(page.locator('[data-way="1"]')).toHaveAttribute("aria-current", "step");
    pass("Walk, approach and read words move to their panels");

    await page.evaluate(() => document.querySelector("#scenes").scrollIntoView({ behavior: "instant" }));
    await expect(page.locator(".rail-count")).toHaveText("01 / 04");
    await expect(page.locator('[data-rail="-1"]')).toBeDisabled();
    await page.locator('[data-rail="1"]').click();
    await expect(page.locator('[data-rail="-1"]')).toBeEnabled();
    await expect(page.locator(".rail-count")).not.toHaveText("01 / 04");
    await page.locator(".scene-rail").focus();
    await page.keyboard.press("End");
    await expect(page.locator(".rail-count")).toHaveText("04 / 04");
    await expect(page.locator('[data-rail="1"]')).toBeDisabled();
    await page.locator('[data-gallery-open="1"]').click();
    await expect(page.locator(".gallery-dialog")).toHaveAttribute("open");
    await expect(page.locator("#gallery-heading")).toHaveText("낯선 정원.");
    await expect(page.locator(".gallery-count")).toHaveText("02 / 04");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#gallery-heading")).toHaveText("나만의 발걸음.");
    await expect(page.locator(".gallery-count")).toHaveText("03 / 04");
    await page.keyboard.press("Escape");
    await expect(page.locator(".gallery-dialog")).not.toHaveAttribute("open");
    await expect(page.locator('[data-gallery-open="1"]')).toBeFocused();
    pass("Scene gallery pages, enlarges, steps with arrows and returns focus");

    await page.locator(".film-surface").scrollIntoViewIfNeeded();
    await page.locator(".film-surface").click();
    await expect(page.locator(".film-dialog")).toHaveAttribute("open");
    expect(await page.locator(".film-video").getAttribute("src")).toMatch(/trailer(-[\w-]+)?\.mp4$/);
    await page.locator("[data-film-close]").click();
    await expect(page.locator(".film-dialog")).not.toHaveAttribute("open");
    await expect(page.locator(".film-surface")).toBeFocused();
    pass("Brand film opens in a dialog with the bundled trailer");

    await page.locator(".motion-control").click();
    await expect(page.locator("html")).toHaveClass(/motion-off/);
    await expect(page.locator("html")).toHaveClass(/natural-flow/);
    await expect(page.locator(".motion-label")).toHaveText("모션 꺼짐");
    pass("Motion control switches to the natural document flow");

    const start = page.locator("[data-service-link]");
    await expect(start).toHaveAttribute("href", "/");
    await start.click();
    await page.waitForURL(server.url + "/client/");
    await expect(page.locator("#start-button")).toBeVisible();
    pass("Start link opens the reader home");
    expect(problems).toEqual([]);
    await context.close();
  }
  {
    const { context, page, problems } = await open({ reducedMotion: "reduce" });
    await page.goto(aboutUrl);
    await expect(page.locator("html")).toHaveClass(/natural-flow/);
    await expect(page.locator(".motion-label")).toHaveText("모션 꺼짐");
    expect(problems).toEqual([]);
    await context.close();
    pass("Reduced motion starts in the natural document flow");
  }
  {
    const { context, page, problems } = await open({}, () => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/i.test(type) ? null : getContext.call(this, type, ...rest);
      };
    });
    await page.goto(aboutUrl);
    await expect(page.locator(".hero")).toHaveAttribute("data-book-world", "fallback", slow);
    await expect(page.locator(".hero-object-hit")).toBeHidden();
    await page.evaluate(() => document.querySelector("#world").scrollIntoView({ behavior: "instant" }));
    await expect(page.locator(".world")).toHaveAttribute("data-journey", "fallback", slow);
    await expect(page.locator(".world")).toHaveClass(/is-still/);
    await expect
      .poll(() => page.locator(".journey-poster").evaluate((img) => img.complete && img.naturalWidth > 0 && getComputedStyle(img).opacity), slow)
      .toBe("1");
    expect(problems).toEqual([]);
    await context.close();
    pass("Without WebGL the hero hides dragging and the journey shows its still image");
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 560 }]) {
    const { context, page, problems } = await open({ viewport, isMobile: true, hasTouch: true });
    await page.goto(aboutUrl);
    await expect(page.locator(".hero")).toHaveAttribute("data-book-world", /ready|fallback/, slow);
    if (viewport.width === 390) await page.screenshot({ path: "docs/screenshots/about-mobile.png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(problems).toEqual([]);
    await context.close();
    pass(`About page fits ${viewport.width}px without sideways scrolling`);
  }
} finally {
  await browser.close();
  await server.stop();
}
```

`package.json` 의 `"test:mobile"` 줄을 다음 두 줄로 바꾼다.
```json
    "test:mobile": "npm run build && node tests/mobile-entry.mjs",
    "test:about": "npm run build && node tests/about.mjs"
```

- [ ] **Step 5: 브라우저 검사의 실패를 확인한다**

Run: `npm run test:about 2>&1 | tail -15`
Expected: 빌드는 성공하고 검사가 실패한다. `toHaveTitle` 기대값 `"On the Book — 책 속을 걷다"` 와 실제 제목이 다르다는 오류(404 페이지)로 끝나며 `PASS` 줄은 없다.

- [ ] **Step 6: 에셋을 복사하고 변환한다**

Run:
```bash
SAMPLE="C:/Users/admin/Documents/temporary/on-the-book-brand/sample-02"
mkdir -p client/about/assets/scene-concepts
for f in trailer.mp4 clay-journey.glb clay-journey.json journey-walk.webp journey-approach.webp journey-read.webp garden.webp wander.webp invitation.webp footer-books-hairline.webp footer-door-hairline.webp footer-reader-hairline.webp; do cp "$SAMPLE/public/assets/$f" client/about/assets/; done
for n in card-01-world-a card-02-secret-garden-a card-03-own-pace-a card-04-story-near-a; do ffmpeg -hide_banner -loglevel error -y -i "$SAMPLE/public/assets/scene-concepts/$n.png" -c:v libwebp -quality 90 -compression_level 6 "client/about/assets/scene-concepts/$n.webp"; done
ffmpeg -hide_banner -loglevel error -y -i "$SAMPLE/public/assets/clay-journey-poster.png" -c:v libwebp -quality 90 -compression_level 6 client/about/assets/clay-journey-poster.webp
```

Run: `find client/about/assets -type f | wc -l && find client/about/assets -type f -exec cat {} + | wc -c`
Expected: `17`, 그리고 약 `13560000`(±1%, 스펙 6절 합계 13.6MB).

Run: `for f in client/about/assets/clay-journey-poster.webp client/about/assets/scene-concepts/card-01-world-a.webp; do ffprobe -v error -select_streams v:0 -show_entries stream=width,height,pix_fmt -of csv=p=0 "$f"; done`
Expected: `1100,1100,yuva420p`(투명 유지), `1448,1086,yuv420p`.

- [ ] **Step 7: 코드 파일을 복사한다**

Run:
```bash
SAMPLE="C:/Users/admin/Documents/temporary/on-the-book-brand/sample-02"
cp "$SAMPLE/index.html" client/about/index.html
cp "$SAMPLE/app.js" client/about/main.js
cp "$SAMPLE/styles.css" client/about/style.css
for f in scene.js clay-scene.js journey-camera.js journey-labels.js journey-presentation.js; do cp "$SAMPLE/$f" client/about/; done
```

- [ ] **Step 8: `client/about/index.html` 을 조정한다**

파비콘 줄
```html
  <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">
```
을 다음으로 바꾼다.
```html
  <link rel="icon" href="/brand/book-path-32.png" type="image/png" sizes="32x32">
  <link rel="icon" href="/brand/book-path-favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/brand/book-path-180.png">
```

스타일·설정·진입 스크립트 세 줄
```html
  <link rel="stylesheet" href="./styles.css">
  <script src="./config.js"></script>
  <script type="module" src="./app.js"></script>
```
을 다음 한 줄로 바꾼다.
```html
  <script type="module" src="./main.js"></script>
```

'시작하기' 링크의 `href="http://127.0.0.1:4173/client/"` 를 `href="/"` 로 바꾸고, 영상 창의 `<video class="film-video" data-src="./assets/trailer.mp4" controls` 를 `<video class="film-video" controls` 로 바꾼다. PNG 경로 여섯 곳은 다음 명령으로 바꾼다.
```bash
sed -i -e 's/clay-journey-poster\.png/clay-journey-poster.webp/' -e 's/\(card-0[1-4]-[a-z-]*-a\)\.png/\1.webp/g' client/about/index.html
```

Run: `grep -cE '\.png|config\.js|styles\.css|app\.js|4173|data-src' client/about/index.html; grep -c -- '-a\.webp"' client/about/index.html; grep -c 'clay-journey-poster\.webp' client/about/index.html`
Expected: `2`(남은 `.png` 는 `/brand/book-path-32.png`, `/brand/book-path-180.png` 두 줄뿐), `5`(카드 4장과 확대 창), `1`.

- [ ] **Step 9: `client/about/main.js` 를 조정한다**

파일 맨 위, 첫 줄 `const $ = (selector, scope = document) => scope.querySelector(selector);` 앞에 다음 두 줄을 넣는다.
```js
import "./style.css";
import trailerUrl from "./assets/trailer.mp4";
```

영상 주소를 넣는 줄
```js
  if (!video.getAttribute('src')) video.src = video.dataset.src;
```
을 다음으로 바꾼다.
```js
  if (!video.getAttribute('src')) video.src = trailerUrl;
```

설정 주소를 읽는 다섯 줄을 지운다.
```js
const configuredUrl = window.ON_THE_BOOK_CONFIG?.serviceUrl || 'http://127.0.0.1:4173/client/';
try {
  const url = new URL(configuredUrl,location.href);
  if(['http:','https:'].includes(url.protocol)) $$('[data-service-link]').forEach(link => {link.href=url.href;});
} catch { /* The local service link remains usable when configuration is invalid. */ }
```

- [ ] **Step 10: 3D 모듈의 import 와 에셋 경로를 조정한다**

`client/about/scene.js` 와 `client/about/journey-presentation.js` 의 첫 줄
```js
import * as THREE from './assets/vendor/three.module.js';
```
을 다음으로 바꾼다.
```js
import * as THREE from 'three';
```

`client/about/clay-scene.js` 의 첫 두 줄
```js
import * as THREE from './assets/vendor/three.module.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
```
을 다음으로 바꾼다.
```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```

같은 파일의
```js
const asset = (name) => new URL(`./assets/${name}`, import.meta.url).href;
```
을 다음으로 바꾼다. `asset(...)` 을 부르는 줄(`clay-journey.json`, `clay-journey.glb`, `journey-${name}.webp`)은 그대로 둔다.
```js
// Static URLs let Vite fingerprint each file; a template path would bundle the whole folder.
const ASSET_URLS = {
  'clay-journey.json': new URL('./assets/clay-journey.json', import.meta.url).href,
  'clay-journey.glb': new URL('./assets/clay-journey.glb', import.meta.url).href,
  'journey-walk.webp': new URL('./assets/journey-walk.webp', import.meta.url).href,
  'journey-approach.webp': new URL('./assets/journey-approach.webp', import.meta.url).href,
  'journey-read.webp': new URL('./assets/journey-read.webp', import.meta.url).href,
};
const asset = (name) => ASSET_URLS[name];
```

- [ ] **Step 11: 원본과 달라진 곳만 바뀌었는지 확인한다**

Run:
```bash
SAMPLE="C:/Users/admin/Documents/temporary/on-the-book-brand/sample-02"
for pair in "app.js:main.js" "styles.css:style.css" "scene.js:scene.js" "clay-scene.js:clay-scene.js" "journey-camera.js:journey-camera.js" "journey-labels.js:journey-labels.js" "journey-presentation.js:journey-presentation.js" "index.html:index.html"; do s="${pair%%:*}"; t="${pair##*:}"; printf "%-24s " "$t"; git diff --no-index --numstat "$SAMPLE/$s" "client/about/$t" | awk '{print "+"$1" -"$2}'; echo; done
```
Expected(오른쪽이 비어 있으면 차이 없음):
- `main.js` `+3 -6`(import 2줄 추가, 영상 줄 1개 교체, 설정 5줄 삭제)
- `style.css`, `journey-camera.js`, `journey-labels.js` 차이 없음
- `scene.js`, `journey-presentation.js` `+1 -1`
- `clay-scene.js` `+11 -3`(import 2줄 교체, `asset` 1줄을 9줄로 교체)
- `index.html` `+12 -12`(파비콘 1→3줄, 스크립트 3→1줄, 대체 이미지·카드 4장·'시작하기'·영상 창·확대 창 7줄 교체)

숫자가 다르면 `git diff --no-index "$SAMPLE/<원본>" client/about/<대상>` 으로 Step 8~10 이외의 변경을 찾아 되돌린다.

- [ ] **Step 12: Vite 입력에 소개 페이지를 넣는다**

`vite.config.js` 전체를 다음으로 바꾼다.
```js
import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig(({ mode }) => ({
  build: {
    outDir: mode === "client" || mode === "admin" ? `dist/${mode}` : "dist",
    rollupOptions: {
      input: {
        client: resolve("client/index.html"),
        ...(mode === "admin" ? {} : { about: resolve("client/about/index.html") }),
        ...(mode === "client" ? {} : { admin: resolve("admin/index.html") }),
      },
    },
  },
}));
```

- [ ] **Step 13: 단위 검사가 통과하는지 확인한다**

Run: `node --test tests/about.test.js 2>&1 | grep -E "ℹ (pass|fail)"`
Expected: `ℹ pass 1`, `ℹ fail 0`.

- [ ] **Step 14: 빌드 결과를 확인한다**

Run: `npm run build 2>&1 | grep -E "error|built in"; test -f dist/client/about/index.html && echo about-built`
Expected: `✓ built in …`, `about-built`. 오류 줄이 없어야 한다.

Run:
```bash
mkdir -p test-results
for f in $(cd client/about/assets && find . -type f | sed 's#^\./##'); do n=$(basename "$f"); stem="${n%.*}"; ext="${n##*.}"; if ls dist/assets | grep -qE "^${stem}-[A-Za-z0-9_-]+\.${ext}$"; then echo "ok $n"; else echo "MISSING $n"; fi; done > test-results/about-assets.txt
grep -c '^ok ' test-results/about-assets.txt; grep MISSING test-results/about-assets.txt || echo no-missing
grep -cE 'card-0[1-4][^"]*\.png' dist/client/about/index.html
```
Expected: `17`, `no-missing`, `0`. 에셋 17개가 모두 해시 파일(`이름-해시.확장자`)로 `dist/assets` 에 있고, 빌드된 HTML 에 PNG 카드 경로가 없다.

- [ ] **Step 15: 브라우저 검사가 통과하는지 확인한다**

Run: `node tests/about.mjs`
Expected: 다음 열한 줄이 차례로 나오고 종료 코드 0. 한 줄이라도 빠지면 실패다.
```
PASS Hero book renders and turns when dragged
PASS Clay journey loads and walks past its three photos
PASS Walk, approach and read words move to their panels
PASS Scene gallery pages, enlarges, steps with arrows and returns focus
PASS Brand film opens in a dialog with the bundled trailer
PASS Motion control switches to the natural document flow
PASS Start link opens the reader home
PASS Reduced motion starts in the natural document flow
PASS Without WebGL the hero hides dragging and the journey shows its still image
PASS About page fits 390px without sideways scrolling
PASS About page fits 320px without sideways scrolling
```

- [ ] **Step 16: 스크린샷을 눈으로 확인한다**

`docs/screenshots/about-desktop.png` 와 `docs/screenshots/about-mobile.png` 를 연다. 큰 워드마크 "on the book✳", 입체 책과 정원, "책 속을 걷다." 제목, 오른쪽 아래 필름 티저가 보여야 한다. 빈 화면이거나 글꼴·색이 시안과 다르면 Step 8~10 을 다시 확인한다.

- [ ] **Step 17: 커밋한다**

```bash
git add client/about tests/about.test.js tests/about.mjs vite.config.js package.json docs/screenshots/about-desktop.png docs/screenshots/about-mobile.png
git status --short
git commit -F - <<'EOF'
Port the sample-02 brand page to the client as the about page

Move the page modules into client/about as a new Vite entry, import
npm three instead of the vendored copy, and let Vite fingerprint the
referenced assets. Scene cards and the journey still image are WebP.
The admin build leaves the page out.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
Expected: `git status --short` 에 위 파일만 보이고 커밋된다.

---

### Task 2: `/about` 주소를 로컬 서버와 Vercel 에 연결하기

**Files:**
- Modify: `server/index.js:290`, `client/vercel.json`, `tests/about.test.js`, `tests/about.mjs`

**Interfaces:**
- Consumes: Task 1 의 `tests/about.mjs` 첫 블록(`await page.goto(aboutUrl);` 로 시작), `startServer`.
- Produces: `GET /about`, `GET /about/` → `302 Location: /client/about/`(개발·완성본 공통). Vercel client rewrite 3개.

- [ ] **Step 1: 로컬 이동을 검사하는 실패 테스트를 더한다**

`tests/about.test.js` 의 import 에 `import { startServer } from "./helpers.js";` 를 더하고, 파일 끝에 다음을 붙인다.
```js
test("the local /about address opens the client about page", async () => {
  const server = await startServer(4332);
  try {
    for (const address of ["/about", "/about/"]) {
      const response = await fetch(server.url + address, { redirect: "manual" });
      assert.equal(response.status, 302, address);
      assert.equal(response.headers.get("location"), "/client/about/", address);
    }
  } finally {
    await server.stop();
  }
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test tests/about.test.js 2>&1 | grep -E "✔|✖|ℹ (pass|fail)"`
Expected: `✔ the about page is built with the reader but not with the studio`, `✖ the local /about address opens the client about page`(실제 상태 404), `ℹ pass 1`, `ℹ fail 1`.

- [ ] **Step 3: 브라우저 검사가 `/about` 으로 들어가게 한다**

`tests/about.mjs` 첫 블록의
```js
    const { context, page, problems } = await open();
    await page.goto(aboutUrl);
    await expect(page).toHaveTitle("On the Book — 책 속을 걷다");
    await expect(page.locator(".hero")).toHaveAttribute("data-book-world", "ready", slow);
```
를 다음으로 바꾼다.
```js
    const { context, page, problems } = await open();
    await page.goto(server.url + "/about");
    await expect(page).toHaveURL(aboutUrl);
    await expect(page).toHaveTitle("On the Book — 책 속을 걷다");
    pass("Local /about opens the about page");
    await expect(page.locator(".hero")).toHaveAttribute("data-book-world", "ready", slow);
```

- [ ] **Step 4: 서버에 이동을 추가한다**

`server/index.js` 의
```js
app.get("/", (req, res) => res.redirect("/client/"));
```
바로 아래에 다음 줄을 넣는다. Express 5 는 끝 슬래시를 구분하지 않으므로 `/about/` 도 이 경로로 온다.
```js
app.get("/about", (req, res) => res.redirect("/client/about/"));
```

- [ ] **Step 5: 단위 검사가 통과하는지 확인한다**

Run: `node --test tests/about.test.js 2>&1 | grep -E "ℹ (pass|fail)"`
Expected: `ℹ pass 2`, `ℹ fail 0`. `/about/` 에서 실패하면 Express 가 끝 슬래시를 구분하는 것이므로 `app.get(["/about", "/about/"], …)` 로 바꾼다.

- [ ] **Step 6: Vercel rewrite 를 더한다**

`client/vercel.json` 의
```json
    { "source": "/client/", "destination": "/client/index.html" }
```
를 다음으로 바꾼다.
```json
    { "source": "/client/", "destination": "/client/index.html" },
    { "source": "/about", "destination": "/client/about/index.html" },
    { "source": "/about/", "destination": "/client/about/index.html" },
    { "source": "/client/about/", "destination": "/client/about/index.html" }
```

Run: `node -e "const r=JSON.parse(require('node:fs').readFileSync('client/vercel.json','utf8')).rewrites; console.log(r.filter(x=>x.destination==='/client/about/index.html').map(x=>x.source).join(' '))"`
Expected: `/about /about/ /client/about/`. Vercel 에서의 실제 동작은 배포 후 확인 대상이다(스펙 8절).

- [ ] **Step 7: 완성본 브라우저 검사를 실행한다**

Run: `npm run test:about 2>&1 | grep -E "^PASS|Error|expect" | head -20`
Expected: 첫 줄 `PASS Local /about opens the about page` 를 포함해 `PASS` 열두 줄, 오류 없음.

- [ ] **Step 8: 개발 서버(`npm run dev` 와 같은 Vite 미들웨어)에서도 확인한다**

PowerShell 로 실행한다.
```powershell
$data = Join-Path $env:TEMP ("otb-about-dev-" + [guid]::NewGuid())
New-Item -ItemType Directory $data | Out-Null
$log = Join-Path $env:TEMP "otb-about-dev.log"; $errLog = Join-Path $env:TEMP "otb-about-dev.err.log"
$env:DATA_DIR = $data; $env:PORT = "4334"
$server = Start-Process node -ArgumentList "server/index.js" -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError $errLog
$code = 1
try {
  $ready = $false
  for ($i = 0; $i -lt 80 -and -not $ready; $i++) {
    try { $ready = (Invoke-WebRequest "http://127.0.0.1:4334/api/library" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { Start-Sleep -Milliseconds 250 }
  }
  if ($ready) { $env:ABOUT_BASE_URL = "http://127.0.0.1:4334"; node tests/about.mjs; $code = $LASTEXITCODE }
} finally {
  Stop-Process -Id $server.Id -Force
  Start-Sleep -Milliseconds 500
  try { Remove-Item -Recurse -Force $data -ErrorAction Stop } catch {}
}
if ($code -ne 0) { Get-Content $log, $errLog -Tail 40 }
exit $code
```
Expected: 완성본과 같은 `PASS` 열두 줄, 종료 코드 0. 서버 로그에 `new dependencies optimized` 와 `reloading` 이 찍힌 직후 실패했다면 Vite 가 의존성을 다시 묶으며 페이지를 새로 고친 것이므로 한 번 더 실행한다. 두 번째에도 실패하면 로그를 보고 원인을 고친다.

- [ ] **Step 9: 되돌릴 파일을 정리하고 커밋한다**

```bash
git restore docs/screenshots
git add server/index.js client/vercel.json tests/about.test.js tests/about.mjs
git status --short
git commit -F - <<'EOF'
Route /about to the about page locally and on Vercel

The local server redirects /about to /client/about/ the same way /
goes to /client/, and the client Vercel project rewrites /about and
/client/about/ to the built page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
Expected: `git status --short` 에 위 네 파일만 보이고 커밋된다.

---

### Task 3: client 헤더에 '소개' 링크 넣기

**Files:**
- Modify: `client/main.js:43`(`header()`), `shared/style.css:1172-1180` 다음, `tests/about.mjs`

**Interfaces:**
- Consumes: `tests/about.mjs` 의 `open`, `server`, `aboutUrl`, `pass`. `client/main.js` 모듈 상수 `draftPreview`(line 16).
- Produces: 헤더 `nav` 첫 요소 `<a id="about-link" class="text-button" href="/about">소개</a>`(초안 미리보기에는 없음).

측정값(2026-09-23, 헤드리스 Edge): 휴대폰 규칙에서 로고는 146px, '책장 둘러보기' 60px(+오른쪽 여백 4px), 소리 버튼 44px 이다. 320px 헤더 안쪽 폭은 288px 인데 '소개'를 44px 로 넣으면 298px 이 되어 소리 버튼이 오른쪽 여백을 10px 침범한다. 359px 이하에서 '소개' 36px, '책장 둘러보기' 여백 0 으로 하면 286px 로 들어간다. 360px 부터는 44px 로 26px 여유가 있다.

- [ ] **Step 1: 헤더 검사를 더한다**

`tests/about.mjs` 에서
```js
    pass(`About page fits ${viewport.width}px without sideways scrolling`);
  }
} finally {
```
를 다음으로 바꾼다.
```js
    pass(`About page fits ${viewport.width}px without sideways scrolling`);
  }
  {
    const { context, page, problems } = await open();
    await page.goto(server.url + "/client/");
    await page.locator("#about-link").click();
    await page.waitForURL(aboutUrl);
    await expect(page).toHaveTitle("On the Book — 책 속을 걷다");
    await page.goto(server.url + "/client/?preview=draft");
    await expect(page.locator("#library-button")).toBeVisible();
    await expect(page.locator("#about-link")).toHaveCount(0);
    expect(problems).toEqual([]);
    await context.close();
    pass("Reader header links to /about; the draft preview leaves the link out");
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 560 }]) {
    const { context, page, problems } = await open({ viewport, isMobile: true, hasTouch: true });
    await page.goto(server.url + "/client/");
    await expect(page.locator("#about-link")).toBeVisible();
    await expect(page.locator(".reader-curtain")).toHaveCount(0);
    const layout = await page.evaluate(() => {
      const box = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { selector, left: r.left, right: r.right };
      };
      return { header: box(".site-header"), items: [".site-header .brand", "#about-link", "#library-button", "#sound-button"].map(box) };
    });
    layout.items.forEach((item, i) => {
      expect(item.left, `${item.selector} starts inside the header`).toBeGreaterThanOrEqual(layout.header.left - 0.5);
      expect(item.right, `${item.selector} ends inside the header`).toBeLessThanOrEqual(layout.header.right + 0.5);
      if (i) expect(item.left, `${item.selector} clears ${layout.items[i - 1].selector}`).toBeGreaterThanOrEqual(layout.items[i - 1].right - 0.5);
    });
    await page.locator(".site-header").screenshot({ path: `test-results/about-link-header-${viewport.width}.png` });
    expect(problems).toEqual([]);
    await context.close();
    pass(`Reader header fits the about link at ${viewport.width}px`);
  }
} finally {
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm run test:about 2>&1 | grep -E "^PASS|Error|about-link" | tail -6`
Expected: 앞의 `PASS` 열두 줄 뒤, `#about-link` 를 찾지 못해 시간 초과로 실패한다.

- [ ] **Step 3: 헤더에 링크를 넣는다**

`client/main.js` 의 `header()` 안에서
```js
<nav aria-label="주 메뉴"><button id="library-button" class="text-button">책장 둘러보기</button>
```
를 다음으로 바꾼다(같은 줄의 나머지는 그대로 둔다).
```js
<nav aria-label="주 메뉴">${draftPreview ? "" : '<a id="about-link" class="text-button" href="/about">소개</a>'}<button id="library-button" class="text-button">책장 둘러보기</button>
```

- [ ] **Step 4: 휴대폰 규칙을 더한다**

`shared/style.css` 에서
```css
  nav #library-button {
    font-size: 10px;
    width: 60px;
    white-space: nowrap;
  }
}
```
를 다음으로 바꾼다.
```css
  nav #library-button {
    font-size: 10px;
    width: 60px;
    white-space: nowrap;
  }
}
nav #about-link:hover {
  text-decoration: none;
}
@media (max-width: 700px) {
  nav #about-link {
    font-size: 10px;
    width: 44px;
    white-space: nowrap;
  }
}
@media (max-width: 359px) {
  nav #about-link {
    width: 36px;
  }
  nav #library-button {
    margin-right: 0;
  }
}
```

- [ ] **Step 5: 브라우저 검사가 통과하는지 확인한다**

Run: `npm run test:about 2>&1 | grep -E "^PASS|Error"`
Expected: `PASS` 열다섯 줄. 마지막 세 줄은 다음과 같다.
```
PASS Reader header links to /about; the draft preview leaves the link out
PASS Reader header fits the about link at 390px
PASS Reader header fits the about link at 320px
```

- [ ] **Step 6: 헤더 캡처를 눈으로 확인한다**

`test-results/about-link-header-390.png`, `test-results/about-link-header-320.png` 를 연다. "on the book." 로고 오른쪽에 '소개', '책장 둘러보기', 소리 아이콘이 겹치지 않고 서로 구분되어 보여야 한다.

- [ ] **Step 7: 기존 휴대폰·브라우저 회귀 검사를 실행한다**

Run: `node tests/mobile-entry.mjs; echo "mobile-entry exit $?"; node tests/browser.mjs > test-results/browser.log 2>&1; echo "browser exit $?"; tail -3 test-results/browser.log`
Expected: `mobile-entry exit 0`, `browser exit 0`, 로그 끝에 실패 메시지가 없다(`browser.mjs` 는 `PASS` 줄을 출력한다).

- [ ] **Step 8: 되돌릴 파일을 정리하고 커밋한다**

```bash
git restore docs/screenshots docs/browser-results.json
git add client/main.js shared/style.css tests/about.mjs
git status --short
git commit -F - <<'EOF'
Link the reader header to the about page

Add a 소개 link before the bookshelf button, leave it out of the
studio draft preview, and keep it on one row down to 320px wide.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
Expected: `git status --short` 에 위 세 파일만 보이고 커밋된다.

---

### Task 4: 시안과 나란히 비교하고 소개 페이지 문서 쓰기

**Files:**
- Create: `tests/about-compare.mjs`, `docs/ABOUT-PAGE.md`

**Interfaces:**
- Consumes: Task 1~3 이 끝난 완성본 빌드(`npm run build`), 시안 서버 `http://127.0.0.1:4380/sample-02/`.
- Produces: CLI `node tests/about-compare.mjs <reference-url> <candidate-url> [output-dir]` → `<output-dir>/<desktop|mobile>-motion-<on|off>-<stop>-<reference|candidate>.png`(기본 `test-results/about-compare`). stop 은 `1-hero`, `2-world-1..3`(모션 켜짐) 또는 `2-world`(모션 꺼짐), `3-experience`, `4-scenes`, `5-film`, `6-footer`.

- [ ] **Step 1: 비교 도구를 쓴다**

`tests/about-compare.mjs`
```js
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Captures a reference page and a candidate page at the same sizes and scroll stops for side-by-side review.
// Usage: node tests/about-compare.mjs <reference-url> <candidate-url> [output-dir]
const [reference, candidate, out = "test-results/about-compare"] = process.argv.slice(2);
if (!reference || !candidate) {
  console.error("Usage: node tests/about-compare.mjs <reference-url> <candidate-url> [output-dir]");
  process.exit(1);
}
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: "msedge",
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

// Runs in the page: one stop per section, and one per photo while the clay journey is pinned.
function scrollStops() {
  const top = (selector) => document.querySelector(selector).getBoundingClientRect().top + scrollY;
  const world = document.querySelector(".world");
  const range = world.offsetHeight - document.querySelector(".world-stage").offsetHeight * 2;
  const stops = { "1-hero": 0 };
  if (document.documentElement.classList.contains("natural-flow")) stops["2-world"] = top(".world");
  else [0.14, 0.42, 0.7].forEach((fraction, i) => (stops[`2-world-${i + 1}`] = top(".world") + range * fraction));
  return { ...stops, "3-experience": top("#experience"), "4-scenes": top("#scenes"), "5-film": top("#film"), "6-footer": top("#start") };
}

try {
  for (const [size, viewport] of Object.entries(sizes)) {
    for (const motion of ["on", "off"]) {
      for (const [label, url] of [["reference", reference], ["candidate", candidate]]) {
        const mobile = size === "mobile";
        const context = await browser.newContext({
          viewport,
          isMobile: mobile,
          hasTouch: mobile,
          reducedMotion: motion === "off" ? "reduce" : "no-preference",
        });
        const page = await context.newPage();
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => ["ready", "fallback"].includes(document.querySelector(".hero")?.dataset.bookWorld), null, { timeout: 20000 });
        for (const stop of Object.keys(await page.evaluate(scrollStops))) {
          // Recompute each stop because the journey can change the page height once it loads.
          const y = (await page.evaluate(scrollStops))[stop];
          await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
          if (stop.startsWith("2-world"))
            await page.waitForFunction(() => ["ready", "fallback"].includes(document.querySelector(".world").dataset.journey), null, { timeout: 30000 });
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${out}/${size}-motion-${motion}-${stop}-${label}.png` });
        }
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log(`Saved captures to ${out}`);
```

- [ ] **Step 2: 두 서버를 띄우고 캡처한다**

먼저 `npm run build` 로 완성본을 만든다. 이어서 PowerShell 로 실행한다. 시안 서버가 이미 떠 있으면 그대로 쓰고, 이 단계가 띄운 서버만 끝에 종료한다.
```powershell
$data = Join-Path $env:TEMP ("otb-about-compare-" + [guid]::NewGuid())
New-Item -ItemType Directory $data | Out-Null
$env:DATA_DIR = $data; $env:PORT = "4335"
$candidate = Start-Process node -ArgumentList "server/index.js","--production" -NoNewWindow -PassThru -RedirectStandardOutput (Join-Path $env:TEMP "otb-compare.log") -RedirectStandardError (Join-Path $env:TEMP "otb-compare.err.log")
$brand = $null
try { Invoke-WebRequest "http://127.0.0.1:4380/sample-02/" -UseBasicParsing -TimeoutSec 2 | Out-Null } catch {
  $env:PORT = "4380"
  $brand = Start-Process node -ArgumentList "C:/Users/admin/Documents/temporary/on-the-book-brand/scripts/serve.mjs" -NoNewWindow -PassThru -RedirectStandardOutput (Join-Path $env:TEMP "otb-brand.log") -RedirectStandardError (Join-Path $env:TEMP "otb-brand.err.log")
}
$code = 1
try {
  $ready = $false
  for ($i = 0; $i -lt 80 -and -not $ready; $i++) {
    try {
      $a = (Invoke-WebRequest "http://127.0.0.1:4335/client/about/" -UseBasicParsing -TimeoutSec 2).StatusCode
      $b = (Invoke-WebRequest "http://127.0.0.1:4380/sample-02/" -UseBasicParsing -TimeoutSec 2).StatusCode
      $ready = ($a -eq 200) -and ($b -eq 200)
    } catch { Start-Sleep -Milliseconds 250 }
  }
  if ($ready) { node tests/about-compare.mjs "http://127.0.0.1:4380/sample-02/" "http://127.0.0.1:4335/client/about/"; $code = $LASTEXITCODE }
} finally {
  Stop-Process -Id $candidate.Id -Force
  if ($brand) { Stop-Process -Id $brand.Id -Force }
  Start-Sleep -Milliseconds 500
  try { Remove-Item -Recurse -Force $data -ErrorAction Stop } catch {}
}
exit $code
```
Expected: `Saved captures to test-results/about-compare`, 종료 코드 0. Run: `ls test-results/about-compare | wc -l` → `56`(크기 2 × 모션 2 × 페이지 2 × 위치 8 또는 6).

- [ ] **Step 3: 쌍마다 SSIM 을 구한다**

Run:
```bash
(cd test-results/about-compare && for ref in *-reference.png; do name="${ref%-reference.png}"; printf "%-34s %s\n" "$name" "$(ffmpeg -hide_banner -i "$ref" -i "$name-candidate.png" -lavfi ssim -f null - 2>&1 | grep -oE 'All:[0-9.]+' | cut -d: -f2)"; done) | tee test-results/about-compare/ssim.txt
```
Expected: 28줄. `motion-off` 의 `3-experience`, `4-scenes`, `5-film`, `6-footer` 여덟 줄(데스크톱·휴대폰)은 0.97 이상이어야 한다.

- [ ] **Step 4: 눈으로 비교한다**

SSIM 이 0.97 미만인 쌍과, 값과 관계없이 `desktop-motion-on-*` 여덟 쌍을 열어 `reference`·`candidate` 를 나란히 본다. 배치·문구·색·동작의 차이를 찾는다. 책 색 순환 시점, 필름 자동 재생 프레임, 점토 길 빛처럼 시간에 따른 차이는 제외한다. 이식 코드가 원인인 차이(에셋 누락, 스타일 누락, 경로 오류)를 찾으면 Task 1 파일을 고치고 Task 1 Step 13~15 를 다시 통과시킨 뒤 이 Task 를 처음부터 다시 한다.

- [ ] **Step 5: 소개 페이지 문서를 쓴다**

`docs/ABOUT-PAGE.md` 를 다음 내용으로 만든다. 마지막 표의 `SSIM` 칸은 Step 3 의 `ssim.txt` 값을 소수 셋째 자리까지 옮기고, 해당 캡처가 없는 칸은 `—` 로 둔다. 표 아래 목록에는 Step 4 에서 본 시간에 따른 차이와, 차이가 없었던 구간을 사실대로 적는다.

````markdown
# 소개 페이지(/about)

브랜드 시안 sample-02를 사용자 화면의 소개 페이지로 옮겼습니다. 주소는 `/about`이며 로컬에서는 `/client/about/`으로 이동합니다. 설계는 [소개 페이지 설계](superpowers/specs/2026-09-23-about-page-design.md)에 있습니다.

## 출처

- 시안: 저장소 옆 폴더 `../on-the-book-brand/sample-02`(2026-09-22 판)
- 옮긴 파일: `index.html`, `app.js`(→ `main.js`), `styles.css`(→ `style.css`), `scene.js`, `clay-scene.js`, `journey-camera.js`, `journey-labels.js`, `journey-presentation.js`, 페이지가 참조하는 에셋
- 옮기지 않은 원본: Blender 편집 파일과 모델 스크립트(`models/`), 생성 이미지 원본과 생성 지시(`models/generated-images/`), 조사·검토 자료(`review/`). 시안 폴더에서 확인합니다.

## 확인할 동작

| 구간 | 확인할 동작 |
| --- | --- |
| 첫 화면의 책과 정원 | 책을 좌우로 끌어 돌립니다. 책 색은 2초마다 바뀌고, 아래로 스크롤하면 책의 방향과 페이지 간격이 달라지며 정원이 자랍니다. |
| 짙은 초록의 이야기 구간 | 스크롤하면 점토 나선길을 따라 시선이 전진하고, 세 사진에 도착할 때마다 햇빛과 사진 옆 설명이 나타납니다. 위로 스크롤하면 되돌아갑니다. |
| 걷고·다가가고·읽고 | 컴퓨터에서는 세 열이 잠시 고정되고 구간이 차례로 바뀝니다. 단어를 누르거나 방향키·Home·End로 이동합니다. 폭 760px 이하에서는 세로로 이어집니다. |
| 장면 갤러리 | 끌거나 이전·다음 버튼, 방향키·Home·End로 넘깁니다. 이미지를 누르면 크게 보는 창이 열립니다. |
| 브랜드 필름 | 스크롤하면 필름이 화면 너비까지 펼쳐지고 음소거로 재생됩니다. 누르면 소리와 조작이 있는 영상 창이 열립니다. |
| 푸터 | 선화와 글이 스크롤에 따라 나타납니다. 'On the Book 시작하기'는 사용자 화면 첫 화면으로 이동합니다. |
| 모션 | 왼쪽 아래 '모션 켜짐'을 누르면 움직임을 끄고 문서처럼 읽습니다. 기기의 움직임 줄이기와 높이 650px 이하 화면에서도 같습니다. |

사용자 화면 헤더의 '소개'에서 이 페이지로 들어옵니다. 관리자 초안 미리보기에는 이 링크가 없습니다.

## 시안과 달라진 점

| 시안 | 소개 페이지 |
| --- | --- |
| 폴더에 복사한 Three.js(`public/assets/vendor`) | 프로젝트 의존성 `three` 0.180 |
| `config.js`의 서비스 주소 | '시작하기' 링크를 `/`로 고정 |
| 시안 전용 파비콘 | 사용자 화면과 같은 `/brand/*` 아이콘 |
| 장면 카드 4장·점토 길 대체 이미지 PNG | WebP(품질 90, 크기 동일, 대체 이미지는 투명 유지) |
| 자체 정적 서버와 빌드 스크립트 | client Vite 빌드의 `about` 입력, Express·Vercel 주소 연결 |

화면 구성, 문구, 글꼴(Manrope, Noto Sans KR), 색, 로고, 움직임은 바꾸지 않았습니다.

## 에셋

`client/about/assets/`에는 페이지가 참조하는 파일 17개만 있습니다. 빌드하면 해시가 붙은 파일명으로 나가며 관리자 빌드에는 들어가지 않습니다.

| 파일 | 처리 | 크기 |
| --- | --- | --- |
| `trailer.mp4` | 그대로 | 9.0MB |
| `clay-journey.glb`, `clay-journey.json` | 그대로 | 1.4MB, 87KB |
| `journey-walk.webp`, `journey-approach.webp`, `journey-read.webp` | 그대로 | 합계 1.1MB |
| `garden.webp`, `wander.webp`, `invitation.webp` | 그대로 | 합계 406KB |
| `footer-books-hairline.webp`, `footer-door-hairline.webp`, `footer-reader-hairline.webp` | 그대로 | 합계 266KB |
| `scene-concepts/card-0N-*-a.webp` 4장 | PNG에서 변환 | 합계 1.3MB |
| `clay-journey-poster.webp` | PNG에서 변환 | 39KB |

변환 명령입니다.

```bash
ffmpeg -i <원본>.png -c:v libwebp -quality 90 -compression_level 6 <대상>.webp
```

## 검증

- `npm test`: 빌드 입력(client·about·admin)과 로컬 `/about` 이동을 확인합니다.
- `npm run test:about`: 빌드 후 브라우저 검사를 실행합니다. 책·점토 길·구간 이동·갤러리·필름·모션·대체 화면·휴대폰 폭·헤더 링크를 확인합니다. `ABOUT_BASE_URL=http://127.0.0.1:4173 node tests/about.mjs`로 실행 중인 서버를 검사할 수도 있습니다.
- `node tests/about-compare.mjs <기준 주소> <비교 주소>`: 두 페이지를 같은 화면 크기와 스크롤 위치에서 찍어 `test-results/about-compare/`에 저장합니다.

## 시안 비교 결과(2026-09-23)

기준 `http://127.0.0.1:4380/sample-02/`, 비교 `http://127.0.0.1:4335/client/about/`(완성본)을 1440×900, 390×844에서 모션 켜짐·꺼짐으로 찍었습니다.

| 위치 | 데스크톱 켜짐 | 데스크톱 꺼짐 | 휴대폰 켜짐 | 휴대폰 꺼짐 |
| --- | --- | --- | --- | --- |
| 1-hero | SSIM | SSIM | SSIM | SSIM |
| 2-world-1 | SSIM | — | SSIM | — |
| 2-world-2 | SSIM | — | SSIM | — |
| 2-world-3 | SSIM | — | SSIM | — |
| 2-world | — | SSIM | — | SSIM |
| 3-experience | SSIM | SSIM | SSIM | SSIM |
| 4-scenes | SSIM | SSIM | SSIM | SSIM |
| 5-film | SSIM | SSIM | SSIM | SSIM |
| 6-footer | SSIM | SSIM | SSIM | SSIM |

- (Step 4에서 본 시간에 따른 차이와 그 위치)
- (차이가 없었던 구간)
````

작성 후 Run: `grep -nE '\| SSIM|\(Step 4|\(차이가' docs/ABOUT-PAGE.md`
Expected: 출력 없음(모든 칸과 목록을 실제 값으로 채웠다).

- [ ] **Step 6: 커밋한다**

```bash
git add tests/about-compare.mjs docs/ABOUT-PAGE.md
git status --short
git commit -F - <<'EOF'
Document the about page and compare it with the sample-02 draft

Add a capture tool that shoots two versions of the page at the same
sizes and scroll stops, record the side-by-side SSIM results, and
describe the page's source, behaviour, changes and assets.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
Expected: 두 파일만 커밋된다(`test-results/` 는 무시 대상).

---

### Task 5: 문서·전환 스펙·1단계 계획 갱신과 최종 회귀

**Files:**
- Modify: `README.md`, `docs/DEPLOYMENT.md`, `docs/superpowers/specs/2026-09-11-react-next-migration-design.md`, `docs/superpowers/plans/2026-09-14-phase1-monorepo-api.md`

**Interfaces:**
- Consumes: Task 1~4 결과(주소, 스크립트 `test:about`, 파일 `tests/about.test.js`·`tests/about.mjs`·`tests/about-compare.mjs`, 문서 `docs/ABOUT-PAGE.md`).
- Produces: 없음(문서만).

- [ ] **Step 1: README 를 고친다**

`- 관리자 화면: http://127.0.0.1:4173/admin/` 줄 아래에 다음 줄을 넣는다.
```markdown
- 소개 페이지: http://127.0.0.1:4173/about (로컬에서는 `/client/about/`으로 이동합니다)
```

'데이터와 원본 보관' 목록의 `- `shared`: 공통 3D 화면, 모델 생성, 데이터 검증, 스타일` 줄 아래에 다음 줄을 넣는다.
```markdown
- `client/about`: 브랜드 시안 sample-02를 옮긴 소개 페이지. 출처와 에셋은 `docs/ABOUT-PAGE.md`를 참고하세요.
```

'검증 실행' 코드 블록의 `node tests/floor-reading.mjs` 아래에 `npm run test:about` 줄을 넣는다.

- [ ] **Step 2: 배포 안내를 고친다**

`docs/DEPLOYMENT.md` 의 문장
```markdown
공개 화면 이동은 `VITE_CLIENT_URL`을 사용합니다.
```
을 다음으로 바꾼다(같은 문단 안에서 문장 하나를 더한다).
```markdown
공개 화면 이동은 `VITE_CLIENT_URL`을 사용합니다. 사용자 프로젝트는 `/about`, `/about/`, `/client/about/`을 소개 페이지로 연결하며, 관리자 빌드에는 소개 페이지가 포함되지 않습니다.
```

- [ ] **Step 3: 전환 스펙에 소개 페이지를 넣는다**

`docs/superpowers/specs/2026-09-11-react-next-migration-design.md` 를 다음과 같이 고친다.

1. 첫 문단
```markdown
작성일 2026-09-11. 이 문서는 전환 전체의 아키텍처와 단계 경계를 정의하는 상위 스펙이다. 각 단계는 이 문서를 기준으로 별도 구현 계획을 만든다.
```
을 다음으로 바꾼다.
```markdown
작성일 2026-09-11. 이 문서는 전환 전체의 아키텍처와 단계 경계를 정의하는 상위 스펙이다. 각 단계는 이 문서를 기준으로 별도 구현 계획을 만든다. 2026-09-23 소개 페이지(`/about`) 추가를 3·4·10·14·16절에 반영했다.
```
2. 3절의
```markdown
- 사용자 화면 URL: `/`, `/client/`, 쿼리 `book`, `chapter`, `preview=draft`, `model`. 관리자 URL: `/admin/`.
```
를 다음으로 바꾼다.
```markdown
- 사용자 화면 URL: `/`, `/client/`, 쿼리 `book`, `chapter`, `preview=draft`, `model`. 소개 페이지 `/about`(로컬 `/client/about/`). 관리자 URL: `/admin/`.
```
3. 4절 저장소 구조의 `  app/page.tsx               /  독서 경험` 줄 아래에 다음 줄을 넣는다.
```
  app/about/page.tsx         /about  소개 페이지(client/about 이식)
```
4. 10절의 `- WebGL 불가 시 현재의 설명·본문 읽기 대안을 유지한다.` 줄 아래에 다음 항목을 넣는다.
```markdown
- 소개 페이지 `app/about/page.tsx`: 2026-09-23 에 `client/about` 으로 추가한 바닐라 페이지를 옮긴다. client 컴포넌트가 `useEffect` 로 명령형 3D 모듈(`createBookScene`, `createClayJourney`, `createJourneyLabels`)과 스크롤 연출을 감싸고, 에셋은 `client/about/assets` 에서 앱 쪽으로 옮긴다. 이관 전후 화면은 `tests/about-compare.mjs` 로 비교한다. 설계는 `2026-09-23-about-page-design.md`.
```
5. 14절의
```markdown
현재 11개 스크립트(`admin-parity`, `browser`, `collision`, `floor-editor`, `floor-reading`, `leave-guard`, `mobile-entry`, `model-thumbnails`, `workspace`, `capture`, `cloud`) 의 검증을 spec 으로 이관한다.
```
를 다음으로 바꾼다.
```markdown
현재 12개 스크립트(`admin-parity`, `browser`, `collision`, `floor-editor`, `floor-reading`, `leave-guard`, `mobile-entry`, `model-thumbnails`, `workspace`, `capture`, `cloud`, `about`) 의 검증을 spec 으로 이관한다.
```
6. 16절 6단계 줄
```markdown
6. `@otb/reader` 와 사용자 앱, `/admin/preview`: 10절. 완료 기준: `floor-reading`, `mobile-entry`, `browser` 의 사용자 검증 이관 통과, 390×844 스크린샷.
```
을 다음으로 바꾼다.
```markdown
6. `@otb/reader` 와 사용자 앱(소개 페이지 포함), `/admin/preview`: 10절. 완료 기준: `floor-reading`, `mobile-entry`, `browser` 의 사용자 검증과 `about` 검증 이관 통과, `tests/about-compare.mjs` 로 이관 전후 소개 페이지 비교, 390×844 스크린샷.
```

Run: `grep -c "about" docs/superpowers/specs/2026-09-11-react-next-migration-design.md`
Expected: `6`(편집 전 `0`. 첫 문단, 3·4·10·14·16절에 한 줄씩).

- [ ] **Step 4: 1단계 계획을 고친다**

`docs/superpowers/plans/2026-09-14-phase1-monorepo-api.md` 를 다음과 같이 고친다.

1. Task 1 의 package.json 블록에서
```json
    "legacy:test:mobile": "npm run legacy:build && node tests/mobile-entry.mjs"
```
를 다음으로 바꾼다.
```json
    "legacy:test:mobile": "npm run legacy:build && node tests/mobile-entry.mjs",
    "legacy:test:about": "npm run legacy:build && node tests/about.mjs"
```
2. Task 1 Step 5 의 기대 출력 `ℹ tests 24`, `ℹ pass 24` 를 `ℹ tests 26`, `ℹ pass 26` 으로 바꾼다.
3. 마지막 검증 단계의 "`legacy:test` 는 `ℹ pass 24`." 를 "`legacy:test` 는 `ℹ pass 26`." 으로 바꾼다.
4. 줄
```markdown
기존 `tests/*.test.js` 의 검증을 그대로 옮긴다. 파일 다섯 개를 만든다.
```
을 다음으로 바꾼다.
```markdown
기존 `tests/*.test.js` 의 검증을 그대로 옮긴다. 파일 다섯 개를 만든다. `tests/about.test.js` 는 구 Vite 입력과 Express `/about` 이동을 검사하므로 옮기지 않는다(6단계에서 Next 라우트 검사로 대체한다).
```

Run: `grep -nE "legacy:test:about|ℹ (tests|pass) 2[46]|about\.test\.js" docs/superpowers/plans/2026-09-14-phase1-monorepo-api.md`
Expected: 다섯 줄. `"legacy:test:about"` 스크립트 줄, `ℹ tests 26`, `ℹ pass 26`(Task 1 Step 5), "`legacy:test` 는 `ℹ pass 26`."(마지막 검증), `tests/about.test.js` 안내 줄. `24` 가 들어간 줄은 없다.

- [ ] **Step 5: 최종 회귀를 실행한다**

Run(순서대로. 모드별 빌드를 먼저 하고 기본 빌드를 마지막에 해야 이후 검사가 기본 빌드 결과를 쓴다):
```bash
npm test 2>&1 | grep -E "ℹ (tests|pass|fail)"
npm run build:client >/dev/null && test -f dist/client/client/about/index.html && echo client-build-has-about
npm run build:admin >/dev/null && test -f dist/admin/client/index.html && test ! -e dist/admin/client/about && echo admin-build-without-about
npm run build >/dev/null && echo default-build-ok
npm run test:e2e
node tests/floor-reading.mjs
node tests/mobile-entry.mjs
node tests/browser.mjs
node tests/about.mjs
```
Expected: `ℹ tests 26`, `ℹ pass 26`, `ℹ fail 0`, `client-build-has-about`, `admin-build-without-about`, `default-build-ok`. 이어지는 다섯 스크립트는 모두 종료 코드 0이고 `tests/about.mjs` 는 `PASS` 열다섯 줄을 출력한다.

- [ ] **Step 6: 되돌릴 파일을 정리하고 커밋한다**

```bash
git restore docs/screenshots docs/floor-evidence docs/browser-results.json
git add README.md docs/DEPLOYMENT.md docs/superpowers/specs/2026-09-11-react-next-migration-design.md docs/superpowers/plans/2026-09-14-phase1-monorepo-api.md
git status --short
git commit -F - <<'EOF'
Document the about page route and carry it into the migration plans

List the /about address and test command in the README and deployment
notes, add the page to the React + Next migration spec so phase 6
ports it, and keep the phase 1 plan's legacy scripts and test counts
in step with the new tests.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git status --short
```
Expected: 네 파일이 커밋되고 마지막 `git status --short` 는 비어 있다.
