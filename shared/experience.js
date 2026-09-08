export function collisionSize(p) { return p.collision === false ? 0 : (p.collisionRadius ?? .8) * p.scale; }
export function reactionSize(p, chapter) { return (chapter.reactionMultiplier ?? 2) * Math.max(p.radius, p.collision !== false ? collisionSize(p) + .85 : 0); }
