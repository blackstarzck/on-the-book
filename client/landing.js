import { esc, icon, icons } from "../shared/ui.js";
import openBookClay from "./assets/quick-menu/open-book-clay.png";
import fantasySparklesClay from "./assets/quick-menu/fantasy-sparkles-clay.png";
import adventureMapClay from "./assets/quick-menu/adventure-map-clay.png";
import bookmarkClay from "./assets/quick-menu/bookmark-clay.png";
import sceneLayersClay from "./assets/quick-menu/scene-layers-clay.png";
import helpClay from "./assets/quick-menu/help-clay.png";
import "./landing.css";

const quickIcons = {
  all: openBookClay,
  판타지: fantasySparklesClay,
  모험: adventureMapClay,
  reading: bookmarkClay,
  scenes: sceneLayersClay,
  help: helpClay,
};

function clayIcon(name) {
  return `<img src="${quickIcons[name] || openBookClay}" alt="" aria-hidden="true" decoding="async">`;
}

export function edition(book) {
  return { category: ({ alice: "판타지", oz: "모험" })[book.id] || "문학" };
}

// Image slots are deliberately empty, including when a cover exists in the library.
export function bookCover() {
  return '<span class="catalog-cover image-placeholder" role="img" aria-label="표지 이미지 준비 중"></span>';
}

function bookCard(book) {
  return `<article class="catalog-card"><button class="book-entry" data-enter="${esc(book.id)}" aria-label="${esc(book.title)} — 3D 공간에서 읽기">
    <span class="cover-stage">${bookCover()}</span>
    <strong class="book-title">${esc(book.title)}</strong>
    <span class="book-author">${esc(book.author)}</span>
    </button></article>`;
}

function feature(book, index) {
  const artwork = quickIcons[edition(book).category] || openBookClay;
  const active = index === 0;
  return `<button class="feature-card feature-card-${index % 2}${active ? " is-active" : ""}" data-feature-book="${esc(book.id)}" data-feature-index="${index}" aria-label="${esc(book.title)} 추천 작품 시작" aria-hidden="${String(!active)}" tabindex="${active ? 0 : -1}">
    <span class="feature-copy"><span class="feature-kicker">${index ? "한 걸음, 새로운 모험" : "오늘의 이야기"}</span><strong>${esc(book.title)}</strong><span class="feature-description">${esc(book.description)}</span><span class="feature-action">이야기 속으로 ${icon("arrow-right")}</span></span>
    <span class="feature-art" aria-hidden="true"><span class="feature-art-card"></span><span class="feature-art-ring"></span><img src="${artwork}" alt="" decoding="async" draggable="false"></span>
    <span class="feature-number">ON THE BOOK · ${String(index + 1).padStart(2, "0")}</span>
  </button>`;
}

export function announcementBanner() {
  return `<button class="reading-ribbon discovery-content" data-scenes aria-label="책 속 장면 미리보기로 이동"><span class="ribbon-badge">NEW</span><strong>책장을 넘으면, 이야기가 움직이기 시작해요.</strong><span>장면 미리보기 ${icon("arrow-right")}</span></button>`;
}

