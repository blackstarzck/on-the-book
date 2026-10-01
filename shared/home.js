// Books saved before categories existed keep the labels the reader used to hardcode.
const legacyCategories = { alice: "판타지", oz: "모험" };

export const bookCategory = (book) =>
  book.category || (Object.hasOwn(legacyCategories, book.id) ? legacyCategories[book.id] : "문학");

export const heroKicker = (slide, index) =>
  slide.kicker || (index ? "한 걸음, 새로운 모험" : "오늘의 이야기");

// Accept only root-relative service links, including query strings and anchors.
export const isServiceUrl = (url) => /^\/(?!\/)/.test(url) && !/[\\\s\u0000-\u001f\u007f]/.test(url);

export const heroUrl = (slide) => slide.url || (slide.bookId ? `/client/?book=${encodeURIComponent(slide.bookId)}` : "");

export function heroLink(slide, preview = false) {
  const target = new URL(heroUrl(slide), "https://service.invalid");
  // The local service's / redirect does not carry query parameters; /client/ works on both hosts.
  if (target.pathname === "/") target.pathname = "/client/";
  if (preview) target.searchParams.set("preview", "draft");
  return `${target.pathname}${target.search}${target.hash}`;
}

// The old book picker becomes a written destination and copy when opened in the studio.
export function editableHeroSlide(slide, books, index) {
  const book = books.find((book) => book.id === slide.bookId);
  const { bookId, focus, ...fields } = slide;
  return { ...fields, url: heroUrl(slide), imageMobile: slide.imageMobile || "",
    kicker: slide.kicker || (book ? heroKicker(slide, index) : ""),
    title: slide.title || book?.title?.slice(0, 60) || "", description: slide.description || book?.description?.slice(0, 200) || "" };
}

// Service banners are independent of books. Legacy book slides still skip missing
// books; with none left the hero shows the first two books, as before slides existed.
export function heroSlides(books, home) {
  const byId = new Map(books.map((book) => [book.id, book]));
  const slides = (home?.hero || []).filter((slide) => slide.url ? isServiceUrl(slide.url) : byId.has(slide.bookId));
  if (!slides.length) return books.slice(0, 2).map((book) => ({ bookId: book.id, book }));
  return slides.map((slide) => ({ ...slide, book: byId.get(slide.bookId) }));
}
