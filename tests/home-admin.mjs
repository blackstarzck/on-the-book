import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { startServer } from './helpers.js';

const server = await startServer();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
context.setDefaultTimeout(20000);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pass = message => console.log(`PASS ${message}`);
await mkdir('test-results/home-admin', { recursive: true });
// A PNG drawn by the browser, handed to a file input like a real upload.
const png = (width, height, color) => page.evaluate(([w, h, c]) => {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = c; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff55'; g.fillRect(w * .55, h * .2, w * .3, h * .6);
  return canvas.toDataURL('image/png').split(',')[1];
}, [width, height, color]).then(data => ({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }));
const studio = async () => (await (await page.request.get(`${server.url}/api/studio`)).json()).library;
const live = async () => (await page.request.get(`${server.url}/api/library`)).json();
const saved = async button => { await page.locator(button).click(); await expect(page.locator('#save-state')).toHaveText(button === '#publish' ? '공개 완료' : '변경사항 저장됨'); };
const shelfOrder = () => page.locator('[data-book-row]').evaluateAll(rows => rows.map(row => row.dataset.bookRow));
try {
  await page.goto(`${server.url}/admin/`);
  await expect(page.locator('.book-tile')).toHaveCount(2);
  await expect(page.locator('#save-state')).toHaveText('변경사항 저장됨');

  await page.locator('[data-open-book="alice"]').click();
  await page.locator('#edit-book').click();
  const category = page.getByLabel('분류', { exact: true });
  await expect(category).toHaveValue('판타지');
  await page.locator('#book-cover-file').setInputFiles(await png(400, 570, '#6b8f71'));
  await expect(page.locator('#book-cover-status')).toContainText('업로드 완료');
  await expect(page.locator('#book-cover-preview')).toBeVisible();
  await page.locator('#book-thumbnail-file').setInputFiles(await png(600, 600, '#8a5d9c'));
  await expect(page.locator('#book-thumbnail-status')).toContainText('업로드 완료');
  await expect(page.locator('#book-thumbnail-preview')).toBeVisible();
  const authorIntro = '옥스퍼드의 수학 강사였어요.\n아이들에게 이야기를 들려주곤 했어요.\n\n본명은 찰스 럿위지 도지슨이에요.';
  const bookIntro = '흰 토끼를 따라 굴에 떨어진 앨리스의 이야기예요.';
  await page.getByLabel('저자 소개', { exact: true }).fill(authorIntro);
  await page.getByLabel('책 소개', { exact: true }).fill(bookIntro);
  await category.fill('all');
  await page.locator('#book-form button[type="submit"]').click();
  await expect(page.locator('#book-form')).toBeVisible();
  await category.fill('고전');
  await page.locator('#book-form button[type="submit"]').click();
  await expect(page.locator('#book-form')).toHaveCount(0);
  await page.locator('[data-chapter-edit="alice-1"]').click();
  await page.locator('#chapter-thumbnail-file').setInputFiles(await png(640, 400, '#b7894f'));
  await expect(page.locator('#chapter-thumbnail-status')).toContainText('업로드 완료');
  await page.locator('#chapter-form .primary-button').click();
  await saved('#save');
  let draft = await studio();
  const alice = draft.books.find(b => b.id === 'alice');
  expect(alice.category).toBe('고전');
  expect(alice.cover).toMatch(/^\/uploads\/.+\.png$/);
  expect(alice.thumbnail).toMatch(/^\/uploads\/.+\.png$/);
  expect(alice.thumbnail).not.toBe(alice.cover);
  expect(alice.chapters[0].thumbnail).toMatch(/^\/uploads\/.+\.png$/);
  expect([alice.authorIntro, alice.bookIntro]).toEqual([authorIntro, bookIntro]);
  await page.locator('#back-library').click();
  await expect(page.locator('.book-shelf')).toBeVisible();
  pass('Cover, main thumbnail, category (reserved names refused), intros and chapter thumbnail are edited and saved');

  await page.locator('[data-book-drag="alice"]').focus();
  await page.keyboard.press('Alt+ArrowRight');
  expect(await shelfOrder()).toEqual(['oz', 'alice']);
  await expect(page.locator('[data-book-drag="alice"]')).toBeFocused();
  await page.locator('[data-book-drag="alice"]').dragTo(page.locator('[data-book-row="oz"]'), { targetPosition: { x: 20, y: 12 } });
  expect(await shelfOrder()).toEqual(['alice', 'oz']);
  // Dropping outside the list must not change the order.
  await page.locator('[data-book-drag="alice"]').dragTo(page.locator('.library-filter'), { targetPosition: { x: 20, y: 12 } });
  expect(await shelfOrder()).toEqual(['alice', 'oz']);
  await page.locator('[data-book-drag="alice"]').dragTo(page.locator('[data-book-row="alice"]'), { targetPosition: { x: 200, y: 40 } });
  expect(await shelfOrder()).toEqual(['alice', 'oz']);
  await page.locator('[data-book-drag="oz"]').dragTo(page.locator('[data-book-row="alice"]'), { targetPosition: { x: 20, y: 12 } });
  expect(await shelfOrder()).toEqual(['oz', 'alice']);
  await page.locator('#book-search').fill('앨리스');
  await expect(page.locator('.book-shelf')).toHaveClass(/is-filtered/);
  await expect(page.locator('[data-book-drag="alice"]')).toBeDisabled();
  await expect(page.locator('[data-book-row="oz"]')).toBeHidden();
  await page.locator('#book-search').fill('');
  await expect(page.locator('[data-book-drag="alice"]')).toBeVisible();
  pass('Books reorder by keyboard and vertical dragging; outside drops and filtered shelves do not reorder');

  await page.getByRole('button', { name: '홈 화면', exact: true }).click();
  await expect(page.locator('.home-slides .inline-empty')).toContainText('오즈의 마법사, 이상한 나라의 앨리스');
  await page.locator('#add-slide').click();
  await expect(page.locator('[data-slide]')).toHaveCount(1);
  await expect(page.getByLabel('연결 책', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('사진 초점', { exact: true })).toHaveCount(0);
  await page.locator('[name="url"]').fill('/about');
  await page.locator('#slide-0-pc-file').setInputFiles(await png(2784, 800, '#2f5d4a'));
  await expect(page.locator('#slide-0-pc-frames')).toBeVisible();
  await page.locator('#slide-0-mobile-file').setInputFiles(await png(654, 720, '#9a613c'));
  await expect(page.locator('#slide-0-mobile-frames')).toBeVisible();
  const pcImage = await page.locator('#slide-0-pc-preview').getAttribute('src');
  const mobileImage = await page.locator('#slide-0-mobile-preview').getAttribute('src');
  const first = page.locator('[data-slide]').first();
  await first.getByLabel('작은 문구', { exact: true }).fill('이번 주 추천');
  await first.getByLabel('제목', { exact: true }).fill('노란 길로 떠나요');
  await first.getByLabel('설명', { exact: true }).fill('용기와 지혜를 찾아 걷는 길');
  await first.getByLabel('설명', { exact: true }).blur();
  await expect(page.locator('#save-state')).toHaveText('저장하지 않은 변경사항');
  await page.locator('#add-slide').click();
  await page.locator('[data-slide]').nth(1).getByLabel('이동 URL', { exact: true }).fill('/client/?book=alice');
  await page.locator('#slide-1-pc-file').setInputFiles(await png(2784, 800, '#4a638c'));
  await expect(page.locator('#slide-1-pc-status')).toHaveText('업로드 완료');
  await page.locator('#slide-1-mobile-file').setInputFiles(await png(654, 720, '#8c4a72'));
  await expect(page.locator('#slide-1-mobile-status')).toHaveText('업로드 완료');
  await page.locator('[data-slide]').nth(1).locator('[data-slide-move="-1"]').click();
  await expect(page.locator('[data-slide]').first().getByLabel('이동 URL', { exact: true })).toHaveValue('/client/?book=alice');
  await expect(page.locator('#slide-1-pc-frames')).toBeVisible();
  // First in line, the moved slide's up arrow is disabled, so focus lands on its down arrow.
  await expect(page.locator('[data-slide]').first().locator('[data-slide-move="1"]')).toBeFocused();
  await page.locator('[data-slide]').nth(1).locator('[data-slide-move="-1"]').click();
  await expect(page.locator('[data-slide]').first().getByLabel('이동 URL', { exact: true })).toHaveValue('/about');
  await page.screenshot({ path: 'test-results/home-admin/home-tab.png', fullPage: true });
  pass('Home tab adds, fills, uploads and reorders hero slides');

  await page.locator('#preview-home').click();
  const frame = page.frameLocator('iframe[title="공개 전 독자 화면"]');
  await expect(frame.locator('.feature-card.is-active')).toHaveAttribute('href', '/about?preview=draft');
  await expect(frame.locator('.feature-card.is-active')).toHaveClass(/feature-card--photo/);
  await expect(frame.locator('.feature-card.is-active .feature-kicker')).toHaveText('이번 주 추천');
  await expect(frame.locator('.catalog-card')).toHaveCount(2);
  await expect(frame.locator('.catalog-card').first().locator('[data-book]')).toHaveAttribute('data-book', 'oz');
  await expect(frame.locator('[data-book="alice"] .catalog-cover img')).toHaveCount(1);
  await page.locator('#preview-mobile').click();
  expect((await page.locator('iframe').boundingBox()).width).toBe(390);
  await expect.poll(() => frame.locator('.feature-card.is-active .feature-photo').evaluate(img => new URL(img.currentSrc).pathname)).toBe(mobileImage);
  await page.locator('.client-preview-dialog .close-modal').click();
  expect((await live()).home.hero).toEqual([]);
  pass('Home preview saves first and shows the draft home, while the public home is unchanged');

  await expect(page).toHaveURL(`${server.url}/admin/home`);
  await page.reload();
  await expect(page.locator('[data-slide]').first().getByLabel('이동 URL', { exact: true })).toHaveValue('/about');
  await expect(page.locator('#slide-0-mobile-preview')).toHaveAttribute('src', mobileImage);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/home-admin/admin-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await saved('#publish');
  let published = await live();
  expect(published.books.map(b => b.id)).toEqual(['oz', 'alice']);
  expect(published.home.hero.map(s => [s.url, s.kicker, s.title])).toEqual([['/about', '이번 주 추천', '노란 길로 떠나요'], ['/client/?book=alice', '', '']]);
  const reader = await context.newPage();
  reader.on('pageerror', error => errors.push(error.message));
  await reader.goto(`${server.url}/client/`);
  await expect(reader.locator('.feature-card.is-active')).toHaveAttribute('href', '/about');
  await expect(reader.locator('.feature-card.is-active .feature-copy > strong')).toHaveText('노란 길로 떠나요');
  await expect(reader.locator('.catalog-card').first().locator('[data-book]')).toHaveAttribute('data-book', 'oz');
  await expect(reader.locator('[data-book="alice"] .catalog-cover img')).toHaveCount(1);
  for (const width of [1440, 768, 601, 600, 390, 360]) {
    await reader.setViewportSize({ width, height: 900 });
    const mobile = width <= 600;
    await expect.poll(() => reader.locator('.feature-card.is-active .feature-photo').evaluate(img => new URL(img.currentSrc).pathname)).toBe(mobile ? mobileImage : pcImage);
    const box = await reader.locator('.feature-grid').boundingBox();
    expect(Math.abs(box.width / box.height - (mobile ? 654 / 720 : 2784 / 800))).toBeLessThan(.01);
    expect(await reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if ([1440, 390].includes(width)) await reader.screenshot({ path: 'test-results/home-admin/home-' + width + '.png', fullPage: true });
  }
  await reader.setViewportSize({ width: 1440, height: 1000 });
  const bannerBox = await reader.locator('.feature-grid').boundingBox();
  await reader.mouse.move(bannerBox.x + bannerBox.width * .7, bannerBox.y + 60);
  await reader.mouse.down();
  await reader.mouse.move(bannerBox.x + bannerBox.width * .3, bannerBox.y + 60, { steps: 8 });
  await reader.mouse.up();
  await expect(reader.locator('.feature-card.is-active')).toHaveAttribute('href', '/client/?book=alice');
  await expect(reader).toHaveURL(/\/client\/$/);
  await reader.locator('[data-feature-direction="-1"]').click();
  await reader.locator('[data-feature-direction="1"]').click();
  await expect(reader.locator('.feature-card.is-active')).toHaveClass(/feature-card--image-only/);
  await reader.locator('.feature-card.is-active').click();
  await expect(reader).toHaveURL(/book=alice/);
  await expect(reader.locator('.detail-page')).toBeVisible();
  await reader.goto(server.url + '/client/');
  pass('Desktop/mobile sources, image ratios, blank copy and internal link navigation work');
  // The scene previews open on the first book (now oz); the thumbnail belongs to alice's first chapter.
  await expect(reader.locator('[data-scene-tab="oz"]')).toHaveAttribute('aria-selected', 'true');
  await reader.locator('[data-scene-tab="alice"]').click();
  await expect(reader.locator('.scene-image.has-image img')).toHaveCount(1);
  // The scene previews' tile shows alice's main thumbnail rather than her cover.
  await expect(reader.locator('.scene-cover img')).toHaveAttribute('src', alice.thumbnail);
  await expect(reader.locator('.catalog-filters [data-category="고전"]')).toBeVisible();
  pass('Publishing brings the order, cover, main thumbnail, chapter thumbnail, category and slides to readers');

  const detail = await context.newPage();
  detail.on('pageerror', error => errors.push(error.message));
  await detail.goto(`${server.url}/client/?book=alice`);
  await expect(detail.locator('#detail-author h2')).toHaveText('저자 소개');
  await expect(detail.locator('#detail-author .detail-intro-name')).toHaveText('루이스 캐럴');
  await expect(detail.locator('#detail-author .detail-prose p')).toHaveCount(2);
  // innerText follows the rendering, so the kept line break proves `white-space: pre-line`.
  expect(await detail.locator('#detail-author .detail-prose p').first().evaluate(p => p.innerText)).toBe('옥스퍼드의 수학 강사였어요.\n아이들에게 이야기를 들려주곤 했어요.');
  await expect(detail.locator('#detail-book-intro .detail-prose p')).toHaveText([bookIntro]);
  expect(await detail.locator('#detail-journey, .detail-intro').evaluateAll(sections => sections.map(s => s.id))).toEqual(['detail-journey', 'detail-author', 'detail-book-intro']);
  // 책 소개 closes the left column: the book detail no longer shows the 원작 정보 section.
  await expect(detail.locator('.detail-main > :last-child')).toHaveId('detail-book-intro');
  await expect(detail.locator('.detail-source')).toHaveCount(0);
  await expect(detail.locator('.detail-intro-empty')).toHaveCount(0);
  // Oz was published with both intros left empty.
  await detail.goto(`${server.url}/client/?book=oz`);
  await expect(detail.locator('#detail-author .detail-intro-name')).toHaveText('L. 프랭크 바움');
  await expect(detail.locator('#detail-author .detail-intro-empty')).toHaveText('저자 소개를 준비 중이에요.');
  await expect(detail.locator('#detail-book-intro .detail-intro-empty')).toHaveText('책 소개를 준비 중이에요.');
  await expect(detail.locator('.detail-prose')).toHaveCount(0);
  await detail.close();
  pass('The published intros follow the journey on the book detail, author first; empty ones say 준비 중');

  await page.locator('[data-slide]').nth(1).locator('[data-slide-remove]').click();
  await page.locator('#confirm-action').click();
  await expect(page.locator('[data-slide]')).toHaveCount(1);
  await page.getByRole('button', { name: '도서 보관함', exact: true }).click();
  await page.locator('[data-open-book="oz"]').click();
  await page.locator('#edit-book').click();
  await page.getByLabel('사용자 화면 공개 대상에 포함').uncheck();
  await page.locator('#book-form button[type="submit"]').click();
  await saved('#publish');
  published = await live();
  expect(published.books.map(b => b.id)).toEqual(['alice']);
  expect(published.home.hero.map(slide => slide.url)).toEqual(['/about']);
  await reader.reload();
  await expect(reader.locator('.feature-card')).toHaveCount(1);
  await expect(reader.locator('.feature-card.is-active')).toHaveAttribute('href', '/about');
  await expect(reader.locator('.feature-card.is-active .feature-photo')).toHaveCount(1);
  await expect(reader.locator('.feature-arrow')).toHaveCount(0);
  await page.locator('#back-library').click();
  await page.getByRole('button', { name: '홈 화면', exact: true }).click();
  await expect(page.locator('.slide-warning')).toHaveCount(0);
  pass('Unpublishing a book leaves the independent service banner intact');

  await page.getByRole('button', { name: '도서 보관함', exact: true }).click();
  await page.locator('[data-open-book="oz"]').click();
  await page.locator('#edit-book').click();
  await page.locator('#delete-book').click();
  await page.locator('#confirm-action').click();
  await saved('#save');
  draft = await studio();
  expect(draft.books.map(b => b.id)).toEqual(['alice']);
  expect(draft.home.hero.map(slide => slide.url)).toEqual(['/about']);
  pass('Deleting a book does not remove an independent banner');
  const empty = await (await page.request.get(`${server.url}/api/studio`)).json();
  empty.library.books = [];
  empty.library.models = [];
  const withoutBooks = await page.request.put(`${server.url}/api/studio`, {
    headers: { 'X-On-The-Book': 'studio' }, data: { ...empty, publish: true },
  });
  expect(withoutBooks.ok()).toBe(true);
  await reader.reload();
  await expect(reader.locator('.feature-card.is-active')).toHaveAttribute('href', '/about');
  await expect(reader.locator('.catalog-empty')).toBeVisible();
  await page.goto(`${server.url}/admin/home`);
  await expect(page.locator('#add-slide')).toBeEnabled();
  await page.locator('#add-slide').click();
  await expect(page.locator('[data-slide]')).toHaveCount(2);
  pass('Banners remain visible and can be added even with no books');
  expect(errors).toEqual([]);
  pass('No page errors');
} finally {
  await browser.close();
  await server.stop();
}
