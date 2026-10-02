import { shelfHTML, bindShelfOrder, mountWorkspace, thumbnails } from "./workspace.js";
import { hasObject, parseRoute, resolveRoute, routeHref } from "./route.js";

import { reactionSize } from "../shared/experience.js";
import { bookCategory, editableHeroSlide, heroSlides } from "../shared/home.js";
import { heroFocus, imageSlots } from "../shared/image-slots.js";
import { iconFor } from "../client/category-icons.js";
import { World } from "../shared/world.js";
import { MOUSE, TOUCH } from "three";
import {
  api,
  esc,
  icon,
  icons,
  logo,
  modal,
  toast,
  uid,
} from "../shared/ui.js";
import "../shared/style.css";
import "./style.css";
let library,
  version,
  publishedAt,
  protectedMode = false,
  // Whether this studio saves to the store the public reader reads (Supabase), as a local studio with .env does too.
  sharedStore = false,
  tab = "books",
  bookId,
  chapterId,
  placementId,
  world,
  dirty = false,
  busy = false,
  query = "";
let disposeModelThumbnails=null;
let workspace=null, inEditor=false, baseline=null, savedLibrary=null, leaveDialog=null, undoStack=[], redoStack=[];
// Shelf filters and the editor's model search live here so redraws keep them; the address mirrors them (admin/route.js).
let shelfQuery="", shelfStatus="", assetQuery="", readerChapterId=null, shelfReturn={q:"",status:"",scroll:0}, applying=false, urlTimer=null, routeModal=null, backPending=null, scrollTimer=null;
// The window's scroll lives in the history entry: the browser's own restoring runs before the studio has loaded.
history.scrollRestoration="manual";
const app = document.querySelector("#app");
const clientUrl = import.meta.env.VITE_CLIENT_URL || "/client/";
const hasUnsavedChanges = () => savedLibrary && JSON.stringify(library) !== JSON.stringify(savedLibrary);
function requestLeaveEditor(destination=null) {
  if (leaveDialog?.open) return;
  if (busy) return toast('저장이 끝난 뒤 다시 이동해 주세요.');
  const leave = destination || (() => navigate(() => { inEditor=false; placementId=null; shelfQuery=shelfReturn.q; shelfStatus=shelfReturn.status; }, shelfReturn.scroll));
  if (!hasUnsavedChanges()) { dirty=false; leave(); return; }
  const dialog=modal(`<h2 id="leave-title">편집을 마치고 나갈까요?</h2><p id="leave-description">저장하지 않은 변경사항이 있습니다. 저장하지 않고 나가면 마지막 저장 이후의 관리자 변경사항이 사라집니다.</p><p class="leave-error" role="alert"></p><div class="leave-actions"><button type="button" class="outline-button" data-leave="cancel">계속 편집</button><button type="button" class="outline-button" data-leave="discard">저장하지 않고 나가기</button><button type="button" class="primary-button" data-leave="save">저장 후 나가기</button></div>`);
  leaveDialog=dialog;
  dialog.classList.add('leave-editor-dialog');
  dialog.setAttribute('aria-labelledby','leave-title');
  dialog.setAttribute('aria-describedby','leave-description');
  let pending=false;
  dialog.addEventListener('close',()=>{if(leaveDialog===dialog)leaveDialog=null;});
  dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
  dialog.addEventListener('click',e=>{if(pending&&e.target===dialog)e.stopImmediatePropagation();},true);
  dialog.querySelector('[data-leave="cancel"]').onclick=()=>dialog.close();
  dialog.querySelector('[data-leave="discard"]').onclick=()=>{
    library=structuredClone(savedLibrary);baseline=structuredClone(library);undoStack=[];redoStack=[];dirty=false;
    dialog.close();leave();
  };
  dialog.querySelector('[data-leave="save"]').onclick=async()=>{
    pending=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
    const saved=await save(false);
    pending=false;
    if(saved){dialog.close();leave();}
    else {dialog.querySelectorAll('button').forEach(b=>b.disabled=false);dialog.querySelector('.leave-error').textContent='저장하지 못했습니다. 편집 내용은 유지됩니다. 다시 시도하거나 계속 편집해 주세요.';}
  };
  dialog.querySelector('[data-leave="cancel"]').focus();
}
function historyMove(direction) {
  const from=direction==='undo'?undoStack:redoStack,to=direction==='undo'?redoStack:undoStack;
  if(!from.length)return;to.push(structuredClone(library));library=from.pop();baseline=structuredClone(library);dirty=true;
  if(!book()){bookId=library.books[0]?.id;chapterId=book()?.chapters[0]?.id;inEditor=false;}
  if(!chapter())chapterId=book()?.chapters[0]?.id;
  render();
}
const book = () => library.books.find((b) => b.id === bookId);
const chapter = () => book()?.chapters.find((c) => c.id === chapterId);
const placement = () => chapter()?.placements.find((p) => p.id === placementId);
const mark = () => {
  if(baseline){undoStack.push(baseline);if(undoStack.length>80)undoStack.shift();redoStack=[];}baseline=structuredClone(library);
  const undoButton=document.querySelector("#undo");if(undoButton)undoButton.disabled=false;
  dirty = true;
  const el = document.querySelector("#save-state");
  if (el) el.textContent = "저장하지 않은 변경사항";
};
const modelNames = {
  rabbit: "하얀 토끼",
  mushroom: "버섯",
  teapot: "찻주전자",
  tree: "나무",
  rose: "장미",
  key: "열쇠",
  clock: "시계",
  cards: "카드 병사",
  house: "오두막",
};
const animations = {
  hop: "폴짝 뛰기",
  spin: "빙글 돌기",
  float: "둥실 떠오르기",
  sway: "살랑 흔들기",
  clip: "파일에 담긴 애니메이션",
  none: "동작 없음",
};
const tabs = [
  ["books", "book-open", "도서 보관함"],
  ["home", "layers", "홈 화면"],
  ["models", "box", "3D 모델 보관함"],
  ["settings", "settings-2", "공개 및 안내"],
];
const themes = {
  meadow: "초록빛 숲",
  night: "달빛 정원",
  tea: "따뜻한 티 파티",
  rose: "장미 정원",
  gold: "황금빛 오후",
};
const field = (label, name, value, type = "text", extra = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (label, name, options, value) =>
  `<div class="field"><label for="field-${name}">${label}</label><select id="field-${name}" name="${name}">${Object.entries(
    options,
  )
    .map(
      ([v, l]) =>
        `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`,
    )
    .join("")}</select></div>`;
async function uploadImage(file) {
  if (file.size > 5 * 1024 * 1024) throw Error("5MB 이하의 PNG 이미지를 선택해 주세요.");
  const fd = new FormData();
  fd.append("image", file);
  return (await api("/api/floor/upload", { method: "POST", body: fd })).url;
}
// The picture once per place readers see it (shared/image-slots.js), cut as the reader cuts it: the same frame shape,
// the same kept point (a hero slide's `focus`) and the overlay laid on it there (the book `title`, the hero's scrim).
const cropFrames = (key, slots, value, { focus = "center", title = "" }) =>
  `<figure class="crop-frames" id="${key}-frames" ${value ? "" : "hidden"}><figcaption>사용자 화면에서 보이는 모습</figcaption><div class="crop-frame-list">${slots.map((slot) => `<div class="crop-frame" data-slot="${slot.id}"><span class="crop-box${slot.title ? " has-title" : ""}"${slot.scrim ? ` data-scrim="${slot.scrim}"` : ""} style="aspect-ratio:${slot.ratio}"><img alt="" draggable="false" ${value ? `src="${esc(value)}"` : ""} style="object-position:${slot.position || heroFocus[focus] || heroFocus.center}">${slot.title ? `<b>${esc(title)}</b>` : ""}</span><small>${esc(slot.label)} · ${esc(slot.ratioLabel)}</small></div>`).join("")}</div></figure>`;
// A PNG with preview and removal. The chosen address sits in the hidden input `name`,
// so forms read it with the rest of their fields; ids hang off `key` (e.g. book-cover-file).
// The hint stays while the status line under it reports uploads; `slots` adds the reader's frames (cropFrames).
const imageField = (key, label, name, value, hint, slots = [], frames = {}) =>
  `<div class="image-field"><span class="image-field-label">${label}</span><img id="${key}-preview" class="thumbnail-preview" alt="" ${value ? `src="${esc(value)}"` : "hidden"}>${slots.length ? cropFrames(key, slots, value, frames) : ""}<input type="hidden" name="${name}" value="${esc(value || "")}"><div class="image-field-actions"><label class="outline-button small">${icon("upload")} 이미지 선택<input id="${key}-file" type="file" accept="image/png,.png" aria-label="${esc(label)} 파일 선택"></label><button type="button" id="${key}-clear" class="text-button small danger" ${value ? "" : "hidden"}>이미지 지우기</button></div><p class="field-hint">${esc(hint)}</p><p id="${key}-status" class="field-status" role="status"></p></div>`;
function bindImageField(root, key, name, { busy = () => {}, change = () => {} } = {}) {
  const input = root.querySelector(`[name="${name}"]`), preview = root.querySelector(`#${key}-preview`);
  const clear = root.querySelector(`#${key}-clear`), status = root.querySelector(`#${key}-status`);
  const frames = root.querySelector(`#${key}-frames`);
  const show = (url) => {
    input.value = url; preview.hidden = !url; if (url) preview.src = url; else preview.removeAttribute("src"); clear.hidden = !url;
    if (!frames) return;
    frames.hidden = !url;
    for (const img of frames.querySelectorAll("img")) if (url) img.src = url; else img.removeAttribute("src");
  };
  root.querySelector(`#${key}-file`).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    busy(true);
    status.textContent = "이미지를 올리는 중…";
    try { const url = await uploadImage(file); show(url); status.textContent = "업로드 완료"; change(url); }
    catch (error) { status.textContent = error.message; }
    finally { busy(false); e.target.value = ""; }
  };
  clear.onclick = () => { show(""); status.textContent = "이미지를 지웠어요. 변경을 적용하면 반영됩니다."; change(""); };
}
// Keeps a dialog's action buttons off while any of its uploads runs, restoring their own disabled state after the
// last one. Fields of one dialog share the returned function.
function holdActions(dialog) {
  const buttons = [...dialog.querySelectorAll(".modal-actions button")].map((b) => [b, b.disabled]);
  let running = 0;
  return (busy) => {
    running = Math.max(0, running + (busy ? 1 : -1));
    buttons.forEach(([b, disabled]) => (b.disabled = running > 0 || disabled));
  };
}
// ---- The address (admin/route.js): the path names the page, the query what is open on it. ----
function currentRoute() {
  // The reader may show another chapter than the editor's; the selection belongs to the editor's chapter.
  const shown = readerChapterId || chapterId;
  const route = tab === "books" && inEditor && book() && chapter()
    ? { view: "editor", bookId, chapterId: shown, objectId: shown === chapterId && hasObject(chapter(), placementId) ? placementId : undefined, reader: readerChapterId ? true : undefined, q: assetQuery || undefined }
    : tab === "books" ? { view: "books", q: shelfQuery || undefined, status: shelfStatus || undefined }
    : tab === "models" ? { view: "models", q: query || undefined } : { view: tab };
  if (routeModal) Object.assign(route, { modal: routeModal.modal, modalId: routeModal.modalId });
  return route;
}
// Every history write waits for a dialog-closing history.back() to land, so it never hits the entry being left.
function writeHistory(write) {
  if (backPending) backPending.done.then(() => writeHistory(write));
  else write();
}
// Steps back over a closed dialog's own entry, then writes `href` (the page's place when the dialog closed)
// into the entry it lands on. Without a popstate within a second (a preview iframe's own entries can swallow
// the step), `href` goes into the current entry instead.
function stepBack(href) {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  backPending = { done, resolve, href, timer: setTimeout(() => settleBack(true), 1000) };
  history.back();
}
function settleBack(timedOut) {
  const pending = backPending;
  if (!pending) return;
  clearTimeout(pending.timer);
  backPending = null;
  // Release the queued writes even if the browser refuses this one.
  try { history.replaceState(timedOut ? { scroll: history.state?.scroll ?? 0 } : history.state, "", pending.href); }
  finally { pending.resolve(); }
}
// Writes the current place into this history entry's address.
function syncUrl() {
  clearTimeout(urlTimer); urlTimer = null;
  if (applying) return;
  const href = routeHref(currentRoute());
  writeHistory(() => { if (href !== location.pathname + location.search) history.replaceState(history.state, "", href); });
}
function saveScroll() {
  clearTimeout(scrollTimer); scrollTimer = null;
  if (!backPending) history.replaceState({ ...history.state, scroll: scrollY }, "");
}
function restoreScroll(top = history.state?.scroll ?? 0) { window.scrollTo({ top, behavior: "instant" }); }
// Typing writes the address once it pauses: Safari limits how often replaceState may run.
function syncUrlSoon() { clearTimeout(urlTimer); urlTimer = setTimeout(syncUrl, 250); }
// Closes every open dialog without touching history: the page they belong to is going away.
function closeDialogs() {
  routeModal = null;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
}
// A page move: the entry being left gets its latest address, then a new entry is pushed and drawn.
function navigate(change, scroll = 0) {
  if (urlTimer) syncUrl();
  saveScroll();
  change();
  closeDialogs();
  const href = routeHref(currentRoute());
  writeHistory(() => history.pushState({ scroll }, "", href));
  render();
  restoreScroll(scroll);
}
// Ties a dialog to the address. Opened from the page it pushes its own entry; opened while an address is
// being shown, that entry already exists. Closing steps back over a pushed entry, or drops the dialog from the address.
function routeDialog(dialog, modal, modalId, push = !applying) {
  const entry = { modal, modalId };
  if (push && urlTimer) syncUrl();
  if (push) saveScroll();
  routeModal = entry;
  const href = routeHref(currentRoute()), scroll = scrollY;
  if (push) writeHistory(() => { if (routeModal === entry) history.pushState({ scroll, modalEntry: true }, "", href); });
  dialog.addEventListener("close", () => {
    if (routeModal !== entry) return;
    routeModal = null;
    const page = routeHref(currentRoute());
    // Decided once earlier writes have landed, so the check reads the dialog's own entry.
    writeHistory(() => { if (history.state?.modalEntry) stepBack(page); else history.replaceState(history.state, "", page); });
  });
}
// Opens the dialog an address names.
function openRouteDialog(route) {
  const model = library.models.find((m) => m.id === route.modalId);
  if (route.modal === "new-book") editBook(true);
  else if (route.modal === "book") editBook(false, route.view === "books" ? library.books.find(b => b.id === route.modalId) : book());
  else if (route.modal === "chapter") editChapter(route.modalId);
  else if (route.modal === "new-model") editModel();
  else if (route.modal === "model") editModel(model);
  else if (route.modal === "model-preview") previewModel(model);
  else if (route.modal === "home-preview") previewHome(hasUnsavedChanges());
}
// Shows the place an address names, on load and when the browser moves to another page.
function applyRoute(route) {
  closeDialogs();
  const entering = route.view === "editor" && !(inEditor && bookId === route.bookId);
  tab = route.view === "editor" ? "books" : route.view;
  inEditor = route.view === "editor";
  if (entering) { undoStack = []; redoStack = []; baseline = structuredClone(library); }
  if (inEditor) { bookId = route.bookId; chapterId = route.chapterId; placementId = route.objectId ?? null; assetQuery = route.q ?? ""; }
  else placementId = null;
  if (route.view === "books") { shelfQuery = route.q ?? ""; shelfStatus = route.status ?? ""; }
  if (route.view === "models") query = route.q ?? "";
  readerChapterId = null;
  applying = true;
  try {
    render();
    if (route.reader) workspace?.openReader();
    if (route.modal) openRouteDialog(route);
  } finally { applying = false; }
  syncUrl();
  restoreScroll();
}
// Back or forward within one page: only the dialog differs, so the page (and the editor's 3D view) stays.
function syncDialog(route) {
  // Same dialog: still tidy the address, which may name a dialog whose target is gone.
  if (routeModal?.modal === route.modal && routeModal?.modalId === route.modalId) return syncUrl();
  closeDialogs();
  if (route.modal) {
    applying = true;
    try { openRouteDialog(route); } finally { applying = false; }
  }
  syncUrl();
}
function openAddress() {
  const { route, notice } = resolveRoute(parseRoute(location.pathname, location.search), library);
  applyRoute(route);
  if (notice) toast(notice);
}
function render() {
  draw();
  if (!urlTimer) syncUrl();
}
function draw() {
  disposeModelThumbnails?.(); disposeModelThumbnails=null;
  if(workspace){workspace.dispose();workspace=null;world=null;readerChapterId=null;}
  if(tab==='books' && inEditor && book() && chapter()) {
    world?.dispose();
    workspace=mountWorkspace(app,{book:book(),chapter:chapter(),models:library.models,selectedId:placementId,assetQuery,hooks:{
      select:id=>{placementId=id;syncUrl();},change:mark,back:()=>requestLeaveEditor(),editBook:()=>editBook(),editChapter,addChapter,search:q=>{assetQuery=q;syncUrlSoon();},reader:id=>{readerChapterId=id;syncUrl();},
      reorderChapters:ids=>{const chapters=book().chapters;if(ids.length!==chapters.length||new Set(ids).size!==chapters.length||ids.some(id=>!chapters.some(c=>c.id===id)))return;book().chapters=ids.map(id=>chapters.find(c=>c.id===id));mark();render();},
      preview:()=>previewClient(),
      addModel:()=>editModel(),editModel,save:()=>save(false),publish:()=>save(true),
      chapter:id=>{chapterId=id;placementId=null;syncUrl();},undo:()=>historyMove('undo'),redo:()=>historyMove('redo'),canUndo:undoStack.length,canRedo:redoStack.length
    }});world=workspace.world;document.querySelector('#save-state').textContent=dirty?'저장하지 않은 변경사항':'변경사항 저장됨';return;
  }
  world?.dispose();
  world = null;
  app.innerHTML = `<div class="studio-shell"><aside class="studio-sidebar"><a class="brand" href="/admin/">${logo}</a><span class="studio-label">STORYTELLING STUDIO</span><div class="workspace-label">WORKSPACE</div><nav class="studio-nav">${tabs
    .map(
      ([id, ic, label]) =>
        `<button data-tab="${id}" class="${tab === id ? "active" : ""}">${icon(ic)}${label}${tab === id ? '<span class="active-dot"></span>' : ""}</button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-note">${icon("sparkles")}<p>한 장면의 작은 움직임이<br>이야기에 생명을 불어넣어요.</p></div><a class="visit-client" href="${esc(clientUrl)}" target="_blank">사용자 화면 열기 ${icon("arrow-up-right")}</a><div class="studio-user"><span>O</span><div><strong>On the Book</strong><small>${protectedMode ? "관리자 로그인됨" : "내 컴퓨터 작업 공간"}</small></div>${protectedMode ? `<button id="logout" class="icon-button" aria-label="로그아웃">${icon("log-out")}</button>` : ""}</div></aside><div class="studio-main"><header class="studio-header"><div><span>워크스페이스</span>${icon("chevron-right")}<strong>${tabs.find(([id]) => id === tab)[2]}</strong></div><div><span id="save-state">${dirty ? "저장하지 않은 변경사항" : "변경사항 저장됨"}</span><button id="save" class="outline-button" ${busy ? "disabled" : ""}>${icon("save")} 임시 저장</button><button id="publish" class="primary-button" ${busy ? "disabled" : ""}>${icon("eye")} 사용자 화면에 공개</button></div></header><main class="studio-content">${tab === "books" ? shelfHTML(library.books) : tab === "home" ? homeView() : tab === "models" ? modelsView() : settingsView()}</main></div></div>`;
  icons();
  for (const b of document.querySelectorAll("[data-tab]"))
    b.onclick = () => { if (b.dataset.tab !== tab) navigate(() => { tab = b.dataset.tab; }); };
  // The logo moves within the studio like the 도서 보관함 tab; modified clicks keep the browser's own handling.
  document.querySelector(".studio-sidebar .brand").onclick = (e) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (tab !== "books") navigate(() => { tab = "books"; });
  };
  document.querySelector("#save").onclick = () => save(false);
  document.querySelector("#publish").onclick = () => save(true);
  document.querySelector("#logout")?.addEventListener("click", () => requestLeaveEditor(async () => {
    try { await api("/api/logout", { method: "POST", body: "{}" }); location.reload(); }
    catch(error){toast(error.message);render();}
  }));
  if (tab === "books") {
    document.querySelector('#new-book').onclick=()=>editBook(true);
    document.querySelectorAll('[data-edit-book]').forEach(button=>button.onclick=()=>editBook(false,library.books.find(b=>b.id===button.dataset.editBook)));
    document.querySelectorAll('[data-delete-book]').forEach(button=>button.onclick=()=>deleteBook(library.books.find(b=>b.id===button.dataset.deleteBook)));
    // The editor's undo covers only what happens inside it, not home or shelf changes made before.
    document.querySelectorAll('[data-open-book]').forEach(button=>button.onclick=()=>{shelfReturn={q:shelfQuery,status:shelfStatus,scroll:scrollY};navigate(()=>{bookId=button.dataset.openBook;chapterId=book().chapters[0]?.id;placementId=null;assetQuery="";inEditor=true;undoStack=[];redoStack=[];baseline=structuredClone(library);});});
    const filter=()=>{
      const query=shelfQuery.trim().toLowerCase(),state=shelfStatus||'all',filtered=!!query||state!=='all';let count=0;
      document.querySelectorAll('[data-book-row]').forEach((row,index)=>{
        row.hidden=!row.dataset.search.includes(query)||(state!=='all'&&row.dataset.state!==state);if(!row.hidden)count++;
        const handle=row.querySelector('[data-book-drag]');handle.disabled=filtered;handle.draggable=!filtered;
        row.querySelector('[data-book-up]').disabled=filtered||index===0;
        row.querySelector('[data-book-down]').disabled=filtered||index===library.books.length-1;
      });
      document.querySelector('#shelf-empty').hidden=count>0;
      document.querySelector('.shelf-columns').hidden=count===0;
      document.querySelector('.book-shelf').classList.toggle('is-filtered',filtered);
      document.querySelector('#reset-book-filter').hidden=!shelfQuery&&!shelfStatus;
      document.querySelector('#shelf-count').textContent=filtered?`${library.books.length}권 중 ${count}권 표시`:`총 ${count}권`;
      document.querySelector('#shelf-hint').textContent=filtered?'검색·필터 중에는 순서를 바꿀 수 없어요. ‘조건 초기화’를 눌러 전체 도서에서 변경하세요.':'위·아래 버튼이나 손잡이 드래그로 순서를 바꾸세요. 공개 대상 도서만 이 순서대로 노출됩니다.';
    };
    const search=document.querySelector('#book-search'),status=document.querySelector('#book-filter');search.value=shelfQuery;status.value=shelfStatus||'all';
    search.oninput=()=>{shelfQuery=search.value;filter();syncUrlSoon();};status.onchange=()=>{shelfStatus=status.value==='all'?'':status.value;filter();syncUrl();};filter();
    const reset=()=>{shelfQuery='';shelfStatus='';search.value='';status.value='all';filter();syncUrl();search.focus();};
    document.querySelector('#reset-book-filter').onclick=reset;
    document.querySelector('#shelf-empty-action').onclick=()=>library.books.length?reset():editBook(true);
    bindShelfOrder(app,(ids,moved,control)=>{
      if(shelfQuery.trim()||shelfStatus||ids.length!==library.books.length||new Set(ids).size!==ids.length||ids.some(id=>!library.books.some(b=>b.id===id)))return;
      library.books=ids.map(id=>library.books.find(b=>b.id===id));mark();render();
      const row=document.querySelector(`[data-book-row="${CSS.escape(moved)}"]`);
      const focus=row.querySelector(`[data-book-${control}]:not(:disabled)`)||row.querySelector('[data-book-up]:not(:disabled),[data-book-down]:not(:disabled)')||row.querySelector('[data-book-drag]');
      focus?.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});
      toast(`${library.books.find(b=>b.id===moved).title}을(를) ${ids.indexOf(moved)+1}번째로 옮겼어요. 임시 저장 또는 공개로 반영해 주세요.`);
    });
  }
  if (tab === "home") bindHome();
  if (tab === "models") bindModels();
  if (tab === "settings") {
    document.querySelector("#export").onclick = exportData;
  }
}
function booksView() {
  const b = book(),
    c = chapter();
  return `<div class="page-title"><div><span class="eyebrow">BUILD A WORLD, ONE CHAPTER AT A TIME</span><h1>책 속의 세계를 만들어 보세요.</h1><p>이야기를 나누고, 장면을 꾸미고, 작은 움직임을 더해요.</p></div><button id="new-book" class="outline-button">${icon("plus")} 새 책 만들기</button></div><div class="studio-stats"><div><span>함께하는 이야기</span><strong>${library.books.length}<small>권의 책</small></strong></div><div><span>펼쳐진 장면</span><strong>${library.books.reduce((s, b) => s + b.chapters.length, 0)}<small>개의 챕터</small></strong></div><div><span>작은 세계의 주인공</span><strong>${library.models.length}<small>개의 3D 모델</small></strong></div><div class="status-stat"><span class="live-dot"></span><p>마지막 공개<small>${new Date(publishedAt).toLocaleString("ko-KR")}</small></p></div></div><section class="editor-panel"><div class="editor-book-bar"><div>${icon("book-open")}<select id="book-select" aria-label="편집할 책">${library.books.map((b) => `<option value="${b.id}" ${b.id === bookId ? "selected" : ""}>${esc(b.title)}</option>`).join("")}</select>${b ? `<span class="badge ${b.published ? "" : "draft"}">${b.published ? "공개 대상" : "비공개"}</span>` : ""}</div><div>${b ? `<button id="edit-book" class="text-button">책 정보 편집 ${icon("settings-2")}</button><button id="add-chapter" class="text-button">${icon("plus")} 챕터 추가</button>` : ""}</div></div>${b && c ? `<div class="chapter-tabs">${b.chapters.map((c, i) => `<button data-chapter="${c.id}" class="${c.id === chapterId ? "active" : ""}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(c.title)}</button>`).join("")}</div><div class="scene-editor"><div class="preview-column"><div class="preview-toolbar"><span><i class="live-dot"></i> 장면 미리보기</span><div><button id="preview-client" class="text-button small">독자 화면으로 체험</button><button id="edit-story" class="text-button small">${icon("book-open")} 챕터와 본문</button><button id="scene-reset" class="icon-button" aria-label="시점 초기화">${icon("rotate-ccw")}</button></div></div><div id="studio-world" class="studio-world"></div><div class="preview-bottom"><span>${icon("move")} 드래그로 회전 · 휠로 확대</span><span>금색: 실제 반응 범위 · 붉은색: 충돌 범위</span></div><div class="placement-bar"><h3>장면에 배치된 모델 <span>${c.placements.length}</span></h3><button id="add-placement" class="text-button small">${icon("plus")} 모델 배치</button></div><div class="placement-list">${c.placements.length ? c.placements.map((p) => `<button data-placement="${p.id}" class="${p.id === placementId ? "selected" : ""}"><span class="object-chip">${icon("box")}</span><span><strong>${esc(p.title)}</strong><small>${esc(library.models.find((m) => m.id === p.modelId)?.name)} · ${animations[p.animation]}</small></span>${icon(p.id === placementId ? "check" : "chevron-right")}</button>`).join("") : '<p class="inline-empty">모델 배치를 눌러 첫 번째 주인공을 초대해 보세요.</p>'}</div></div><aside class="inspector">${inspectorView()}</aside></div>` : `<div class="empty-state"><h3>첫 이야기를 만들어 보세요.</h3><p>새 책 만들기로 시작할 수 있어요.</p></div>`}</section>`;
}
function inspectorView() {
  const p = placement();
  if (!p)
    return `<div class="empty-state">${icon("box")}<h3>모델을 선택해 주세요.</h3><p>위치와 움직임을 조정할 수 있어요.</p></div>`;
  return `<div class="inspector-title"><div><span class="eyebrow">OBJECT SETTINGS</span><h2>모델 설정</h2></div><button id="remove-placement" class="icon-button danger" aria-label="장면에서 모델 제거">${icon("trash-2")}</button></div><form id="placement-form">${field("장면 속 이름", "title", p.title)}<div class="field-section">${icon("move")} 위치와 크기</div><div class="field-row">${field("가로 위치", "x", p.x, "number", `min="${-(chapter().width || 64) / 2 + 1}" max="${(chapter().width || 64) / 2 - 1}" step="0.1"`)}${field("세로 위치", "z", p.z, "number", `min="${-(chapter().depth || 56) / 2 + 1}" max="${(chapter().depth || 56) / 2 - 1}" step="0.1"`)}</div><button id="place-on-ground" type="button" class="subtle-button">${icon("move")} 땅을 눌러 위치 정하기</button><div class="field-row">${field("크기 배율", "scale", p.scale, "number", 'min="0.1" max="8" step="0.1"')}${field("회전 각도", "rotation", p.rotation, "number", 'min="-360" max="360" step="5"')}</div><div class="field-section">캐릭터와 충돌</div><label class="checkbox-field"><input name="collision" type="checkbox" ${p.collision !== false ? "checked" : ""}> 캐릭터 통과 막기</label>${field("충돌 반경", "collisionRadius", p.collisionRadius ?? .8, "number", 'min="0.1" max="20" step="0.1"')}<p class="field-hint">모델 중심의 원형 영역입니다. 크기 배율을 함께 반영하며, 애니메이션 중에도 고정됩니다. 반응 범위는 충돌 영역 밖에서도 접근할 수 있도록 확보됩니다.</p><div class="field-section">${icon("sparkles")} 가까이 왔을 때</div>${select("재생할 동작", "animation", animations, p.animation)}${field("파일 속 동작 이름 (비우면 첫 동작)", "clip", p.clip)}<label class="field">반응 거리 · 실제 적용 <span class="range-value" id="radius-value">${reactionSize(p, chapter()).toFixed(1)} m</span><input type="range" name="radius" min="0.5" max="20" step="0.1" value="${p.radius}"></label><p class="field-hint">챕터의 접근 배율과 충돌 여유를 반영한 실제 범위를 표시합니다. 범위 안에서 애니메이션과 글이 나타나고, 벗어나면 원래 상태로 돌아갑니다. 다시 접근하면 처음부터 재생됩니다.</p><button id="preview-animation" type="button" class="outline-button full">${icon("eye")} 동작 미리보기</button><button id="preview-floor" type="button" class="outline-button full">${icon("book-open")} 글·카메라·충돌 함께 체험</button></form>`;
}
let positioning = false;
function makePreview() {
  world?.dispose();
  if (!chapter()) return;
  try {
    world = new World(document.querySelector("#studio-world"), {
      chapter: chapter(),
      models: library.models,
      editor: true,
      onError: toast,
      onSelect: (id) => {
        if (!id) return;
        placementId = id;
        render();
      },
      onMove: (point) => {
        if (!positioning || !placement()) return;
        Object.assign(placement(), point);
        mark();
        positioning = false;
        render();
        toast("모델의 위치를 변경했어요.");
      },
    });
  } catch (e) {
    document.querySelector("#studio-world").innerHTML =
      `<div class="empty-state"><p>${esc(e.message)}</p></div>`;
  }
}
function bindBooks() {
  document.querySelector("#new-book").onclick = () => editBook(true);
  document.querySelector("#book-select").onchange = (e) => {
    bookId = e.target.value;
    chapterId = book()?.chapters[0]?.id;
    placementId = chapter()?.placements[0]?.id;
    render();
  };
  document
    .querySelector("#edit-book")
    ?.addEventListener("click", () => editBook());
  document.querySelector("#add-chapter")?.addEventListener("click", addChapter);
  for (const button of document.querySelectorAll("[data-chapter]"))
    button.onclick = () => {
      chapterId = button.dataset.chapter;
      placementId = chapter()?.placements[0]?.id;
      render();
    };
  if (!chapter()) return;
  makePreview();
  document.querySelector("#scene-reset").onclick = makePreview;
  document.querySelector("#edit-story").onclick = editChapter;
  document.querySelector("#add-placement").onclick = addPlacement;
  for (const b of document.querySelectorAll("[data-placement]"))
    b.onclick = () => {
      placementId = b.dataset.placement;
      render();
    };
  document.querySelector("#preview-client")?.addEventListener("click", () => previewClient());
  const f = document.querySelector("#placement-form");
  if (!f) return;
  f.onsubmit = (e) => e.preventDefault();
  f.oninput = (e) => {
    const input = e.target,
      p = placement();
    if (!input.name || !p) return;
    if (input.type === "number" && !input.validity.valid) return;
    const value =
      input.type === "checkbox"
        ? input.checked
        : ["number", "range"].includes(input.type)
          ? Number(input.value)
          : input.value;
    p[input.name] = value;
    mark();
    world?.updatePlacement(p);
    if (["radius", "collision", "collisionRadius", "scale"].includes(input.name))
      document.querySelector("#radius-value").textContent = reactionSize(p, chapter()).toFixed(1) + " m";
  };
  document.querySelector("#preview-floor").onclick = () => previewClient(placementId);
  document.querySelector("#preview-animation").onclick = () => {
    world?.preview(placementId);
    toast(
      placement().animation === "clip"
        ? "파일에 포함된 동작을 재생합니다. 동작이 없는 파일은 움직이지 않아요."
        : "선택한 동작을 미리 재생합니다.",
    );
  };
  document.querySelector("#place-on-ground").onclick = () => {
    positioning = true;
    toast("미리보기에서 원하는 땅을 눌러 주세요.");
  };
  document.querySelector("#remove-placement").onclick = () =>
    confirmAction(
      "이 모델을 장면에서 제거할까요?",
      "모델 보관함의 원본은 유지돼요.",
      () => {
        chapter().placements = chapter().placements.filter(
          (p) => p.id !== placementId,
        );
        placementId = chapter().placements[0]?.id;
        mark();
        render();
      },
    );
}
function editBook(isNew = false, target = book()) {
  const original = isNew
    ? {
        id: uid(),
        title: "새로운 이야기",
        englishTitle: "A New Story",
        author: "",
        year: 1865,
        description: "",
        authorIntro: "",
        bookIntro: "",
        source: "https://www.gutenberg.org/",
        rights: "",
        published: false,
        chapters: [newChapter()],
      }
    : target;
  const categories = [...new Set(["판타지", "모험", "문학", ...library.books.map(bookCategory)])];
  const d = modal(
    `<h2>${isNew ? "새 책 만들기" : "책 정보"}</h2><form id="book-form">${imageField("book-cover", "표지 이미지 (PNG)", "cover", original.cover, "책장, 작품 상세와 3D 화면의 작품 소개 창에 세로 2:2.85(예: 800×1140)로 보여요. 비율이 다르면 가운데를 기준으로 잘립니다. 없으면 빈 표지로 둡니다.", imageSlots.cover)}${imageField("book-thumbnail", "도서 메인 썸네일 (PNG)", "thumbnail", original.thumbnail, "홈 ‘한 장면부터 시작하는 여행’의 큰 칸에 정사각형(예: 1200×1200)으로 보이고, 휴대폰에서는 가운데를 기준으로 가로 16:9로 잘려요. 아래쪽에 책 제목이 흰 글씨로 얹히니 글자 없는 그림을 권장해요. 없으면 기본 배경에 책 제목만 보여요.", imageSlots.bookThumbnail, { title: original.title })}${field("책 제목", "title", original.title, "text", 'required maxlength="200"')}${field("영문 제목", "englishTitle", original.englishTitle, "text", 'required maxlength="200"')}<div class="field-row">${field("작가", "author", original.author, "text", 'maxlength="200"')}${field("원작 출간 연도", "year", original.year, "number", 'required min="1" max="2026"')}</div>${field("분류", "category", bookCategory(original), "text", 'required maxlength="8" list="book-categories" pattern="^(?!(all|reading)$).*" title="8자 이하로 입력해 주세요. all·reading은 쓸 수 없습니다."')}<datalist id="book-categories">${categories.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist><div class="category-icon"><img id="book-category-icon" src="${esc(iconFor(bookCategory(original)))}" alt="" draggable="false"><p class="field-hint">사용자 화면의 빠른 메뉴와 분류 필터에 쓰입니다. 같은 이름을 쓰면 한 분류로 묶여요. 왼쪽 그림이 빠른 메뉴와 사진 없는 추천 슬라이드에 보이는데, ‘판타지’·‘모험’만 전용 그림이 있고 다른 분류는 책 그림이에요.</p></div><label class="field">소개 문장<textarea name="description" rows="2" maxlength="1000">${esc(original.description)}</textarea></label><label class="field">저자 소개<textarea name="authorIntro" rows="5" maxlength="5000">${esc(original.authorIntro)}</textarea></label><label class="field">책 소개<textarea name="bookIntro" rows="6" maxlength="5000">${esc(original.bookIntro)}</textarea></label><p class="field-hint">소개 문장은 홈 추천 배너의 기본 설명과 3D 화면의 작품 소개 창에 쓰는 짧은 글이고, 저자 소개와 책 소개는 작품 상세의 ‘이 책의 여정’ 아래에 차례로 보여요. 빈 줄로 문단을 나누고, 비워 두면 ‘준비 중’ 문구가 보여요.</p>${field("원작 출처 주소", "source", original.source, "url", 'required pattern="https?://.*"')}<label class="field">권리 및 번역·각색 정보<textarea name="rights" rows="3" maxlength="1000">${esc(original.rights)}</textarea></label><label class="checkbox-field"><input type="checkbox" name="published" ${original.published ? "checked" : ""}> 사용자 화면 공개 대상에 포함</label><div class="modal-actions">${!isNew ? '<button id="delete-book" type="button" class="text-button danger">책 삭제</button>' : ""}<button class="primary-button" type="submit">${isNew ? "책 만들기" : "변경 적용"}</button></div></form>`,
  );
  routeDialog(d, isNew ? "new-book" : "book", !isNew && !inEditor ? original.id : undefined);
  const hold = holdActions(d);
  bindImageField(d, "book-cover", "cover", { busy: hold });
  bindImageField(d, "book-thumbnail", "thumbnail", { busy: hold });
  // The main thumbnail's frames and the category icon follow the form as it is typed, like the reader will show them.
  const titleInput = d.querySelector('[name="title"]'), categoryInput = d.querySelector('[name="category"]');
  titleInput.addEventListener("input", () => d.querySelectorAll("#book-thumbnail-frames b").forEach((b) => { b.textContent = titleInput.value; }));
  categoryInput.addEventListener("input", () => { d.querySelector("#book-category-icon").src = iconFor(categoryInput.value.trim()); });
  d.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    Object.assign(original, Object.fromEntries(f), {
      year: +f.get("year"),
      published: f.has("published"),
      category: String(f.get("category")).trim(),
    });
    if (isNew) { library.books.push(original); shelfQuery = ""; shelfStatus = ""; }
    bookId = original.id;
    chapterId = original.chapters[0].id;
    placementId = original.chapters[0].placements[0]?.id;
    mark();
    d.close();
    render();
    if (!inEditor) document.querySelector(`[data-edit-book="${CSS.escape(original.id)}"]`)?.focus({ preventScroll: !isNew });
  };
  d.querySelector("#delete-book")?.addEventListener("click", () => {
    d.close();
    deleteBook(original);
  });
}
function deleteBook(target) {
  const index=library.books.indexOf(target);
  confirmAction(
    `‘${target.title}’ 도서를 삭제할까요?`,
    `도서 정보와 챕터 ${target.chapters.length}개, 챕터 안의 장면·본문이 함께 삭제됩니다. 모델 원본은 보관함에 남습니다. 사용자 화면에는 다시 공개한 후 반영됩니다.`,
    () => {
      library.books=library.books.filter(b=>b.id!==target.id);
      library.home.hero=library.home.hero.filter(s=>s.bookId!==target.id);
      if(bookId===target.id){bookId=library.books[0]?.id;chapterId=book()?.chapters[0]?.id;placementId=chapter()?.placements[0]?.id;inEditor=false;}
      mark();render();
      const next=library.books[Math.min(index,library.books.length-1)];
      if(!inEditor){
        const visibleNext=next&&document.querySelector(`[data-book-row="${CSS.escape(next.id)}"]:not([hidden]) [data-edit-book]`);
        const focus=visibleNext||document.querySelector('[data-book-row]:not([hidden]) [data-edit-book]')||document.querySelector(library.books.length?'#book-search':'#new-book');
        focus?.focus({preventScroll:true});
      }
      toast(`‘${target.title}’ 도서를 삭제했어요. 임시 저장 또는 공개로 반영해 주세요.`);
    },
  );
}
function newChapter() {
  return {
    id: uid(),
    title: "새로운 챕터",
    subtitle: "이곳에서 새로운 이야기가 시작됩니다.",
    body: "",
    theme: "meadow",
    width: 64, depth: 56, floorArrows: false, floorRoute: [], floorDecals: [],
    placements: [],
  };
}
function addChapter() {
  const c = newChapter();
  book().chapters.push(c);
  chapterId = c.id;
  placementId = undefined;
  mark();
  render();
  editChapter();
}
function editChapter(id) {
  const c = book().chapters.find(c=>c.id===id) || chapter(),
    index = book().chapters.indexOf(c);
  const d = modal(
    `<span class="eyebrow">CHAPTER ${index + 1}</span><h2>장면과 이야기</h2><form id="chapter-form">${field("챕터 제목", "title", c.title, "text", 'required maxlength="200"')}${field("짧은 소개", "subtitle", c.subtitle, "text", 'maxlength="250"')}${imageField("chapter-thumbnail", "장면 썸네일 (PNG)", "thumbnail", c.thumbnail, "작품 상세의 장면 패널에는 16:10(예: 1280×800)이 그대로 보이고, 홈 장면 카드에는 가운데 정사각형만 보여요. 중요한 부분은 가운데에 두세요. 없으면 빈 자리로 둡니다.", imageSlots.chapterThumbnail)}${select("장면 분위기", "theme", themes, c.theme)}${field("공간 가로 크기", "width", c.width || 64, "number", 'min="40" max="120" required')}${field("공간 세로 크기", "depth", c.depth || 56, "number", 'min="40" max="100" required')}<p class="field-hint">이 공간이 챕터 순서대로 연결됩니다. 모델은 공간 안 어디든 배치할 수 있고, 이동 조건은 없습니다.</p><a href="${esc(clientUrl)}?book=${book().id}&chapter=${c.id}" target="_blank" rel="noopener">공개된 탐험 화면 보기 ↗</a><div class="field-section">바닥 안내와 독서 화면</div><p class="field-hint">바닥 이미지는 왼쪽 목록에서 월드에 배치하고, 선택해 위치와 방향을 수정합니다.</p><label class="checkbox-field"><input type="checkbox" name="floorEnabled" ${c.floorEnabled !== false ? "checked" : ""}> 모델 접근 시 글 섹션과 카메라 연출</label><label class="field">오른쪽에 보여 줄 글귀<textarea name="floorText" rows="4" maxlength="15000" placeholder="비우면 아래 이야기 본문 전체를 사용합니다.">${esc(c.floorText || "")}</textarea></label>${field("글귀 카메라 여백 배율", "floorZoom", c.floorZoom ?? 1.1, "number", 'min="1" max="1.8" step="0.1"')}${field("애니메이션·글 노출 접근 배율", "reactionMultiplier", c.reactionMultiplier ?? 2, "number", 'min="1" max="4" step="0.1"')}${field("페이지당 최대 글자 수", "floorPageSize", c.floorPageSize ?? 112, "number", 'min="40" max="400" step="1"')}<label class="checkbox-field"><input name="floorStagger" type="checkbox" ${c.floorStagger !== false ? "checked" : ""}> 챕터명과 본문 순차 등장</label><p class="field-hint">글귀는 화면 오른쪽의 반투명 창에, 캐릭터와 모델은 왼쪽에 표시됩니다. 긴 글은 여러 장으로 나뉩니다. 여백 배율이 클수록 카메라가 멀어지며, 화면 크기에 맞춰 글귀가 보이도록 조절됩니다.</p><label class="field">이야기 본문<textarea name="body" rows="9" maxlength="15000">${esc(c.body)}</textarea></label><div class="modal-actions"><button type="button" id="chapter-up" class="outline-button" ${index === 0 ? "disabled" : ""}>앞으로 옮기기</button><button type="button" id="chapter-down" class="outline-button" ${index === book().chapters.length - 1 ? "disabled" : ""}>뒤로 옮기기</button><button type="button" id="delete-chapter" class="text-button danger" ${book().chapters.length === 1 ? "disabled" : ""}>삭제</button><button class="primary-button">변경 적용</button></div></form>`,
  );
  routeDialog(d, "chapter", c.id);
  const apply = () => {
    const values = Object.fromEntries(new FormData(d.querySelector("form")));
    values.width = Number(values.width); values.depth = Number(values.depth);
    for (const key of ["floorZoom", "reactionMultiplier", "floorPageSize"]) values[key] = Number(values[key]);
    values.floorStagger = values.floorStagger === "on";
    values.floorEnabled = values.floorEnabled === "on";
    if ([...c.placements, ...(c.floorRoute || []), ...(c.floorDecals || [])].some(p => Math.abs(p.x) > values.width / 2 - 1 || Math.abs(p.z) > values.depth / 2 - 1)) { toast("모델이 새 공간 밖에 있습니다. 모델을 안쪽으로 옮긴 후 공간을 줄여 주세요."); return false; }
    Object.assign(c, values);
    mark();
    return true;
  };
  // Moving the chapter also applies the form, so those buttons wait for the upload too.
  bindImageField(d, "chapter-thumbnail", "thumbnail", { busy: holdActions(d) });
  d.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    if (!apply()) return;
    d.close();
    render();
  };
  for (const [id, offset] of [
    ["chapter-up", -1],
    ["chapter-down", 1],
  ])
    d.querySelector("#" + id).onclick = () => {
      if (!d.querySelector("form").reportValidity()) return;
      if (!apply()) return;
      const cs = book().chapters;
      [cs[index], cs[index + offset]] = [cs[index + offset], cs[index]];
      d.close();
      render();
    };
  d.querySelector("#delete-chapter").onclick = () => {
    d.close();
    confirmAction(
      "이 챕터를 삭제할까요?",
      "장면의 배치와 본문도 함께 제거됩니다. 모델 원본은 보관함에 남아요.",
      () => {
        book().chapters = book().chapters.filter((x) => x.id !== c.id);
        chapterId = book().chapters[0].id;
        placementId = chapter().placements[0]?.id;
        mark();
        render();
      },
    );
  };
}
function addPlacement() {
  const d = modal(
    `<span class="eyebrow">ADD A LITTLE WONDER</span><h2>장면에 모델 배치하기</h2><div class="chapter-list">${library.models.map((m) => `<button data-add-model="${m.id}">${icon("box")}<span><strong>${esc(m.name)}</strong><small>${m.kind === "glb" ? "업로드한 3D 모델" : "기본 3D 모델"}</small></span>${icon("plus")}</button>`).join("") || "<p>모델 보관함에서 먼저 모델을 등록해 주세요.</p>"}</div>`,
  );
  for (const b of d.querySelectorAll("[data-add-model]"))
    b.onclick = () => {
      const m = library.models.find((m) => m.id === b.dataset.addModel);
      const p = {
        id: uid(),
        modelId: m.id,
        x: 0,
        z: 2,
        scale: 1,
        rotation: 0,
        radius: 2,
        animation: m.kind !== "glb" ? "hop" : m.clips?.length ? "clip" : "none",
        clip: m.clips?.[0] || "",
        title: m.name,
        story: "이 물체 가까이에서 만나게 될 이야기를 적어 주세요.",
      };
      chapter().placements.push(p);
      placementId = p.id;
      mark();
      d.close();
      render();
    };
}
function modelsView() {
  const models = library.models.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  );
  return `<div class="page-title"><div><span class="eyebrow">THE LITTLE CAST OF YOUR STORIES</span><h1>3D 모델 보관함</h1><p>이야기의 주인공과 소품을 모아 두는 공간이에요.</p></div><button id="new-model" class="primary-button">${icon("plus")} 모델 등록</button></div><div class="model-toolbar"><label class="search-field">${icon("search")}<input id="model-search" placeholder="모델 이름으로 검색" value="${esc(query)}" aria-label="모델 이름으로 검색"></label><span>${models.length}개의 모델 · GLB 파일 지원</span></div><div class="model-grid">${
    models
      .map((m) => {
        const used = library.books
          .flatMap((b) => b.chapters.flatMap((c) => c.placements))
          .filter((p) => p.modelId === m.id).length;
        return `<article class="model-card"><div class="model-art kind-${m.kind}" style="--model-color:${esc(m.color)}"><div class="model-thumbnail" data-thumb="${m.id}"></div><span>${m.kind === "glb" ? "GLB" : "BUILT-IN"}</span></div><div class="model-card-body"><h2>${esc(m.name)}</h2><p>${used}개 장면 배치 · ${m.kind === "glb" ? "업로드한 모델" : "직접 제작한 기본 모델"}</p><div><button data-preview-model="${m.id}" class="text-button small">${icon("eye")} 미리보기</button><button data-edit-model="${m.id}" class="icon-button" aria-label="${esc(m.name)} 편집">${icon("settings-2")}</button></div></div></article>`;
      })
      .join("") ||
    '<div class="empty-state"><h3>일치하는 모델이 없어요.</h3><p>다른 이름을 검색하거나 새 모델을 등록해 주세요.</p></div>'
  }</div>`;
}
function bindModels() {
  try { disposeModelThumbnails=thumbnails(app,library.models,{width:640,height:360,animate:false}); }
  catch { app.querySelectorAll('[data-thumb]').forEach(target=>{target.textContent='미리보기를 불러올 수 없어요.';}); }
  document.querySelector("#new-model").onclick = () => editModel();
  const search = document.querySelector("#model-search");
  search.oninput = (e) => {
    query = e.target.value;
    const pos = e.target.selectionStart;
    syncUrlSoon();
    render();
    const input = document.querySelector("#model-search");
    input.focus();
    input.setSelectionRange(pos, pos);
  };
  for (const b of document.querySelectorAll("[data-edit-model]"))
    b.onclick = () =>
      editModel(library.models.find((m) => m.id === b.dataset.editModel));
  for (const b of document.querySelectorAll("[data-preview-model]"))
    b.onclick = () =>
      previewModel(library.models.find((m) => m.id === b.dataset.previewModel));
}
function previewModel(m) {
  const d = modal(
    `<header class="model-preview-header"><h2 id="model-preview-title">${esc(m.name)}</h2><div class="model-preview-tools" role="group" aria-label="모델 보기 조작"><button class="text-button small" data-preview-mode="rotate" aria-pressed="true" title="드래그로 회전 · 두 손가락으로 확대 및 이동" disabled>${icon("rotate-3d")} 회전</button><button class="text-button small" data-preview-mode="pan" aria-pressed="false" title="드래그로 화면 이동 · 오른쪽 버튼 드래그로도 이동" disabled>${icon("move")} 이동</button><button class="icon-button" data-preview-zoom="in" aria-label="확대" title="확대 · 마우스 휠로도 조절" disabled>${icon("plus")}</button><button class="icon-button" data-preview-zoom="out" aria-label="축소" title="축소" disabled>${icon("minus")}</button><button class="icon-button" data-preview-reset aria-label="전체 모델 보기" title="전체 모델 보기" disabled>${icon("maximize")}</button></div></header><div id="single-preview" class="single-preview" aria-busy="true"><div class="model-preview-status" role="status"><span class="model-preview-spinner" aria-hidden="true"></span><p>모델을 불러오는 중이에요…</p><button class="outline-button" data-preview-retry hidden>다시 시도</button></div></div>`,
  );
  d.classList.add("model-preview-dialog");
  d.setAttribute("aria-labelledby", "model-preview-title");
  routeDialog(d, "model-preview", m.id);
  const p = {
    id: "preview",
    modelId: m.id,
    x: 0,
    z: 0,
    scale: 2,
    rotation: 0,
    radius: 2,
    animation: m.kind === "glb" && m.clips?.length ? "clip" : "none",
    clip: m.clips?.[0] || "",
    title: m.name,
    story: "",
  };
  let preview;
  const container = d.querySelector("#single-preview");
  const status = d.querySelector(".model-preview-status");
  const retry = d.querySelector("[data-preview-retry]");
  const buttons = d.querySelectorAll(".model-preview-tools button");
  const setMode = (mode) => {
    preview.controls.mouseButtons.LEFT = mode === "pan" ? MOUSE.PAN : MOUSE.ROTATE;
    preview.controls.touches.ONE = mode === "pan" ? TOUCH.PAN : TOUCH.ROTATE;
    container.dataset.mode = mode;
    d.querySelectorAll("[data-preview-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.previewMode === mode));
    });
  };
  const showError = (message) => {
    if (!d.open) return;
    container.setAttribute("aria-busy", "false");
    container.dataset.state = "error";
    status.hidden = false;
    status.setAttribute("role", "alert");
    status.querySelector("p").textContent = message;
    retry.hidden = false;
    buttons.forEach((button) => (button.disabled = true));
  };
  const load = () => {
    preview?.dispose();
    preview = null;
    container.setAttribute("aria-busy", "true");
    container.dataset.state = "loading";
    status.hidden = false;
    status.setAttribute("role", "status");
    status.querySelector("p").textContent = "모델을 불러오는 중이에요…";
    retry.hidden = true;
    buttons.forEach((button) => (button.disabled = true));
    try {
      preview = new World(container, {
        chapter: { theme: "meadow", placements: [p] },
        models: [m],
        editor: true,
        modelOnly: true,
        onReady: () => {
          container.setAttribute("aria-busy", "false");
          container.dataset.state = "ready";
          status.hidden = true;
          buttons.forEach((button) => (button.disabled = false));
        },
        onError: showError,
      });
      setMode("rotate");
      preview.preview("preview");
    } catch (e) {
      showError(e.message);
    }
  };
  d.querySelectorAll("[data-preview-mode]").forEach((button) => {
    button.onclick = () => setMode(button.dataset.previewMode);
  });
  d.querySelectorAll("[data-preview-zoom]").forEach((button) => {
    button.onclick = () => {
      const { camera, controls } = preview;
      const distance = camera.position.distanceTo(controls.target);
      const next = Math.max(controls.minDistance, Math.min(controls.maxDistance, distance * (button.dataset.previewZoom === "in" ? 0.8 : 1.25)));
      camera.position.lerp(controls.target, 1 - next / distance);
      controls.update();
    };
  });
  d.querySelector("[data-preview-reset]").onclick = () => {
    preview.fitModel();
  };
  retry.onclick = load;
  load();
  d.addEventListener("close", () => preview?.dispose());
}
function editModel(existing) {
  const draft = existing
    ? structuredClone(existing)
    : { id: uid(), name: "", kind: "glb", color: "#8da88b", credit: "" };
  let uploading = 0;
  const d = modal(
    `<span class="eyebrow">MODEL LIBRARY</span><h2>${existing ? "모델 정보 수정" : "새 모델 등록"}</h2><form id="model-form">${field("모델 이름", "name", draft.name, "text", 'required maxlength="200"')}${select("모델 종류", "kind", { glb: "GLB 파일" }, draft.kind)}<label class="upload-field" id="upload-area">${icon("upload")}<strong>3D 모델 파일 선택</strong><span>GLB 2.0 · 최대 25MB · 텍스처 포함 · 움직이지 않는 모델도 올릴 수 있어요</span><input type="file" name="file" accept=".glb" aria-label="3D 모델 파일 선택"><span id="upload-status">${draft.url ? "등록된 파일이 있어요. 새 파일을 선택하면 교체돼요." : "파일을 선택해 주세요."}</span></label><label class="upload-field">${icon("upload")}<strong>모델 썸네일 (필수)</strong><span>실제 모델을 보여 주는 PNG · 최대 5MB · 가로·세로 4096 이하</span><input type="file" name="thumbnail" accept="image/png,.png" aria-label="모델 썸네일"><img id="thumbnail-preview" class="thumbnail-preview" alt="선택한 모델 썸네일" ${draft.thumbnail ? `src="${esc(draft.thumbnail)}"` : "hidden"}><span id="thumbnail-status">${draft.thumbnail ? "등록된 썸네일이 있어요. 새 이미지로 교체할 수 있어요." : "모델을 대표할 이미지를 선택해 주세요."}</span></label>${field("기본 모델 색상", "color", draft.color, "color")}<label class="field">제작자 및 사용 권한<textarea name="credit" rows="3" maxlength="500" required>${esc(draft.credit)}</textarea></label><p class="field-hint">모델의 제작자와 사용 허가를 기록해 주세요. 업로드한 모델은 파일 자체의 색상을 사용해요.</p><div class="modal-actions">${existing ? '<button type="button" id="delete-model" class="text-button danger">모델 삭제</button>' : ""}<button id="model-submit" class="primary-button">${existing ? "변경 적용" : "보관함에 등록"}</button></div></form>`,
  );
  routeDialog(d, existing ? "model" : "new-model", existing?.id);
  const form = d.querySelector("form");
  const update = () => {
    d.querySelector("#upload-area").hidden = form.elements.kind.value !== "glb";
  };
  update();
  form.elements.kind.onchange = update;
  form.elements.file.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploading++;
    d.querySelector("#model-submit").disabled = true;
    const status = d.querySelector("#upload-status");
    status.textContent = "모델 파일을 등록하는 중…";
    try {
      if (file.size > 25 * 1024 * 1024)
        throw Error("25MB 이하의 파일을 선택해 주세요.");
      const fd = new FormData();
      fd.append("model", file);
      const result = await api("/api/models/upload", {
        method: "POST",
        body: fd,
      });
      draft.url = result.url; draft.clips = result.clips; draft.rigged = result.rigged;
      status.textContent = `업로드 완료 · ${(result.bytes / 1024).toFixed(0)} KB · ${result.clips.length ? `동작 ${result.clips.length}개 (${result.clips.join(", ")})` : "파일 속 동작 없음 · 정적 모델"}`;
    } catch (e) {
      status.textContent = e.message;
    } finally {
      uploading--;
      d.querySelector("#model-submit").disabled = uploading > 0;
    }
  };
  form.elements.thumbnail.onchange = async (e) => {
    const file=e.target.files[0]; if(!file)return;
    uploading++; d.querySelector('#model-submit').disabled=true;
    const status=d.querySelector('#thumbnail-status'); status.textContent='썸네일을 등록하는 중…';
    try {
      if(file.size>5*1024*1024)throw Error('5MB 이하의 PNG 이미지를 선택해 주세요.');
      const bitmap=await createImageBitmap(file); bitmap.close();
      const fd=new FormData(); fd.append('image',file);
      const result=await api('/api/floor/upload',{method:'POST',body:fd});
      draft.thumbnail=result.url;
      const preview=d.querySelector('#thumbnail-preview'); preview.src=result.url; preview.hidden=false;
      status.textContent='썸네일 업로드 완료';
    } catch(error) { status.textContent=error.message; }
    finally { uploading--; d.querySelector('#model-submit').disabled=uploading>0; }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    if (uploading) return;
    const fd = new FormData(form);
    const kind = fd.get("kind");
    if (kind === "glb" && !draft.url) {
      toast("먼저 올바른 GLB 파일을 등록해 주세요.");
      return;
    }
    if (!draft.thumbnail) {
      toast('모델 썸네일을 등록해 주세요.');
      form.elements.thumbnail.focus(); return;
    }
    Object.assign(draft, {
      name: String(fd.get("name")).trim(),
      kind,
      color: fd.get("color"),
      credit: String(fd.get("credit")).trim(),
    });
    if (!draft.name || !draft.credit) {
      toast("모델 이름과 사용 권한을 입력해 주세요.");
      return;
    }
    if (kind !== "glb") delete draft.url;
    // A file with motions plays one of them; a still file cannot keep a file motion.
    if (existing) { Object.assign(existing, draft); for(const b of library.books) for(const c of b.chapters) for(const p of c.placements) if(p.modelId===draft.id) { if(draft.clips?.length){p.animation="clip";if(!draft.clips.includes(p.clip))p.clip=draft.clips[0];} else if(p.animation==="clip"){p.animation="none";p.clip="";} } }
    else library.models.push(draft);
    mark();
    d.close();
    render();
    toast("모델을 보관함에 등록했어요. 임시 저장 또는 공개로 반영해 주세요.");
  };
  d.querySelector("#delete-model")?.addEventListener("click", () => {
    const used = library.books.some((b) =>
      b.chapters.some((c) => c.placements.some((p) => p.modelId === draft.id)),
    );
    if (used) {
      toast("배치된 장면에서 먼저 모델을 제거해 주세요.");
      return;
    }
    d.close();
    confirmAction(
      "보관함에서 모델을 삭제할까요?",
      "저장 전에는 새로고침으로 되돌릴 수 있어요.",
      () => {
        library.models = library.models.filter((m) => m.id !== draft.id);
        mark();
        render();
      },
    );
  });
}
function slideCard(slide, i, count) {
  return `<article class="slide-card" data-slide="${esc(slide.id)}"><div class="slide-order"><b>${String(i + 1).padStart(2, "0")}</b><button type="button" class="icon-button" data-slide-move="-1" aria-label="${i + 1}번 슬라이드를 앞으로" ${i ? "" : "disabled"}>↑</button><button type="button" class="icon-button" data-slide-move="1" aria-label="${i + 1}번 슬라이드를 뒤로" ${i === count - 1 ? "disabled" : ""}>↓</button></div>
    <div class="slide-media">${imageField(`slide-${i}-pc`, "PC용 이미지 (PNG)", "image", slide.image, "권장 크기 2784×800px · 87:25 비율 · 5MB 이하. 화면 너비가 600px보다 클 때 보여요. 다른 비율은 가운데를 기준으로 잘립니다.", imageSlots.hero.slice(0, 1))}${imageField(`slide-${i}-mobile`, "모바일용 이미지 (PNG)", "imageMobile", slide.imageMobile, "권장 크기 654×720px · 109:120 비율 · 5MB 이하. 화면 너비가 600px 이하일 때 보여요. PC용과 각각 올려 주세요.", imageSlots.heroMobile)}</div>
    <div class="slide-fields">${field("이동 URL", "url", slide.url, "text", 'maxlength="2000" placeholder="/about" autocomplete="off"')}<p class="field-hint">서비스 안에서 이동할 주소를 /로 시작해 입력해 주세요. 예: /about 또는 /client/?book=alice. 공개하려면 주소와 두 이미지를 모두 입력해야 해요.</p>${field("작은 문구", "kicker", slide.kicker, "text", 'maxlength="40" placeholder="선택 입력"')}${field("제목", "title", slide.title, "text", 'maxlength="60" placeholder="선택 입력"')}<label class="field">설명<textarea name="description" rows="2" maxlength="200" placeholder="선택 입력">${esc(slide.description)}</textarea></label><p class="field-hint">문구를 비워 두면 이미지 위에 글을 표시하지 않아요. 이미지에 글이 이미 들어 있다면 비워 두세요.</p><button type="button" class="text-button danger" data-slide-remove>슬라이드 삭제</button></div></article>`;
}
function homeView() {
  const slides = library.home.hero;
  const shown = heroSlides(library.books.filter((b) => b.published), { hero: [] }).map((s) => s.book.title);
  return `<div class="page-title"><div><span class="eyebrow">THE FIRST PAGE READERS SEE</span><h1>홈 화면</h1><p>사용자 화면 첫머리의 추천 슬라이드를 꾸며요. 책장에 놓일 순서는 도서 보관함에서 끌어서 바꿉니다.</p></div><button id="preview-home" class="outline-button">${icon("eye")} 홈 미리보기</button></div><section class="home-slides" aria-labelledby="home-slides-title"><div class="home-slides-heading"><h2 id="home-slides-title">추천 슬라이드 <span>${slides.length} / 5</span></h2><button id="add-slide" class="primary-button" ${slides.length >= 5 ? "disabled" : ""}>${icon("plus")} 슬라이드 추가</button></div>${slides.length ? slides.map((s, i) => slideCard(s, i, slides.length)).join("") : `<p class="inline-empty">슬라이드가 없으면 ${shown.length ? `도서 보관함 순서의 앞 ${shown.length}권(${shown.map(esc).join(", ")})이` : "공개 대상 책이"} 기본 모습으로 나옵니다.</p>`}</section>`;
}
function bindHome() {
  const slides = library.home.hero;
  const section = app.querySelector(".home-slides");
  const slideOf = (el) => slides.find((s) => s.id === el.closest("[data-slide]")?.dataset.slide);
  // Typing changes the slide at once; the change event records one undo step, as the world editor does.
  section.oninput = (e) => {
    const slide = slideOf(e.target);
    if (slide && ["url", "kicker", "title", "description"].includes(e.target.name)) slide[e.target.name] = e.target.value;
  };
  section.onchange = (e) => {
    const slide = slideOf(e.target);
    if (!slide || !["url", "kicker", "title", "description"].includes(e.target.name)) return;
    slide[e.target.name] = e.target.value;
    mark();
  };
  section.querySelectorAll("[data-slide]").forEach((card, i) => {
    const slide = slides[i];
    bindImageField(card, `slide-${i}-pc`, "image", { change: (url) => { slide.image = url; mark(); } });
    bindImageField(card, `slide-${i}-mobile`, "imageMobile", { change: (url) => { slide.imageMobile = url; mark(); } });
    card.querySelectorAll("[data-slide-move]").forEach((button) => button.onclick = () => {
      const j = i + Number(button.dataset.slideMove);
      [slides[i], slides[j]] = [slides[j], slides[i]];
      mark();
      render();
      // Keep focus on the moved slide; at either end the same arrow is disabled, so use the other one.
      const moved = app.querySelector(`[data-slide="${CSS.escape(slide.id)}"]`);
      (moved.querySelector(`[data-slide-move="${button.dataset.slideMove}"]:not(:disabled)`) || moved.querySelector("[data-slide-move]:not(:disabled)"))?.focus();
    });
    card.querySelector("[data-slide-remove]").onclick = () => confirmAction("이 슬라이드를 삭제할까요?", "저장 전에는 새로고침으로 되돌릴 수 있어요.", () => {
      library.home.hero = slides.filter((s) => s !== slide);
      mark();
      render();
    });
  });
  app.querySelector("#add-slide").onclick = () => {
    slides.push({ id: uid(), url: "", image: "", imageMobile: "", kicker: "", title: "", description: "" });
    mark();
    render();
  };
  app.querySelector("#preview-home").onclick = () => previewHome();
}
function previewHome(saveFirst = true) {
  return openPreview("", "공개 전 홈 화면 체험", "임시 저장한 홈 화면을 확인합니다. 공개 대상 책만 보이며, 공개 중인 화면에는 영향을 주지 않습니다.", saveFirst);
}
function settingsView() {
  return `<div class="page-title"><div><span class="eyebrow">READY TO OPEN THE BOOK</span><h1>공개 및 안내</h1><p>장면을 충분히 살펴본 후 독자를 초대해 주세요.</p></div></div><div class="settings-grid"><section class="settings-card"><h2>저장과 공개</h2><p><b>임시 저장</b>은 관리자 작업을 보관합니다. 사용자에게 보여 주려면 <b>사용자 화면에 공개</b>를 눌러 주세요.</p><p>책 정보에서 ‘공개 대상’을 해제하고 다시 공개하면 해당 책을 책장에서 숨길 수 있어요.</p><a class="outline-button" href="${esc(clientUrl)}" target="_blank">공개된 화면 확인 ${icon("arrow-up-right")}</a></section><section class="settings-card"><h2>작업 데이터 백업</h2><p>책·챕터·배치와 홈 슬라이드 설정을 한 파일로 내려받습니다. 업로드한 이미지와 3D 파일은 파일 저장소에 따로 보관되고, 이 파일에는 그 주소만 담깁니다.</p><button id="export" class="outline-button">${icon("save")} 설정 내려받기</button></section><section class="settings-card"><h2>이야기와 모델의 출처</h2><p>기본 이야기는 영어 고전을 바탕으로 직접 작성한 한국어 축약·각색입니다. 기존 번역문과 캐릭터 자산을 가져오지 않았습니다.</p><p>새 책과 모델을 등록할 때에는 이용할 원문·번역·3D 파일 각각의 사용 권한을 기록해 주세요.</p></section><section class="settings-card"><h2>저장 위치와 접속</h2><p>${sharedStore ? "임시 저장과 공개는 운영 사용자 화면과 같은 저장소에 기록됩니다. 이 컴퓨터에서 띄운 스튜디오에서 공개해도 운영 화면이 바로 바뀌어요." : "임시 저장과 공개는 이 서버의 데이터 폴더에 기록되며, 운영 사용자 화면에는 영향을 주지 않습니다."}</p><p>${protectedMode ? "관리자 비밀번호 보호가 켜져 있습니다." : "비밀번호 없이 열려 있으며, 이 컴퓨터에서만 접속할 수 있습니다."}</p><p>배포·로그인·백업 설정은 프로젝트 안내문에 정리했습니다.</p></section></div>`;
}
function exportData() {
  const blob = new Blob([JSON.stringify(library, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "on-the-book-library.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function confirmAction(title, description, action) {
  const d = modal(
    `<h2>${esc(title)}</h2><p>${esc(description)}</p><div class="modal-actions"><button id="cancel-action" class="outline-button">취소</button><button id="confirm-action" class="primary-button">삭제 적용</button></div>`,
  );
  d.querySelector("#cancel-action").onclick = () => d.close();
  d.querySelector("#confirm-action").onclick = () => {
    d.close();
    action();
  };
}
async function save(publish) {
  if (busy) return false;
  if(publish){const incomplete=library.books.find(b=>b.published&&(!b.author.trim()||!b.rights.trim()||!b.source));if(incomplete){toast(incomplete.title+'의 저자·출처·권리 정보를 완성해 주세요.');return false;}}
  busy = true;
  const savingLibrary=structuredClone(library);
  const buttons = [
    document.querySelector("#save"),
    document.querySelector("#publish"),
  ];
  buttons.forEach((b) => (b.disabled = true));
  document.querySelector("#save-state").textContent = publish
    ? "사용자 화면에 공개하는 중…"
    : "저장하는 중…";
  try {
    const result = await api("/api/studio", {
      method: "PUT",
      body: JSON.stringify({ library:savingLibrary, version, publish }),
    });
    version = result.version;
    publishedAt = result.publishedAt;
    savedLibrary=savingLibrary;
    dirty = !!hasUnsavedChanges();
    toast(
      publish
        ? "사용자 화면에 공개했어요. 사용자 화면을 새로고침해 확인하세요."
        : "변경사항을 임시 저장했어요.",
    );
    document.querySelector("#save-state").textContent = publish
      ? "공개 완료"
      : "변경사항 저장됨";
    return true;
  } catch (e) {
    toast(e.message);
    document.querySelector("#save-state").textContent = "저장하지 못했어요";
    return false;
  } finally {
    busy = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}
window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("popstate", () => {
  if (backPending) return settleBack(false); // our own step back over a closed dialog's entry
  if (!library) return; // the login and loading screens read the address themselves once the studio loads
  const { route, notice } = resolveRoute(parseRoute(location.pathname, location.search), library);
  const current = currentRoute();
  if (current.view === "editor" && !(route.view === "editor" && route.bookId === current.bookId) && (leaveDialog?.open || busy || hasUnsavedChanges())) {
    // Keep the editor's address while the leave dialog decides; leaving then steps back to where the browser was going.
    history.pushState({}, "", routeHref(current));
    if (!leaveDialog?.open) requestLeaveEditor(() => history.back());
    return;
  }
  const page = (r) => routeHref({ ...r, modal: undefined, modalId: undefined });
  // A discarded new book leaves inEditor set with no book, so currentRoute() already reads "books";
  // without this check a full leave of the editor would look like a same-page dialog change.
  const stale = inEditor && current.view !== "editor";
  if (!stale && page(route) === page(current)) syncDialog(route);
  else applyRoute(route);
  if (notice) toast(notice);
});
window.addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveScroll, 150); }, { passive: true });
window.addEventListener("pagehide", () => { if (urlTimer) syncUrl(); saveScroll(); });
async function load() {
  try {
    const result = await api("/api/studio");
    library = result.library;
    // Cloud data saved before home slides existed has no home; fill it before the saved copy is taken.
    library.home ??= {};
    library.home.hero ??= [];
    library.home.hero = library.home.hero.map((slide, index) => editableHeroSlide(slide, library.books, index));
    baseline=structuredClone(library);savedLibrary=structuredClone(library);
    version = result.version;
    publishedAt = result.publishedAt;
    protectedMode = result.protected;
    sharedStore = !!result.shared;
    openAddress();
  } catch (e) {
    if (e.status === 401) {
      app.innerHTML = `<main class="login-screen"><a class="brand" href="${esc(clientUrl)}">${logo}</a><h1>이야기를 만드는 공간</h1><p>관리자 비밀번호로 스튜디오를 열어 주세요.</p><form id="login-form">${field("관리자 비밀번호", "password", "", "password", 'required autocomplete="current-password"')}<p id="login-error" role="alert"></p><button class="primary-button full">스튜디오 들어가기 ${icon("arrow-right")}</button></form></main>`;
      icons();
      document.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api("/api/login", {
            method: "POST",
            body: JSON.stringify({
              password: new FormData(e.target).get("password"),
            }),
          });
          await load();
        } catch (e) {
          document.querySelector("#login-error").textContent = e.message;
        }
      };
    } else {
      app.innerHTML = `<div class="loading-screen"><h1>스튜디오를 불러오지 못했어요.</h1><p>${esc(e.message)}</p><button id="retry" class="primary-button">다시 시도</button></div>`;
      document.querySelector("#retry").onclick = load;
    }
  }
}
load();

