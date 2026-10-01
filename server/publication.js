import path from "node:path";
import { isServiceUrl } from "../shared/home.js";

// What readers may see. Stored cloud data is not re-parsed, so fields added later may be missing.
export function publicLibrary(db) {
  const books = db.live.books.filter((book) => book.published);
  const bookIds = new Set(books.map((book) => book.id));
  const used = new Set(books.flatMap((book) => book.chapters.flatMap((chapter) => chapter.placements.map((p) => p.modelId))));
  return {
    books,
    models: db.live.models.filter((model) => used.has(model.id)),
    home: { hero: (db.live.home?.hero ?? []).filter((slide) => slide.url ? isServiceUrl(slide.url) : bookIds.has(slide.bookId)) },
    publishedAt: db.publishedAt,
  };
}

// Only these keys hold uploaded files, so an address typed into a story never becomes public.
const assetKeys = new Set(["url", "thumbnail", "cover", "asset", "image", "imageMobile"]);
const uploadPath = /^\/uploads\/[a-f0-9-]+\.(png|glb)$/;
function uploadsIn(value, found = new Set()) {
  if (Array.isArray(value)) for (const item of value) uploadsIn(item, found);
  else if (value && typeof value === "object")
    for (const [key, item] of Object.entries(value)) {
      if (key === "url" && !value.kind) continue; // Navigation links never grant access to an upload.
      if (assetKeys.has(key) && typeof item === "string" && uploadPath.test(item)) found.add(item);
      else uploadsIn(item, found);
    }
  return found;
}

// Files a signed-out reader may download: exactly the uploads the public library points to.
export const publicAssetNames = (db) =>
  new Set([...uploadsIn(publicLibrary(db))].map((url) => path.basename(url)));

// PNG files that books and hero slides point to. Model files are checked with the models.
export const imageUrls = (library) =>
  new Set([...uploadsIn({ books: library.books, home: library.home })].filter((url) => url.endsWith(".png")));
