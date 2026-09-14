# 1단계: 모노레포 뼈대와 Route Handler API 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** npm workspaces 모노레포에 Next.js 16 앱 둘(apps/client, apps/admin)과 공유 패키지 셋(@otb/shared, @otb/server, @otb/ui)을 세우고, Express API 전체를 Route Handler 로 재작성해 기존 서버 테스트가 새 앱에서 그대로 통과하게 한다. 화면은 로그인·로딩·플레이스홀더만 만든다.

**Architecture:** `@otb/shared` 는 zod 스키마와 순수 계산 로직, `@otb/server` 는 저장소·검증·세션과 `Request → Response` 핸들러 팩토리, `@otb/ui` 는 브라우저 api 클라이언트·로고·토스트·전역 CSS·공용 정적 자산을 담는다. 각 Next 앱의 `route.ts` 는 필요한 핸들러만 re-export 하므로 client 앱에는 관리자 API 가 존재하지 않는다. 기존 `client/`, `admin/`, `shared/`, `server/`, Vite 설정은 7단계까지 `legacy:*` 스크립트로 유지한다.

**Tech Stack:** Next.js 16.3.4(App Router, Turbopack), React 19.2.8, TypeScript 5.9, zod 4, @vercel/blob 2.8, Vitest 5, @playwright/test(Edge 채널), concurrently.

**스펙:** `docs/superpowers/specs/2026-09-11-react-next-migration-design.md` 3·4·5·6·12·14·15절, 16절 1단계.

**스펙과의 차이(의도된 조정):**
- `Modal` 컴포넌트는 1단계 화면이 쓰지 않으므로 3단계로 미룬다. `Toast` 는 포함한다.
- Next 16 에서 `next lint` 가 제거되어 ESLint 설정은 7단계에서 한다. 1단계 정적 검사는 `tsc --noEmit` 과 `next build` 다.
- Vitest 5 가 Node 22.12 이상을 요구하므로 `engines.node` 를 `>=22.12` 로 올린다. README 갱신은 7단계.

## Global Constraints

- 유지 계약(스펙 3절): `library.json` 구조, `/uploads/<uuid>.png|glb` 루트 경로, API 경로·메서드·상태 코드·한국어 오류 메시지, 헤더 `X-On-The-Book: studio`, 쿠키 `otb_session`(httpOnly, SameSite=Strict, 8시간), 로그인 시도 제한 10회/60초, 버전 충돌 409.
- 관리자 앱에 `basePath` 를 쓰지 않는다. `/admin` 은 `app/admin/` 폴더 라우팅이다.
- React 는 `19.2.8` 고정(R3F peer 범위 `<19.3`). Next `16.3.4`, TypeScript `^5.9.3`(7.x 금지).
- 패키지는 빌드하지 않고 `exports` 로 TS 소스를 노출한다. 패키지 이름은 `@otb/shared`, `@otb/server`, `@otb/ui`.
- 로컬 저장소는 매 요청 `library.json` 을 다시 읽고 `.tmp` 에 쓴 뒤 `rename` 한다(스펙 6.3).
- 모든 route.ts 는 `export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'` 을 선언한다.
- 개발 포트: client 3000, admin 3001. 테스트 포트: 4401~4404(API), 4411~4413(e2e).
- 커밋 메시지는 영어 명령형 한 줄 + 본문, 마지막 줄 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 파일 경로는 저장소 루트 기준. 명령은 저장소 루트에서 실행(다른 곳이면 명시).

---

## 파일 구조

```
package.json                          수정: workspaces, scripts, devDependencies
tsconfig.base.json                    새 파일: 공통 TS 옵션
vitest.config.ts                      새 파일
.gitignore                            수정
scripts/sync-public.mjs               새 파일: 공용 정적 자산 복사
packages/shared/{package.json,tsconfig.json,src/index.ts,src/schema.ts,src/types.ts,src/experience.ts,src/collision.ts,src/landscape.ts,src/text-pages.ts}
packages/server/{package.json,tsconfig.json,src/index.ts,src/upgrade.ts,src/seed.ts,src/storage.ts,src/validation.ts,src/http.ts,src/session.ts,src/library-rules.ts,src/handlers/{session.ts,library.ts,studio.ts,uploads.ts,uploaded-file.ts,not-found.ts}}
packages/ui/{package.json,tsconfig.json,src/index.ts,src/api.ts,src/Logo.tsx,src/toast.ts,src/Toaster.tsx,styles/{base.css,admin.css,workspace.css,transitions.css},public/**}
apps/admin/{package.json,tsconfig.json,next.config.ts,vercel.json,app/layout.tsx,app/fonts.ts,app/admin/page.tsx,components/StudioBoot.tsx,components/LoginScreen.tsx,app/api/**/route.ts,app/uploads/[filename]/route.ts}
apps/client/{package.json,tsconfig.json,next.config.ts,vercel.json,app/layout.tsx,app/fonts.ts,app/page.tsx,components/ReaderBoot.tsx,app/api/library/route.ts,app/api/[[...missing]]/route.ts,app/uploads/[filename]/route.ts}
tests/fixtures.ts                     새 파일: sampleGLB, tinyPng
tests/unit/shared/*.test.ts           @otb/shared 단위 테스트(기존 node:test 이식)
tests/unit/server/*.test.ts           @otb/server 단위·핸들러 테스트
tests/unit/ui/*.test.ts               @otb/ui 테스트
tests/unit/scripts/sync-public.test.ts
tests/api/{harness.ts,admin.test.ts,client.test.ts}   빌드된 앱 블랙박스 테스트
tests/e2e/phase1-smoke.spec.ts, playwright.config.ts
```

---

### Task 1: 워크스페이스 뼈대

**Files:**
- Modify: `package.json`
- Create: `tsconfig.base.json`, `vitest.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 루트 스크립트 `dev`, `build`, `start`, `typecheck`, `test`, `test:api`, `test:e2e`, `legacy:*`. 모든 패키지·앱 tsconfig 가 확장할 `tsconfig.base.json`.

- [ ] **Step 1: package.json 을 워크스페이스 구성으로 바꾼다**

`package.json` 전체를 다음으로 교체한다. `dependencies` 는 기존 값을 유지한다.

```json
{
  "name": "on-the-book",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=22.12" },
  "scripts": {
    "dev": "concurrently -k -n client,admin -c cyan,green \"npm run dev -w apps/client\" \"npm run dev -w apps/admin\"",
    "build": "npm run build -w apps/client && npm run build -w apps/admin",
    "start": "concurrently -k -n client,admin -c cyan,green \"npm run start -w apps/client\" \"npm run start -w apps/admin\"",
    "typecheck": "tsc -p packages/shared && tsc -p packages/server && tsc -p packages/ui && npm run typecheck -w apps/client && npm run typecheck -w apps/admin",
    "test": "vitest run tests/unit",
    "test:api": "npm run build && vitest run tests/api --no-file-parallelism",
    "test:e2e": "playwright test",
    "legacy:dev": "node server/index.js",
    "legacy:start": "node server/index.js --production",
    "legacy:build": "vite build",
    "legacy:build:client": "vite build --mode client",
    "legacy:build:admin": "vite build --mode admin",
    "legacy:test": "node --test tests/*.test.js",
    "legacy:test:e2e": "node tests/workspace.mjs",
    "legacy:test:mobile": "npm run legacy:build && node tests/mobile-entry.mjs"
  },
  "dependencies": {
    "@vercel/blob": "^2.8.0",
    "express": "^5.1.0",
    "lucide": "^0.468.0",
    "multer": "^2.0.2",
    "three": "^0.180.0",
    "vite": "^7.1.5",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "@types/node": "^22.20.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "concurrently": "^10.0.5",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "typescript": "^5.9.3",
    "vitest": "^5.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.base.json 을 만든다**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["node"]
  }
}
```

- [ ] **Step 3: vitest.config.ts 를 만든다**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx", "tests/api/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
```

- [ ] **Step 4: .gitignore 에 새 산출물을 추가한다**

기존 내용 끝에 덧붙인다.

```
.next/
apps/*/public/
next-env.d.ts
*.tsbuildinfo
playwright-report/
```

- [ ] **Step 5: 설치하고 기존 테스트가 그대로 통과하는지 확인한다**

Run: `npm install && npm run legacy:test 2>&1 | grep -E "ℹ (tests|pass|fail)"`
Expected:
```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

Run: `npx vitest --version && npx tsc --version`
Expected: `vitest/5.x.x` 와 `Version 5.9.x` 가 출력된다.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts .gitignore
git commit -m "Set up npm workspaces, TypeScript base config, and Vitest

Legacy Vite and Express scripts stay available under legacy:* until
phase 7 removes the old sources.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: @otb/shared — 스키마와 순수 로직

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/schema.ts`, `src/types.ts`, `src/experience.ts`, `src/collision.ts`, `src/landscape.ts`, `src/text-pages.ts`, `src/index.ts`
- Test: `tests/unit/shared/collision.test.ts`, `experience.test.ts`, `landscape.test.ts`, `text-pages.test.ts`, `schema.test.ts`

**Interfaces:**
- Produces:
  - `librarySchema`, `bookSchema`, `chapterSchema`, `placementSchema`, `modelSchema`, `kinds`, `animations`, `themes`
  - 타입 `Library`, `LibraryInput`, `Book`, `Chapter`, `Placement`, `Model`, `FloorDecal`
  - `collisionSize(p)`, `mainModel(chapter)`, `reactionSize(p, chapter)`, `triggerCircles(book)`, `overlapsTrigger(candidate, chapter, book?)`, `newTriggerConflict(book, previous?)`
  - `travellerRadius`, `obstacles(objects)`, `clearAt(point, walls)`, `slideMove(start, delta, walls)`
  - `routePoints(chapter)`, `defaultDecals(chapter)`, `arrowPlacements(chapter, circles?)`, `layout(chapters)`
  - `textPages(text, limit = 112)`

- [ ] **Step 1: 실패하는 단위 테스트를 만든다**

기존 `tests/*.test.js` 의 검증을 그대로 옮긴다. 파일 다섯 개를 만든다.

`tests/unit/shared/collision.test.ts`
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { slideMove, clearAt, obstacles } from "@otb/shared";

test("solid model blocks a long movement without tunnelling", () => {
  const walls = [{ x: 0, z: 0, r: 1 }];
  const p = slideMove({ x: -4, z: 0 }, { x: 8, z: 0 }, walls);
  assert.ok(p.x < -1);
  assert.ok(clearAt(p, walls));
});
test("diagonal movement slides along the boundary", () => {
  const walls = [{ x: 0, z: 0, r: 1 }];
  const p = slideMove({ x: -2, z: 0.3 }, { x: 3, z: 1 }, walls);
  assert.ok(p.z > 0.3);
  assert.ok(clearAt(p, walls));
});
test("disabled collision allows passage and scale updates radius", () => {
  assert.equal(obstacles([{ p: { x: 0, z: 0, scale: 1, collision: false } }]).length, 0);
  assert.equal(obstacles([{ p: { x: 0, z: 0, scale: 2, collisionRadius: 1 } }])[0].r, 2.32);
});
```

`tests/unit/shared/experience.test.ts`
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { reactionSize, overlapsTrigger, newTriggerConflict, obstacles } from "@otb/shared";

test("placement trigger exclusion includes neighbours and ignores height", () => {
  const p = { id: "a", x: 0, z: 0, radius: 2, scale: 1, collision: false };
  const c = { id: "c", width: 64, placements: [p] };
  assert.equal(overlapsTrigger({ ...p, id: "b", x: 7, y: 30 } as typeof p, c), true);
  assert.equal(overlapsTrigger({ ...p, id: "b", x: 8 }, c), false);
  const book = { chapters: [{ ...c, placements: [{ ...p, x: 31 }] }, { id: "d", width: 64, placements: [] }] };
  assert.equal(overlapsTrigger({ ...p, id: "b", x: -31 }, book.chapters[1], book), true);
  const legacy = { chapters: [{ ...c, placements: [p, { ...p, id: "b", x: 2 }] }] };
  assert.equal(newTriggerConflict(legacy, legacy), false);
  assert.equal(newTriggerConflict(legacy), true);
});
test("reaction radius matches chapter multiplier and stays outside the scaled collision boundary", () => {
  const p = { x: 0, z: 0, scale: 3, radius: 1, collisionRadius: 2, collision: true };
  assert.equal(reactionSize(p, {}), 13.7);
  assert.equal(reactionSize(p, { reactionMultiplier: 3 }), 20.549999999999997);
  assert.ok(reactionSize(p, { reactionMultiplier: 1 }) > obstacles([{ p }])[0].r);
  assert.equal(reactionSize({ ...p, collision: false }, { reactionMultiplier: 3 }), 3);
});
```

`tests/unit/shared/landscape.test.ts`
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { routePoints, defaultDecals, arrowPlacements, layout } from "@otb/shared";

test("automatic arrow footprints stay outside trigger boundaries at every scale", () => {
  for (const scale of [0.3, 1, 3]) {
    const chapter = { width: 100, placements: [{ x: 0, z: 0, radius: 5, scale: 1, collision: false }], floorArrowScale: scale };
    const arrows = arrowPlacements(chapter);
    assert.ok(arrows.length);
    for (const arrow of arrows) assert.ok(Math.hypot(arrow.x, arrow.z) >= 10 + Math.hypot(arrow.width, arrow.height) / 2);
    assert.equal(arrowPlacements({ ...chapter, floorArrows: false }).length, 0);
  }
});
test("legacy manual route remains stored but is excluded from automatic routing", () => {
  const chapter = { width: 64, depth: 56, placements: [{ x: 20, z: 9 }], floorRoute: [{ x: 10, z: -8 }, { x: -10, z: 5 }] };
  assert.deepEqual(routePoints(chapter), [{ x: -32, z: 0 }, { x: 20, z: 9 }, { x: 32, z: 0 }]);
  assert.deepEqual(routePoints({ ...chapter, width: 80, placements: [] }), [{ x: -40, z: 0 }, { x: 40, z: 0 }]);
  assert.deepEqual(chapter.floorRoute, [{ x: 10, z: -8 }, { x: -10, z: 5 }]);
});
test("legacy artwork can be materialized without changing its placement", () => {
  const c = { width: 64, depth: 56, theme: "tea", placements: [{ x: -9, z: 1 }, { x: 31, z: 27 }] };
  const decals = defaultDecals(c);
  assert.equal(decals[0].asset, "tea-cup");
  assert.equal(decals[0].x, -14);
  assert.equal(decals[0].z, 7);
  assert.equal(decals[1].x, 29);
  assert.equal(decals[1].z, 25);
  assert.deepEqual(defaultDecals({ ...c, floorDecor: "none" }), []);
});
test("floor route connects chapter edges and only the main model", () => {
  assert.deepEqual(
    routePoints({ width: 80, mainPlacementId: "main", placements: [{ id: "support", x: 12, z: 8 }, { id: "main", x: -10, z: -4 }] }),
    [{ x: -40, z: 0 }, { x: -10, z: -4 }, { x: 40, z: 0 }],
  );
});
test("layout places chapters side by side from the first chapter's left edge", () => {
  const zones = layout([{ width: 64, depth: 56 }, { width: 80, depth: 40 }]);
  assert.deepEqual(zones.map((z) => [z.start, z.end, z.x, z.depth]), [[-32, 32, 0, 56], [32, 112, 72, 40]]);
});
```

`tests/unit/shared/text-pages.test.ts`
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { textPages } from "@otb/shared";

test("floor pagination retains the complete chapter, including emoji and paragraph breaks", () => {
  const text = "책 속에서 토끼를 만났어요. 🌿 천천히 걸으며 이야기를 읽습니다.\n\n".repeat(12).trim();
  const pages = textPages(text);
  assert.equal(pages.join(""), text);
  assert.ok(pages.every((page) => Array.from(page).length <= 112));
});
test("empty text yields a single empty page", () => {
  assert.deepEqual(textPages("   "), [""]);
});
```

`tests/unit/shared/schema.test.ts`
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { chapterSchema, librarySchema } from "@otb/shared";

