// Each managed point is one database row. These tables list which library field lives in which column of
// supabase/migrations; save_draft fills the columns by these names, so every row carries every column.
// Fields marked optional are left out when the column is null, because the schema rejects null there.
const tables = {
  models: [
    ["id", "id"], ["name", "name"], ["kind", "kind"], ["rigged", "rigged"], ["clips", "clips"],
    ["url", "url", "optional"], ["thumbnail", "thumbnail", "optional"], ["credit", "credit"], ["color", "color"],
  ],
  books: [
    ["id", "id"], ["title", "title"], ["englishTitle", "english_title"], ["author", "author"],
    ["category", "category"], ["cover", "cover"], ["floorAssets", "floor_assets", "optional"], ["year", "year"],
    ["description", "description"], ["source", "source"], ["rights", "rights"], ["published", "published"],
  ],
  chapters: [
    ["id", "id"], ["mainPlacementId", "main_placement_id"], ["title", "title"], ["subtitle", "subtitle"],
    ["body", "body"], ["theme", "theme"], ["thumbnail", "thumbnail"], ["width", "width"], ["depth", "depth"],
    ["floorArrows", "floor_arrows"], ["floorRoute", "floor_route"], ["floorArrowSpacing", "floor_arrow_spacing"],
    ["floorArrowScale", "floor_arrow_scale"], ["floorDecals", "floor_decals"], ["floorDecor", "floor_decor"],
    ["floorEnabled", "floor_enabled"], ["floorText", "floor_text"], ["floorOffsetX", "floor_offset_x"],
    ["floorOffsetZ", "floor_offset_z"], ["reactionMultiplier", "reaction_multiplier"],
    ["floorPageSize", "floor_page_size"], ["floorStagger", "floor_stagger"], ["floorZoom", "floor_zoom"],
  ],
  placements: [
    ["id", "id"], ["modelId", "model_id"], ["x", "x"], ["y", "y"], ["z", "z"], ["scale", "scale"],
    ["rotation", "rotation"], ["radius", "radius"], ["collision", "collision"],
    ["collisionRadius", "collision_radius"], ["animation", "animation"], ["clip", "clip"],
    ["title", "title"], ["story", "story"],
  ],
  hero_slides: [
    ["id", "id"], ["bookId", "book_id"], ["image", "image"], ["focus", "focus"], ["kicker", "kicker"],
    ["title", "title"], ["description", "description"],
  ],
};

const row = (table, item, index, parent = {}) => {
  const out = { ...parent, sort_order: index };
  for (const [field, column] of tables[table]) out[column] = item[field] ?? null;
  return out;
};

const item = (table, stored) => {
  const out = {};
  for (const [field, column, optional] of tables[table]) {
    const value = stored[column];
    if (value === null && optional) continue;
    out[field] = value ?? null;
  }
  return out;
};

const ordered = (list) => [...list].sort((a, b) => a.sort_order - b.sort_order);
const byParent = (list, key) => {
  const groups = new Map();
  for (const stored of ordered(list)) {
    if (!groups.has(stored[key])) groups.set(stored[key], []);
    groups.get(stored[key]).push(stored);
  }
  return groups;
};

export function toRows(library) {
  const books = library.books;
  return {
    models: library.models.map((model, i) => row("models", model, i)),
    books: books.map((book, i) => row("books", book, i)),
    chapters: books.flatMap((book) => book.chapters.map((chapter, i) => row("chapters", chapter, i, { book_id: book.id }))),
    placements: books.flatMap((book) => book.chapters.flatMap((chapter) =>
      chapter.placements.map((placement, i) => row("placements", placement, i, { chapter_id: chapter.id })))),
    hero_slides: (library.home?.hero ?? []).map((slide, i) => row("hero_slides", slide, i)),
  };
}

export function fromRows(rows) {
  const chapters = byParent(rows.chapters ?? [], "book_id");
  const placements = byParent(rows.placements ?? [], "chapter_id");
  return {
    models: ordered(rows.models ?? []).map((stored) => item("models", stored)),
    books: ordered(rows.books ?? []).map((storedBook) => ({
      ...item("books", storedBook),
      chapters: (chapters.get(storedBook.id) ?? []).map((storedChapter) => ({
        ...item("chapters", storedChapter),
        placements: (placements.get(storedChapter.id) ?? []).map((stored) => item("placements", stored)),
      })),
    })),
    home: { hero: ordered(rows.hero_slides ?? []).map((stored) => item("hero_slides", stored)) },
  };
}
