import test from "node:test";
import assert from "node:assert/strict";
import { librarySchema } from "../shared/schema.js";
import { seed } from "../server/seed.js";
import { toRows, fromRows } from "../server/rows.js";

const library = () => librarySchema.parse(structuredClone(seed));

test("the sample library survives the trip through table rows", () => {
  const original = library();
  assert.deepEqual(librarySchema.parse(fromRows(toRows(original))), original);
});

test("rows keep shelf, chapter, placement, model and slide order", () => {
  const original = library();
  original.books.reverse();
  original.models.reverse();
  original.books[0].chapters.reverse();
  original.books[0].chapters[0].placements.reverse();
  original.home.hero = [
    { id: "slide-b", bookId: original.books[1].id, image: "", focus: "left", kicker: "둘", title: "", description: "" },
    { id: "slide-a", bookId: original.books[0].id, image: "", focus: "center", kicker: "하나", title: "", description: "" },
  ];
  const rows = toRows(original);
  // The database may hand rows back in any order.
  for (const list of Object.values(rows)) list.reverse();
  assert.deepEqual(librarySchema.parse(fromRows(rows)), librarySchema.parse(original));
});

test("each managed point becomes one row with its parent and position", () => {
  const original = library();
  const rows = toRows(original);
  const book = original.books[0];
  const chapter = book.chapters[1];
  const placement = chapter.placements[0];
  assert.equal(rows.books.length, original.books.length);
  assert.equal(rows.models.length, original.models.length);
  assert.equal(rows.chapters.length, original.books.flatMap((b) => b.chapters).length);
  assert.equal(rows.placements.length, original.books.flatMap((b) => b.chapters.flatMap((c) => c.placements)).length);
  assert.deepEqual(
    rows.chapters.find((row) => row.id === chapter.id),
    {
      id: chapter.id, book_id: book.id, sort_order: 1, main_placement_id: chapter.mainPlacementId,
      title: chapter.title, subtitle: chapter.subtitle, body: chapter.body, theme: chapter.theme,
      thumbnail: chapter.thumbnail, width: chapter.width, depth: chapter.depth,
      floor_arrows: chapter.floorArrows, floor_route: chapter.floorRoute, floor_arrow_spacing: chapter.floorArrowSpacing,
      floor_arrow_scale: chapter.floorArrowScale, floor_decals: chapter.floorDecals, floor_decor: chapter.floorDecor,
      floor_enabled: chapter.floorEnabled, floor_text: chapter.floorText, floor_offset_x: chapter.floorOffsetX,
      floor_offset_z: chapter.floorOffsetZ, reaction_multiplier: chapter.reactionMultiplier,
      floor_page_size: chapter.floorPageSize, floor_stagger: chapter.floorStagger, floor_zoom: chapter.floorZoom,
    },
  );
  assert.equal(rows.placements.find((row) => row.id === placement.id).chapter_id, chapter.id);
  assert.equal(rows.placements.find((row) => row.id === placement.id).model_id, placement.modelId);
});

test("optional fields stay absent instead of turning into null", () => {
  const original = library();
  original.models.push({
    id: "scene", name: "비 오는 골목", kind: "glb", rigged: false, clips: [],
    url: "/uploads/231fbc36-9c36-47b4-3ae3-fd62538df777.glb",
    thumbnail: "/uploads/28cf9580-bac4-4517-0deb-7603ff599f29.png",
    credit: "Blender", color: "#625f5a",
  });
  original.books[0].floorAssets = [{ asset: "/uploads/28cf9580-bac4-4517-0deb-7603ff599f29.png", name: "빗물" }];
  original.books[0].chapters[0].floorRoute = [{ x: 1, z: 2 }, { x: 3, z: 4 }];
  original.books[0].chapters[0].floorDecals = [
    { id: "decal-1", asset: "leaves", y: 0, x: 1, z: 1, width: 2, height: 2, rotation: 30 },
  ];
  const parsed = librarySchema.parse(original);
  const back = fromRows(toRows(parsed));
  assert.equal("url" in back.models[0], false);
  assert.equal("thumbnail" in back.models[0], false);
  assert.equal("floorAssets" in back.books[1], false);
  assert.deepEqual(back.models.at(-1), parsed.models.at(-1));
  assert.deepEqual(back.books[0].floorAssets, parsed.books[0].floorAssets);
  assert.deepEqual(back.books[0].chapters[0].floorRoute, [{ x: 1, z: 2 }, { x: 3, z: 4 }]);
  assert.deepEqual(librarySchema.parse(back), parsed);
});

// The sample library's intros are empty, which the schema default would restore even if they were dropped.
test("author and book intros survive the trip, and rows from before their columns read back empty", () => {
  const original = library();
  original.books[0].authorIntro = "옥스퍼드의 수학 강사였어요.\n\n본명은 찰스 럿위지 도지슨이에요.";
  original.books[0].bookIntro = "흰 토끼를 따라간 앨리스의 이야기예요.";
  const rows = toRows(original);
  assert.equal(rows.books[0].author_intro, original.books[0].authorIntro);
  assert.equal(rows.books[0].book_intro, original.books[0].bookIntro);
  assert.deepEqual(librarySchema.parse(fromRows(rows)), original);
  // A row saved before 20260929090000_book_intros.sql, or by an older studio, holds null in both columns.
  for (const row of rows.books) Object.assign(row, { author_intro: null, book_intro: null });
  const back = fromRows(rows);
  assert.equal("authorIntro" in back.books[0], false);
  assert.equal("bookIntro" in back.books[0], false);
  const parsed = librarySchema.parse(back).books[0];
  assert.deepEqual([parsed.authorIntro, parsed.bookIntro], ["", ""]);
});
