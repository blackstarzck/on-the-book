import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
await mkdir('docs/preview', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto('http://127.0.0.1:4173/client/');
  await expect(page.locator('[data-book="alice"]')).toBeVisible();
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.screenshot({ path: 'docs/preview/client.png', fullPage: true });
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'docs/preview/detail.png', fullPage: true });
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'docs/preview/explore.png', fullPage: true });
  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobile.goto('http://127.0.0.1:4173/client/');
  await expect(mobile.locator('[data-book="alice"]')).toBeVisible();
  await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
  await mobile.screenshot({ path: 'docs/preview/mobile.png', fullPage: true });
  // The studio preview comes last so a studio change cannot block the reader previews above.
  await page.goto('http://127.0.0.1:4173/admin/');
  await expect(page.locator('#studio-world canvas')).toBeVisible();
  await page.screenshot({ path: 'docs/preview/admin.png', fullPage: true });
  console.log('Saved five clean previews in docs/preview');
} finally {
  await browser.close();
}
