// Markup for the book detail page: the scrolling left column (hero, journey, author and book intros),
// the sticky scene panel, the phone bar and the phone sheet. No CSS or image imports here: `node --test` loads this file;
// main.js imports detail.css.
import { esc, icon } from "../shared/ui.js";
import { bookCover } from "./book-meta.js";

// The only place that spells reader addresses. `?book=` is the book detail, `&scene=` selects a scene on it
// and `&chapter=` is the 3D world. The draft preview flag rides along on every address.
export function detailUrl({ book, scene, chapter, preview = false }) {
  const params = new URLSearchParams({ book });
  if (chapter) params.set("chapter", chapter);
  else if (scene) params.set("scene", scene);
  if (preview) params.set("preview", "draft");
  return `?${params}`;
}

const two = n => String(n).padStart(2, "0");

const indexOf = (book, chapter) => {
  const index = book.chapters.findIndex(c => c.id === chapter.id);
  if (index < 0) throw new Error(`Chapter ${chapter.id} is not part of ${book.id}`);
  return index;
};

// The chapter the reader last stood in, or null when the record is missing or points at a removed chapter.
const savedChapter = (book, progress) =>
  book.chapters.find(c => c.id === progress?.[book.id]?.chapter) || null;

// The scene the panel opens on: the saved chapter while it exists, otherwise the first chapter.
export const defaultScene = (book, progress = {}) => savedChapter(book, progress) || book.chapters[0];

// The saved scene's mark: a flag right after the scene title, in its journey row and in the scene panel. Its label
// names it for screen readers and is the text of the tooltip detail.css shows on hover. There is no `title`, so the
// browser's own tooltip does not appear on top of it.
const savedFlag = `<span class="saved-flag" role="img" aria-label="마지막에 머문 장면">${icon("flag")}</span>`;