const chapter = {
  id: "c1", title: "챕터", subtitle: "", body: "본문", theme: "meadow",
  placements: [{ id: "p1", modelId: "rabbit", x: 0, z: 0, scale: 1, rotation: 0, radius: 2, animation: "hop", title: "토끼", story: "" }],
};
test("chapter defaults assign the first placement as main and apply floor defaults", () => {
  const parsed = chapterSchema.parse(chapter);
  assert.equal(parsed.mainPlacementId, "p1");
  assert.equal(parsed.width, 64);
  assert.equal(parsed.floorPageSize, 112);
});
test("main must reference a placement in this chapter; empty drafts have no main", () => {
  assert.equal(chapterSchema.safeParse({ ...chapter, mainPlacementId: "missing" }).success, false);
  assert.equal(chapterSchema.safeParse({ ...chapter, mainPlacementId: null }).success, false);
  assert.equal(chapterSchema.safeParse({ ...chapter, placements: [], mainPlacementId: null }).success, true);
  assert.equal(chapterSchema.safeParse({ ...chapter, placements: [] }).success, false);
});
test("library rejects duplicate ids and dangling model references", () => {
  const model = { id: "rabbit", name: "토끼", kind: "rabbit", credit: "", color: "#ffffff" };
  const book = { id: "b1", title: "책", englishTitle: "Book", author: "", year: 1865, description: "", source: "https://example.org/", rights: "", published: false, chapters: [chapter] };
  assert.equal(librarySchema.safeParse({ models: [model], books: [book] }).success, true);
  assert.equal(librarySchema.safeParse({ models: [model, { ...model }], books: [book] }).success, false);
  assert.equal(librarySchema.safeParse({ models: [], books: [book] }).success, false);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/unit/shared`
Expected: 다섯 파일 모두 `Failed to resolve import "@otb/shared"` 로 실패.

- [ ] **Step 3: 패키지 메타를 만든다**

`packages/shared/package.json`
```json
{
  "name": "@otb/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^4.1.5" }
}
```

`packages/shared/tsconfig.json`
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 4: schema.ts 와 types.ts 를 쓴다**

`packages/shared/src/schema.ts`
```ts
import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = z.string().trim().min(1).max(200);
export const kinds = ["rabbit", "mushroom", "teapot", "tree", "rose", "key", "clock", "cards", "house", "glb"] as const;
export const animations = ["hop", "spin", "float", "sway", "clip", "none"] as const;
export const themes = ["meadow", "night", "tea", "rose", "gold"] as const;

export const modelSchema = z
  .object({
    id,
    name: text,
    kind: z.enum(kinds),
    rigged: z.boolean().default(false),
    clips: z.array(z.string().max(200)).max(100).default([]),
    url: z.string().regex(/^\/uploads\/[a-f0-9-]+\.glb$/).optional(),
    thumbnail: z.string().regex(/^\/uploads\/[a-f0-9-]+\.png$/).optional(),
    credit: z.string().max(500),
    color: z.string().regex(/^#[a-f0-9]{6}$/i),
  })
  .refine((m) => m.kind !== "glb" || m.url, { message: "GLB 파일을 등록해 주세요." });

export const placementSchema = z.object({
  id,
  modelId: id,
  x: z.number().min(-59).max(59),
  y: z.number().min(0).max(40).default(0),
  z: z.number().min(-49).max(49),
  scale: z.number().min(0.1).max(8),
  rotation: z.number().min(-360).max(360),
  radius: z.number().min(0.5).max(20),
  collision: z.boolean().default(true),
  collisionRadius: z.number().min(0.1).max(20).default(0.8),
  animation: z.enum(animations),
  clip: z.string().max(200).default(""),
  title: text,
  story: z.string().max(4000),
});

export const chapterSchema = z
  .object({
    mainPlacementId: id.nullable().optional(),
    id,
    title: text,
    subtitle: z.string().max(250),
    body: z.string().max(15000),
    theme: z.enum(themes),
    width: z.number().min(40).max(120).default(64),
    depth: z.number().min(40).max(100).default(56),
    floorArrows: z.boolean().default(true),
    floorRoute: z.array(z.object({ x: z.number().min(-59).max(59), z: z.number().min(-49).max(49) })).max(40).nullable().default(null),
    floorArrowSpacing: z.number().min(2).max(12).default(4.5),
    floorArrowScale: z.number().min(0.3).max(3).default(1),
    floorDecals: z
      .array(
        z.object({
          id,
          asset: z.string().regex(/^(leaves|pocket-watch|tea-cup|open-book|arrow|\/uploads\/[a-f0-9-]+\.png)$/),
          y: z.number().min(0).max(40).default(0),
          x: z.number().min(-59).max(59),
          z: z.number().min(-49).max(49),
          width: z.number().min(0.2).max(30),
          height: z.number().min(0.2).max(30),
          rotation: z.number().min(-360).max(360),
        }),
      )
      .max(100)
      .nullable()
      .default(null),
    floorDecor: z.enum(["auto", "none", "leaves", "pocket-watch", "tea-cup", "open-book"]).default("auto"),
    floorEnabled: z.boolean().default(true),
    floorText: z.string().max(15000).default(""),
    floorOffsetX: z.number().min(-16).max(16).default(0),
    floorOffsetZ: z.number().min(-16).max(16).default(-9),
    reactionMultiplier: z.number().min(1).max(4).default(2),
    floorPageSize: z.number().int().min(40).max(400).default(112),
    floorStagger: z.boolean().default(true),
    floorZoom: z.number().min(1).max(1.8).default(1.1),
    placements: z.array(placementSchema).max(60),
  })
  .transform((c) => ({ ...c, mainPlacementId: c.mainPlacementId === undefined ? (c.placements[0]?.id ?? null) : c.mainPlacementId }))
  .refine((c) => (c.placements.length ? c.placements.some((p) => p.id === c.mainPlacementId) : c.mainPlacementId === null), {
    message: "챕터에 배치된 메인 모델을 하나 지정해 주세요.",
  })
  .refine(
    (c) => [...c.placements, ...(c.floorRoute || []), ...(c.floorDecals || [])].every((p) => Math.abs(p.x) <= c.width / 2 - 1 && Math.abs(p.z) <= c.depth / 2 - 1),
    { message: "모델과 바닥 배치의 중심을 챕터 공간 안에 놓아 주세요." },
  );

export const bookSchema = z.object({
  id,
  title: text,
  englishTitle: text,
  author: z.string().max(200),
  cover: z.string().regex(/^\/uploads\/[a-f0-9-]+\.png$/).or(z.literal("")).default(""),
  floorAssets: z.array(z.object({ asset: z.string().regex(/^\/uploads\/[a-f0-9-]+\.png$/), name: text })).max(300).optional(),
  year: z.number().int().min(1).max(2026),
  description: z.string().max(1000),
  source: z.url().refine((s) => /^https?:/.test(s)),
  rights: z.string().max(1000),
  published: z.boolean(),
  chapters: z.array(chapterSchema).min(1).max(40),
});

export const librarySchema = z
  .object({
    models: z.array(modelSchema).max(300),
    books: z.array(bookSchema).max(50),
  })
  .superRefine((s, c) => {
    const modelIds = new Set(s.models.map((m) => m.id));
    const seen = new Set<string>();
    for (const row of [...s.models, ...s.books, ...s.books.flatMap((b) => b.chapters), ...s.books.flatMap((b) => b.chapters.flatMap((ch) => ch.placements))]) {
      if (seen.has(row.id)) c.addIssue({ code: "custom", message: "중복된 항목 ID가 있습니다." });
      seen.add(row.id);
    }
    for (const p of s.books.flatMap((b) => b.chapters.flatMap((ch) => ch.placements)))
      if (!modelIds.has(p.modelId)) c.addIssue({ code: "custom", message: "배치된 모델을 먼저 장면에서 제거해 주세요." });
  });
```

`packages/shared/src/types.ts`
```ts
import type { z } from "zod";
import type { bookSchema, chapterSchema, librarySchema, modelSchema, placementSchema } from "./schema";

export type Library = z.infer<typeof librarySchema>;
export type LibraryInput = z.input<typeof librarySchema>;
export type Book = z.infer<typeof bookSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type Placement = z.infer<typeof placementSchema>;
export type Model = z.infer<typeof modelSchema>;
export type FloorDecal = NonNullable<Chapter["floorDecals"]>[number];
```

- [ ] **Step 5: experience.ts 와 collision.ts 를 쓴다**

`packages/shared/src/experience.ts`
```ts
export type PlacementLike = { id?: string; x: number; z: number; radius: number; scale: number; collision?: boolean; collisionRadius?: number };
export type ChapterLike = { id?: string; width?: number; reactionMultiplier?: number; mainPlacementId?: string | null; placements: PlacementLike[] };
export type BookLike = { chapters: ChapterLike[] };
export type TriggerCircle = { id?: string; x: number; z: number; radius: number; chapterId?: string; offset: number };

export function collisionSize(p: { collision?: boolean; collisionRadius?: number; scale: number }): number {
  return p.collision === false ? 0 : (p.collisionRadius ?? 0.8) * p.scale;
}

export function mainModel<T extends { id?: string }>(chapter: { placements: T[]; mainPlacementId?: string | null }): T | null | undefined {
  return chapter.placements.find((p) => p.id === chapter.mainPlacementId) || (chapter.mainPlacementId === undefined ? chapter.placements[0] : null);
}

export function reactionSize(p: PlacementLike, chapter: { reactionMultiplier?: number }): number {
  return (chapter.reactionMultiplier ?? 2) * Math.max(p.radius, p.collision !== false ? collisionSize(p) + 0.85 : 0);
}

export function triggerCircles(book: BookLike): TriggerCircle[] {
  let edge = -(book.chapters[0]?.width || 64) / 2;
  return book.chapters.flatMap((c) => {
    const width = c.width || 64;
    const offset = edge + width / 2;
    edge += width;
    return c.placements.map((p) => ({ id: p.id, x: p.x + offset, z: p.z, radius: reactionSize(p, c), chapterId: c.id, offset }));
  });
}

export function overlapsTrigger(candidate: PlacementLike, chapter: ChapterLike, book: BookLike = { chapters: [chapter] }): boolean {
  let offset = 0;
  let edge = -(book.chapters[0]?.width || 64) / 2;
  for (const c of book.chapters) {
    const width = c.width || 64;
    if (c.id === chapter.id) {
      offset = edge + width / 2;
      break;
    }
    edge += width;
  }
  return triggerCircles(book).some((p) => p.id !== candidate.id && Math.hypot(p.x - candidate.x - offset, p.z - candidate.z) < p.radius + reactionSize(candidate, chapter) - 0.00001);
}

export function newTriggerConflict(book: BookLike, previous: BookLike = { chapters: [] }): boolean {
  const before = new Map(triggerCircles(previous).map((p) => [p.id, p]));
  const circles = triggerCircles(book);
  const samePair = (p: TriggerCircle, q: TriggerCircle) => {
    const a = before.get(p.id);
    const b = before.get(q.id);
    return !!a && !!b && a.x - b.x === p.x - q.x && a.z - b.z === p.z - q.z && a.radius === p.radius && b.radius === q.radius;
  };
  return circles.some((p, i) => circles.slice(i + 1).some((q) => !samePair(p, q) && Math.hypot(p.x - q.x, p.z - q.z) < p.radius + q.radius - 0.00001));
}
```

`packages/shared/src/collision.ts`
```ts
export const travellerRadius = 0.32;
export type Point = { x: number; z: number };
export type Wall = { x: number; z: number; r: number };
export type Obstacle = { p: { x: number; z: number; scale: number; collision?: boolean; collisionRadius?: number } };

export function obstacles(objects: Obstacle[]): Wall[] {
  return objects.filter((o) => o.p.collision !== false).map((o) => ({ x: o.p.x, z: o.p.z, r: (o.p.collisionRadius ?? 0.8) * o.p.scale + travellerRadius }));
}

export function clearAt(point: Point, walls: Wall[]): boolean {
  return walls.every((o) => Math.hypot(point.x - o.x, point.z - o.z) >= o.r - 0.0001);
}

export function slideMove(start: Point, delta: Point, walls: Wall[]): Point {
  let point: Point = { ...start };
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / 0.12));
  for (let step = 0; step < steps; step++) {
    const next = { x: point.x + delta.x / steps, z: point.z + delta.z / steps };
    for (let pass = 0; pass < 8; pass++)
      for (const wall of walls) {
        const dx = next.x - wall.x;
        const dz = next.z - wall.z;
        const d = Math.hypot(dx, dz);
        if (d < wall.r) {
          const fallback = Math.hypot(point.x - wall.x, point.z - wall.z);
          const nx = d > 1e-8 ? dx / d : fallback > 1e-8 ? (point.x - wall.x) / fallback : 1;
          const nz = d > 1e-8 ? dz / d : fallback > 1e-8 ? (point.z - wall.z) / fallback : 0;
          next.x = wall.x + nx * (wall.r + 0.001);
          next.z = wall.z + nz * (wall.r + 0.001);
        }
      }
    if (clearAt(next, walls)) point = next;
  }
  return point;
}
```

- [ ] **Step 6: landscape.ts, text-pages.ts, index.ts 를 쓴다**

`packages/shared/src/landscape.ts` (three.js 의존이 없는 계산만. `floorArt`, `terrain` 은 2단계 `@otb/scene` 으로 간다)
```ts
import { mainModel, reactionSize, type PlacementLike } from "./experience";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type RoutePoint = { x: number; z: number };
export type ArrowPlacement = { x: number; z: number; width: number; height: number; angle: number };
export type DecalPlacement = { id: string; asset: string; x: number; z: number; width: number; height: number; rotation: number };
export type LayoutChapter = {
  width?: number;
  depth?: number;
  theme?: string;
  floorDecor?: string;
  floorArrows?: boolean;
  floorArrowScale?: number;
  floorArrowSpacing?: number;
  reactionMultiplier?: number;
  mainPlacementId?: string | null;
  placements: Array<{ id?: string; x: number; z: number }>;
};
export type Zone<T extends { width?: number; depth?: number }> = { chapter: T; width: number; depth: number; start: number; end: number; x: number };

export function routePoints(chapter: LayoutChapter): RoutePoint[] {
  const half = (chapter.width || 64) / 2;
  const main = mainModel(chapter);
  return [{ x: -half, z: 0 }, ...(main ? [{ x: main.x, z: main.z }] : []), { x: half, z: 0 }];
}

const themedDecal: Record<string, string> = { meadow: "leaves", night: "pocket-watch", tea: "tea-cup", rose: "leaves", gold: "open-book" };

export function defaultDecals(chapter: LayoutChapter): DecalPlacement[] {
  const style = chapter.floorDecor || "auto";
  if (style === "none") return [];
  const asset = style === "auto" ? themedDecal[chapter.theme || ""] || "leaves" : style;
  const width = chapter.width || 64;
  const depth = chapter.depth || 56;
  return chapter.placements.map((p, i) => ({
    id: "decor-" + i,
    asset,
    x: clamp(p.x + (i % 2 ? 5 : -5), -width / 2 + 3, width / 2 - 3),
    z: clamp(p.z + 6, -depth / 2 + 3, depth / 2 - 3),
    width: 3.5,
    height: 3,
    rotation: ((i % 2 ? -0.25 : 0.15) * 180) / Math.PI,
  }));
}

export function arrowPlacements(
  chapter: LayoutChapter & { placements: PlacementLike[] },
  circles: Array<{ x: number; z: number; radius: number }> = chapter.placements.map((p) => ({ ...p, radius: reactionSize(p, chapter) })),
): ArrowPlacement[] {
  if (chapter.floorArrows === false) return [];
  const result: ArrowPlacement[] = [];
  const points = routePoints(chapter);
  const scale = chapter.floorArrowScale ?? 1;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    const angle = Math.atan2(b.z - a.z, b.x - a.x);
    for (let d = 2.2; d < distance - 1.7; d += chapter.floorArrowSpacing ?? 4.5) {
      const x = a.x + ((b.x - a.x) * d) / distance;
      const z = a.z + ((b.z - a.z) * d) / distance;
      if (circles.some((p) => Math.hypot(x - p.x, z - p.z) < p.radius + (Math.hypot(2.8, 1.05) * scale) / 2)) continue;
      result.push({ x, z, width: 2.8 * scale, height: 1.05 * scale, angle });
    }
  }
  return result;
}