export function landing(library, progress, state) {
  const categories = [...new Set(library.books.map(b => edition(b).category))];
  const scenes = library.books.flatMap(b => b.chapters.map((c, i) => ({ book: b, chapter: c, index: i })));
  return `<main class="library-page" id="main-content">
    <div class="store-content">
      <section class="featured-section discovery-content" aria-label="추천 작품"><h1 class="reader-sr-only" id="library-title" tabindex="-1">추천 작품</h1><div class="feature-carousel" data-feature-carousel><div class="feature-grid" role="region" aria-roledescription="carousel" aria-label="추천 작품 슬라이드" tabindex="0">${library.books.slice(0, 2).map(feature).join("")}</div><button class="feature-arrow feature-prev" data-feature-direction="-1" aria-label="이전 추천 작품">${icon("arrow-left")}</button><button class="feature-arrow feature-next" data-feature-direction="1" aria-label="다음 추천 작품">${icon("arrow-right")}</button><div class="feature-controls"><button data-feature-autoplay aria-label="히어로 자동 재생 중지"><span aria-hidden="true">Ⅱ</span></button><span class="feature-progress" role="status" aria-live="polite"><b>1</b> / ${Math.min(library.books.length, 2)}</span><span class="feature-swipe-hint">SWIPE</span></div></div></section>
      <div class="quick-menu discovery-content" role="group" aria-label="빠른 탐색"><button data-quick-view="all" aria-label="전체 작품 둘러보기"><span>${clayIcon("all")}</span>전체 작품</button>${categories.map(c => `<button data-quick-category="${c}" aria-label="${c} 도서 보기"><span>${clayIcon(c)}</span>${c}</button>`).join("")}<button data-quick-view="reading" aria-label="읽던 작품 이어 보기"><span>${clayIcon("reading")}</span>읽던 이야기</button><button data-scenes><span>${clayIcon("scenes")}</span>장면 둘러보기</button><button data-help><span>${clayIcon("help")}</span>이용 가이드</button></div>
      <section class="catalog" aria-labelledby="catalog-title"><div class="section-heading"><div><h2 id="catalog-title" tabindex="-1">지금 만나볼 이야기 <span>${library.books.length}</span></h2><p id="catalog-intro">책을 고르면, 그 안의 세계가 열립니다.</p></div><label class="catalog-sort"><span class="reader-sr-only">도서 정렬</span><select id="book-sort"><option value="default">기본순</option><option value="title">제목순</option><option value="year">출간연도순</option></select></label></div>
        <div class="catalog-toolbar"><div class="catalog-filters" role="group" aria-label="도서 분류"><button data-category="all" aria-pressed="true">전체</button>${categories.map(c => `<button data-category="${c}" aria-pressed="false">${c}</button>`).join("")}</div><p role="status" aria-live="polite" id="catalog-status"></p></div><div id="book-grid" class="catalog-grid catalog-grid--many"></div>
      </section>
      <section class="scene-section discovery-content" aria-labelledby="scene-title"><div class="section-heading"><div><span class="section-eyebrow">STORY PREVIEW</span><h2 id="scene-title" tabindex="-1">한 장면부터 시작하는 여행</h2><p>마음이 가는 장면으로 바로 들어가 보세요.</p></div><div class="rail-controls"><button data-rail="-1" class="icon-button" aria-label="이전 장면들">${icon("arrow-left")}</button><button data-rail="1" class="icon-button" aria-label="다음 장면들">${icon("arrow-right")}</button></div></div><div class="scene-rail" tabindex="0" role="region" aria-label="책 속 장면 목록">${scenes.map(({ book, chapter, index }) => `<button class="scene-card" data-scene-book="${esc(book.id)}" data-scene-chapter="${esc(chapter.id)}" aria-label="${esc(book.title)} · ${esc(chapter.title)} 장면 열기"><span class="scene-image image-placeholder" aria-hidden="true"><span class="scene-number">${String(index + 1).padStart(2, "0")}</span><span class="scene-arrow">${icon("arrow-up-right")}</span></span><span class="scene-book">${esc(book.title)}</span><strong>${esc(chapter.title)}</strong><span class="scene-subtitle">${esc(chapter.subtitle)}</span></button>`).join("")}</div></section>
      <section class="experience-banner discovery-content" aria-labelledby="experience-title"><div><span class="section-eyebrow">A DIFFERENT WAY TO READ</span><h2 id="experience-title">읽는 즐거움에, 걷는 설렘을 더하다.</h2><p>책을 고르고, 장면을 걷고, 이야기 곁에 잠시 머물러 보세요.</p><button id="trailer-button">온더북 미리보기 ${icon("arrow-up-right")}</button></div><div class="experience-steps"><span><b>01</b> 책을 고르고</span><span><b>02</b> 장면을 걷고</span><span><b>03</b> 이야기를 만나요</span></div></section>
    </div>
  </main>`;
}

