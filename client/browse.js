import { esc, icon, icons } from "../shared/ui.js";
import { edition, bookCover } from "./book-meta.js";
import { detailUrl } from "./detail.js";

const sorts = { default: "기본순", title: "제목 가나다순", author: "작가 가나다순", year: "출간연도 최신순", oldest: "출간연도 오래된순" };
const readingFilters = { all: "모든 도서", reading: "읽던 도서", unread: "아직 읽지 않은 도서" };
export const browseDefaults = { query: "", category: "all", reading: "all", sort: "default", layout: "grid" };

export function readBrowseState(params, books) {
  const category = params.get("category");
  return {
    query: params.get("q") || "",
    category: books.some(book => edition(book).category === category) ? category : "all",
    reading: Object.hasOwn(readingFilters, params.get("reading")) ? params.get("reading") : "all",
    sort: Object.hasOwn(sorts, params.get("sort")) ? params.get("sort") : "default",
    layout: params.get("layout") === "list" ? "list" : "grid",
  };
}

export function browseUrl(state = browseDefaults, preview = false) {
  const params = new URLSearchParams({ view: "books" });
  for (const [key, value] of Object.entries(browseDefaults)) {
    if (state[key] && state[key] !== value) params.set(key === "query" ? "q" : key, state[key]);
  }
  if (preview) params.set("preview", "draft");
  return `?${params}`;
}

const hasRead = (book, progress) => book.chapters.some(chapter => chapter.id === progress[book.id]?.chapter);
const normalize = value => String(value || "").normalize("NFKC").toLocaleLowerCase().trim();

export function filterBooks(books, progress, state) {
  const words = normalize(state.query).split(/\s+/).filter(Boolean);
  const result = books.filter(book => {
    if (state.category !== "all" && edition(book).category !== state.category) return false;
    if (state.reading === "reading" && !hasRead(book, progress)) return false;
    if (state.reading === "unread" && hasRead(book, progress)) return false;
    const text = normalize([book.title, book.englishTitle, book.author, ...book.chapters.map(chapter => chapter.title)].join(" "));
    return words.every(word => text.includes(word));
  });
  if (state.sort === "title" || state.sort === "author") result.sort((a, b) => a[state.sort].localeCompare(b[state.sort], "ko"));
  if (state.sort === "year") result.sort((a, b) => b.year - a.year);
  if (state.sort === "oldest") result.sort((a, b) => a.year - b.year);
  return result;
}

function browseCard(book, progress, preview) {
  return `<li class="browse-card"><a href="${esc(detailUrl({ book: book.id, preview }))}" data-browse-book="${esc(book.id)}" aria-label="${esc(book.title)} — 작품 상세">
    <span class="browse-cover">${bookCover(book)}${hasRead(book, progress) ? `<span class="browse-reading">${icon("bookmark")} 읽던 도서</span>` : ""}</span>
    <span class="browse-copy"><span class="browse-category">${esc(edition(book).category)}</span><strong class="browse-book-title">${esc(book.title)}</strong><span class="browse-author">${esc(book.author)}</span><span class="browse-description">${esc(book.description)}</span><span class="browse-meta">${book.year}년 출간<span aria-hidden="true">·</span>${book.chapters.length}개의 장면</span></span>
    <span class="browse-open" aria-hidden="true">작품 보기 ${icon("arrow-up-right")}</span>
  </a></li>`;
}

