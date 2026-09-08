import { World } from "../shared/world.js";
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
  tab = "books",
  bookId,
  chapterId,
  placementId,
  world,
  dirty = false,
  busy = false,
  query = "";
const app = document.querySelector("#app");
const book = () => library.books.find((b) => b.id === bookId);
const chapter = () => book()?.chapters.find((c) => c.id === chapterId);
const placement = () => chapter()?.placements.find((p) => p.id === placementId);
const mark = () => {
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
function render() {
  world?.dispose();
  world = null;
  app.innerHTML = `<div class="studio-shell"><aside class="studio-sidebar"><a class="brand" href="/admin/">${logo}</a><span class="studio-label">STORYTELLING STUDIO</span><div class="workspace-label">WORKSPACE</div><nav class="studio-nav">${[
    ["books", "book-open", "책과 챕터"],
    ["models", "box", "3D 모델 보관함"],
    ["settings", "settings-2", "공개 및 안내"],
  ]
    .map(
      ([id, ic, label]) =>
        `<button data-tab="${id}" class="${tab === id ? "active" : ""}">${icon(ic)}${label}${tab === id ? '<span class="active-dot"></span>' : ""}</button>`,
    )
    .join(
      "",
    )}</nav><div class="sidebar-note">${icon("sparkles")}<p>한 장면의 작은 움직임이<br>이야기에 생명을 불어넣어요.</p></div><a class="visit-client" href="/client/" target="_blank">사용자 화면 열기 ${icon("arrow-up-right")}</a><div class="studio-user"><span>O</span><div><strong>On the Book</strong><small>${protectedMode ? "관리자 로그인됨" : "내 컴퓨터 작업 공간"}</small></div>${protectedMode ? `<button id="logout" class="icon-button" aria-label="로그아웃">${icon("log-out")}</button>` : ""}</div></aside><div class="studio-main"><header class="studio-header"><div><span>워크스페이스</span>${icon("chevron-right")}<strong>${tab === "books" ? "책과 챕터" : tab === "models" ? "3D 모델 보관함" : "공개 및 안내"}</strong></div><div><span id="save-state">${dirty ? "저장하지 않은 변경사항" : "변경사항 저장됨"}</span><button id="save" class="outline-button" ${busy ? "disabled" : ""}>${icon("save")} 임시 저장</button><button id="publish" class="primary-button" ${busy ? "disabled" : ""}>${icon("eye")} 사용자 화면에 공개</button></div></header><main class="studio-content">${tab === "books" ? booksView() : tab === "models" ? modelsView() : settingsView()}</main></div></div>`;
  icons();
  for (const b of document.querySelectorAll("[data-tab]"))
    b.onclick = () => {
      tab = b.dataset.tab;
      render();
    };
  document.querySelector("#save").onclick = () => save(false);
  document.querySelector("#publish").onclick = () => save(true);
  document.querySelector("#logout")?.addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: "{}" });
    location.reload();
  });
  if (tab === "books") bindBooks();
  if (tab === "models") bindModels();
  if (tab === "settings") {
    document.querySelector("#export").onclick = exportData;
  }
}
function booksView() {
  const b = book(),
    c = chapter();
  return `<div class="page-title"><div><span class="eyebrow">BUILD A WORLD, ONE CHAPTER AT A TIME</span><h1>책 속의 세계를 만들어 보세요.</h1><p>이야기를 나누고, 장면을 꾸미고, 작은 움직임을 더해요.</p></div><button id="new-book" class="outline-button">${icon("plus")} 새 책 만들기</button></div><div class="studio-stats"><div><span>함께하는 이야기</span><strong>${library.books.length}<small>권의 책</small></strong></div><div><span>펼쳐진 장면</span><strong>${library.books.reduce((s, b) => s + b.chapters.length, 0)}<small>개의 챕터</small></strong></div><div><span>작은 세계의 주인공</span><strong>${library.models.length}<small>개의 3D 모델</small></strong></div><div class="status-stat"><span class="live-dot"></span><p>마지막 공개<small>${new Date(publishedAt).toLocaleString("ko-KR")}</small></p></div></div><section class="editor-panel"><div class="editor-book-bar"><div>${icon("book-open")}<select id="book-select" aria-label="편집할 책">${library.books.map((b) => `<option value="${b.id}" ${b.id === bookId ? "selected" : ""}>${esc(b.title)}</option>`).join("")}</select>${b ? `<span class="badge ${b.published ? "" : "draft"}">${b.published ? "공개 대상" : "비공개"}</span>` : ""}</div><div>${b ? `<button id="edit-book" class="text-button">책 정보 편집 ${icon("settings-2")}</button><button id="add-chapter" class="text-button">${icon("plus")} 챕터 추가</button>` : ""}</div></div>${b && c ? `<div class="chapter-tabs">${b.chapters.map((c, i) => `<button data-chapter="${c.id}" class="${c.id === chapterId ? "active" : ""}"><span>${String(i + 1).padStart(2, "0")}</span>${esc(c.title)}</button>`).join("")}</div><div class="scene-editor"><div class="preview-column"><div class="preview-toolbar"><span><i class="live-dot"></i> 장면 미리보기</span><div><button id="edit-story" class="text-button small">${icon("book-open")} 챕터와 본문</button><button id="scene-reset" class="icon-button" aria-label="시점 초기화">${icon("rotate-ccw")}</button></div></div><div id="studio-world" class="studio-world"></div><div class="preview-bottom"><span>${icon("move")} 드래그로 회전 · 휠로 확대</span><span>모델을 눌러 선택하세요</span></div><div class="placement-bar"><h3>장면에 배치된 모델 <span>${c.placements.length}</span></h3><button id="add-placement" class="text-button small">${icon("plus")} 모델 배치</button></div><div class="placement-list">${c.placements.length ? c.placements.map((p) => `<button data-placement="${p.id}" class="${p.id === placementId ? "selected" : ""}"><span class="object-chip">${icon("box")}</span><span><strong>${esc(p.title)}</strong><small>${esc(library.models.find((m) => m.id === p.modelId)?.name)} · ${animations[p.animation]}</small></span>${icon(p.id === placementId ? "check" : "chevron-right")}</button>`).join("") : '<p class="inline-empty">모델 배치를 눌러 첫 번째 주인공을 초대해 보세요.</p>'}</div></div><aside class="inspector">${inspectorView()}</aside></div>` : `<div class="empty-state"><h3>첫 이야기를 만들어 보세요.</h3><p>새 책 만들기로 시작할 수 있어요.</p></div>`}</section>`;
}
function inspectorView() {
  const p = placement();
  if (!p)
    return `<div class="empty-state">${icon("box")}<h3>모델을 선택해 주세요.</h3><p>위치와 움직임을 조정할 수 있어요.</p></div>`;
  return `<div class="inspector-title"><div><span class="eyebrow">OBJECT SETTINGS</span><h2>모델 설정</h2></div><button id="remove-placement" class="icon-button danger" aria-label="장면에서 모델 제거">${icon("trash-2")}</button></div><form id="placement-form">${field("장면 속 이름", "title", p.title)}<div class="field-section">${icon("move")} 위치와 크기</div><div class="field-row">${field("가로 위치", "x", p.x, "number", `min="${-(chapter().width || 64) / 2 + 1}" max="${(chapter().width || 64) / 2 - 1}" step="0.1"`)}${field("세로 위치", "z", p.z, "number", `min="${-(chapter().depth || 56) / 2 + 1}" max="${(chapter().depth || 56) / 2 - 1}" step="0.1"`)}</div><button id="place-on-ground" type="button" class="subtle-button">${icon("move")} 땅을 눌러 위치 정하기</button><div class="field-row">${field("크기 배율", "scale", p.scale, "number", 'min="0.1" max="8" step="0.1"')}${field("회전 각도", "rotation", p.rotation, "number", 'min="-360" max="360" step="5"')}</div><div class="field-section">캐릭터와 충돌</div><label class="checkbox-field"><input name="collision" type="checkbox" ${p.collision !== false ? "checked" : ""}> 캐릭터 통과 막기</label>${field("충돌 반경", "collisionRadius", p.collisionRadius ?? .8, "number", 'min="0.1" max="20" step="0.1"')}<p class="field-hint">모델 중심의 원형 영역입니다. 크기 배율을 함께 반영하며, 애니메이션 중에도 고정됩니다. 반응 범위는 충돌 영역 밖에서도 접근할 수 있도록 확보됩니다.</p><div class="field-section">${icon("sparkles")} 가까이 왔을 때</div>${select("재생할 동작", "animation", animations, p.animation)}${field("파일 속 동작 이름 (비우면 첫 동작)", "clip", p.clip)}<label class="field">반응 거리 <span class="range-value" id="radius-value">${p.radius} m</span><input type="range" name="radius" min="0.5" max="20" step="0.1" value="${p.radius}"></label><p class="field-hint">범위 안에서 애니메이션이 반복되고, 벗어나면 기본 자세로 돌아갑니다. 다시 접근하면 처음부터 재생됩니다.</p><button id="preview-animation" type="button" class="outline-button full">${icon("eye")} 동작 미리보기</button><button id="preview-floor" type="button" class="outline-button full">${icon("book-open")} 바닥 글귀 미리보기</button></form>`;
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
    if (input.name === "radius")
      document.querySelector("#radius-value").textContent = value + " m";
  };
  document.querySelector("#preview-floor").onclick = () => world?.previewFloor(placementId);
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
function editBook(isNew = false) {
  const original = isNew
    ? {
        id: uid(),
        title: "새로운 이야기",
        englishTitle: "A New Story",
        author: "",
        year: 1865,
        description: "",
        source: "https://www.gutenberg.org/",
        rights: "",
        published: false,
        chapters: [newChapter()],
      }
    : book();
  const d = modal(
    `<span class="eyebrow">BOOK DETAILS</span><h2>${isNew ? "새 책 만들기" : "책 정보"}</h2><form id="book-form">${field("책 제목", "title", original.title, "text", 'required maxlength="200"')}${field("영문 제목", "englishTitle", original.englishTitle, "text", 'required maxlength="200"')}<div class="field-row">${field("작가", "author", original.author, "text", 'required maxlength="200"')}${field("원작 출간 연도", "year", original.year, "number", 'required min="1" max="2026"')}</div><label class="field">소개 문장<textarea name="description" rows="2" maxlength="1000">${esc(original.description)}</textarea></label>${field("원작 출처 주소", "source", original.source, "url", 'required pattern="https?://.*"')}<label class="field">권리 및 번역·각색 정보<textarea name="rights" rows="3" maxlength="1000">${esc(original.rights)}</textarea></label><label class="checkbox-field"><input type="checkbox" name="published" ${original.published ? "checked" : ""}> 사용자 화면 공개 대상에 포함</label><div class="modal-actions">${!isNew ? '<button id="delete-book" type="button" class="text-button danger">책 삭제</button>' : ""}<button class="primary-button" type="submit">${isNew ? "책 만들기" : "변경 적용"}</button></div></form>`,
  );
  d.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    Object.assign(original, Object.fromEntries(f), {
      year: +f.get("year"),
      published: f.has("published"),
    });
    if (isNew) library.books.push(original);
    bookId = original.id;
    chapterId = original.chapters[0].id;
    placementId = original.chapters[0].placements[0]?.id;
    mark();
    d.close();
    render();
  };
  d.querySelector("#delete-book")?.addEventListener("click", () => {
    d.close();
    confirmAction(
      "책과 연결된 챕터를 삭제할까요?",
      "공개된 화면은 다시 공개하기 전까지 유지돼요. 저장 전에는 새로고침으로 되돌릴 수 있어요.",
      () => {
        library.books = library.books.filter((b) => b.id !== bookId);
        bookId = library.books[0]?.id;
        chapterId = book()?.chapters[0]?.id;
        placementId = chapter()?.placements[0]?.id;
        mark();
        render();
      },
    );
  });
}
function newChapter() {
  return {
    id: uid(),
    title: "새로운 챕터",
    subtitle: "이곳에서 새로운 이야기가 시작됩니다.",
    body: "",
    theme: "meadow",
    width: 64, depth: 56,
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
function editChapter() {
  const c = chapter(),
    index = book().chapters.indexOf(c);
  const d = modal(
    `<span class="eyebrow">CHAPTER ${index + 1}</span><h2>장면과 이야기</h2><form id="chapter-form">${field("챕터 제목", "title", c.title, "text", 'required maxlength="200"')}${field("짧은 소개", "subtitle", c.subtitle, "text", 'maxlength="250"')}${select("장면 분위기", "theme", themes, c.theme)}${field("공간 가로 크기", "width", c.width || 64, "number", 'min="40" max="120" required')}${field("공간 세로 크기", "depth", c.depth || 56, "number", 'min="40" max="100" required')}<p class="field-hint">이 공간이 챕터 순서대로 연결됩니다. 모델은 공간 안 어디든 배치할 수 있고, 이동 조건은 없습니다.</p><a href="/client/?book=${book().id}&chapter=${c.id}" target="_blank" rel="noopener">공개된 탐험 화면 보기 ↗</a><div class="field-section">바닥 안내와 글귀</div><label class="checkbox-field"><input type="checkbox" name="floorArrows" ${c.floorArrows !== false ? "checked" : ""}> 모델을 따라 이어지는 바닥 화살표</label>${select("바닥 손그림", "floorDecor", {auto:"분위기에 맞게",none:"없음",leaves:"잎사귀","pocket-watch":"회중시계","tea-cup":"찻잔","open-book":"펼친 책"}, c.floorDecor || "auto")}<label class="checkbox-field"><input type="checkbox" name="floorEnabled" ${c.floorEnabled !== false ? "checked" : ""}> 모델 접근 시 바닥 글귀와 카메라 연출</label><label class="field">바닥에 보여 줄 글귀<textarea name="floorText" rows="4" maxlength="15000" placeholder="비우면 아래 이야기 본문 전체를 사용합니다.">${esc(c.floorText || "")}</textarea></label>${field("글귀 카메라 여백 배율", "floorZoom", c.floorZoom ?? 1.1, "number", 'min="1" max="1.8" step="0.1"')}<p class="field-hint">글귀는 화면 오른쪽의 반투명 창에, 캐릭터와 모델은 왼쪽에 표시됩니다. 긴 글은 여러 장으로 나뉩니다. 여백 배율이 클수록 카메라가 멀어지며, 화면 크기에 맞춰 글귀가 보이도록 조절됩니다.</p><label class="field">이야기 본문<textarea name="body" rows="9" maxlength="15000">${esc(c.body)}</textarea></label><div class="modal-actions"><button type="button" id="chapter-up" class="outline-button" ${index === 0 ? "disabled" : ""}>앞으로 옮기기</button><button type="button" id="chapter-down" class="outline-button" ${index === book().chapters.length - 1 ? "disabled" : ""}>뒤로 옮기기</button><button type="button" id="delete-chapter" class="text-button danger" ${book().chapters.length === 1 ? "disabled" : ""}>삭제</button><button class="primary-button">변경 적용</button></div></form>`,
  );
  const apply = () => {
    const values = Object.fromEntries(new FormData(d.querySelector("form")));
    values.width = Number(values.width); values.depth = Number(values.depth);
    for (const key of ["floorZoom"]) values[key] = Number(values[key]);
    values.floorArrows = values.floorArrows === "on"; values.floorEnabled = values.floorEnabled === "on";
    if (c.placements.some(p => Math.abs(p.x) > values.width / 2 - 1 || Math.abs(p.z) > values.depth / 2 - 1)) { toast("모델이 새 공간 밖에 있습니다. 모델을 안쪽으로 옮긴 후 공간을 줄여 주세요."); return false; }
    Object.assign(c, values);
    mark();
    return true;
  };
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
        animation: m.kind === "glb" ? "clip" : "hop",
        clip: "",
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
        return `<article class="model-card"><div class="model-art kind-${m.kind}" style="--model-color:${esc(m.color)}">${modelArt(m.kind)}<span>${m.kind === "glb" ? "GLB" : "BUILT-IN"}</span></div><div class="model-card-body"><h2>${esc(m.name)}</h2><p>${used}개 장면 배치 · ${m.kind === "glb" ? "업로드한 모델" : "직접 제작한 기본 모델"}</p><div><button data-preview-model="${m.id}" class="text-button small">${icon("eye")} 미리보기</button><button data-edit-model="${m.id}" class="icon-button" aria-label="${esc(m.name)} 편집">${icon("settings-2")}</button></div></div></article>`;
      })
      .join("") ||
    '<div class="empty-state"><h3>일치하는 모델이 없어요.</h3><p>다른 이름을 검색하거나 새 모델을 등록해 주세요.</p></div>'
  }</div>`;
}
function modelArt(kind) {
  if (kind === "rabbit")
    return '<div class="art-rabbit"><i></i><i></i><b><em></em><em></em></b><span></span></div>';
  if (kind === "tree")
    return '<div class="art-tree"><i></i><b></b><span></span></div>';
  if (kind === "mushroom")
    return '<div class="art-mushroom"><i></i><b></b></div>';
  return `<span class="model-symbol">${icon(kind === "key" ? "sparkles" : kind === "cards" ? "layers" : kind === "house" ? "book-open" : "box")}</span>`;
}
function bindModels() {
  document.querySelector("#new-model").onclick = () => editModel();
  const search = document.querySelector("#model-search");
  search.oninput = (e) => {
    query = e.target.value;
    const pos = e.target.selectionStart;
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
    `<span class="eyebrow">MODEL PREVIEW</span><h2>${esc(m.name)}</h2><div id="single-preview" class="single-preview"></div><p class="muted">드래그로 회전 · 휠로 확대</p><p class="source-note">${esc(m.credit)}</p>`,
  );
  const p = {
    id: "preview",
    modelId: m.id,
    x: 0,
    z: 0,
    scale: 2,
    rotation: 0,
    radius: 2,
    animation: m.kind === "glb" ? "clip" : "spin",
    clip: "",
    title: m.name,
    story: "",
  };
  let preview;
  try {
    preview = new World(d.querySelector("#single-preview"), {
      chapter: { theme: "meadow", placements: [p] },
      models: [m],
      editor: true,
      onError: toast,
    });
    preview.preview("preview");
  } catch (e) {
    toast(e.message);
  }
  d.addEventListener("close", () => preview?.dispose());
}
function editModel(existing) {
  const draft = existing
    ? structuredClone(existing)
    : { id: uid(), name: "", kind: "glb", color: "#8da88b", credit: "" };
  let uploading = false;
  const d = modal(
    `<span class="eyebrow">MODEL LIBRARY</span><h2>${existing ? "모델 정보 수정" : "새 모델 등록"}</h2><form id="model-form">${field("모델 이름", "name", draft.name, "text", 'required maxlength="200"')}${select("모델 종류", "kind", { glb: "GLB 파일 업로드", ...modelNames }, draft.kind)}<label class="upload-field" id="upload-area">${icon("upload")}<strong>3D 모델 파일 선택</strong><span>GLB 2.0 · 최대 25MB · 텍스처 포함</span><input type="file" name="file" accept=".glb" aria-label="3D 모델 파일 선택"><span id="upload-status">${draft.url ? "등록된 파일이 있어요. 새 파일을 선택하면 교체돼요." : "파일을 선택해 주세요."}</span></label>${field("기본 모델 색상", "color", draft.color, "color")}<label class="field">제작자 및 사용 권한<textarea name="credit" rows="3" maxlength="500" required>${esc(draft.credit)}</textarea></label><p class="field-hint">모델의 제작자와 사용 허가를 기록해 주세요. 업로드한 모델은 파일 자체의 색상을 사용해요.</p><div class="modal-actions">${existing ? '<button type="button" id="delete-model" class="text-button danger">모델 삭제</button>' : ""}<button id="model-submit" class="primary-button">${existing ? "변경 적용" : "보관함에 등록"}</button></div></form>`,
  );
  const form = d.querySelector("form");
  const update = () => {
    d.querySelector("#upload-area").hidden = form.elements.kind.value !== "glb";
  };
  update();
  form.elements.kind.onchange = update;
  form.elements.file.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploading = true;
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
      draft.url = result.url;
      status.textContent = `업로드 완료 · ${(result.bytes / 1024).toFixed(0)} KB · 동작 ${result.clips.length}개${result.clips.length ? " (" + result.clips.join(", ") + ")" : ""}`;
    } catch (e) {
      status.textContent = e.message;
    } finally {
      uploading = false;
      d.querySelector("#model-submit").disabled = false;
    }
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
    if (existing) Object.assign(existing, draft);
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
function settingsView() {
  return `<div class="page-title"><div><span class="eyebrow">READY TO OPEN THE BOOK</span><h1>공개 및 안내</h1><p>장면을 충분히 살펴본 후 독자를 초대해 주세요.</p></div></div><div class="settings-grid"><section class="settings-card"><h2>저장과 공개</h2><p><b>임시 저장</b>은 관리자 작업을 보관합니다. 사용자에게 보여 주려면 <b>사용자 화면에 공개</b>를 눌러 주세요.</p><p>책 정보에서 ‘공개 대상’을 해제하고 다시 공개하면 해당 책을 책장에서 숨길 수 있어요.</p><a class="outline-button" href="/client/" target="_blank">공개된 화면 확인 ${icon("arrow-up-right")}</a></section><section class="settings-card"><h2>작업 데이터 백업</h2><p>책, 챕터, 배치 설정을 한 파일로 내려받습니다. 업로드한 3D 원본 파일은 서버의 데이터 폴더에 별도로 보관됩니다.</p><button id="export" class="outline-button">${icon("save")} 설정 내려받기</button></section><section class="settings-card"><h2>이야기와 모델의 출처</h2><p>기본 이야기는 영어 고전을 바탕으로 직접 작성한 한국어 축약·각색입니다. 기존 번역문과 캐릭터 자산을 가져오지 않았습니다.</p><p>새 책과 모델을 등록할 때에는 이용할 원문·번역·3D 파일 각각의 사용 권한을 기록해 주세요.</p></section><section class="settings-card"><h2>내 컴퓨터에서 실행 중</h2><p>현재 서버는 이 컴퓨터에서만 연결되도록 설정되어 있습니다. ${protectedMode ? "관리자 비밀번호 보호가 켜져 있습니다." : "로컬 작업에서는 로그인 없이 관리할 수 있습니다."}</p><p>외부 서비스로 운영할 때 필요한 배포·로그인·백업 설정은 프로젝트 안내문에 정리했습니다.</p></section></div>`;
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
  if (busy) return;
  busy = true;
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
      body: JSON.stringify({ library, version, publish }),
    });
    version = result.version;
    publishedAt = result.publishedAt;
    dirty = false;
    toast(
      publish
        ? "사용자 화면에 공개했어요. 사용자 화면을 새로고침해 확인하세요."
        : "변경사항을 임시 저장했어요.",
    );
    document.querySelector("#save-state").textContent = publish
      ? "공개 완료"
      : "변경사항 저장됨";
  } catch (e) {
    toast(e.message);
    document.querySelector("#save-state").textContent = "저장하지 못했어요";
  } finally {
    busy = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function load() {
  try {
    const result = await api("/api/studio");
    library = result.library;
    version = result.version;
    publishedAt = result.publishedAt;
    protectedMode = result.protected;
    bookId = library.books[0]?.id;
    chapterId = book()?.chapters[0]?.id;
    placementId = chapter()?.placements[0]?.id;
    render();
  } catch (e) {
    if (e.status === 401) {
      app.innerHTML = `<main class="login-screen"><a class="brand" href="/client/">${logo}</a><h1>이야기를 만드는 공간</h1><p>관리자 비밀번호로 스튜디오를 열어 주세요.</p><form id="login-form">${field("관리자 비밀번호", "password", "", "password", 'required autocomplete="current-password"')}<p id="login-error" role="alert"></p><button class="primary-button full">스튜디오 들어가기 ${icon("arrow-right")}</button></form></main>`;
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
