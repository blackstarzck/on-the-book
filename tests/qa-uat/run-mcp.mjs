import {spawn} from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),runtime=path.join(root,'test-results/qa-uat-2026-09-08'),out=path.join(root,'docs/qa/2026-09-08');
const cli=process.env.QA_PLAYWRIGHT_MCP_CLI||'C:/Users/admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/@playwright/mcp/cli.js';
const child=spawn(process.execPath,[cli,'--headless','--browser','msedge','--isolated','--output-dir',path.join(runtime,'transport'),'--timeout-action','12000'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
let seq=0;const pending=new Map();let stderr='';
child.stderr.on('data',b=>stderr+=b);
child.on('exit',code=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('MCP exited '+code+' '+stderr));}pending.clear();});
readline.createInterface({input:child.stdout}).on('line',line=>{try{const m=JSON.parse(line);if(m.id!==undefined){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}}catch{stderr+=line+'\n';}});
function rpc(method,params){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('MCP request timed out: '+method));},600000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});}
function notify(method,params){child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\n');}
try{
 const init=await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'on-the-book-qa-uat',version:'1.0.0'}});
 notify('notifications/initialized',{});
 const list=await rpc('tools/list',{});
 await fs.writeFile(path.join(runtime,'mcp-handshake.json'),JSON.stringify({init,tools:list.tools.map(t=>({name:t.name,inputSchema:t.inputSchema}))},null,2));
 const tool=list.tools.find(t=>t.name==='browser_run_code_unsafe')||list.tools.find(t=>t.name==='browser_run_code');
 if(!tool)throw Error('Playwright MCP code execution tool unavailable');
 console.log(JSON.stringify({mcp:init.serverInfo,tool:tool.name,groups:process.argv.slice(2)}));
 await rpc('tools/call',{name:'browser_navigate',arguments:{url:'http://127.0.0.1:4317/client/'}});
 for(const group of process.argv.slice(2)){
  const started=Date.now();
  const code=await fs.readFile(path.join(runtime,'mcp',group+'.js'),'utf8');
  const result=await rpc('tools/call',{name:tool.name,arguments:{code}});
  await fs.writeFile(path.join(runtime,'transport-'+group+'.json'),JSON.stringify(result,null,2));
  const text=result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')||'';
  const matched=text.match(/### Result\s*\n([\s\S]*?)(?:\n### |$)/);
  if(result.isError||!matched)throw Error(group+': '+text.slice(0,4000));
  const report=JSON.parse(matched[1]);
  await fs.writeFile(path.join(out,group+'.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({group,elapsedMs:Date.now()-started,results:report.records.map(({id,status,error})=>({id,status,error}))}));
 }
}catch(e){console.error(e);process.exitCode=1;}
finally{await fs.writeFile(path.join(runtime,'mcp-stderr.log'),stderr);child.stdin.end();setTimeout(()=>child.kill(),1000).unref();}
