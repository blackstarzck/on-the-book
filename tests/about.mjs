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
    await page.goto(server.url + "/about");
    await expect(page).toHaveURL(aboutUrl);
    await expect(page).toHaveTitle("On the Book — 책 속을 걷다");
    pass("Local /about opens the about page");
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
  await browser.close();
  await server.stop();
}