export function layout<T extends { width?: number; depth?: number }>(chapters: T[]): Zone<T>[] {
  let edge = -(chapters[0]?.width || 64) / 2;
  return chapters.map((chapter) => {
    const width = chapter.width || 64;
    const depth = chapter.depth || 56;
    const zone = { chapter, width, depth, start: edge, end: edge + width, x: edge + width / 2 };
    edge += width;
    return zone;
  });
}
```

`packages/shared/src/text-pages.ts`
```ts
export function textPages(text: string, limit = 112): string[] {
  const chars = Array.from(text.trim());
  const pages: string[] = [];
  let start = 0;
  while (start < chars.length) {
    let end = Math.min(start + limit, chars.length);
    if (end < chars.length) {
      for (let i = end - 1; i > start + limit * 0.55; i--) {
        if (/[.!?。\n]/.test(chars[i])) {
          end = i + 1;
          break;
        }
      }
      if (end === start + limit)
        for (let i = end - 1; i > start + limit * 0.65; i--) {
          if (/\s/.test(chars[i])) {
            end = i + 1;
            break;
          }
        }
    }
    pages.push(chars.slice(start, end).join(""));
    start = end;
  }
  return pages.length ? pages : [""];
}
```

`packages/shared/src/index.ts`
```ts
export * from "./schema";
export * from "./types";
export * from "./experience";
export * from "./collision";
export * from "./landscape";
export * from "./text-pages";
```

- [ ] **Step 7: 링크·테스트·타입 검사**

Run: `npm install && npx vitest run tests/unit/shared && npx tsc -p packages/shared`
Expected: `Test Files  5 passed`, `Tests  15 passed`, tsc 출력 없음(종료 코드 0).

- [ ] **Step 8: 커밋**

```bash
git add packages/shared tests/unit/shared package-lock.json
git commit -m "Add @otb/shared with schema and pure world logic in TypeScript

