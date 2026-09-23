# On the Book: React + Next.js 전환과 관리자 편집기 투어 설계

작성일 2026-09-11. 이 문서는 전환 전체의 아키텍처와 단계 경계를 정의하는 상위 스펙이다. 각 단계는 이 문서를 기준으로 별도 구현 계획을 만든다. 2026-09-23 소개 페이지(`/about`) 추가를 3·4·10·12·14·16절에 반영했다.

## 1. 배경과 목표

현재 앱은 Vite 멀티 페이지 바닐라 JS(client 650줄, admin 2,000줄, shared 1,250줄 중 Three.js `World` 826줄)와 Express 서버(320줄)로 이루어져 있다. Vercel 에는 client 와 admin 을 별도 프로젝트로 배포하며, 서버는 서버리스 함수 하나로 감싼다.

원래 요청은 관리자 월드 편집기에 처음 사용하는 사람을 위한 투어를 antd `Tour` 로 붙이는 것이었다. 관리자 앱에 React 가 없어 사용자가 다음을 결정했다.

- client, admin 모두 React + Next.js 로 전환한다.
- Next.js 앱 둘을 npm workspaces 모노레포로 구성한다.
- API 는 Express 를 버리고 Next Route Handler 로 재작성한다.
- 3D 장면은 react-three-fiber(R3F) 로 재작성한다.
- 언어는 TypeScript(TSX) 를 쓴다.
- 상태관리는 Zustand 를 쓴다.
- 투어는 antd `Tour` 로, 월드 편집기에서 첫 방문 시 자동 시작하고 다시 보기 버튼을 둔다. 범위는 편집기만이다.

목표는 기능 동등성이다. 현재 사용자·관리자 화면의 모든 동작과 데이터 계약을 유지하면서 스택을 바꾸고, 그 위에 편집기 투어를 더한다.

## 2. 범위와 비범위

범위
- 두 Next 앱, 공유 패키지 다섯 개, Route Handler API, R3F 장면, Zustand 스토어, antd Tour.
- 기존 단위·e2e 테스트의 검증 항목을 새 스택으로 이관.
- README, DEPLOYMENT, ADMIN-GUIDE 갱신과 Vercel 설정 변경.

비범위
- 새 기능 추가(투어 제외), 디자인 변경, 데이터 구조 변경, 로그인 체계 변경.
- 호출되지 않는 관리자 구 코드 이식: `booksView`, `inspectorView`, `makePreview`, `bindBooks`, `addPlacement`.
- Tailwind 도입. 기존 CSS 를 전역 CSS 로 그대로 옮긴다.
- QA-UAT 시나리오 자체의 재설계. 셀렉터 갱신과 재실행만 한다.

## 3. 유지해야 하는 계약

다음은 바꾸지 않는다. 기존 배포 데이터와 사용자 브라우저 기록이 그대로 동작해야 한다.

- `library.json` 구조와 `librarySchema`(zod). Blob 저장 경로 `library.json`, `uploads/`, `staging/`, `sessions/`. `BLOB_NAMESPACE` 접두어.
- 업로드 URL `/uploads/<uuid>.png|glb`. 이 URL 이 데이터에 저장되어 있으므로 두 앱 모두 루트 `/uploads/` 에서 서빙한다. 따라서 관리자 앱에 Next `basePath` 를 쓰지 않고 `app/admin/…` 폴더 라우팅으로 `/admin` 주소를 만든다.
- API 경로와 메서드, 요청·응답 JSON, 상태 코드, 한국어 오류 메시지: `POST /api/login`, `POST /api/logout`, `GET /api/library`, `GET|PUT /api/studio`, `POST /api/uploads/prepare`(cloud), `POST /api/floor/upload`, `POST /api/models/upload`, `GET /uploads/:filename`.
- 헤더 `X-On-The-Book: studio` same-origin 검사, 쿠키 `otb_session`(httpOnly, sameSite strict, 8시간), 로그인 시도 제한 10회/60초, 저장 버전 충돌 409, Blob ETag 충돌 409.
- 사용자 진행 기록 localStorage 키 `otb-reader` 와 값 구조 `{ [bookId]: { chapter } }`.
- 사용자 화면 URL: `/`, `/client/`, 쿼리 `book`, `chapter`, `preview=draft`, `model`. 소개 페이지 `/about`(로컬 `/client/about/`). 관리자 URL: `/admin/`.
- 정적 자산 경로 `/brand/*`, `/floor-assets/*`, `/ornaments/*`, `/favicon.svg`.

## 4. 저장소 구조

