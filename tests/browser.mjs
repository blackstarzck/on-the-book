import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { startServer, sampleGLB } from "./helpers.js";
const server = await startServer();
const browser = await chromium.launch({
  headless: true,
  channel: "msedge",
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
context.setDefaultTimeout(15000);
const page = await context.newPage();
const errors = [];
context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
await mkdir("docs/screenshots", { recursive: true });
const pass = (s) => {
  results.push(s);
  console.log("PASS " + s);
};
await context.route("**/assets/client-*.js", async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace(/([\w$]+)\.setActive\(([\w$]+)\)/, (match, name) => match + ',(window.__testWorld=' + name + ')');
  await route.fulfill({ response, body });
});
try {
  await page.goto(server.url + "/client/?book=alice&chapter=alice-1");
  await page.waitForFunction(() => window.__testWorld?.player);
  await expect(page.locator("#collection-button, #story-action, #story-hint, #discovery")).toHaveCount(0);
  expect(await page.evaluate(() => window.__testWorld.zones[0].width)).toBe(64);
  const point = await page.evaluate(() => { const w = window.__testWorld; const p = w.player.position.clone().set(-9, 0, 0).project(w.camera), r = w.renderer.domElement.getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2 }; });
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.__testWorld.objects.find(o => o.p.id === "a1-rabbit").near);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__testWorld.objects.find(o => o.p.id === "a1-rabbit").group.position.y)).toBeGreaterThan(.32);
  await page.screenshot({ path: "docs/screenshots/free-world-desktop.png" });
  await page.evaluate(() => window.__testWorld.moveTo(-16, 0));
  await page.waitForFunction(() => !window.__testWorld.objects.find(o => o.p.id === "a1-rabbit").near);
  expect(await page.evaluate(() => window.__testWorld.objects.find(o => o.p.id === "a1-rabbit").group.position.y)).toBe(.32);
  await page.evaluate(() => window.__testWorld.moveTo(-9, 0));
  await page.waitForFunction(() => window.__testWorld.objects.find(o => o.p.id === "a1-rabbit").near);
  pass("Ground click moves traveller; proximity starts, exits reset, re-entry replays");
  const canvas = await page.locator("canvas").elementHandle();
  await page.locator("canvas").focus(); await page.keyboard.down("ArrowRight");
  await page.waitForFunction(() => window.__testWorld.index === 1, { timeout: 20000 }); await page.keyboard.up("ArrowRight");
  await expect(page.locator("#map-button")).toContainText("작아지는 문");
  expect(await canvas.evaluate(el => el.isConnected)).toBe(true);
  await page.evaluate(() => window.__testWorld.moveTo(window.__testWorld.player.position.x, 20));
  await page.waitForFunction(() => window.__testWorld.player.position.z > 18);
  pass("Unconditional continuous chapter travel and wide depth movement");
  await page.locator("#map-button").click(); await page.locator('[data-chapter="5"]').click();
  await expect(page.locator("#next-chapter")).toBeDisabled();
  await page.evaluate(() => window.__testWorld.moveTo(window.__testWorld.zones.at(-1).end - 1, 0));
  await expect(page.locator("#story-action, #collection-button")).toHaveCount(0);
  pass("Last chapter stays freely explorable with no completion flow");
  // The studio opens on its bookshelf. A book opens in the world editor, where a model is picked from the outline and
  // edited in the property form; number fields apply when they lose focus.
  const admin = await context.newPage();
  await admin.goto(server.url + "/admin/");
  await admin.locator('[data-open-book="alice"]').click();
  await expect(admin.locator("#studio-world canvas")).toBeVisible();
  await admin.screenshot({
    path: "docs/screenshots/admin-desktop.png",
    fullPage: true,
  });
  const field = (label) => admin.locator("#object-form").getByLabel(label, { exact: true });
  const setField = async (label, value) => { await field(label).fill(value); await field(label).press("Tab"); };
  await admin.locator("[data-select-model]").first().click();
  await setField("장면 속 이름", "검증용 토끼");
  await setField("X", "-3");
  // A select's label also holds its option text, so the motion select is found by its name.
  await admin.locator('#object-form [name="animation"]').selectOption("spin");
  await admin.locator("#play-clip").click();
  await admin.locator("#save").click();
  await expect(admin.locator("#save-state")).toHaveText("변경사항 저장됨");
  let live = await (
    await context.request.get(server.url + "/api/library")
  ).json();
  expect(live.books[0].chapters[0].placements[0].title).toBe(
    "조끼 입은 흰 토끼",
  );
  await admin.reload();
  await expect(field("장면 속 이름")).toHaveValue("검증용 토끼");
  await expect(field("X")).toHaveValue("-3");
  await admin.locator("#publish").click();
  await expect(admin.locator("#save-state")).toHaveText("공개 완료");
  live = await (await context.request.get(server.url + "/api/library")).json();
  expect(live.books[0].chapters[0].placements[0].title).toBe("검증용 토끼");
  pass(
    "Draft persists through reload; publish separately updates public content",
  );
  await admin.locator("[data-chapter-edit]").first().click();
  await expect(admin.getByLabel("공간 가로 크기")).toHaveValue("64");
  await admin.getByLabel("공간 가로 크기").fill("90");
  await admin.getByLabel("공간 세로 크기").fill("80");
  await admin.getByRole("button", { name: "변경 적용", exact: true }).click();
  await admin.locator("[data-select-model]").first().click();
  await setField("X", "35");
  await setField("발동 반경 (m)", "8");
  await admin.locator("#save").click();
  await expect(admin.locator("#save-state")).toHaveText("변경사항 저장됨");
  expect((await (await context.request.get(server.url + "/api/library")).json()).books[0].chapters[0].width).toBe(64);
  await admin.reload(); await expect(field("X")).toHaveValue("35");
  await admin.locator("#publish").click(); await expect(admin.locator("#save-state")).toHaveText("공개 완료");
  expect((await (await context.request.get(server.url + "/api/library")).json()).books[0].chapters[0].width).toBe(90);
  pass("Wide-world size, placement and radius persist and publish independently");
  // Everything is saved, so the editor closes without asking; the model library is a tab of the studio.
  await admin.locator("#back-library").click();
  await admin
    .getByRole("button", { name: "3D 모델 보관함", exact: true })
    .click();
  await expect(admin.locator(".model-card")).toHaveCount(9);
  await admin.screenshot({
    path: "docs/screenshots/admin-models.png",
    fullPage: true,
  });
  await admin.locator("#new-model").click();
  await admin.getByLabel("모델 이름", { exact: true }).fill("테스트 GLB");
  await admin
    .getByLabel("제작자 및 사용 권한")
    .fill("On the Book integration test");
  await admin
    .locator("input[name=file]")
    .setInputFiles({
      name: "test.glb",
      mimeType: "model/gltf-binary",
      buffer: sampleGLB(),
    });
  await expect(admin.locator("#upload-status")).toContainText("동작 1개", {
    timeout: 10000,
  });
  await admin.locator('[name="thumbnail"]').setInputFiles({name:'thumb.png',mimeType:'image/png',buffer:await admin.screenshot()});
  await expect(admin.locator('#thumbnail-status')).toContainText('업로드 완료');
  await admin.locator("#model-submit").click();
  await expect(admin.locator(".model-card")).toHaveCount(10);
  await admin.locator("#model-search").fill("테스트 GLB");
  await expect(admin.locator(".model-card")).toHaveCount(1);
  await admin.getByRole("button", { name: "미리보기", exact: true }).click();
  await expect(admin.locator("#single-preview canvas")).toBeVisible();
  await admin.keyboard.press("Escape");
  pass("GLB upload with animation, registration, search and 3D preview work");
  // A model is placed by dragging its tile from the editor's library into the world.
  await admin.getByRole("button", { name: "도서 보관함", exact: true }).click();
  await admin.locator('[data-open-book="alice"]').click();
  await expect(admin.locator("#studio-world canvas")).toBeVisible();
  await admin.locator(".asset-tile").filter({ hasText: "테스트 GLB" }).locator("img").dragTo(admin.locator("#studio-world canvas"), { targetPosition: { x: 720, y: 680 } });
  await expect(field("장면 속 이름")).toHaveValue("테스트 GLB");
  // A dropped model lands where the pointer meets the ground, which moves with the editor's camera, so it is set on a
  // clear spot beside the moved rabbit that the reader can walk up to.
  await setField("X", "26");
  await setField("Z", "8");
  await admin.locator("#publish").click();
  await expect(admin.locator("#save-state")).toHaveText("공개 완료");
  await page.goto(server.url + "/client/?book=alice&chapter=alice-1");
  await page.waitForFunction(() => window.__testWorld?.objects.some(o => o.p.title === "테스트 GLB" && o.action));
  // The traveller walks only once it has landed.
  await page.waitForFunction(() => window.__testWorld.arrivalTime === null);
  await page.evaluate(() => { const w = window.__testWorld, o = w.objects.find(o => o.p.title === "테스트 GLB"); w.moveTo(o.p.x, o.p.z + .8); });
  await page.waitForFunction(() => window.__testWorld.objects.some(o => o.p.title === "테스트 GLB" && o.near && !o.action.paused));
  pass("Published uploaded GLB plays its clip on approach");
  // The placed model is still selected; deleting it frees the model, which the library can then delete.
  await admin.locator("#delete-object").click();
  await expect(admin.locator("[data-select-model]")).toHaveCount(3);
  await admin.locator("#save").click();
  await expect(admin.locator("#save-state")).toHaveText("변경사항 저장됨");
  await admin.locator("#back-library").click();
  await admin
    .getByRole("button", { name: "3D 모델 보관함", exact: true })
    .click();
  await admin
    .getByRole("button", { name: "테스트 GLB 편집", exact: true })
    .click();
  await admin.locator("#delete-model").click();
  await admin.locator("#confirm-action").click();
  await expect(admin.locator(".model-card").filter({ hasText: "테스트 GLB" })).toHaveCount(0);
  await admin.locator("#save").click();
  await expect(admin.locator("#save-state")).toHaveText("변경사항 저장됨");
  pass("Placement and unused model removal work");
  await admin.getByRole("button", { name: "도서 보관함", exact: true }).click();
  await admin.locator("#new-book").click();
  await admin.getByLabel("책 제목", { exact: true }).fill("새 책 테스트");
  await admin.getByLabel("작가", { exact: true }).fill("테스트 작가");
  await admin.getByRole("button", { name: "책 만들기", exact: true }).click();
  await admin.getByRole("button", { name: "새 책 테스트 3D 월드 편집", exact: true }).click();
  await expect(admin.locator(".world-topbar strong")).toHaveText("새 책 테스트");
  await admin.locator(".world-chapter-tabs #add-chapter").click();
  await admin.getByLabel("챕터 제목", { exact: true }).fill("두 번째 장");
  await admin.getByLabel("이야기 본문").fill("새로운 이야기 본문");
  await admin.getByRole("button", { name: "변경 적용", exact: true }).click();
  await expect(admin.locator("[data-chapter-row]")).toHaveCount(2);
  // The chapter form moves its chapter up the list; that applies the form and closes it.
  await admin.locator("[data-chapter-edit]").nth(1).click();
  await admin.locator("#chapter-up").click();
  await expect(admin.locator("#chapter-form")).toHaveCount(0);
  await expect(admin.locator("[data-chapter-row]").first()).toContainText(
    "두 번째 장",
  );
  await admin.locator("#save").click();
  await expect(admin.locator("#save-state")).toHaveText("변경사항 저장됨");
  pass("Book creation, chapter creation, story editing and reordering work");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(server.url + "/client/?book=alice&chapter=alice-1"); await page.waitForFunction(() => window.__testWorld?.player);
  // The entry curtain covers the pad until it lifts, and the traveller moves only once it has landed.
  await expect(page.locator(".reader-curtain")).toHaveCount(0);
  await page.waitForFunction(() => window.__testWorld.arrivalTime === null);
  await expect(page.locator(".touch-pad")).toBeVisible();
  const before = await page.evaluate(() => window.__testWorld.player.position.x);
  const pad = await page.locator('[data-dir="right"]').boundingBox();
  await page.mouse.move(pad.x + 20, pad.y + 20); await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
  expect(await page.evaluate(() => window.__testWorld.player.position.x)).toBeGreaterThan(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "docs/screenshots/free-world-mobile.png" });
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.reload(); await page.waitForFunction(() => window.__testWorld?.player);
  await page.evaluate(() => { const w = window.__testWorld; w.moveTo(w.objects[0].p.x, w.objects[0].p.z); });
  await page.waitForFunction(() => window.__testWorld.objects[0].near);
  expect(await page.evaluate(() => window.__testWorld.objects[0].group.position.y)).toBe(.32);
  pass("Mobile direction pad, layout and reduced-motion support");
  expect(errors).toEqual([]); pass("No uncaught browser errors");
  await writeFile("docs/browser-results.json", JSON.stringify({ results }, null, 2));
} finally { await context.close(); await browser.close(); await server.stop(); }
