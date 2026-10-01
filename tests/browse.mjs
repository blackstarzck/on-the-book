import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { startServer } from "./helpers.js";

const server = await startServer();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
await mkdir("test-results/browse", { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${server.url}/client/`);
  await page.getByRole("button", { name: "전체 작품 둘러보기" }).click();
  await expect(page.locator(".browse-card")).toHaveCount(2);
  await expect(page).toHaveURL(/view=books/);
  await expect(page.locator("#browse-title")).toBeFocused();
  await expect(page.locator(".browse-nav")).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: "test-results/browse/desktop-grid.png", fullPage: true });

  const search = page.locator("#book-search");
  await search.fill("캐럴");
  await expect(page.locator(".browse-card")).toHaveCount(1);
  await expect(search).toBeFocused();
  await page.getByRole("button", { name: "리스트 보기", exact: true }).click();
  await expect(page.locator("#browse-results")).toHaveAttribute("data-layout", "list");
  await expect(page.locator(".browse-description")).toBeVisible();
  await page.locator("#browse-sort").selectOption("year");
  await page.reload();
  await expect(search).toHaveValue("캐럴");
  await expect(page.locator("#browse-sort")).toHaveValue("year");
  await expect(page.locator("#browse-results")).toHaveAttribute("data-layout", "list");
  await page.locator("[data-browse-book=alice]").click();
  await expect(page.locator("#detail-title")).toHaveText("이상한 나라의 앨리스");
  await page.goBack();
  await expect(search).toHaveValue("캐럴");
  await expect(page.locator("[data-browse-book=alice]")).toBeFocused();
  await expect(page.locator("#browse-results")).toHaveAttribute("data-layout", "list");
  console.log("PASS home entry, automatic author search, layout, sorting, reload and back restoration");

  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(page.locator(".browse-card")).toHaveCount(2);
  await expect(page.locator(".browse-book-title").first()).toHaveText("오즈의 마법사");
  await page.screenshot({ path: "test-results/browse/desktop-list.png", fullPage: true });
  await page.locator('[data-browse-category="판타지"]').click();
  await page.locator("#browse-reading").selectOption("reading");
  await expect(page.locator(".browse-empty")).toBeVisible();
  await page.getByRole("button", { name: "전체 도서 보기", exact: true }).click();
  await expect(page.locator(".browse-card")).toHaveCount(2);
  await expect(search).toBeFocused();
  await search.fill("zzzzzz");
  await expect(page.locator("#browse-status")).toContainText("0권");
  await expect(page.locator(".browse-empty")).toBeVisible();
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await search.evaluate(input => {
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    input.value = "오";
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
  });
  await expect(page.locator(".browse-card")).toHaveCount(2);
  await search.evaluate(input => {
    input.value = "오즈";
    input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
  });
  await expect(page.locator(".browse-card")).toHaveCount(1);
  await expect(search).toHaveValue("오즈");
  console.log("PASS combined filters, empty results, reset and Korean composition");

  await page.evaluate(() => localStorage.setItem("otb-reader", JSON.stringify({ alice: { chapter: "alice-2" }, oz: { chapter: "gone" } })));
  await page.goto(`${server.url}/client/?view=books&reading=reading`);
  await expect(page.locator(".browse-card")).toHaveCount(1);
  await expect(page.locator(".browse-reading")).toHaveText("읽던 도서");
  await page.locator("#browse-reading").selectOption("unread");
  await expect(page.locator(".browse-book-title")).toHaveText("오즈의 마법사");
  await page.goto(`${server.url}/client/?book=alice`);
  await search.fill("오즈");
  await search.press("Enter");
  await expect(page.locator(".browse-card")).toHaveCount(1);
  await expect(search).toBeFocused();
  await expect(page).toHaveURL(/view=books/);
  await page.locator(".reading-ribbon").click();
  await expect(page.locator("#scene-title")).toBeFocused();
  await page.getByRole("link", { name: "전체 도서 보기", exact: true }).click();
  await expect(page.locator(".browse-card")).toHaveCount(2);
  console.log("PASS reading status, detail search, scene ribbon and section link");

  const library = await (await fetch(server.url + "/api/library")).json();
  const expanded = { ...library, books: Array.from({ length: 24 }, (_, index) => ({ ...library.books[index % 2], id: `book-${index}`, title: index === 0 ? "아주 긴 제목의 도서도 화면을 벗어나지 않고 자연스럽게 읽을 수 있는 이야기" : `${library.books[index % 2].title} ${index + 1}` })) };
  await context.route("**/api/library", route => route.fulfill({ json: expanded }));
  await page.goto(`${server.url}/client/?view=books`);
  await expect(page.locator(".browse-card")).toHaveCount(24);
  await page.locator('[data-browse-book="book-18"]').scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await page.locator('[data-browse-book="book-18"]').click();
  await expect(page.locator("#detail-title")).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-browse-book="book-18"]')).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(3);
  for (const width of [320, 375, 600, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const layout of ["grid", "list"]) {
      await page.locator(`button[data-layout="${layout}"]`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator("#book-search").evaluate(input => input.getBoundingClientRect().width > 100)).toBe(true);
      if (width === 375) {
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `test-results/browse/mobile-${layout}.png` });
      }
    }
  }
  console.log("PASS 24-book scroll restoration and both layouts at 320, 375, 600, 768 and 1440px");

  await context.route("**/api/studio", route => route.fulfill({ json: { library: { ...library, books: library.books.map((book, index) => ({ ...book, published: index === 0 })) } } }));
  await page.goto(`${server.url}/client/?view=books&preview=draft&category=missing&sort=bad&layout=list`);
  await expect(page.locator(".browse-card")).toHaveCount(1);
  await expect(page.locator("#browse-sort")).toHaveValue("default");
  await expect(page.locator("[data-browse-book]")).toHaveAttribute("href", /preview=draft/);
  await expect(page).not.toHaveURL(/category=missing|sort=bad/);
  await context.unroute("**/api/library");
  await context.route("**/api/library", route => route.fulfill({ json: { ...library, books: [] } }));
  await page.goto(`${server.url}/client/?view=books`);
  await expect(page.locator(".browse-empty")).toContainText("새로운 이야기를 준비하고 있어요");
  expect(errors).toEqual([]);
  console.log("PASS invalid URL recovery, draft publication filtering, empty library and no runtime errors");
} finally {
  await browser.close();
  await server.stop();
}