export function setupCatalog({ library, progress, state, onEnter, onTrailer, onHelp }) {
  const page = document.querySelector(".library-page");
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const search = document.querySelector("#book-search");
  const sort = page.querySelector("#book-sort");
  const rail = page.querySelector(".scene-rail");
  const hero = page.querySelector("[data-feature-carousel]");
  const heroTrack = hero.querySelector(".feature-grid");
  const heroSlides = [...hero.querySelectorAll(".feature-card")];
  const heroProgress = hero.querySelector(".feature-progress b");
  let heroIndex = 0;
  let heroTimer;
  let heroPaused = matchMedia("(prefers-reduced-motion: reduce)").matches || heroSlides.length < 2;
  let pointerStart;
  let suppressHeroClickUntil = 0;
  sort.value = state.sort;
  const motion = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  const renderHero = () => {
    heroSlides.forEach((slide, index) => {
      const active = index === heroIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.tabIndex = active ? 0 : -1;
      slide.inert = !active;
    });
    heroProgress.textContent = String(heroIndex + 1);
  };
  const startHeroTimer = () => {
    clearInterval(heroTimer);
    if (!heroPaused) heroTimer = setInterval(() => { heroIndex = (heroIndex + 1) % heroSlides.length; renderHero(); }, 5200);
  };
  const showHero = direction => {
    if (heroSlides.length < 2) return;
    if (heroSlides[heroIndex].contains(document.activeElement)) heroTrack.focus({ preventScroll: true });
    heroIndex = (heroIndex + direction + heroSlides.length) % heroSlides.length;
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
  const update = () => {
    const query = state.query.trim().toLocaleLowerCase();
    const books = library.books.filter(b => {
      const matchesCategory = state.category === "all" || (state.category === "reading" ? b.chapters.some(c => c.id === progress[b.id]?.chapter) : edition(b).category === state.category);
      return matchesCategory && `${b.title} ${b.englishTitle} ${b.author}`.toLocaleLowerCase().includes(query);
    });
    if (state.sort === "title") books.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    if (state.sort === "year") books.sort((a, b) => b.year - a.year);
    const discovery = !query && state.category === "all";
    document.querySelectorAll(".discovery-content").forEach(el => el.hidden = !discovery);
    page.querySelectorAll("[data-category]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.category === state.category)));
    page.querySelector("#catalog-title").innerHTML = `${query ? "검색 결과" : state.category === "reading" ? "이어 읽는 이야기" : discovery ? "지금 만나볼 이야기" : "전체 도서"} <span>${books.length}</span>`;
    page.querySelector("#catalog-intro").textContent = state.category === "reading" ? "마지막으로 머문 장면에서 다시 시작하세요." : "책을 고르면, 그 안의 세계가 열립니다.";
    page.querySelector("#catalog-status").textContent = `${query ? `“${state.query.trim()}” · ` : ""}${books.length}권`;
    const spaces = discovery && books.length > 0 && books.length < 6 ? Array.from({ length: 6 - books.length }, () => '<div class="catalog-slot" aria-label="새로운 도서를 위한 빈 자리"><span class="empty-cover image-placeholder"></span><span>새로운 이야기 준비 중</span></div>').join("") : "";
    page.querySelector("#book-grid").innerHTML = books.length ? books.map(bookCard).join("") + spaces : `<div class="catalog-empty">${icon("book-open")}<h3>${state.category === "reading" && !query ? "아직 펼친 이야기가 없어요" : "찾는 이야기가 없어요"}</h3><p>${state.category === "reading" && !query ? "책을 고르면 마지막으로 머문 장면을 이어볼 수 있어요." : "다른 검색어를 입력하거나 전체 책장을 둘러보세요."}</p><button class="primary-button" data-reset>전체 도서 보기</button></div>`;
    icons();
    updateRail();
  };
  const showCatalog = category => {
    state.query = ""; search.value = ""; state.category = category;
    update();
    page.querySelector("#catalog-title").focus({ preventScroll: true });
  };
  const enter = (id, chapter) => {
    state.scroll = scrollY; state.selected = id;
    onEnter(id, chapter);
  };
  const showScenes = () => {
    page.querySelector("#scene-title").scrollIntoView({ behavior: motion(), block: "start" });
    page.querySelector("#scene-title").focus({ preventScroll: true });
  };
  document.querySelector(".reading-ribbon")?.addEventListener("click", showScenes, options);
  search.addEventListener("input", () => { state.query = search.value; update(); }, options);
  sort.addEventListener("change", () => { state.sort = sort.value; update(); }, options);
  rail.addEventListener("scroll", updateRail, { ...options, passive: true });
  heroTrack.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, id: event.pointerId };
    try { heroTrack.setPointerCapture?.(event.pointerId); } catch {}
  }, options);
  heroTrack.addEventListener("pointermove", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const x = event.clientX - pointerStart.x;
    const y = event.clientY - pointerStart.y;
    pointerStart.lastX = event.clientX;
    pointerStart.lastY = event.clientY;
    if (Math.abs(x) <= Math.abs(y) || Math.abs(x) < 5) return;
  }, options);
  heroTrack.addEventListener("pointerup", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    finishSwipe(event.clientX, event.clientY);
  }, options);
  heroTrack.addEventListener("pointercancel", () => {
    if (!pointerStart) return;
    finishSwipe(pointerStart.lastX, pointerStart.lastY);
  }, options);
  heroTrack.addEventListener("dragstart", event => event.preventDefault(), { ...options, capture: true });
  heroTrack.addEventListener("click", event => {
    if (performance.now() > suppressHeroClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
    suppressHeroClickUntil = 0;
  }, { ...options, capture: true });
  hero.addEventListener("keydown", event => {
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
  const resize = new ResizeObserver(updateRail);
  resize.observe(rail);
  page.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.category) { state.category = button.dataset.category; update(); }
    if (button.dataset.quickView) showCatalog(button.dataset.quickView);
    if (button.dataset.quickCategory) showCatalog(button.dataset.quickCategory);
    if (button.dataset.featureDirection) showHero(Number(button.dataset.featureDirection));
    if (button.hasAttribute("data-feature-autoplay")) {
      heroPaused = !heroPaused;
      button.querySelector("span").textContent = heroPaused ? "▶" : "Ⅱ";
      button.setAttribute("aria-label", heroPaused ? "히어로 자동 재생 시작" : "히어로 자동 재생 중지");
      startHeroTimer();
    }
    if (button.hasAttribute("data-reset")) { showCatalog("all"); search.focus(); }
    if (button.dataset.enter) enter(button.dataset.enter);
    if (button.dataset.featureBook) enter(button.dataset.featureBook);
    if (button.dataset.sceneBook) enter(button.dataset.sceneBook, button.dataset.sceneChapter);
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
