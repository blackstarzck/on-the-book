import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {cases} from './catalog.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const env={...process.env,QA_RUN_STARTED:new Date().toISOString(),VERCEL:'0'};
const servers=[];
async function run(args){const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(args.join(' ')+' exited '+code)));});}
async function freePort(port){await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(Error(port+' 포트를 사용하는 프로그램을 먼저 종료해 주세요.')));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});}
async function start(port,name,password){
 const child=spawn(process.execPath,['server/index.js','--production'],{cwd:root,env:{...env,PORT:String(port),DATA_DIR:path.join(root,'test-results/qa-uat-2026-09-08/data-'+name),ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe'],windowsHide:true});
 servers.push(child);let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error(log);try{const r=await fetch('http://127.0.0.1:'+port+'/api/library');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('테스트 서버 시작 실패: '+log);
}
let failure;
try{
 await freePort(4317);await freePort(4318);
 const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 await run([npm,'run','build']);
 await run([npm,'test']);
 await run([npm,'run','build:client','--','--outDir','test-results/qa-uat-2026-09-08/build-client']);
 await run([npm,'run','build:admin','--','--outDir','test-results/qa-uat-2026-09-08/build-admin']);
 await run(['tests/qa-uat/setup.mjs']);
 await run(['tests/qa-uat/generate.mjs']);
 await start(4317,'main','');await start(4318,'auth','QA-local-only-2026!');
 await run(['tests/qa-uat/run-mcp.mjs',...[...new Set(cases.map(c=>c.group))]]);
}catch(e){failure=e;console.error(e.message);}
finally{
 for(const child of servers){if(child.exitCode===null){child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));}}
}
if(servers.length){
 try{await run(['tests/qa-uat/report.mjs']);const d=JSON.parse(await fs.readFile(path.join(root,'docs/qa/2026-09-08/results.json'),'utf8'));if(d.meta.counts.failed||d.meta.counts.review||d.meta.counts.not_run)process.exitCode=1;}catch(e){failure=e;console.error(e.message);}
}
if(failure)process.exitCode=1;
