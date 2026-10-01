import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { heroFocus, imageSlots } from '../shared/image-slots.js';
import { startServer } from './helpers.js';

// The studio shows each picture in the frames readers see it in (shared/image-slots.js), and beside the category the
// quick-menu icon readers get. The reader half measures the published pictures against the same table, so a frame
// changed in the reader's CSS fails here until the table, and with it the studio's preview, follows.
const server = await startServer();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
context.setDefaultTimeout(20000);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pass = message => console.log(`PASS ${message}`);
const shots = 'test-results/studio-previews';
await mkdir(shots, { recursive: true });
// A PNG drawn by the browser, handed to a file input like a real upload. The bars mark its edges, so a screenshot
// shows what a frame cut off.
const png = (width, height, color) => page.evaluate(([w, h, c]) => {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = c; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffe066'; const bar = Math.round(Math.min(w, h) * .06);
  g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar); g.fillRect(0, 0, bar, h); g.fillRect(w - bar, 0, bar, h);
  g.strokeStyle = '#ffffff'; g.lineWidth = bar / 2; g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) * .2, 0, Math.PI * 2); g.stroke();
  return canvas.toDataURL('image/png').split(',')[1];
}, [width, height, color]).then(data => ({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') }));
// The shape a picture is shown in, the point its crop keeps and the file, for a studio frame or a reader image.
const box = image => image.evaluate(img => {
  const r = (img.closest('.crop-box') || img).getBoundingClientRect();
  return { ratio: r.width / r.height, position: getComputedStyle(img).objectPosition, src: new URL(img.currentSrc || img.src).pathname };
});
const near = (actual, expected, what) => expect(Math.abs(actual / expected - 1), `${what}: ${actual.toFixed(3)} vs ${expected.toFixed(3)}`).toBeLessThan(.02);
async function expectFrames(root, key, slots, src, focus) {
  const frames = root.locator(`#${key}-frames`);
  await expect(frames).toBeVisible();
  await expect(frames.locator('[data-slot]')).toHaveCount(slots.length);
  for (const slot of slots) {
    const frame = await box(frames.locator(`[data-slot="${slot.id}"] img`));
    near(frame.ratio, slot.ratio, `studio ${key} ${slot.id}`);
    expect(frame.position).toBe(slot.position || heroFocus[focus]);
    expect(frame.src).toBe(src);
    await expect(frames.locator(`[data-slot="${slot.id}"] small`)).toHaveText(`${slot.label} · ${slot.ratioLabel}`);
  }
}
// Where the reader shows each slot of shared/image-slots.js: the page and the image.
const readerPlaces = {
  cover: {
    shelf: [['/client/', '[data-book="alice"] .catalog-cover img'], ['/client/?book=alice', '.detail-cover img']],
  },
  bookThumbnail: {
    scene: [['/client/', '.scene-cover img']],
    'scene-phone': [['/client/', '.scene-cover img']],
  },
  chapterThumbnail: {
    card: [['/client/', '[data-scene-chapter="alice-1"] .scene-image img']],
    panel: [['/client/?book=alice', '.scene-panel .scene-image img']],
  },
  heroMobile: { phone: [['/client/', '.feature-card.is-active .feature-photo']] },
  hero: Object.fromEntries(['wide', 'tablet'].map(id => [id, [['/client/', '.feature-card.is-active .feature-photo']]])),
};
try {
  await page.goto(`${server.url}/admin/`);
  await expect(page.locator('.book-tile')).toHaveCount(2);
  await page.getByRole('button', { name: '공개 및 안내', exact: true }).click();
  await expect(page.locator('.settings-grid')).toContainText('이 서버의 데이터 폴더에 기록되며');
  await expect(page.locator('.settings-grid')).not.toContainText('운영 사용자 화면과 같은 저장소');
  pass('The settings page says where this studio saves (a test server keeps a data folder)');

  await page.getByRole('button', { name: '도서 보관함', exact: true }).click();
  await page.locator('[data-open-book="alice"]').click();
  await page.locator('#edit-book').click();
  const form = page.locator('#book-form');
  await expect(page.locator('#book-cover-frames')).toBeHidden();
  const icon = page.locator('#book-category-icon');
  const fantasyIcon = await icon.getAttribute('src');
  await form.getByLabel('분류', { exact: true }).fill('고전');
  const defaultIcon = await icon.getAttribute('src');
  expect(defaultIcon).not.toBe(fantasyIcon);
  await form.getByLabel('분류', { exact: true }).fill('판타지');
  await expect(icon).toHaveAttribute('src', fantasyIcon);
  await expect(page.locator('#book-thumbnail-frames')).toBeHidden();
  await page.locator('#book-cover-file').setInputFiles(await png(800, 1140, '#3d7f68'));
  await expect(page.locator('#book-cover-status')).toHaveText('업로드 완료');
  // The hint stays under the picture after the upload.
  await expect(form.locator('.image-field').first().locator('.field-hint')).toContainText('2:2.85');
  const cover = await page.locator('#book-cover-preview').getAttribute('src');
  await expectFrames(page, 'book-cover', imageSlots.cover, cover);
  // The main thumbnail is a picture of its own, not the cover.
  await expect(page.locator('#book-thumbnail-frames')).toBeHidden();
  await page.locator('#book-thumbnail-file').setInputFiles(await png(1200, 1200, '#6d4f8f'));
  await expect(page.locator('#book-thumbnail-status')).toHaveText('업로드 완료');
  await expect(form.locator('.image-field').nth(1).locator('.field-hint')).toContainText('정사각형');
  const bookThumbnail = await page.locator('#book-thumbnail-preview').getAttribute('src');
  expect(bookThumbnail).not.toBe(cover);
  await expectFrames(page, 'book-thumbnail', imageSlots.bookThumbnail, bookThumbnail);
  // Its frames carry the book title as typed, as the scene previews' tile does.
  await expect(page.locator('#book-thumbnail-frames b')).toHaveText(['이상한 나라의 앨리스', '이상한 나라의 앨리스']);
  await form.getByLabel('책 제목', { exact: true }).fill('앨리스');
  await expect(page.locator('#book-thumbnail-frames b')).toHaveText(['앨리스', '앨리스']);
  await form.getByLabel('책 제목', { exact: true }).fill('이상한 나라의 앨리스');
  await page.locator('.modal').screenshot({ path: `${shots}/studio-cover.png` });
  await page.locator('#book-thumbnail-frames').scrollIntoViewIfNeeded();
  await page.locator('.modal').screenshot({ path: `${shots}/studio-book-thumbnail.png` });
  await page.locator('#book-form button[type="submit"]').click();
  await expect(form).toHaveCount(0);
  // Reopened, the dialog shows the stored pictures in the same frames.
  await page.locator('#edit-book').click();
  await expectFrames(page, 'book-cover', imageSlots.cover, cover);
  await expectFrames(page, 'book-thumbnail', imageSlots.bookThumbnail, bookThumbnail);
  await page.locator('.modal .close-modal').click();
  pass('The cover and the main thumbnail show in the reader\'s frames, with the typed title, and the category shows its quick-menu icon');

  await page.locator('[data-chapter-edit="alice-1"]').click();
  await expect(page.locator('#chapter-thumbnail-frames')).toBeHidden();
  await page.locator('#chapter-thumbnail-file').setInputFiles(await png(1280, 800, '#9a6a3c'));
  await expect(page.locator('#chapter-thumbnail-status')).toHaveText('업로드 완료');
  await expect(page.locator('#chapter-form .image-field .field-hint')).toContainText('가운데 정사각형');
  const thumbnail = await page.locator('#chapter-thumbnail-preview').getAttribute('src');
  await expectFrames(page, 'chapter-thumbnail', imageSlots.chapterThumbnail, thumbnail);
  await page.locator('.modal').screenshot({ path: `${shots}/studio-thumbnail.png` });
  // Clearing hides the frames with the picture.
  await page.locator('#chapter-thumbnail-clear').click();
  await expect(page.locator('#chapter-thumbnail-frames')).toBeHidden();
  await page.locator('#chapter-thumbnail-file').setInputFiles(await png(1280, 800, '#9a6a3c'));
  await expect(page.locator('#chapter-thumbnail-frames')).toBeVisible();
  const uploaded = await page.locator('#chapter-thumbnail-preview').getAttribute('src');
  await page.locator('#chapter-form .primary-button').click();
  await expect(page.locator('#chapter-form')).toHaveCount(0);
  pass('A chapter thumbnail shows in the home card and scene panel frames; clearing it hides them');

  await page.locator('#save').click();
  await expect(page.locator('#save-state')).toHaveText('변경사항 저장됨');
  await page.locator('#back-library').click();
  await page.getByRole('button', { name: '홈 화면', exact: true }).click();
  await page.locator('#add-slide').click();
  await page.getByLabel('이동 URL', { exact: true }).fill('/about');
  await page.locator('#slide-0-pc-file').setInputFiles(await png(2784, 800, '#2f5d4a'));
  await expect(page.locator('#slide-0-pc-frames')).toBeVisible();
  const photo = await page.locator('#slide-0-pc-preview').getAttribute('src');
  await expectFrames(page, 'slide-0-pc', imageSlots.hero.slice(0, 1), photo);
  await page.locator('#slide-0-mobile-file').setInputFiles(await png(654, 720, '#6a3c9a'));
  await expect(page.locator('#slide-0-mobile-frames')).toBeVisible();
  const mobilePhoto = await page.locator('#slide-0-mobile-preview').getAttribute('src');
  await expectFrames(page, 'slide-0-mobile', imageSlots.heroMobile, mobilePhoto);
  await page.locator('[data-slide]').first().screenshot({ path: shots + '/studio-hero.png' });
  pass('PC and mobile artwork have separate uploads and matching previews');

  await page.locator('#publish').click();
  await expect(page.locator('#save-state')).toHaveText('공개 완료');
  const reader = await context.newPage();
  reader.on('pageerror', error => errors.push(error.message));
  const files = { cover, bookThumbnail, chapterThumbnail: uploaded, hero: photo, heroMobile: mobilePhoto };
  for (const [kind, slots] of Object.entries(imageSlots)) for (const slot of slots) {
    const places = readerPlaces[kind][slot.id];
    expect(places, `reader place for ${kind} ${slot.id}`).toBeTruthy();
    await reader.setViewportSize({ width: slot.viewport, height: 900 });
    for (const [path, selector] of places) {
      await reader.goto(server.url + path);
      const shown = await box(reader.locator(selector).first());
      near(shown.ratio, slot.ratio, `reader ${kind} ${slot.id} at ${slot.viewport}px (${selector})`);
      expect(shown.position).toBe(slot.position || heroFocus.right);
      expect(shown.src).toBe(files[kind]);
    }
  }
  await reader.setViewportSize({ width: 1440, height: 900 });
  await reader.goto(`${server.url}/client/`);
  await expect(reader.locator('[data-quick-category="판타지"] img')).toHaveAttribute('src', fantasyIcon);
  await expect(reader.locator('[data-quick-view="all"] img')).toHaveAttribute('src', defaultIcon);
  pass('Readers see every picture in the frame the studio showed, and the category icon it showed');
  expect(errors).toEqual([]);
  pass('No page errors');
} finally {
  await browser.close();
  await server.stop();
}
