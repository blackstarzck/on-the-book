import { test } from "node:test";
import assert from "node:assert/strict";
import { textPages } from "../shared/floor-reading.js";
import { routePoints } from "../shared/landscape.js";
import { chapterSchema } from "../shared/schema.js";
import { seed } from "../server/seed.js";
test("floor pagination retains the complete chapter, including emoji and paragraph breaks", () => {
  const text = ("책 속에서 토끼를 만났어요. 🌿 천천히 걸으며 이야기를 읽습니다.\n\n").repeat(12).trim();
  const pages = textPages(text);
  assert.equal(pages.join(""), text);
  assert.ok(pages.every(page => Array.from(page).length <= 112));
});
test("floor route connects chapter edges and each model in spatial order", () => {
  assert.deepEqual(routePoints({ width: 80, placements: [{x:12,z:8},{x:-10,z:-4}] }), [{x:-40,z:0},{x:-10,z:-4},{x:12,z:8},{x:40,z:0}]);
});
test("floor options accept disabled effects and reject invalid camera settings", () => {
  const chapter = {...seed.books[0].chapters[0], floorEnabled:false, floorArrows:false, floorDecor:"none", floorZoom:1.3};
  assert.equal(chapterSchema.parse(chapter).floorEnabled, false);
  assert.equal(chapterSchema.safeParse({...chapter, floorZoom:10}).success, false);
  assert.equal(chapterSchema.safeParse({...chapter, floorDecor:"unknown"}).success, false);
});