```
package.json                 workspaces: apps/*, packages/*  루트 스크립트 dev·build·test·test:e2e
apps/client/                 Next 16. 사용자 화면
  app/(reader)/layout.tsx    독자 화면 레이아웃. 전역 CSS(12절)를 여기서 가져온다
  app/(reader)/page.tsx      /  독서 경험
  app/(about)/about/page.tsx /about  소개 페이지(client/about 이식). 전용 CSS·에셋만 쓴다
  app/api/library/route.ts
  app/uploads/[filename]/route.ts   공개 자산만
  next.config.ts             rewrite /client, /client/:path* -> /, /:path*
apps/admin/                  Next 16. 관리자
  app/page.tsx               / -> /admin redirect
  app/admin/page.tsx         도서 보관함 + 전체화면 월드 편집기(클라이언트 상태)
  app/admin/models/page.tsx
  app/admin/settings/page.tsx
  app/admin/preview/page.tsx 초안 독자 화면(iframe 용, ?book&chapter&model)
  app/api/{login,logout,studio,library,uploads/prepare,floor/upload,models/upload}/route.ts
  app/uploads/[filename]/route.ts   공개 자산 + 관리자 세션 시 비공개 자산
packages/shared/  @otb/shared   순수 로직·타입. three 의존 없음
packages/server/  @otb/server   서버 코어와 Route Handler 팩토리. 브라우저 코드 없음
packages/scene/   @otb/scene    R3F 컴포넌트·훅·three 유틸
packages/reader/  @otb/reader   독서 경험 React UI
packages/ui/      @otb/ui       Toast, Modal, Logo, api 클라이언트, 아이콘, 전역 CSS, 공용 정적 자산 원본
tests/            Vitest 단위·API 테스트, Playwright e2e, QA-UAT
scripts/sync-public.mjs      packages/ui/public 을 각 앱 public 으로 복사(predev·prebuild)
```

의존 방향은 한쪽이다. `shared` 는 아무것도 의존하지 않는다. `server` 는 `shared` 만 의존한다. `scene` 은 `shared` 와 three, R3F 에 의존한다. `reader` 는 `shared`, `scene`, `ui` 에 의존한다. `ui` 는 `shared` 만 의존한다. 앱은 모든 패키지를 의존할 수 있다. 패키지는 빌드하지 않고 TS 소스를 `exports` 로 노출하며, 앱의 `next.config.ts` 에서 `transpilePackages` 로 컴파일한다.

각 패키지의 `public` 정적 자산은 `packages/ui/public` 한 곳에만 두고, `scripts/sync-public.mjs` 가 `predev`·`prebuild` 에서 `apps/*/public` 으로 복사한다. 복사본은 gitignore 한다.

## 5. 기술 스택과 버전

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16.3, App Router | 두 앱 모두 |
| React | 19.2.x (19.2.8) | R3F 9.7 의 peer 범위가 `>=19 <19.3` 이라 19.3 을 쓰지 않는다 |
| 언어 | TypeScript, `strict: true` | 패키지별 `tsconfig` 가 루트 `tsconfig.base.json` 을 확장 |
| 상태 | Zustand 5 + immer 미들웨어, persist(사용자 기록) | 실행 취소·다시 실행은 자체 스냅샷 슬라이스 |
| 3D | three 0.180(유지), @react-three/fiber 9.7, @react-three/drei 10.7 | |
| UI 라이브러리 | antd 6.6 + @ant-design/nextjs-registry 1.3 | `Tour`, `ConfigProvider` 만 사용. 관리자 앱 전용 |
| 아이콘 | lucide-react | 현재 `lucide` 대체 |
| 폰트 | next/font/google: DM Sans, Noto Sans KR, Noto Serif KR | 현재 CSS `@import` 대체 |
| 검증 | zod 4(유지) | |
| 저장 | @vercel/blob(유지) | |
| 테스트 | Vitest 5, @playwright/test 1.63 | Microsoft Edge 채널 유지 |
| 개발 실행 | concurrently | `npm run dev` 가 두 앱을 동시에 띄움 |

Node 는 현재 문서 기준 20.19 이상 또는 22.12 이상을 유지한다.

## 6. API 설계 (Route Handler)

### 6.1 핸들러 팩토리

`@otb/server/handlers/*` 는 `(request: Request, context) => Promise<Response>` 형태의 함수를 만든다. 각 앱의 `route.ts` 는 필요한 핸들러만 re-export 한다. 이 방식이 현재 `DEPLOYMENT_APP` 미들웨어를 대체한다. client 앱은 `library` 와 공개 자산 `uploads` 만 노출하므로 관리자 API 가 존재하지 않는다.

모든 route 는 `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'` 을 선언한다.

### 6.2 미들웨어 대응