Ports zod schemas, experience/collision math, landscape layout math and
text pagination from shared/*.js. three.js-dependent drawing stays for
the scene package.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 3: @otb/server 코어 — upgrade, seed, storage, validation

**Files:**
- Create: `packages/server/package.json`, `packages/server/tsconfig.json`
- Create: `packages/server/src/upgrade.ts`, `src/seed.ts`, `src/storage.ts`, `src/validation.ts`, `src/index.ts`
- Create: `tests/fixtures.ts`
- Test: `tests/unit/server/seed.test.ts`, `tests/unit/server/upgrade.test.ts`, `tests/unit/server/validation.test.ts`, `tests/unit/server/storage.test.ts`

**Interfaces:**
- Consumes: `@otb/shared` 의 `librarySchema`, `chapterSchema`, `routePoints`, 타입 `Library`, `LibraryInput`.
- Produces:
  - `upgrade<T>(library: T): T`, `seed: LibraryInput`
  - 타입 `Db = { version: number; draft: Library; live: Library; publishedAt: string }`, `Snapshot = { db: Db; etag?: string }`
  - `isCloud()`, `dataDir()`, `uploadDir()`, `initialDb()`, `readLibrary()`, `persist(next, snapshot)`, `readAsset(filename, staging?)`, `writeAsset(filename, buffer)`, `signedAsset(pathname, operation?, maximumSizeInBytes?)`, `removeStaging(filename)`, `saveSession(token, expiry)`, `validSession(token?)`, `removeSession(token?)`, `publicAssetNames(db)`
  - `inspectPng(buffer)`, `inspectGlb(buffer)`, `modelInfo(buffer)`, 상수 `PNG_LIMIT`, `GLB_LIMIT`, `PNG_TOO_LARGE`, `PNG_INVALID`, `PNG_INCOMPLETE`, `GLB_TOO_LARGE`, `GLB_INVALID`, `GLB_NOT_STANDALONE`, `GLB_NOT_RIGGED`, 타입 `Inspection<T>`
- 환경변수는 호출 시점에 읽는다(`DATA_DIR`, `VERCEL`, `BLOB_NAMESPACE`). 테스트가 `process.env` 를 바꿔 쓸 수 있어야 한다.

- [ ] **Step 1: 테스트 픽스처를 만든다**

`tests/fixtures.ts` (기존 `tests/helpers.js` 의 `sampleGLB` 이식 + 1×1 PNG)
```ts
export function tinyPng(): Buffer {
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
}

export function sampleGLB(rigged = true): Buffer {
  const floats = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  let bin = Buffer.from(floats.buffer);
  const json: Record<string, any> = {
    asset: { version: "2.0", generator: "On the Book test fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.4, 0.65, 0.5, 1] } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 8 },
      { buffer: 0, byteOffset: 44, byteLength: 24 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-1, 0, 0], max: [1, 2, 0] },
      { bufferView: 1, componentType: 5126, count: 2, type: "SCALAR", min: [0], max: [1] },
      { bufferView: 2, componentType: 5126, count: 2, type: "VEC3" },
    ],
    animations: [{ name: "Float", channels: [{ sampler: 0, target: { node: 0, path: "translation" } }], samplers: [{ input: 1, output: 2, interpolation: "LINEAR" }] }],
  };
  if (rigged) {
    const jointOffset = bin.length;
    const weightOffset = jointOffset + 12;
    bin = Buffer.concat([bin, Buffer.alloc(12), Buffer.from(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]).buffer)]);
    json.nodes[0].skin = 0;
    json.nodes.push({ name: "RootJoint" });
    json.scenes[0].nodes.push(1);
    json.skins = [{ joints: [1] }];
    json.bufferViews.push({ buffer: 0, byteOffset: jointOffset, byteLength: 12 }, { buffer: 0, byteOffset: weightOffset, byteLength: 48 });
    json.accessors.push({ bufferView: 3, componentType: 5121, count: 3, type: "VEC4" }, { bufferView: 4, componentType: 5126, count: 3, type: "VEC4" });
    json.meshes[0].primitives[0].attributes.JOINTS_0 = 3;
    json.meshes[0].primitives[0].attributes.WEIGHTS_0 = 4;
    json.animations[0].channels[0].target.node = 1;
    json.buffers[0].byteLength = bin.length;
  }
  let text = Buffer.from(JSON.stringify(json));
  const padding = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(padding, 32)]);
  const header = Buffer.alloc(20);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, text, bh, bin]);
}
```

- [ ] **Step 2: 실패하는 테스트를 만든다**

`tests/unit/server/seed.test.ts` (기존 server.test 앞 두 케이스, main-model.test, floor.test 의 스키마 케이스 이식)
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { librarySchema, chapterSchema, routePoints } from "@otb/shared";
import { seed } from "@otb/server";

test("sample books have valid references and unique identifiers", () => assert.equal(librarySchema.safeParse(seed).success, true));
test("negative radius, duplicate IDs and missing model references are rejected", () => {
  const edits: Array<(s: any) => unknown> = [
    (s) => (s.books[0].chapters[0].placements[0].radius = -1),
    (s) => (s.models[1].id = s.models[0].id),
    (s) => s.models.shift(),
  ];
  for (const edit of edits) {
    const s = structuredClone(seed);
    edit(s);
    assert.equal(librarySchema.safeParse(s).success, false);
  }
});
test("legacy migration assigns first placement without changing content or coordinates", () => {
  const old: any = structuredClone(seed.books[0].chapters[0]);
  delete old.mainPlacementId;
  const c = chapterSchema.parse(old);
  assert.equal(c.mainPlacementId, old.placements[0].id);
  assert.equal(c.body, old.body);
  assert.deepEqual(c.placements.map((p) => [p.id, p.x, p.z]), old.placements.map((p: any) => [p.id, p.x, p.z]));
});
test("main must reference a placement in this chapter; empty drafts have no main", () => {
  const c = chapterSchema.parse(seed.books[0].chapters[0]);
  assert.equal(chapterSchema.safeParse({ ...c, mainPlacementId: "missing-model" }).success, false);
  assert.equal(chapterSchema.safeParse({ ...c, mainPlacementId: null }).success, false);
  assert.equal(chapterSchema.safeParse({ ...c, placements: [], mainPlacementId: null }).success, true);
  assert.equal(chapterSchema.safeParse({ ...c, placements: [] }).success, false);
});
test("changing main changes the only automatic waypoint without moving models", () => {
  const c = chapterSchema.parse(seed.books[0].chapters[0]);
  const positions = structuredClone(c.placements);
  c.mainPlacementId = c.placements[1].id;
  assert.deepEqual(routePoints(c)[1], { x: positions[1].x, z: positions[1].z });
  assert.equal(routePoints(c).length, 3);
  assert.deepEqual(c.placements, positions);
});
test("floor options accept disabled effects and reject invalid camera settings", () => {
  const chapter = { ...seed.books[0].chapters[0], floorEnabled: false, floorArrows: false, floorDecor: "none", floorZoom: 1.3 };
  assert.equal(chapterSchema.parse(chapter).floorEnabled, false);
  assert.equal(chapterSchema.safeParse({ ...chapter, floorZoom: 10 }).success, false);
  assert.equal(chapterSchema.safeParse({ ...chapter, floorDecor: "unknown" }).success, false);
});
```

`tests/unit/server/upgrade.test.ts` (free-world.test 이식)
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { librarySchema } from "@otb/shared";
import { seed, upgrade } from "@otb/server";

test("legacy migration preserves models, spreads placements once, removes game settings", () => {
  const old: any = structuredClone(seed);
  const c = old.books[0].chapters[0];
  delete c.width;
  delete c.depth;
  c.encounter = "rabbit";
  c.placements.forEach((p: any) => {
    p.x /= 3;
    p.z /= 3;
    p.collectible = true;
  });
  const next = upgrade(old);
  const result = next.books[0].chapters[0];
  assert.equal(result.width, 64);
  assert.equal(result.depth, 56);
  assert.equal(result.placements[0].x, -9);
  assert.equal(result.encounter, undefined);
  assert.equal(result.placements[0].collectible, undefined);
  assert.deepEqual(next.models, old.models);
  assert.deepEqual(upgrade(next), next);
  assert.equal(old.books[0].chapters[0].encounter, "rabbit");
});
test("placements outside resized chapter bounds are rejected", () => {
  const input: any = structuredClone(seed);
  const c = input.books[0].chapters[0];
  c.width = 90;
  c.depth = 80;
  c.placements[0].x = 35;
  c.placements[0].radius = 12;
  assert.equal(librarySchema.safeParse(input).success, true);
  c.width = 40;
  assert.equal(librarySchema.safeParse(input).success, false);
});
```

`tests/unit/server/validation.test.ts`
```ts
import { test } from "vitest";
import assert from "node:assert/strict";
import { inspectPng, inspectGlb, modelInfo, PNG_INVALID, PNG_INCOMPLETE, GLB_INVALID, GLB_NOT_RIGGED, GLB_NOT_STANDALONE } from "@otb/server";
import { sampleGLB, tinyPng } from "../../fixtures";

test("a complete 1x1 PNG is accepted with its dimensions", () => {
  const result = inspectPng(tinyPng());
  assert.deepEqual(result, { ok: true, value: { width: 1, height: 1 } });
});
test("non-PNG bytes and truncated PNGs are rejected with the original messages", () => {
  assert.deepEqual(inspectPng(Buffer.from("definitely not a png file at all, just text")), { ok: false, message: PNG_INVALID });
  assert.deepEqual(inspectPng(tinyPng().subarray(0, 40)), { ok: false, message: PNG_INVALID });
  assert.deepEqual(inspectPng(tinyPng().subarray(0, 60)), { ok: false, message: PNG_INCOMPLETE });
});
test("rigged GLB reports its clips; unrigged and malformed files are rejected", () => {
  const good = inspectGlb(sampleGLB());
  assert.deepEqual(good, { ok: true, value: { clips: ["Float"], rigged: true, bytes: sampleGLB().length } });
  assert.deepEqual(inspectGlb(sampleGLB(false)), { ok: false, message: GLB_NOT_RIGGED });
  assert.deepEqual(inspectGlb(Buffer.from("not a model")), { ok: false, message: GLB_INVALID });
  const external = sampleGLB();
  const size = external.readUInt32LE(12);
  const json = JSON.parse(external.toString("utf8", 20, 20 + size));
  json.images = [{ uri: "https://example.org/texture.png" }];
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 32)]);
  const rest = external.subarray(20 + size);
  const rebuilt = Buffer.concat([external.subarray(0, 20), text, rest]);
  rebuilt.writeUInt32LE(rebuilt.length, 8);
  rebuilt.writeUInt32LE(text.length, 12);
  assert.deepEqual(inspectGlb(rebuilt), { ok: false, message: GLB_NOT_STANDALONE });
  assert.deepEqual(modelInfo(sampleGLB()), { rigged: true, clips: ["Float"] });
  assert.deepEqual(modelInfo(sampleGLB(false)), { rigged: false, clips: ["Float"] });
});
```

`tests/unit/server/storage.test.ts`
```ts
import { test, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readLibrary, persist, publicAssetNames, writeAsset, readAsset, uploadDir } from "@otb/server";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
  process.env.DATA_DIR = dir;
});
afterAll(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

test("first read seeds library.json and creates the uploads folder", async () => {
  const { db } = await readLibrary();
  assert.equal(db.version, 1);
  assert.equal(db.draft.books[0].title, "이상한 나라의 앨리스");
  assert.equal(JSON.parse(await readFile(path.join(dir, "library.json"), "utf8")).version, 1);
  await access(uploadDir());
});
test("persist writes through a temp file and rejects a stale snapshot with 409", async () => {
  const snapshot = await readLibrary();
  const next = { ...snapshot.db, version: snapshot.db.version + 1 };
  await persist(next, snapshot);
  assert.equal((await readLibrary()).db.version, 2);
  await assert.rejects(persist({ ...next, version: 3 }, snapshot), (e: any) => e.status === 409);
});
test("changes written by another process are visible on the next read", async () => {
  const current = (await readLibrary()).db;
  await writeFile(path.join(dir, "library.json"), JSON.stringify({ ...current, version: 41 }));
  assert.equal((await readLibrary()).db.version, 41);
});
test("assets round-trip through the uploads folder", async () => {
  await writeAsset("test.png", Buffer.from("png-bytes"));
  assert.equal((await readAsset("test.png")).toString(), "png-bytes");
  await assert.rejects(readAsset("missing.png"), (e: any) => e.code === "ENOENT");
});
test("public asset names include only assets of published books and their models", async () => {
  const { db } = await readLibrary();
  const live = structuredClone(db.live);
  live.books[0].cover = "/uploads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png";
  live.books[1].published = false;
  live.books[1].cover = "/uploads/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png";
  const names = publicAssetNames({ ...db, live });
  assert.ok(names.has("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png"));
  assert.ok(!names.has("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png"));
});
```

Run: `npx vitest run tests/unit/server`
Expected: 네 파일 모두 `Failed to resolve import "@otb/server"` 로 실패.

- [ ] **Step 3: 패키지 메타와 upgrade.ts 를 쓴다**

`packages/server/package.json`
```json
{
  "name": "@otb/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@otb/shared": "*", "@vercel/blob": "^2.8.0" }
}
```

`packages/server/tsconfig.json`
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

`packages/server/src/upgrade.ts`
```ts
type UpgradeChapter = { width?: number; depth?: number; encounter?: unknown; placements: Array<{ x: number; z: number; collectible?: unknown }> };
export type UpgradeLibrary = { books: Array<{ chapters: UpgradeChapter[] }> };

export function upgrade<T extends UpgradeLibrary>(library: T): T {
  const next = structuredClone(library);
  for (const book of next.books)
    for (const chapter of book.chapters) {
      const legacy = chapter.width === undefined;
      chapter.width ??= 64;
      chapter.depth ??= 56;
      delete chapter.encounter;
      for (const p of chapter.placements) {
        if (legacy) {
          p.x *= 3;
          p.z *= 3;
        }
        delete p.collectible;
      }
    }
  return next;
}
```

- [ ] **Step 4: seed.ts 를 기존 seed.js 에서 복사해 네 곳만 고친다**

Run: `cp server/seed.js packages/server/src/seed.ts`

그다음 `packages/server/src/seed.ts` 에서 아래 네 곳을 정확히 바꾼다(다른 내용은 그대로).

1행
```ts
import { upgrade } from "./upgrade.js";
```
→
```ts
import { upgrade } from "./upgrade";
import type { LibraryInput } from "@otb/shared";
```

`p` 헬퍼 시그니처
```ts
const p = (id, modelId, x, z, title, story, animation = "hop", scale = 1) => ({
```
→
```ts
const p = (id: string, modelId: string, x: number, z: number, title: string, story: string, animation = "hop", scale = 1) => ({
```

`export const seed = {` → `const rawSeed = {`

마지막 줄 `Object.assign(seed, upgrade(seed));` → `export const seed = upgrade(rawSeed) as unknown as LibraryInput;`

- [ ] **Step 5: storage.ts 를 쓴다**

`packages/server/src/storage.ts`
```ts
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { get, put, del, issueSignedToken, presignUrl } from "@vercel/blob";
import { librarySchema, type Library } from "@otb/shared";
import { seed } from "./seed";
import { upgrade } from "./upgrade";

export type Db = { version: number; draft: Library; live: Library; publishedAt: string };
export type Snapshot = { db: Db; etag?: string };

export const isCloud = () => process.env.VERCEL === "1";
// next start/dev run with cwd = apps/<app>; the repo-level data folder is two levels up.
export const dataDir = () => process.env.DATA_DIR || path.resolve(process.cwd(), "../../data");
export const uploadDir = () => path.join(dataDir(), "uploads");
const dbFile = () => path.join(dataDir(), "library.json");
const blobKey = (name: string) => (process.env.BLOB_NAMESPACE || "") + name;

export const initialDb = (): Db => ({
  version: 1,
  draft: librarySchema.parse(seed),
  live: librarySchema.parse(seed),
  publishedAt: new Date().toISOString(),
});

async function writeLocal(file: string, db: Db) {
  await writeFile(file + ".tmp", JSON.stringify(db, null, 2));
  await rename(file + ".tmp", file);
}

const prepared = new Map<string, Promise<void>>();
async function prepareLocal(dir: string) {
  await mkdir(path.join(dir, "uploads"), { recursive: true });
  const file = path.join(dir, "library.json");
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(file, JSON.stringify(initialDb(), null, 2));
    return;
  }
  const db = JSON.parse(raw) as Db;
  const previous = JSON.stringify(db, null, 2);
  db.draft = librarySchema.parse(upgrade(db.draft));
  db.live = librarySchema.parse(upgrade(db.live));
  if (previous !== JSON.stringify(db, null, 2)) {
    await writeFile(path.join(dir, `library-before-free-world-${Date.now()}.json`), previous);
    db.version++;
    await writeLocal(file, db);
  }
}
function ensureLocal(): Promise<void> {
  const dir = dataDir();
  let pending = prepared.get(dir);
  if (!pending) {
    pending = prepareLocal(dir);
    prepared.set(dir, pending);
  }
  return pending;
}
async function readLocal(): Promise<Db> {
  await ensureLocal();
  return JSON.parse(await readFile(dbFile(), "utf8")) as Db;
}

export async function readLibrary(): Promise<Snapshot> {
  if (!isCloud()) return { db: await readLocal() };
  const result = await get(blobKey("library.json"), { access: "private", useCache: false, headers: { "Accept-Encoding": "identity" } });
  if (!result) return { db: initialDb() };
  return { db: (await new Response(result.stream).json()) as Db, etag: result.blob.etag.replace(/^W\//, "") };
}

let queue: Promise<unknown> = Promise.resolve();
export function persist(next: Db, snapshot: Snapshot): Promise<unknown> {
  if (isCloud())
    return put(blobKey("library.json"), JSON.stringify(next), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: !!snapshot.etag,
      ...(snapshot.etag ? { ifMatch: snapshot.etag } : {}),
    });
  const operation = queue.then(async () => {
    const current = await readLocal();
    if (current.version !== snapshot.db.version) throw Object.assign(new Error("Save conflict"), { status: 409 });
    await writeLocal(dbFile(), next);
  });
  queue = operation.catch(() => {});
  return operation;
}

export async function readAsset(filename: string, staging = false): Promise<Buffer> {
  if (!isCloud()) return readFile(path.join(uploadDir(), path.basename(filename)));
  const result = await get(blobKey(`${staging ? "staging" : "uploads"}/${path.basename(filename)}`), { access: "private", useCache: false });
  if (!result) throw Object.assign(new Error("Missing asset"), { code: "ENOENT" });
  if (result.blob.size > 25 * 1024 * 1024) throw new Error("File too large");
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

export async function writeAsset(filename: string, buffer: Buffer): Promise<unknown> {
  if (!isCloud()) {
    await ensureLocal();
    return writeFile(path.join(uploadDir(), filename), buffer);
  }
  return put(blobKey(`uploads/${filename}`), buffer, {
    access: "private",
    addRandomSuffix: false,
    contentType: filename.endsWith(".png") ? "image/png" : "model/gltf-binary",
  });
}

export async function signedAsset(pathname: string, operation: "get" | "put" = "get", maximumSizeInBytes?: number): Promise<string> {
  pathname = blobKey(pathname);
  const validUntil = Date.now() + 10 * 60 * 1000;
  const limits = operation === "put" ? { maximumSizeInBytes, allowedContentTypes: [pathname.endsWith(".png") ? "image/png" : "model/gltf-binary"] } : {};
  const token = await issueSignedToken({ pathname, operations: [operation], validUntil, ...limits });
  return (
    await presignUrl(token, {
      operation,
      pathname,
      access: "private",
      validUntil,
      ...limits,
      ...(operation === "put" ? { addRandomSuffix: false, allowOverwrite: false } : {}),
    })
  ).presignedUrl;
}

export async function removeStaging(filename: string): Promise<void> {
  if (isCloud()) await del(blobKey(`staging/${path.basename(filename)}`));
}

const sessions = new Map<string, number>();
const TOKEN = /^[a-f0-9-]{36}$/;
export async function saveSession(token: string, expiry: number): Promise<void> {
  if (!isCloud()) {
    sessions.set(token, expiry);
    return;
  }
  await put(blobKey(`sessions/${token}.json`), JSON.stringify({ expiry }), { access: "private", addRandomSuffix: false });
}
export async function validSession(token?: string): Promise<boolean> {
  if (!TOKEN.test(token || "")) return false;
  if (!isCloud()) return (sessions.get(token!) || 0) > Date.now();
  const result = await get(blobKey(`sessions/${token}.json`), { access: "private", useCache: false });
  return !!result && ((await new Response(result.stream).json()) as { expiry: number }).expiry > Date.now();
}
export async function removeSession(token?: string): Promise<void> {
  if (!TOKEN.test(token || "")) return;
  if (!isCloud()) {
    sessions.delete(token!);
    return;
  }
  await del(blobKey(`sessions/${token}.json`));
}

export function publicAssetNames(db: Db): Set<string> {
  const books = db.live.books.filter((book) => book.published);
  const models = new Set(books.flatMap((book) => book.chapters.flatMap((chapter) => chapter.placements.map((p) => p.modelId))));
  return new Set(
    [
      ...db.live.models.filter((model) => models.has(model.id)).flatMap((model) => [model.url, model.thumbnail]),
      ...books.flatMap((book) => [book.cover, ...(book.floorAssets || []).map((item) => item.asset), ...book.chapters.flatMap((chapter) => (chapter.floorDecals || []).map((item) => item.asset))]),
    ]
      .filter((url): url is string => !!url)
      .map((url) => path.basename(url)),
  );
}
```

`@vercel/blob` 의 `issueSignedToken`, `presignUrl`, `ifMatch`, `allowOverwrite` 옵션 이름은 현재 `server/storage.js` 와 같다. 타입 오류가 나면 `node_modules/@vercel/blob/dist/index.d.ts` 에서 시그니처를 확인하고 인자 형태만 맞춘다. 동작은 바꾸지 않는다.

- [ ] **Step 6: validation.ts 와 index.ts 를 쓴다**

`packages/server/src/validation.ts`
```ts
export const PNG_LIMIT = 5 * 1024 * 1024;
export const GLB_LIMIT = 25 * 1024 * 1024;
export const PNG_TOO_LARGE = "PNG 이미지는 5MB 이하로 올려 주세요.";
export const PNG_INVALID = "올바른 PNG 이미지 파일을 선택해 주세요.";
export const PNG_INCOMPLETE = "가로·세로 4096 이하의 완전한 PNG 이미지가 필요합니다.";
export const GLB_TOO_LARGE = "모델은 25MB 이하로 올려 주세요.";
export const GLB_INVALID = "올바른 GLB 2.0 파일을 선택해 주세요.";
export const GLB_NOT_STANDALONE = "장면과 텍스처가 포함된 독립형 GLB 파일이 필요합니다.";
export const GLB_NOT_RIGGED = "뼈대가 연결되고 뼈대 애니메이션이 포함된 GLB 모델만 등록할 수 있습니다.";

export type Inspection<T> = { ok: true; value: T } | { ok: false; message: string };

type GltfJson = {
  asset?: { version?: string };
  scenes?: unknown[];
  nodes?: Array<{ skin?: number; mesh?: number }>;
  skins?: Array<{ joints?: number[] }>;
  meshes?: Array<{ primitives?: Array<{ attributes?: Record<string, number> }> }>;
  animations?: Array<{ name?: string; channels?: Array<{ sampler?: number; target?: { node?: number; path?: string } }>; samplers?: Array<{ input?: number }> }>;
  accessors?: Array<{ count?: number }>;
  buffers?: Array<{ uri?: string }>;
  images?: Array<{ uri?: string }>;
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function inspectPng(b: Buffer): Inspection<{ width: number; height: number }> {
  if (b.length < 45 || !b.subarray(0, 8).equals(PNG_SIGNATURE) || b.toString("ascii", 12, 16) !== "IHDR" || b.readUInt32BE(8) !== 13)
    return { ok: false, message: PNG_INVALID };
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  let offset = 8;
  let ended = false;
  let hasData = false;
  while (offset + 12 <= b.length) {
    const size = b.readUInt32BE(offset);
    if (size > b.length - offset - 12) break;
    const type = b.toString("ascii", offset + 4, offset + 8);
    offset += size + 12;
    if (type === "IDAT") hasData = true;
    if (type === "IEND") {
      ended = size === 0 && offset === b.length;
      break;
    }
  }
  if (!ended || !hasData || !width || !height || width > 4096 || height > 4096) return { ok: false, message: PNG_INCOMPLETE };
  return { ok: true, value: { width, height } };
}

function gltfJson(buffer: Buffer): GltfJson {
  return JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12))) as GltfJson;
}

export function modelInfo(buffer: Buffer): { rigged: boolean; clips: string[] } {
  const json = gltfJson(buffer);
  const joints = new Set((json.skins || []).flatMap((s) => s.joints || []));
  const skinned = (json.nodes || []).some(
    (n) =>
      Number.isInteger(n.skin) &&
      json.skins?.[n.skin!]?.joints?.length &&
      json.meshes?.[n.mesh!]?.primitives?.some((p) => Number.isInteger(p.attributes?.JOINTS_0) && Number.isInteger(p.attributes?.WEIGHTS_0)),
  );
  const motion = (json.animations || []).some((a) =>
    a.channels?.some(
      (c) =>
        joints.has(c.target?.node as number) &&
        ["translation", "rotation", "scale"].includes(c.target?.path || "") &&
        (json.accessors?.[a.samplers?.[c.sampler!]?.input!]?.count ?? 0) > 1,
    ),
  );
  return { rigged: !!(skinned && motion), clips: (json.animations || []).map((a, i) => a.name || `animation_${i}`) };
}

export function inspectGlb(b: Buffer): Inspection<{ clips: string[]; rigged: true; bytes: number }> {
  if (b.length < 20 || b.toString("ascii", 0, 4) !== "glTF" || b.readUInt32LE(4) !== 2 || b.readUInt32LE(8) !== b.length) return { ok: false, message: GLB_INVALID };
  try {
    const size = b.readUInt32LE(12);
    if (b.readUInt32LE(16) !== 0x4e4f534a || size + 20 > b.length) throw new Error();
    const json = gltfJson(b);
    if (json.asset?.version !== "2.0" || !json.scenes?.length) throw new Error();
    if ([...(json.buffers || []), ...(json.images || [])].some((x) => x.uri && !x.uri.startsWith("data:"))) throw new Error();
  } catch {
    return { ok: false, message: GLB_NOT_STANDALONE };
  }
  const info = modelInfo(b);
  if (!info.rigged) return { ok: false, message: GLB_NOT_RIGGED };
  return { ok: true, value: { clips: info.clips, rigged: true, bytes: b.length } };
}
```

`packages/server/src/index.ts` (이 태스크 범위. Task 4·5 에서 줄을 추가한다)
```ts
export * from "./upgrade";
export * from "./seed";
export * from "./storage";
export * from "./validation";
```

- [ ] **Step 7: 링크·테스트·타입 검사**

Run: `npm install && npx vitest run tests/unit/server && npx tsc -p packages/server`
Expected: `Test Files  4 passed`, `Tests  16 passed`, tsc 출력 없음.

- [ ] **Step 8: 커밋**

```bash
git add packages/server tests/fixtures.ts tests/unit/server package-lock.json
git commit -m "Add @otb/server core: storage, seed, upgrade, and upload validation

Local storage now re-reads library.json on every request and writes via
a temp file so the client and admin processes stay consistent.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 4: @otb/server 핸들러 — 로그인, 라이브러리, 스튜디오 저장

**Files:**
- Create: `packages/server/src/http.ts`, `src/session.ts`, `src/library-rules.ts`
- Create: `packages/server/src/handlers/session.ts`, `handlers/library.ts`, `handlers/studio.ts`, `handlers/not-found.ts`
- Modify: `packages/server/src/index.ts`
- Test: `tests/unit/server/handlers.test.ts`

**Interfaces:**
- Consumes: Task 3 의 storage/validation 전부.
- Produces:
  - `type Handler = (request: Request) => Promise<Response>`
  - `HttpError`, `fail(status, error, headers?)`, `ok(data, init?)`, `guarded(handler)`, `studioOrigin(request)`, `readJson(request, limit?)`, `clientIp(request)`, `requestProtocol(request)`, `requestHost(request)`, 상수 `NOT_FOUND`, `UNPROCESSABLE`, `CONFLICT`
  - `SESSION_COOKIE`, `SESSION_TTL_MS`, `adminPassword()`, `sessionToken(request)`, `sessionCookie(token, secure)`, `clearedSessionCookie()`, `passwordMatches(given)`, `requireAdmin(request)`
  - `validateStudioSave(parsed, db, publish)`, `INCOMPLETE_BOOK`
  - 핸들러 `login`, `logout`, `getLibrary`, `getStudio`, `putStudio`, `notFound`
- 핸들러는 표준 `Request` 만 받는다. Next 의 `NextRequest` 는 `Request` 의 하위 타입이므로 route.ts 에서 그대로 export 할 수 있다.

- [ ] **Step 1: 실패하는 핸들러 테스트를 만든다**

`tests/unit/server/handlers.test.ts` (업로드 케이스는 Task 5 의 `uploads.test.ts` 에 따로 둔다. ESM 은 없는 이름을 import 하면 파일 전체가 실패하기 때문이다.)
```ts
import { test, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLibrary, getStudio, putStudio, login, logout, notFound, seed } from "@otb/server";

let dir: string;
const base = "http://127.0.0.1:4173";
const studio = { "content-type": "application/json", "x-on-the-book": "studio" };
const req = (url: string, init: RequestInit = {}) => new Request(base + url, init);
const jsonReq = (url: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  req(url, { method, headers: { ...studio, ...headers }, body: JSON.stringify(body) });
const state = async () => (await getStudio(req("/api/studio"))).json();

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
  process.env.DATA_DIR = dir;
  delete process.env.ADMIN_PASSWORD;
});
afterAll(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

test("library exposes published books and used models with no-store", async () => {
  const response = await getLibrary(req("/api/library"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.books.length, 2);
  assert.ok(body.models.length > 0);
  assert.ok(body.publishedAt);
});

test("publishing a book with an empty chapter and saving an invalid main are rejected", async () => {
  const s = await state();
  const c = s.library.books[0].chapters[0];
  c.mainPlacementId = "missing-model";
  assert.equal((await putStudio(jsonReq("/api/studio", "PUT", s))).status, 400);
  c.mainPlacementId = null;
  c.placements = [];
  s.publish = true;
  assert.equal((await putStudio(jsonReq("/api/studio", "PUT", s))).status, 400);
});

test("drafts persist on disk while the published snapshot stays unchanged; stale writes fail", async () => {
  const s = await state();
  s.library.books[0].title = "저장 검증 책";
  const res = await putStudio(jsonReq("/api/studio", "PUT", { library: s.library, version: s.version }));
  assert.equal(res.status, 200);
  const disk = JSON.parse(await readFile(path.join(dir, "library.json"), "utf8"));
  assert.equal(disk.draft.books[0].title, "저장 검증 책");
  assert.equal(disk.live.books[0].title, seed.books[0].title);
  assert.equal((await (await getLibrary(req("/api/library"))).json()).books[0].title, seed.books[0].title);
  assert.equal((await putStudio(jsonReq("/api/studio", "PUT", { library: s.library, version: s.version }))).status, 409);
});

test("cross-origin writes, invalid data and unknown endpoints fail clearly", async () => {
  const s = await state();
  assert.equal((await putStudio(jsonReq("/api/studio", "PUT", { library: s.library, version: s.version }, { origin: "https://outside.example" }))).status, 403);
  assert.equal((await putStudio(req("/api/studio", { method: "PUT", body: "{}", headers: { "content-type": "application/json" } }))).status, 403);
  s.library.books[0].chapters[0].placements[0].scale = 0;
  assert.equal((await putStudio(jsonReq("/api/studio", "PUT", { library: s.library, version: s.version }))).status, 400);
  assert.equal((await putStudio(req("/api/studio", { method: "PUT", headers: studio, body: "{not json" }))).status, 400);
  const missing = await notFound(req("/api/missing"));
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "요청을 찾을 수 없습니다." });
});

test("configured administrator password protects reads and writes; login sets and logout clears the cookie", async () => {
  process.env.ADMIN_PASSWORD = "test-only-password";
  try {
    assert.equal((await getStudio(req("/api/studio"))).status, 401);
    assert.equal((await login(jsonReq("/api/login", "POST", { password: "wrong" }))).status, 401);
    const logged = await login(jsonReq("/api/login", "POST", { password: "test-only-password" }));
    assert.equal(logged.status, 200);
    const setCookie = logged.headers.get("set-cookie")!;
    assert.match(setCookie, /^otb_session=[a-f0-9-]{36}; Path=\/; Max-Age=28800; HttpOnly; SameSite=Strict$/);
    const cookie = setCookie.split(";")[0];
    assert.equal((await getStudio(req("/api/studio", { headers: { cookie } }))).status, 200);
    assert.equal((await logout(req("/api/logout", { method: "POST", headers: { ...studio, cookie }, body: "{}" }))).status, 200);
    assert.equal((await getStudio(req("/api/studio", { headers: { cookie } }))).status, 401);
    for (let i = 0; i < 10; i++) await login(jsonReq("/api/login", "POST", { password: "wrong" }, { "x-forwarded-for": "10.0.0.9" }));
    const limited = await login(jsonReq("/api/login", "POST", { password: "test-only-password" }, { "x-forwarded-for": "10.0.0.9" }));
    assert.equal(limited.status, 429);
  } finally {
    delete process.env.ADMIN_PASSWORD;
  }
});
```

Run: `npx vitest run tests/unit/server/handlers.test.ts`
Expected: `Failed to resolve import` 가 아니라 `does not provide an export named 'getLibrary'` 류의 오류로 파일 전체가 실패.

- [ ] **Step 2: http.ts 와 session.ts 를 쓴다**

`packages/server/src/http.ts`
```ts
export type Handler = (request: Request) => Promise<Response>;

export const NOT_FOUND = "요청을 찾을 수 없습니다.";
export const UNPROCESSABLE = "요청을 처리할 수 없습니다.";
export const CONFLICT = "다른 창에서 변경되었습니다. 새로고침 후 다시 저장해 주세요.";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const JSON_TYPE = { "Content-Type": "application/json; charset=utf-8" };
function jsonResponse(data: unknown, status: number, headers?: HeadersInit): Response {
  const merged = new Headers(headers);
  for (const [key, value] of Object.entries(JSON_TYPE)) merged.set(key, value);
  return new Response(JSON.stringify(data), { status, headers: merged });
}
export const fail = (status: number, error: string, headers?: HeadersInit): Response => jsonResponse({ error }, status, headers);
export const ok = (data: unknown, init: { status?: number; headers?: HeadersInit } = {}): Response => jsonResponse(data, init.status ?? 200, init.headers);

export function requestProtocol(request: Request): string {
  return request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || new URL(request.url).protocol.replace(":", "");
}
export function requestHost(request: Request): string {
  return request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
}

/** Express `sameOrigin` 미들웨어 대응. 통과하면 null, 아니면 403 응답. */
export function studioOrigin(request: Request): Response | null {
  if (request.headers.get("x-on-the-book") !== "studio") return fail(403, "관리 화면에서 다시 시도해 주세요.");
  const origin = request.headers.get("origin");
  if (origin && origin !== `${requestProtocol(request)}://${requestHost(request)}`) return fail(403, "허용되지 않은 요청입니다.");
  return null;
}

