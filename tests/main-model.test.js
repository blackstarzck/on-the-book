import test from 'node:test';
import assert from 'node:assert/strict';
import {chapterSchema} from '../shared/schema.js';
import {seed} from '../server/seed.js';
import {routePoints} from '../shared/landscape.js';

test('legacy migration assigns first placement without changing content or coordinates',()=>{
 const old=structuredClone(seed.books[0].chapters[0]);delete old.mainPlacementId;
 const c=chapterSchema.parse(old);assert.equal(c.mainPlacementId,old.placements[0].id);
 assert.equal(c.body,old.body);assert.deepEqual(c.placements.map(p=>[p.id,p.x,p.z]),old.placements.map(p=>[p.id,p.x,p.z]));
});
test('main must reference a placement in this chapter; empty drafts have no main',()=>{
 const c=chapterSchema.parse(seed.books[0].chapters[0]);
 assert.equal(chapterSchema.safeParse({...c,mainPlacementId:'missing-model'}).success,false);
 assert.equal(chapterSchema.safeParse({...c,mainPlacementId:null}).success,false);
 assert.equal(chapterSchema.safeParse({...c,placements:[],mainPlacementId:null}).success,true);
 assert.equal(chapterSchema.safeParse({...c,placements:[]}).success,false);
});
test('changing main changes the only automatic waypoint without moving models',()=>{
 const c=chapterSchema.parse(seed.books[0].chapters[0]),positions=structuredClone(c.placements);
 c.mainPlacementId=c.placements[1].id;assert.deepEqual(routePoints(c)[1],{x:positions[1].x,z:positions[1].z});assert.equal(routePoints(c).length,3);assert.deepEqual(c.placements,positions);
});
