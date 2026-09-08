export function upgrade(library) {
  const next = structuredClone(library);
  for (const book of next.books) for (const chapter of book.chapters) {
    const legacy = chapter.width === undefined;
    chapter.width ??= 64; chapter.depth ??= 56;
    delete chapter.encounter;
    for (const p of chapter.placements) {
      if (legacy) { p.x *= 3; p.z *= 3; }
      delete p.collectible;
    }
  }
  return next;
}