export const clientIp = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "127.0.0.1";

/** express.json({ limit: '3mb' }) 대응. 실패는 HttpError(400). */
export async function readJson(request: Request, limit = 3 * 1024 * 1024): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new HttpError(400, UNPROCESSABLE);
  const text = await request.text();
  if (Buffer.byteLength(text) > limit) throw new HttpError(400, UNPROCESSABLE);
  try {
    const value: unknown = text ? JSON.parse(text) : {};
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, UNPROCESSABLE);
  }
}

/** Express 의 마지막 오류 핸들러 대응: HttpError 는 그 상태로, 나머지는 400. */
export const guarded =
  (handler: Handler): Handler =>
  async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) return fail(error.status, error.message);
      return fail(400, UNPROCESSABLE);
    }
  };
```

`packages/server/src/session.ts`
```ts
import { timingSafeEqual } from "node:crypto";
import { fail } from "./http";
import { isCloud, validSession } from "./storage";

export const SESSION_COOKIE = "otb_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export const adminPassword = (): string => process.env.ADMIN_PASSWORD || "";

export function sessionToken(request: Request): string | undefined {
  return request.headers.get("cookie")?.match(/(?:^|; )otb_session=([^;]+)/)?.[1];
}
export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}
export const clearedSessionCookie = (): string => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`;

export function passwordMatches(given: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(adminPassword());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Express `auth` 미들웨어 대응. 통과하면 null. */
export async function requireAdmin(request: Request): Promise<Response | null> {
  if (isCloud() && !adminPassword()) return fail(503, "관리자 비밀번호 설정이 필요합니다.");
  if (!adminPassword()) return null;
  if (!(await validSession(sessionToken(request)))) return fail(401, "관리자 로그인이 필요합니다.");
  return null;
}
```

- [ ] **Step 3: library-rules.ts 를 쓴다**

`packages/server/src/library-rules.ts` (기존 `PUT /api/studio` 의 try 블록 검사 순서를 그대로 옮긴다)
```ts
import path from "node:path";
import { newTriggerConflict, type Library } from "@otb/shared";
import { readAsset, type Db } from "./storage";
import { modelInfo } from "./validation";

export const INCOMPLETE_BOOK = "공개할 도서의 저자와 권리 정보를 완성해 주세요.";

/** 저장을 막아야 하면 오류 메시지를, 통과하면 null 을 돌려준다. glb 모델에는 파일 정보를 채워 넣는다(기존 동작). */
export async function validateStudioSave(parsed: Library, db: Db, publish: boolean): Promise<string | null> {
  if (publish)
    for (const b of parsed.books.filter((b) => b.published))
      for (const c of b.chapters) if (!c.mainPlacementId) return `“${b.title} / ${c.title}”에 메인 모델을 배치한 뒤 공개해 주세요.`;
  for (const book of parsed.books)
    if (newTriggerConflict(book, db.draft.books.find((b) => b.id === book.id))) return "모델의 애니메이션 발동 영역이 겹칩니다. 위치나 발동 반경을 조정해 주세요.";
  for (const model of parsed.models) {
    const previous = db.draft.models.find((m) => m.id === model.id);
    if ((!previous || previous.thumbnail) && !model.thumbnail) return "모델 썸네일을 등록해 주세요.";
    if (model.thumbnail) await readAsset(path.basename(model.thumbnail));
  }
  for (const model of parsed.models)
    if (model.kind === "glb") {
      const info = modelInfo(await readAsset(path.basename(model.url!)));
      const existing = db.draft.models.find((m) => m.id === model.id && m.url === model.url);
      if (!info.rigged && !existing) return "뼈대 애니메이션이 있는 모델만 새로 등록할 수 있습니다.";
      Object.assign(model, info);
    } else {
      model.rigged = false;
      model.clips = [];
    }
  const prior = new Map(db.draft.books.flatMap((b) => b.chapters.flatMap((c) => c.placements)).map((p) => [p.id, p.modelId]));
  for (const p of parsed.books.flatMap((b) => b.chapters.flatMap((c) => c.placements))) {
    const model = parsed.models.find((m) => m.id === p.modelId);
    if (prior.get(p.id) !== p.modelId && model?.kind === "glb" && (!model.rigged || p.animation !== "clip" || !model.clips.includes(p.clip)))
      return "새 배치에는 뼈대 모델과 등록된 애니메이션을 선택해 주세요.";
  }
  for (const book of parsed.books) if (book.cover) await readAsset(path.basename(book.cover));
  for (const book of parsed.books) for (const item of book.floorAssets || []) await readAsset(path.basename(item.asset));
  for (const book of parsed.books)
    for (const chapter of book.chapters)
      for (const item of chapter.floorDecals || []) if (item.asset.startsWith("/uploads/")) await readAsset(path.basename(item.asset));
  return null;
}
```

- [ ] **Step 4: 핸들러 네 파일을 쓴다**

`packages/server/src/handlers/session.ts`
```ts
import { randomUUID } from "node:crypto";
import { clientIp, fail, guarded, ok, readJson, requestProtocol, studioOrigin } from "../http";
import { adminPassword, clearedSessionCookie, passwordMatches, sessionCookie, sessionToken, SESSION_TTL_MS } from "../session";
import { isCloud, removeSession, saveSession } from "../storage";

const attempts = new Map<string, { count: number; until: number }>();

export const login = guarded(async (request) => {
  const rejected = studioOrigin(request);
  if (rejected) return rejected;
  if (isCloud() && !adminPassword()) return fail(503, "관리자 비밀번호 설정이 필요합니다.");
  const now = Date.now();
  const ip = clientIp(request);
  const entry = attempts.get(ip) || { count: 0, until: now + 60000 };
  if (entry.until < now) {
    entry.count = 0;
    entry.until = now + 60000;
  }
  entry.count++;
  attempts.set(ip, entry);
  if (entry.count > 10) return fail(429, "잠시 후 다시 시도해 주세요.");
  const body = await readJson(request);
  if (adminPassword() && !passwordMatches(String(body.password || ""))) return fail(401, "비밀번호가 일치하지 않습니다.");
  const token = randomUUID();
  await saveSession(token, now + SESSION_TTL_MS);
  return ok({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token, requestProtocol(request) === "https") } });
});

export const logout = guarded(async (request) => {
  const rejected = studioOrigin(request);
  if (rejected) return rejected;
  await removeSession(sessionToken(request));
  return ok({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
});
```

`packages/server/src/handlers/library.ts`
```ts
import { guarded, ok } from "../http";
import { readLibrary } from "../storage";

export const NO_STORE = { "Cache-Control": "no-store" };

export const getLibrary = guarded(async () => {
  const { db } = await readLibrary();
  const books = db.live.books.filter((b) => b.published);
  const used = new Set(books.flatMap((b) => b.chapters.flatMap((c) => c.placements.map((p) => p.modelId))));
  return ok({ books, models: db.live.models.filter((m) => used.has(m.id)), publishedAt: db.publishedAt }, { headers: NO_STORE });
});
```

`packages/server/src/handlers/studio.ts`
```ts
import { BlobPreconditionFailedError } from "@vercel/blob";
import { librarySchema } from "@otb/shared";
import { CONFLICT, fail, guarded, ok, readJson, studioOrigin } from "../http";
import { INCOMPLETE_BOOK, validateStudioSave } from "../library-rules";
import { adminPassword, requireAdmin } from "../session";
import { persist, readLibrary, type Db } from "../storage";
import { NO_STORE } from "./library";

export const getStudio = guarded(async (request) => {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { db } = await readLibrary();
  return ok({ library: db.draft, version: db.version, publishedAt: db.publishedAt, protected: !!adminPassword() }, { headers: NO_STORE });
});

let saving = false;
export const putStudio = guarded(async (request) => {
  const rejected = studioOrigin(request);
  if (rejected) return rejected;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await readJson(request);
  const snapshot = await readLibrary();
  const { db } = snapshot;
  if (saving || body.version !== db.version) return fail(409, CONFLICT);
  const parsed = librarySchema.safeParse(body.library);
  if (!parsed.success) return fail(400, parsed.error.issues.map((i) => i.message).join(" "));
  const publish = !!body.publish;
  if (publish && parsed.data.books.some((b) => b.published && (!b.author.trim() || !b.rights.trim()))) return fail(400, INCOMPLETE_BOOK);
  saving = true;
  try {
    const problem = await validateStudioSave(parsed.data, db, publish);
    if (problem) return fail(400, problem);
    const next: Db = { ...db, draft: parsed.data, version: db.version + 1 };
    if (publish) {
      next.live = structuredClone(parsed.data);
      next.publishedAt = new Date().toISOString();
    }
    await persist(next, snapshot);
    return ok({ version: next.version, publishedAt: next.publishedAt });
  } catch (e) {
    const error = e as { status?: number; code?: string };
    if (e instanceof BlobPreconditionFailedError || error.status === 409) return fail(409, CONFLICT);
    return fail(500, error.code === "ENOENT" ? "등록한 모델 파일을 찾을 수 없습니다." : "저장하지 못했습니다. 다시 시도해 주세요.");
  } finally {
    saving = false;
  }
});
```

`packages/server/src/handlers/not-found.ts`
```ts
import { fail, NOT_FOUND } from "../http";

export const notFound = async (): Promise<Response> => fail(404, NOT_FOUND);
```

`packages/server/src/index.ts` 에 추가
```ts
export * from "./http";
export * from "./session";
export * from "./library-rules";
export * from "./handlers/session";
export * from "./handlers/library";
export * from "./handlers/studio";
export * from "./handlers/not-found";
```

- [ ] **Step 5: 테스트와 타입 검사**

Run: `npx vitest run tests/unit/server/handlers.test.ts`
Expected: `Tests  5 passed`.

Run: `npx tsc -p packages/server`
Expected: 출력 없음.

- [ ] **Step 6: 커밋**

```bash
git add packages/server tests/unit/server/handlers.test.ts
git commit -m "Add Request/Response handlers for login, library, and studio saves

Ports the Express middleware chain (same-origin header, session cookie,
rate limiting, version conflicts) to framework-agnostic handlers.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: @otb/server 업로드 핸들러와 업로드 파일 서빙

**Files:**
- Create: `packages/server/src/handlers/uploads.ts`, `handlers/uploaded-file.ts`
- Modify: `packages/server/src/index.ts`
- Test: `tests/unit/server/uploads.test.ts`

**Interfaces:**
- Produces: 핸들러 `uploadsPrepare`, `floorUpload`, `modelsUpload`, 팩토리 `uploadedFile({ allowSession }): (request, filename) => Promise<Response>`.

- [ ] **Step 1: 실패하는 테스트를 만든다**

`tests/unit/server/uploads.test.ts`
```ts
import { test, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getLibrary, getStudio, putStudio, floorUpload, modelsUpload, uploadsPrepare, uploadedFile } from "@otb/server";
import { sampleGLB, tinyPng } from "../../fixtures";

let dir: string;
const base = "http://127.0.0.1:4173";
const studio = { "content-type": "application/json", "x-on-the-book": "studio" };
const req = (url: string, init: RequestInit = {}) => new Request(base + url, init);
const jsonReq = (url: string, method: string, body: unknown) => req(url, { method, headers: studio, body: JSON.stringify(body) });
const multipart = (url: string, field: string, bytes: Buffer | string, name: string, type?: string) => {
  const form = new FormData();
  form.append(field, new Blob([bytes], type ? { type } : undefined), name);
  return req(url, { method: "POST", headers: { "x-on-the-book": "studio" }, body: form });
};

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
  process.env.DATA_DIR = dir;
  delete process.env.ADMIN_PASSWORD;
});
afterAll(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

test("PNG upload is validated, stored and served; bad files are rejected", async () => {
  const uploaded = await floorUpload(multipart("/api/floor/upload", "image", tinyPng(), "thumb.png", "image/png"));
  assert.equal(uploaded.status, 201);
  const { url, width, height } = await uploaded.json();
  assert.match(url, /^\/uploads\/[a-f0-9-]{36}\.png$/);
  assert.deepEqual([width, height], [1, 1]);
  const served = await uploadedFile({ allowSession: false })(req(url), url.slice("/uploads/".length));
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/png");
  assert.equal(served.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal((await uploadedFile({ allowSession: false })(req("/uploads/nope.png"), "nope.png")).status, 404);
  const rejected = await floorUpload(multipart("/api/floor/upload", "image", "not a png", "bad.png"));
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { error: "올바른 PNG 이미지 파일을 선택해 주세요." });
  const missingField = await floorUpload(multipart("/api/floor/upload", "other", "x", "x.png"));
  assert.equal(missingField.status, 400);
});

test("publishing applies changes and excludes private books and unused assets", async () => {
  const { url: thumbnail } = await (await floorUpload(multipart("/api/floor/upload", "image", tinyPng(), "thumb.png", "image/png"))).json();
  const s = await (await getStudio(req("/api/studio"))).json();
  s.library.books[0].title = "저장 검증 책";
  s.library.books[1].published = false;
  s.library.models.push({ thumbnail, id: "unused-test-model", name: "비공개 모델", kind: "tree", color: "#123456", credit: "Test" });
  assert.equal((await putStudio(jsonReq("/api/studio", "PUT", { library: s.library, version: s.version, publish: true }))).status, 200);
  const live = await (await getLibrary(req("/api/library"))).json();
  assert.equal(live.books.length, 1);
  assert.equal(live.books[0].title, "저장 검증 책");
  assert.ok(!live.models.some((m: { id: string }) => m.id === "unused-test-model"));
  const withoutThumbnail = await (await getStudio(req("/api/studio"))).json();
  withoutThumbnail.library.models.push({ id: "no-thumb", name: "썸네일 없음", kind: "tree", color: "#123456", credit: "Test" });
  const rejected = await putStudio(jsonReq("/api/studio", "PUT", { library: withoutThumbnail.library, version: withoutThumbnail.version }));
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { error: "모델 썸네일을 등록해 주세요." });
});