| 현재 Express | 새 구현 |
| --- | --- |
| `sameOrigin` | `X-On-The-Book: studio` 헤더와 `Origin` 을 `request.headers` 로 검사. 실패 403 |
| `auth` | 쿠키 `otb_session` 파싱 후 `validSession`. cloud 에서 `ADMIN_PASSWORD` 없으면 503 |
| `express.json({limit:'3mb'})` | `content-length` 와 실제 본문 길이를 3MB 로 제한. 초과 시 현재와 같이 400 "요청을 처리할 수 없습니다." |
| `multer` | `await request.formData()`. 필드 `image`/`model` 의 `File` 을 `arrayBuffer` 로 읽음. 크기 초과 400/413 메시지 동일 |
| `res.cookie` | `Set-Cookie` 헤더. `secure` 는 요청 프로토콜 기준 |
| `trust proxy` | IP 는 `x-forwarded-for` 첫 항목, 없으면 `x-real-ip` |
| `saving` 플래그 | 모듈 스코프 변수 유지. Blob ETag 조건 검사가 실제 충돌을 막는다 |
| 로컬 정적 `/uploads` | `app/uploads/[filename]/route.ts` 가 `DATA_DIR/uploads` 파일을 스트리밍. `Cache-Control: public, max-age=31536000, immutable` |
| cloud `/uploads` | 공개 자산 또는 관리자 세션 확인 후 서명 URL 로 307 |
| 세션·로그인 시도 Map | 모듈 스코프 유지(현재와 같은 best-effort) |

### 6.3 저장소 변경점

로컬 모드는 현재 프로세스 메모리에 DB 를 캐시한다. 새 구조는 client 와 admin 이 별도 프로세스이므로 `readLibrary()` 가 매 요청 `library.json` 을 읽고, 쓰기는 `.tmp` 에 쓴 뒤 `rename` 한다. 최초 실행의 `upgrade` 백업 동작은 유지한다. 세션 저장은 현재 `storage.js` 구현을 그대로 이식하며 admin 프로세스만 사용한다. cloud 모드는 변경 없다.

### 6.4 업로드 흐름

브라우저 `api()` 는 현재 `import.meta.env.MODE` 로 cloud 여부를 판단한다. 새 구현은 Vercel 이 자동으로 노출하는 `NEXT_PUBLIC_VERCEL_ENV` 가 있으면 cloud 로 보고 `POST /api/uploads/prepare` 로 서명 URL 을 받아 Blob `staging/` 에 직접 PUT 한 뒤 파일명을 JSON 으로 등록 API 에 보낸다. 없으면 multipart 로 등록 API 에 직접 보낸다. 서버는 현재와 같이 cloud 에서만 `prepare` 와 staging 검증 경로를 노출한다.

### 6.5 검증 규칙

PNG 시그니처·IHDR·IDAT·IEND·4096 한도, GLB 헤더·JSON 청크·외부 URI 금지·뼈대 애니메이션 필수, 저장 시 썸네일 필수, 메인 모델 없는 챕터의 공개 거부, 발동 영역 겹침 거부, 자산 존재 확인은 `@otb/server/validation` 으로 옮기고 단위 테스트를 붙인다. 메시지 문자열은 현재와 동일하다.

## 7. 3D 설계 (@otb/scene)

R3F `Canvas` 하나가 장면을 그린다. 수학과 데이터 계산은 `@otb/shared` 에 두고 R3F 컴포넌트는 그리기와 프레임 루프만 담당한다.

### 7.1 공용 컴포넌트

- `SceneCanvas`: `shadows`, `dpr={[1, 1.75]}`, `gl={{ antialias, alpha, toneMapping: ACESFilmic, toneMappingExposure: 1.05, outputColorSpace: SRGB }}`. WebGL 생성 실패는 오류 경계가 잡아 현재 메시지 "이 브라우저에서 3D 화면을 시작하지 못했습니다. 하드웨어 가속을 켜거나 다른 브라우저로 열어 주세요." 를 표시한다. 캔버스에 `aria-label` 과 `tabIndex=0` 을 유지한다.
- `Lights`: HemisphereLight("#fff9e9", "#9cae98", 2.7), 그림자 DirectionalLight("#fff3d9", 4, 2048 맵, 카메라 ±18, normalBias .04, bias -.0001). Journey 모드에서는 강도 2.4 / 1.65 와 플레이어 추적.
- `Terrain`: 모눈 텍스처 바닥(`/floor-assets/graph-paper.svg`, RepeatWrapping, width/8·depth/8)과 InstancedMesh 점 180개. `groundOnly` 옵션.
- `FloorArt`: 화살표와 데칼 평면. 좌표는 `@otb/shared` 의 `arrowPlacements`, `defaultDecals`. 데칼 메시는 `userData.floorDecalId`, `chapterId` 를 갖고 편집기에서 `onClick` 으로 선택된다.
- `BuiltinModel`: 기존 `makeModel(kind, color)` 팩토리를 `@otb/scene/builtin.ts` 로 옮겨 `<primitive object>` 로 렌더한다. 좌표 상수를 JSX 로 바꾸지 않는다.
- `GlbModel`: drei `useGLTF` + `useAnimations`. 로드 실패 시 오류 경계가 `onError("“이름” 모델을 불러오지 못했습니다.")` 를 호출하고, 편집기가 아니면 카드 모델로 대체한다. `castShadow`/`receiveShadow` 설정 유지.
- `Placement`: 위치 `(x, .32 + y, z)`, 회전 `deg→rad`, 스케일. `useProceduralMotion(kind, near)` 가 hop/spin/float/sway 를 `useFrame` 에서 계산하고 `near` 가 false→true 로 바뀔 때 phase 를 0 으로 되돌린다. clip 은 `near` 일 때만 재생, 벗어나면 reset 후 정지.
- `ReactionHalo`, `CollisionHalo`: 현재 색상·불투명도·크기 공식 유지(`reactionSize`, `collisionSize`).
- `Traveller`: 여행자 모델. 걷기 팔다리 애니메이션, 착지 연출(높이 2.75, 중력 36, squash), 동작 줄이기 시 생략.
- `JourneyController`: `useFrame` 에서 마우스 홀드 추적(pointer capture, 8px 드래그 판정, 180ms 탭 판정), 키보드(WASD·방향키, 대화상자 열림·입력 요소 포커스 시 무시), `slideMove` 충돌, 구간 경계 클램프, 카메라 추적 오프셋 `(2.5, 12, 16)`, 글귀 진입 시 `sideReadingPose` 로 카메라 블렌드, 안개 near/far 갱신, 챕터 구간 변경 콜백, 페이지 넘김. 로직과 상수는 현재 `Journey` 와 동일하다.
- `useReducedMotion`: `prefers-reduced-motion` 을 읽어 모든 애니메이션 컴포넌트가 참조한다.

