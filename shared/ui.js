import {
  createIcons,
  BookOpen,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Volume2,
  VolumeX,
  Map,
  Bookmark,
  X,
  Plus,
  Search,
  Box,
  Layers,
  Settings2,
  Eye,
  Save,
  Upload,
  Trash2,
  ChevronRight,
  Check,
  Move,
  RotateCcw,
  Sparkles,
  HelpCircle,
  LogOut,
  Menu,
} from "lucide";
export const icons = () =>
  createIcons({
    icons: {
      BookOpen,
      ArrowUpRight,
      ArrowLeft,
      ArrowRight,
      Volume2,
      VolumeX,
      Map,
      Bookmark,
      X,
      Plus,
      Search,
      Box,
      Layers,
      Settings2,
      Eye,
      Save,
      Upload,
      Trash2,
      ChevronRight,
      Check,
      Move,
      RotateCcw,
      Sparkles,
      HelpCircle,
      LogOut,
      Menu,
    },
  });
export const icon = (name) =>
  `<i data-lucide="${name}" aria-hidden="true"></i>`;
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const uid = () => crypto.randomUUID();
export async function api(url, options = {}) {
  if (['client', 'admin'].includes(import.meta.env.MODE) && options.body instanceof FormData) {
    const image = url === '/api/floor/upload';
    const file = options.body.get(image ? 'image' : 'model');
    if (!file) throw Error('파일을 선택해 주세요.');
    const prepared = await api('/api/uploads/prepare', { method: 'POST', body: JSON.stringify({ kind: image ? 'image' : 'model', size: file.size }) });
    const upload = await fetch(prepared.url, { method: 'PUT', headers: { 'Content-Type': image ? 'image/png' : 'model/gltf-binary' }, body: file });
    if (!upload.ok) throw Error('파일을 업로드하지 못했습니다. 다시 시도해 주세요.');
    options = { ...options, body: JSON.stringify({ filename: prepared.filename }) };
  }
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "X-On-The-Book": "studio",
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
  } catch {
    throw Error(
      "서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.",
    );
  }
  const result = await response.json();
  if (!response.ok) {
    const e = Error(result.error || "요청하지 못했습니다.");
    e.status = response.status;
    throw e;
  }
  return result;
}
let toastTimer;
export function toast(message) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 4200);
}
export function modal(content) {
  const previous = document.activeElement;
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.innerHTML = `<button class="icon-button close-modal" aria-label="닫기">${icon("x")}</button>${content}`;
  document.body.append(dialog);
  dialog.querySelector(".close-modal").onclick = () => dialog.close();
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.onclose = () => {
    dialog.remove();
    previous?.focus();
  };
  dialog.showModal();
  icons();
  return dialog;
}
export const logo = `<span class="brand-mark"><img src="/brand/book-path.svg" alt="" width="44" height="30" /></span><span class="wordmark">on the book<span class="brand-dot">.</span></span>`;
