import {chromium,expect} from '@playwright/test';
import {startServer} from './helpers.js';
const server=await startServer(4285),browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext();await context.route('**/assets/client-*.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/(\w+)\.setActive\((\w+)\)/,(m,n)=>m+',window.__w='+n)});});
 const p=await context.newPage();await p.goto(server.url+'/client/?book=alice&chapter=alice-1');await p.waitForFunction(()=>window.__w?.sun);
 await p.evaluate(()=>{const w=window.__w,o=w.objects[0];w.moveTo(o.p.x,o.p.z);});await p.waitForTimeout(2800);
 const state=await p.evaluate(()=>{const w=window.__w,o=w.objects[0];return {distance:Math.hypot(w.player.position.x-o.p.x,w.player.position.z-o.p.z),limit:(o.p.collisionRadius??.8)*o.p.scale+.32,near:o.near};});
 expect(state.distance).toBeGreaterThanOrEqual(state.limit-.001);expect(state.near).toBe(true);console.log('PASS client stops outside solid model while proximity still activates');
 const a=await context.newPage();await a.goto(server.url+'/admin/');await a.getByLabel('캐릭터 통과 막기').uncheck();await a.getByLabel('충돌 반경',{exact:true}).fill('1.2');await a.locator('#save').click();await expect(a.locator('#save-state')).toHaveText('변경사항 저장됨');await a.reload();await expect(a.getByLabel('캐릭터 통과 막기')).not.toBeChecked();await expect(a.getByLabel('충돌 반경',{exact:true})).toHaveValue('1.2');await a.locator('#publish').click();await expect(a.locator('#save-state')).toHaveText('공개 완료');
 await p.reload();await p.waitForFunction(()=>window.__w?.sun);await p.evaluate(()=>{const w=window.__w,o=w.objects[0];w.moveTo(o.p.x,o.p.z);});await p.waitForTimeout(2200);expect(await p.evaluate(()=>{const w=window.__w,o=w.objects[0];return Math.hypot(w.player.position.x-o.p.x,w.player.position.z-o.p.z);})).toBeLessThan(.1);console.log('PASS collision settings persist, publish, and disabled model allows passage');
} finally {await browser.close();await server.stop();}
