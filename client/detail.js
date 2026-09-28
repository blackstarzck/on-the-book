// Markup for the book and scene detail pages, built from library data.
// No CSS or image imports here: `node --test` loads this file. main.js imports detail.css.
import { esc, icon } from "../shared/ui.js";
import { edition, bookCover } from "./book-meta.js";

// The only place that spells reader addresses. `?book=` is the book detail, `&scene=` the scene
// detail and `&chapter=` the 3D world. The draft preview flag rides along on every address.
export function detailUrl({ book, scene, chapter, preview = false }) {
  const params = new URLSearchParams({ book });
  if (chapter) params.set("chapter", chapter);
  else if (scene) params.set("scene", scene);
  if (preview) params.set("preview", "draft");
  return `?${params}`;
}

const two = n => String(n).padStart(2, "0");

// The chapter's main placement, falling back to the first one. Null when the chapter has no placements.
const mainPlacement = chapter =>
  chapter.placements.find(p => p.id === chapter.mainPlacementId) || chapter.placements[0] || null;

// The chapter the reader last stood in, or null when the record is missing or points at a removed chapter.
const savedChapter = (book, progress) =>
  book.chapters.find(c => c.id === progress?.[book.id]?.chapter) || null;

const themeChip = theme => `<span class="theme-chip" data-theme="${esc(theme)}" aria-hidden="true"></span>`;

const sectionHeading = (id, title, description) =>
  `<div class="section-heading"><div><h2 id="${id}">${title}</h2>${description ? `<p>${description}</p>` : ""}</div></div>`;

const sourceNote = book =>
  `<section class="detail-source" aria-labelledby="detail-source-title"><h2 id="detail-source-title">원작 정보</h2><p class="source-note">${esc(book.rights)}<br><a href="${esc(book.source)}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a></p></section>`;

// The 3D entry button. Without a chapter, main.js resumes the saved chapter or starts at the first one.
const enterButton = (book, chapter, label) =>
  `<button class="primary-button detail-enter" data-enter="${esc(book.id)}"${chapter ? ` data-enter-chapter="${esc(chapter.id)}"` : ""}>${label} ${icon("arrow-up-right")}</button>`;

export function bookDetail({ book, progress = {}, preview = false }) {
  const saved = savedChapter(book, progress);
  const cta = saved
    ? `${enterButton(book, null, `<span class="detail-enter-copy"><strong>이어 읽기</strong><small>${two(book.chapters.indexOf(saved) + 1)} · ${esc(saved.title)}</small></span>`)}<button class="text-button detail-restart" data-enter="${esc(book.id)}" data-enter-chapter="${esc(book.chapters[0].id)}">처음부터 시작하기</button>`
    : enterButton(book, null, "이야기 속으로 들어가기");
  const rows = book.chapters.map((chapter, index) => {
    const main = mainPlacement(chapter);
    return `<li><a class="journey-row" href="${esc(detailUrl({ book: book.id, scene: chapter.id, preview }))}" data-scene-book="${esc(book.id)}" data-scene-chapter="${esc(chapter.id)}">${themeChip(chapter.theme)}<span class="journey-number">${two(index + 1)}</span><span class="journey-copy"><strong>${esc(chapter.title)}</strong>${chapter.subtitle ? `<small>${esc(chapter.subtitle)}</small>` : ""}</span>${main ? `<span class="journey-model">· ${esc(main.title)}</span>` : ""}${chapter === saved ? '<span class="journey-badge">마지막에 머문 장면</span>' : ""}${icon("chevron-right")}</a></li>`;
  }).join("");
  return `<main class="detail-page store-content" id="main-content" data-view="book">
    <section class="detail-hero" aria-labelledby="detail-title"><span class="detail-cover">${bookCover()}</span><div class="detail-copy"><span class="eyebrow">${esc(edition(book).category)} · ${book.chapters.length}개의 장면 · ${book.year}</span><h1 id="detail-title" tabindex="-1">${esc(book.title)}</h1><p class="detail-meta">${esc(book.englishTitle)} · ${esc(book.author)}</p><p class="detail-description">${esc(book.description)}</p></div></section>
    <div class="detail-cta">${cta}</div>
    <section class="detail-section" id="detail-journey" aria-labelledby="detail-journey-title">${sectionHeading("detail-journey-title", "이 책의 여정", "장면을 고르면 그 장면의 이야기를 먼저 볼 수 있어요.")}<ol class="journey-list">${rows}</ol></section>
    ${sourceNote(book)}
  </main>`;
}
