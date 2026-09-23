import fs from 'node:fs/promises';
import path from 'node:path';
import {cases} from './catalog.mjs';
const root=process.cwd().replaceAll('\\','/');
const out=root+'/docs/qa/2026-09-08';
const runtime=root+'/test-results/qa-uat-2026-09-08';
const baseline=JSON.parse(await fs.readFile(runtime+'/baseline.json','utf8'));
const selectedIds=process.argv.slice(3);
const groups=selectedIds.length?[process.argv[2]]:[...new Set(cases.map(c=>c.group))];
await fs.mkdir(out+'/features',{recursive:true});
await fs.mkdir(runtime+'/mcp',{recursive:true});
const helpers=String.raw`
const check=(value,message='검증 실패')=>{if(!value)throw Error(message);};
const eq=(a,b,message='값 불일치')=>check(JSON.stringify(a)===JSON.stringify(b),message+': expected '+JSON.stringify(b)+', actual '+JSON.stringify(a));
const h={base:'http://127.0.0.1:4317',auth:'http://127.0.0.1:4318',evidence:OUT+'/evidence',fixtures:RUNTIME+'/fixtures',check,eq};
let active;
h.visible=async selector=>active.locator(selector).waitFor({state:'visible',timeout:12000});
h.contains=async(selector,value)=>check((await active.locator(selector).innerText()).includes(value),'표시 누락: '+value);
h.waitText=async(selector,value)=>active.waitForFunction(({selector,value})=>document.querySelector(selector)?.textContent.includes(value),{selector,value},{timeout:12000});
h.closeDialogs=async()=>{for(let i=0;i<3&&await active.locator('dialog[open]').count();i++)await active.keyboard.press('Escape');};
h.home=async(query='')=>{await active.goto(h.base+'/client/'+query);await h.visible('#start-button');await active.waitForFunction(()=>!document.querySelector('#app').hasAttribute('aria-busy'));};
h.explore=async(book='alice',chapter='alice-1')=>{await active.goto(h.base+'/client/?book='+book+'&chapter='+chapter);await h.visible('#map-button');await h.visible('#world canvas');await active.waitForFunction(()=>!document.querySelector('#app').hasAttribute('aria-busy'));};
h.admin=async()=>{await active.goto(h.base+'/admin/');await h.visible('.book-shelf');};
h.open=async(book='alice')=>{await h.admin();await active.locator('[data-open-book="'+book+'"]').click();await h.visible('#studio-world canvas');};
h.models=async()=>{await h.admin();await active.locator('[data-tab="models"]').click();await h.visible('#new-model');};
h.chapterForm=async()=>{await active.locator('[data-chapter-row].active [data-chapter-edit]').click();await h.visible('#chapter-form');};
h.rename=async title=>{await active.locator('#edit-book').click();await active.locator('#book-form [name="title"]').fill(title);await active.locator('#book-form button[type="submit"]').click();await h.visible('.world-topbar');};
h.createBook=async(title='QA 테스트 도서',published=false)=>{await h.admin();await active.locator('#new-book').click();await active.locator('#book-form [name="title"]').fill(title);await active.locator('#book-form [name="author"]').fill('QA 테스트 작가');await active.locator('#book-form [name="rights"]').fill('QA 자체 제작 테스트 자료');await active.locator('#book-form [name="published"]').setChecked(published);await active.locator('#book-form button[type="submit"]').click();await h.visible('.world-workspace');};
h.read=async(live=false)=>{const r=await active.request.get(h.base+(live?'/api/library':'/api/studio'));check(r.ok(),'읽기 응답 '+r.status());return r.json();};
h.save=async(publish=false)=>{const promise=active.waitForResponse(r=>r.url().endsWith('/api/studio')&&r.request().method()==='PUT');await active.locator(publish?'#publish':'#save').click();const r=await promise;const body=await r.json();check(r.ok(),'저장 실패: '+JSON.stringify(body));await h.waitText('#save-state',publish?'공개 완료':'변경사항 저장됨');return body;};
h.dragModel=async(model='rabbit')=>{const target=active.locator('#studio-world canvas');await active.locator('[data-model="'+model+'"]').dragTo(target,{targetPosition:{x:800,y:450}});await h.visible('#object-form');};
h.login=async()=>{await active.goto(h.auth+'/admin/');await h.visible('#login-form');await active.locator('[name="password"]').fill('QA-local-only-2026!');await active.locator('#login-form button').click();await h.visible('.book-shelf');};
const records=[];
for(const spec of SPECS){
 const started=Date.now();const errors=[],network=[];let status='passed',error=null,observed=null;
 const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 active=await context.newPage();active.setDefaultTimeout(12000);active.setDefaultNavigationTimeout(20000);h.data=spec.data;
 active.on('pageerror',e=>errors.push(e.message));
 active.on('response',r=>{const requestPath=r.url().replace(/^https?:\/\/[^/]+/,'').split('?')[0];if(requestPath.startsWith('/api/'))network.push({method:r.request().method(),path:requestPath,status:r.status()});});
 active.on('dialog',d=>d.type()==='beforeunload'?d.accept():d.dismiss());
 try{
  if(!spec.group.startsWith('auth')){
   for(const [library,publish]of [[BASELINE.live,true],[BASELINE.draft,false]]){
    const current=await (await context.request.get(h.base+'/api/studio')).json();
    const reset=await context.request.put(h.base+'/api/studio',{headers:{'X-On-The-Book':'studio'},data:{library,version:current.version,publish}});
    check(reset.ok(),'테스트 사전 데이터 복원 실패 '+await reset.text());
   }
  }
  await spec.run(active,h);
  check(errors.length===0,'처리되지 않은 화면 오류: '+errors.join(' | '));
 }catch(e){status='failed';error=String(e.message||e);}
 try{observed=(await active.locator('body').innerText()).slice(0,14000);}catch{}
 const evidence=OUT+'/evidence/'+spec.id+'.png';
 try{await active.screenshot({path:evidence,fullPage:true,animations:'disabled',timeout:15000});}catch(e){network.push({screenshotError:String(e.message)});}
 records.push({id:spec.id,group:spec.group,title:spec.title,status,error,elapsedMs:Date.now()-started,url:active.url(),viewport:active.viewportSize(),evidence:'evidence/'+spec.id+'.png',errors,network,observed});
 await context.close();
}
return {engine:'Playwright MCP browser_run_code_unsafe',browser:browser.version(),startedAt:new Date(STARTED).toISOString(),completedAt:new Date().toISOString(),group:GROUP,records};
`;
for(const group of groups){
 const specs=cases.filter(c=>selectedIds.length?selectedIds.includes(c.id):c.group===group);
 const feature='Feature: '+group+' QA 및 UAT\n  실제 실행 중인 client/admin을 Playwright MCP로 검증한다.\n\n'+specs.map(c=>`  @${c.id} @${group}\n  Scenario: ${c.id} ${c.title}\n    Given ${c.given}\n    When ${c.when}\n    Then ${c.then}\n`).join('\n');
 if(!selectedIds.length)await fs.writeFile(out+'/features/'+group+'.feature',feature);
 const definitions='['+specs.map(c=>'{...'+JSON.stringify({...c,run:undefined})+',run:'+c.run.toString()+'}').join(',')+']';
 const code=`async(page)=>{const STARTED=Date.now();const browser=page.context().browser();const GROUP=${JSON.stringify(group)},OUT=${JSON.stringify(out)},RUNTIME=${JSON.stringify(runtime)},BASELINE=${JSON.stringify(baseline)},SPECS=${definitions};\n${helpers}\n}`;
 await fs.writeFile(runtime+'/mcp/'+group+'.js',code);
}
await fs.writeFile(out+'/scenario-catalog.json',JSON.stringify(cases.map(({run,...c})=>c),null,2));
console.log(JSON.stringify({scenarios:cases.length,groups,output:out}));
