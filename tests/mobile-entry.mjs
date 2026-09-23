import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { startServer } from './helpers.js';

const server = await startServer(4321);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('test-results', { recursive: true });
try {
  for (const viewport of [{ width: 393, height: 700 }, { width: 360, height: 640 }, { width: 320, height: 560 }, { width: 412, height: 800 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url + '/client/');
    await expect(page.locator('.reader-curtain')).toHaveCount(0);
    await expect(page.locator('.catalog-card')).toHaveCount(2);
    expect(await page.evaluate(() => scrollY)).toBe(0);

    // A locator click scrolls an offscreen button into view and hid the original bug.
    // Check the actual viewport and hit target before tapping coordinates instead.
    async function tapVisible(selector) {
      const target = await page.locator(selector).evaluate(element => {
        const r = element.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
          reachable: element.contains(document.elementFromPoint(x, y)) };
      });
      expect(target.visible, `${selector} must fit in ${viewport.width}x${viewport.height}`).toBe(true);
      expect(target.reachable, `${selector} must receive touches`).toBe(true);
      await page.touchscreen.tap(target.x, target.y);
    }

    if (viewport.width === 393) {
      await page.screenshot({ path: 'test-results/mobile-entry-home.png' });
      const cdp = await context.newCDPSession(page);
      const start = { x: 250, y: 540 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - i * 25 }] });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
      // Wait for the touch gesture's momentum to finish before a coordinate tap.
      await page.evaluate(() => new Promise(resolve => {
        let previous = scrollY, stableFrames = 0;
        const tick = () => {
          stableFrames = Math.abs(scrollY - previous) < .5 ? stableFrames + 1 : 0;
          previous = scrollY;
          if (stableFrames >= 6) resolve(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }));
      await cdp.detach();
    }
    // The library is scrollable; bring the selected cover into view before touching it.
    await page.locator('[data-enter="alice"] .cover-stage').evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.locator('[data-enter="alice"] .cover-stage').scrollIntoViewIfNeeded();
    await tapVisible('[data-enter="alice"] .cover-stage');
    await expect(page.locator('.reader-curtain')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.library-page')).toHaveCount(0);
    await page.waitForFunction(() => document.querySelector('.journey-controls').getAnimations().length === 0);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await tapVisible('#next-chapter');
    await expect(page.locator('.reader-curtain')).toHaveCount(0);
    await expect(page.locator('#map-button')).toContainText('02');
    expect(errors).toEqual([]);
    console.log(`PASS ${viewport.width}x${viewport.height}: book cover opens directly and chapter controls fit the viewport`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
