# On the Book: 소개 페이지(/about) 추가 설계

작성일 2026-09-23. 브랜드 시안 sample-02 를 사용자 화면(client)의 `/about` 소개 페이지로 옮기는 설계다.

## 1. 배경과 목표

sample-02 는 저장소 옆 폴더 `../on-the-book-brand/sample-02` 에 있는 독립 브랜드 페이지다. 자체 정적 서버(`scripts/serve.mjs`, 4380 포트), 폴더 안에 복사해 둔 Three.js r180(`public/assets/vendor`), 서비스 주소 설정 파일(`config.js`)로 동작한다. 코드는 HTML 175줄, CSS 269줄(42KB), JS 약 1,640줄이다.

사용자가 정한 방향은 다음과 같다.

- 주소는 `/about` 이다.
- 기준은 현재 client 스택(Vite 멀티 페이지 + 바닐라 JS + npm `three` 0.180)이다. sample-02 를 이 스택에 맞게 바꾼다.

목표는 시안의 화면·동작·문구를 그대로 유지하면서 client 의 빌드·서버·배포·테스트 체계 안으로 들이는 것이다.

## 2. 범위와 비범위

범위
- sample-02 전 구간: 히어로 입체 책(드래그 회전, 2초 간격 색 변화, 스크롤 연출), 점토 나선길(GLB·사진 세 장·시선 전진·햇빛·사진 옆 설명), 걷고·다가가고·읽고(고정 스크롤·단어 이동), 장면 갤러리(드래그·키보드·확대 창), 브랜드 필름(펼침·자동 재생·영상 창), 선화 푸터, 모션 켜기/끄기, 움직임 줄이기·낮은 화면·WebGL 불가 대체.
- client 헤더의 '소개' 링크.
- 로컬 서버와 Vercel client 배포의 `/about` 연결.
- 테스트, 문서, 전환 스펙과 1단계 계획 반영.

비범위
- 디자인과 문구 변경. 글꼴(Manrope, Noto Sans KR), 색, 로고(선으로 그린 책 아이콘과 ✳ 워드마크)는 시안 그대로 두고 client 의 로고·글꼴과 통일하지 않는다. 링크 대상 외에는 문구를 바꾸지 않는다.
- React·TypeScript·R3F 전환. 전환 스펙 6단계에서 한다.
- 관리자 화면 변경, 관리자 배포에 소개 페이지를 넣는 일.
- sample-02 원본 폴더 수정. Blender 원본(`models/`), 생성 이미지 원본, 검토 자료(`review/`) 이관.

## 3. 주소와 연결

| 환경 | 주소 | 처리 |
| --- | --- | --- |
| 로컬 개발 `npm run dev` | `/about`, `/about/` | 302 로 `/client/about/`. Vite 미들웨어(appType `mpa`)가 `client/about/index.html` 을 제공한다 |
| 로컬 완성본 `npm start` | `/about`, `/about/` | 302 로 `/client/about/`. `express.static(dist)` 가 `dist/client/about/index.html` 을 제공한다 |
| Vercel client | `/about`, `/about/`, `/client/about/` | rewrite 로 `/client/about/index.html` 을 바로 제공한다 |
| Vercel admin | 없음 | 관리자 빌드에 포함하지 않는다 |

로컬 이동은 현재 `/` → `/client/` 와 같은 방식이다. 빌드된 HTML 은 `/assets/…` 절대 경로를 쓰므로 Vercel 에서 `/about` 주소로 제공해도 자산 경로가 깨지지 않는다.

