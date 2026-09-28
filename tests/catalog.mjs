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
    const body = (await response.text()).replace(/([\w$]+)\.setActive\(([^)]*)\)/, (match, name) => `${match},(window.__testWorld=${name})`);
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

  await expect(page.locator('[data-book="alice"]')).toHaveAttribute('href', '?book=alice');
  await expect(page.locator('[data-scene-chapter="alice-3"]')).toHaveAttribute('href', '?book=alice&scene=alice-3');
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('.journey-row')).toHaveCount(6);
  await expect(page.locator('.detail-cta .primary-button')).toHaveText(/이야기 속으로 들어가기/);
  await expect(page.locator('.detail-cover img, .detail-page img')).toHaveCount(0);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  pass('Book cards open the book detail page');
  await page.locator('.detail-cta .primary-button').click();
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
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-cta .primary-button')).toContainText('이어 읽기');
  await expect(page.locator('.detail-cta .primary-button')).toContainText('02');
  await expect(page.locator('.journey-badge', { hasText: '마지막에 머문 장면' })).toHaveCount(1);
  await expect(page.locator('.detail-restart')).toHaveText('처음부터 시작하기');
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.reload();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.goBack();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.library-page')).toBeVisible();
  await page.goForward();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#map-button')).toContainText('02');
  pass('Detail CTA resumes the saved chapter; history keeps the detail page between home and world');
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.locator('[data-book="oz"]').click();
  await expect(page.locator('#detail-title')).toHaveText('오즈의 마법사');
  await expect(page.locator('.journey-row')).toHaveCount(3);
  await page.locator('.detail-cta .primary-button').click();
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
  await expect(page.locator('.detail-page[data-view="scene"]')).toBeVisible();
  await expect(page).toHaveURL(/book=alice&scene=alice-3$/);
  await expect(page.locator('#detail-title')).toHaveText('버섯 숲의 수수께끼');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page.locator('.detail-crumbs a')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-preview .reading-text p')).toHaveCount(1);
  await expect(page.locator('.figure-list li')).toHaveCount(3);
  await expect(page.locator('.figure-list li').first()).toContainText('장면의 중심');
  await expect(page.locator('.neighbor-link').first()).toContainText('02');
  await expect(page.locator('.neighbor-link').last()).toContainText('04');
  await expect(page.locator('.detail-page img')).toHaveCount(0);
  await page.locator('.detail-cta .primary-button').click();
  await expect(page.locator('#map-button')).toContainText('03');
  await expect(page).toHaveURL(/book=alice&chapter=alice-3/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  pass('Blank image slots; scene cards open the scene detail and its CTA enters that chapter');
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'alice') {
    await page.getByRole('button', { name: '이전 추천 작품', exact: true }).click();
  }
  await page.locator('.feature-card.is-active').evaluate(element => element.click());
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  await expect(page.locator('.feature-card.is-active')).toBeFocused();
  // Autoplay (5.2 s) must not steal the restored focus.
  await page.waitForTimeout(5600);
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  await expect(page.locator('.feature-card.is-active')).toBeFocused();
  pass('The hero opens the book detail and the restored focus survives autoplay');
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'oz') {
    await page.getByRole('button', { name: '다음 추천 작품', exact: true }).click();
  }
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'oz');
  await page.locator('.feature-card.is-active').evaluate(element => element.click());
  await expect(page).toHaveURL(/\?book=oz$/);
  await expect(page.locator('#detail-title')).toHaveText('오즈의 마법사');
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await expect(page.locator('.library-page')).toBeVisible();
  pass('The second hero slide opens its book detail');

  // Direct addresses: first load resolves the view and cleans unusable parts. No focus move on a cold load.
  await page.goto(`${server.url}/client/?book=alice`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page).toHaveTitle('이상한 나라의 앨리스 — On the Book');
  await expect(page.locator('.header-search')).toHaveCount(0);
  await page.goto(`${server.url}/client/?book=alice&scene=alice-2`);
  await expect(page.locator('.detail-page[data-view="scene"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page).toHaveTitle('작아지는 문, 커지는 세계 · 이상한 나라의 앨리스 — On the Book');
  await page.goto(`${server.url}/client/?book=nope`);
  await expect(page.locator('.library-page')).toBeVisible();
  await expect(page).toHaveURL(/\/client\/$/);
  await page.goto(`${server.url}/client/?scene=alice-2`);
  await expect(page.locator('.library-page')).toBeVisible();
  await expect(page).toHaveURL(/\/client\/$/);
  await page.goto(`${server.url}/client/?book=alice&chapter=nope`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page).toHaveURL(/\?book=alice$/);
  await page.goto(`${server.url}/client/?book=alice&scene=nope&preview=draft`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page).toHaveURL(/\?book=alice&preview=draft$/);
  await expect(page.locator('.journey-row').first()).toHaveAttribute('href', '?book=alice&scene=alice-1&preview=draft');
  await expect(page).toHaveTitle('이상한 나라의 앨리스 — On the Book');
  pass('Direct addresses resolve to the right screen and unusable parts are cleaned');

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

  // Studio-managed images, slides and categories, again only in intercepted responses.
  const upload = c => `/uploads/${c.repeat(8)}-${c.repeat(4)}-${c.repeat(4)}-${c.repeat(4)}-${c.repeat(12)}.png`;
  const [alice, oz] = original.books;
  const managed = {
    ...original,
    books: [
      { ...alice, cover: upload('1'), chapters: alice.chapters.map((c, i) => i ? c : { ...c, thumbnail: upload('2') }) },
      { ...oz, category: '세계고전문학선집' },
    ],
    home: { hero: [
      { id: 'slide-missing', bookId: 'missing-book', image: upload('3') },
      { id: 'slide-oz', bookId: 'oz', image: upload('4'), focus: 'right', kicker: '이번 주 추천', title: '노란 길로 떠나요', description: '용기와 지혜를 찾아 걷는 길' },
      { id: 'slide-alice', bookId: 'alice', image: upload('5'), focus: 'center', kicker: '', title: '', description: '' },
      { id: 'slide-oz-again', bookId: 'oz', image: upload('6'), focus: 'left', kicker: '', title: '', description: '' },
    ] },
  };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const managedPage = async (context, payload) => {
    const view = await context.newPage();
    view.on('pageerror', error => errors.push(error.message));
    await view.route('**/api/library', route => route.fulfill({ json: payload }));
    await view.route('**/uploads/**', route => route.fulfill({ contentType: 'image/png', body: png }));
    await view.goto(`${server.url}/client/`);
    await expect(view.locator('.catalog-card')).toHaveCount(2);
    return view;
  };
  const loaded = locator => locator.evaluateAll(images => images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0));
  // Reduced motion keeps autoplay off, so the slide under test cannot change mid-check.
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const home = await managedPage(desktop, managed);
  await expect(home.locator('[data-book="alice"] .catalog-cover img')).toHaveCount(1);
  await expect(home.locator('[data-book="oz"] .catalog-cover img')).toHaveCount(0);
  await expect(home.locator('.scene-image.has-image img')).toHaveCount(1);
  await home.locator('.scene-image.has-image').scrollIntoViewIfNeeded();
  await expect.poll(() => loaded(home.locator('.catalog-cover img, .scene-image img'))).toBe(true);
  await home.evaluate(() => window.scrollTo(0, 0));
  await expect(home.locator('.feature-card')).toHaveCount(3);
  const first = home.locator('.feature-card.is-active');
  await expect(first).toHaveAttribute('data-feature-book', 'oz');
  await expect(first).toHaveClass(/feature-card--photo/);
  await expect(first.locator('.feature-kicker')).toHaveText('이번 주 추천');
  await expect(first.locator('.feature-copy > strong')).toHaveText('노란 길로 떠나요');
  await expect(first.locator('.feature-art')).toHaveCount(0);
  expect(await first.locator('.feature-copy > strong').evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  expect(await first.locator('.feature-photo').evaluate(img => getComputedStyle(img).objectPosition)).toBe('82% 50%');
  await expect(home.locator('.feature-progress')).toContainText('1 / 3');
  // The shown photo and the next one load; the third waits for its turn.
  await expect(home.locator('[data-feature-book="alice"] .feature-photo')).toHaveAttribute('src', upload('5'));
  await expect(home.locator('[data-feature-index="2"] .feature-photo')).not.toHaveAttribute('src', /./);
  await home.getByRole('button', { name: '다음 추천 작품', exact: true }).click();
  await expect(home.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  await expect(home.locator('.feature-card.is-active .feature-kicker')).toHaveText('한 걸음, 새로운 모험');
  await expect(home.locator('.feature-card.is-active .feature-copy > strong')).toHaveText(alice.title);
  await expect(home.locator('[data-feature-index="2"] .feature-photo')).toHaveAttribute('src', upload('6'));
  await expect(home.locator('.quick-menu img')).toHaveCount(6);
  await home.locator('.catalog-filters [data-category="세계고전문학선집"]').click();
  await expect(home.locator('.catalog-card')).toHaveCount(1);
  await expect(home.locator('[data-book="oz"]')).toBeVisible();
  await home.locator('.catalog-filters [data-category="all"]').click();
  await home.screenshot({ path: 'test-results/catalog/managed-home.png', fullPage: true });
  const single = await managedPage(desktop, { ...managed, home: { hero: [managed.home.hero[1]] } });
  await expect(single.locator('.feature-card')).toHaveCount(1);
  await expect(single.locator('.feature-arrow, .feature-controls')).toHaveCount(0);
  const empty = await managedPage(desktop, { ...managed, home: { hero: [managed.home.hero[0]] } });
  await expect(empty.locator('.feature-card')).toHaveCount(2);
  await expect(empty.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  await desktop.close();
  for (const width of [320, 390, 768]) {
    const phone = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const view = await managedPage(phone, managed);
    expect(await view.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await view.locator('.quick-menu button').evaluateAll(buttons => buttons.every(b => b.scrollWidth <= b.clientWidth + 1))).toBe(true);
    await view.screenshot({ path: `test-results/catalog/managed-home-${width}.png` });
    await phone.close();
  }
  pass('Studio covers, chapter thumbnails, photo hero slides and typed categories');

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
    await mobile.locator('[data-book="oz"]').tap();
    await expect(mobile.locator('.detail-page[data-view="book"]')).toBeVisible();
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
    // The CTA must be reachable without scrolling: pinned at the bottom on phones, under the hero on tablets.
    const cta = await mobile.locator('.detail-cta .primary-button').evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(x, y)) };
    });
    expect(cta.visible).toBe(true);
    expect(cta.reachable).toBe(true);
    if (width <= 600) {
      const bar = await mobile.locator('.detail-cta').evaluate(element => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, width: innerWidth };
      });
      expect(bar.left).toBe(0);
      expect(bar.right).toBe(bar.width);
    }
    await mobile.touchscreen.tap(cta.x, cta.y);
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
