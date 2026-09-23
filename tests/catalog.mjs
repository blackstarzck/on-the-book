import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from './helpers.js';

const server = await startServer(4336);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], results = [];
await mkdir('test-results/catalog', { recursive: true });
const pass = message => { results.push(message); console.log(`PASS ${message}`); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/assets/client-*.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/([\w$]+)\.setActive\(([\w$]+)\)/, (match, name) => `${match},(window.__testWorld=${name})`);
    await route.fulfill({ response, body });
  });
  await page.goto(`${server.url}/client/`);
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await expect(page.locator('.catalog-slot')).toHaveCount(4);
  await expect(page.locator('.catalog-cover img, .catalog-cover svg')).toHaveCount(0);
  await expect(page.locator('.catalog-cover')).toHaveCount(2);
  await expect(page.locator('.catalog-card .book-category, .catalog-card .book-description, .catalog-card .book-resume, .catalog-card .book-details, .catalog-card .book-format')).toHaveCount(0);
  await expect(page.locator('.catalog-card .book-title, .catalog-card .book-author')).toHaveCount(4);
  await expect(page.locator('.quick-menu img')).toHaveCount(6);
  await expect(page.locator('.quick-menu svg')).toHaveCount(0);
  await expect(page.locator('.discovery-nav, [data-nav]')).toHaveCount(0);
  await expect(page.locator('.reading-ribbon')).toBeVisible();
  const ribbonBox = await page.locator('.reading-ribbon').boundingBox();
  expect(ribbonBox.x).toBe(0);
  expect(ribbonBox.width).toBe(1440);
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  await expect(page.locator('.scene-card')).toHaveCount(9);
  await expect(page.locator('canvas, video, dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /로그인|회원가입|알림/ })).toHaveCount(0);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  const desktopType = await page.evaluate(() => ({
    search: parseFloat(getComputedStyle(document.querySelector('.header-search input')).fontSize),
    feature: parseFloat(getComputedStyle(document.querySelector('.feature-copy > strong')).fontSize),
    title: parseFloat(getComputedStyle(document.querySelector('.book-title')).fontSize),
    scene: parseFloat(getComputedStyle(document.querySelector('.scene-card > strong')).fontSize),
  }));
  expect(desktopType.search).toBeGreaterThanOrEqual(14);
  expect(desktopType.feature).toBeGreaterThanOrEqual(25);
  expect(desktopType.title).toBeGreaterThanOrEqual(16);
  expect(desktopType.scene).toBeGreaterThanOrEqual(15);
  pass('Readable type scale on desktop');
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'alice') {
    await page.getByRole('button', { name: '이전 추천 작품', exact: true }).click();
  }
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  await page.locator('.feature-grid').evaluate(element => {
    const rect = element.getBoundingClientRect();
    const startX = rect.left + rect.width * .78;
    const endX = rect.left + rect.width * .22;
    const y = rect.top + rect.height * .5;
    const event = (type, clientX) => new PointerEvent(type, { bubbles: true, pointerId: 23, pointerType: 'touch', isPrimary: true, button: 0, clientX, clientY: y });
    element.dispatchEvent(event('pointerdown', startX));
    element.dispatchEvent(event('pointermove', endX));
    element.dispatchEvent(event('pointerup', endX));
  });
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'oz');
  await expect(page.locator('.feature-progress')).toContainText('2 / 2');
  await expect.poll(() => page.locator('.feature-card.is-active').evaluate(element => getComputedStyle(element).transform)).toBe('none');
  await expect.poll(() => page.locator('.feature-card.is-active .feature-copy > strong').evaluate(element => getComputedStyle(element).animationName)).toBe('hero-copy-in');
  pass('Hero swipe, progress and staggered text animation');
  await page.screenshot({ path: 'test-results/catalog/desktop.png', fullPage: true });
  await page.getByLabel('도서 제목 또는 작가 검색').fill('루이스');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.book-title')).toHaveText('이상한 나라의 앨리스');
  await page.getByLabel('도서 제목 또는 작가 검색').fill('없는도서');
  await expect(page.getByText('찾는 이야기가 없어요')).toBeVisible();
  await page.getByRole('button', { name: '전체 도서 보기', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await page.getByRole('button', { name: '모험', exact: true }).click();
  await expect(page.locator('.book-title')).toHaveText('오즈의 마법사');
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.getByLabel('도서 정렬').selectOption('year');
  await expect(page.locator('.book-title').first()).toHaveText('오즈의 마법사');
  await page.getByRole('button', { name: '읽던 작품 이어 보기', exact: true }).click();
  await expect(page.getByText('아직 펼친 이야기가 없어요')).toBeVisible();
  await page.getByRole('button', { name: '전체 도서 보기', exact: true }).click();
  pass('Search, category, sort and empty results');

  await page.locator('[data-enter="alice"]').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page).toHaveURL(/book=alice&chapter=alice-1/);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.getByRole('button', { name: '이상한 나라의 앨리스 작품 소개', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'book-detail-title');
  await expect(page.locator('.book-detail-chapters li')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '이상한 나라의 앨리스 작품 소개', exact: true })).toBeFocused();
  pass('Work information remains available inside the 3D reader');
  await page.waitForFunction(() => window.__testWorld?.player);
  const start = await page.evaluate(() => window.__testWorld.player.position.x);
  await page.locator('#world canvas').focus();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__testWorld.player.position.x)).toBeGreaterThan(start + .5);
  await page.keyboard.up('ArrowRight');
  await page.locator('#next-chapter').click();
  await expect(page.locator('#map-button')).toContainText('02');
  await expect(page).toHaveURL(/chapter=alice-2/);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.waitForFunction(() => document.querySelector('.journey-controls').getAnimations().length === 0);
  await page.screenshot({ path: 'test-results/catalog/reader.png' });
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '읽던 작품 이어 보기', exact: true }).click();
  await expect(page.locator('.book-title')).toHaveText('이상한 나라의 앨리스');
  await page.locator('[data-enter="alice"]').click();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.reload();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.goBack();
  await expect(page.locator('.library-page')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#map-button')).toContainText('02');
  pass('Direct 3D entry, movement, chapters, saved progress and browser history');
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.locator('[data-enter="oz"]').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page).toHaveURL(/book=oz&chapter=oz-1/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.locator('#trailer-button').click();
  await expect(page.locator('dialog video')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('video')).toHaveCount(0);
  pass('Both real books enter their own world; trailer opens and closes');

  await expect(page.locator('[data-rail="-1"]')).toBeDisabled();
  await page.getByRole('button', { name: '다음 장면들', exact: true }).click();
  await expect.poll(() => page.locator('.scene-rail').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.locator('.scene-rail').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('[data-rail="-1"]')).toBeDisabled();
  await page.locator('[data-scene-chapter="alice-3"]').click();
  await expect(page.locator('#map-button')).toContainText('03');
  await expect(page).toHaveURL(/book=alice&chapter=alice-3/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'oz') {
    await page.getByRole('button', { name: '다음 추천 작품', exact: true }).click();
  }
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'oz');
  await page.locator('.feature-card.is-active').evaluate(element => element.click());
  await expect(page).toHaveURL(/book=oz&chapter=oz-1/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  pass('Blank image slots, featured entry and scene carousel with direct chapter entry');

  // More books exist only in this intercepted response, never in the saved library.
  const original = await (await fetch(`${server.url}/api/library`)).json();
  await page.route('**/api/library', route => route.fulfill({ json: {
    ...original, books: Array.from({ length: 18 }, (_, i) => ({ ...original.books[i % 2], id: `fixture-${i}`, title: `확장 확인 도서 ${i + 1}` })),
  } }));
  await page.goto(`${server.url}/client/`);
  await expect(page.locator('.catalog-card')).toHaveCount(18);
  await expect(page.locator('.catalog-grid--many')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/catalog/expanded-fixture-only.png', fullPage: true });
  pass('18-book responsive grid without changing real library');
  await context.close();

  for (const width of [320, 390, 768]) {
    const mobileContext = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const mobile = await mobileContext.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(`${server.url}/client/`);
    await expect(mobile.locator('.catalog-card')).toHaveCount(2);
    expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const mobileType = await mobile.evaluate(() => ({
      search: parseFloat(getComputedStyle(document.querySelector('.header-search input')).fontSize),
      quick: parseFloat(getComputedStyle(document.querySelector('.quick-menu button')).fontSize),
      title: parseFloat(getComputedStyle(document.querySelector('.book-title')).fontSize),
      scene: parseFloat(getComputedStyle(document.querySelector('.scene-card > strong')).fontSize),
    }));
    expect(mobileType.search).toBeGreaterThanOrEqual(14);
    expect(mobileType.quick).toBeGreaterThanOrEqual(11);
    expect(mobileType.title).toBeGreaterThanOrEqual(16);
    expect(mobileType.scene).toBeGreaterThanOrEqual(15);
    await mobile.screenshot({ path: `test-results/catalog/mobile-${width}.png`, fullPage: true });
    await mobile.locator('[data-enter="oz"]').tap();
    await expect(mobile.locator('#world canvas')).toBeVisible();
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
    const target = await mobile.locator('#next-chapter').evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(x, y)) };
    });
    expect(target.visible).toBe(true);
    expect(target.reachable).toBe(true);
    await mobile.touchscreen.tap(target.x, target.y);
    await expect(mobile.locator('#map-button')).toContainText('02');
    await mobile.getByRole('button', { name: '책장으로', exact: true }).tap();
    await expect(mobile.locator('.catalog-card')).toHaveCount(2);
    await mobileContext.close();
    pass(`${width}px: no horizontal overflow, touch entry and chapter navigation`);
  }
  expect(errors).toEqual([]);
  const unchanged = await (await fetch(`${server.url}/api/library`)).json();
  expect(unchanged.books).toHaveLength(2);
  pass('No browser exceptions; saved library still contains only two books');
} finally {
  await writeFile('test-results/catalog/results.json', JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  await server.stop();
}