연결
- client 헤더 `nav` 의 첫 항목('책장 둘러보기' 앞)으로 `<a id="about-link" class="text-button" href="/about">소개</a>` 를 둔다. 초안 미리보기(`?preview=draft`)에서는 렌더하지 않는다. 관리자 배포에는 소개 페이지가 없기 때문이다.
- 휴대폰(≤700px)에서는 현재 `nav .text-button { font-size: 0; width: 44px }` 규칙이 글자를 숨긴다. `#about-link` 에 `#library-button` 과 같은 10px 글자, 44px 너비 규칙을 둔다. 320px 에서는 로고(146px)와 버튼 셋을 더한 폭이 헤더 안쪽 폭보다 10px 넓어 소리 버튼이 오른쪽 여백을 침범하므로, 359px 이하에서는 `#about-link` 너비를 36px 로 줄이고 `#library-button` 의 오른쪽 여백 4px 를 없앤다(2026-09-23 측정).
- 소개 페이지의 'On the Book 시작하기'(`data-service-link`)는 `href="/"` 로 고정한다. 로컬에서는 `/client/` 로 이동한다.
- 소개 페이지 헤더 로고, 푸터 심벌, '처음으로'는 시안처럼 `#beginning` 으로 이동한다. 페이지 안 링크(`#world`, `#experience`, `#scenes`, `#way-panel-*`)도 그대로 둔다.

## 4. 파일 구조

```
client/about/
  index.html               시안 index.html. 구조·문구·클래스 유지
  main.js                  시안 app.js
  style.css                시안 styles.css. main.js 에서 import
  scene.js                 히어로 입체 책·정원
  clay-scene.js            점토 나선길
  journey-camera.js        스크롤 진행에 따른 시선
  journey-labels.js        사진 옆 설명 배치
  journey-presentation.js  사진 전진·정면 회전
  assets/                  6절의 에셋
```

진입점(`app.js` → `main.js`)과 스타일(`styles.css` → `style.css`)만 client 관례에 맞춰 이름을 바꾸고, 나머지는 원본과 비교하기 쉽도록 이름을 유지한다. 소개 페이지는 `shared/` 의 코드와 `shared/style.css` 를 불러오지 않는 독립 진입점이다. 같은 클래스 이름(`.site-header`, `.hero-copy`, `.eyebrow` 등)이 있어도 서로 다른 페이지라 충돌하지 않는다.

변경하는 기존 파일: `vite.config.js`, `server/index.js`, `client/vercel.json`, `client/main.js`, `shared/style.css`, `package.json`(스크립트만), `README.md`, `docs/DEPLOYMENT.md`, 전환 스펙, 1단계 계획.

새 파일: `client/about/**`, `tests/about.test.js`, `tests/about.mjs`, `tests/about-compare.mjs`, `docs/ABOUT-PAGE.md`, `docs/screenshots/about-desktop.png`, `docs/screenshots/about-mobile.png`.

## 5. sample-02 조정

로직, 문구, 클래스 이름, 데이터 속성은 바꾸지 않는다. 바꾸는 것은 다음뿐이다.

| 시안 | client |
| --- | --- |
| `import * as THREE from './assets/vendor/three.module.js'`(scene, clay-scene, journey-presentation) | `import * as THREE from "three"` |
| `import { GLTFLoader } from './assets/vendor/GLTFLoader.js'` | `import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"` |
| `<script src="./config.js">` 와 `window.ON_THE_BOOK_CONFIG.serviceUrl` 로 링크 주소를 바꾸는 코드 | 삭제. 링크는 `href="/"` |
| `<link rel="stylesheet" href="./styles.css">` | `main.js` 첫머리 `import "./style.css"` |
| `<script type="module" src="./app.js">` | `<script type="module" src="./main.js">` |
| 영상 창 `<video data-src="./assets/trailer.mp4">`(Vite 가 처리하지 않는 속성) | `main.js` 에서 `import trailerUrl from "./assets/trailer.mp4"` 로 주소를 얻어 처음 열 때 `src` 로 지정 |
| `clay-scene.js` 의 `asset(name)`(변수가 든 `new URL` 경로) | 파일마다 정적 `new URL("./assets/clay-journey.glb", import.meta.url)` 등. 변수가 든 경로는 Vite 가 폴더 전체를 글롭으로 묶기 때문이다 |
| 장면 카드·점토 길 대체 이미지의 `.png` 경로 | `.webp` 경로(6절) |
| 파비콘 `./assets/favicon.svg` | client 와 같은 `/brand/book-path-32.png`, `/brand/book-path-favicon.svg`, `/brand/book-path-180.png` |

