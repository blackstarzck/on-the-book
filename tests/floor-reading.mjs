import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startServer } from "./helpers.js";
const server = await startServer(4283);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
context.setDefaultTimeout(20000);
await context.route("**/assets/client-*.js", async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace(/(\w+)\.setActive\((\w+)\)/, (match, name) => match + ',(window.__testWorld=' + name + ')');
  await route.fulfill({ response, body });
});
const page = await context.newPage(), errors = [];
page.on("pageerror", e => errors.push(e.message));
await mkdir("docs/floor-evidence", { recursive: true });
const approach = async () => {
  await page.evaluate(() => window.__testWorld.moveTo(-9, 1));
  await page.waitForFunction(() => window.__testWorld.readingBlend > .99);
  await page.waitForTimeout(600);
};
try {
  await page.goto(server.url + "/client/?book=alice&chapter=alice-1");
  await page.waitForFunction(() => window.__testWorld?.sun);
  await page.waitForTimeout(600);
  await page.screenshot({ path: "docs/floor-evidence/01-direction-arrows.png" });
  await expect(page.locator('.chapter-caption')).toHaveCount(0);
  await page.locator('#map-button').click();
  await page.locator('[data-chapter="1"]').click();
  await page.waitForFunction(() => window.__testWorld.index === 1 && window.__testWorld.player.position.y > 1);
  await page.waitForFunction(() => window.__testWorld.arrivalTime === null);
  expect(await page.evaluate(() => window.__testWorld.player.position.y)).toBeCloseTo(.08, 2);
  await page.locator('#prev-chapter').click();
  await page.waitForFunction(() => window.__testWorld.index === 0 && window.__testWorld.arrivalTime === null);
  console.log('PASS removed caption and chapter-selection jump lands on ground');
  const normalDistance = await page.evaluate(() => window.__testWorld.camera.position.distanceTo(window.__testWorld.cameraFocus));
  await approach();
  expect(await page.evaluate(() => window.__testWorld.camera.position.distanceTo(window.__testWorld.cameraFocus))).toBeGreaterThan(normalDistance * 1.3);
  await expect(page.locator(".floor-reading-controls")).toBeVisible();
  await expect(page.locator("#floor-accessible")).toContainText("강둑");
  await page.screenshot({ path: "docs/floor-evidence/02-desktop-reading.png" });
  await page.locator("#floor-next").click();
  await expect(page.locator("#floor-page")).toContainText("2 /");
  await page.evaluate(() => window.__testWorld.moveTo(-18, 4));
  await page.waitForFunction(() => window.__testWorld.readingBlend < .01);
  await expect(page.locator(".floor-reading-controls")).toBeHidden();
  expect(await page.evaluate(() => window.__testWorld.camera.position.distanceTo(window.__testWorld.cameraFocus))).toBeLessThan(normalDistance * 1.02);
  console.log("PASS floor text, zoom-out, pagination and return to walking view");
  await page.setViewportSize({ width: 390, height: 844 });
  await approach();
  const composition = await page.evaluate(() => {
    const w = window.__testWorld;
    const player = w.player.position.clone().project(w.camera), model = w.readingActive.group.position.clone().project(w.camera);
    const panel = document.querySelector('.floor-reading-controls');
    const rect = panel.getBoundingClientRect(), css = getComputedStyle(panel);
    return {player:player.x, model:model.x, right:rect.right, left:rect.left, blur:css.backdropFilter, background:css.backgroundColor};
  });
  expect(composition.player).toBeLessThan(0); expect(composition.player).toBeGreaterThan(-1);
  expect(composition.model).toBeLessThan(0); expect(composition.model).toBeGreaterThan(-1);
  expect(composition.left).toBeGreaterThan(390 * .5); expect(composition.right).toBeLessThanOrEqual(390);
  expect(composition.blur).toContain('blur'); expect(composition.background).toContain('0.58');
  await page.screenshot({ path: "docs/floor-evidence/03-mobile-reading.png" });
  console.log("PASS mobile left-side figures and right-side translucent blurred text");
  await page.locator('#floor-accessible').evaluate(el => el.style.fontSize = '32px');
  const overflow = await page.locator('#floor-accessible').evaluate(el => {
    el.scrollTop = el.scrollHeight;
    const panel = el.closest('aside').getBoundingClientRect(), buttons = document.querySelector('.floor-pagination').getBoundingClientRect();
    return { scroll: el.scrollTop, bottom: buttons.bottom, panelBottom: panel.bottom };
  });
  expect(overflow.scroll).toBeGreaterThan(0);
  expect(overflow.bottom).toBeLessThanOrEqual(overflow.panelBottom);
  await page.locator('#floor-next').click();
  expect(await page.locator('#floor-accessible').evaluate(el => el.scrollTop)).toBe(0);
  console.log('PASS enlarged overflowing text scrolls independently with pagination visible');
  const admin = await context.newPage(); await admin.goto(server.url + "/admin/"); await admin.locator('[data-open-book="alice"]').click();
  await admin.locator("#edit-story").click();
  await admin.getByLabel("오른쪽에 보여 줄 글귀", {exact:true}).fill("앨리스는 토끼를 바라보았습니다. 작은 호기심에서 이야기가 시작되었습니다.");

  await admin.getByLabel("글귀 카메라 여백 배율").fill("1.3");
  await admin.getByRole("button", {name:"변경 적용",exact:true}).click();
  await admin.locator("#preview-client").click();
  await admin.screenshot({ path: "docs/floor-evidence/04-admin-preview.png", fullPage:true });
  await admin.locator(".client-preview-dialog .close-modal").click();
  await admin.locator("#save").click(); await expect(admin.locator("#save-state")).toHaveText("변경사항 저장됨");
  let live = await (await context.request.get(server.url + "/api/library")).json();
  expect(live.books[0].chapters[0].floorText || "").toBe("");
  await admin.reload(); await admin.locator('[data-open-book="alice"]').click(); await admin.locator("#edit-story").click();
  await expect(admin.getByLabel("글귀 카메라 여백 배율")).toHaveValue("1.3");
  await admin.keyboard.press("Escape");
  await admin.locator("#publish").click(); await expect(admin.locator("#save-state")).toHaveText("공개 완료");
  await page.reload(); await page.waitForFunction(() => window.__testWorld?.sun); await approach();
  await expect(page.locator("#floor-accessible")).toContainText("작은 호기심");
  console.log("PASS administrator text, art and camera settings persist and publish");
  await admin.locator("#edit-story").click();
  await admin.getByLabel("모델 접근 시 글 섹션과 카메라 연출").uncheck();

  await admin.getByRole("button", {name:"변경 적용",exact:true}).click();
  await admin.locator("#publish").click(); await expect(admin.locator("#save-state")).toHaveText("공개 완료");
  await page.reload(); await page.waitForFunction(() => window.__testWorld?.sun);
  await page.evaluate(() => window.__testWorld.moveTo(-9, 1));
  await page.waitForFunction(() => window.__testWorld.objects[0].near);
  expect(await page.evaluate(() => window.__testWorld.readingBlend)).toBe(0);
  expect(errors).toEqual([]);
  console.log("PASS disabled floor reading preserves model proximity animations; no browser errors");
} finally { await browser.close(); await server.stop(); }



