import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sampleGLB } from '../helpers.js';
const root=process.cwd();
const base=path.join(root,'test-results/qa-uat-2026-09-08');
await fs.mkdir(base,{recursive:true});
await fs.mkdir(path.join(root,'docs/qa/2026-09-08/evidence'),{recursive:true});
const original=await fs.readFile(path.join(root,'data/library.json'));
await fs.writeFile(path.join(base,'original.sha256'),createHash('sha256').update(original).digest('hex'));
for(const name of ['main','auth']) {
  const target=path.join(base,'data-'+name);
  await fs.mkdir(target,{recursive:true});
  await fs.writeFile(path.join(target,'library.json'),original);
  await fs.cp(path.join(root,'data/uploads'),path.join(target,'uploads'),{recursive:true});
}
const fixtures=path.join(base,'fixtures');
await fs.mkdir(fixtures,{recursive:true});
await fs.writeFile(path.join(fixtures,'animated.glb'),sampleGLB(true));
await fs.writeFile(path.join(fixtures,'unrigged.glb'),sampleGLB(false));
await fs.writeFile(path.join(fixtures,'invalid.glb'),'This is not a GLB file');
await fs.writeFile(path.join(fixtures,'oversize.glb'),Buffer.alloc(25*1024*1024+1));
await fs.writeFile(path.join(fixtures,'invalid.png'),'This is not a PNG file');
await fs.writeFile(path.join(fixtures,'oversize.png'),Buffer.alloc(5*1024*1024+1));
await fs.copyFile(path.join(root,'public/ornaments/story-divider.png'),path.join(fixtures,'valid.png'));
await fs.writeFile(path.join(base,'baseline.json'),original);
console.log(JSON.stringify({base,originalData:'preserved',ports:[4317,4318]}));
