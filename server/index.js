import express from "express";
import multer from "multer";
import { randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { librarySchema } from "../shared/schema.js";
import { newTriggerConflict } from '../shared/experience.js';
import { modelInfo } from './model-info.js';
import { cloud, staging, uploadDir, readDraft, readLive, saveDraft, assetInfo, prepareUpload, takeStaged, storeUpload, signedDownload, saveSession, validSession, removeSession, readSite, siteAssetNames } from './storage.js';
import { publicLibrary, publicAssetNames, imageUrls } from './publication.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
app.disable("x-powered-by");
if (cloud) app.set('trust proxy', 1);
app.use((req, res, next) => {
  if (cloud) {
    if (!['client', 'admin'].includes(process.env.DEPLOYMENT_APP))
      return res.status(503).json({ error: '배포 환경 설정이 필요합니다.' });
    if (process.env.DEPLOYMENT_APP === 'client' && !((req.method === 'GET' || req.method === 'HEAD') && (req.path === '/api/library' || req.path.startsWith('/api/site/') || req.path.startsWith('/uploads/'))))
      return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    return next();
  }
  const host = req.hostname;
  if (host !== "127.0.0.1" && host !== "localhost")
    return res
      .status(403)
      .json({ error: "이 서버는 내 컴퓨터에서만 사용할 수 있습니다." });
  next();
});
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  next();
});
app.use(express.json({ limit: "3mb" }));
const password = process.env.ADMIN_PASSWORD;
const sessionToken = req => req.headers.cookie?.match(/(?:^|; )otb_session=([^;]+)/)?.[1];
function sameOrigin(req, res, next) {
  if (req.get("X-On-The-Book") !== "studio")
    return res.status(403).json({ error: "관리 화면에서 다시 시도해 주세요." });
  const origin = req.get("origin");
  if (origin && origin !== `${req.protocol}://${req.get("host")}`)
    return res.status(403).json({ error: "허용되지 않은 요청입니다." });
  next();
}
async function auth(req, res, next) {
  if (cloud && !password) return res.status(503).json({ error: '관리자 비밀번호 설정이 필요합니다.' });
  if (!password) return next();
  if (!await validSession(sessionToken(req)))
    return res.status(401).json({ error: "관리자 로그인이 필요합니다." });
  next();
}
const attempts = new Map();
app.post("/api/login", sameOrigin, async (req, res) => {
  if (cloud && !password) return res.status(503).json({ error: '관리자 비밀번호 설정이 필요합니다.' });
  const now = Date.now();
  const entry = attempts.get(req.ip) || { count: 0, until: now + 60000 };
  if (entry.until < now) {
    entry.count = 0;
    entry.until = now + 60000;
  }
  entry.count++;
  attempts.set(req.ip, entry);
  if (entry.count > 10)
    return res.status(429).json({ error: "잠시 후 다시 시도해 주세요." });
  if (password) {
    const given = Buffer.from(String(req.body.password || ""));
    const expected = Buffer.from(password);
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      return res.status(401).json({ error: "비밀번호가 일치하지 않습니다." });
  }
  const token = randomUUID();
  await saveSession(token, now + 8 * 60 * 60 * 1000);
  res.cookie("otb_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure,
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});
app.post("/api/logout", sameOrigin, async (req, res) => {
  await removeSession(sessionToken(req));
  res.clearCookie("otb_session");
  res.json({ ok: true });
});
app.get("/api/library", async (req, res) => {
  const live = await readLive();
  res.set("Cache-Control", "no-store");
  res.json(publicLibrary(live));
});
// 3D material used outside books, such as the about page journey.
app.get("/api/site/:key", async (req, res) => {
  const data = /^[a-z0-9-]{1,40}$/.test(req.params.key) ? await readSite(req.params.key) : null;
  if (!data) return res.status(404).json({ error: "요청을 찾을 수 없습니다." });
  res.set("Cache-Control", "no-store");
  res.json(data);
});
app.get("/api/studio", auth, async (req, res) => {
  const current = await readDraft();
  res.set("Cache-Control", "no-store");
  res.json({
    library: current.library,
    version: current.version,
    publishedAt: current.publishedAt,
    protected: !!password,
    // Supabase keeps no upload folder; its draft and publications are the ones the public reader reads.
    shared: !uploadDir,
  });
});
let saving = false;
const fileName = (url) => path.basename(url);
const missingFile = () => Object.assign(new Error("Missing asset"), { code: "ENOENT" });
app.put("/api/studio", sameOrigin, auth, async (req, res) => {
  const current = await readDraft();
  const draft = current.library;
  if (saving || req.body.version !== current.version)
    return res
      .status(409)
      .json({
        error: "다른 창에서 변경되었습니다. 새로고침 후 다시 저장해 주세요.",
      });
  const parsed = librarySchema.safeParse(req.body.library);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: parsed.error.issues.map((i) => i.message).join(" ") });
  if(req.body.publish&&parsed.data.books.some(b=>b.published&&(!b.author.trim()||!b.rights.trim())))return res.status(400).json({error:'공개할 도서의 저자와 권리 정보를 완성해 주세요.'});
  saving = true;
  try {
    if(req.body.publish)for(const b of parsed.data.books.filter(b=>b.published))for(const c of b.chapters)if(!c.mainPlacementId)return res.status(400).json({error:`“${b.title} / ${c.title}”에 메인 모델을 배치한 뒤 공개해 주세요.`});
    for(const book of parsed.data.books)if(newTriggerConflict(book,draft.books.find(b=>b.id===book.id)))return res.status(400).json({error:'모델의 애니메이션 발동 영역이 겹칩니다. 위치나 발동 반경을 조정해 주세요.'});
    // Only images new to the draft are checked; model files and thumbnails are checked on every save.
    const known = imageUrls(draft);
    const newImages = [...imageUrls(parsed.data)].filter((url) => !known.has(url));
    const stored = await assetInfo([
      ...parsed.data.models.flatMap((m) => [m.thumbnail, m.kind === "glb" ? m.url : undefined]),
      ...newImages,
    ].filter(Boolean).map(fileName));
    for (const model of parsed.data.models) {
      const previous=draft.models.find(m=>m.id===model.id);
      if ((!previous || previous.thumbnail) && !model.thumbnail)
        return res.status(400).json({error:'모델 썸네일을 등록해 주세요.'});
      if(model.thumbnail&&!stored.has(fileName(model.thumbnail)))throw missingFile();
    }
    for (const model of parsed.data.models)
      if (model.kind === "glb") {
        const info=stored.get(fileName(model.url));
        if(!info)throw missingFile();
        Object.assign(model,{rigged:info.rigged,clips:info.clips});
      } else { model.rigged=false;model.clips=[]; }
    // A file motion needs a clip inside the file (an empty name plays the first one). Placements saved
    // earlier are left as they are unless their model or motion changes.
    const motion=p=>`${p.modelId}|${p.animation}|${p.clip}`;
    const prior=new Map(draft.books.flatMap(b=>b.chapters.flatMap(c=>c.placements)).map(p=>[p.id,motion(p)]));
    for(const p of parsed.data.books.flatMap(b=>b.chapters.flatMap(c=>c.placements))){
      const model=parsed.data.models.find(m=>m.id===p.modelId);
      if(prior.get(p.id)!==motion(p)&&model?.kind==='glb'&&p.animation==='clip'&&(!model.clips.length||(p.clip&&!model.clips.includes(p.clip))))return res.status(400).json({error:'모델 파일에 없는 동작입니다. 파일에 담긴 동작이나 기본 동작을 선택해 주세요.'});
    }
    for (const url of newImages) if (!stored.has(fileName(url)))
      return res.status(400).json({ error: "등록한 이미지 파일을 찾을 수 없습니다. 다시 올려 주세요." });
    const saved = await saveDraft({ version: current.version, library: parsed.data, publish: !!req.body.publish });
    res.json({ version: saved.version, publishedAt: saved.publishedAt ?? current.publishedAt });
  } catch (e) {
    if (e.status === 409)
      return res.status(409).json({ error: '다른 창에서 변경되었습니다. 새로고침 후 다시 저장해 주세요.' });
    if (e.status === 426)
      return res.status(409).json({ error: '이 관리 화면은 저장된 데이터보다 오래된 버전입니다. 최신 관리 화면에서 저장해 주세요.' });
    res
      .status(500)
      .json({
        error:
          e.code === "ENOENT"
            ? "등록한 모델 파일을 찾을 수 없습니다."
            : "저장하지 못했습니다. 다시 시도해 주세요.",
      });
  } finally {
    saving = false;
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
const floorUpload = multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}});
// Browsers on Vercel send files straight to storage, because a function request body is small;
// the server then checks the staged file exactly like a direct upload.
if (staging) {
  app.post('/api/uploads/prepare', sameOrigin, auth, async (req, res) => {
    const image = req.body.kind === 'image';
    if (!image && req.body.kind !== 'model') return res.status(400).json({ error: '파일 종류를 확인해 주세요.' });
    const limit = (image ? 5 : 25) * 1024 * 1024;
    if (!Number.isInteger(req.body.size) || req.body.size < 1 || req.body.size > limit)
      return res.status(400).json({ error: image ? 'PNG 이미지는 5MB 이하로 올려 주세요.' : '모델은 25MB 이하로 올려 주세요.' });
    res.json(await prepareUpload(image ? '.png' : '.glb'));
  });
  app.use(['/api/floor/upload', '/api/models/upload'], sameOrigin, auth, async (req, res, next) => {
    if (req.method !== 'POST' || !req.is('application/json')) return next();
    const filename = req.body.filename;
    const pattern = req.originalUrl.split('?')[0] === '/api/floor/upload' ? /^[a-f0-9-]{36}\.png$/ : /^[a-f0-9-]{36}\.glb$/;
    if (!pattern.test(filename || '')) return res.status(400).json({ error: '업로드한 파일을 찾을 수 없습니다.' });
    try { req.file = { buffer: await takeStaged(filename) }; }
    catch (e) {
      if (e.code === 'ENOENT') return res.status(400).json({ error: '업로드한 파일을 찾을 수 없습니다.' });
      throw e;
    }
    if (req.file.buffer.length > (filename.endsWith('.png') ? 5 : 25) * 1024 * 1024)
      return res.status(400).json({ error: '파일 크기가 제한을 초과했습니다.' });
    next();
  });
}
app.post('/api/floor/upload', sameOrigin, auth, (req,res,next)=>floorUpload.single('image')(req,res,error=>{
  if(error)return res.status(400).json({error:'PNG 이미지는 5MB 이하로 올려 주세요.'});
  next();
}), async(req,res)=>{
  const b=req.file?.buffer;
  if(!b || b.length<45 || !b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || b.toString('ascii',12,16)!=='IHDR' || b.readUInt32BE(8)!==13)
    return res.status(400).json({error:'올바른 PNG 이미지 파일을 선택해 주세요.'});
  const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
  let offset=8,ended=false,hasData=false;
  while(offset+12<=b.length){const size=b.readUInt32BE(offset);if(size>b.length-offset-12)break;const type=b.toString('ascii',offset+4,offset+8);offset+=size+12;if(type==='IDAT')hasData=true;if(type==='IEND'){ended=size===0&&offset===b.length;break;}}
  if(!ended||!hasData||!width||!height||width>4096||height>4096)
    return res.status(400).json({error:'가로·세로 4096 이하의 완전한 PNG 이미지가 필요합니다.'});
  const filename=randomUUID()+'.png';
  try{await storeUpload(filename,b,{width,height});res.status(201).json({url:'/uploads/'+filename,width,height});}
  catch{res.status(500).json({error:'이미지를 저장하지 못했습니다.'});}
});
app.post(
  "/api/models/upload",
  sameOrigin,
  auth,
  upload.single("model"),
  async (req, res) => {
    const b = req.file?.buffer;
    if (
      !b ||
      b.length < 20 ||
      b.toString("ascii", 0, 4) !== "glTF" ||
      b.readUInt32LE(4) !== 2 ||
      b.readUInt32LE(8) !== b.length
    )
      return res
        .status(400)
        .json({ error: "올바른 GLB 2.0 파일을 선택해 주세요." });
    try {
      const size = b.readUInt32LE(12);
      if (b.readUInt32LE(16) !== 0x4e4f534a || size + 20 > b.length)
        throw Error();
      const json = JSON.parse(b.toString("utf8", 20, 20 + size));
      if (json.asset?.version !== "2.0" || !json.scenes?.length) throw Error();
      if (
        [...(json.buffers || []), ...(json.images || [])].some(
          (x) => x.uri && !x.uri.startsWith("data:"),
        )
      )
        throw Error();
      // Still scenes and props are registered too; the skeleton only decides whether the model counts as rigged.
      const { rigged, clips } = modelInfo(b);
      const filename = randomUUID() + ".glb";
      try { await storeUpload(filename, b, { rigged, clips }); }
      catch { return res.status(500).json({ error: "모델을 저장하지 못했습니다. 다시 시도해 주세요." }); }
      res.status(201).json({ url: "/uploads/" + filename, clips, rigged, bytes: b.length });
    } catch {
      res
        .status(400)
        .json({
          error: "장면과 텍스처가 포함된 독립형 GLB 파일이 필요합니다.",
        });
    }
  },
);
// Signed-out readers get exactly the files the public library points to. The local studio without a
// password sees every file, as it did when files sat in its data folder.
// A page asks for many files at once, so the public names are kept for a minute instead of reading the
// publication for every file. A name the kept list lacks is looked up again, so a new publication shows
// at once; a file taken out of the publication stays readable for at most that minute.
const PUBLIC_NAMES_LIFE = 60 * 1000;
let publicNames = { names: new Set(), at: 0 };
let publicLookup = null;
async function readPublicNames() {
  const [live, site] = await Promise.all([readLive(), siteAssetNames()]);
  return new Set([...publicAssetNames(live), ...site]);
}
async function isPublic(filename) {
  if (Date.now() - publicNames.at < PUBLIC_NAMES_LIFE && publicNames.names.has(filename)) return true;
  // Files asked for together share one lookup.
  publicLookup ??= readPublicNames()
    .then((names) => { publicNames = { names, at: Date.now() }; return names; })
    .finally(() => { publicLookup = null; });
  return (await publicLookup).has(filename);
}
async function mayDownload(req, filename) {
  if (!cloud && !password) return true;
  if (await isPublic(filename)) return true;
  if (cloud && process.env.DEPLOYMENT_APP !== 'admin') return false;
  return validSession(sessionToken(req));
}
if (uploadDir) app.use(
  "/uploads",
  express.static(uploadDir, { immutable: true, maxAge: "1y" }),
);
else app.get('/uploads/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!/^[a-f0-9-]{36}\.(png|glb|webp)$/.test(filename) || !(await mayDownload(req, filename))) return res.sendStatus(404);
  let signed;
  try { signed = await signedDownload(filename); }
  catch (e) {
    if (e.code === 'ENOENT') return res.sendStatus(404);
    throw e;
  }
  // The browser may keep an image's redirect for 10 minutes, well inside the life the signed address has left.
  const keep = Math.min(600, Math.floor((signed.expires - Date.now()) / 1000) - 300);
  res.set('Cache-Control', filename.endsWith('.png') && keep > 0 ? `private, max-age=${keep}` : 'private, no-store');
  res.redirect(307, signed.url);
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "요청을 찾을 수 없습니다." }),
);
app.get("/", (req, res) => res.redirect("/client/"));
app.get("/about", (req, res) => res.redirect("/client/about/"));
// The studio is one page: its deep addresses (/admin/models, /admin/books/:id) all get admin/index.html.
const studioPage = /^\/admin\/(?:home|models|settings|books\/[^/]+)\/?$/;
app.use((req, res, next) => {
  if ((req.method === "GET" || req.method === "HEAD") && studioPage.test(req.path)) req.url = "/admin/index.html";
  next();
});
if (!cloud && process.argv.includes("--production"))
  app.use(express.static(path.join(root, "dist")));
else if (!cloud) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "mpa",
  });
  app.use(vite.middlewares);
}
app.use((err, req, res, next) =>
  res
    .status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400)
    .json({
      error:
        err.code === "LIMIT_FILE_SIZE"
          ? "모델은 25MB 이하로 올려 주세요."
          : "요청을 처리할 수 없습니다.",
    }),
);
// PORT=0 lets the system pick a free port, so the log names the port actually bound.
const port = Number(process.env.PORT || 4173);
if (!cloud) {
  const server = app.listen(port, "127.0.0.1", () => {
    const bound = server.address().port;
    console.log(`On the Book: http://127.0.0.1:${bound}/client/ | Studio: http://127.0.0.1:${bound}/admin/`);
    // A test that starts this server over an IPC channel (tests/helpers.js) learns the port from this message, so it
    // only ever reaches its own server. The server also stops when that test process goes away, leaving no orphan.
    if (process.send) {
      process.send({ listening: bound });
      process.once("disconnect", () => process.exit(0));
    }
  });
}
export default app;


