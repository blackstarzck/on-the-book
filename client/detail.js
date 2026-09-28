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
    <section class="detail-hero" aria-labelledby="detail-title"><span class="detail-cover">${bookCover(book)}</span><div class="detail-copy"><span class="eyebrow">${esc(edition(book).category)} · ${book.chapters.length}개의 장면 · ${book.year}</span><h1 id="detail-title" tabindex="-1">${esc(book.title)}</h1><p class="detail-meta">${esc(book.englishTitle)} · ${esc(book.author)}</p><p class="detail-description">${esc(book.description)}</p></div></section>
    <div class="detail-cta">${cta}</div>
    <section class="detail-section" id="detail-journey" aria-labelledby="detail-journey-title">${sectionHeading("detail-journey-title", "이 책의 여정", "장면을 고르면 그 장면의 이야기를 먼저 볼 수 있어요.")}<ol class="journey-list">${rows}</ol></section>
    ${sourceNote(book)}
  </main>`;
}

export function sceneDetail({ book, chapter, library, preview = false }) {
  const index = book.chapters.findIndex(c => c.id === chapter.id);
  if (index < 0) throw new Error(`Chapter ${chapter.id} is not part of ${book.id}`);
  const previous = book.chapters[index - 1], next = book.chapters[index + 1];
  const paragraphs = chapter.body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const main = mainPlacement(chapter);
  const figures = main ? [main, ...chapter.placements.filter(p => p !== main)] : [];
  const colorOf = placement => library.models.find(m => m.id === placement.modelId)?.color || "var(--accent)";
  const bookHref = `href="${esc(detailUrl({ book: book.id, preview }))}" data-book="${esc(book.id)}"`;
  const sceneLink = (target, label) =>
    `<a class="neighbor-link" href="${esc(detailUrl({ book: book.id, scene: target.id, preview }))}" data-scene-book="${esc(book.id)}" data-scene-chapter="${esc(target.id)}">${label}</a>`;
  // Only the first paragraph is shown here; the rest waits on the floor inside the 3D world.
  const previewSection = paragraphs.length
    ? `<section class="detail-section" id="detail-preview" aria-labelledby="detail-preview-title">${sectionHeading("detail-preview-title", "미리 읽기")}<div class="reading-text"><p>${esc(paragraphs[0])}</p></div>${paragraphs.length > 1 && chapter.floorEnabled !== false ? '<p class="muted detail-note">이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요.</p>' : ""}</section>`
    : "";
  const figureSection = figures.length
    ? `<section class="detail-section" id="detail-figures" aria-labelledby="detail-figures-title">${sectionHeading("detail-figures-title", "이 장면에서 만나는 것들", "가까이 다가가면 움직여요.")}<ul class="figure-list">${figures.map(p => `<li><span class="figure-chip" style="background:${esc(colorOf(p))}" aria-hidden="true"></span><span class="figure-copy"><strong>${esc(p.title)}</strong>${p === main ? '<span class="journey-badge">장면의 중심</span>' : ""}${p.story ? `<span class="figure-story">${esc(p.story)}</span>` : ""}</span></li>`).join("")}</ul></section>`
    : "";
  // The hero shows the studio thumbnail over the theme tint when one is set; otherwise the slot stays empty and labelled.
  return `<main class="detail-page store-content" id="main-content" data-view="scene">
    <nav class="detail-crumbs" aria-label="현재 위치"><a ${bookHref}>${esc(book.title)}</a><span aria-hidden="true">›</span><span aria-current="page">장면 ${two(index + 1)}</span></nav>
    <section class="detail-hero detail-hero--scene" aria-labelledby="detail-title"><span class="scene-image image-placeholder${chapter.thumbnail ? " has-image" : ""}" data-theme="${esc(chapter.theme)}" role="img" aria-label="${chapter.thumbnail ? `${esc(chapter.title)} 장면 이미지` : "장면 이미지 준비 중"}">${chapter.thumbnail ? `<img src="${esc(chapter.thumbnail)}" alt="" decoding="async" draggable="false">` : ""}<span class="scene-number">${two(index + 1)}</span></span><div class="detail-copy"><span class="eyebrow">장면 ${two(index + 1)} / ${two(book.chapters.length)} · ${esc(book.title)}</span><h1 id="detail-title" tabindex="-1">${esc(chapter.title)}</h1>${chapter.subtitle ? `<p class="detail-meta">${esc(chapter.subtitle)}</p>` : ""}</div></section>
    <div class="detail-cta">${enterButton(book, chapter, "이 장면부터 걷기")}</div>
    ${previewSection}
    ${figureSection}
    <section class="detail-section" id="detail-neighbors"><nav class="neighbor-nav" aria-label="이어지는 장면">${previous ? sceneLink(previous, `${icon("arrow-left")} ${two(index)} ${esc(previous.title)}`) : "<span></span>"}<a class="neighbor-all" ${bookHref}>작품 전체 보기</a>${next ? sceneLink(next, `${two(index + 2)} ${esc(next.title)} ${icon("arrow-right")}`) : "<span></span>"}</nav></section>
    ${sourceNote(book)}
  </main>`;
}
