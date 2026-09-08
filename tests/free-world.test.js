import { test } from "node:test";
import assert from "node:assert/strict";
import { upgrade } from "../server/upgrade.js";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
test("legacy migration preserves models, spreads placements once, removes game settings", () => {
  const old = structuredClone(seed), c = old.books[0].chapters[0];
  delete c.width; delete c.depth; c.encounter = "rabbit";
  c.placements.forEach(p => { p.x /= 3; p.z /= 3; p.collectible = true; });
  const next = upgrade(old), result = next.books[0].chapters[0];
  assert.equal(result.width, 64); assert.equal(result.depth, 56);
  assert.equal(result.placements[0].x, -9);
  assert.equal(result.encounter, undefined); assert.equal(result.placements[0].collectible, undefined);
  assert.deepEqual(next.models, old.models); assert.deepEqual(upgrade(next), next);
  assert.equal(old.books[0].chapters[0].encounter, "rabbit");
});
test("placements outside resized chapter bounds are rejected", () => {
  const input = structuredClone(seed), c = input.books[0].chapters[0];
  c.width = 90; c.depth = 80; c.placements[0].x = 35; c.placements[0].radius = 12;
  assert.equal(librarySchema.safeParse(input).success, true);
  c.width = 40;
  assert.equal(librarySchema.safeParse(input).success, false);
});
