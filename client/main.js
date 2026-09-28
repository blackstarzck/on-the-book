import { revealReading } from "../shared/floor-reading.js";
import { Journey } from "./journey.js";
import { showLoading, clearLoading, transitionPage } from "./transitions.js";
import { api, esc, icon, icons, logo, modal, toast } from "../shared/ui.js";
import "../shared/style.css";
import { announcementBanner, landing, setupCatalog } from "./landing.js";
import { bookCover, edition } from "./book-meta.js";
import { bookDetail, scenePanel, sceneBar, sceneStatus, defaultScene, detailUrl } from "./detail.js";
import "./detail.css";
let library,
  book,
  chapter,
  world,
  // Which screen is on: the bookshelf ("home"), the book detail ("book", with `chapter` as the panel's scene) or the 3D world.
  view = "home",
  // Whether the address names the panel's scene (`&scene=`). False while the panel shows the default scene.
  sceneAddressed = false,
  // The phone's scene sheet while it is open.
  sceneSheet = null,
  sound = false,
  audioContext,
  ambient,
  saveTimer,
  disposeView;
const catalogState = { query: "", category: "all", sort: "default", scroll: 0, selected: null };
const draftPreview = new URLSearchParams(location.search).get("preview") === "draft";
// The draft preview holds unpublished books too; its bookshelf shows what publishing would show.
const shelf = () => draftPreview ? { ...library, books: library.books.filter((b) => b.published) } : library;
// The studio's Vercel project serves the reader for previews but has no /about page.
const aboutLink = !draftPreview && import.meta.env.MODE !== "admin";
const baseTitle = document.title;
let progress;
try {
  progress = JSON.parse(localStorage.getItem("otb-reader") || "{}");
} catch {
  progress = {};
}
if (!progress || typeof progress !== "object" || Array.isArray(progress))
  progress = {};
