import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from './helpers.js';

const server = await startServer();
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
  // The shelf shows only the books: no count beside the title and no empty places after the cards.
  await expect(page.locator('#catalog-title')).toHaveText('지금 만나볼 이야기');
  await expect(page.locator('#book-grid > *')).toHaveCount(2);
  await expect(page.locator('.catalog-cover img')).toHaveCount(2);
  await expect.poll(() => page.locator('.catalog-cover img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await expect(page.locator('.catalog-cover')).toHaveCount(2);
  await expect(page.locator('.catalog-card .book-category, .catalog-card .book-description, .catalog-card .book-resume, .catalog-card .book-details, .catalog-card .book-format')).toHaveCount(0);
  await expect(page.locator('.catalog-card .book-title, .catalog-card .book-author')).toHaveCount(4);
  await expect(page.locator('.quick-menu img')).toHaveCount(6);
  await expect(page.locator('.quick-menu svg')).toHaveCount(0);
  // No divider above or below the bookshelf section: whitespace alone sets it apart.
  expect(await page.evaluate(() => [getComputedStyle(document.querySelector('.quick-menu')).borderBottomStyle, getComputedStyle(document.querySelector('.scene-section')).borderTopStyle])).toEqual(['none', 'none']);
  await expect(page.locator('.discovery-nav, [data-nav]')).toHaveCount(0);
  await expect(page.locator('.reading-ribbon')).toBeVisible();
  const ribbonBox = await page.locator('.reading-ribbon').boundingBox();
  expect(ribbonBox.x).toBe(0);
  expect(ribbonBox.width).toBe(1440);
  await expect(page.locator('.feature-card.is-active')).toHaveAttribute('data-feature-book', 'alice');
  // The scene previews show one book at a time, the first on the shelf: its square cover tile (two columns wide), then
  // a square card per chapter.
  await expect(page.getByRole('tab')).toHaveText(['이상한 나라의 앨리스', '오즈의 마법사']);
  await expect(page.getByRole('tab', { name: '이상한 나라의 앨리스', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#scene-shelf')).toHaveAttribute('aria-labelledby', 'scene-tab-0');
  await expect(page.locator('.scene-cover')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('.scene-card')).toHaveCount(6);
  await expect(page.locator('.scene-index')).toHaveText(['Chapter. 01', 'Chapter. 02', 'Chapter. 03', 'Chapter. 04', 'Chapter. 05', 'Chapter. 06']);
  const tiles = await page.locator('.scene-shelf').evaluate(shelf => {
    const cover = shelf.querySelector('.scene-cover').getBoundingClientRect();
    const image = shelf.querySelector('.scene-card .scene-image').getBoundingClientRect();
    return { cover: cover.width / cover.height, image: image.width / image.height, span: Math.round(cover.width - 2 * image.width - parseFloat(getComputedStyle(shelf.querySelector('.scene-rail')).columnGap)) };
  });
  expect(Math.abs(tiles.cover - 1)).toBeLessThan(.01);
  expect(Math.abs(tiles.image - 1)).toBeLessThan(.01);
  expect(tiles.span).toBe(0);
  // The rail moves by swipe, wheel, keys and the arrow buttons; it shows no scrollbar. (Headless scrollbars take no
  // room, so the check reads the style rather than measuring the bar.)
  expect(await page.locator('.scene-rail').evaluate(rail => getComputedStyle(rail).scrollbarWidth)).toBe('none');
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
  // Hovering a slide keeps its own ink: the global button:hover colour must not repaint the hero copy.
  const ink = () => page.locator('.feature-card.is-active .feature-copy > strong').evaluate(el => getComputedStyle(el).color);
  const resting = await ink();
  await page.locator('.feature-card.is-active').hover();
  expect(await ink()).toBe(resting);
  await page.mouse.move(0, 0);
  pass('Hero swipe, progress and staggered text animation');
  await page.screenshot({ path: 'test-results/catalog/desktop.png', fullPage: true });
  await page.getByLabel('도서 제목 또는 작가 검색').fill('루이스');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.book-title')).toHaveText('이상한 나라의 앨리스');
  await page.getByLabel('도서 제목 또는 작가 검색').fill('없는도서');
  await expect(page.getByText('찾는 이야기가 없어요')).toBeVisible();
  await page.getByRole('button', { name: '전체 도서 보기', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
  // A genre chip filters only the section's cards: the section keeps its title, and the rest of the home stays on screen.
  await page.getByRole('button', { name: '모험', exact: true }).click();
  await expect(page.locator('.book-title')).toHaveText('오즈의 마법사');
  await expect(page.getByRole('button', { name: '모험', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#catalog-title')).toHaveText('지금 만나볼 이야기');
  await expect(page.locator('#book-grid > *')).toHaveCount(1);
  for (const section of ['.reading-ribbon', '.featured-section', '.quick-menu', '.scene-section', '.experience-banner']) await expect(page.locator(section)).toBeVisible();
  // The quick menu's genres pick the same chip.
  await page.getByRole('button', { name: '판타지 도서 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '판타지', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.book-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#catalog-title')).toBeFocused();
  for (const section of ['.reading-ribbon', '.featured-section', '.quick-menu', '.scene-section', '.experience-banner']) await expect(page.locator(section)).toBeVisible();
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await expect(page.locator('.catalog-card')).toHaveCount(2);
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
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-1');
  await expect(page.locator('.scene-panel')).toBeVisible();
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('흰 토끼를 따라서');
  await expect(page.locator('.detail-cta')).toBeHidden();
  await expect(page.locator('.detail-page img')).toHaveCount(0);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  // The book detail repeats the bookshelf's top: the ribbon and the header with search, 소개, 책장 and help. No footer.
  await expect(page.locator('.detail-top .reading-ribbon')).toBeVisible();
  for (const item of ['.detail-top .site-header .brand', '#book-search', '#about-link', '#library-button[aria-label="책장 홈"]', '#help-button']) await expect(page.locator(item)).toBeVisible();
  await expect(page.locator('.reader-header, .site-footer')).toHaveCount(0);
  pass('Book cards open the book detail with the first scene in the panel, under the bookshelf top');
  // Choosing a scene swaps the panel in place: no curtain, no history entry, the address follows.
  const entries = await page.evaluate(() => history.length);
  await page.locator('.journey-row[data-scene="alice-2"]').click();
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page).toHaveURL(/\?book=alice&scene=alice-2$/);
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await expect(page.locator('.journey-row[data-scene="alice-2"]')).toBeFocused();
  await expect(page.locator('#scene-status')).toContainText('02');
  await page.locator('.scene-panel .neighbor-link[data-scene="alice-3"]').click();
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('버섯 숲의 수수께끼');
  await expect(page).toHaveURL(/scene=alice-3$/);
  await expect(page.locator('.scene-panel .neighbor-link[data-scene="alice-4"]')).toBeFocused();
  await page.locator('.journey-row[data-scene="alice-1"]').click();
  await expect(page).toHaveURL(/scene=alice-1$/);
  await expect(page.locator('.scene-panel .detail-enter')).toHaveAttribute('data-enter-chapter', 'alice-1');
  pass('Journey rows and neighbour links swap the scene panel without leaving the page');
  await page.locator('.scene-panel .detail-enter').click();
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
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  // The saved scene's flag ends its title in the journey row and in the panel, and only there.
  await expect(page.locator('.journey-row[data-scene="alice-2"] strong .saved-flag svg')).toHaveCount(1);
  await expect(page.locator('.journey-row .saved-flag')).toHaveCount(1);
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page.locator('.scene-panel #panel-scene-title .saved-flag svg')).toHaveCount(1);
  await expect(page.getByRole('img', { name: '마지막에 머문 장면' })).toHaveCount(2);
  // The flag's tooltip: hidden at rest, shown on hover (row and panel), put away by Escape, shown for the row's
  // keyboard focus.
  const rowFlag = '.journey-row[data-scene="alice-2"] .saved-flag', panelFlag = '.scene-panel #panel-scene-title .saved-flag';
  const tip = selector => page.evaluate(sel => {
    const bubble = getComputedStyle(document.querySelector(sel), '::after');
    return `${bubble.content} ${bubble.opacity} ${bubble.visibility}`;
  }, selector);
  const shown = '"마지막에 머문 장면" 1 visible', hidden = '"마지막에 머문 장면" 0 hidden';
  // Which way the bubble opens from its arrow, and whether it stays inside its journey row or the panel.
  const side = selector => page.evaluate(sel => {
    const flag = document.querySelector(sel), bubble = getComputedStyle(flag, '::after'), f = flag.getBoundingClientRect();
    const box = flag.closest('.journey-row, .scene-panel').getBoundingClientRect();
    const left = f.left + parseFloat(bubble.left), right = left + parseFloat(bubble.width) + parseFloat(bubble.paddingLeft) + parseFloat(bubble.paddingRight);
    return `${right > f.right + 40 ? 'right' : left < f.left - 40 ? 'left' : 'over'} ${left >= box.left - .5 && right <= box.right + .5 ? 'inside' : 'outside'}`;
  }, selector);
  expect(await tip(rowFlag)).toBe(hidden);
  await page.locator(rowFlag).hover();
  await expect.poll(() => tip(rowFlag)).toBe(shown);
  expect(await side(rowFlag)).toBe('right inside');
  await page.keyboard.press('Escape');
  await expect.poll(() => tip(rowFlag)).toBe(hidden);
  await page.locator(panelFlag).hover();
  await expect.poll(() => tip(panelFlag)).toBe(shown);
  expect(await side(panelFlag)).toBe('right inside');
  await page.mouse.move(0, 400);
  await expect.poll(() => tip(panelFlag)).toBe(hidden);
  // A title that ends at the panel's right edge leaves no room on that side, so the bubble opens leftwards instead.
  await page.evaluate(() => { document.querySelector('#panel-scene-title').style.textAlign = 'right'; });
  await page.locator(panelFlag).hover();
  await expect.poll(() => tip(panelFlag)).toBe(shown);
  expect(await side(panelFlag)).toBe('left inside');
  await page.mouse.move(0, 400);
  await page.evaluate(() => { document.querySelector('#panel-scene-title').style.textAlign = ''; });
  await expect.poll(() => tip(panelFlag)).toBe(hidden);
  await page.locator('.journey-row[data-scene="alice-1"]').focus();
  await page.keyboard.press('Tab');
  await expect.poll(() => tip(rowFlag)).toBe(shown);
  await page.locator('.scene-panel .detail-enter').click();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.reload();
  await expect(page.locator('#map-button')).toContainText('02');
  await page.goBack();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await page.goBack();
  await expect(page.locator('.library-page')).toBeVisible();
  await page.goForward();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#map-button')).toContainText('02');
  pass('The panel opens on the saved scene; history keeps the detail page between home and world');
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await page.locator('[data-book="oz"]').click();
  await expect(page.locator('#detail-title')).toHaveText('오즈의 마법사');
  await expect(page.locator('.journey-row')).toHaveCount(3);
  await page.locator('.scene-panel .detail-enter').click();
  await expect(page.locator('#world canvas')).toBeVisible();
  await expect(page).toHaveURL(/book=oz&chapter=oz-1/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  await page.locator('#trailer-button').click();
  await expect(page.locator('dialog video')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('video')).toHaveCount(0);
  pass('Both real books enter their own world; trailer opens and closes');

  await expect(page.locator('[data-rail="-1"]')).toBeDisabled();
  // The cover tile stays put while the arrows move the chapter cards beside it, and no card slides over it.
  await page.evaluate(() => document.querySelector('#scene-title').scrollIntoView({ block: 'start', behavior: 'instant' }));
  const place = () => page.locator('.scene-shelf').evaluate(shelf => {
    const cover = shelf.querySelector('.scene-cover'), box = cover.getBoundingClientRect();
    const hit = document.elementFromPoint(box.right - 4, box.top + box.height / 2);
    return { cover: Math.round(box.left), first: Math.round(shelf.querySelector('.scene-card').getBoundingClientRect().left), onTop: cover.contains(hit) };
  });
  const before = await place();
  await page.getByRole('button', { name: '다음 장면들', exact: true }).click();
  await expect.poll(() => page.locator('.scene-rail').evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await expect.poll(async () => (await place()).first).toBeLessThan(before.first);
  expect(await place()).toMatchObject({ cover: before.cover, onTop: true });
  await page.locator('.scene-rail').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('[data-rail="-1"]')).toBeDisabled();
  await page.locator('[data-scene-chapter="alice-3"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page).toHaveURL(/book=alice&scene=alice-3$/);
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page.locator('#detail-title')).toBeFocused();
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-3');
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('버섯 숲의 수수께끼');
  // The panel shows no story text and no placement list; previous and next sit right under the CTA as two buttons of
  // the same width and close the panel.
  await expect(page.locator('.scene-panel .reading-text, .scene-panel .detail-note, #panel-preview, .scene-panel .figure-list, #panel-figures')).toHaveCount(0);
  await expect(page.locator('.scene-panel > :last-child')).toHaveClass('neighbor-nav');
  await expect(page.locator('.scene-panel .neighbor-link').first()).toHaveAttribute('data-scene', 'alice-2');
  await expect(page.locator('.scene-panel .neighbor-link').last()).toHaveAttribute('data-scene', 'alice-4');
  await expect(page.locator('.scene-panel .neighbor-link')).toHaveText(['이전 장면', '다음 장면']);
  const buttons = await page.locator('.scene-panel').evaluate(panel => {
    const cta = panel.querySelector('.detail-enter').getBoundingClientRect();
    const [previous, next] = [...panel.querySelectorAll('.neighbor-nav > .neighbor-link')].map(link => link.getBoundingClientRect());
    return { gap: Math.round(previous.top - cta.bottom), row: Math.round(next.top - previous.top), widths: Math.round(previous.width - next.width), span: Math.round(next.right - previous.left - cta.width) };
  });
  expect(buttons.gap).toBeGreaterThanOrEqual(0);
  expect(buttons.gap).toBeLessThanOrEqual(20);
  expect(buttons).toMatchObject({ row: 0, widths: 0, span: 0 });
  await expect(page.locator('.detail-page img')).toHaveCount(0);
  await page.locator('.scene-panel .detail-enter').click();
  await expect(page.locator('#map-button')).toContainText('03');
  await expect(page).toHaveURL(/book=alice&chapter=alice-3/);
  await page.getByRole('button', { name: '책장으로', exact: true }).click();
  pass('Scene cards open the book detail on that scene and its CTA enters that chapter');
  // Picking a book in the scene previews swaps the tiles in place; the arrow keys move the pick like tabs.
  await page.getByRole('tab', { name: '오즈의 마법사', exact: true }).click();
  await expect(page.getByRole('tab', { name: '오즈의 마법사', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: '이상한 나라의 앨리스', exact: true })).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('#scene-shelf')).toHaveAttribute('aria-labelledby', 'scene-tab-1');
  await expect(page.locator('.scene-cover')).toHaveText('오즈의 마법사');
  await expect(page.locator('.scene-cover')).toHaveAttribute('href', '?book=oz');
  await expect(page.locator('.scene-card')).toHaveCount(3);
  await expect(page.locator('.scene-card').first()).toHaveAttribute('data-scene-chapter', 'oz-1');
  // Three chapters fit beside the cover, so there is nothing to scroll.
  await expect(page.locator('[data-rail="1"]')).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: '이상한 나라의 앨리스', exact: true })).toBeFocused();
  await expect(page.locator('.scene-card')).toHaveCount(6);
  await expect(page.locator('[data-rail="1"]')).toBeEnabled();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '오즈의 마법사', exact: true })).toBeFocused();
  await expect(page.locator('.scene-card')).toHaveCount(3);
  // The cover tile opens the book detail; coming back keeps the pick and puts the focus back on the tile.
  await page.locator('.scene-cover').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page).toHaveURL(/\?book=oz$/);
  await expect(page.locator('#detail-title')).toHaveText('오즈의 마법사');
  await page.locator('.site-header .brand').click();
  await expect(page.locator('.library-page')).toBeVisible();
  await expect(page.getByRole('tab', { name: '오즈의 마법사', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.scene-cover')).toBeFocused();
  await page.locator('[data-scene-chapter="oz-2"]').click();
  await expect(page).toHaveURL(/\?book=oz&scene=oz-2$/);
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('함께 걷는 숲');
  await page.locator('.site-header .brand').click();
  await expect(page.locator('[data-scene-chapter="oz-2"]')).toBeFocused();
  await page.getByRole('tab', { name: '이상한 나라의 앨리스', exact: true }).click();
  await expect(page.locator('.scene-card')).toHaveCount(6);
  pass('Book tabs swap the scene previews, and the pick and the focus survive a visit to the book detail');
  await page.getByRole('button', { name: '히어로 자동 재생 중지', exact: true }).click();
  if (await page.locator('.feature-card.is-active').getAttribute('data-feature-book') !== 'alice') {
    await page.getByRole('button', { name: '이전 추천 작품', exact: true }).click();
  }
  await page.locator('.feature-card.is-active').evaluate(element => element.click());
  await expect(page).toHaveURL(/\?book=alice$/);
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  // The book detail has no 책장으로 button; its logo goes back to the shelf.
  await page.locator('.site-header .brand').click();
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
  await page.locator('.site-header .brand').click();
  await expect(page.locator('.library-page')).toBeVisible();
  pass('The second hero slide opens its book detail');

  // The shared top works from the book detail too: Enter in its search box opens the book list with the
  // query kept, and the ribbon opens the bookshelf on the scene previews.
  await page.locator('[data-book="alice"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  // The page is inert until the curtain lifts.
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.locator('#book-search').fill('오즈');
  await page.locator('#book-search').press('Enter');
  await expect(page.locator('.browse-page')).toBeVisible();
  await expect(page.locator('#browse-status')).toContainText('검색 결과 1권');
  await expect(page.locator('.browse-card')).toHaveCount(1);
  await expect(page.locator('#book-search')).toHaveValue('오즈');
  await expect(page.locator('#book-search')).toBeFocused();
  expect(await page.locator('#book-search').getAttribute('tabindex')).toBe(null);
  await page.locator('#book-search').fill('');
  await expect(page.locator('.browse-card')).toHaveCount(2);
  await page.locator('[data-browse-book="alice"]').click();
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('.reader-curtain')).toHaveCount(0);
  await page.locator('.detail-top .reading-ribbon').click();
  await expect(page.locator('.library-page')).toBeVisible();
  await expect(page.locator('#scene-title')).toBeFocused();
  await expect(page.locator('#scene-title')).toBeInViewport();
  pass('From the book detail, the search box opens the book list and the ribbon opens the scene previews');

  // Direct addresses: first load resolves the view and cleans unusable parts. No focus move on a cold load.
  await page.goto(`${server.url}/client/?book=alice`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await expect(page).toHaveTitle('이상한 나라의 앨리스 — On the Book');
  // The book detail carries the bookshelf's header, search box included.
  await expect(page.locator('.detail-top .header-search')).toHaveCount(1);
  await page.goto(`${server.url}/client/?book=alice&scene=alice-2`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-2');
  await expect(page.locator('.scene-panel #panel-scene-title')).toHaveText('작아지는 문, 커지는 세계');
  await expect(page).toHaveTitle('이상한 나라의 앨리스 — On the Book');
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
  // Draft preview: an empty public shelf still lets the studio preview an unpublished book's detail by address.
  const draft = await (await fetch(`${server.url}/api/library`)).json();
  await page.route('**/api/studio', route => route.fulfill({ json: { library: { ...draft, books: draft.books.map(book => ({ ...book, published: false })) } } }));
  await page.goto(`${server.url}/client/?preview=draft`);
  await expect(page.getByText('새로운 이야기를 준비하고 있어요.')).toBeVisible();
  await page.goto(`${server.url}/client/?book=alice&preview=draft`);
  await expect(page.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('이상한 나라의 앨리스');
  await page.unroute('**/api/studio');
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

  // A long journey (18 chapters, intercepted response only): the panel is fixed at the screen's height, 24px clear above
  // and below, at the 400px grid (1440) and the 340px grid (1024). It holds the same place at the top, in the middle
  // and at the end of the page; its right edge meets the content box and the column gap stays clear.
  // Since then: the bookshelf top stays pinned and the panel, without a card, fills the screen from below that top to
  // the bottom edge, set apart from the left column by one line.
  const tall = {
    ...original,
    books: original.books.map(b => b.id !== 'alice' ? b : { ...b, chapters: [...b.chapters, ...b.chapters, ...b.chapters].map((c, i) => ({ ...c, id: `alice-tall-${i}` })) }),
  };
  for (const [width, height, panelWidth, gap] of [[1440, 1000, 400, 48], [1024, 800, 340, 32]]) {
    const grid = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const long = await grid.newPage();
    long.on('pageerror', error => errors.push(error.message));
    await long.route('**/api/library', route => route.fulfill({ json: tall }));
    await long.goto(`${server.url}/client/?book=alice`);
    await expect(long.locator('.journey-row')).toHaveCount(18);
    await expect(long.locator('.reader-curtain')).toHaveCount(0);
    // The panel slides in with the page; measure once it has settled.
    await long.waitForFunction(() => document.getAnimations().length === 0);
    expect(await long.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await long.locator('.journey-row').evaluateAll(rows => rows.every(row => row.scrollWidth <= row.clientWidth + 1))).toBe(true);
    const placement = () => long.evaluate(() => {
      const element = document.querySelector('.scene-panel'), panel = element.getBoundingClientRect(), style = getComputedStyle(element);
      const top = document.querySelector('.detail-top').getBoundingClientRect();
      const page = document.querySelector('.detail-page'), main = document.querySelector('.detail-main').getBoundingClientRect();
      const contentRight = page.getBoundingClientRect().right - parseFloat(getComputedStyle(page).paddingRight);
      return {
        pinned: Math.round(top.top), measured: getComputedStyle(page).getPropertyValue('--detail-top') === `${Math.round(top.height)}px`,
        top: Math.round(panel.top - top.bottom), bottom: Math.round(innerHeight - panel.bottom), width: Math.round(panel.width),
        right: Math.round(contentRight - panel.right), gap: Math.round(panel.left - main.right),
        line: style.borderLeftWidth, card: `${style.borderTopWidth} ${style.borderRightWidth} ${style.borderRadius}`,
      };
    });
    const fixed = { pinned: 0, measured: true, top: 0, bottom: 0, width: panelWidth, right: 0, gap, line: '1px', card: '0px 0px 0px' };
    expect(await placement()).toEqual(fixed);
    // Room above and below: the cover and the scene image share a top edge 72px under the pinned top, and the page
    // ends 120px after the last section.
    expect(await long.evaluate(() => {
      const top = document.querySelector('.detail-top').getBoundingClientRect().bottom;
      const main = document.querySelector('.detail-main').getBoundingClientRect();
      return {
        cover: Math.round(document.querySelector('.detail-hero').getBoundingClientRect().top - top),
        image: Math.round(document.querySelector('.scene-panel .scene-image').getBoundingClientRect().top - top),
        end: Math.round(document.documentElement.scrollHeight - (main.bottom + scrollY)),
      };
    })).toEqual({ cover: 72, image: 72, end: 120 });
    await long.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => long.evaluate(() => Math.round(scrollY))).toBe(400);
    expect(await placement()).toEqual(fixed);
    await long.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => long.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight)).toBe(true);
    expect(await placement()).toEqual(fixed);
    await grid.close();
  }
  pass('Under the pinned top, the scene panel fills the screen height beside a long journey at 1440px and 1024px');

  // Studio-managed images, slides and categories, again only in intercepted responses.
  const upload = c => `/uploads/${c.repeat(8)}-${c.repeat(4)}-${c.repeat(4)}-${c.repeat(4)}-${c.repeat(12)}.png`;
  const [alice, oz] = original.books;
  const managed = {
    ...original,
    books: [
      { ...alice, cover: upload('1'), thumbnail: upload('7'), chapters: alice.chapters.map((c, i) => i ? c : { ...c, thumbnail: upload('2') }) },
      { ...oz, category: '세계고전문학선집', cover: upload('8') },
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
  await expect(home.locator('[data-book="alice"] .catalog-cover img')).toHaveAttribute('src', upload('1'));
  await expect(home.locator('[data-book="oz"] .catalog-cover img')).toHaveAttribute('src', upload('8'));
  await expect(home.locator('.scene-image.has-image img')).toHaveCount(1);
  // The scene previews' tile shows the book's main thumbnail, not its cover; oz has a cover but no main thumbnail,
  // so its tile keeps the plain wash below.
  await expect(home.locator('.scene-cover.has-image img')).toHaveAttribute('src', upload('7'));
  await home.locator('.scene-image.has-image').scrollIntoViewIfNeeded();
  await expect.poll(() => loaded(home.locator('.catalog-cover img, .scene-image img, .scene-cover img'))).toBe(true);
  await home.locator('[data-scene-tab="alice"]').focus();
  await home.keyboard.press('ArrowRight');
  await expect(home.locator('.scene-cover')).toHaveText(oz.title);
  await expect(home.locator('.scene-cover img, .scene-image.has-image')).toHaveCount(0);
  await home.keyboard.press('Home');
  await expect(home.locator('.scene-image.has-image img')).toHaveCount(1);
  await home.evaluate(() => window.scrollTo(0, 0));
  await expect(home.locator('.feature-card')).toHaveCount(3);
  const first = home.locator('.feature-card.is-active');
  await expect(first).toHaveAttribute('data-feature-book', 'oz');
  await expect(first).toHaveClass(/feature-card--photo/);
  await expect(first.locator('.feature-kicker')).toHaveText('이번 주 추천');
  await expect(first.locator('.feature-copy > strong')).toHaveText('노란 길로 떠나요');
  await expect(first.locator('.feature-art')).toHaveCount(0);
  expect(await first.locator('.feature-copy > strong').evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  // The copy stays white while the pointer is over the photo.
  await first.hover();
  expect(await first.locator('.feature-copy > strong').evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  await home.mouse.move(0, 0);
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
  // The book detail shows the same studio cover, and its panel opens on the first chapter, which carries the thumbnail.
  await home.locator('[data-book="alice"]').click();
  await expect(home.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(home.locator('.detail-cover img')).toHaveCount(1);
  await expect.poll(() => loaded(home.locator('.detail-cover img'))).toBe(true);
  await expect(home.locator('.scene-panel .scene-image.has-image img')).toHaveCount(1);
  // In the panel a thumbnail keeps its 16:10 shape across the panel's full content width (400px column).
  const thumbBox = await home.locator('.scene-panel .scene-image.has-image').evaluate(element => {
    const r = element.getBoundingClientRect(), panel = element.closest('.scene-panel'), style = getComputedStyle(panel);
    return { width: r.width, height: r.height, content: panel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
  });
  expect(thumbBox.width).toBeGreaterThan(300);
  expect(Math.round(thumbBox.width)).toBe(Math.round(thumbBox.content));
  expect(Math.abs(thumbBox.width / thumbBox.height - 1.6)).toBeLessThan(0.02);
  await expect.poll(() => loaded(home.locator('.scene-panel .scene-image img'))).toBe(true);
  await home.screenshot({ path: 'test-results/catalog/managed-book-detail.png' });
  // Another scene has no thumbnail: the slot goes back to the theme tint.
  await home.locator('.journey-row[data-scene="alice-2"]').click();
  await expect(home.locator('.scene-panel .scene-image.has-image')).toHaveCount(0);
  await expect(home.locator('.scene-panel .scene-image[data-theme="night"]')).toHaveCount(1);
  await home.locator('.site-header .brand').click();
  await expect(home.locator('.library-page')).toBeVisible();
  await home.locator('a.scene-card', { has: home.locator('.scene-image.has-image') }).click();
  await expect(home.locator('.detail-page[data-view="book"]')).toBeVisible();
  await expect(home.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'alice-1');
  await expect(home.locator('.scene-panel .scene-image.has-image img')).toHaveCount(1);
  await home.locator('.site-header .brand').click();
  await expect(home.locator('.library-page')).toBeVisible();
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
    // The whole home stays under a genre, so the quick menu's genre lands on the book section, which may start below the fold.
    await mobile.getByRole('button', { name: '모험 도서 보기', exact: true }).tap();
    await expect(mobile.locator('.catalog-card')).toHaveCount(1);
    await expect(mobile.locator('#catalog-title')).toBeInViewport();
    await expect(mobile.locator('.scene-section')).toBeVisible();
    await mobile.getByRole('button', { name: '전체', exact: true }).tap();
    await expect(mobile.locator('.catalog-card')).toHaveCount(2);
    await mobile.locator('[data-book="oz"]').tap();
    await expect(mobile.locator('.detail-page[data-view="book"]')).toBeVisible();
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
    await expect(mobile.locator('.scene-panel')).toBeHidden();
    await expect(mobile.locator('.detail-cta-scene')).toContainText('01');
    // The pinned bar must be reachable without scrolling and span the full width at every one-column size.
    const measure = () => mobile.locator('.detail-cta .primary-button').evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(x, y)) };
    });
    const cta = await measure();
    expect(cta.visible).toBe(true);
    expect(cta.reachable).toBe(true);
    const bar = await mobile.locator('.detail-cta').evaluate(element => {
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, width: innerWidth };
    });
    expect(bar.left).toBe(0);
    expect(bar.right).toBe(bar.width);
    // Room at both ends: 44px under the top, and at the end of the page 64px between the last section and the bar,
    // which then rests on the bottom edge instead of lifting.
    const room = await mobile.evaluate(async () => {
      await Promise.all(document.querySelector('.detail-hero').getAnimations().map(animation => animation.finished));
      const cover = document.querySelector('.detail-hero').getBoundingClientRect().top - document.querySelector('.detail-top').getBoundingClientRect().bottom;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const last = document.querySelector('.detail-main > :last-child').getBoundingClientRect(), bar = document.querySelector('.detail-cta').getBoundingClientRect();
      const result = { cover: Math.round(cover), gap: Math.round(bar.top - last.bottom), floor: Math.round(innerHeight - bar.bottom) };
      window.scrollTo(0, 0);
      return result;
    });
    expect(room).toEqual({ cover: 44, gap: 64, floor: 0 });
    // A journey row opens the scene sheet with the same panel content and moves the bar to that scene.
    const ozChapters = original.books.find(b => b.id === 'oz').chapters;
    await mobile.locator('.journey-row[data-scene="oz-2"]').tap();
    await expect(mobile.locator('dialog.scene-sheet[open] #sheet-scene-title')).toHaveText(ozChapters[1].title);
    await expect(mobile.locator('.detail-cta-scene')).toContainText('02');
    await expect(mobile).toHaveURL(/scene=oz-2$/);
    // The sheet's own neighbour links move the sheet, the journey selection and the bar together; focus follows.
    await mobile.locator('dialog.scene-sheet .neighbor-link[data-scene="oz-3"]').tap();
    await expect(mobile.locator('dialog.scene-sheet[open] #sheet-scene-title')).toHaveText(ozChapters[2].title);
    await expect(mobile.locator('.journey-row[aria-current="true"]')).toHaveAttribute('data-scene', 'oz-3');
    await expect(mobile.locator('.detail-cta-scene')).toContainText('03');
    await expect(mobile).toHaveURL(/scene=oz-3$/);
    await expect(mobile.locator('dialog.scene-sheet .detail-enter')).toBeFocused();
    await mobile.locator('dialog.scene-sheet .neighbor-link[data-scene="oz-2"]').tap();
    await expect(mobile.locator('dialog.scene-sheet[open] #sheet-scene-title')).toHaveText(ozChapters[1].title);
    await expect(mobile.locator('dialog.scene-sheet .neighbor-link[data-scene="oz-1"]')).toBeFocused();
    // The sheet's CTA closes the sheet and enters that scene.
    await mobile.locator('dialog.scene-sheet .detail-enter').tap();
    await expect(mobile.locator('#world canvas')).toBeVisible();
    await expect(mobile.locator('dialog.scene-sheet')).toHaveCount(0);
    await expect(mobile).toHaveURL(/chapter=oz-2/);
    await expect(mobile.locator('.reader-curtain')).toHaveCount(0);
    const target = await mobile.locator('#next-chapter').evaluate(element => {
      const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return { x, y, visible: r.top >= 0 && r.bottom <= innerHeight, reachable: element.contains(document.elementFromPoint(x, y)) };
    });
    expect(target.visible).toBe(true);
    expect(target.reachable).toBe(true);
    await mobile.touchscreen.tap(target.x, target.y);
    await expect(mobile.locator('#map-button')).toContainText('03');
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
