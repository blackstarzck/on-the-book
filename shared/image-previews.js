const previews = new Map();
const states = new Map();
const readySources = new Set();
const sourceOf = img => img.getAttribute('src') || img.getAttribute('data-src') || '';
const supported = img => img instanceof HTMLImageElement && (img.hasAttribute('data-image-preview') || /^\/uploads\/[a-f0-9-]{36}\.(png|webp)$/.test(sourceOf(img)));
let observing = false;

export function registerImagePreviews(values = {}) {
  for (const [url, preview] of Object.entries(values)) if (preview) previews.set(url, preview);
  if (typeof document === 'undefined') return;
  startImagePreviews();
  for (const img of document.querySelectorAll('img')) if (supported(img)) enhance(img);
}

export function startImagePreviews() {
  if (observing || typeof document === 'undefined') return;
  observing = true;
  const scan = node => {
    if (!(node instanceof Element)) return;
    if (supported(node)) enhance(node);
    for (const img of node.querySelectorAll('img')) if (supported(img)) enhance(img);
  };
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
        if (supported(record.target)) enhance(record.target);
        else if (states.has(record.target)) clean(record.target);
      }
      for (const node of record.addedNodes) scan(node);
    }
    for (const img of states.keys()) if (!img.isConnected) clean(img);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-src', 'hidden', 'style', 'data-image-preview'] });
  scan(document.documentElement);
}

function clean(img) {
  const state = states.get(img);
  if (!state) return;
  state.resize.disconnect(); state.layer?.remove();
  img.removeEventListener('load', state.load); img.removeEventListener('error', state.error);
  img.classList.remove('image-preview-pending', 'image-preview-reveal');
  if (state.derivedDimensions) { img.removeAttribute('width'); img.removeAttribute('height'); }
  states.delete(img);
}

function enhance(img) {
  const source = sourceOf(img);
  let state = states.get(img);
  if (state && state.source !== source) { clean(img); state = null; }
  if (!state) {
    const host = img.parentElement;
    if (!host) return;
    host.classList.add('image-preview-host');
    img.classList.add('image-preview-original');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    state = { source, host, layer: null, status: 'pending', finishing: false, cached: readySources.has(source) };
    state.resize = new ResizeObserver(() => position(img, state));
    state.resize.observe(img);
    state.load = () => ready(img, state);
    state.error = () => failed(img, state);
    img.addEventListener('load', state.load); img.addEventListener('error', state.error);
    states.set(img, state);
    if (img.complete && img.naturalWidth > 0 && img.getAttribute('src')) {
      state.status = 'ready';
      readySources.add(source); state.resize.disconnect();
      return; // Cached originals do not flash a placeholder or replay the transition.
    }
    img.classList.add('image-preview-pending');
    const layer = document.createElement('span');
    layer.className = 'image-preview-layer'; layer.setAttribute('aria-hidden', 'true');
    host.insertBefore(layer, img); state.layer = layer;
    if (img.complete && img.getAttribute('src') && !img.naturalWidth) failed(img, state);
  }
  if (state.status === 'pending') {
    let preview = previews.get(source);
    if (!preview && img.dataset.imagePreview) {
      try { preview = JSON.parse(img.dataset.imagePreview); } catch { /* An original is still usable without metadata. */ }
    }
    if (preview?.width && preview?.height && (!img.hasAttribute('width') || state.derivedDimensions)) {
      img.width = preview.width; img.height = preview.height; state.derivedDimensions = true;
    }
    state.layer.style.backgroundColor = /^#[a-f\d]{6}$/i.test(preview?.color || '') ? preview.color : 'transparent';
    state.layer.style.backgroundImage = /^data:image\/webp;base64,[a-z\d+/=]+$/i.test(preview?.lqip || '') ? `url("${preview.lqip}")` : 'none';
    state.layer.textContent = preview?.lqip || preview?.color ? '' : '이미지를 불러오는 중';
  }
  position(img, state);
}

function position(img, state) {
  const layer = state.layer;
  if (!layer) return;
  const style = getComputedStyle(img);
  Object.assign(layer.style, {
    left: img.offsetLeft + 'px', top: img.offsetTop + 'px', width: img.offsetWidth + 'px', height: img.offsetHeight + 'px',
    backgroundSize: style.objectFit === 'contain' ? 'contain' : style.objectFit === 'fill' ? '100% 100%' : 'cover', backgroundPosition: style.objectPosition,
    borderRadius: style.borderRadius, zIndex: style.zIndex === 'auto' ? '0' : style.zIndex,
    transform: style.transform, transformOrigin: style.transformOrigin, display: img.hidden || style.display === 'none' ? 'none' : 'grid',
  });
}

async function ready(img, state) {
  if (state.status !== 'pending' || state.finishing) return;
  state.finishing = true;
  try { await img.decode(); } catch { /* Some browsers reject decode after a successful load. */ }
  if (states.get(img) !== state || sourceOf(img) !== state.source || !img.isConnected) return;
  if (!img.naturalWidth) { failed(img, state); return; }
  state.status = 'ready';
  readySources.add(state.source);
  img.classList.add('image-preview-reveal'); img.classList.remove('image-preview-pending');
  state.layer?.classList.add('image-preview-finished');
  const remove = () => { if (states.get(img) === state) { state.layer?.remove(); state.layer = null; state.resize.disconnect(); img.classList.remove('image-preview-reveal'); } };
  if (state.cached || matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
  else setTimeout(remove, 180);
}

function failed(img, state) {
  if (states.get(img) !== state || !state.layer) return;
  state.status = 'error';
  state.layer.classList.add('image-preview-error');
  state.layer.style.backgroundImage = 'none'; state.layer.style.backgroundColor = 'transparent';
  state.layer.textContent = '이미지를 불러오지 못했어요';
  state.layer.removeAttribute('aria-hidden');
  position(img, state);
}