const app = document.querySelector("#app");
// Modified clicks (new tab, new window) keep the browser's own behaviour.
const modifiedClick = event => event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
const remember = () => {
  if (draftPreview) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem("otb-reader", JSON.stringify(progress));
    } catch {
      toast("이 브라우저에서는 탐험 기록을 저장할 수 없습니다.");
    }
  }, 100);
};
function record() {
  if (!progress[book.id] || typeof progress[book.id] !== "object")
    progress[book.id] = { chapter: book.chapters[0].id };
  return progress[book.id];
}
// The address of the current screen, carrying the draft preview flag when it is on.
function currentUrl() {
  if (view === "home") return `${location.pathname}${draftPreview ? "?preview=draft" : ""}`;
  return location.pathname + detailUrl({
    book: book.id,
    scene: view === "book" && sceneAddressed ? chapter.id : undefined,
    chapter: view === "world" ? chapter.id : undefined,
    preview: draftPreview,
  });
}
// Which screen a query string asks for. Unknown ids fall back to the nearest screen;
// `clean` says the address had unusable parts and should be rewritten.
function resolveView(params) {
  const selected = library.books.find(b => b.id === params.get("book"));
  if (!selected) return { view: "home", book: library.books[0], chapter: library.books[0].chapters[0], sceneAddressed: false, clean: params.has("book") || params.has("scene") || params.has("chapter") };
  const explored = selected.chapters.find(c => c.id === params.get("chapter"));
  if (explored) return { view: "world", book: selected, chapter: explored, sceneAddressed: false, clean: false };
  const scene = selected.chapters.find(c => c.id === params.get("scene"));
  if (scene) return { view: "book", book: selected, chapter: scene, sceneAddressed: true, clean: false };
  return { view: "book", book: selected, chapter: defaultScene(selected, progress), sceneAddressed: false, clean: params.has("scene") || params.has("chapter") };
}
function applyResolved(state) {
  view = state.view;
  book = state.book;
  chapter = state.chapter;
  sceneAddressed = state.sceneAddressed;
  if (view === "world") { record().chapter = chapter.id; remember(); }
  if (state.clean) history.replaceState(null, "", currentUrl());
}
function pageTitle() {
  if (view === "book") return `${book.title} — On the Book`;
  return baseTitle;
}
function header() {
  const compact = view !== "home";
  return `<header class="site-header${compact ? " reader-header" : ""}"><a class="brand" href="/client/${draftPreview ? "?preview=draft" : ""}" aria-label="On the Book 홈">${logo}</a>${compact ? "" : `<label class="header-search">${icon("search")}<input id="book-search" type="search" aria-label="도서 제목 또는 작가 검색" placeholder="어떤 이야기를 찾으세요?" value="${esc(catalogState.query)}" autocomplete="off"></label>`}<nav aria-label="주 메뉴">${aboutLink ? '<a id="about-link" class="text-button" href="/about">소개</a>' : ""}<button id="library-button" class="${compact ? "text-button" : "icon-button"}" aria-label="${compact ? "책장으로" : "책장 홈"}">${icon(compact ? "arrow-left" : "book-open")}${compact ? "책장으로" : ""}</button>${view === "world" ? `<button id="sound-button" class="icon-button" aria-label="${sound ? "소리 끄기" : "소리 켜기"}" aria-pressed="${sound}">${icon(sound ? "volume-2" : "volume-x")}</button>` : ""}<button id="help-button" class="icon-button" aria-label="이용 방법">${icon("help-circle")}</button></nav></header>`;
}
function page() {
  if (view === "home") return landing(shelf(), progress, catalogState, draftPreview);
  if (view === "book") return bookDetail({ book, chapter, library, progress, preview: draftPreview });
  const index = book.chapters.indexOf(chapter);
  return `<main class="reader is-exploring"><div class="scene-wrap" id="world"></div>
 <div class="explore-topline"><span class="live-dot"></span> ${esc(book.title)}<button id="reader-book-info" aria-label="${esc(book.title)} 작품 소개">작품 소개 ${icon("chevron-right")}</button></div>
 <div class="touch-pad" aria-label="이동 방향"><button data-dir="up" aria-label="앞으로 이동">↑</button><div><button data-dir="left" aria-label="왼쪽 이동">←</button><button data-dir="down" aria-label="뒤로 이동">↓</button><button data-dir="right" aria-label="오른쪽 이동">→</button></div></div>
 <div class="journey-controls"><button id="prev-chapter" class="icon-button" aria-label="이전 챕터" ${index === 0 ? "disabled" : ""}>${icon("arrow-left")}</button><button id="map-button" class="chapter-switch"><span><small>지금 걷고 있는 페이지</small>${String(index + 1).padStart(2, "0")} — ${esc(chapter.title)}</span></button><button id="next-chapter" class="icon-button" aria-label="다음 챕터" ${index === book.chapters.length - 1 ? "disabled" : ""}>${icon("arrow-right")}</button></div>
 <div class="move-hint">${icon("move")} 땅을 클릭 · 방향키로 이동 <span>물체 가까이 다가가 보세요</span></div></main>`;
}
function render() {
  disposeView?.();
  disposeView = undefined;
  world?.dispose();
  world = undefined;
  const exploring = view === "world";
  if (audioContext) exploring && sound ? audioContext.resume() : audioContext.suspend();
  document.title = pageTitle();
  app.innerHTML = `${view === "home" ? announcementBanner() : ""}${header()}${page()}
 <footer class="site-footer"><span>${exploring ? "문장 너머의 세계를, 천천히." : "오래된 이야기, 새로운 발견."}</span>${exploring ? `<div><span>땅을 클릭 · 방향키로 이동 · 가까이서 움직임 감상</span></div>` : ""}<span class="footer-brand">ON THE BOOK © 2026</span></footer>`;
  if (exploring) try {
    world = new Journey(document.querySelector("#world"), {
      chapter,
      chapters: book.chapters,
      onChapter: syncChapter,
      onReading: showFloorReading,
      models: library.models,
      hero: false,
      onError: toast,
    });
    // Keep an identifier as the argument: tests/catalog.mjs finds this call in the built bundle by regex, and a literal would minify to !0.
    world.setActive(exploring);
    const panel = document.createElement("aside"); panel.className = "floor-reading-controls"; panel.hidden = true;
    panel.innerHTML = '<h2 id="floor-title"></h2><img class="story-divider" src="/ornaments/story-divider.png" alt="" aria-hidden="true"><p id="floor-accessible" tabindex="0" aria-label="이야기 본문" aria-live="polite"></p><div class="floor-pagination"><button id="floor-prev" class="icon-button" aria-label="이전 글귀">←</button><span id="floor-page"></span><button id="floor-next" class="icon-button" aria-label="다음 글귀">→</button></div>';
    document.querySelector(".reader").append(panel);
    panel.querySelector("#floor-prev").onclick = () => world.turnReadingPage(-1);
    panel.querySelector("#floor-next").onclick = () => world.turnReadingPage(1);
  } catch (e) {
    document.querySelector("#world").innerHTML =
      `<div class="world-error"><h2>3D 화면을 불러오지 못했어요</h2><p>${esc(e.message)}</p><button id="fallback-read" class="primary-button">이야기 읽기</button></div>`;
    document.querySelector("#fallback-read").onclick = readChapter;
  }
  icons();
  document.querySelector("#library-button").onclick = openLibrary;
  document.querySelector(".site-header .brand").onclick = (event) => {
    if (modifiedClick(event)) return;
    event.preventDefault();
    openLibrary();
  };
  document.querySelector("#help-button").onclick = help;
  const soundButton = document.querySelector("#sound-button");
  if (soundButton) soundButton.onclick = toggleSound;
  if (view === "home") {
    disposeView = setupCatalog({ library: shelf(), progress, state: catalogState, preview: draftPreview, onOpen: openDetail, onTrailer: showTrailer, onHelp: help });
  } else if (exploring) {
    document.querySelector("#reader-book-info").onclick = () => bookDetails(book.id);
    document.querySelector("#map-button").onclick = chapterMap;
    document.querySelector("#prev-chapter").onclick = () =>
      goChapter(book.chapters.indexOf(chapter) - 1);
    document.querySelector("#next-chapter").onclick = nextChapter;
    for (const button of document.querySelectorAll("[data-dir]")) {
      const keys = {
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
      };
      button.onpointerdown = (e) => {
        button.setPointerCapture(e.pointerId);
        world?.keys.add(keys[button.dataset.dir]);
      };
      button.onpointerup = button.onpointercancel = () =>
        world?.keys.delete(keys[button.dataset.dir]);
    }
  } else {
    disposeView = setupDetail();
  }
}
const narrow = () => matchMedia("(max-width: 850px)").matches;
// One delegated click handler for the book detail. It sits on the document because the phone's scene sheet is a
// <dialog> appended to <body>, outside <main>. CTA buttons enter the world; scene links swap the panel in place.
function setupDetail() {
  const abort = new AbortController();
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-enter], a[data-scene]");
    if (!target) return;
    if (target.dataset.enter) { sceneSheet?.close(); enterBook(target.dataset.enter, target.dataset.enterChapter); return; }
    if (modifiedClick(event)) return;
    event.preventDefault();
    selectScene(target.dataset.scene, { sheet: target.classList.contains("journey-row") && narrow() });
  }, { signal: abort.signal });
  return () => { abort.abort(); sceneSheet?.close(); };
}
// Shows a scene in the panel (and in the phone sheet when asked) without leaving the page or adding history.
function selectScene(sceneId, { sheet = false } = {}) {
  const next = book.chapters.find(c => c.id === sceneId);
  if (!next) return;
  chapter = next;
  sceneAddressed = true;
  history.replaceState(null, "", currentUrl());
  const options = { book, chapter, library, progress, preview: draftPreview };
  const panel = document.querySelector(".scene-panel");
  panel.innerHTML = scenePanel(options);
  panel.scrollTop = 0;
  document.querySelector(".detail-cta").innerHTML = sceneBar({ book, chapter });
  for (const row of document.querySelectorAll(".journey-row")) row.setAttribute("aria-current", String(row.dataset.scene === chapter.id));
  document.querySelector("#scene-status").textContent = sceneStatus({ book, chapter });
  if (sceneSheet?.open) {
    for (const node of sceneSheet.querySelectorAll(":scope > :not(.close-modal)")) node.remove();
    sceneSheet.insertAdjacentHTML("beforeend", scenePanel({ ...options, prefix: "sheet" }));
    sceneSheet.scrollTop = 0;
  } else if (sheet) {
    sceneSheet = modal(scenePanel({ ...options, prefix: "sheet" }));
    sceneSheet.classList.add("scene-sheet");
    sceneSheet.setAttribute("aria-labelledby", "sheet-scene-title");
    sceneSheet.addEventListener("close", () => { sceneSheet = null; }, { once: true });
  }
  icons();
}
function showFloorReading(state) {
  const panel = document.querySelector(".floor-reading-controls"); if (!panel) return;
  panel.hidden = !state; if (!state) return;
  panel.querySelector("#floor-title").textContent = state.title;
  panel.querySelector("#floor-page").textContent = `${state.page + 1} / ${state.count}`;
  panel.querySelector("#floor-prev").disabled = state.page === 0;
  panel.querySelector("#floor-next").disabled = state.page === state.count - 1;
  panel.querySelector("#floor-accessible").textContent = state.text;
  panel.querySelector("#floor-accessible").scrollTop = 0;
  const settings = state.settings || {};
  if (settings.floorStagger !== false) revealReading(panel);
}
function syncChapter(index) {
  chapter = book.chapters[index]; record().chapter = chapter.id; remember();
  document.querySelector("#map-button span").innerHTML = `<small>이야기의 지도</small>${String(index + 1).padStart(2, "0")} — ${esc(chapter.title)}`;
  document.querySelector("#prev-chapter").disabled = index === 0;
  document.querySelector("#next-chapter").disabled = index === book.chapters.length - 1;
  history.replaceState(null, "", currentUrl());
}
function goChapter(index) {
  if (index < 0 || index >= book.chapters.length) return;
  if (view === "world" && world instanceof Journey) {
    if (index === book.chapters.indexOf(chapter)) return;
    transitionPage(app, () => world.jump(index), { label: "다음 장면을 펼치는 중이에요…", focus: "#map-button" });
    return;
  }
  transitionPage(app, () => {
    chapter = book.chapters[index];
    record().chapter = chapter.id;
    remember();
    view = "world";
    render();
    history.replaceState(null, "", currentUrl());
  });
}
function nextChapter() { goChapter(book.chapters.indexOf(chapter) + 1); }
function help() {
  modal(
    `<span class="eyebrow">HOW TO WANDER</span><h2>정해진 속도는 없어요.</h2><div class="instruction"><b>01</b><p><strong>가고 싶은 곳을 눌러요</strong>땅을 클릭하거나 마우스를 누른 채 움직이면 그 위치를 따라가요. 방향키·W A S D로도 이동해요. 휴대폰에서는 화면의 방향 버튼도 사용할 수 있어요.</p></div><div class="instruction"><b>02</b><p><strong>작은 물체에 다가가요</strong>챕터의 3D 모델에 가까워지면 애니메이션이 재생돼요. 멀어지면 멈추고, 다시 가까워지면 처음부터 재생돼요.</p></div><div class="instruction"><b>03</b><p><strong>다음 이야기를 만나요</strong>넓게 이어진 공간을 자유롭게 걸어요. 이동을 위한 조건은 없어요. 지도에서 원하는 챕터를 바로 열 수도 있어요.</p></div><p class="muted">소리는 오른쪽 위에서 켤 수 있어요. 탐험 기록은 이 브라우저에 저장돼요.</p>`,
  );
}
function readChapter() {
  modal(
    `<span class="eyebrow">CHAPTER ${String(book.chapters.indexOf(chapter) + 1).padStart(2, "0")}</span><h2>${esc(chapter.title)}</h2><div class="reading-text">${chapter.body
      .split("\n\n")
      .map((p) => `<p>${esc(p)}</p>`)
      .join(
        "",
      )}</div><p class="source-note">${esc(book.rights)}<br><a href="${esc(book.source)}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a></p>`,
  );
}
async function enterBook(id, chapterId) {
  const selected = library.books.find(b => b.id === id);
  if (!selected) return;
  await transitionPage(app, () => {
    book = selected;
    chapter = book.chapters.find(c => c.id === chapterId) || book.chapters.find(c => c.id === progress[id]?.chapter) || book.chapters[0];
    view = "world";
    record().chapter = chapter.id;
    remember();
    history.pushState(null, "", currentUrl());
    render();
  }, { label: "이야기 속으로 들어가는 중이에요…" });
}
// Opens the book detail with a history entry: on the default scene, or on the scene a home card named.
async function openDetail(target, bookId, sceneId) {
  const selected = library.books.find(b => b.id === bookId);
  if (!selected) return;
  const scene = target === "scene" ? selected.chapters.find(c => c.id === sceneId) : null;
  if (target === "scene" && !scene) return;
  await transitionPage(app, () => {
    view = "book";
    book = selected;
    chapter = scene || defaultScene(selected, progress);
    sceneAddressed = Boolean(scene);
    history.pushState(null, "", currentUrl());
    render();
  }, { label: "작품을 펼치는 중이에요…" });
}
async function openLibrary() {
  if (view === "home") {
    catalogState.query = "";
    catalogState.category = "all";
    render();
    document.querySelector("#catalog-title").focus();
    return;
  }
  const changed = await transitionPage(app, () => {
    view = "home";
    history.pushState(null, "", currentUrl());
    render();
  }, { label: "책장으로 돌아가는 중이에요…", focus: "#catalog-title" });
  if (changed) restoreCatalogPosition();
}
function restoreCatalogPosition() {
  window.scrollTo({ top: catalogState.scroll, behavior: "instant" });
  // `selected` is the CSS selector of the card that opened the detail. An inert hero slide simply keeps the title focus.
  if (catalogState.selected) document.querySelector(catalogState.selected)?.focus({ preventScroll: true });
}
// Work information inside the 3D world. The bookshelf reaches the same information through the book detail page.
function bookDetails(id) {
  const selected = library.books.find(b => b.id === id);
  if (!selected) return;
  const d = modal(`<div class="book-detail-heading">${bookCover(selected)}<div><span class="eyebrow">${esc(edition(selected).category)} · ${selected.chapters.length}개의 장면</span><h2 id="book-detail-title">${esc(selected.title)}</h2><p>${esc(selected.author)} · ${selected.year}</p><p>${esc(selected.englishTitle)}</p></div></div><p class="book-detail-copy">${esc(selected.description)}</p><h3>이 책에서 만날 장면</h3><ol class="book-detail-chapters">${selected.chapters.map(c => `<li>${esc(c.title)}</li>`).join("")}</ol><p class="source-note">${esc(selected.rights)}<br><a href="${esc(selected.source)}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a></p><button class="primary-button book-detail-enter">이야기로 돌아가기 ${icon("arrow-up-right")}</button>`);
  d.setAttribute("aria-labelledby", "book-detail-title");
  d.querySelector(".book-detail-enter").onclick = () => d.close();
}
function showTrailer() {
  const d = modal('<h2 id="trailer-title">먼저 만나는 온더북</h2><video src="/trailer-web.mp4" controls playsinline preload="none" aria-label="On the Book 브랜드 트레일러"></video><p class="trailer-error" role="status" hidden>영상을 불러오지 못했어요. 책장에서는 계속 작품을 둘러볼 수 있어요.</p>');
  d.classList.add("trailer-modal");
  d.setAttribute("aria-labelledby", "trailer-title");
  const video = d.querySelector("video");
  video.addEventListener("error", () => d.querySelector(".trailer-error").hidden = false);
  d.addEventListener("close", () => { video.pause(); video.removeAttribute("src"); video.load(); });
}
function chapterMap() {
  const d = modal(
    `<span class="eyebrow">YOUR JOURNEY</span><h2>이야기의 지도</h2><div class="chapter-list">${book.chapters.map((c, i) => `<button data-chapter="${i}" class="${c === chapter ? "selected" : ""}"><b>${String(i + 1).padStart(2, "0")}</b><span><strong>${esc(c.title)}</strong><small>${esc(c.subtitle)}</small></span>${icon(c === chapter ? "check" : "arrow-right")}</button>`).join("")}</div>`,
  );
  for (const b of d.querySelectorAll("[data-chapter]"))
    b.onclick = () => {
      d.close();
      goChapter(+b.dataset.chapter);
    };
}
async function toggleSound() {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
      ambient = audioContext.createGain();
      ambient.gain.value = 0;
      ambient.connect(audioContext.destination);
      for (const frequency of [130.81, 196, 261.63]) {
        const o = audioContext.createOscillator();
        o.type = "sine";
        o.frequency.value = frequency;
        o.connect(ambient);
        o.start();
      }
    }
    await audioContext.resume();
    sound = !sound;
    ambient.gain.setTargetAtTime(
      sound ? 0.014 : 0,
      audioContext.currentTime,
      0.3,
    );
    const b = document.querySelector("#sound-button");
    b.innerHTML = icon(sound ? "volume-2" : "volume-x");
    b.setAttribute("aria-label", sound ? "소리 끄기" : "소리 켜기");
    b.setAttribute("aria-pressed", String(sound));
    icons();
  } catch {
    toast("이 브라우저에서 소리를 재생할 수 없습니다.");
  }
}
document.addEventListener("visibilitychange", () => {
  if (audioContext)
    document.hidden || view !== "world" ? audioContext.suspend() : sound && audioContext.resume();
});
let navigationVersion = 0;
window.addEventListener("popstate", async () => {
  if (!library?.books.length) return;
  const version = ++navigationVersion;
  // Browser Back remains available while the visual transition blocks page clicks.
  while (app.inert) await new Promise(resolve => setTimeout(resolve, 40));
  if (version !== navigationVersion) return;
  document.querySelectorAll("dialog[open]").forEach(d => d.close());
  const state = resolveView(new URLSearchParams(location.search));
  const changed = await transitionPage(app, () => {
    applyResolved(state);
    render();
  }, { focus: state.view === "home" ? "#catalog-title" : undefined });
  if (changed && view === "home" && version === navigationVersion) restoreCatalogPosition();
});
async function init() {
  if (draftPreview) document.documentElement.dataset.draftPreview = "true";
  app.innerHTML = "";
  showLoading();
  app.setAttribute("aria-busy", "true");
  try {
    library = draftPreview ? (await api("/api/studio")).library : await api("/api/library");
    const params = new URLSearchParams(location.search);
    // A draft preview may still open an unpublished book's detail or 3D world by address; only its bookshelf is limited to published books.
    if (!library.books.length || (!shelf().books.length && resolveView(params).view === "home")) {
      clearLoading();
      app.removeAttribute("aria-busy");
      app.innerHTML =
        '<div class="loading-screen"><h1>새로운 이야기를 준비하고 있어요.</h1><p>관리자가 책을 공개하면 이곳에 나타나요.</p></div>';
      return;
    }
    applyResolved(resolveView(params));
    await transitionPage(app, render, { initial: true });
    if (draftPreview && params.get('model') && world instanceof Journey) {
      const object = world.objects.find(o => o.p.id === params.get('model'));
      if (object) world.moveTo(object.p.x, object.p.z);
    }
  } catch (e) {
    clearLoading();
    app.removeAttribute("aria-busy");
    app.innerHTML = `<div class="loading-screen"><h1>책장을 불러오지 못했어요.</h1><p>${esc(e.message)}</p><button class="primary-button" id="retry">다시 시도</button></div>`;
    document.querySelector("#retry").onclick = init;
  }
}
init();
