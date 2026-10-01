// Book metadata that both the bookshelf and the detail pages derive from library data:
// the category, uploaded cover and public-domain cover for known source works.
// Keep this file free of CSS and image imports so `node --test` can load it.
import { esc } from "../shared/ui.js";
import { bookCategory } from "../shared/home.js";

export function edition(book) {
  return { category: bookCategory(book) };
}

// Match the source work, not an editable title or a book id. Uploaded covers take priority.
// Provenance and reuse information: public/book-covers/README.md.
const sourceCovers = new Map([
  ["https://www.gutenberg.org/ebooks/11", "/book-covers/alice-1865.jpg"],
  ["https://www.gutenberg.org/ebooks/55", "/book-covers/oz-1900.jpg"],
]);

export function bookCover(book) {
  const cover = book?.cover || sourceCovers.get(book?.source);
  if (!cover) return '<span class="catalog-cover image-placeholder" role="img" aria-label="표지 이미지 준비 중"></span>';
  return `<span class="catalog-cover image-placeholder${book?.cover ? "" : " catalog-cover--archive"}"><img src="${esc(cover)}" alt="" loading="lazy" decoding="async" draggable="false"></span>`;
}
