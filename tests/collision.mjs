import {chromium,expect} from '@playwright/test';
import {startServer} from './helpers.js';
const server=await startServer(),browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext();await context.route('**/assets/client-*.js',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace(/([\w$]+)\.setActive\(([\w$]+)\)/,(m,n)=>m+',window.__w='+n)});});
 // The traveller walks only once it has landed, and then stops against the model; it is checked once it stands still.
 // Page loads wait for the document only: the world's own readiness is awaited, and the full load event also waits for
 // web fonts from a CDN, which on a busy machine has held a reload past the timeout.
 const p=await context.newPage(),landed=()=>p.waitForFunction(()=>window.__w?.sun&&window.__w.arrivalTime===null);
 const settle=async()=>{let last;for(let i=0;i<40;i++){const now=await p.evaluate(()=>[window.__w.player.position.x,window.__w.player.position.z]);if(last&&Math.hypot(now[0]-last[0],now[1]-last[1])<1e-3)return;last=now;await p.waitForTimeout(250);}throw Error('The traveller did not stop');};
 await p.goto(server.url+'/client/?book=alice&chapter=alice-1',{waitUntil:'domcontentloaded'});await landed();
 await p.evaluate(()=>{const w=window.__w,o=w.objects[0];w.moveTo(o.p.x,o.p.z);});await p.waitForFunction(()=>window.__w.objects[0].near);await settle();
 const state=await p.evaluate(()=>{const w=window.__w,o=w.objects[0];return {distance:Math.hypot(w.player.position.x-o.p.x,w.player.position.z-o.p.z),limit:(o.p.collisionRadius??.8)*o.p.scale+.32,near:o.near};});
 expect(state.distance).toBeGreaterThanOrEqual(state.limit-.001);expect(state.near).toBe(true);console.log('PASS client stops outside solid model while proximity still activates');
 // The studio opens on the bookshelf; the collision settings live in the world editor's form for the selected model.
 const a=await context.newPage();await a.goto(server.url+'/admin/');await a.locator('[data-book-menu="alice"]').click();await a.locator('[data-open-book="alice"]').click();await a.locator('[data-select-model]').first().click();
 await a.getByLabel('캐릭터 통과 막기').uncheck();await a.getByLabel('충돌 반경',{exact:true}).fill('1.2');await a.getByLabel('충돌 반경',{exact:true}).press('Tab');await a.locator('#save').click();await expect(a.locator('#save-state')).toHaveText('변경사항 저장됨');await a.reload();await expect(a.getByLabel('캐릭터 통과 막기')).not.toBeChecked();await expect(a.getByLabel('충돌 반경',{exact:true})).toHaveValue('1.2');await a.locator('#publish').click();await expect(a.locator('#save-state')).toHaveText('공개 완료');
 await p.reload({waitUntil:'domcontentloaded'});await landed();await p.evaluate(()=>{const w=window.__w,o=w.objects[0];w.moveTo(o.p.x,o.p.z);});await p.waitForFunction(()=>{const w=window.__w,o=w.objects[0];return Math.hypot(w.player.position.x-o.p.x,w.player.position.z-o.p.z)<.1;});console.log('PASS collision settings persist, publish, and disabled model allows passage');
} finally {await browser.close();await server.stop();}
