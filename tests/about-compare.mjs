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