HTML 의 `<img src>`, `<video src|poster>` 는 Vite 가 해시 파일명으로 바꾼다. 갤러리 확대 창은 카드 `<img>` 의 `src` 를 읽으므로 빌드 후에도 같은 파일을 쓴다. 3D 모듈은 지금처럼 `main.js` 가 동적 import 로 불러온다(히어로는 즉시, 점토 길은 구간이 가까워질 때).

3D 모듈의 공개 API 는 그대로 둔다. 전환 6단계에서 React 컴포넌트가 감쌀 경계다.

- `createBookScene(canvas)` → `setProgress`, `setPointer`, `setView`, `setTheme`, `setReducedMotion`, `setEnabled`, `dispose`
- `createClayJourney(canvas, { onLayout })`(비동기) → `getLayout`, `setLayoutListener`, `render`, `setProgress`, `setReducedMotion`, `setEnabled`, `dispose`
- `createJourneyLabels(figure)` → `setLayout`, `setReducedMotion`

## 6. 에셋

시안이 실제로 참조하는 파일만 `client/about/assets/` 로 옮긴다. 폴더 구조와 파일 이름은 시안과 같고, 변환한 파일만 확장자가 바뀐다. 참조 합계는 22.6MB 에서 13.6MB 로 준다(1MB = 1,000,000바이트).

| 파일 | 처리 | 크기 |
| --- | --- | --- |
| `trailer.mp4` | 그대로 | 9.0MB |
| `clay-journey.glb`, `clay-journey.json` | 그대로 | 1.4MB, 87KB |
| `journey-walk.webp`, `journey-approach.webp`, `journey-read.webp` | 그대로 | 합계 1.1MB |
| `garden.webp`, `wander.webp`, `invitation.webp` | 그대로 | 합계 406KB |
| `footer-books-hairline.webp`, `footer-door-hairline.webp`, `footer-reader-hairline.webp` | 그대로 | 합계 266KB |
| `scene-concepts/card-01-world-a.png` 외 `-a` 카드 4장 | WebP 변환 | 합계 9.7MB → 1.3MB |
| `clay-journey-poster.png` | WebP 변환(투명 유지) | 603KB → 39KB |

변환은 ffmpeg libwebp 로 가로·세로를 유지해 한 번만 한다. HTML 의 `width`, `height` 속성은 그대로 둔다.

```
ffmpeg -i <원본>.png -c:v libwebp -quality 90 -compression_level 6 <대상>.webp
```

옮기지 않는 파일: `vendor/`(npm `three` 사용), 참조되지 않는 `scene-concepts/card-0N-*-b.png` 4장·`book-world.webp`·`footer-book-garden.webp`·`footer-books-front.webp`·`footer-door-front.webp`·`footer-reader-side.webp`, `favicon.svg`(client 아이콘 사용). 원본과 생성 기록은 brand 폴더에 남기고 `docs/ABOUT-PAGE.md` 에서 위치를 가리킨다.

Vite 는 `client/about/assets/` 의 파일을 해시 파일명으로 빌드 결과의 `assets/` 에 내보내며, 소개 페이지를 포함한 빌드에만 들어간다. `public/` 에 두지 않는 이유는 `public/` 이 관리자 빌드에도 통째로 복사되기 때문이다.

## 7. 빌드·서버·배포 설정

`vite.config.js` 의 입력:

```js
input: {
  client: resolve("client/index.html"),
  ...(mode === "admin" ? {} : { about: resolve("client/about/index.html") }),
  ...(mode === "client" ? {} : { admin: resolve("admin/index.html") }),
},
```

