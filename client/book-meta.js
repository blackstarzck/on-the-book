// Book metadata that both the bookshelf and the detail pages derive from library data:
// the category the studio typed (or the legacy table in shared/home.js) and the uploaded cover.
// Keep this file free of CSS and image imports so `node --test` can load it.
import { esc } from "../shared/ui.js";
import { bookCategory } from "../shared/home.js";

export function edition(book) {
  return { category: bookCategory(book) };
}

// Books without an uploaded cover keep the empty slot.
export function bookCover(book) {
  if (!book?.cover) return '<span class="catalog-cover image-placeholder" role="img" aria-label="표지 이미지 준비 중"></span>';
  return `<span class="catalog-cover image-placeholder"><img src="${esc(book.cover)}" alt="" loading="lazy" decoding="async" draggable="false"></span>`;
}
