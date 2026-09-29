import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";

// Every 3D model and Blender source is stored in Supabase; none may sit in the project folder.
// .claude holds other sessions' worktrees, which catch up when they merge main.
const skipped = new Set(["node_modules", ".git", ".claude"]);
const modelFile = /\.(glb|gltf|blend\d*|fbx|obj|usdz)$/i;

function modelFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (skipped.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return modelFiles(full);
    return modelFile.test(entry.name) ? [full] : [];
  });
}

test("the project folder holds no 3D model or Blender files", () => {
  assert.deepEqual(modelFiles("."), []);
});