| 빌드 | 입력 |
| --- | --- |
| 기본 `npm run build` | client, about, admin |
| `npm run build:client` | client, about |
| `npm run build:admin` | client, admin |

`server/index.js`: `app.get("/", …)` 옆에서 `/about` 을 302 로 `/client/about/` 에 보낸다. Express 5 는 기본적으로 끝 슬래시를 구분하지 않으므로 `/about/` 도 같은 경로로 처리된다. 이 동작은 9.2 단위 검사로 확인한다.

`client/vercel.json` 의 rewrites 에 추가:

```json
{ "source": "/about", "destination": "/client/about/index.html" },
{ "source": "/about/", "destination": "/client/about/index.html" },
{ "source": "/client/about/", "destination": "/client/about/index.html" }
```

`package.json` scripts 에 `"test:about": "npm run build && node tests/about.mjs"` 를 추가한다(기존 `test:mobile` 과 같은 형태). 의존성은 추가하지 않는다.

## 8. 오류 처리

시안의 대체 동작을 그대로 유지한다.

- WebGL 을 시작하지 못하면 히어로가 `data-book-world="fallback"` 이 되고 책 드래그 영역(`.hero-object-hit`)을 숨긴다.
- 점토 길의 모델·경로 자료·사진 중 하나라도 읽지 못하면 `data-journey="fallback"`, `.is-still` 로 Blender 정지 이미지를 보여 준다.
- 모션을 끄거나, 기기의 움직임 줄이기가 켜져 있거나, 화면 높이가 650px 이하이면 `natural-flow` 로 고정 스크롤을 풀고 내용을 순서대로 보여 준다.
- 영상 자동 재생이 막히면 `data-autoplay="blocked"` 로 두고, 누르면 영상 창에서 재생한다.
- 화면 밖에 있거나 다른 탭·대화상자를 보는 동안 3D 갱신을 멈춘다.
- 영상·이미지 창은 닫기 버튼, Escape, 창 바깥 클릭으로 닫고 누른 버튼으로 초점을 돌린다.

새로 생기는 실패 지점은 주소 연결이다. 로컬 연결은 단위·브라우저 검사로, Vercel rewrite 는 설정 검토로 확인한다.

## 9. 테스트

### 9.1 브라우저 검사 `tests/about.mjs`

기존 `tests/*.mjs` 와 같이 `startServer(4331)`(완성본 모드, 임시 `DATA_DIR`), Edge 채널 헤드리스, `--enable-webgl --ignore-gpu-blocklist` 를 쓴다. `npm run test:about` 으로 빌드 후 실행한다. 모든 검사에서 `pageerror` 가 없어야 하고, 테스트 서버로 보낸 요청에 4xx·5xx 응답이 없어야 한다. 외부 글꼴 서비스 요청은 판정에서 제외한다. 환경변수 `ABOUT_BASE_URL` 을 주면 서버를 띄우지 않고 이미 실행 중인 서버(예: `npm run dev`)를 상대로 같은 검사를 실행한다.