async function previewClient(modelId = '') {
  if (!chapter()) return;
  await openPreview('&book=' + encodeURIComponent(bookId) + '&chapter=' + encodeURIComponent(chapterId) + (modelId ? '&model=' + encodeURIComponent(modelId) : ''), '공개 전 독자 화면 체험', '임시 저장한 내용을 체험합니다. 공개 중인 책에는 영향을 주지 않습니다.');
}
// Saves the draft first, then shows the reader in a frame at desktop or phone width. Reopened from its
// address, the home preview saves only when something is unsaved.
async function openPreview(query, heading, note, saveFirst = true) {
  const push = !applying;
  // Reopened from its address, the home preview holds the address while the draft saves; Back meanwhile cancels it.
  const held = !query && !push ? (routeModal = { modal: "home-preview" }) : null;
  if (saveFirst && !await save(false)) { if (held && routeModal === held) { routeModal = null; syncUrl(); } return; }
  if (held && routeModal !== held) return;
  if (!query && tab !== "home") return;
  const d = modal(`<h2>${esc(heading)}</h2><p>${esc(note)}</p><div class="preview-size-controls"><button id="preview-desktop" class="outline-button">넓은 화면</button><button id="preview-mobile" class="outline-button">모바일 화면</button></div><iframe title="공개 전 독자 화면" src="/client/?preview=draft${query}"></iframe>`);
  d.classList.add('client-preview-dialog');
  d.querySelector('#preview-mobile').onclick = () => d.classList.add('mobile-preview');
  d.querySelector('#preview-desktop').onclick = () => d.classList.remove('mobile-preview');
  // Frames share the window's history: the preview moves by replacing its entry, so Back closes the dialog.
  const frame = d.querySelector('iframe');
  // Another origin's frame cannot be patched; the one-second step-back fallback covers it.
  frame.addEventListener('load', () => { try { const h = frame.contentWindow.history; h.pushState = h.replaceState.bind(h); } catch {} });
  d.addEventListener('close', () => { d.querySelector('iframe')?.remove(); }, {once:true});
  if (!query) routeDialog(d, "home-preview", undefined, push);
}









