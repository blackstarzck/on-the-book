// Book metadata that both the bookshelf and the detail pages derive from library data.
// Keep this file free of CSS and image imports so `node --test` can load it.
export function edition(book) {
  return { category: ({ alice: "판타지", oz: "모험" })[book.id] || "문학" };
}

// Image slots are deliberately empty, including when a cover exists in the library.
export function bookCover() {
  return '<span class="catalog-cover image-placeholder" role="img" aria-label="표지 이미지 준비 중"></span>';
}
