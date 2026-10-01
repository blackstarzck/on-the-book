import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { startServer, sampleGLB } from "./helpers.js";
import { seed } from "../server/seed.js";
import { librarySchema } from "../shared/schema.js";
let server;
before(async () => {
  server = await startServer();
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
  const fd=new FormData();
  fd.append('image',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'thumb.png');
  const uploaded=await fetch(server.url+'/api/floor/upload',{method:'POST',headers:{'X-On-The-Book':'studio'},body:fd});
  assert.equal(uploaded.status,201);
  const {url:thumbnail}=await uploaded.json();
  const state = await (await request("/api/studio")).json();
  state.library.books[1].published = false;
  state.library.models.push({
    thumbnail,
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
const uploadPng = async () => {
  const fd = new FormData();
  fd.append("image", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "image.png");
  const uploaded = await fetch(server.url + "/api/floor/upload", { method: "POST", headers: { "X-On-The-Book": "studio" }, body: fd });
  assert.equal(uploaded.status, 201);
  return (await uploaded.json()).url;
};
test("readers get hero slides, main thumbnails and chapter thumbnails of published books only", async () => {
  const image = await uploadPng();
  const state = await (await request("/api/studio")).json();
  const [shown, hidden] = state.library.books;
  shown.published = true;
  hidden.published = false;
  shown.thumbnail = image;
  shown.chapters[0].thumbnail = image;
  state.library.home = { hero: [
    { id: "hero-hidden", bookId: hidden.id, image },
    { id: "hero-shown", bookId: shown.id, image, kicker: "새로 공개" },
  ] };
  const saved = await request("/api/studio", "PUT", { library: state.library, version: state.version, publish: true });
  assert.equal(saved.status, 200, await saved.text());
  const live = await (await request("/api/library")).json();
  assert.deepEqual(live.home.hero.map((s) => [s.id, s.kicker, s.focus]), [["hero-shown", "새로 공개", "center"]]);
  assert.deepEqual(live.books.map((b) => b.id), [shown.id]);
  assert.equal(live.books[0].thumbnail, image);
  assert.equal(live.books[0].chapters[0].thumbnail, image);
});
test("banner drafts can be incomplete, but publishing requires a URL and both uploaded images", async () => {
  let state = await (await request("/api/studio")).json();
  state.library.home.hero = [{ id: "banner", url: "", image: "", imageMobile: "" }];
  assert.equal((await request("/api/studio", "PUT", state)).status, 200);
  state = await (await request("/api/studio")).json();
  const banner = state.library.home.hero[0];
  for (const update of [{}, { url: "/about" }, { image: await uploadPng() }]) {
    Object.assign(banner, update);
    const res = await request("/api/studio", "PUT", { ...state, publish: true });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /PC용·모바일용/);
  }
  banner.imageMobile = "/uploads/00000000-0000-0000-0000-000000000000.png";
  assert.equal((await request("/api/studio", "PUT", { ...state, publish: true })).status, 400);
  banner.imageMobile = await uploadPng();
  assert.equal((await request("/api/studio", "PUT", { ...state, publish: true })).status, 200);
  const live = await (await request("/api/library")).json();
  assert.deepEqual(live.home.hero[0], banner);
  for (const url of [banner.image, banner.imageMobile]) assert.equal((await fetch(server.url + url)).status, 200);
});

test("an image that was never uploaded cannot be saved", async () => {
  const missing = "/uploads/00000000-0000-0000-0000-000000000000.png";
  for (const place of [(library) => { library.books[0].chapters[1].thumbnail = missing; }, (library) => { library.books[0].thumbnail = missing; }]) {
    const state = await (await request("/api/studio")).json();
    place(state.library);
    const res = await request("/api/studio", "PUT", { library: state.library, version: state.version });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "등록한 이미지 파일을 찾을 수 없습니다. 다시 올려 주세요.");
  }
});
test("configured administrator password protects reads/writes and session logout", async () => {
  const s = await startServer({ password: "test-only-password" });
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
test("still and unrigged GLB models are registered and placed like any other model", async () => {
  const upload = async (buffer) => {
    const f = new FormData();
    f.append("model", new Blob([buffer]), "scene.glb");
    const r = await fetch(server.url + "/api/models/upload", { method: "POST", headers: { "X-On-The-Book": "studio" }, body: f });
    assert.equal(r.status, 201, await r.clone().text());
    return r.json();
  };
  const still = await upload(sampleGLB(false, false));
  assert.equal(still.rigged, false);
  assert.deepEqual(still.clips, []);
  const moving = await upload(sampleGLB(false));
  assert.equal(moving.rigged, false);
  assert.deepEqual(moving.clips, ["Float"]);
  const thumbnail = await uploadPng();
  const state = await (await request("/api/studio")).json();
  const library = structuredClone(state.library);
  library.models.push(
    { id: "still-scene", name: "정적 장면", kind: "glb", url: still.url, thumbnail, credit: "Blender", color: "#777777" },
    { id: "moving-prop", name: "움직이는 소품", kind: "glb", url: moving.url, thumbnail, credit: "Blender", color: "#777777" },
  );
  const placement = (id, modelId, x, animation) =>
    ({ id, modelId, x, z: 22, scale: 1, rotation: 0, radius: 2, animation, clip: "", title: id, story: "" });
  const chapter = library.books[0].chapters[0];
  chapter.placements.push(placement("still-place", "still-scene", -26, "none"), placement("moving-place", "moving-prop", 26, "clip"));
  const save = (lib) => request("/api/studio", "PUT", { library: lib, version: state.version });
  const asksForMissingMotion = structuredClone(library);
  asksForMissingMotion.books[0].chapters[0].placements.find((p) => p.id === "still-place").animation = "clip";
  const refused = await save(asksForMissingMotion);
  assert.equal(refused.status, 400);
  assert.match((await refused.json()).error, /동작/);
  const saved = await save(library);
  assert.equal(saved.status, 200, await saved.clone().text());
  const after = await (await request("/api/studio")).json();
  const models = Object.fromEntries(after.library.models.map((m) => [m.id, m]));
  assert.deepEqual([models["still-scene"].rigged, models["still-scene"].clips], [false, []]);
  assert.deepEqual([models["moving-prop"].rigged, models["moving-prop"].clips], [false, ["Float"]]);
  const placed = after.library.books[0].chapters[0].placements;
  assert.equal(placed.find((p) => p.id === "still-place").animation, "none");
  assert.equal(placed.find((p) => p.id === "moving-place").animation, "clip");
});
