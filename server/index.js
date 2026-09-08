import express from "express";
import multer from "multer";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { librarySchema } from "../shared/schema.js";
import { seed } from "./seed.js";
import { upgrade } from "./upgrade.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const uploadDir = path.join(dataDir, "uploads");
await mkdir(uploadDir, { recursive: true });
const dbFile = path.join(dataDir, "library.json");
let db;
try {
  db = JSON.parse(await readFile(dbFile, "utf8"));
  const previous = JSON.stringify(db, null, 2);
  db.draft = librarySchema.parse(upgrade(db.draft));
  db.live = librarySchema.parse(upgrade(db.live));
  if (previous !== JSON.stringify(db, null, 2)) {
    await writeFile(path.join(dataDir, `library-before-free-world-${Date.now()}.json`), previous);
    db.version++;
    await writeFile(dbFile + ".tmp", JSON.stringify(db, null, 2));
    await rename(dbFile + ".tmp", dbFile);
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  db = {
    version: 1,
    draft: seed,
    live: seed,
    publishedAt: new Date().toISOString(),
  };
  await writeFile(dbFile, JSON.stringify(db, null, 2));
}
let queue = Promise.resolve();
const persist = (next) => {
  const operation = queue.then(async () => {
    await writeFile(dbFile + ".tmp", JSON.stringify(next, null, 2));
    await rename(dbFile + ".tmp", dbFile);
    db = next;
  });
  queue = operation.catch(() => {});
  return operation;
};
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
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
const sessions = new Map();
function sameOrigin(req, res, next) {
  if (req.get("X-On-The-Book") !== "studio")
    return res.status(403).json({ error: "관리 화면에서 다시 시도해 주세요." });
  const origin = req.get("origin");
  if (origin && origin !== `${req.protocol}://${req.get("host")}`)
    return res.status(403).json({ error: "허용되지 않은 요청입니다." });
  next();
}
function auth(req, res, next) {
  if (!password) return next();
  const token = req.headers.cookie?.match(/(?:^|; )otb_session=([^;]+)/)?.[1];
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now())
    return res.status(401).json({ error: "관리자 로그인이 필요합니다." });
  next();
}
const attempts = new Map();
app.post("/api/login", sameOrigin, (req, res) => {
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
  sessions.set(token, now + 8 * 60 * 60 * 1000);
  res.cookie("otb_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: req.secure,
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json({ ok: true });
});
app.post("/api/logout", sameOrigin, (req, res) => {
  const token = req.headers.cookie?.match(/(?:^|; )otb_session=([^;]+)/)?.[1];
  sessions.delete(token);
  res.clearCookie("otb_session");
  res.json({ ok: true });
});
app.get("/api/library", (req, res) => {
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
app.get("/api/studio", auth, (req, res) => {
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
  saving = true;
  try {
    for (const model of parsed.data.models)
      if (model.kind === "glb")
        await readFile(path.join(uploadDir, path.basename(model.url)));
    const next = { ...db, draft: parsed.data, version: db.version + 1 };
    if (req.body.publish) {
      next.live = structuredClone(parsed.data);
      next.publishedAt = new Date().toISOString();
    }
    await persist(next);
    res.json({ version: db.version, publishedAt: db.publishedAt });
  } catch (e) {
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
      const filename = randomUUID() + ".glb";
      await writeFile(path.join(uploadDir, filename), b);
      res
        .status(201)
        .json({
          url: "/uploads/" + filename,
          clips: (json.animations || []).map(
            (a, i) => a.name || `animation_${i}`,
          ),
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
app.use(
  "/uploads",
  express.static(uploadDir, { immutable: true, maxAge: "1y" }),
);
app.use("/api", (req, res) =>
  res.status(404).json({ error: "요청을 찾을 수 없습니다." }),
);
app.get("/", (req, res) => res.redirect("/client/"));
if (process.argv.includes("--production"))
  app.use(express.static(path.join(root, "dist")));
else {
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
app.listen(port, "127.0.0.1", () =>
  console.log(
    `On the Book: http://127.0.0.1:${port}/client/ | Studio: http://127.0.0.1:${port}/admin/`,
  ),
);
