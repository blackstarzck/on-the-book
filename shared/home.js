// Books saved before categories existed keep the labels the reader used to hardcode.
const legacyCategories = { alice: "판타지", oz: "모험" };

export const bookCategory = (book) =>
  book.category || (Object.hasOwn(legacyCategories, book.id) ? legacyCategories[book.id] : "문학");

export const heroKicker = (slide, index) =>
  slide.kicker || (index ? "한 걸음, 새로운 모험" : "오늘의 이야기");

// Slides for books that are not in `books` (unpublished or removed) are skipped;
// with none left the hero shows the first two books, as before slides existed.
export function heroSlides(books, home) {
  const byId = new Map(books.map((book) => [book.id, book]));
  const slides = (home?.hero || []).filter((slide) => byId.has(slide.bookId));
  if (!slides.length) return books.slice(0, 2).map((book) => ({ bookId: book.id, book }));
  return slides.map((slide) => ({ ...slide, book: byId.get(slide.bookId) }));
}
