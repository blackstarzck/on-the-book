import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.js";

// vite.config.js exports a function of the build mode; list the HTML entries each build produces.
const entries = (mode) => Object.keys(config({ mode, command: "build" }).build.rollupOptions.input).sort();

test("the about page is built with the reader but not with the studio", () => {
  assert.deepEqual(entries("production"), ["about", "admin", "client"]);
  assert.deepEqual(entries("client"), ["about", "client"]);
  assert.deepEqual(entries("admin"), ["admin", "client"]);
});
