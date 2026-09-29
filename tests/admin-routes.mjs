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
