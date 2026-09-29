import { chromium, expect } from '@playwright/test';
import { startServer, sampleGLB } from './helpers.js';

// A still GLB, such as a Blender scene with no skeleton and no motions, is registered and placed in the studio.
const server = await startServer(4351);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(server.url + '/admin/');
  await page.getByRole('button', { name: '3D 모델 보관함', exact: true }).click();
  await page.locator('#new-model').click();
  await page.getByLabel('모델 이름', { exact: true }).fill('정적 장면 모델');
  await page.getByLabel('제작자 및 사용 권한').fill('Blender 자체 제작');
  await page.locator('[name="file"]').setInputFiles({ name: 'scene.glb', mimeType: 'model/gltf-binary', buffer: sampleGLB(false, false) });
  await expect(page.locator('#upload-status')).toContainText('정적 모델');
  const png = Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    canvas.getContext('2d').fillRect(40, 20, 240, 140);
    return canvas.toDataURL().split(',')[1];
  }), 'base64');
  await page.locator('[name="thumbnail"]').setInputFiles({ name: 'thumb.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#thumbnail-status')).toContainText('업로드 완료');
  await page.locator('#model-submit').click();
  await expect(page.locator('.model-card').filter({ hasText: '정적 장면 모델' })).toBeVisible();
  await page.locator('#save').click();
  await expect(page.locator('#save-state')).toHaveText('변경사항 저장됨');
  console.log('PASS a still GLB registers with its thumbnail');

  await page.getByRole('button', { name: '도서 보관함', exact: true }).click();
  await page.locator('[data-open-book="alice"]').click();
  await expect(page.locator('#studio-world canvas')).toBeVisible();
  const tile = page.locator('.asset-tile').filter({ hasText: '정적 장면 모델' });
  await expect(tile).toHaveAttribute('draggable', 'true');
  await expect(tile).toContainText('정적 모델 · 드래그 배치');
  await tile.locator('img').dragTo(page.locator('#studio-world canvas'), { targetPosition: { x: 800, y: 720 } });
  await expect(page.locator('[data-select-model]')).toHaveCount(4);
  const motion = page.locator('#object-form [name="animation"]');
  await expect(motion).toHaveValue('none');
  await expect(page.locator('#object-form [name="clip"]')).toHaveCount(0);
  await motion.selectOption('spin');
  await page.locator('#save').click();
  await expect(page.locator('#save-state')).toHaveText('변경사항 저장됨');
  const state = await (await page.request.get(server.url + '/api/studio')).json();
  const model = state.library.models.find((m) => m.name === '정적 장면 모델');
  const placed = state.library.books.find((b) => b.id === 'alice').chapters.flatMap((c) => c.placements).find((p) => p.modelId === model.id);
  expect({ rigged: model.rigged, clips: model.clips, animation: placed.animation }).toEqual({ rigged: false, clips: [], animation: 'spin' });
  console.log('PASS the still model is dragged into the world, starts still and takes a basic motion');
  expect(errors).toEqual([]);
} finally {
  await browser.close();
  await server.stop();
}
