import {chromium,expect} from '@playwright/test';
import {startServer} from './helpers.js';
const server=await startServer(4297), browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));
const open=async()=>{await page.locator('[data-open-book="alice"]').click();await expect(page.locator('#studio-world canvas')).toBeVisible();};
const select=()=>page.locator('[data-select-model]').nth(2).click();
const change=async(name,value)=>{await page.locator(`#object-form [name="${name}"]`).fill(value);await page.locator(`#object-form [name="${name}"]`).press('Tab');};
const guard=async(name,edit)=>{await open();await edit();await page.locator('#back-library').click();await expect(page.locator('.leave-editor-dialog')).toBeVisible();await page.getByRole('button',{name:'계속 편집',exact:true}).click();await expect(page.locator('#studio-world canvas')).toBeVisible();await page.locator('#back-library').click();await page.getByRole('button',{name:'저장하지 않고 나가기',exact:true}).click();await expect(page.locator('.book-shelf')).toBeVisible();console.log('PASS '+name);};
try{
 await page.goto(server.url+'/admin/');
 await guard('model drag placement',async()=>{await page.locator('[data-model]').first().dragTo(page.locator('#studio-world canvas'),{targetPosition:{x:800,y:720}});await expect(page.locator('[data-select-model]')).toHaveCount(4);});
 await guard('floor image placement',async()=>{await page.locator('[data-floor-asset="arrow"]').dragTo(page.locator('#studio-world canvas'),{targetPosition:{x:800,y:720}});await expect(page.locator('#delete-floor-object')).toBeVisible();});
 await guard('duplicate',async()=>{await select();await page.locator('#duplicate-object').click();await expect(page.locator('[data-select-model]')).toHaveCount(4);});
 await guard('delete',async()=>{await select();await page.locator('#delete-object').click();await expect(page.locator('[data-select-model]')).toHaveCount(2);});
 await guard('main role',async()=>{await select();await page.locator('#make-main').click();});
 for(const [name,value] of [['x','14'],['scale','1.2'],['radius','5'],['title','미저장 이름']])await guard(name,async()=>{await select();await change(name,value);});
 await guard('chapter add',async()=>{await page.locator('#add-chapter').click();await page.getByRole('button',{name:'닫기',exact:true}).click();});
 await guard('chapter reorder',()=>page.locator('[data-chapter-drag]').first().press('Alt+ArrowDown'));
 await guard('chapter text',async()=>{await page.locator('[data-chapter-edit]').first().click();await page.locator('#chapter-form [name="body"]').fill('새로운 본문');await page.getByRole('button',{name:'변경 적용',exact:true}).click();});
 await open();await select();await change('x','14');await page.locator('#undo').click();await page.locator('#back-library').click();await expect(page.locator('.book-shelf')).toBeVisible();console.log('PASS undo to saved state skips prompt');
 await open();await page.locator('#upload-floor-asset').setInputFiles({name:'test-floor.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});await expect(page.locator('[data-floor-asset^="/uploads/"]')).toHaveCount(1);
 await page.locator('#back-library').click();await expect(page.locator('.leave-editor-dialog')).toBeVisible();await page.route('**/api/studio',r=>r.request().method()==='PUT'?r.abort():r.continue());await page.getByRole('button',{name:'저장 후 나가기',exact:true}).click();await expect(page.locator('.leave-error')).toContainText('저장하지 못했습니다');await expect(page.locator('.leave-editor-dialog')).toBeVisible();await page.unroute('**/api/studio');await page.getByRole('button',{name:'저장 후 나가기',exact:true}).click();await expect(page.locator('.book-shelf')).toBeVisible();
 await page.reload();await open();await expect(page.locator('[data-floor-asset^="/uploads/"]')).toHaveCount(1);console.log('PASS unplaced PNG guard, failed save retains changes, successful save persists asset');
 await expect(page.locator('#back-library')).toBeVisible();await page.locator('#back-library').click();await expect(page.locator('.book-shelf')).toBeVisible();
 expect(errors).toEqual([]);
}finally{await browser.close();await server.stop();}
