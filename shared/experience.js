export function collisionSize(p) { return p.collision === false ? 0 : (p.collisionRadius ?? .8) * p.scale; }
export function mainModel(chapter) { return chapter.placements.find(p=>p.id===chapter.mainPlacementId) || (chapter.mainPlacementId===undefined?chapter.placements[0]:null); }
export function reactionSize(p, chapter) { return (chapter.reactionMultiplier ?? 2) * Math.max(p.radius, p.collision !== false ? collisionSize(p) + .85 : 0); }

export function triggerCircles(book) {
  let edge=-(book.chapters[0]?.width||64)/2;
  return book.chapters.flatMap(c=>{const offset=edge+c.width/2;edge+=c.width;return c.placements.map(p=>({id:p.id,x:p.x+offset,z:p.z,radius:reactionSize(p,c),chapterId:c.id,offset}));});
}
export function overlapsTrigger(candidate, chapter, book={chapters:[chapter]}) {
  let offset=0,edge=-(book.chapters[0]?.width||64)/2;
  for(const c of book.chapters){if(c.id===chapter.id){offset=edge+c.width/2;break;}edge+=c.width;}
  return triggerCircles(book).some(p => p.id !== candidate.id && Math.hypot(p.x-candidate.x-offset,p.z-candidate.z) < p.radius+reactionSize(candidate,chapter)-.00001);
}
export function newTriggerConflict(book, previous={chapters:[]}) {
  const before=new Map(triggerCircles(previous).map(p=>[p.id,p])),circles=triggerCircles(book);
  const samePair=(p,q)=>{const a=before.get(p.id),b=before.get(q.id);return a&&b&&a.x-b.x===p.x-q.x&&a.z-b.z===p.z-q.z&&a.radius===p.radius&&b.radius===q.radius;};
  return circles.some((p,i)=>circles.slice(i+1).some(q=>!samePair(p,q)&&Math.hypot(p.x-q.x,p.z-q.z)<p.radius+q.radius-.00001));
}