1. 주소: `/about` 요청이 `/client/about/` 에 도착하고 제목이 "On the Book — 책 속을 걷다" 다.
2. 히어로: `.hero[data-book-world="ready"]`. 책 영역을 가로로 끌면 `.hero` 의 `data-rotation` 이 바뀐다.
3. 점토 길: 이야기 구간으로 스크롤하면 `.world[data-journey="ready"]` 가 되고, 진행에 따라 `data-step` 이 0→1→2 로 바뀐다.
4. 걷고·다가가고·읽고: 단어 링크를 누르면 해당 링크가 `aria-current="step"` 이 된다.
5. 갤러리: 처음에는 `01 / 04` 이고 이전 버튼이 꺼져 있다. 다음 버튼을 누르면 이전 버튼이 켜지고 카운트가 바뀐다(카운트는 스크롤 비율로 정해져 1440 폭에서는 `03 / 04`). 갤러리에서 End 키를 누르면 `04 / 04` 이고 다음 버튼이 꺼진다. 두 번째 카드를 누르면 확대 창이 '낯선 정원.' `02 / 04` 로 열리고, → 키로 '나만의 발걸음.' `03 / 04` 로 바뀌며, Escape 로 닫으면 누른 카드 버튼에 초점이 돌아온다.
6. 필름: 필름 버튼을 누르면 영상 창이 열리고 영상 `src` 가 빌드된 mp4 주소다. 닫으면 누른 버튼으로 초점이 돌아온다.
7. 연결: 'On the Book 시작하기'를 누르면 client 첫 화면(`#start-button`)에 도착한다. client 첫 화면의 '소개'를 누르면 소개 페이지에 도착한다. `/client/?preview=draft` 에는 `#about-link` 가 없다.
8. 모션: '모션 켜짐' 버튼을 누르면 `html` 이 `motion-off`, `natural-flow` 가 되고 라벨이 '모션 꺼짐'으로 바뀐다. `reducedMotion: "reduce"` 컨텍스트에서는 처음부터 `natural-flow` 다.
9. 대체 화면: `addInitScript` 로 `HTMLCanvasElement.prototype.getContext` 가 WebGL 요청에 `null` 을 돌려주게 하면 `data-book-world="fallback"`, `data-journey="fallback"` 과 `.is-still` 이 되고, 정지 이미지(`.journey-poster`)가 불러와져 불투명도 1 로 보인다.
10. 휴대폰: 390×844, 320×560 에서 소개 페이지의 `scrollWidth` 가 화면 폭을 넘지 않는다. client 헤더의 로고·'소개'·'책장 둘러보기'·소리 버튼이 화면 안에 있고 서로 겹치지 않는다.
11. 스크린샷: `docs/screenshots/about-desktop.png`(1440×900 첫 화면), `docs/screenshots/about-mobile.png`(390×844 첫 화면).

### 9.2 단위 검사(`npm test`)

`tests/about.test.js` 한 파일에 둔다. 저장소의 `collision.test.js`·`collision.mjs` 처럼 단위 검사와 브라우저 검사를 이름으로 짝짓는다. `tests/server.test.js` 에 넣지 않는 이유는 1단계 계획이 그 파일의 모든 케이스를 새 API 테스트로 옮기기 때문이다.

- `vite.config.js` 의 설정 함수를 mode 별로 호출해 입력이 7절 표와 일치하는지 확인한다.
- 완성본 서버(4332 포트)에서 `/about`, `/about/` 이 302 와 `Location: /client/about/` 을 돌려준다.

### 9.3 회귀

`npm test`, `npm run build`, `npm run build:client`, `npm run build:admin`, `npm run test:e2e`, `node tests/floor-reading.mjs`, `node tests/mobile-entry.mjs`, `node tests/browser.mjs` 를 통과해야 한다. 헤더를 바꾸므로 `mobile-entry` 가 특히 중요하다.

### 9.4 시안과 비교

`tests/about-compare.mjs <기준 주소> <비교 주소>` 로 sample-02(brand 폴더에서 `npm run dev`, 4380 포트)와 소개 페이지를 같은 화면 크기(1440×900, 390×844)와 같은 스크롤 위치(히어로, 이야기 구간의 세 사진, 걷고·다가가고·읽고, 갤러리, 필름, 푸터)에서 찍는다. 모션 켜짐과 꺼짐 두 상태로 찍고, 쌍마다 ffmpeg `ssim` 값을 구한 뒤 나란히 본다. 모션 꺼짐의 움직임 없는 구간(걷고·다가가고·읽고, 갤러리, 필름, 푸터)은 SSIM 0.97 이상이어야 하고, 책 색 변화처럼 시간에 따른 차이는 제외하고 본다. 이 도구는 6단계에서 React 이관 전후를 비교할 때도 쓴다. 비교 이미지는 `test-results/` 에 두고 커밋하지 않으며, 결과 요약을 `docs/ABOUT-PAGE.md` 에 적는다. 배치·문구·색·동작에서 WebP 변환 외의 차이가 없어야 한다.