// Blank lines split paragraphs. Stored data is not re-parsed, so a field added later may be missing.
const paragraphsOf = text => String(text ?? "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

// A studio-written section under the journey (저자 소개, 책 소개). An empty field keeps the section and shows
// its `pending` line instead.
const introSection = ({ id, title, text, pending, name = "" }) => {
  const paragraphs = paragraphsOf(text);
  const body = paragraphs.length
    ? `<div class="detail-prose">${paragraphs.map(p => `<p>${esc(p)}</p>`).join("")}</div>`
    : `<p class="detail-intro-empty">${pending}</p>`;
  return `<section class="detail-section detail-intro" id="${id}" aria-labelledby="${id}-title"><div class="section-heading"><h2 id="${id}-title">${title}</h2></div>${name ? `<p class="detail-intro-name">${esc(name)}</p>` : ""}${body}</section>`;
};

// The single 3D entry button: it always names the scene it enters.
const enterButton = (book, chapter) =>
  `<button class="primary-button detail-enter" data-enter="${esc(book.id)}" data-enter-chapter="${esc(chapter.id)}">이 장면부터 걷기 ${icon("arrow-up-right")}</button>`;

// The inside of the scene panel: image, scene heading (with the saved scene's flag), the entry button and the
// neighbour buttons. The scene's models are met in the 3D world, not listed here. `prefix` keeps element ids unique
// when the same markup also fills the phone sheet.
export function scenePanel({ book, chapter, progress = {}, preview = false, prefix = "panel" }) {
  const index = indexOf(book, chapter);
  const previous = book.chapters[index - 1], next = book.chapters[index + 1];
  const saved = savedChapter(book, progress);
  // Previous and next scene as two equal buttons under the CTA. The visible words open the accessible name, which
  // adds the target scene. A missing side keeps a dimmed slot, hidden from assistive tech, so the widths match.
  const neighbor = (target, label, content) => target
    ? `<a class="neighbor-link" href="${esc(detailUrl({ book: book.id, scene: target.id, preview }))}" data-scene="${esc(target.id)}" aria-label="${label}: ${two(indexOf(book, target) + 1)} ${esc(target.title)}">${content}</a>`
    : `<span class="neighbor-link is-disabled" aria-hidden="true">${content}</span>`;
  const neighborNav = `<nav class="neighbor-nav" aria-label="이어지는 장면">${neighbor(previous, "이전 장면", `${icon("arrow-left")} 이전 장면`)}${neighbor(next, "다음 장면", `다음 장면 ${icon("arrow-right")}`)}</nav>`;
  // The image slot is always 16:10 in the panel; a studio thumbnail fills it over the theme tint.
  return `<span class="scene-image image-placeholder${chapter.thumbnail ? " has-image" : ""}" data-theme="${esc(chapter.theme)}" role="img" aria-label="${chapter.thumbnail ? `${esc(chapter.title)} 장면 이미지` : "장면 이미지 준비 중"}">${chapter.thumbnail ? `<img src="${esc(chapter.thumbnail)}" alt="" decoding="async" draggable="false">` : ""}<span class="scene-number">${two(index + 1)}</span></span><h2 id="${prefix}-scene-title">${esc(chapter.title)}${saved?.id === chapter.id ? savedFlag : ""}</h2>${chapter.subtitle ? `<p class="detail-meta">${esc(chapter.subtitle)}</p>` : ""}${enterButton(book, chapter)}${neighborNav}`;
}

// The phone bar: the selected scene's number and title beside the entry button.
export function sceneBar({ book, chapter }) {
  return `<small class="detail-cta-scene">${two(indexOf(book, chapter) + 1)} · ${esc(chapter.title)}</small>${enterButton(book, chapter)}`;
}

// The status-line text announced when a scene is chosen.
export const sceneStatus = ({ book, chapter }) => `${two(indexOf(book, chapter) + 1)} ${chapter.title} 장면을 골랐어요`;

// The whole book detail page. `chapter` is the scene the panel shows; it defaults to the saved or first scene.
export function bookDetail({ book, progress = {}, preview = false, chapter = defaultScene(book, progress) }) {
  const saved = savedChapter(book, progress);
  // A row opens with its number and names the scene only; the saved scene's flag ends its title.
  const rows = book.chapters.map((scene, index) =>
    `<li><a class="journey-row" href="${esc(detailUrl({ book: book.id, scene: scene.id, preview }))}" data-scene="${esc(scene.id)}" aria-current="${scene.id === chapter.id ? "true" : "false"}"><span class="journey-number">${two(index + 1)}</span><span class="journey-copy"><strong>${esc(scene.title)}${scene.id === saved?.id ? savedFlag : ""}</strong>${scene.subtitle ? `<small>${esc(scene.subtitle)}</small>` : ""}</span>${icon("chevron-right")}</a></li>`
  ).join("");
  return `<main class="detail-page store-content" id="main-content" data-view="book">
    <div class="detail-main">
      <section class="detail-hero" aria-labelledby="detail-title"><span class="detail-cover">${bookCover(book)}</span><div class="detail-copy"><span class="eyebrow">${esc(book.year)}</span><h1 id="detail-title" tabindex="-1">${esc(book.title)}</h1>${book.author ? `<p class="detail-meta">${esc(book.author)}</p>` : ""}</div></section>
      <section class="detail-section" id="detail-journey" aria-labelledby="detail-journey-title"><div class="section-heading"><div><h2 id="detail-journey-title">이 책의 여정</h2><p><span class="journey-hint journey-hint--wide">장면을 고르면 오른쪽에서 그 장면을 먼저 볼 수 있어요.</span><span class="journey-hint journey-hint--narrow">장면을 고르면 그 장면을 먼저 볼 수 있어요.</span></p></div></div><ol class="journey-list">${rows}</ol></section>
      ${introSection({ id: "detail-author", title: "저자 소개", text: book.authorIntro, pending: "저자 소개를 준비 중이에요.", name: book.author })}
      ${introSection({ id: "detail-book-intro", title: "책 소개", text: book.bookIntro, pending: "책 소개를 준비 중이에요." })}
    </div>
    <aside class="scene-panel" aria-labelledby="panel-scene-title">${scenePanel({ book, chapter, progress, preview })}</aside>
    <div class="detail-cta">${sceneBar({ book, chapter })}</div>
    <p class="reader-sr-only" id="scene-status" role="status"></p>
  </main>`;
}
