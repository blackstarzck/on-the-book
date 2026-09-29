import { expect } from "@playwright/test";
import { startServer } from "./helpers.js";

// The studio's address. The server hands out the studio page at its deep paths.
const password = "test-only-password";
const server = await startServer(4351, password);
const pass = (message) => console.log(`PASS ${message}`);
try {
  for (const path of ["/admin/home", "/admin/models", "/admin/settings/", "/admin/books/alice", "/admin/books/alice/"]) {
    const response = await fetch(server.url + path);
    expect(response.status, path).toBe(200);
    expect(await response.text(), path).toContain('<div id="app"></div>');
  }
  for (const path of ["/admin/zzz", "/admin/books/", "/admin/books/alice/edit"])
    expect((await fetch(server.url + path)).status, path).toBe(404);
  pass("Deep studio paths serve the studio page and unknown ones stay 404");
} finally {
  await server.stop();
}