test("valid animated GLB is saved and malformed upload is rejected; prepare is cloud-only", async () => {
  const r = await modelsUpload(multipart("/api/models/upload", "model", sampleGLB(), "test.glb"));
  assert.equal(r.status, 201);
  const asset = await r.json();
  assert.deepEqual(asset.clips, ["Float"]);
  assert.equal(asset.rigged, true);
  const served = await uploadedFile({ allowSession: true })(req(asset.url), asset.url.slice("/uploads/".length));
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "model/gltf-binary");
  const bad = await modelsUpload(multipart("/api/models/upload", "model", "not a model", "invalid.glb"));
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: "올바른 GLB 2.0 파일을 선택해 주세요." });
  const unrigged = await modelsUpload(multipart("/api/models/upload", "model", sampleGLB(false), "flat.glb"));
  assert.equal(unrigged.status, 400);
  assert.deepEqual(await unrigged.json(), { error: "뼈대가 연결되고 뼈대 애니메이션이 포함된 GLB 모델만 등록할 수 있습니다." });
  assert.equal((await uploadsPrepare(jsonReq("/api/uploads/prepare", "POST", { kind: "image", size: 10 }))).status, 404);
  assert.equal((await modelsUpload(req("/api/models/upload", { method: "POST", body: "{}", headers: studio }))).status, 400);
});
```

Run: `npx vitest run tests/unit/server/uploads.test.ts`
Expected: `does not provide an export named 'floorUpload'` 로 파일 실패.

- [ ] **Step 2: uploads.ts 를 쓴다**

`packages/server/src/handlers/uploads.ts`
```ts
import { randomUUID } from "node:crypto";
import { fail, guarded, HttpError, NOT_FOUND, ok, readJson, studioOrigin } from "../http";
import { requireAdmin } from "../session";
import { isCloud, readAsset, removeStaging, signedAsset, writeAsset } from "../storage";
import { GLB_INVALID, GLB_LIMIT, GLB_NOT_STANDALONE, GLB_TOO_LARGE, inspectGlb, inspectPng, PNG_INVALID, PNG_LIMIT, PNG_TOO_LARGE } from "../validation";

type Kind = "image" | "model";
const limits: Record<Kind, number> = { image: PNG_LIMIT, model: GLB_LIMIT };
const stagedName: Record<Kind, RegExp> = { image: /^[a-f0-9-]{36}\.png$/, model: /^[a-f0-9-]{36}\.glb$/ };

/** cloud: staging 에 직접 올린 파일명을 검증해 읽는다. local: multipart 필드를 읽는다. */
async function uploadSource(request: Request, kind: Kind): Promise<Buffer | Response> {
  if (isCloud()) {
    const body = await readJson(request);
    const filename = String(body.filename || "");
    if (!stagedName[kind].test(filename)) return fail(400, "업로드한 파일을 찾을 수 없습니다.");
    const buffer = await readAsset(filename, true);
    if (buffer.length > limits[kind]) return fail(400, "파일 크기가 제한을 초과했습니다.");
    await removeStaging(filename);
    return buffer;
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, kind === "image" ? PNG_INVALID : GLB_INVALID);
  }
  const file = form.get(kind);
  if (!(file instanceof File)) return fail(400, kind === "image" ? PNG_INVALID : GLB_INVALID);
  if (file.size > limits[kind]) return kind === "image" ? fail(400, PNG_TOO_LARGE) : fail(413, GLB_TOO_LARGE);
  return Buffer.from(await file.arrayBuffer());
}

export const uploadsPrepare = guarded(async (request) => {
  if (!isCloud()) return fail(404, NOT_FOUND);
  const rejected = studioOrigin(request);
  if (rejected) return rejected;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = await readJson(request);
  const image = body.kind === "image";
  if (!image && body.kind !== "model") return fail(400, "파일 종류를 확인해 주세요.");
  const limit = image ? PNG_LIMIT : GLB_LIMIT;
  const size = body.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > limit) return fail(400, image ? PNG_TOO_LARGE : GLB_TOO_LARGE);
  const filename = randomUUID() + (image ? ".png" : ".glb");
  return ok({ filename, url: await signedAsset(`staging/${filename}`, "put", limit) });
});

export const floorUpload = guarded(async (request) => {
  const rejected = studioOrigin(request);
  if (rejected) return rejected;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const source = await uploadSource(request, "image");
  if (source instanceof Response) return source;
  const png = inspectPng(source);
  if (!png.ok) return fail(400, png.message);
  const filename = randomUUID() + ".png";
  try {
    await writeAsset(filename, source);
    return ok({ url: "/uploads/" + filename, width: png.value.width, height: png.value.height }, { status: 201 });
  } catch {
    return fail(500, "이미지를 저장하지 못했습니다.");
  }
});

export const modelsUpload = guarded(async (request) => {
  const rejected = studioOrigin(request);
  if (rejected) return rejected;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const source = await uploadSource(request, "model");
  if (source instanceof Response) return source;
  const glb = inspectGlb(source);
  if (!glb.ok) return fail(400, glb.message);
  const filename = randomUUID() + ".glb";
  try {
    await writeAsset(filename, source);
    return ok({ url: "/uploads/" + filename, clips: glb.value.clips, rigged: true, bytes: glb.value.bytes }, { status: 201 });
  } catch {
    return fail(400, GLB_NOT_STANDALONE);
  }
});
```

- [ ] **Step 3: uploaded-file.ts 를 쓴다**

`packages/server/src/handlers/uploaded-file.ts`
```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sessionToken } from "../session";
import { isCloud, publicAssetNames, readLibrary, signedAsset, uploadDir, validSession } from "../storage";

const NAME = /^[a-f0-9-]{36}\.(png|glb)$/;

/**
 * GET /uploads/:filename.
 * cloud: 공개 자산이거나(allowSession 일 때) 관리자 세션이 있으면 서명 URL 로 307.
 * local: DATA_DIR/uploads 의 파일을 그대로 보낸다(기존 express.static 과 같이 공개 여부를 검사하지 않음).
 */
export function uploadedFile(options: { allowSession: boolean }) {
  return async (request: Request, filename: string): Promise<Response> => {
    if (!NAME.test(filename)) return new Response(null, { status: 404 });
    if (isCloud()) {
      const { db } = await readLibrary();
      const allowed = publicAssetNames(db).has(filename) || (options.allowSession && (await validSession(sessionToken(request))));
      if (!allowed) return new Response(null, { status: 404 });
      return new Response(null, { status: 307, headers: { Location: await signedAsset(`uploads/${filename}`), "Cache-Control": "private, no-store" } });
    }
    try {
      const body = await readFile(path.join(uploadDir(), filename));
      const bytes = new Uint8Array(body.buffer as ArrayBuffer, body.byteOffset, body.byteLength);
      return new Response(bytes, {
        headers: {
          "Content-Type": filename.endsWith(".png") ? "image/png" : "model/gltf-binary",
          "Content-Length": String(body.byteLength),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  };
}
```

`packages/server/src/index.ts` 에 추가
```ts
export * from "./handlers/uploads";
export * from "./handlers/uploaded-file";
```

- [ ] **Step 4: 전체 단위 테스트와 타입 검사**

Run: `npx vitest run tests/unit && npx tsc -p packages/server`
Expected: `Test Files  11 passed`, 모든 테스트 통과, tsc 출력 없음.

- [ ] **Step 5: 커밋**

```bash
git add packages/server tests/unit/server/uploads.test.ts
git commit -m "Add upload handlers and uploaded-file serving without multer

Local mode reads multipart fields with request.formData(); cloud mode
keeps the signed staging upload flow.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 6: @otb/ui — api 클라이언트, 로고, 토스트, 전역 CSS, 공용 자산

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`
- Create: `packages/ui/src/api.ts`, `src/Logo.tsx`, `src/toast.ts`, `src/Toaster.tsx`, `src/index.ts`
- Create: `packages/ui/styles/base.css`, `admin.css`, `workspace.css`, `transitions.css` (기존 CSS 복사)
- Create: `packages/ui/public/**` (기존 `public/` 복사), `scripts/sync-public.mjs`
- Test: `tests/unit/ui/api.test.ts`, `tests/unit/ui/toast.test.tsx`, `tests/unit/scripts/sync-public.test.ts`

**Interfaces:**
- Produces:
  - `api<T>(url, options?)`: 기존 `shared/ui.js` 의 `api` 와 같은 동작. 실패 시 `ApiError { status }`.
  - `ApiError`, `isCloud()`(`NEXT_PUBLIC_VERCEL_ENV` 존재 여부)
  - `Logo` 컴포넌트, `toast(message)`, `subscribeToast(listener)`, `Toaster` 컴포넌트, `TOAST_DURATION_MS`
  - CSS: `@otb/ui/styles/base.css`, `admin.css`, `workspace.css`, `transitions.css`. 폰트는 CSS 변수 `--font-dm-sans`, `--font-noto-sans-kr`, `--font-noto-serif-kr` 를 참조하며 값은 앱의 next/font 가 채운다.
  - `node scripts/sync-public.mjs [대상경로...]`: 기본 대상 `apps/client/public`, `apps/admin/public`.

- [ ] **Step 1: 실패하는 테스트를 만든다**

`tests/unit/ui/api.test.ts`
```ts
import { test, expect, vi, afterEach } from "vitest";
import { api, ApiError } from "@otb/ui";

const calls: Array<{ url: string; init?: RequestInit }> = [];
function mockFetch(responder: (url: string, init?: RequestInit) => Response) {
  calls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return responder(url, init);
  }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
});

test("json requests carry the studio header and content type", async () => {
  mockFetch(() => Response.json({ ok: true }));
  expect(await api("/api/logout", { method: "POST", body: "{}" })).toEqual({ ok: true });
  const headers = calls[0].init?.headers as Record<string, string>;
  expect(headers["X-On-The-Book"]).toBe("studio");
  expect(headers["Content-Type"]).toBe("application/json");
});
test("multipart bodies pass through locally without a content type", async () => {
  mockFetch(() => Response.json({ url: "/uploads/x.png" }, { status: 201 }));
  const body = new FormData();
  body.append("image", new Blob(["png"]), "a.png");
  await api("/api/floor/upload", { method: "POST", body });
  expect(calls).toHaveLength(1);
  expect((calls[0].init?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
});
test("in the cloud a multipart upload becomes prepare, signed PUT, and a filename registration", async () => {
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  mockFetch((url, init) => {
    if (url === "/api/uploads/prepare") return Response.json({ filename: "abc.png", url: "https://blob.example/put" });
    if (url === "https://blob.example/put") return new Response(null, { status: 200 });
    return Response.json({ url: "/uploads/abc.png", body: init?.body }, { status: 201 });
  });
  const body = new FormData();
  body.append("image", new Blob(["png"], { type: "image/png" }), "a.png");
  const result = await api<{ url: string }>("/api/floor/upload", { method: "POST", body });
  expect(result.url).toBe("/uploads/abc.png");
  expect(calls.map((c) => c.url)).toEqual(["/api/uploads/prepare", "https://blob.example/put", "/api/floor/upload"]);
  expect(calls[2].init?.body).toBe(JSON.stringify({ filename: "abc.png" }));
});
test("server errors surface their message and status; network failures use the connection message", async () => {
  mockFetch(() => Response.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 }));
  await expect(api("/api/studio")).rejects.toMatchObject({ message: "관리자 로그인이 필요합니다.", status: 401 });
  mockFetch(() => {
    throw new TypeError("fetch failed");
  });
  const error = await api("/api/studio").catch((e: ApiError) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.message).toBe("서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.");
});
```

`tests/unit/ui/toast.test.tsx`
```tsx
import { test, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Logo, Toaster, subscribeToast, toast } from "@otb/ui";

test("toast delivers messages to subscribers until they unsubscribe", () => {
  const received: string[] = [];
  const stop = subscribeToast((m) => received.push(m));
  toast("저장했어요.");
  stop();
  toast("무시됨");
  expect(received).toEqual(["저장했어요."]);
});
test("Toaster renders the status region and Logo renders the brand markup", () => {
  expect(renderToStaticMarkup(<Toaster />)).toBe('<div id="toast" role="status"></div>');
  const logo = renderToStaticMarkup(<Logo />);
  expect(logo).toContain('<span class="brand-mark"><img src="/brand/book-path.svg" alt="" width="44" height="30"/></span>');
  expect(logo).toContain('<span class="wordmark">on the book<span class="brand-dot">.</span></span>');
});
```

`tests/unit/scripts/sync-public.test.ts`
```ts
import { test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("sync-public copies the shared public folder into a target and replaces stale files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
  const target = path.join(dir, "public");
  try {
    execFileSync(process.execPath, ["scripts/sync-public.mjs", target]);
    await stat(path.join(target, "floor-assets/arrow.svg"));
    await stat(path.join(target, "brand/book-path.svg"));
    expect((await readFile(path.join(target, "favicon.svg"), "utf8")).length).toBeGreaterThan(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

Run: `npx vitest run tests/unit/ui tests/unit/scripts`
Expected: 세 파일 실패(`@otb/ui` 해석 실패, 스크립트 없음).

- [ ] **Step 2: 패키지 메타를 만든다**

`packages/ui/package.json`
```json
{
  "name": "@otb/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles/*": "./styles/*"
  },
  "dependencies": { "@otb/shared": "*" },
  "peerDependencies": { "react": "^19.2.0", "react-dom": "^19.2.0" }
}
```

`packages/ui/tsconfig.json`
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 3: api.ts, toast.ts, Toaster.tsx, Logo.tsx, index.ts 를 쓴다**

`packages/ui/src/api.ts`
```ts
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Vercel 이 빌드 시 자동 노출하는 NEXT_PUBLIC_VERCEL_ENV 가 있으면 cloud 배포다. */
export const isCloud = (): boolean => !!process.env.NEXT_PUBLIC_VERCEL_ENV;

export async function api<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  if (isCloud() && options.body instanceof FormData) {
    const image = url === "/api/floor/upload";
    const file = options.body.get(image ? "image" : "model");
    if (!(file instanceof File)) throw new ApiError("파일을 선택해 주세요.", 0);
    const prepared = await api<{ url: string; filename: string }>("/api/uploads/prepare", {
      method: "POST",
      body: JSON.stringify({ kind: image ? "image" : "model", size: file.size }),
    });
    const upload = await fetch(prepared.url, { method: "PUT", headers: { "Content-Type": image ? "image/png" : "model/gltf-binary" }, body: file });
    if (!upload.ok) throw new ApiError("파일을 업로드하지 못했습니다. 다시 시도해 주세요.", upload.status);
    options = { ...options, body: JSON.stringify({ filename: prepared.filename }) };
  }
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "X-On-The-Book": "studio",
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...((options.headers as Record<string, string> | undefined) ?? {}),
      },
    });
  } catch {
    throw new ApiError("서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.", 0);
  }
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(result.error || "요청하지 못했습니다.", response.status);
  return result;
}
```

`packages/ui/src/toast.ts`
```ts
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function toast(message: string): void {
  for (const listener of listeners) listener(message);
}
export function subscribeToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

