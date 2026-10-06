import { esc, icon, icons } from "../shared/ui.js";
import { heroKicker, heroLink, heroSlides } from "../shared/home.js";
import { edition, bookCover } from "./book-meta.js";
import { detailUrl } from "./detail.js";
import { browseUrl } from "./browse.js";
import { iconFor } from "./category-icons.js";
import "./landing.css";

function clayIcon(name) {
  return `<img src="${iconFor(name)}" alt="" aria-hidden="true" decoding="async">`;
}

function bookCard(book, preview) {
  return `<article class="catalog-card"><a class="book-entry" href="${esc(detailUrl({ book: book.id, preview }))}" data-book="${esc(book.id)}" aria-label="${esc(book.title)} — 작품 상세">
    <span class="cover-stage">${bookCover(book)}</span>
    <strong class="book-title">${esc(book.title)}</strong>
    <span class="book-author">${esc(book.author)}</span>
    </a></article>`;
}

function feature(slide, index, preview) {
  const { book } = slide;
  const active = index === 0;
  const title = slide.title || book?.title || "";
  const kicker = slide.url ? slide.kicker : heroKicker(slide, index);
  const description = slide.description || book?.description || "";
  const hasCopy = !!(title || kicker || description);
  const image = slide.image || slide.imageMobile;
  // Slides are stacked in one place, so lazy loading would fetch every photo at once;
  // later photos keep data-src until their slide comes up (see loadPhoto).
  const photo = image ? `<picture>${slide.imageMobile ? `<source media="(max-width: 600px)" ${active ? "srcset" : "data-srcset"}="${esc(slide.imageMobile)}">` : ""}<img class="feature-photo" ${active ? "src" : "data-src"}="${esc(image)}" data-focus="${esc(slide.url ? "center" : slide.focus || "center")}" alt="" decoding="async" draggable="false"></picture>` : "";
  const art = image || !book ? "" : `<span class="feature-art" aria-hidden="true"><span class="feature-art-card"></span><span class="feature-art-ring"></span><img src="${iconFor(edition(book).category)}" alt="" decoding="async" draggable="false"></span>`;
  const tag = slide.url ? "a" : "button";
  return `<${tag} class="feature-card feature-card-${index % 2}${image ? " feature-card--photo" : ""}${hasCopy ? "" : " feature-card--image-only"}${active ? " is-active" : ""}" ${slide.url ? `href="${esc(heroLink(slide, preview))}"` : `data-feature-book="${esc(book.id)}"`} data-feature-index="${index}" aria-label="${esc(title || kicker || `추천 슬라이드 ${index + 1}`)} ${slide.url ? "페이지로 이동" : "작품 상세"}" aria-hidden="${String(!active)}" tabindex="${active ? 0 : -1}">
    ${photo}${hasCopy ? `<span class="feature-copy">${kicker ? `<span class="feature-kicker">${esc(kicker)}</span>` : ""}${title ? `<strong>${esc(title)}</strong>` : ""}${description ? `<span class="feature-description">${esc(description)}</span>` : ""}<span class="feature-action">${slide.url ? "자세히 보기" : "작품 살펴보기"} ${icon("arrow-right")}</span></span>` : ""}
    ${art}
  </${tag}>`;
}

function featured(slides, preview) {
  const heading = (text) => `<h1 class="reader-sr-only" id="library-title" tabindex="-1">${text}</h1>`;
  if (!slides.length) return heading("책장");
  const controls = slides.length > 1
    ? `<button class="feature-arrow feature-prev" data-feature-direction="-1" aria-label="이전 추천 작품">${icon("arrow-left")}</button><button class="feature-arrow feature-next" data-feature-direction="1" aria-label="다음 추천 작품">${icon("arrow-right")}</button><div class="feature-controls"><button data-feature-autoplay aria-label="히어로 자동 재생 중지"><span aria-hidden="true">II</span></button><span class="feature-progress" role="status" aria-live="polite"><b>1</b> / ${slides.length}</span><span class="feature-swipe-hint">SWIPE</span></div>`
    : "";
  return `<section class="featured-section discovery-content" aria-label="추천 작품">${heading("추천 작품")}<div class="feature-carousel" data-feature-carousel><div class="feature-grid${slides.some(slide => slide.url) ? " feature-grid--banners" : ""}" role="region" aria-roledescription="carousel" aria-label="추천 작품 슬라이드" tabindex="0">${slides.map((slide, index) => feature(slide, index, preview)).join("")}</div>${controls}</div></section>`;
}

