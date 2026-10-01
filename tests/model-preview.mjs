import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { startServer, sampleGLB } from './helpers.js';

const server = await startServer();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const shots = 'test-results/model-preview';
await mkdir(shots, { recursive: true });

// Keep the rendered pixels available so real gestures can be checked by their visible result.
await page.addInitScript(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    return getContext.call(this, type, /webgl/.test(type) ? { ...options, preserveDrawingBuffer: true } : options);
  };
});
const dialog = page.locator('.model-preview-dialog');
const view = page.locator('#single-preview');
const canvas = view.locator('canvas');
const pixels = () => canvas.evaluate(source => {
  const copy = document.createElement('canvas');
  copy.width = source.width; copy.height = source.height;
  const ctx = copy.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
  let left = copy.width, right = -1, top = copy.height, bottom = -1, count = 0;
  for (let y = 0; y < copy.height; y++) for (let x = 0; x < copy.width; x++) {
    if (data[(y * copy.width + x) * 4 + 3] < 32) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y); count++;
  }
  return { left, right, top, bottom, width: right - left, height: bottom - top,
    centerX: (left + right) / 2, centerY: (top + bottom) / 2,
    canvasWidth: copy.width, canvasHeight: copy.height, count };
});
const drag = async (button = 'left', dx = 100, dy = 40) => {
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button });
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 12 });
  await page.mouse.up({ button });
};
const reset = async (initial) => {
  await dialog.getByRole('button', { name: '전체 모델 보기', exact: true }).click();
  await expect.poll(async () => Math.abs((await pixels()).centerX - initial.centerX)).toBeLessThan(4);
  await expect.poll(async () => Math.abs((await pixels()).height - initial.height)).toBeLessThan(4);
};

try {
  await page.goto(`${server.url}/admin/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '3D 모델 보관함', exact: true }).click();
  await page.locator('[data-preview-model]').first().click();
  await expect(view).toHaveAttribute('data-state', 'ready');
  await expect(dialog.locator('.eyebrow, .source-note')).toHaveCount(0);
  await expect(dialog.locator('i[data-lucide]')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '이동', exact: true })).toBeEnabled();
  const bounds = await dialog.boundingBox();
  expect(bounds.width).toBeGreaterThan(1300);
  expect((await canvas.boundingBox()).height).toBeGreaterThan(800);
  const initial = await pixels();
  expect(initial.count).toBeGreaterThan(1000);
  expect(initial.height / initial.canvasHeight).toBeGreaterThan(.65);
  expect(initial.left).toBeGreaterThan(0);
  expect(initial.top).toBeGreaterThan(0);
  expect(initial.right).toBeLessThan(initial.canvasWidth - 1);
  expect(initial.bottom).toBeLessThan(initial.canvasHeight - 1);
  await page.screenshot({ path: `${shots}/desktop.png` });

  const beforeRotation = await canvas.screenshot();
  await drag();
  expect((await canvas.screenshot()).equals(beforeRotation)).toBe(false);
  await reset(initial);
  await drag('right', 110, 45);
  await expect.poll(async () => (await pixels()).centerX - initial.centerX).toBeGreaterThan(70);
  await reset(initial);
  await dialog.getByRole('button', { name: '이동', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '이동', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await drag('left', -100, 0);
  await expect.poll(async () => initial.centerX - (await pixels()).centerX).toBeGreaterThan(70);
  await reset(initial);
  await dialog.getByRole('button', { name: '확대', exact: true }).click();
  await expect.poll(async () => (await pixels()).height / initial.height).toBeGreaterThan(1.1);
  await dialog.getByRole('button', { name: '축소', exact: true }).click();
  await reset(initial);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(async () => (await pixels()).height / initial.height).toBeLessThan(.95);
  await reset(initial);
  console.log('PASS large modal, tight framing, rotation, right-drag and move-mode panning, zoom buttons/wheel, reset');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await dialog.boundingBox()).width).toBeLessThanOrEqual(374);
  const mobile = await pixels();
  expect(mobile.left).toBeGreaterThan(0);
  expect(mobile.right).toBeLessThan(mobile.canvasWidth - 1);
  const layout = await dialog.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, height: el.clientHeight, scrollHeight: el.scrollHeight }));
  expect(layout.scroll).toBe(layout.width);
  expect(layout.scrollHeight).toBe(layout.height);
  await page.screenshot({ path: `${shots}/mobile.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  console.log('PASS phone layout and close');

  // Real GLB parsing with an intentionally held request verifies the entire loading lifecycle.
  await page.setViewportSize({ width: 1440, height: 900 });
  const state = await (await page.request.get(`${server.url}/api/studio`)).json();
  const model = { id: 'preview-test', name: '로딩 확인 모델', kind: 'glb', url: '/uploads/preview-test.glb', color: '#8da88b', clips: [], credit: 'Test' };
  state.library.models.push(model);
  await page.route('**/api/studio', route => route.fulfill({ json: state }));
  let release;
  let requested;
  let seen = new Promise(resolve => { requested = resolve; });
  let pending = new Promise(resolve => { release = resolve; });
  await page.route('**/uploads/preview-test.glb', async route => {
    requested();
    await pending;
    await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: sampleGLB(false, false) });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-preview-model="preview-test"]').click();
  await seen;
  await expect(view).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.getByRole('status')).toContainText('모델을 불러오는 중');
  await expect(canvas).toBeHidden();
  await expect(dialog.getByRole('button', { name: '이동', exact: true })).toBeDisabled();
  await page.screenshot({ path: `${shots}/loading.png` });
  release();
  await expect(view).toHaveAttribute('data-state', 'ready');
  await expect(canvas).toBeVisible();
  await expect(view).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.getByRole('status')).toBeHidden();
  await expect.poll(async () => (await pixels()).count).toBeGreaterThan(100);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/modal=/);
  console.log('PASS loading remains visible until GLB is rendered');

  await page.unroute('**/uploads/preview-test.glb');
  await page.route('**/uploads/preview-test.glb', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-preview-model="preview-test"]').click();
  await expect(dialog.getByRole('alert')).toContainText('모델을 불러오지 못했습니다');
  await expect(view).toHaveAttribute('aria-busy', 'false');
  await expect(canvas).toBeHidden();
  await page.screenshot({ path: `${shots}/error.png` });
  await page.unroute('**/uploads/preview-test.glb');
  await page.route('**/uploads/preview-test.glb', route => route.fulfill({ contentType: 'model/gltf-binary', body: sampleGLB(false, false) }));
  await dialog.getByRole('button', { name: '다시 시도' }).click();
  await expect(view).toHaveAttribute('data-state', 'ready');
  await expect(canvas).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/modal=/);
  console.log('PASS failure message and retry');

  await page.unroute('**/uploads/preview-test.glb');
  seen = new Promise(resolve => { requested = resolve; });
  pending = new Promise(resolve => { release = resolve; });
  await page.route('**/uploads/preview-test.glb', async route => {
    requested();
    await pending;
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-preview-model="preview-test"]').click();
  await seen;
  await expect(dialog.getByRole('status')).toBeVisible();
  await page.keyboard.press('Escape');
  release();
  await expect(dialog).toHaveCount(0);
  await page.locator('[data-preview-model]').first().click();
  await expect(view).toHaveAttribute('data-state', 'ready');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log('PASS closing during loading and reopening without stale errors');
} finally {
  await browser.close();
  await server.stop();
}
