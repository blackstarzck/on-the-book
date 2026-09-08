import { logo } from "../shared/ui.js";
import "./transitions.css";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const animations = new Set();
let curtain, changing = false;
const easing = "cubic-bezier(.22, 1, .36, 1)";

function animate(element, frames, options) {
  if (!element || reducedMotion.matches) return Promise.resolve();
  const animation = element.animate(frames, { easing, fill: "both", ...options });
  animations.add(animation);
  return animation.finished.catch(() => {}).finally(() => {
    animation.cancel();
    animations.delete(animation);
  });
}
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) for (const animation of animations) animation.finish();
});

export function showLoading(label = "책 속의 작은 세계를 펼치는 중이에요…") {
  curtain?.remove();
  curtain = document.createElement("div");
  curtain.className = "reader-curtain";
  curtain.setAttribute("role", "status");
  curtain.innerHTML = `<span class="brand" aria-hidden="true">${logo}</span><p></p><span class="reader-loading-line" aria-hidden="true"></span>`;
  curtain.querySelector("p").textContent = label;
  document.body.append(curtain);
}

export function clearLoading() {
  curtain?.remove();
  curtain = null;
}

function reveal(app) {
  animate(app.querySelector(".scene-wrap"), [{ opacity: 0 }, { opacity: 1 }], { duration: 700 });
  const groups = app.querySelector(".hero-copy")
    ? [".site-header", ".eyebrow", ".hero-copy h1", ".hero-description", ".featured-label, .hero-copy h2, .book-credit", "#start-button, .gentle-note", ".scene-label, .floating-note, .edition", ".site-footer"]
    : [".site-header", ".journey-controls", ".touch-pad, .move-hint", ".site-footer"];
  groups.forEach((selector, index) => {
    for (const element of app.querySelectorAll(selector)) {
      animate(element, [{ opacity: 0, translate: "0 14px" }, { opacity: 1, translate: "0 0" }], {
        duration: 560, delay: 60 + index * 65,
      });
    }
  });
}

export async function transitionPage(app, update, { initial = false, label, focus } = {}) {
  if (changing) return false;
  changing = true;
  app.inert = true;
  app.setAttribute("aria-busy", "true");
  try {
    if (!curtain) {
      showLoading(label);
      await animate(curtain, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
    }
    for (const animation of animations) animation.finish();
    update();
    if (!initial && !focus) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // Let the new canvas paint before lifting the curtain; hidden tabs must not stall navigation.
    await new Promise(resolve => {
      const fallback = setTimeout(resolve, 120);
      requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(fallback); resolve(); }));
    });
    reveal(app);
    await animate(curtain, [{ opacity: 1 }, { opacity: 0 }], { duration: 360 });
  } finally {
    clearLoading();
    app.inert = false;
    app.removeAttribute("aria-busy");
    changing = false;
  }
  if (!initial) {
    const target = focus ? app.querySelector(focus)
      : app.querySelector(".hero-copy h1") || app.querySelector("#world canvas, #fallback-read");
    if (target) {
      if (!target.hasAttribute("tabindex")) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }
  return true;
}