`packages/ui/src/Toaster.tsx`
```tsx
"use client";
import { useEffect, useState } from "react";
import { subscribeToast } from "./toast";

export const TOAST_DURATION_MS = 4200;

export function Toaster() {
  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = subscribeToast((next) => {
      setMessage(next);
      setShow(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShow(false), TOAST_DURATION_MS);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, []);
  return (
    <div id="toast" role="status" className={show ? "show" : undefined}>
      {message}
    </div>
  );
}
```

`packages/ui/src/Logo.tsx`
```tsx
export function Logo() {
  return (
    <>
      <span className="brand-mark">
        <img src="/brand/book-path.svg" alt="" width={44} height={30} />
      </span>
      <span className="wordmark">
        on the book<span className="brand-dot">.</span>
      </span>
    </>
  );
}
```

`packages/ui/src/index.ts`
```ts
export * from "./api";
export * from "./toast";
export * from "./Toaster";
export * from "./Logo";
```

- [ ] **Step 4: CSS 를 복사하고 폰트 참조를 변수로 바꾼다**

Run:
```bash
mkdir -p packages/ui/styles
sed -e '1d' -e 's/"DM Sans"/var(--font-dm-sans)/g' -e 's/"Noto Sans KR"/var(--font-noto-sans-kr)/g' -e 's/"Noto Serif KR"/var(--font-noto-serif-kr)/g' shared/style.css > packages/ui/styles/base.css
sed -e 's/"Noto Serif KR"/var(--font-noto-serif-kr)/g' admin/style.css > packages/ui/styles/admin.css
cp admin/workspace.css packages/ui/styles/workspace.css
cp client/transitions.css packages/ui/styles/transitions.css
grep -c "fonts.googleapis" packages/ui/styles/base.css; grep -c "Noto Serif KR" packages/ui/styles/base.css packages/ui/styles/admin.css
```
Expected: 첫 grep `0`, 둘째 grep 두 파일 모두 `0`. `base.css` 3행은 `font-family: var(--font-dm-sans), var(--font-noto-sans-kr), sans-serif;` 다.

- [ ] **Step 5: 공용 정적 자산과 복사 스크립트를 만든다**

Run: `mkdir -p packages/ui/public && cp -r public/. packages/ui/public/ && find packages/ui/public -type f | wc -l`
Expected: `14`

`scripts/sync-public.mjs`
```js
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "packages/ui/public");
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ["apps/client/public", "apps/admin/public"];

for (const target of targets) {
  const dest = path.resolve(root, target);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(source, dest, { recursive: true });
  console.log(`synced packages/ui/public -> ${path.relative(root, dest)}`);
}
```

- [ ] **Step 6: 테스트와 타입 검사**

Run: `npm install && npx vitest run tests/unit && npx tsc -p packages/ui`
Expected: 모든 단위 테스트 통과(`Test Files  14 passed`), tsc 출력 없음.

- [ ] **Step 7: 커밋**

