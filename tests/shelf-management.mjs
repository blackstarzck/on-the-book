import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { startServer } from './helpers.js';

const server = await startServer();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const row = id => page.locator(`[data-book-row="${id}"]`);
const order = () => page.locator('[data-book-row]').evaluateAll(rows => rows.map(row => row.dataset.bookRow));
const draft = async () => (await page.request.get(server.url + '/api/studio')).json();
const live = async () => (await page.request.get(server.url + '/api/library')).json();
const save = async publish => {
  await page.locator(publish ? '#publish' : '#save').click();
  await expect(page.locator('#save-state')).toHaveText(publish ? '공개 완료' : '변경사항 저장됨');
};
const write = async data => {
  const response = await page.request.put(server.url + '/api/studio', {
    headers: { 'X-On-The-Book': 'studio' }, data: { library: data.library, version: data.version, publish: false },
  });
  expect(response.ok(), await response.text()).toBe(true);
};
await mkdir('test-results/shelf-management', { recursive: true });
try {
  const initial = await draft(), alice = initial.library.books[0];
  initial.library.books.push({ ...structuredClone(alice), id: 'draft-book',
    title: '아주 긴 제목을 가진 도서도 작은 화면에서 관리할 수 있는지 확인하는 새로운 이야기',
    author: '테스트 작가', category: '문학', published: false,
    chapters: [{ ...structuredClone(alice.chapters[0]), id: 'draft-chapter', placements: [], mainPlacementId: undefined, floorDecals: [] }],
  });
  await write(initial);
  await page.goto(server.url + '/admin/');
  await expect(page.locator('#shelf-count')).toHaveText('총 3권');
  await expect(page.locator('.library-summary')).toContainText('공개 대상 2권');
  await expect(page.locator('.book-library i[data-lucide]')).toHaveCount(0);
  await expect(row('alice').locator('[data-book-up]')).toBeDisabled();
  await expect(row('draft-book').locator('[data-book-down]')).toBeDisabled();

  await page.locator('#book-search').fill(`  ${alice.author}  `);
  await expect(row('alice')).toBeVisible();
  await expect(row('oz')).toBeHidden();
  await expect(page.locator('#shelf-count')).toHaveText('3권 중 1권 표시');
  await expect(row('alice').locator('[data-book-down]')).toBeDisabled();
  await expect(row('alice').locator('[data-book-drag]')).toBeDisabled();
  await page.locator('#book-filter').selectOption('draft');
  await expect(page.locator('#shelf-empty')).toContainText('검색 결과가 없어요');
  await page.locator('#shelf-empty-action').click();
  await expect(page.locator('#book-search')).toHaveValue('');
  await expect(page.locator('#book-filter')).toHaveValue('all');
  await expect(page).toHaveURL(server.url + '/admin/');
  await page.locator('#book-search').fill('모험');
  await expect(row('oz')).toBeVisible();
  await expect(row('alice')).toBeHidden();
  await page.locator('#reset-book-filter').click();
  console.log('PASS Author/category search, combined filters, counts and empty-result recovery');

  await row('alice').locator('[data-book-down]').click();
  expect(await order()).toEqual(['oz', 'alice', 'draft-book']);
  await expect(row('alice').locator('[data-book-down]')).toBeFocused();
  await row('alice').locator('[data-book-drag]').focus();
  await page.keyboard.press('Alt+ArrowUp');
  expect(await order()).toEqual(['alice', 'oz', 'draft-book']);
  await row('draft-book').locator('[data-book-up]').click();
  await row('alice').locator('[data-book-down]').click();
  await row('oz').locator('[data-book-up]').click();
  expect(await order()).toEqual(['draft-book', 'oz', 'alice']);
  await expect(row('oz').locator('.book-order-number')).toHaveText('02');
  await save(false);
  expect((await live()).books.map(book => book.id)).toEqual(['alice', 'oz']);
  await page.reload();
  await expect(row('draft-book')).toBeVisible();
  expect(await order()).toEqual(['draft-book', 'oz', 'alice']);
  await save(true);
  expect((await live()).books.map(book => book.id)).toEqual(['oz', 'alice']);
  console.log('PASS Buttons and vertical keyboard order persist; publishing preserves order and excludes drafts');

  const modelCount = initial.library.models.length;
  await row('oz').locator('[data-delete-book]').click();
  await expect(page.locator('dialog')).toContainText('‘오즈의 마법사’ 도서를 삭제할까요?');
  await expect(page.locator('dialog')).toContainText('챕터 3개');
  await page.locator('#cancel-action').click();
  await expect(row('oz')).toBeVisible();
  await expect(row('oz').locator('[data-delete-book]')).toBeFocused();
  await expect(page.locator('#save-state')).toHaveText('공개 완료');
  await row('oz').locator('[data-delete-book]').click();
  await page.locator('#confirm-action').click();
  await expect(row('oz')).toHaveCount(0);
  await expect(row('alice').locator('[data-edit-book]')).toBeFocused();
  await save(false);
  const deleted = await draft();
  expect(deleted.library.home.hero).toEqual([]);
  expect(deleted.library.models).toHaveLength(modelCount);
  expect((await live()).books.map(book => book.id)).toContain('oz');
  await save(true);
  expect((await live()).books.map(book => book.id)).toEqual(['alice']);
  console.log('PASS Direct delete confirms the exact target, supports cancellation and removes linked data only after confirmation');

  await page.screenshot({ path: 'test-results/shelf-management/desktop.png', fullPage: true });
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(row('draft-book').locator('[data-edit-book]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await row('alice').locator('[data-book-up]').click();
    expect(await order()).toEqual(['alice', 'draft-book']);
    await expect(row('alice').locator('[data-book-down]')).toBeFocused();
    await row('alice').locator('[data-book-down]').click();
    expect(await order()).toEqual(['draft-book', 'alice']);
    if (width <= 375) {
      const button = await row('alice').locator('[data-book-up]').boundingBox();
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
    }
    if (width === 375) await page.screenshot({ path: 'test-results/shelf-management/mobile.png', fullPage: true });
  }
  await page.locator('#book-search').fill('아주 긴');
  await row('draft-book').locator('[data-delete-book]').click();
  await page.locator('#confirm-action').click();
  await expect(page.locator('#shelf-empty')).toContainText('검색 결과가 없어요');
  await expect(page.locator('#book-search')).toBeFocused();
  await page.locator('#shelf-empty-action').click();
  await row('alice').locator('[data-delete-book]').click();
  await page.locator('#confirm-action').click();
  await expect(page.locator('#shelf-empty')).toContainText('아직 등록된 도서가 없어요');
  await expect(page.locator('#new-book')).toBeFocused();
  await save(false);
  await page.reload();
  await page.locator('#shelf-empty-action').click();
  await expect(page.locator('#book-form')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
  console.log('PASS Mobile order buttons, long titles, empty-library recovery and no browser errors');
} finally {
  await browser.close();
  await server.stop();
}
