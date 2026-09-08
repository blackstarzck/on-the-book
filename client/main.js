import { revealReading } from "../shared/floor-reading.js";
import { World } from "../shared/world.js";
import { Journey } from "./journey.js";
import { showLoading, clearLoading, transitionPage } from "./transitions.js";
import { api, esc, icon, icons, logo, modal, toast } from "../shared/ui.js";
import "../shared/style.css";
let library,
  book,
  chapter,
  world,
  exploring = false,
  sound = false,
  audioContext,
  ambient,
  saveTimer;
const draftPreview = new URLSearchParams(location.search).get("preview") === "draft";
let progress;
try {
  progress = JSON.parse(localStorage.getItem("otb-reader") || "{}");
} catch {
  progress = {};
}
if (!progress || typeof progress !== "object" || Array.isArray(progress))
  progress = {};
const app = document.querySelector("#app");
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
function header() {
  return `<header class="site-header"><a class="brand" href="/client/" aria-label="On the Book 홈">${logo}</a><nav aria-label="주 메뉴"><button id="library-button" class="text-button">책장 둘러보기</button><span class="nav-divider"></span><button id="sound-button" class="icon-button" aria-label="${sound ? "소리 끄기" : "소리 켜기"}" aria-pressed="${sound}">${icon(sound ? "volume-2" : "volume-x")}</button><button id="help-button" class="icon-button" aria-label="이용 방법">${icon("help-circle")}</button></nav></header>`;
}
function render() {
  world?.dispose();
  const index = book.chapters.indexOf(chapter);
  app.innerHTML = `${header()}<main class="reader ${exploring ? "is-exploring" : ""}"><div class="scene-wrap" id="world"></div>${
    exploring
      ? `
 <div class="explore-topline"><span class="live-dot"></span> ${esc(book.title)}<span>나만의 속도로, 한 장면씩</span></div>
 <div class="touch-pad" aria-label="이동 방향"><button data-dir="up" aria-label="앞으로 이동">↑</button><div><button data-dir="left" aria-label="왼쪽 이동">←</button><button data-dir="down" aria-label="뒤로 이동">↓</button><button data-dir="right" aria-label="오른쪽 이동">→</button></div></div>
 <div class="journey-controls"><button id="prev-chapter" class="icon-button" aria-label="이전 챕터" ${index === 0 ? "disabled" : ""}>${icon("arrow-left")}</button><button id="map-button" class="chapter-switch"><span><small>지금 걷고 있는 페이지</small>${String(index + 1).padStart(2, "0")} — ${esc(chapter.title)}</span></button><button id="next-chapter" class="icon-button" aria-label="다음 챕터" ${index === book.chapters.length - 1 ? "disabled" : ""}>${icon("arrow-right")}</button></div>
 <div class="move-hint">${icon("move")} 땅을 클릭 · 방향키로 이동 <span>물체 가까이 다가가 보세요</span></div>`
      : `
 <section class="hero-copy"><span class="eyebrow"><span class="tiny-line"></span> A NEW WAY TO READ</span><h1>책을 펼치면,<br>세상이 <em>깨어나요.</em></h1><p class="hero-description">읽는 것을 넘어, 이야기 속으로.<br>당신의 걸음으로 완성하는 작은 모험.</p><div class="featured-label"><span class="live-dot"></span> 오늘, 걸어 볼 이야기</div><h2>${esc(book.title)}</h2><p class="book-credit">${esc(book.author)} <span>·</span> ${book.year} <span>·</span> ${book.chapters.length}개의 장면</p><div class="reader-entry"><button id="start-button" class="primary-button">책 속으로 들어가기 ${icon("arrow-up-right")}</button><p class="gentle-note">설치 없이, 나만의 속도로 떠나는 여행</p></div></section>
 <div class="scene-label"><span class="label-star">✧</span><div><span>THE WORLD BETWEEN THE PAGES</span><p>${esc(book.englishTitle)}</p></div></div><div class="floating-note">작은 호기심이,<br>큰 모험이 되는 곳.<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M6 8 Q 75 0 80 40 M67 33 L80 40 L86 25"/></svg></div><span class="edition">THE INTERACTIVE CLASSICS COLLECTION &nbsp; / &nbsp; VOL. ${String(library.books.indexOf(book) + 1).padStart(2, "0")}</span>`
  }</main>
 <footer class="site-footer"><span>${exploring ? "문장 너머의 세계를, 천천히." : "오래된 이야기, 새로운 발견."}</span><div>${exploring ? `<span>땅을 클릭 · 방향키로 이동 · 가까이서 움직임 감상</span>` : `<span>01 &nbsp; 책을 고르고</span><i></i><span>02 &nbsp; 장면을 걷고</span><i></i><span>03 &nbsp; 이야기를 만나요</span>`}</div><span class="footer-brand">ON THE BOOK © 2026</span></footer>`;
  try {
    world = new (exploring ? Journey : World)(document.querySelector("#world"), {
      chapter,
      chapters: book.chapters,
      onChapter: syncChapter,
      onReading: showFloorReading,
      models: library.models,
      hero: !exploring,
      onError: toast,
    });
    world.setActive(exploring);
    if (exploring) {
      const panel = document.createElement("aside"); panel.className = "floor-reading-controls"; panel.hidden = true;
      panel.innerHTML = '<h2 id="floor-title"></h2><img class="story-divider" src="/ornaments/story-divider.png" alt="" aria-hidden="true"><p id="floor-accessible" tabindex="0" aria-label="이야기 본문" aria-live="polite"></p><div class="floor-pagination"><button id="floor-prev" class="icon-button" aria-label="이전 글귀">←</button><span id="floor-page"></span><button id="floor-next" class="icon-button" aria-label="다음 글귀">→</button></div>';
      document.querySelector(".reader").append(panel);
      panel.querySelector("#floor-prev").onclick = () => world.turnReadingPage(-1);
      panel.querySelector("#floor-next").onclick = () => world.turnReadingPage(1);
    }
  } catch (e) {
    document.querySelector("#world").innerHTML =
      `<div class="world-error"><h2>3D 화면을 불러오지 못했어요</h2><p>${esc(e.message)}</p><button id="fallback-read" class="primary-button">이야기 읽기</button></div>`;
    document.querySelector("#fallback-read").onclick = readChapter;
  }
  icons();
  document.querySelector("#library-button").onclick = openLibrary;
  document.querySelector("#help-button").onclick = help;
  document.querySelector("#sound-button").onclick = toggleSound;
  if (!exploring) {
    document.querySelector("#start-button").onclick = async () => {
      const changed = await transitionPage(app, () => {
        exploring = true;
        chapter = book.chapters.find((c) => c.id === record().chapter) || book.chapters[0];
        render();
      }, { label: "이야기 속으로 들어가는 중이에요…" });
      if (changed && !progress.tutorial) {
        help();
        progress.tutorial = true;
        remember();
      }
    };
  } else {
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
  }
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
  history.replaceState(null, "", `?book=${book.id}&chapter=${chapter.id}${draftPreview ? "&preview=draft" : ""}`);
}
function goChapter(index) {
  if (index < 0 || index >= book.chapters.length) return;
  if (exploring && world instanceof Journey) {
    if (index === book.chapters.indexOf(chapter)) return;
    transitionPage(app, () => world.jump(index), { label: "다음 장면을 펼치는 중이에요…", focus: "#map-button" });
    return;
  }
  transitionPage(app, () => {
    chapter = book.chapters[index];
    record().chapter = chapter.id;
    remember();
    exploring = true;
    render();
    history.replaceState(null, "", `?book=${book.id}&chapter=${chapter.id}`);
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
function openLibrary() {
  const d = modal(
    `<span class="eyebrow">THE BOOKSHELF</span><h2>어떤 이야기 속을 걸어 볼까요?</h2><div class="bookshelf">${library.books.map((b, i) => `<button class="book-option" data-book="${b.id}"><span class="mini-cover cover-${i % 3}">${b.cover ? `<img class="uploaded-cover" src="${esc(b.cover)}" alt="${esc(b.title)} 표지">` : `<small>ON THE BOOK CLASSICS</small>${icon("book-open")}<strong>${esc(b.englishTitle)}</strong><small>${b.year}</small>`}</span><strong>${esc(b.title)}</strong><span>${esc(b.author)} · ${b.chapters.length}개의 장면</span><p>${esc(b.description)}</p></button>`).join("")}</div>`,
  );
  for (const el of d.querySelectorAll("[data-book]"))
    el.onclick = () => {
      d.close();
      transitionPage(app, () => {
        book = library.books.find((b) => b.id === el.dataset.book);
        chapter = book.chapters[0];
        exploring = false;
        history.replaceState(null, "", `?book=${book.id}${draftPreview ? "&preview=draft" : ""}`);
        render();
      }, { label: "새로운 이야기를 펼치는 중이에요…" });
    };
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
    document.hidden ? audioContext.suspend() : sound && audioContext.resume();
});
async function init() {
  if (draftPreview) document.documentElement.dataset.draftPreview = "true";
  app.innerHTML = "";
  showLoading();
  app.setAttribute("aria-busy", "true");
  try {
    library = draftPreview ? (await api("/api/studio")).library : await api("/api/library");
    if (!library.books.length) {
      clearLoading();
      app.removeAttribute("aria-busy");
      app.innerHTML =
        '<div class="loading-screen"><h1>새로운 이야기를 준비하고 있어요.</h1><p>관리자가 책을 공개하면 이곳에 나타나요.</p></div>';
      return;
    }
    const params = new URLSearchParams(location.search);
    book =
      library.books.find((b) => b.id === params.get("book")) ||
      library.books[0];
    chapter =
      book.chapters.find((c) => c.id === params.get("chapter")) ||
      book.chapters[0];
    exploring = params.has("chapter");
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



