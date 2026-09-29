// The studio's address: the path names the page, the query what is open on it.
// Pure functions with no DOM, history or storage access, so `node --test` can load them.

const tabs = ["home", "models", "settings"];
// Dialogs each page can name in `modal`; those in `targeted` also need an `id`.
const dialogs = {
  books: ["new-book"],
  home: ["home-preview"],
  models: ["new-model", "model", "model-preview"],
  settings: [],
  editor: ["book", "chapter", "new-model", "model"],
};
const targeted = ["chapter", "model", "model-preview"];
// Query parameters each page writes, in address order.
const order = {
  books: ["q", "status", "modal"],
  home: ["modal"],
  models: ["q", "modal", "id"],
  settings: [],
  editor: ["chapter", "object", "mode", "q", "modal", "id"],
};
export const notices = {
  book: "요청한 도서를 찾을 수 없어 도서 보관함을 열었어요.",
  chapter: "요청한 챕터를 찾을 수 없어 첫 챕터를 열었어요.",
  object: "요청한 오브젝트를 찾을 수 없어 선택하지 않았어요.",
  item: "요청한 항목을 찾을 수 없어 창을 열지 않았어요.",
};

const decode = (text) => {
  try { return decodeURIComponent(text); } catch { return text; }
};
// Keeps only the fields that say something, so equal places compare equal.
const compact = (route) => Object.fromEntries(Object.entries(route).filter(([, value]) => value != null && value !== "" && value !== false));

export function parseRoute(pathname, search = "") {
  const params = new URLSearchParams(search);
  const path = pathname.replace(/\/+$/, "");
  const book = path.match(/^\/admin\/books\/([^/]+)$/)?.[1];
  const tab = path.match(/^\/admin\/([^/]+)$/)?.[1];
  const view = book ? "editor" : tabs.includes(tab) ? tab : "books";
  const route = { view };
  if (book) Object.assign(route, { bookId: decode(book), chapterId: params.get("chapter"), objectId: params.get("object"), reader: params.get("mode") === "reader" });
  if (order[view].includes("q")) route.q = params.get("q");
  if (view === "books" && ["draft", "public"].includes(params.get("status"))) route.status = params.get("status");
  const modal = params.get("modal"), id = params.get("id");
  if (dialogs[view].includes(modal) && !route.reader && (!targeted.includes(modal) || id))
    Object.assign(route, { modal, modalId: targeted.includes(modal) ? id : undefined });
  return compact(route);
}

export function routeHref(route) {
  const path = route.view === "editor" ? `/admin/books/${encodeURIComponent(route.bookId)}` : route.view === "books" ? "/admin/" : `/admin/${route.view}`;
  const values = { q: route.q, status: route.status, chapter: route.chapterId, object: route.objectId, mode: route.reader ? "reader" : "", modal: route.modal, id: route.modalId };
  const params = new URLSearchParams();
  for (const name of order[route.view]) if (values[name]) params.set(name, values[name]);
  const query = String(params);
  return query ? `${path}?${query}` : path;
}

// Floor images count as objects: the chapter's stored ones, or else the defaults it draws, whose ids
// follow the placement order (shared/landscape.js defaultDecals).
const objectIds = (chapter) => [
  ...chapter.placements.map((p) => p.id),
  ...(chapter.floorDecals ? chapter.floorDecals.map((d) => d.id) : chapter.floorDecor === "none" ? [] : chapter.placements.map((_, i) => `decor-${i}`)),
];

// Whether `id` names one of the chapter's objects, as an address may.
export const hasObject = (chapter, id) => !!chapter && objectIds(chapter).includes(id);

export function resolveRoute(route, library) {
  const next = { ...route };
  let notice = null;
  const miss = (key) => { notice ??= notices[key]; };
  const dropDialog = () => { delete next.modal; delete next.modalId; miss("item"); };
  if (next.view === "editor") {
    const book = library.books.find((b) => b.id === next.bookId);
    if (!book?.chapters.length) return { route: { view: "books" }, notice: notices.book };
    let chapter = book.chapters.find((c) => c.id === next.chapterId);
    if (!chapter) {
      if (next.chapterId) miss("chapter");
      chapter = book.chapters[0];
      next.chapterId = chapter.id;
    }
    if (next.objectId && !objectIds(chapter).includes(next.objectId)) { delete next.objectId; miss("object"); }
    if (next.modal === "chapter" && !book.chapters.some((c) => c.id === next.modalId)) dropDialog();
  }
  if ((next.modal === "model" || next.modal === "model-preview") && !library.models.some((m) => m.id === next.modalId)) dropDialog();
  return { route: next, notice };
}