### 7.2 편집기 전용

- `EditorControls`: drei `OrbitControls makeDefault`(damping, polar ≤ .46π, 거리 12~350) 와 축 위젯이 요구하는 전 범위 polar.
- `EditorTransform`: drei `TransformControls` 를 프록시 `Object3D` 에 붙인다. 이동 스냅은 격자 단위, 회전 15°, 스케일 .1. 드래그 중 OrbitControls 비활성, 종료 시 `mark()`. 이동 시 챕터 격자 클램프와 발동 영역 겹침 검사(`overlapsTrigger`) 는 `@otb/shared`.
- `PlacementDropZone`: 캔버스 래퍼의 HTML5 `dragover`/`drop` 을 받아 R3F `useThree` 의 카메라와 레이캐스터로 지면 좌표를 구한다. 고스트 박스와 유효·무효 색, 힌트 문구, 60개·100개 상한, 겹침 경고는 현재와 동일.
- `RangeDiscs`: 드래그·반경 모드에서 모든 모델의 반응 원(붉은색)과 후보 원(초록·빨강), 반경 손잡이 4개.
- `ChapterTravel`: 챕터 전환 시 850ms smoothstep 카메라 이동. `data-travelling` 속성 유지.
- `OrientationWidget`: 현재 커스텀 축 위젯을 React 로 이식. 버튼 `aria-label="X축에서 보기"` 등과 `data-animating` 속성 유지. drei GizmoHelper 를 쓰지 않는다.
- `ModelPreviewCanvas`: 모달용 단일 모델 미리보기. OrbitControls(전 범위, pan 없음) 와 바운딩 스피어 맞춤.
- `useModelThumbnails`: 카드마다 WebGL 컨텍스트를 만들지 않도록 현재의 단일 오프스크린 렌더러 유틸을 훅으로 감싼다. 저장된 `thumbnail` 이 있으면 이미지를 그대로 쓴다.
- `InlineReader`: 편집기 안 독자 체험. `JourneyController` 기반 장면과 챕터 선택, 글 패널, "편집으로 돌아가기". 종료 시 편집 카메라와 선택을 복원한다.

### 7.3 사용자 화면 전용

- `HeroScene`: 히어로용 정적 월드(플레이어 숨김).
- `JourneyScene`: 전체 챕터를 한 장면에 배치(`layout`, `triggerCircles`), `JourneyController` 포함.

## 8. 상태 설계 (Zustand)

### 8.1 관리자 `useStudioStore`

```ts
type StudioState = {
  session: { protected: boolean; loaded: boolean; error?: string; needsLogin: boolean };
  library: Library | null; version: number; publishedAt: string;
  savedLibrary: Library | null;           // 마지막 저장 성공 시점
  selection: { bookId?: string; chapterId?: string; placementId?: string | null; inEditor: boolean };
  history: { undo: Library[]; redo: Library[]; baseline: Library | null };  // 80개 한도
  busy: boolean;
  editor: { mode: 'translate'|'rotate'|'scale'|'radius'; step: 0.5|1|2; hint: string; readerMode: boolean; tourOpen: boolean };
};
```

