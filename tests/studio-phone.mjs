import { chromium, expect } from "@playwright/test";
import { startServer } from "./helpers.js";

// The studio's top bar on phones: the brand and the four menu buttons fit the screen at the common phone widths,
// every button keeps a 44px touch target, and under 382px only the book mark shows while the brand link keeps its
// name. Phone emulation widens the layout viewport to fit what overflows, so the page is measured against the
// phone's width, not innerWidth.
const server = await startServer();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pass = (name) => console.log("PASS " + name);
try {
  for (const width of [320, 360, 375, 390, 412]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/admin/", "/admin/home", "/admin/models", "/admin/settings"]) {
      await page.goto(server.url + path);
      await expect(page.locator(".studio-nav button")).toHaveCount(4);
      // Measured once the web font is in: the fallback face is wider and swaps out a moment after first paint.
      await page.evaluate(() => document.fonts.ready);
      const bar = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        wordmark: document.querySelector(".studio-sidebar .wordmark").getBoundingClientRect().width,
        buttons: [...document.querySelectorAll(".studio-nav button")].map((button) => {
          const r = button.getBoundingClientRect();
          return { width: r.width, height: r.height, right: r.right };
        }),
      }));
      expect(bar.page, `${path} scrolls sideways at ${width}px`).toBeLessThanOrEqual(width);
      for (const button of bar.buttons) {
        expect(button.width).toBeGreaterThanOrEqual(44);
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.right, `${path} menu leaves the screen at ${width}px`).toBeLessThanOrEqual(width);
      }
      expect(bar.wordmark > 1, `wordmark shows at ${width}px`).toBe(width >= 382);
      await expect(page.locator(".studio-sidebar").getByRole("link", { name: "on the book.", exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
    await context.close();
    pass(`${width}px: the studio bar fits, its buttons stay 44px and the brand link keeps its name`);
  }
} finally {
  await browser.close();
  await server.stop();
}
