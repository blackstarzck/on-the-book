import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { startServer, sampleGLB } from "./helpers.js";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
let server;
before(async () => {
  server = await startServer(4274);
});
after(async () => server?.stop());
const request = (url, method = "GET", body, headers = {}) =>
  fetch(server.url + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-On-The-Book": "studio",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
test("sample books have valid references and unique identifiers", () =>
  assert.equal(librarySchema.safeParse(seed).success, true));

test('publishing a book with an empty chapter and saving an invalid main are rejected',async()=>{
 const state=await(await request('/api/studio')).json();const c=state.library.books[0].chapters[0];
 c.mainPlacementId='missing-model';assert.equal((await request('/api/studio','PUT',state)).status,400);
 c.mainPlacementId=null;c.placements=[];state.publish=true;
 assert.equal((await request('/api/studio','PUT',state)).status,400);
});
test("negative radius, duplicate IDs and missing model references are rejected", () => {
  for (const edit of [
    (s) => (s.books[0].chapters[0].placements[0].radius = -1),
    (s) => (s.models[1].id = s.models[0].id),
    (s) => s.models.shift(),
  ]) {
    const s = structuredClone(seed);
    edit(s);
    assert.equal(librarySchema.safeParse(s).success, false);
  }
});
test("drafts persist on disk while published snapshot stays unchanged; stale writes fail", async () => {
  const state = await (await request("/api/studio")).json();
  state.library.books[0].title = "저장 검증 책";
  const res = await request("/api/studio", "PUT", {
    library: state.library,
    version: state.version,
  });
  assert.equal(res.status, 200);
  const disk = JSON.parse(
    await readFile(path.join(server.dir, "library.json"), "utf8"),
  );
  assert.equal(disk.draft.books[0].title, "저장 검증 책");
  assert.equal(disk.live.books[0].title, seed.books[0].title);
  assert.equal(
    (await (await request("/api/library")).json()).books[0].title,
    seed.books[0].title,
  );
  assert.equal(
    (
      await request("/api/studio", "PUT", {
        library: state.library,
        version: state.version,
      })
    ).status,
    409,
  );
});
test("publishing applies changes and excludes private books and unused assets", async () => {
  const state = await (await request("/api/studio")).json();
  state.library.books[1].published = false;
  state.library.models.push({
    id: "unused-test-model",
    name: "비공개 모델",
    kind: "tree",
    color: "#123456",
    credit: "Test",
  });
  assert.equal(
    (
      await request("/api/studio", "PUT", {
        library: state.library,
        version: state.version,
        publish: true,
      })
    ).status,
    200,
  );
  const live = await (await request("/api/library")).json();
  assert.equal(live.books.length, 1);
  assert.equal(live.books[0].title, "저장 검증 책");
  assert(!live.models.some((m) => m.id === "unused-test-model"));
});
test("cross-origin writes, invalid data and unknown endpoints fail clearly", async () => {
  const state = await (await request("/api/studio")).json();
  assert.equal(
    (
      await request(
        "/api/studio",
        "PUT",
        { library: state.library, version: state.version },
        { origin: "https://outside.example" },
      )
    ).status,
    403,
  );
  state.library.books[0].chapters[0].placements[0].scale = 0;
  assert.equal(
    (
      await request("/api/studio", "PUT", {
        library: state.library,
        version: state.version,
      })
    ).status,
    400,
  );
  assert.equal((await request("/api/missing")).status, 404);
});
test("valid animated GLB is saved and malformed upload is rejected", async () => {
  const f = new FormData();
  f.append("model", new Blob([sampleGLB()]), "test.glb");
  const r = await fetch(server.url + "/api/models/upload", {
    method: "POST",
    headers: { "X-On-The-Book": "studio" },
    body: f,
  });
  assert.equal(r.status, 201);
  const asset = await r.json();
  assert.deepEqual(asset.clips, ["Float"]);
  assert.equal((await fetch(server.url + asset.url)).status, 200);
  const bad = new FormData();
  bad.append("model", new Blob(["not a model"]), "invalid.glb");
  assert.equal(
    (
      await fetch(server.url + "/api/models/upload", {
        method: "POST",
        headers: { "X-On-The-Book": "studio" },
        body: bad,
      })
    ).status,
    400,
  );
});
test("configured administrator password protects reads/writes and session logout", async () => {
  const s = await startServer(4275, "test-only-password");
  try {
    assert.equal((await fetch(s.url + "/api/studio")).status, 401);
    const login = await fetch(s.url + "/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-On-The-Book": "studio",
      },
      body: JSON.stringify({ password: "test-only-password" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await fetch(s.url + "/api/studio", { headers: { cookie } })).status,
      200,
    );
    await fetch(s.url + "/api/logout", {
      method: "POST",
      headers: { cookie, "X-On-The-Book": "studio" },
    });
    assert.equal(
      (await fetch(s.url + "/api/studio", { headers: { cookie } })).status,
      401,
    );
  } finally {
    await s.stop();
  }
});