액션: `load`, `login`, `logout`, `mark`(baseline 을 undo 에 push, redo 비움, baseline 갱신), `undo`, `redo`(현재 `historyMove` 와 같이 선택 상태 보정), `save(publish)`, `mutate(fn)`(immer 로 library 수정 후 `mark`), 선택·편집기 액션. `dirty` 는 `JSON.stringify(library) !== JSON.stringify(savedLibrary)` 셀렉터로 파생한다. 드래그처럼 연속 변경은 `mutate` 없이 즉시 수정하고 종료 시점에 한 번 `mark` 한다.

### 8.2 사용자 `useReaderStore`

```ts
type ReaderState = {
  library: Library | null; bookId?: string; chapterId?: string;
  exploring: boolean; sound: boolean; draftPreview: boolean;
  progress: Record<string, { chapter: string }>;   // persist, key 'otb-reader'
  reading: ReadingState | null;
};
```

persist 는 `progress` 만 저장하고 `draftPreview` 일 때는 저장하지 않는다.

## 9. 관리자 앱 (apps/admin)

- `app/layout.tsx`: `AntdRegistry`, `ConfigProvider`(locale `ko_KR`, 토큰: `colorPrimary #809b72`, `colorBgElevated #24342f`, `colorText #e0e8e0`, `colorTextSecondary #b3bfae`, `borderRadius 8`, `fontSize 12`, `fontFamily system-ui`), 전역 CSS, next/font.
- `StudioShell`: 사이드바(도서 보관함·3D 모델 보관함·공개 및 안내 탭은 Next `Link`), 헤더의 저장 상태·임시 저장·공개, 로그아웃(보호 모드). 편집기가 열려 있고 저장하지 않은 변경이 있으면 사이드바 이동·로그아웃 전에 `LeaveEditorDialog` 를 띄운다.
- `LoginScreen`, `LoadingError`(다시 시도).
- `BookShelf`: 검색·상태 필터·새 도서·표지 타일. 타일 클릭 시 편집기 상태로 전환.
- `WorldEditor`: 상단 바, 모델 보관함, 바닥 이미지, 챕터, 챕터 모델, 선택한 오브젝트, 도구 모음, 상태 바, 축 위젯, 독자 체험. 현재 DOM 훅을 유지한다: `#studio-world`, `#back-library`, `#edit-book`, `#save-state`, `#undo`, `#redo`, `#save`, `#publish`, `#new-model`, `#asset-search`, `.asset-tile[data-model]`, `[data-model-edit]`, `.tile-tray [data-floor-asset]`, `#upload-floor-asset`, `[data-chapter-row]`, `[data-chapter]`, `[data-chapter-drag]`, `[data-chapter-edit]`, `#add-chapter`, `#chapter-model-list [data-select-model]`, `#object-properties`, `#object-form`, `#make-main`, `#play-clip`, `#duplicate-object`, `#delete-object`, `#delete-floor-object`, `#tool-move|rotate|scale|radius`, `#grid-step`, `#scene-reset`, `#preview-client`, `#exit-reader`, `#world-hint`, `.view-orientation`, `.world-workspace[data-travelling]`.
- 키보드: W·E·S·R·Esc, Ctrl+Z, Ctrl+Shift+Z, Alt+↑↓(챕터 순서). 대화상자 열림, 입력 포커스, 독자 체험, 투어 열림 상태에서는 무시한다.
- 모달: 도서 정보(표지 업로드), 챕터(순서·삭제 포함), 모델 등록·수정(GLB·썸네일 업로드, 삭제), 모델 미리보기, 삭제 확인, 나가기 확인(계속 편집·저장하지 않고 나가기·저장 후 나가기), 독자 화면 체험(iframe `/admin/preview?…`, 넓은·모바일 크기). `Modal` 은 `<dialog>` 기반으로 현재 닫기 버튼·바깥 클릭·포커스 복원을 유지한다.
- `ModelsPage`: 카드 그리드, 검색, 썸네일, 미리보기, 편집.
- `SettingsPage`: 안내 카드와 설정 내려받기.
- `PreviewPage`: `@otb/reader` 를 `mode="draft"` 로 렌더. `/api/studio` 에서 초안을 읽고 `book`, `chapter`, `model` 쿼리로 시작 위치를 정한다.
- `beforeunload`: 저장하지 않은 변경이 있으면 기본 확인을 띄운다.

## 10. 사용자 앱 (apps/client) 과 @otb/reader

