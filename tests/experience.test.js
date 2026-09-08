import test from 'node:test';
import assert from 'node:assert/strict';
import { reactionSize, overlapsTrigger, newTriggerConflict } from '../shared/experience.js';
test('placement trigger exclusion includes neighbours and ignores height',()=>{
 const p={id:'a',x:0,z:0,radius:2,scale:1,collision:false};const c={id:'c',width:64,placements:[p]};
 assert.equal(overlapsTrigger({...p,id:'b',x:7,y:30},c),true);
 assert.equal(overlapsTrigger({...p,id:'b',x:8},c),false);
 const book={chapters:[{...c,placements:[{...p,x:31}]},{id:'d',width:64,placements:[]}]};
 assert.equal(overlapsTrigger({...p,id:'b',x:-31},book.chapters[1],book),true);
 const legacy={chapters:[{...c,placements:[p,{...p,id:'b',x:2}]}]};
 assert.equal(newTriggerConflict(legacy,legacy),false);
 assert.equal(newTriggerConflict(legacy),true);
});
import { obstacles } from '../shared/collision.js';
test('reaction radius matches chapter multiplier and stays outside the scaled collision boundary', () => {
  const p={x:0,z:0,scale:3,radius:1,collisionRadius:2,collision:true};
  assert.equal(reactionSize(p,{}),13.7);
  assert.equal(reactionSize(p,{reactionMultiplier:3}),20.549999999999997);
  assert.ok(reactionSize(p,{reactionMultiplier:1})>obstacles([{p}])[0].r);
  assert.equal(reactionSize({...p,collision:false},{reactionMultiplier:3}),3);
});
