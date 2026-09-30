import { chromium, expect } from '@playwright/test';
import { startServer } from './helpers.js';
const server = await startServer();
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:960}});
context.setDefaultTimeout(20000);
await context.route('**/assets/client-*.js', async route => {
  const response = await route.fetch();
  const body = (await response.text()).replace(/([\w$]+)\.setActive\(([\w$]+)\)/, (match,name) => match+',(window.__testWorld='+name+')');
  await route.fulfill({response,body});
});
const page = await context.newPage();
const errors=[]; context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
page.on('pageerror',e=>errors.push(e.message));
try {
  // The studio opens on its bookshelf; the chapter's story and reading settings are edited from the world editor.
  await page.goto(server.url+'/admin/');
  await page.locator('[data-open-book="alice"]').click();
  await expect(page.locator('#studio-world canvas')).toBeVisible();
  await page.locator('[data-chapter-edit]').first().click();
  const story='공개 전 설정 확인을 위한 이야기입니다. '.repeat(30);
  await page.getByLabel('오른쪽에 보여 줄 글귀',{exact:true}).fill(story);
  for(const [label,value] of [['애니메이션·글 노출 접근 배율','3'],['페이지당 최대 글자 수','150']]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByLabel('챕터명과 본문 순차 등장').uncheck();
  await page.getByRole('button',{name:'변경 적용',exact:true}).click();
  // The draft is tried in place: the studio's reader runs the client's own world and reading panel on the unsaved draft.
  await page.locator('#preview-client').click();
  const reader=page.locator('.inplace-reader');
  await expect(reader.locator('.floor-reading-controls')).toBeVisible();
  const readStyle=()=>reader.locator('.floor-reading-controls').evaluate(el=>{const s=getComputedStyle(el);return {height:s.height,background:s.backgroundColor,blur:s.backdropFilter,animations:el.querySelector('h2').getAnimations().length};});
  const style=await readStyle();
  expect(parseFloat(style.height)).toBeLessThanOrEqual(560); expect(style.background).toContain('0.58'); expect(style.blur).toBe('blur(14px)'); expect(style.animations).toBe(0);
  await expect(reader.locator('#floor-accessible')).toContainText('공개 전 설정');
  await reader.locator('.floor-reading-controls').evaluate(async el => { await document.fonts.ready; await Promise.all(el.getAnimations().map(a => a.finished)); });
  const before=await reader.locator('#floor-next').boundingBox();
  await reader.locator('#floor-next').click();
  expect(await reader.locator('#floor-next').boundingBox()).toEqual(before);
  await expect(reader.locator('#floor-page')).toContainText('2 /');
  await page.screenshot({path:'docs/floor-evidence/admin-draft-desktop.png'});
  await page.locator('#exit-reader').click();
  await expect(reader).toHaveCount(0);
  // Saving keeps the draft apart from what readers see until it is published.
  await page.locator('#save').click(); await expect(page.locator('#save-state')).toHaveText('변경사항 저장됨');
  const live=await (await context.request.get(server.url+'/api/library')).json();
  expect(live.books[0].chapters[0].floorText||'').toBe('');
  const draft=await (await context.request.get(server.url+'/api/studio')).json();
  expect(draft.library.books[0].chapters[0].reactionMultiplier).toBe(3);
  await page.reload(); await expect(page.locator('#studio-world canvas')).toBeVisible();
  await page.locator('[data-chapter-edit]').first().click();
  await expect(page.getByLabel('글 상자 높이',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.locator('#publish').click(); await expect(page.locator('#save-state')).toHaveText('공개 완료');
  const client=await context.newPage(); await client.goto(server.url+'/client/?book=alice&chapter=alice-1');
  await client.waitForFunction(()=>window.__testWorld?.player);
  await client.evaluate(()=>window.__testWorld.moveTo(-9,1));
  await expect(client.locator('.floor-reading-controls')).toBeVisible();
  expect(await client.locator('.floor-reading-controls').evaluate(el=>getComputedStyle(el).height)).toBe('560px');
  await expect(client.locator('#floor-accessible')).toContainText('공개 전 설정');
  expect(errors).toEqual([]);
  console.log('PASS the in-place draft reader uses the client; custom reading settings, fixed pagination, persistence and publish match');
} finally {await browser.close(); await server.stop();}