const two = n => String(n).padStart(2, "0");

// The scene previews show one book at a time: the reader's pick while that book is still on the shelf, otherwise the
// first book. Undefined only when the draft preview's shelf is empty.
const sceneBookOf = (books, id) => books.find(b => b.id === id) || books[0];

// The chosen book's tile, which opens the book detail. It stays put beside the rail. Its picture is the studio's
// 도서 메인 썸네일, made square for this tile; without one the tile keeps its plain wash rather than cutting the
// portrait cover to fit.
function sceneCover(book, preview) {
  return `<a class="scene-cover${book.thumbnail ? " has-image" : ""}" href="${esc(detailUrl({ book: book.id, preview }))}" data-scene-cover="${esc(book.id)}" aria-label="${esc(book.title)} — 작품 상세">${book.thumbnail ? `<img src="${esc(book.thumbnail)}" alt="" loading="lazy" decoding="async" draggable="false">` : '<span class="image-preview-empty-note">이미지 준비 중</span>'}<strong>${esc(book.title)}</strong></a>`;
}

// The chosen book's chapter cards for the rail; each opens its scene on the book detail.
function sceneCards(book, preview) {
  return book.chapters.map((chapter, index) => `<a class="scene-card" href="${esc(detailUrl({ book: book.id, scene: chapter.id, preview }))}" data-scene-book="${esc(book.id)}" data-scene-chapter="${esc(chapter.id)}" aria-label="${esc(book.title)} · ${two(index + 1)} ${esc(chapter.title)} — 작품 상세"><span class="scene-image image-placeholder${chapter.thumbnail ? " has-image" : ""}" aria-hidden="true">${chapter.thumbnail ? `<img src="${esc(chapter.thumbnail)}" alt="" loading="lazy" decoding="async" draggable="false">` : '<span class="image-preview-empty-note">이미지 준비 중</span>'}</span><span class="scene-index">Chapter. ${two(index + 1)}</span><strong>${esc(chapter.title)}</strong></a>`).join("");
}

// A tab per book picks what fills the shelf: the cover tile and, in the scrolling rail beside it, the chapter cards.
// The shelf is the tab panel; the rail is its own named region because it takes focus to scroll. A single book needs
// no picker.
function sceneSection(books, state, preview) {
  const book = sceneBookOf(books, state.sceneBook);
  const picked = books.indexOf(book);
  const picker = books.length > 1
    ? `<div class="scene-books" role="tablist" aria-label="장면을 볼 도서">${books.map((b, i) => `<button type="button" role="tab" id="scene-tab-${i}" data-scene-tab="${esc(b.id)}" aria-selected="${i === picked}" aria-controls="scene-shelf" tabindex="${i === picked ? 0 : -1}">${esc(b.title)}</button>`).join("")}</div>`
    : "";
  const panel = books.length > 1 ? ` role="tabpanel" aria-labelledby="scene-tab-${picked}"` : "";
  const rail = `<div class="scene-rail" tabindex="0" role="region" aria-label="${book ? `${esc(book.title)} 장면 목록` : "책 속 장면 목록"}">${book ? sceneCards(book, preview) : ""}</div>`;
  return `<section class="scene-section discovery-content" aria-labelledby="scene-title"><div class="section-heading"><div><h2 id="scene-title" tabindex="-1">한 장면부터 시작하는 여행</h2><p>마음이 가는 장면부터 살펴보세요.</p></div><div class="rail-controls"><button data-rail="-1" class="icon-button" aria-label="이전 장면들">${icon("arrow-left")}</button><button data-rail="1" class="icon-button" aria-label="다음 장면들">${icon("arrow-right")}</button></div></div>${picker}<div class="scene-shelf" id="scene-shelf"${panel}>${book ? sceneCover(book, preview) : ""}${rail}</div></section>`;
}