- `ReaderApp` 컴포넌트가 URL 쿼리를 읽어 시작한다. `preview=draft` 면 `/api/studio`, 아니면 `/api/library`. 책이 없으면 "새로운 이야기를 준비하고 있어요." 화면.
- 히어로: 현재 카피·버튼·장식·푸터. "책 속으로 들어가기" 로 탐험 시작.
- 탐험: 상단 라인, 터치 패드(4방향), 이전·다음 챕터, 지도 버튼, 이동 힌트, 글 패널(제목·구분선·본문·페이지 버튼, 순차 등장 애니메이션). `history.replaceState` 로 쿼리 동기화, 진행 기록 저장.
- 모달: 도움말, 챕터 본문 읽기, 책장, 이야기의 지도.
- 전환: 현재 `transitions.js` 의 커튼·순차 등장 로직을 `usePageTransition` 훅으로 옮긴다. Web Animations API 와 동작 줄이기 처리를 유지한다.
- 소리: `useAmbientSound` 훅. AudioContext 3음 사인파, 탭 숨김 시 일시 중지.
- WebGL 불가 시 현재의 설명·본문 읽기 대안을 유지한다.
- 소개 페이지 `app/(about)/about/page.tsx`: 2026-09-23 에 `client/about` 으로 추가한 바닐라 페이지를 옮긴다. client 컴포넌트가 `useEffect` 에서 명령형 3D 모듈(`createBookScene`, `createClayJourney`, `createJourneyLabels`)과 스크롤 연출을 시작하고, 정리 함수에서 색 순환 `setInterval`, window·document 리스너, `IntersectionObserver`·`ResizeObserver` 를 해제하고 두 장면의 `dispose()` 를 부른다. 바닐라 페이지는 문서와 수명이 같아 정리 코드가 없다. 에셋은 `public/` 을 거치지 않고 `apps/client/app/(about)/about/assets/` 에 두어 모듈 import 나 `new URL(…, import.meta.url)` 로 불러온다. `apps/*/public` 은 `packages/ui/public` 의 gitignore 된 복사본이고, `packages/ui/public` 에 두면 관리자 앱에도 13.6MB 가 실리기 때문이다. 독자 화면 전역 CSS(12절)는 `.site-header`, `.hero-copy`, `.eyebrow` 같은 클래스와 `a:hover` 같은 요소 규칙이 소개 페이지와 겹치므로 루트 레이아웃이 아니라 `app/(reader)/layout.tsx` 에서 가져오고, 소개 페이지는 자기 `style.css` 만 쓴다. 1단계에서 만든 `app/layout.tsx` 의 전역 CSS import 와 `app/page.tsx` 는 이 단계에서 `(reader)` 로 옮긴다. 이관 전후 화면은 `tests/about-compare.mjs` 로 비교한다. 설계는 `2026-09-23-about-page-design.md`.

## 11. antd Tour (관리자 월드 편집기)

### 11.1 동작

- `EditorTour` 컴포넌트가 `WorldEditor` 안에서 antd `Tour` 를 렌더한다. `open` 은 스토어 `editor.tourOpen`.
- 자동 시작 조건: 편집기가 마운트된 다음 프레임에 `localStorage.getItem('otb-admin-tour-done') !== '1'` 이고 `window.innerWidth >= 1000` 이며 독자 체험 중이 아닐 때. 조건을 만족하지 않으면 열지 않는다.
- 상단 바 버튼 `#tour-help` "도움말" 을 누르면 1단계부터 다시 연다. 화면 폭 조건은 재시작에는 적용하지 않는다.
- 닫기 버튼(X)이나 Esc 로 닫거나 마지막 단계에서 종료를 누르면 `otb-admin-tour-done = '1'` 을 저장하고 `tourOpen=false` 로 바꾼다. 마스크 클릭으로는 닫히지 않는다.
- 투어가 열려 있으면 편집기 단축키를 무시한다. 마스크는 켠다. 버튼 문구는 `ko_KR` 로케일의 이전·다음·종료를 쓴다.
- 대상은 `data-tour="…"` 속성으로 찍고 `target: () => document.querySelector('[data-tour="assets"]')` 형태로 참조한다. 대상이 없으면 그 단계는 중앙에 표시한다.

### 11.2 단계

| # | data-tour | 제목 | 설명 | 위치 |
| --- | --- | --- | --- | --- |
| 1 | assets | 모델 보관함 | 애니메이션이 있는 모델을 월드로 드래그해 배치합니다. ＋ 등록으로 새 GLB 를 올리고, 카드에 마우스를 올리면 동작을 미리 봅니다. | right |
| 2 | tiles | 바닥 이미지 | 화살표·나뭇잎 같은 손그림과 등록한 PNG 를 바닥에 끌어 놓습니다. 배치한 이미지는 월드에서 선택해 위치·크기·방향을 바꿀 수 있습니다. | right |
| 3 | (없음, 중앙) | 월드 조작 | 왼쪽 드래그로 회전, 오른쪽 드래그로 화면 이동, 휠로 확대합니다. 금색 원은 애니메이션이 반응하는 범위, 붉은 원은 캐릭터가 지나갈 수 없는 충돌 범위입니다. | center |
| 4 | tools | 도구 모음 | 이동 W, 방향 E, 크기 S, 발동 범위 R 을 전환합니다. 격자 단위를 바꾸고 시점 초기화로 카메라를 되돌립니다. ▶ 독자 체험은 현재 월드를 실제 독자처럼 걸어 봅니다. | top |
| 5 | orientation | 축 시점 | X·Y·Z 버튼으로 축 방향에서 보고, 위젯을 드래그해 시점을 돌립니다. | left |
| 6 | chapters | 챕터 | 챕터를 눌러 이동하고, 손잡이를 드래그하거나 Alt+↑↓ 로 순서를 바꿉니다. ＋ 챕터 추가로 빈 월드를 만듭니다. | left |
| 7 | chapter-models | 챕터 모델 | 현재 챕터에 배치된 모델 목록입니다. 첫 모델이 ★ 메인이 되어 화살표와 본문에 연결되고, 나머지는 보조입니다. | left |
| 8 | inspector | 선택한 오브젝트 | 선택한 모델·이미지의 이름, 위치, 방향, 크기, 동작, 발동 반경, 충돌을 편집합니다. 복제와 삭제도 여기서 합니다. | left |
| 9 | topbar | 저장과 공개 | 임시 저장은 관리자 작업만 저장하고, 공개를 눌러야 독자 화면에 반영됩니다. 실행 취소·다시 실행은 Ctrl+Z, Ctrl+Shift+Z 입니다. 도움말 버튼으로 이 안내를 다시 볼 수 있습니다. | bottom |

