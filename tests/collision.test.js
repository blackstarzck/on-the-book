import test from 'node:test';
import assert from 'node:assert/strict';
import {slideMove,clearAt,obstacles} from '../shared/collision.js';
test('solid model blocks a long movement without tunnelling',()=>{const walls=[{x:0,z:0,r:1}];const p=slideMove({x:-4,z:0},{x:8,z:0},walls);assert.ok(p.x< -1);assert.ok(clearAt(p,walls));});
test('diagonal movement slides along the boundary',()=>{const walls=[{x:0,z:0,r:1}];const p=slideMove({x:-2,z:.3},{x:3,z:1},walls);assert.ok(p.z>.3);assert.ok(clearAt(p,walls));});
test('disabled collision allows passage and scale updates radius',()=>{assert.equal(obstacles([{p:{collision:false}}]).length,0);assert.equal(obstacles([{p:{x:0,z:0,scale:2,collisionRadius:1}}])[0].r,2.32);});
