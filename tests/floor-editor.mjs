import { chromium,expect } from '@playwright/test';
import { startServer } from './helpers.js';
const server=await startServer();
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960}});
context.setDefaultTimeout(20000);
await context.route('**/assets/client-*.js',async route=>{const response=await route.fetch();const body=(await response.text()).replace(/([\w$]+)\.setActive\(([\w$]+)\)/,(match,name)=>match+',(window.__testWorld='+name+')');await route.fulfill({response,body});});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
// Floor images are placed in the studio's world editor: a built-in image and an uploaded PNG are dragged into the world,
// then moved, sized and turned in the property form. The old floor dialog, with its arrow route and spacing controls, is
// gone from the studio, so this check no longer covers those.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6i8AAAAASUVORK5CYII=','base64');
const setFields=async values=>{for(const [name,value] of values){const input=page.locator(`#object-form [name="${name}"]`);await input.fill(value);await input.press('Tab');}};
try {
 await page.goto(server.url+'/admin/');await page.locator('[data-open-book="alice"]').click();await expect(page.locator('#studio-world canvas')).toBeVisible();
 await page.locator('[data-chapter-edit]').first().click();
 for(const name of ['floorPanelHeight','floorOpacity','floorBlur'])await expect(page.locator(`[name="${name}"]`)).toHaveCount(0);
 await page.getByLabel('오른쪽에 보여 줄 글귀',{exact:true}).fill('바닥 배치와 함께 관리하는 챕터 텍스트입니다.');
 await page.getByRole('button',{name:'변경 적용',exact:true}).click();
 await page.locator('[data-floor-asset="open-book"]').dragTo(page.locator('#studio-world canvas'),{targetPosition:{x:800,y:720}});
 await expect(page.locator('#delete-floor-object')).toBeVisible();
 await setFields([['x','10'],['z','-8'],['width','7'],['height','4'],['rotation','45']]);
 await page.locator('#upload-floor-asset').setInputFiles({name:'test.png',mimeType:'image/png',buffer:png});
 const uploaded=page.locator('[data-floor-asset^="/uploads/"]');await expect(uploaded).toHaveCount(1);
 await uploaded.dragTo(page.locator('#studio-world canvas'),{targetPosition:{x:700,y:640}});
 await expect(page.locator('#delete-floor-object')).toBeVisible();
 await setFields([['x','14'],['z','-4']]);
 await page.screenshot({path:'docs/floor-evidence/floor-editor.png'});
 await page.locator('#save').click();await expect(page.locator('#save-state')).toHaveText('변경사항 저장됨');
 const live=await(await context.request.get(server.url+'/api/library')).json();expect(live.books[0].chapters[0].floorDecals ?? null).toBe(null);
 const saved=await(await context.request.get(server.url+'/api/studio')).json();const c=saved.library.books[0].chapters[0];
 expect(c.floorText).toBe('바닥 배치와 함께 관리하는 챕터 텍스트입니다.');
 expect(c.floorDecals.at(-2)).toMatchObject({asset:'open-book',x:10,z:-8,width:7,height:4,rotation:45});
 const image=c.floorDecals.at(-1);expect(image).toMatchObject({x:14,z:-4});expect(image.asset).toMatch(/\.png$/);
 await page.reload();await expect(page.locator('#studio-world canvas')).toBeVisible();await expect(uploaded).toHaveCount(1);
 await page.locator('#publish').click();await expect(page.locator('#save-state')).toHaveText('공개 완료');
 const reader=await context.newPage();reader.on('pageerror',e=>errors.push(e.message));await reader.goto(server.url+'/client/?book=alice&chapter=alice-1');
 await reader.waitForFunction(()=>window.__testWorld?.sun);
 await reader.waitForFunction(url=>{let found=false;window.__testWorld.root.traverse(o=>{if(o.material?.map?.image?.src?.endsWith(url)&&o.position.x===14&&o.position.z===-4)found=true;});return found;},image.asset);
 const invalid=await context.request.post(server.url+'/api/floor/upload',{headers:{'X-On-The-Book':'studio'},multipart:{image:{name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not png')}}});expect(invalid.status()).toBe(400);
 expect(errors).toEqual([]);console.log('PASS removed style controls; floor image drag, transforms and upload, persistence, draft isolation and client publication');
} finally {await browser.close();await server.stop();}
