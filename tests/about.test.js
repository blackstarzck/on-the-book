import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.js";
import { startServer } from "./helpers.js";

// vite.config.js exports a function of the build mode; list the HTML entries each build produces.
const entries = (mode) => Object.keys(config({ mode, command: "build" }).build.rollupOptions.input).sort();

test("the about page is built with the reader but not with the studio", () => {
  assert.deepEqual(entries("production"), ["about", "admin", "client"]);
  assert.deepEqual(entries("client"), ["about", "client"]);
  assert.deepEqual(entries("admin"), ["admin", "client"]);
});

test("the local /about address opens the client about page", async () => {
  const server = await startServer(4332);
  try {
    for (const address of ["/about", "/about/"]) {
      const response = await fetch(server.url + address, { redirect: "manual" });
      assert.equal(response.status, 302, address);
      assert.equal(response.headers.get("location"), "/client/about/", address);
    }
  } finally {
    await server.stop();
  }
});