```bash
git add packages/ui scripts/sync-public.mjs tests/unit/ui tests/unit/scripts package-lock.json
git commit -m "Add @otb/ui with the api client, toast, logo, global CSS, and shared assets

CSS is copied from the legacy files with Google Fonts replaced by
next/font CSS variables. sync-public.mjs copies shared static assets
into each app's public folder before dev and build.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 7: apps/admin — Next 앱, Route Handler, 로그인·로딩 화면

**Files:**
- Create: `apps/admin/package.json`, `tsconfig.json`, `next.config.ts`, `vercel.json`
- Create: `apps/admin/app/layout.tsx`, `app/fonts.ts`, `app/admin/page.tsx`
- Create: `apps/admin/components/StudioBoot.tsx`, `components/LoginScreen.tsx`
- Create: `apps/admin/app/api/login/route.ts`, `api/logout/route.ts`, `api/library/route.ts`, `api/studio/route.ts`, `api/uploads/prepare/route.ts`, `api/floor/upload/route.ts`, `api/models/upload/route.ts`, `api/[[...missing]]/route.ts`, `app/uploads/[filename]/route.ts`

**Interfaces:**
- Consumes: `@otb/server` 핸들러 전부, `@otb/ui` 의 `api`, `ApiError`, `Logo`, `Toaster`, CSS.
- Produces: `/admin`(로그인·로딩·플레이스홀더), `/`→`/admin` 리다이렉트, `/api/*`, `/uploads/:filename`. 검증은 Task 9 블랙박스 테스트와 Task 10 스모크가 담당한다. 이 태스크의 완료 기준은 `next build` 와 `tsc` 통과다.

- [ ] **Step 1: 앱 메타 파일을 만든다**

`apps/admin/package.json`
```json
{
  "name": "on-the-book-admin",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "predev": "node ../../scripts/sync-public.mjs",
    "dev": "next dev -p 3001 -H 127.0.0.1",
    "prebuild": "node ../../scripts/sync-public.mjs",
    "build": "next build",
    "start": "next start -p 3001 -H 127.0.0.1",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "dependencies": {
    "@otb/server": "*",
    "@otb/shared": "*",
    "@otb/ui": "*",
    "lucide-react": "^1.44.0",
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  }
}
```

`apps/admin/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "allowJs": true,
    "incremental": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

`apps/admin/next.config.ts`
```ts
import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@otb/shared", "@otb/server", "@otb/ui"],
  async redirects() {
    return [{ source: "/", destination: "/admin", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
```

`apps/admin/vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "git": { "deploymentEnabled": { "main": false } }
}
```

- [ ] **Step 2: Route Handler 파일 아홉 개를 만든다**

`apps/admin/app/api/login/route.ts`
```ts
import { login } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = login;
```

`apps/admin/app/api/logout/route.ts`
```ts
import { logout } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = logout;
```

`apps/admin/app/api/library/route.ts`
```ts
import { getLibrary } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getLibrary;
```

`apps/admin/app/api/studio/route.ts`
```ts
import { getStudio, putStudio } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getStudio;
export const PUT = putStudio;
```

`apps/admin/app/api/uploads/prepare/route.ts`
```ts
import { uploadsPrepare } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = uploadsPrepare;
```

`apps/admin/app/api/floor/upload/route.ts`
```ts
import { floorUpload } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = floorUpload;
```

`apps/admin/app/api/models/upload/route.ts`
```ts
import { modelsUpload } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const POST = modelsUpload;
```

`apps/admin/app/api/[[...missing]]/route.ts` (Express 의 `/api` 404 JSON 대응)
```ts
import { notFound } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
```

`apps/admin/app/uploads/[filename]/route.ts`
```ts
import { uploadedFile } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const serve = uploadedFile({ allowSession: true });

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  return serve(request, (await params).filename);
}
```

- [ ] **Step 3: 레이아웃, 폰트, 페이지를 만든다**

`apps/admin/app/fonts.ts`
```ts
import { DM_Sans, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm-sans", display: "swap" });
const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto-sans-kr", display: "swap", preload: false });
const notoSerifKr = Noto_Serif_KR({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-noto-serif-kr", display: "swap", preload: false });

export const fontClassName = `${dmSans.variable} ${notoSansKr.variable} ${notoSerifKr.variable}`;
```

`apps/admin/app/layout.tsx`
```tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@otb/ui";
import "@otb/ui/styles/base.css";
import "@otb/ui/styles/admin.css";
import "@otb/ui/styles/workspace.css";
import { fontClassName } from "./fonts";

export const metadata: Metadata = {
  title: "On the Book — 스튜디오",
  icons: {
    icon: [
      { url: "/brand/book-path-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/book-path-favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/book-path-180.png",
  },
};
export const viewport: Viewport = { themeColor: "#f4f3e9", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={fontClassName}>
      <body>
        <div id="app">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
```

`apps/admin/app/admin/page.tsx`
```tsx
import { StudioBoot } from "../../components/StudioBoot";

export default function AdminPage() {
  return <StudioBoot />;
}
```

`apps/admin/components/LoginScreen.tsx` (기존 `load()` 의 401 분기 마크업 이식)
```tsx
"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { api, Logo } from "@otb/ui";

export const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || "http://localhost:3000/";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") || "");
    try {
      await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
      onLoggedIn();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="login-screen">
      <a className="brand" href={clientUrl}>
        <Logo />
      </a>
      <h1>이야기를 만드는 공간</h1>
      <p>관리자 비밀번호로 스튜디오를 열어 주세요.</p>
      <form id="login-form" onSubmit={submit}>
        <label className="field">
          관리자 비밀번호
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <p id="login-error" role="alert">
          {error}
        </p>
        <button className="primary-button full">
          스튜디오 들어가기 <ArrowRight aria-hidden="true" />
        </button>
      </form>
    </main>
  );
}
```

`apps/admin/components/StudioBoot.tsx`
```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import type { Library } from "@otb/shared";
import { api, ApiError } from "@otb/ui";
import { LoginScreen } from "./LoginScreen";

type Studio = { library: Library; version: number; publishedAt: string; protected: boolean };
type State = { phase: "loading" } | { phase: "login" } | { phase: "error"; message: string } | { phase: "ready"; studio: Studio };

export function StudioBoot() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", studio: await api<Studio>("/api/studio") });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setState({ phase: "login" });
      else setState({ phase: "error", message: (error as Error).message });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading")
    return (
      <main className="loading-screen" aria-busy="true">
        <h1>스튜디오를 불러오는 중…</h1>
      </main>
    );
  if (state.phase === "login") return <LoginScreen onLoggedIn={load} />;
  if (state.phase === "error")
    return (
      <main className="loading-screen">
        <h1>스튜디오를 불러오지 못했어요.</h1>
        <p>{state.message}</p>
        <button id="retry" className="primary-button" onClick={load}>
          다시 시도
        </button>
      </main>
    );
  const { library } = state.studio;
  return (
    <main className="loading-screen" data-phase="ready">
      <h1>스튜디오를 준비하고 있어요.</h1>
      <p>
        도서 {library.books.length}권과 모델 {library.models.length}개를 불러왔습니다. 관리자 화면은 다음 단계에서 이어집니다.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: 설치, 빌드, 타입 검사**

Run: `npm install && npm run build -w apps/admin`
(next/font 가 빌드 중 Google Fonts 를 내려받으므로 네트워크가 필요하다. 오프라인이면 폰트 다운로드 오류로 빌드가 실패한다.)
Expected: `✓ Compiled successfully` 와 라우트 목록에 `/admin`, `/api/login`, `/api/logout`, `/api/library`, `/api/studio`, `/api/uploads/prepare`, `/api/floor/upload`, `/api/models/upload`, `/api/[[...missing]]`, `/uploads/[filename]` 가 보인다. 빌드 전 `synced packages/ui/public -> apps/admin/public` 로그가 찍힌다.

Run: `npm run typecheck -w apps/admin`
Expected: 오류 없음. Next 가 `tsconfig.json` 을 수정했다는 안내가 나오면 그 수정을 그대로 받아들인다(`jsx` 값 변경 포함).

Run: `git status --short apps/admin | grep -E "public|next-env|\.next" ; echo "exit $?"`
Expected: 아무 줄도 없고 `exit 1`(복사본과 빌드 산출물이 gitignore 됨).

- [ ] **Step 5: 수동 스모크**

Run (백그라운드): `npm run start -w apps/admin`
Run:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:3001/
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/admin
curl -s http://127.0.0.1:3001/api/library | head -c 80; echo
curl -s -i http://127.0.0.1:3001/api/missing | head -1
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://127.0.0.1:3001/floor-assets/arrow.svg
```
Expected: `307 http://127.0.0.1:3001/admin`, `200`, `{"books":[{"id":"alice",...` 로 시작, `HTTP/1.1 404 Not Found`, `200 image/svg+xml`. 확인 후 서버를 중지한다.

- [ ] **Step 6: 커밋**

```bash
git add apps/admin package-lock.json
git commit -m "Add the admin Next.js app with Route Handler API and login screen

Routes re-export @otb/server handlers; the /admin page shows loading,
login, and a placeholder until the studio shell lands in phase 3.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: apps/client — Next 앱, 공개 API, 로딩 화면

**Files:**
- Create: `apps/client/package.json`, `tsconfig.json`, `next.config.ts`, `vercel.json`
- Create: `apps/client/app/layout.tsx`, `app/fonts.ts`, `app/page.tsx`, `components/ReaderBoot.tsx`
- Create: `apps/client/app/api/library/route.ts`, `app/api/[[...missing]]/route.ts`, `app/uploads/[filename]/route.ts`

**Interfaces:**
- Produces: `/`(로딩·빈 책장·플레이스홀더), `/client` 과 `/client/*` 는 `/` 로 rewrite, `GET /api/library`, 공개 자산 전용 `GET /uploads/:filename`, 그 외 `/api/*` 는 404 JSON. 관리자 API 는 존재하지 않는다.

- [ ] **Step 1: 앱 메타 파일을 만든다**

`apps/client/package.json`
```json
{
  "name": "on-the-book-client",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "predev": "node ../../scripts/sync-public.mjs",
    "dev": "next dev -p 3000 -H 127.0.0.1",
    "prebuild": "node ../../scripts/sync-public.mjs",
    "build": "next build",
    "start": "next start -p 3000 -H 127.0.0.1",
    "typecheck": "next typegen && tsc --noEmit"
  },
  "dependencies": {
    "@otb/server": "*",
    "@otb/shared": "*",
    "@otb/ui": "*",
    "next": "16.3.4",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  }
}
```

`apps/client/tsconfig.json`: Task 7 의 `apps/admin/tsconfig.json` 과 같은 내용.
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "allowJs": true,
    "incremental": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

`apps/client/next.config.ts`
```ts
import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@otb/shared", "@otb/server", "@otb/ui"],
  async rewrites() {
    return [
      { source: "/client", destination: "/" },
      { source: "/client/:path*", destination: "/:path*" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
```

`apps/client/vercel.json`
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "git": { "deploymentEnabled": { "main": false } }
}
```

- [ ] **Step 2: Route Handler 세 개를 만든다**

`apps/client/app/api/library/route.ts`
```ts
import { getLibrary } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = getLibrary;
```

`apps/client/app/api/[[...missing]]/route.ts`
```ts
import { notFound } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
```

`apps/client/app/uploads/[filename]/route.ts`
```ts
import { uploadedFile } from "@otb/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const serve = uploadedFile({ allowSession: false });

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  return serve(request, (await params).filename);
}
```

- [ ] **Step 3: 레이아웃, 폰트, 페이지를 만든다**

`apps/client/app/fonts.ts`: Task 7 의 `apps/admin/app/fonts.ts` 와 같은 내용.
```ts
import { DM_Sans, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm-sans", display: "swap" });
const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto-sans-kr", display: "swap", preload: false });
const notoSerifKr = Noto_Serif_KR({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-noto-serif-kr", display: "swap", preload: false });

export const fontClassName = `${dmSans.variable} ${notoSansKr.variable} ${notoSerifKr.variable}`;
```

`apps/client/app/layout.tsx`
```tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@otb/ui";
import "@otb/ui/styles/base.css";
import "@otb/ui/styles/transitions.css";
import { fontClassName } from "./fonts";

export const metadata: Metadata = {
  title: "On the Book — 책 속을 걷는 시간",
  icons: {
    icon: [
      { url: "/brand/book-path-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/book-path-favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/book-path-180.png",
  },
};
export const viewport: Viewport = { themeColor: "#f4f3e9", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={fontClassName}>
      <body>
        <div id="app">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
```

`apps/client/app/page.tsx`
```tsx
import { ReaderBoot } from "../components/ReaderBoot";

export default function HomePage() {
  return <ReaderBoot />;
}
```

`apps/client/components/ReaderBoot.tsx` (기존 `init()` 의 로딩 커튼·빈 책장·오류 분기 이식)
```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import type { Book, Model } from "@otb/shared";
import { api, Logo } from "@otb/ui";

type LibraryResponse = { books: Book[]; models: Model[]; publishedAt: string };
type State = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; library: LibraryResponse };

export function ReaderBoot() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      setState({ phase: "ready", library: await api<LibraryResponse>("/api/library") });
    } catch (error) {
      setState({ phase: "error", message: (error as Error).message });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading")
    return (
      <div className="reader-curtain" role="status">
        <span className="brand" aria-hidden="true">
          <Logo />
        </span>
        <p>책 속의 작은 세계를 펼치는 중이에요…</p>
        <span className="reader-loading-line" aria-hidden="true" />
      </div>
    );
  if (state.phase === "error")
    return (
      <div className="loading-screen">
        <h1>책장을 불러오지 못했어요.</h1>
        <p>{state.message}</p>
        <button className="primary-button" id="retry" onClick={load}>
          다시 시도
        </button>
      </div>
    );
  if (!state.library.books.length)
    return (
      <div className="loading-screen">
        <h1>새로운 이야기를 준비하고 있어요.</h1>
        <p>관리자가 책을 공개하면 이곳에 나타나요.</p>
      </div>
    );
  return (
    <main className="loading-screen" data-phase="ready">
      <h1>책장을 펼치는 중이에요.</h1>
      <p>{state.library.books.map((b) => b.title).join(", ")} · 독서 화면은 다음 단계에서 이어집니다.</p>
    </main>
  );
}
```

- [ ] **Step 4: 설치, 빌드, 타입 검사, 수동 스모크**

Run: `npm install && npm run build -w apps/client && npm run typecheck -w apps/client`
Expected: 라우트 목록에 `/`, `/api/library`, `/api/[[...missing]]`, `/uploads/[filename]` 만 보인다. `/api/studio` 가 없어야 한다. tsc 오류 없음.

Run (백그라운드): `npm run start -w apps/client`
Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "%{http_code}\n" -L "http://127.0.0.1:3000/client/?book=alice"
curl -s -i http://127.0.0.1:3000/api/studio | head -1
curl -s http://127.0.0.1:3000/api/studio
```
Expected: `200`, `200`, `HTTP/1.1 404 Not Found`, `{"error":"요청을 찾을 수 없습니다."}`. 확인 후 서버를 중지한다.

- [ ] **Step 5: 커밋**

```bash
git add apps/client package-lock.json
git commit -m "Add the client Next.js app exposing only the public library API

/client and /client/* rewrite to / so existing reader links keep working.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
### Task 9: 빌드된 앱에 대한 API 블랙박스 테스트

**Files:**
- Create: `tests/api/harness.ts`, `tests/api/admin.test.ts`, `tests/api/client.test.ts`

**Interfaces:**
- Produces: `startApp(app: 'admin' | 'client', port, { dataDir?, password? })` → `{ url, dir, stop() }`. `next start` 를 직접 띄우고 `/api/library` 가 200 을 돌려줄 때까지 기다린다. Windows 에서는 `taskkill /T` 로 프로세스 트리를 끝낸다.
- `npm run test:api` 는 두 앱을 빌드한 뒤 `tests/api` 만 순차 실행한다(포트 고정).

- [ ] **Step 1: 하네스를 만든다**

`tests/api/harness.ts`
```ts
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nextBin = path.join(root, "node_modules/next/dist/bin/next");

export type App = { url: string; dir: string; stop(): Promise<void> };

export async function startApp(app: "admin" | "client", port: number, options: { dataDir?: string; password?: string } = {}): Promise<App> {
  const ownsDir = !options.dataDir;
  const dir = options.dataDir ?? (await mkdtemp(path.join(tmpdir(), "on-the-book-test-")));
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: path.join(root, "apps", app),
    env: { ...process.env, DATA_DIR: dir, ADMIN_PASSWORD: options.password ?? "" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let logs = "";
  child.stdout?.on("data", (d) => (logs += d));
  child.stderr?.on("data", (d) => (logs += d));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 300 && child.exitCode === null; i++) {
    try {
      if ((await fetch(url + "/api/library")).ok) return { url, dir, stop: () => stop(child, dir, ownsDir) };
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  await stop(child, dir, ownsDir);
  throw new Error(logs || `${app} app did not start on port ${port}`);
}

async function stop(child: ChildProcess, dir: string, removeDir: boolean) {
  if (child.exitCode === null) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    else child.kill();
    await new Promise<void>((resolve) => (child.exitCode !== null ? resolve() : child.once("exit", () => resolve())));
  }
  if (!removeDir) return;
  if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith("on-the-book-test-")) throw new Error("Unsafe test cleanup path");
  await rm(dir, { recursive: true, force: true });
}
```

- [ ] **Step 2: 관리자 앱 테스트를 쓴다(기존 tests/server.test.js 이식)**

`tests/api/admin.test.ts`
```ts
import { test, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { seed } from "@otb/server";
import { sampleGLB, tinyPng } from "../fixtures";
import { startApp, type App } from "./harness";

let server: App;
beforeAll(async () => {
  server = await startApp("admin", 4401);
});
afterAll(async () => server?.stop());

const request = (url: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) =>
  fetch(server.url + url, {
    method,
    headers: { "Content-Type": "application/json", "X-On-The-Book": "studio", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

test("admin page and redirect from the root respond", async () => {
  const home = await fetch(server.url + "/", { redirect: "manual" });
  assert.equal(home.status, 307);
  assert.equal(new URL(home.headers.get("location")!, server.url).pathname, "/admin");
  const page = await fetch(server.url + "/admin/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="app"/);
  assert.equal((await fetch(server.url + "/floor-assets/arrow.svg")).status, 200);
});

test("publishing a book with an empty chapter and saving an invalid main are rejected", async () => {
  const state = await (await request("/api/studio")).json();
  const c = state.library.books[0].chapters[0];
  c.mainPlacementId = "missing-model";
  assert.equal((await request("/api/studio", "PUT", state)).status, 400);
  c.mainPlacementId = null;
  c.placements = [];
  state.publish = true;
  assert.equal((await request("/api/studio", "PUT", state)).status, 400);
});

test("drafts persist on disk while published snapshot stays unchanged; stale writes fail", async () => {
  const state = await (await request("/api/studio")).json();
  state.library.books[0].title = "저장 검증 책";
  const res = await request("/api/studio", "PUT", { library: state.library, version: state.version });
  assert.equal(res.status, 200);
  const disk = JSON.parse(await readFile(path.join(server.dir, "library.json"), "utf8"));
  assert.equal(disk.draft.books[0].title, "저장 검증 책");
  assert.equal(disk.live.books[0].title, seed.books[0].title);
  assert.equal((await (await request("/api/library")).json()).books[0].title, seed.books[0].title);
  assert.equal((await request("/api/studio", "PUT", { library: state.library, version: state.version })).status, 409);
});

test("publishing applies changes and excludes private books and unused assets", async () => {
  const fd = new FormData();
  fd.append("image", new Blob([tinyPng()], { type: "image/png" }), "thumb.png");
  const uploaded = await fetch(server.url + "/api/floor/upload", { method: "POST", headers: { "X-On-The-Book": "studio" }, body: fd });
  assert.equal(uploaded.status, 201);
  const { url: thumbnail } = await uploaded.json();
  const state = await (await request("/api/studio")).json();
  state.library.books[1].published = false;
  state.library.models.push({ thumbnail, id: "unused-test-model", name: "비공개 모델", kind: "tree", color: "#123456", credit: "Test" });
  assert.equal((await request("/api/studio", "PUT", { library: state.library, version: state.version, publish: true })).status, 200);
  const live = await (await request("/api/library")).json();
  assert.equal(live.books.length, 1);
  assert.equal(live.books[0].title, "저장 검증 책");
  assert.ok(!live.models.some((m: { id: string }) => m.id === "unused-test-model"));
});

test("cross-origin writes, invalid data and unknown endpoints fail clearly", async () => {
  const state = await (await request("/api/studio")).json();
  assert.equal((await request("/api/studio", "PUT", { library: state.library, version: state.version }, { origin: "https://outside.example" })).status, 403);
  state.library.books[0].chapters[0].placements[0].scale = 0;
  assert.equal((await request("/api/studio", "PUT", { library: state.library, version: state.version })).status, 400);
  const missing = await request("/api/missing");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "요청을 찾을 수 없습니다." });
  assert.equal((await request("/api/uploads/prepare", "POST", { kind: "image", size: 10 })).status, 404);
});

test("valid animated GLB is saved and malformed upload is rejected", async () => {
  const f = new FormData();
  f.append("model", new Blob([sampleGLB()]), "test.glb");
  const r = await fetch(server.url + "/api/models/upload", { method: "POST", headers: { "X-On-The-Book": "studio" }, body: f });
  assert.equal(r.status, 201);
  const asset = await r.json();
  assert.deepEqual(asset.clips, ["Float"]);
  const served = await fetch(server.url + asset.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "model/gltf-binary");
  const bad = new FormData();
  bad.append("model", new Blob(["not a model"]), "invalid.glb");
  assert.equal((await fetch(server.url + "/api/models/upload", { method: "POST", headers: { "X-On-The-Book": "studio" }, body: bad })).status, 400);
});

test("configured administrator password protects reads/writes and session logout", async () => {
  const s = await startApp("admin", 4402, { password: "test-only-password" });
  try {
    assert.equal((await fetch(s.url + "/api/studio")).status, 401);
    const login = await fetch(s.url + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-On-The-Book": "studio" },
      body: JSON.stringify({ password: "test-only-password" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await fetch(s.url + "/api/studio", { headers: { cookie } })).status, 200);
    await fetch(s.url + "/api/logout", { method: "POST", headers: { cookie, "X-On-The-Book": "studio" } });
    assert.equal((await fetch(s.url + "/api/studio", { headers: { cookie } })).status, 401);
  } finally {
    await s.stop();
  }
});
```

- [ ] **Step 3: 사용자 앱 테스트를 쓴다**

`tests/api/client.test.ts`
```ts
import { test, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startApp, type App } from "./harness";

let dir: string;
let admin: App;
let client: App;
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
  admin = await startApp("admin", 4404, { dataDir: dir });
  client = await startApp("client", 4403, { dataDir: dir });
});
afterAll(async () => {
  await client?.stop();
  await admin?.stop();
  await rm(dir, { recursive: true, force: true });
});

test("client pages respond at / and /client/ with the original query string", async () => {
  assert.equal((await fetch(client.url + "/")).status, 200);
  const legacy = await fetch(client.url + "/client/?book=alice");
  assert.equal(legacy.status, 200);
  assert.match(await legacy.text(), /id="app"/);
});

test("client exposes the public library only; admin endpoints do not exist", async () => {
  const library = await fetch(client.url + "/api/library");
  assert.equal(library.status, 200);
  assert.equal(library.headers.get("cache-control"), "no-store");
  assert.equal((await library.json()).books.length, 2);
  for (const [url, method] of [["/api/studio", "GET"], ["/api/login", "POST"], ["/api/models/upload", "POST"], ["/api/floor/upload", "POST"]] as const) {
    const res = await fetch(client.url + url, { method, headers: { "Content-Type": "application/json", "X-On-The-Book": "studio" }, body: method === "POST" ? "{}" : undefined });
    assert.equal(res.status, 404, url);
    assert.deepEqual(await res.json(), { error: "요청을 찾을 수 없습니다." });
  }
  assert.equal((await fetch(client.url + "/uploads/not-a-real-file.png")).status, 404);
});

test("a publish from the admin process is visible to the client process on the next read", async () => {
  const headers = { "Content-Type": "application/json", "X-On-The-Book": "studio" };
  const state = await (await fetch(admin.url + "/api/studio", { headers })).json();
  state.library.books[0].title = "두 프로세스 검증";
  const saved = await fetch(admin.url + "/api/studio", { method: "PUT", headers, body: JSON.stringify({ library: state.library, version: state.version, publish: true }) });
  assert.equal(saved.status, 200);
  const live = await (await fetch(client.url + "/api/library")).json();
  assert.equal(live.books[0].title, "두 프로세스 검증");
});
```

- [ ] **Step 4: 실행**

Run: `npm run test:api`
Expected: 두 앱 빌드 후 `Test Files  2 passed`, `Tests  10 passed`. 실패하면 하네스가 던진 `next start` 로그를 먼저 읽는다.

- [ ] **Step 5: 커밋**

```bash
git add tests/api
git commit -m "Add black-box API tests against the built Next.js apps

Ports tests/server.test.js to Vitest running next start with a temp
DATA_DIR, and checks that the client app hides admin endpoints while
seeing publishes from the admin process.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Playwright 스모크와 1단계 마무리

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/phase1-smoke.spec.ts`
- Verify: 루트 스크립트 전부

**Interfaces:**
- Produces: `npm run test:e2e` 가 `tests/e2e/*.spec.ts` 를 Edge 채널로 실행한다. 이후 단계의 e2e 이관은 이 설정 위에 spec 을 추가한다.

- [ ] **Step 1: Playwright 설정을 만든다**

`playwright.config.ts`
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { channel: "msedge", headless: true, viewport: { width: 1600, height: 1000 } },
});
```

- [ ] **Step 2: 스모크 spec 을 쓴다**

`tests/e2e/phase1-smoke.spec.ts` (빌드가 되어 있어야 한다: `npm run build`)
```ts
import { test, expect } from "@playwright/test";
import { startApp, type App } from "../api/harness";

test.describe("phase 1 smoke", () => {
  test("admin without a password loads straight into the studio placeholder", async ({ page }) => {
    const app: App = await startApp("admin", 4411);
    try {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(app.url + "/admin/");
      await expect(page.locator('main[data-phase="ready"]')).toContainText("도서 2권");
      expect(errors).toEqual([]);
    } finally {
      await app.stop();
    }
  });

  test("admin with a password shows the login screen, rejects a wrong password, then enters", async ({ page }) => {
    const app: App = await startApp("admin", 4412, { password: "test-only-password" });
    try {
      await page.goto(app.url + "/admin/");
      await expect(page.locator("#login-form")).toBeVisible();
      await expect(page.locator(".login-screen h1")).toHaveText("이야기를 만드는 공간");
      await page.getByLabel("관리자 비밀번호").fill("wrong");
      await page.getByRole("button", { name: "스튜디오 들어가기" }).click();
      await expect(page.locator("#login-error")).toHaveText("비밀번호가 일치하지 않습니다.");
      await page.getByLabel("관리자 비밀번호").fill("test-only-password");
      await page.getByRole("button", { name: "스튜디오 들어가기" }).click();
      await expect(page.locator('main[data-phase="ready"]')).toBeVisible();
      await page.screenshot({ path: "docs/screenshots/phase1-admin-login.png" });
    } finally {
      await app.stop();
    }
  });

  test("client shows the loading curtain then the placeholder with published titles", async ({ page }) => {
    const app: App = await startApp("client", 4413);
    try {
      await page.goto(app.url + "/client/");
      await expect(page.locator('main[data-phase="ready"]')).toContainText("이상한 나라의 앨리스");
      expect((await page.request.get(app.url + "/floor-assets/arrow.svg")).status()).toBe(200);
      await page.screenshot({ path: "docs/screenshots/phase1-client-placeholder.png" });
    } finally {
      await app.stop();
    }
  });
});
```

- [ ] **Step 3: 전체 검증 순서로 실행한다**

Run (순서대로):
```bash
npm run typecheck
npm test
npm run test:api
npm run test:e2e
npm run legacy:test
```
Expected: 모두 통과. `legacy:test` 는 `ℹ pass 24`.

Run: `npm run dev`
Expected: 두 앱이 함께 뜨고 `http://127.0.0.1:3000/` 과 `http://127.0.0.1:3001/admin` 이 응답한다. 확인 후 Ctrl+C 로 둘 다 종료되는지 본다(`concurrently -k`).

- [ ] **Step 4: 저장소 상태 점검**

Run: `git status --short`
Expected: `playwright.config.ts`, `tests/e2e/`, `docs/screenshots/phase1-*.png` 만 새 파일이다. `.next/`, `apps/*/public/`, `next-env.d.ts`, `test-results/` 는 보이지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add playwright.config.ts tests/e2e docs/screenshots/phase1-admin-login.png docs/screenshots/phase1-client-placeholder.png
git commit -m "Add Playwright smoke tests for the phase 1 login and loading screens

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## 1단계 완료 기준 점검표

스펙 16절 1단계 기준과 대응한다.

- `npm run typecheck` 통과 (tsc: 패키지 3개, 앱 2개)
- `npm run build` 로 두 앱 빌드 성공
- `npm run test:api` 에서 기존 `tests/server.test.js` 의 모든 케이스가 새 관리자 앱을 상대로 통과하고, 사용자 앱에 관리자 API 가 없음이 확인됨
- `npm run test:e2e` 스모크로 로그인 화면·로딩 화면·플레이스홀더가 실제 브라우저에서 표시됨
- `npm run legacy:test` 가 여전히 통과(구 소스 무손상)
- 배포 파일: `apps/*/vercel.json` 존재. Vercel 프로젝트의 Root Directory 를 `apps/client`, `apps/admin` 으로 바꾸는 작업은 7단계 문서 갱신과 함께 수동으로 한다.

## 다음 단계로 넘기는 것

- `Modal` 컴포넌트(3단계), ESLint 설정(7단계), README·DEPLOYMENT 갱신(7단계).
- `@otb/shared` 에서 제외한 `floorArt`, `terrain`, `sideReadingPose`, `revealReading` 은 2단계 `@otb/scene` 에서 R3F 컴포넌트와 함께 만든다.