### 11.3 테스트

- e2e: 새 컨텍스트로 편집기를 열면 1단계 제목 "모델 보관함" 이 보인다. 다음을 8번 눌러 9단계에 도달하고 종료를 누르면 플래그가 저장된다. 새로고침 후 투어가 뜨지 않는다. 도움말을 누르면 다시 뜬다.
- 다른 모든 e2e 는 `context.addInitScript` 로 플래그를 먼저 넣어 투어를 우회한다.

## 12. 스타일과 자산

- `shared/style.css`, `admin/style.css`, `admin/workspace.css`, `client/transitions.css` 를 `packages/ui/styles/` 로 옮겨 각 앱 루트 레이아웃에서 전역 CSS 로 가져온다. 사용자 앱은 소개 페이지와 섞이지 않도록 루트 레이아웃 대신 독자 화면 route group 레이아웃(`app/(reader)/layout.tsx`)에서 가져온다(10절). 클래스 이름은 유지한다. CSS Modules 로 바꾸지 않는다.
- Google Fonts `@import` 는 제거하고 `next/font/google` 로 대체한다. 연결 실패 시 시스템 글꼴 폴백은 폰트 스택으로 유지한다.
- antd 는 Tour 관련 스타일만 런타임에 주입된다. antd reset CSS 는 불러오지 않는다.

## 13. 오류 처리

- API: 현재 상태 코드·메시지 표를 그대로 따른다. 처리되지 않은 예외는 500 "저장하지 못했습니다. 다시 시도해 주세요." 또는 "요청을 처리할 수 없습니다." 로 매핑한다.
- 클라이언트 `api()`: 네트워크 실패 시 "서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.", 401 은 로그인 화면, 409 는 토스트 후 새로고침 안내.
- 3D: WebGL 실패는 오류 경계, 모델 로드 실패는 토스트와 대체 모델.
- 저장 실패 시 편집 내용은 유지되고 상태 문구 "저장하지 못했어요" 를 표시한다.

## 14. 테스트 전략

- 단위(Vitest): `@otb/shared`(schema, experience, collision, landscape 수학, textPages), `@otb/server`(validation, storage 로컬 모드, upgrade, seed), `@otb/scene` 의 순수 함수(`sideReadingPose`).
- API 블랙박스(Vitest): 빌드된 admin 앱을 임시 `DATA_DIR`, 고유 포트로 `next start` 해 현재 `tests/server.test.js` 의 모든 케이스를 통과시킨다. client 앱에 관리자 API 가 없음을 확인하는 케이스를 추가한다.
- e2e(@playwright/test): `webServer` 로 빌드된 두 앱을 같은 `DATA_DIR` 로 띄운다. 현재 12개 스크립트(`admin-parity`, `browser`, `collision`, `floor-editor`, `floor-reading`, `leave-guard`, `mobile-entry`, `model-thumbnails`, `workspace`, `capture`, `cloud`, `about`) 의 검증을 spec 으로 이관한다. `cloud` 는 `BLOB_READ_WRITE_TOKEN` 이 있을 때만 실행한다. `window.__editorWorld`, `window.__testReader` 는 빌드 환경변수 `NEXT_PUBLIC_TEST_HOOKS=1` 일 때 노출되는 `window.__otb = { studio, reader, scene }` 로 대체한다.
- 시각 확인: 단계별로 `docs/screenshots` 의 기존 화면과 같은 구도로 스크린샷을 남겨 비교한다.
- QA-UAT: 7단계에서 셀렉터를 갱신하고 `node tests/qa-uat/run-all.mjs` 를 재실행한다. Playwright MCP 방식은 유지한다.
- 정적 검사: `tsc --noEmit`(모든 패키지·앱), `next lint`, `next build`.

