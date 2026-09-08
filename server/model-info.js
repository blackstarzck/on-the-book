export function modelInfo(buffer) {
 const json=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
 const joints=new Set((json.skins||[]).flatMap(s=>s.joints||[]));
 const skinned=(json.nodes||[]).some(n=>Number.isInteger(n.skin)&&json.skins?.[n.skin]?.joints?.length&&json.meshes?.[n.mesh]?.primitives?.some(p=>Number.isInteger(p.attributes?.JOINTS_0)&&Number.isInteger(p.attributes?.WEIGHTS_0)));
 const motion=(json.animations||[]).some(a=>a.channels?.some(c=>joints.has(c.target?.node)&&['translation','rotation','scale'].includes(c.target?.path)&&json.accessors?.[a.samplers?.[c.sampler]?.input]?.count>1));
 return {rigged:!!(skinned&&motion),clips:(json.animations||[]).map((a,i)=>a.name||`animation_${i}`)};
}
