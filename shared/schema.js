import { z } from "zod";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = z.string().trim().min(1).max(200);
export const kinds = [
  "rabbit",
  "mushroom",
  "teapot",
  "tree",
  "rose",
  "key",
  "clock",
  "cards",
  "house",
  "glb",
];
export const animations = ["hop", "spin", "float", "sway", "clip", "none"];
export const modelSchema = z
  .object({
    id,
    name: text,
    kind: z.enum(kinds),
    rigged: z.boolean().default(false),
    clips: z.array(z.string().max(200)).max(100).default([]),
    url: z
      .string()
      .regex(/^\/uploads\/[a-f0-9-]+\.glb$/)
      .optional(),
    credit: z.string().max(500),
    color: z.string().regex(/^#[a-f0-9]{6}$/i),
  })
  .refine((m) => m.kind !== "glb" || m.url, {
    message: "GLB 파일을 등록해 주세요.",
  });
export const placementSchema = z.object({
  id,
  modelId: id,
  x: z.number().min(-59).max(59),
  y: z.number().min(0).max(40).default(0),
  z: z.number().min(-49).max(49),
  scale: z.number().min(0.1).max(8),
  rotation: z.number().min(-360).max(360),
  radius: z.number().min(0.5).max(20),
  collision: z.boolean().default(true),
  collisionRadius: z.number().min(.1).max(20).default(.8),
  animation: z.enum(animations),
  clip: z.string().max(200).default(""),
  title: text,
  story: z.string().max(4000),
});
export const chapterSchema = z.object({
  mainPlacementId: id.nullable().optional(),
  id,
  title: text,
  subtitle: z.string().max(250),
  body: z.string().max(15000),
  theme: z.enum(["meadow", "night", "tea", "rose", "gold"]),
  width: z.number().min(40).max(120).default(64),
  depth: z.number().min(40).max(100).default(56),
  floorArrows: z.boolean().default(true),
  floorRoute: z.array(z.object({ x: z.number().min(-59).max(59), z: z.number().min(-49).max(49) })).max(40).nullable().default(null),
  floorArrowSpacing: z.number().min(2).max(12).default(4.5),
  floorArrowScale: z.number().min(.3).max(3).default(1),
  floorDecals: z.array(z.object({
    id, asset: z.string().regex(/^(leaves|pocket-watch|tea-cup|open-book|arrow|\/uploads\/[a-f0-9-]+\.png)$/),
    y: z.number().min(0).max(40).default(0),
    x: z.number().min(-59).max(59), z: z.number().min(-49).max(49),
    width: z.number().min(.2).max(30), height: z.number().min(.2).max(30),
    rotation: z.number().min(-360).max(360),
  })).max(100).nullable().default(null),
  floorDecor: z.enum(["auto", "none", "leaves", "pocket-watch", "tea-cup", "open-book"]).default("auto"),
  floorEnabled: z.boolean().default(true),
  floorText: z.string().max(15000).default(""),
  floorOffsetX: z.number().min(-16).max(16).default(0),
  floorOffsetZ: z.number().min(-16).max(16).default(-9),
  reactionMultiplier: z.number().min(1).max(4).default(2),
  floorPageSize: z.number().int().min(40).max(400).default(112),
  floorStagger: z.boolean().default(true),
  floorZoom: z.number().min(1).max(1.8).default(1.1),
  placements: z.array(placementSchema).max(60),
}).transform(c=>({...c,mainPlacementId:c.mainPlacementId===undefined?(c.placements[0]?.id??null):c.mainPlacementId}))
.refine(c=>c.placements.length?c.placements.some(p=>p.id===c.mainPlacementId):c.mainPlacementId===null,{message:'챕터에 배치된 메인 모델을 하나 지정해 주세요.'})
.refine(c => [...c.placements, ...(c.floorRoute || []), ...(c.floorDecals || [])].every(p => Math.abs(p.x) <= c.width / 2 - 1 && Math.abs(p.z) <= c.depth / 2 - 1), { message: "모델과 바닥 배치의 중심을 챕터 공간 안에 놓아 주세요." });
export const bookSchema = z.object({
  id,
  title: text,
  englishTitle: text,
  author: z.string().max(200),
  cover: z.string().regex(/^\/uploads\/[a-f0-9-]+\.png$/).or(z.literal('')).default(''),
  floorAssets: z.array(z.object({asset:z.string().regex(/^\/uploads\/[a-f0-9-]+\.png$/),name:text})).max(300).optional(),
  year: z.number().int().min(1).max(2026),
  description: z.string().max(1000),
  source: z.url().refine((s) => /^https?:/.test(s)),
  rights: z.string().max(1000),
  published: z.boolean(),
  chapters: z.array(chapterSchema).min(1).max(40),
});
export const librarySchema = z
  .object({
    models: z.array(modelSchema).max(300),
    books: z.array(bookSchema).max(50),
  })
  .superRefine((s, c) => {
    const modelIds = new Set(s.models.map((m) => m.id));
    const seen = new Set();
    for (const row of [
      ...s.models,
      ...s.books,
      ...s.books.flatMap((b) => b.chapters),
      ...s.books.flatMap((b) => b.chapters.flatMap((c) => c.placements)),
    ]) {
      if (seen.has(row.id))
        c.addIssue({ code: "custom", message: "중복된 항목 ID가 있습니다." });
      seen.add(row.id);
    }
    for (const p of s.books.flatMap((b) =>
      b.chapters.flatMap((c) => c.placements),
    ))
      if (!modelIds.has(p.modelId))
        c.addIssue({
          code: "custom",
          message: "배치된 모델을 먼저 장면에서 제거해 주세요.",
        });
  });