## 15. 배포와 로컬 실행

- Vercel 프로젝트 둘 유지. Root Directory `apps/client`, `apps/admin`. Framework Next.js. Install 은 저장소 루트에서 workspaces 로 실행. `.vercelignore` 유지, `api/index.js` 와 `vercel.json` rewrite 제거. `git.deploymentEnabled.main=false` 는 각 앱 `vercel.json` 에 유지.
- 환경변수: 공통 `BLOB_READ_WRITE_TOKEN`, `BLOB_NAMESPACE`. admin `ADMIN_PASSWORD`(cloud 필수), `NEXT_PUBLIC_CLIENT_URL`(공개 화면 링크). `DEPLOYMENT_APP`, `VITE_CLIENT_URL` 은 제거.
- 로컬: `npm run dev` 가 client 3000, admin 3001 을 동시에 띄운다. 두 프로세스가 같은 `data/` 를 읽고 쓴다. `npm run build` 가 두 앱을 빌드하고 `npm start` 가 둘을 띄운다. README 의 주소를 `http://localhost:3000/`, `http://localhost:3001/admin/` 로 갱신한다.
- 서버 바인딩: 로컬 `next start -H 127.0.0.1` 로 현재의 로컬 전용 동작을 유지한다.

## 16. 단계와 완료 기준

각 단계는 별도 구현 계획을 만들고, 완료 기준을 모두 충족한 뒤 커밋한다.

0. 진행 중인 모델 썸네일 변경(10개 파일) 커밋. 사용자 확인 후 수행.
1. 뼈대: workspaces, `apps/*` 빈 Next 앱, `@otb/shared`(현재 shared 순수 모듈 TS 이식), `@otb/server`, `@otb/ui`(Toast·Modal·api·CSS·자산 동기화), 모든 Route Handler, Vitest 설정, API 블랙박스 테스트 통과, Vercel 설정 파일. 완료 기준: `tsc`, 두 앱 `next build`, API 테스트 전부 통과, 로그인·로딩 화면 표시.
2. `@otb/scene`: 7.1 공용 컴포넌트와 `JourneyController`, `HeroScene`, `JourneyScene`, 순수 함수 단위 테스트, Playwright 스모크(캔버스 렌더, 이동, 반응 범위 진입 시 애니메이션). 완료 기준: 스모크 통과, 히어로·탐험 스크린샷.
3. 관리자 셸: 9절의 편집기 제외 전체. 완료 기준: `browser`, `leave-guard`, `model-thumbnails` 의 관리자 검증 이관 통과.
4. 관리자 월드 편집기: 7.2 와 9절 `WorldEditor`. 완료 기준: `workspace`, `floor-editor`, `admin-parity`, `collision` 의 편집기 검증 이관 통과, 스크린샷.
5. antd Tour: 11절. 완료 기준: 투어 e2e 통과, 다른 e2e 가 우회 플래그로 통과.
6. `@otb/reader` 와 사용자 앱(소개 페이지 포함), `/admin/preview`: 10절. 완료 기준: `floor-reading`, `mobile-entry`, `browser` 의 사용자 검증과 `about` 검증 이관 통과, `tests/about-compare.mjs` 로 이관 전후 소개 페이지 비교, 390×844 스크린샷.
7. 정리: `client/`, `admin/`, `shared/`, `server/`, `vite.config.js`, 구 테스트 스크립트 제거, `capture`·`cloud` 이관, QA-UAT 재실행, README·DEPLOYMENT·ADMIN-GUIDE 갱신. 완료 기준: 저장소에 Vite 흔적 없음, 모든 테스트 통과, 문서의 주소·명령이 실제와 일치.

## 17. 위험과 대응

- R3F 가 React 19.3 을 지원하지 않는다. React 를 19.2 로 고정하고 `npm ls` 로 peer 충돌을 확인한다.
- 관리자 번들이 antd 와 R3F 로 커진다. 관리자 전용이므로 허용하되, antd 는 `Tour` 와 `ConfigProvider` 만 import 한다.
- TransformControls 스냅·프록시와 드래그 배치 레이캐스트가 가장 큰 재구현 위험이다. 4단계 계획에서 이 두 항목을 먼저 만들고 e2e 로 고정한다.
- 로컬 두 프로세스가 같은 파일을 읽고 쓴다. 매 요청 재읽기와 tmp+rename 쓰기로 정합성을 유지한다.
- 정적 자산 복사 스크립트를 잊으면 아이콘·바닥 텍스처가 깨진다. `predev`·`prebuild` 훅에 걸고 e2e 가 `/floor-assets/arrow.svg` 응답을 확인한다.
- 기능 동등성은 이관된 e2e 로만 판정한다. 이관 과정에서 검증을 빠뜨리지 않도록 각 spec 파일 머리에 원본 스크립트 이름과 항목 수를 적는다.