export function announcementBanner() {
  return `<button class="reading-ribbon discovery-content" data-scenes aria-label="책 속 장면 미리보기로 이동"><span class="ribbon-badge">NEW</span><strong>책장을 넘으면, 이야기가 움직이기 시작해요.</strong><span>장면 미리보기 ${icon("arrow-right")}</span></button>`;
}

export function landing(library, progress, state, preview = false) {
  const categories = [...new Set(library.books.map(b => edition(b).category))];
  return `<main class="library-page" id="main-content">
    <div class="store-content">
      ${featured(heroSlides(library.books, library.home), preview)}
      <div class="quick-menu discovery-content" role="group" aria-label="빠른 탐색"><button data-quick-view="all" aria-label="전체 작품 둘러보기"><span>${clayIcon("all")}</span>전체 작품</button>${categories.map(c => `<button data-quick-category="${esc(c)}" aria-label="${esc(c)} 도서 보기"><span>${clayIcon(c)}</span>${esc(c)}</button>`).join("")}<button data-quick-view="reading" aria-label="읽던 작품 이어 보기"><span>${clayIcon("reading")}</span>읽던 이야기</button><button data-scenes><span>${clayIcon("scenes")}</span>장면 둘러보기</button><button data-help><span>${clayIcon("help")}</span>이용 가이드</button></div>
      <section class="catalog" aria-labelledby="catalog-title"><div class="section-heading"><div><h2 id="catalog-title" tabindex="-1">지금 만나볼 이야기</h2><p id="catalog-intro">책을 고르면, 그 안의 세계가 열립니다.</p></div><div class="catalog-heading-actions"><label class="catalog-sort"><span class="reader-sr-only">도서 정렬</span><select id="book-sort"><option value="default">기본순</option><option value="title">제목순</option><option value="year">출간연도순</option></select></label><a class="browse-all-link" data-browse data-browse-all href="${esc(browseUrl(undefined, preview))}">전체 도서 보기 ${icon("chevron-right")}</a></div></div>
        <div class="catalog-toolbar"><div class="catalog-filters" role="group" aria-label="도서 분류"><button data-category="all" aria-pressed="true">전체</button>${categories.map(c => `<button data-category="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}</div><p role="status" aria-live="polite" id="catalog-status"></p></div><div id="book-grid" class="catalog-grid catalog-grid--many"></div>
      </section>
      ${sceneSection(library.books, state, preview)}
      <section class="experience-banner discovery-content" aria-labelledby="experience-title"><div><h2 id="experience-title">읽는 즐거움에, 걷는 설렘을 더하다.</h2><p>책을 고르고, 장면을 걷고, 이야기 곁에 잠시 머물러 보세요.</p><button id="trailer-button">온더북 미리보기 ${icon("arrow-up-right")}</button></div><div class="experience-steps"><span><b>01</b> 책을 고르고</span><span><b>02</b> 장면을 걷고</span><span><b>03</b> 이야기를 만나요</span></div></section>
    </div>
  </main>`;
}

export function setupCatalog({ library, progress, state, preview = false, onOpen, onTrailer, onHelp, onBrowse }) {
  const page = document.querySelector(".library-page");
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const search = document.querySelector("#book-search");
  const sort = page.querySelector("#book-sort");
  const rail = page.querySelector(".scene-rail");
  const sceneTabs = [...page.querySelectorAll("[data-scene-tab]")];
  // The hero is absent when neither a configured banner nor a published book is left.
  const hero = page.querySelector("[data-feature-carousel]");
  const heroTrack = hero?.querySelector(".feature-grid");
  const heroCards = hero ? [...hero.querySelectorAll(".feature-card")] : [];
  const heroProgress = hero?.querySelector(".feature-progress b");
  let heroIndex = 0;
  let heroTimer;
  let heroPaused = matchMedia("(prefers-reduced-motion: reduce)").matches || heroCards.length < 2;
  let pointerStart;
  let suppressHeroClickUntil = 0;
  sort.value = state.sort;
  const motion = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  const loadPhoto = card => {
    const source = card?.querySelector("source[data-srcset]");
    if (source) { source.srcset = source.dataset.srcset; source.removeAttribute("data-srcset"); }
    const photo = card?.querySelector(".feature-photo[data-src]");
    if (!photo) return;
    photo.src = photo.dataset.src;
    photo.removeAttribute("data-src");
  };
  const renderHero = () => {
    heroCards.forEach((slide, index) => {
      const active = index === heroIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.tabIndex = active ? 0 : -1;
      slide.inert = !active;
    });
    // Fetch the shown photo and the next one, so autoplay rarely waits for a download.
    loadPhoto(heroCards[heroIndex]);
    loadPhoto(heroCards[(heroIndex + 1) % heroCards.length]);
    if (heroProgress) heroProgress.textContent = String(heroIndex + 1);
  };
  const startHeroTimer = () => {
    clearInterval(heroTimer);
    // Autoplay must not advance while the carousel holds focus: renderHero() would make the focused slide inert and drop focus.
    if (!heroPaused) heroTimer = setInterval(() => {
      if (hero?.contains(document.activeElement)) return;
      heroIndex = (heroIndex + 1) % heroCards.length;
      renderHero();
    }, 5200);
  };
  const showHero = direction => {
    if (heroCards.length < 2) return;
    if (heroCards[heroIndex].contains(document.activeElement)) heroTrack.focus({ preventScroll: true });
    heroIndex = (heroIndex + direction + heroCards.length) % heroCards.length;
    renderHero();
    startHeroTimer();
  };
  const resetSwipe = () => {
    pointerStart = undefined;
  };
  const finishSwipe = (x, y) => {
    if (!pointerStart) return;
    const distanceX = x - pointerStart.x;
    const distanceY = y - pointerStart.y;
    const swiped = Math.abs(distanceX) > 46 && Math.abs(distanceX) > Math.abs(distanceY);
    resetSwipe();
    if (swiped) {
      showHero(distanceX < 0 ? 1 : -1);
      suppressHeroClickUntil = performance.now() + 350;
    }
  };
  const updateRail = () => {
    page.querySelector('[data-rail="-1"]').disabled = rail.scrollLeft <= 1;
    page.querySelector('[data-rail="1"]').disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2;
  };
  // Picking a book swaps the cover tile and the rail's cards in place and starts the rail from its first chapter. The
  // rail element itself stays, so its listeners do too. The pick lives in `state`, so the bookshelf comes back on it
  // (and can refocus a card) after a visit to the book detail.
  const showSceneBook = (id, { focus = false } = {}) => {
    const book = library.books.find(b => b.id === id);
    const tab = sceneTabs.find(t => t.dataset.sceneTab === id);
    if (!book || !tab) return;
    if (focus) tab.focus();
    if (tab.getAttribute("aria-selected") === "true") return;
    state.sceneBook = id;
    for (const other of sceneTabs) {
      other.setAttribute("aria-selected", String(other === tab));
      other.tabIndex = other === tab ? 0 : -1;
    }
    const shelf = rail.parentElement;
    shelf.setAttribute("aria-labelledby", tab.id);
    // From the first swap on, new tiles slide in (see .scene-shelf.is-swapped); the first render comes with the page.
    shelf.classList.add("is-swapped");
    shelf.querySelector(".scene-cover").outerHTML = sceneCover(book, preview);
    rail.setAttribute("aria-label", `${book.title} 장면 목록`);
    rail.innerHTML = sceneCards(book, preview);
    rail.scrollTo({ left: 0, behavior: "instant" });
    updateRail();
  };
  const update = () => {
    const query = state.query.trim().toLocaleLowerCase();
    const books = library.books.filter(b => {
      const matchesCategory = state.category === "all" || (state.category === "reading" ? b.chapters.some(c => c.id === progress[b.id]?.chapter) : edition(b).category === state.category);
      return matchesCategory && `${b.title} ${b.englishTitle} ${b.author}`.toLocaleLowerCase().includes(query);
    });
    if (state.sort === "title") books.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    if (state.sort === "year") books.sort((a, b) => b.year - a.year);
    // A genre only narrows the section's cards; a search or the reading list shows its books without the rest of the home.
    const discovery = !query && state.category !== "reading";
    document.querySelectorAll(".discovery-content").forEach(el => el.hidden = !discovery);
    page.querySelectorAll("[data-category]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.category === state.category)));
    page.querySelector("#catalog-title").textContent = query ? "검색 결과" : state.category === "reading" ? "이어 읽는 이야기" : "지금 만나볼 이야기";
    page.querySelector("#catalog-intro").textContent = state.category === "reading" ? "마지막으로 머문 장면에서 다시 시작하세요." : "책을 고르면, 그 안의 세계가 열립니다.";
    page.querySelector("#catalog-status").textContent = `${query ? `“${state.query.trim()}” · ` : ""}${books.length}권`;
    page.querySelector("#book-grid").innerHTML = books.length ? books.map(b => bookCard(b, preview)).join("") :`<div class="catalog-empty">${icon("book-open")}<h3>${state.category === "reading" && !query ? "아직 펼친 이야기가 없어요" : "찾는 이야기가 없어요"}</h3><p>${state.category === "reading" && !query ? "책을 고르면 마지막으로 머문 장면을 이어볼 수 있어요." : "다른 검색어를 입력하거나 전체 책장을 둘러보세요."}</p><button class="primary-button" data-reset>전체 도서 보기</button></div>`;
    icons();
    updateRail();
  };
  const showCatalog = category => {
    state.query = ""; search.value = ""; state.category = category;
    update();
    page.querySelector("#catalog-title").focus({ preventScroll: true });
  };
  // Remember where the reader was so "책장으로" can scroll back and refocus the card.
  const open = (target, bookId, sceneId, selector) => {
    state.scroll = scrollY; state.selected = selector;
    onOpen(target, bookId, sceneId);
  };
  const showScenes = () => {
    page.querySelector("#scene-title").scrollIntoView({ behavior: motion(), block: "start" });
    page.querySelector("#scene-title").focus({ preventScroll: true });
  };
  document.querySelector(".reading-ribbon")?.addEventListener("click", showScenes, options);
  search.addEventListener("input", () => { state.query = search.value; update(); }, options);
  sort.addEventListener("change", () => { state.sort = sort.value; update(); }, options);
  rail.addEventListener("scroll", updateRail, { ...options, passive: true });
  heroTrack?.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, id: event.pointerId };
    // Capture on the card so a tap still activates its native link after pointerup.
    try { (event.target.closest(".feature-card") || heroTrack).setPointerCapture?.(event.pointerId); } catch {}
  }, options);
  heroTrack?.addEventListener("pointermove", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const x = event.clientX - pointerStart.x;
    const y = event.clientY - pointerStart.y;
    pointerStart.lastX = event.clientX;
    pointerStart.lastY = event.clientY;
    if (Math.abs(x) <= Math.abs(y) || Math.abs(x) < 5) return;
  }, options);
  heroTrack?.addEventListener("pointerup", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    finishSwipe(event.clientX, event.clientY);
  }, options);
  heroTrack?.addEventListener("pointercancel", () => {
    if (!pointerStart) return;
    finishSwipe(pointerStart.lastX, pointerStart.lastY);
  }, options);
  heroTrack?.addEventListener("dragstart", event => event.preventDefault(), { ...options, capture: true });
  heroTrack?.addEventListener("click", event => {
    if (performance.now() > suppressHeroClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
    suppressHeroClickUntil = 0;
  }, { ...options, capture: true });
  hero?.addEventListener("keydown", event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target.closest('.feature-controls')) return;
    event.preventDefault();
    showHero(event.key === 'ArrowRight' ? 1 : -1);
  }, options);
  rail.addEventListener("keydown", event => {
    if (event.target !== rail || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home" || event.key === "End") rail.scrollTo({ left: event.key === "Home" ? 0 : rail.scrollWidth, behavior: motion() });
    else rail.scrollBy({ left: (event.key === "ArrowLeft" ? -1 : 1) * rail.clientWidth * .8, behavior: motion() });
  }, options);
  // Tabs follow the arrow keys: the focused tab is picked at once, so its book fills the rail.
  page.querySelector(".scene-books")?.addEventListener("keydown", event => {
    const index = sceneTabs.indexOf(event.target);
    if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? sceneTabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + sceneTabs.length) % sceneTabs.length;
    showSceneBook(sceneTabs[next].dataset.sceneTab, { focus: true });
  }, options);
  const resize = new ResizeObserver(updateRail);
  resize.observe(rail);
  page.addEventListener("click", event => {
    const link = event.target.closest("a[data-book], a[data-scene-book], a[data-scene-cover]");
    if (link) {
      // Modified clicks keep the browser's own behaviour, such as opening the link in a new tab.
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (link.dataset.sceneBook) open("scene", link.dataset.sceneBook, link.dataset.sceneChapter, `[data-scene-chapter="${CSS.escape(link.dataset.sceneChapter)}"]`);
      else if (link.dataset.sceneCover) open("book", link.dataset.sceneCover, undefined, `[data-scene-cover="${CSS.escape(link.dataset.sceneCover)}"]`);
      else open("book", link.dataset.book, undefined, `[data-book="${CSS.escape(link.dataset.book)}"]`);
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.sceneTab) showSceneBook(button.dataset.sceneTab);
    if (button.dataset.category) { state.category = button.dataset.category; update(); }
    // Like 장면 둘러보기, the quick menu's lists land on their section, which may start below the fold.
    if (button.dataset.quickView || button.dataset.quickCategory) {
      if (button.dataset.quickView === "all") { onBrowse(); return; }
      showCatalog(button.dataset.quickView || button.dataset.quickCategory);
      page.querySelector(".catalog").scrollIntoView({ behavior: motion(), block: "start" });
    }
    if (button.dataset.featureDirection) showHero(Number(button.dataset.featureDirection));
    if (button.hasAttribute("data-feature-autoplay")) {
      heroPaused = !heroPaused;
      // Two plain capitals: Freesentation draws the numeral Ⅱ (U+2161) with slab serifs, which no longer reads as pause.
      button.querySelector("span").textContent = heroPaused ? "▶" : "II";
      button.setAttribute("aria-label", heroPaused ? "히어로 자동 재생 시작" : "히어로 자동 재생 중지");
      startHeroTimer();
    }
    if (button.hasAttribute("data-reset")) { showCatalog("all"); search.focus(); }
    if (button.dataset.featureBook) open("book", button.dataset.featureBook, undefined, `[data-feature-book="${CSS.escape(button.dataset.featureBook)}"]`);
    if (button.hasAttribute("data-help")) onHelp();
    if (button.hasAttribute("data-scenes")) showScenes();
    if (button.dataset.rail) rail.scrollBy({ left: Number(button.dataset.rail) * rail.clientWidth * .8, behavior: motion() });
    if (button.id === "trailer-button") onTrailer();
  }, options);
  renderHero();
  startHeroTimer();
  update();
  return () => { abort.abort(); resize.disconnect(); clearInterval(heroTimer); };
}