export function browsePage(library, state) {
  const categories = [...new Set(library.books.map(book => edition(book).category))];
  return `<main class="browse-page store-content" id="main-content">
    <div class="browse-heading"><h1 id="browse-title" tabindex="-1">도서 둘러보기<span>${library.books.length}</span></h1><p>지금 마음이 향하는 이야기, 여기서 찾아보세요.</p></div>
    <div class="browse-search-row"><label class="browse-search" for="book-search">${icon("search")}<input id="book-search" type="search" aria-label="도서 제목, 작가 또는 챕터 검색" placeholder="제목, 작가, 챕터로 검색해 보세요" value="${esc(state.query)}" autocomplete="off" aria-controls="browse-results"></label><span class="browse-search-hint">한 권의 책, 새로운 세계로의 산책.</span></div>
    <div class="browse-categories" role="group" aria-label="도서 분류"><button data-browse-category="all" aria-pressed="${state.category === "all"}">전체<span>${library.books.length}</span></button>${categories.map(category => `<button data-browse-category="${esc(category)}" aria-pressed="${state.category === category}">${esc(category)}<span>${library.books.filter(book => edition(book).category === category).length}</span></button>`).join("")}</div>
    <section class="browse-listing" aria-label="도서 목록">
      <div class="browse-toolbar"><p id="browse-status" role="status" aria-live="polite" aria-atomic="true"></p><div class="browse-controls"><label class="browse-reading-filter">${icon("settings-2")}<span class="reader-sr-only">읽기 상태</span><select id="browse-reading">${Object.entries(readingFilters).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><label><span class="reader-sr-only">도서 정렬</span><select id="browse-sort">${Object.entries(sorts).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><div class="browse-views" role="group" aria-label="목록 보기 방식"><button data-layout="grid" aria-label="그리드 보기" aria-pressed="${state.layout === "grid"}" title="그리드 보기">${icon("grid-2x2")}</button><button data-layout="list" aria-label="리스트 보기" aria-pressed="${state.layout === "list"}" title="리스트 보기">${icon("list")}</button></div></div></div>
      <div id="browse-active" class="browse-active"></div><ul id="browse-results" class="browse-results" data-layout="${state.layout}"></ul>
    </section>
  </main>`;
}

export function setupBrowse({ library, progress, state, preview, onOpen, onChange }) {
  const page = document.querySelector(".browse-page");
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const search = page.querySelector("#book-search");
  const reading = page.querySelector("#browse-reading");
  const sort = page.querySelector("#browse-sort");
  const results = page.querySelector("#browse-results");
  const update = () => {
    const books = filterBooks(library.books, progress, state);
    reading.value = state.reading;
    sort.value = state.sort;
    page.querySelectorAll("[data-browse-category]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.browseCategory === state.category)));
    page.querySelectorAll("button[data-layout]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.layout === state.layout)));
    page.querySelector("#browse-status").textContent = state.query.trim() ? `“${state.query.trim()}” 검색 결과 ${books.length}권` : `총 ${books.length}권`;
    const chips = [["query", state.query.trim()], ["category", state.category !== "all" && state.category], ["reading", state.reading !== "all" && readingFilters[state.reading]]].filter(([, label]) => label);
    page.querySelector("#browse-active").innerHTML = chips.length ? `${chips.map(([key, label]) => `<button data-remove-filter="${key}" aria-label="${esc(label)} 조건 해제">${esc(label)}${icon("x")}</button>`).join("")}<button class="browse-reset" data-browse-reset>${icon("rotate-ccw")} 초기화</button>` : "";
    results.dataset.layout = state.layout;
    results.innerHTML = books.length ? books.map(book => browseCard(book, progress, preview)).join("") : `<li class="browse-empty">${icon("search")}<h2>${library.books.length ? "조건에 맞는 도서가 없어요" : "새로운 이야기를 준비하고 있어요"}</h2><p>${library.books.length ? "검색어를 바꾸거나 필터를 해제해 보세요." : "도서가 공개되면 이곳에서 만나볼 수 있어요."}</p>${library.books.length ? '<button class="primary-button" data-browse-reset>전체 도서 보기</button>' : ""}</li>`;
    icons();
    onChange();
  };
  const searchBooks = event => {
    if (event.isComposing) return;
    state.query = search.value;
    update();
  };
  search.addEventListener("input", searchBooks, options);
  search.addEventListener("compositionend", searchBooks, options);
  reading.addEventListener("change", () => { state.reading = reading.value; update(); }, options);
  sort.addEventListener("change", () => { state.sort = sort.value; update(); }, options);
  page.addEventListener("click", event => {
    const link = event.target.closest("a[data-browse-book]");
    if (link) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      state.scroll = scrollY;
      state.selected = link.dataset.browseBook;
      onOpen("book", link.dataset.browseBook);
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.browseCategory) state.category = button.dataset.browseCategory;
    else if (button.dataset.layout) state.layout = button.dataset.layout;
    else if (button.dataset.removeFilter) state[button.dataset.removeFilter] = browseDefaults[button.dataset.removeFilter];
    else if (button.hasAttribute("data-browse-reset")) Object.assign(state, { query: "", category: "all", reading: "all" });
    else return;
    search.value = state.query;
    update();
    // Removed chips and the empty-state button no longer exist after the update.
    if (!button.isConnected) search.focus({ preventScroll: true });
  }, options);
  update();
  return () => abort.abort();
}
