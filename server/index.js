import express from "express";
import multer from "multer";
import { BlobPreconditionFailedError } from '@vercel/blob';
import { randomUUID, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { librarySchema } from "../shared/schema.js";
import { newTriggerConflict } from '../shared/experience.js';
import { modelInfo } from './model-info.js';
import { cloud, uploadDir, readLibrary, persist, readAsset, writeAsset, signedAsset, removeStaging, saveSession, validSession, removeSession, publicAssetNames } from './storage.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
app.disable("x-powered-by");
if (cloud) app.set('trust proxy', 1);
app.use((req, res, next) => {
  if (cloud) {
    if (!['client', 'admin'].includes(process.env.DEPLOYMENT_APP))
      return res.status(503).json({ error: '배포 환경 설정이 필요합니다.' });
    if (process.env.DEPLOYMENT_APP === 'client' && !((req.method === 'GET' || req.method === 'HEAD') && (req.path === '/api/library' || req.path.startsWith('/uploads/'))))
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
  const { db } = await readLibrary();
  res.set("Cache-Control", "no-store");
  const books = db.live.books.filter((b) => b.published);
  const used = new Set(
    books.flatMap((b) =>
      b.chapters.flatMap((c) => c.placements.map((p) => p.modelId)),
    ),
  );
  res.json({
    books,
    models: db.live.models.filter((m) => used.has(m.id)),
    publishedAt: db.publishedAt,
  });
});
app.get("/api/studio", auth, async (req, res) => {
  const { db } = await readLibrary();
  res.set("Cache-Control", "no-store");
  res.json({
    library: db.draft,
    version: db.version,
    publishedAt: db.publishedAt,
    protected: !!password,
  });
});
let saving = false;
app.put("/api/studio", sameOrigin, auth, async (req, res) => {
  const snapshot = await readLibrary();
  const { db } = snapshot;
  if (saving || req.body.version !== db.version)
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
    for(const book of parsed.data.books)if(newTriggerConflict(book,db.draft.books.find(b=>b.id===book.id)))return res.status(400).json({error:'모델의 애니메이션 발동 영역이 겹칩니다. 위치나 발동 반경을 조정해 주세요.'});
    for (const model of parsed.data.models)
      if (model.kind === "glb") {
        const info=modelInfo(await readAsset(path.basename(model.url)));
        const existing=db.draft.models.find(m=>m.id===model.id&&m.url===model.url);
        if(!info.rigged&&!existing)return res.status(400).json({error:'뼈대 애니메이션이 있는 모델만 새로 등록할 수 있습니다.'});
        Object.assign(model,info);
      } else { model.rigged=false;model.clips=[]; }
    const prior=new Map(db.draft.books.flatMap(b=>b.chapters.flatMap(c=>c.placements)).map(p=>[p.id,p.modelId]));
    for(const p of parsed.data.books.flatMap(b=>b.chapters.flatMap(c=>c.placements))){
      const model=parsed.data.models.find(m=>m.id===p.modelId);
      if(prior.get(p.id)!==p.modelId&&model?.kind==='glb'&&(!model.rigged||p.animation!=='clip'||!model.clips.includes(p.clip)))return res.status(400).json({error:'새 배치에는 뼈대 모델과 등록된 애니메이션을 선택해 주세요.'});
    }
    for(const book of parsed.data.books)if(book.cover)await readAsset(path.basename(book.cover));
    for(const book of parsed.data.books)for(const item of book.floorAssets||[])await readAsset(path.basename(item.asset));
    for (const book of parsed.data.books) for (const chapter of book.chapters)
      for (const item of chapter.floorDecals || []) if (item.asset.startsWith('/uploads/'))
        await readAsset(path.basename(item.asset));
    const next = { ...db, draft: parsed.data, version: db.version + 1 };
    if (req.body.publish) {
      next.live = structuredClone(parsed.data);
      next.publishedAt = new Date().toISOString();
    }
    await persist(next, snapshot);
    res.json({ version: next.version, publishedAt: next.publishedAt });
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError || e.status === 409)
      return res.status(409).json({ error: '다른 창에서 변경되었습니다. 새로고침 후 다시 저장해 주세요.' });
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
if (cloud) {
  app.post('/api/uploads/prepare', sameOrigin, auth, async (req, res) => {
    const image = req.body.kind === 'image';
    if (!image && req.body.kind !== 'model') return res.status(400).json({ error: '파일 종류를 확인해 주세요.' });
    const limit = (image ? 5 : 25) * 1024 * 1024;
    if (!Number.isInteger(req.body.size) || req.body.size < 1 || req.body.size > limit)
      return res.status(400).json({ error: image ? 'PNG 이미지는 5MB 이하로 올려 주세요.' : '모델은 25MB 이하로 올려 주세요.' });
    const filename = randomUUID() + (image ? '.png' : '.glb');
    res.json({ filename, url: await signedAsset(`staging/${filename}`, 'put', limit) });
  });
  app.use(['/api/floor/upload', '/api/models/upload'], sameOrigin, auth, async (req, res, next) => {
    if (req.method !== 'POST') return next();
    const filename = req.body.filename;
    const pattern = req.originalUrl.split('?')[0] === '/api/floor/upload' ? /^[a-f0-9-]{36}\.png$/ : /^[a-f0-9-]{36}\.glb$/;
    if (!pattern.test(filename || '')) return res.status(400).json({ error: '업로드한 파일을 찾을 수 없습니다.' });
    req.file = { buffer: await readAsset(filename, true) };
    if (req.file.buffer.length > (filename.endsWith('.png') ? 5 : 25) * 1024 * 1024)
      return res.status(400).json({ error: '파일 크기가 제한을 초과했습니다.' });
    await removeStaging(filename);
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
  try{await writeAsset(filename,b);res.status(201).json({url:'/uploads/'+filename,width,height});}
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
      const rigged = (json.nodes || []).some(n => Number.isInteger(n.skin) && json.skins?.[n.skin]?.joints?.length && json.meshes?.[n.mesh]?.primitives?.some(p => Number.isInteger(p.attributes?.JOINTS_0) && Number.isInteger(p.attributes?.WEIGHTS_0)));
      const joints = new Set((json.skins || []).flatMap(s => s.joints || []));
      const hasMotion = (json.animations || []).some(a => a.channels?.some(c => joints.has(c.target?.node) && ['translation','rotation','scale'].includes(c.target?.path) && json.accessors?.[a.samplers?.[c.sampler]?.input]?.count > 1));
      if (!rigged || !hasMotion) return res.status(400).json({error:'뼈대가 연결되고 뼈대 애니메이션이 포함된 GLB 모델만 등록할 수 있습니다.'});
      const filename = randomUUID() + ".glb";
      await writeAsset(filename, b);
      res
        .status(201)
        .json({
          url: "/uploads/" + filename,
          clips: (json.animations || []).map(
            (a, i) => a.name || `animation_${i}`,
          ),
          rigged: true,
          bytes: b.length,
        });
    } catch {
      res
        .status(400)
        .json({
          error: "장면과 텍스처가 포함된 독립형 GLB 파일이 필요합니다.",
        });
    }
  },
);
if (cloud) app.get('/uploads/:filename', async (req, res) => {
  const { filename } = req.params;
  if (!/^[a-f0-9-]{36}\.(png|glb)$/.test(filename)) return res.sendStatus(404);
  const { db } = await readLibrary();
  if (!publicAssetNames(db).has(filename) && !(process.env.DEPLOYMENT_APP === 'admin' && await validSession(sessionToken(req))))
    return res.sendStatus(404);
  res.set('Cache-Control', 'private, no-store');
  res.redirect(307, await signedAsset(`uploads/${filename}`));
});
else app.use(
  "/uploads",
  express.static(uploadDir, { immutable: true, maxAge: "1y" }),
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "요청을 찾을 수 없습니다." }),
);
app.get("/", (req, res) => res.redirect("/client/"));
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
const port = Number(process.env.PORT || 4173);
if (!cloud) app.listen(port, "127.0.0.1", () =>
  console.log(
    `On the Book: http://127.0.0.1:${port}/client/ | Studio: http://127.0.0.1:${port}/admin/`,
  ),
);
export default app;


