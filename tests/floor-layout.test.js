import test from 'node:test';
import assert from 'node:assert/strict';
import {routePoints,defaultDecals,arrowPlacements} from '../shared/landscape.js';
test('automatic arrow footprints stay outside trigger boundaries at every scale',()=>{
 for(const scale of [.3,1,3]){
 const chapter={width:100,placements:[{x:0,z:0,radius:5,scale:1,collision:false}],floorArrowScale:scale};
 const arrows=arrowPlacements(chapter);assert.ok(arrows.length);
 for(const arrow of arrows)assert.ok(Math.hypot(arrow.x,arrow.z)>=10+Math.hypot(arrow.width,arrow.height)/2);
 assert.equal(arrowPlacements({...chapter,floorArrows:false}).length,0);
 }
});
test('legacy manual route remains stored but is excluded from automatic routing',()=>{
 const chapter={width:64,depth:56,placements:[{x:20,z:9}],floorRoute:[{x:10,z:-8},{x:-10,z:5}]};
 assert.deepEqual(routePoints(chapter),[{x:-32,z:0},{x:20,z:9},{x:32,z:0}]);
 assert.deepEqual(routePoints({...chapter,width:80,placements:[]}),[{x:-40,z:0},{x:40,z:0}]);
 assert.deepEqual(chapter.floorRoute,[{x:10,z:-8},{x:-10,z:5}]);
});
test('legacy artwork can be materialized without changing its placement',()=>{
 const c={width:64,depth:56,theme:'tea',placements:[{x:-9,z:1},{x:31,z:27}]};
 const decals=defaultDecals(c);assert.equal(decals[0].asset,'tea-cup');assert.equal(decals[0].x,-14);assert.equal(decals[0].z,7);
 assert.equal(decals[1].x,29);assert.equal(decals[1].z,25);
 assert.deepEqual(defaultDecals({...c,floorDecor:'none'}),[]);
});