## 10. 문서와 계획 반영

- `README.md`: '바로 확인하기'에 소개 페이지 주소(http://127.0.0.1:4173/about), '검증 실행'에 `npm run test:about` 을 추가한다.
- `docs/DEPLOYMENT.md`: 사용자 프로젝트의 `/about` rewrite 를 한 줄로 적는다.
- `docs/ABOUT-PAGE.md`(새 문서): 출처와 이식 시점, 구간별 확인할 동작(시안 README 의 표를 client 기준으로 갱신), 시안과 달라진 점(5절 요약), 에셋 목록과 변환 명령, 원본 위치(`../on-the-book-brand/sample-02/models`, `models/generated-images`), 9.4 비교 결과.
- 전환 스펙 `2026-09-11-react-next-migration-design.md`: 반영하지 않으면 7단계에서 `client/` 를 지울 때 소개 페이지도 사라진다.
  - 3절 사용자 화면 URL 에 `/about`(로컬 `/client/about/`)을 추가한다.
  - 4절 저장소 구조의 `apps/client` 에 `app/about/page.tsx` 를 추가한다.
  - 10절에 소개 페이지 항목을 추가한다. client 컴포넌트가 5절의 명령형 3D 모듈과 스크롤 연출을 `useEffect` 로 감싸고, 에셋은 `client/about/assets` 에서 앱 쪽으로 옮긴다.
  - 16절 6단계 완료 기준에 `about` 검증 이관을 추가한다.
- 1단계 계획 `2026-09-14-phase1-monorepo-api.md`: Task 1 이 `package.json` 을 통째로 바꾸므로 scripts 에 `"legacy:test:about": "npm run legacy:build && node tests/about.mjs"` 를 추가한다. `legacy:test` 기대 출력의 검사 수를 24 에서 26 으로 고치고, `tests/about.test.js` 는 구 Vite 입력과 Express 이동을 검사하므로 새 스택으로 옮기지 않는다고 적는다.
- 전환 스펙 14절의 이관 대상 스크립트 목록에 `about` 을 더한다(11개 → 12개).

## 11. 위험과 대응

- `.glb` 는 Vite 의 기본 에셋 확장자가 아니다. 2026-09-23 시험 빌드(Vite 7.3.6)에서 `new URL("./assets/clay-journey.glb", import.meta.url)` 과 `.json` 이 해시 파일로 나가고, HTML `<video src>` 와 JS import 의 mp4 가 같은 파일 하나로 합쳐지는 것을 확인했으므로 `assetsInclude` 는 쓰지 않는다. 4KB 미만 파일은 data URL 로 인라인되지만 옮기는 에셋 중에는 없다.
- 헤더 링크가 늘어 320px 에서 넘칠 수 있다. 9.1-10 과 `mobile-entry` 로 확인하고 간격을 조정한다.
- WebP 변환으로 투명 가장자리나 세부가 달라질 수 있다. 9.4 비교에서 차이가 보이면 품질을 올리거나 해당 파일만 PNG 로 둔다.
- 헤드리스 Edge 의 WebGL 은 `tests/browser.mjs` 가 같은 플래그로 3D 를 검사하고 있으므로 같은 환경을 쓴다.
- 저장소가 약 13.6MB 커지고 대부분 `trailer.mp4` 다. Vercel 업로드 대상에도 포함되며 이를 수용한다.
- 전환 7단계의 `client/` 삭제로 소개 페이지가 사라질 수 있다. 10절의 전환 스펙 반영으로 6단계 이관 대상에 넣는다.

## 12. 완료 기준

- 9.1~9.3 의 모든 검사를 통과한다.
- 9.4 비교에서 배치·문구·색·동작에 WebP 변환 외의 차이가 없다.
- 10절의 문서와 계획을 갱신한다.
