import "./style.css";
import trailerUrl from "./assets/trailer.mp4";
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = value => { const x = clamp(value); return x * x * (3 - 2 * x); };
const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
const shortViewport = matchMedia('(max-height: 650px)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const mobile = matchMedia('(max-width: 760px)');
const root = document.documentElement;
const hero = $('.hero');
const heroStage = $('.hero-stage');
const heroCopy = $('.hero-copy');
const heroWordmark = $('.hero-wordmark');
const heroSecond = $('.hero-scroll-copy');
const filmTeaser = $('.film-teaser');
const world = $('.world');
const worldStage = $('.world-stage');
const filmSurface = $('.film-surface');
const filmMedia = $('.film-inline-video');
const filmPlay = $('.film-play');
const motionButton = $('.motion-control');
const filmDialog = $('.film-dialog');
const galleryDialog = $('.gallery-dialog');
const video = $('.film-video');
const footer = $('.site-footer');
const footerRows = $$('[data-footer-row]', footer);
const footerDrawings = $$('.footer-drawing', footer);
let scene;
let journeyScene;
let journeyLabels;
let journeyLoading;
let motionOff = mediaMotion.matches;
let naturalFlow = motionOff || shortViewport.matches;
let geometry = {};
let scrollFrame = 0;
let heroVisible = true;
let journeyVisible = false;
let activeWay = -1;
let viewRotation = 0;
let viewZoom = 1;
const bookThemes = ['forest', 'dusk', 'paper'];
let themeIndex = 0;
let galleryIndex = 0;
let returnFocus = null;
let filmAutoplayActive = false;
root.classList.add('js-ready');

function measure() {
  setExperienceMode();
  // Compensate for raster downscaling so each drawing matches the 50% 1px rules.
  footerDrawings.forEach(drawing => {
    const ratio = Number(drawing.getAttribute('width')) / Number(drawing.getAttribute('height'));
    const width = Math.min(drawing.clientWidth, drawing.clientHeight * ratio);
    if (width > 0) drawing.style.setProperty('--footer-ink-opacity', clamp(Number(drawing.dataset.inkWidth) / width).toFixed(3));
  });
  const top = element => element.getBoundingClientRect().top + scrollY;
  const filmInlineHeight = filmSurface.style.height;
  filmSurface.style.height = '';
  const filmBaseHeight = filmSurface.offsetHeight;
  filmSurface.style.height = filmInlineHeight;
  geometry = {
    hero: top(hero), heroRange: Math.max(1, hero.offsetHeight - heroStage.offsetHeight),
    world: top(world), worldRange: Math.max(1, world.offsetHeight - worldStage.offsetHeight * 2),
    curtain: top($('#experience')),
    film: top(filmSurface), filmHeight: filmBaseHeight,
    filmInset: parseFloat(getComputedStyle($('.film')).paddingLeft),
    experience: top(experienceScroll),
    wayTop: parseFloat(getComputedStyle(experienceScroll).getPropertyValue('--way-top')),
    wayRange: Math.max(1, experienceScroll.offsetHeight - experienceGrid.offsetHeight),
    ways: wayPanels.map(panel => ({top: top(panel), imageTop: top($('.way-image', panel))})),
    footer: top(footer),
    footerRows: footerRows.map(row => ({top: top(row), height: row.offsetHeight})),
    dark: $$('[data-dark]').map(element => ({top: top(element), bottom: top(element) + element.offsetHeight}))
  };
  scheduleScroll();
}
function updateScroll() {
  scrollFrame = 0;
  const p = naturalFlow ? 0 : clamp((scrollY - geometry.hero) / geometry.heroRange);
  const fade = 1 - smooth((p - .12) / .33);
  heroCopy.style.opacity = fade;
  heroCopy.style.transform = 'translateY(' + (-p * 45) + 'px)';
  heroCopy.inert = fade < .15;
  heroWordmark.style.opacity = 1 - smooth(p / .7);
  heroWordmark.style.transform = 'translateY(' + (-p * 100) + 'px)';
  heroSecond.style.opacity = naturalFlow ? 0 : smooth((p - .42) / .25);
  heroSecond.style.transform = 'translateY(' + ((1 - smooth((p - .4) / .4)) * 25) + 'px)';
  filmTeaser.style.opacity = 1 - smooth((p - .25) / .25);
  filmTeaser.inert = p > .48 && !naturalFlow;
  scene?.setProgress(p);
  hero.dataset.progress = p.toFixed(3);

  const journeyP = naturalFlow ? 1 : clamp((scrollY - geometry.world) / geometry.worldRange);
  const step = Math.min(2, Math.floor(journeyP / .84 * 3));
  $('.world-progress > span').style.transform = 'scaleX(' + journeyP + ')';
  journeyScene?.setProgress(journeyP);
  world.dataset.progress = journeyP.toFixed(3);
  world.dataset.step = step;
  updateExperience();
  const filmP = clamp((scrollY + innerHeight - geometry.film) / (innerHeight + geometry.filmHeight));
  const filmTop = geometry.film - scrollY;
  const filmExpand = naturalFlow ? 1 : smooth((innerHeight * .78 - filmTop) / (innerHeight * .58));
  const filmExpandX = geometry.filmInset * filmExpand;
  filmSurface.style.marginLeft = -filmExpandX + 'px';
  filmSurface.style.width = 'calc(100% + ' + (filmExpandX * 2) + 'px)';
  filmSurface.style.transform = 'scale(' + (.86 + filmExpand * .14).toFixed(4) + ')';
  filmSurface.dataset.progress = filmExpand.toFixed(3);
  filmSurface.dataset.expanded = filmExpand > .97 ? 'true' : 'false';
  const filmTargetHeight = Math.max(geometry.filmHeight, document.documentElement.clientWidth * 9 / 16);
  filmSurface.style.height = (geometry.filmHeight + (filmTargetHeight - geometry.filmHeight) * filmExpand) + 'px';
  filmMedia.style.top = (-10 * (1 - filmExpand)) + '%';
  filmMedia.style.height = (120 - 20 * filmExpand) + '%';
  filmMedia.style.transform = motionOff ? 'none' : 'translateY(' + ((filmP - .5) * 85) + 'px) scale(1.03)';
  const filmCanPlay = filmTop < innerHeight && filmTop + geometry.filmHeight > 0 && !motionOff && !document.hidden && !filmDialog.open;
  setInlineFilmPlayback(filmCanPlay && filmExpand > (filmAutoplayActive ? .9 : .97));
  const header = $('.site-header');
  header.classList.toggle('is-journey', scrollY + 47 >= geometry.world && scrollY + 47 < geometry.curtain);
  header.classList.toggle('is-scrolled', scrollY > 30);
  header.classList.toggle('is-dark', geometry.dark?.some(section => scrollY + 47 >= section.top && scrollY + 47 < (section.top === geometry.world ? geometry.curtain : section.bottom)));
  header.classList.toggle('is-footer', scrollY + 47 >= geometry.footer);
  footerRows.forEach((row, index) => {
    const bounds = geometry.footerRows[index];
    const progress = naturalFlow ? 1 : smooth((scrollY + innerHeight * .92 - bounds.top) / Math.min(innerHeight * .38, bounds.height * .85));
    row.style.setProperty('--footer-progress', progress.toFixed(4));
  });
}
function scheduleScroll() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }
function setInlineFilmPlayback(active) {
  if (active === filmAutoplayActive) return;
  filmAutoplayActive = active;
  filmSurface.dataset.autoplay = active ? 'playing' : 'idle';
  if (active) {
    filmMedia.play().catch(() => {
      filmAutoplayActive = false;
      filmSurface.dataset.autoplay = 'blocked';
    });
  } else {
    filmMedia.pause();
    filmMedia.currentTime = 0;
  }
}
function refreshSceneEnabled() {
  const visible = !document.hidden && !filmDialog.open && !galleryDialog.open;
  scene?.setEnabled(heroVisible && visible);
  journeyScene?.setEnabled(journeyVisible && visible);
}
function loadJourney() {
  if (journeyLoading) return;
  world.dataset.journey = 'loading';
  journeyLoading = Promise.all([import('./clay-scene.js'), import('./journey-labels.js')]).then(([{createClayJourney}, {createJourneyLabels}]) => {
    journeyLabels = createJourneyLabels($('.journey-visual'));
    return createClayJourney($('#clay-journey'), {onLayout: layout => journeyLabels.setLayout(layout)});
  }).then(created => {
    journeyScene = created;
    journeyScene.setReducedMotion(naturalFlow);
    journeyLabels.setReducedMotion(naturalFlow);
    journeyScene.setProgress(Number(world.dataset.progress) || 0);
    refreshSceneEnabled();
    world.dataset.journey = 'ready';
    measure();
  }).catch(error => {
    world.dataset.journey = 'fallback';
    world.classList.add('is-still');
    console.warn('The clay journey is shown as a still image.', error);
  });
}
function applyMotion(preservePosition = false) {
  const previousTop = scrollY;
  const storyBounds = experienceScroll.getBoundingClientRect();
  const preserveWay = preservePosition && activeWay >= 0 && storyBounds.top <= 145 && storyBounds.bottom > 145;
  const previousWay = activeWay;
  const anchor = [...$$('main > section, .site-footer')].reverse().find(section => section.getBoundingClientRect().top <= 120) || hero;
  const relativeTop = anchor === world && !naturalFlow ? 0 : anchor.getBoundingClientRect().top;
  naturalFlow = motionOff || shortViewport.matches;
  root.classList.toggle('motion-off', motionOff);
  root.classList.toggle('natural-flow', naturalFlow);
  setExperienceMode();
  motionButton.setAttribute('aria-pressed', String(motionOff));
  $('.motion-label').textContent = motionOff ? '모션 꺼짐' : '모션 켜짐';
  scene?.setReducedMotion(motionOff);
  journeyScene?.setReducedMotion(naturalFlow);
  journeyLabels?.setReducedMotion(naturalFlow);
  if (preservePosition) {
    const newTop = anchor.getBoundingClientRect().top + previousTop;
    scrollTo({top: Math.max(0, newTop - relativeTop), behavior: 'instant'});
  }
  measure();
  if (preserveWay) goToWay(previousWay, 'instant');
}
motionButton.addEventListener('click', () => { motionOff = !motionOff; applyMotion(true); });
mediaMotion.addEventListener('change', () => { motionOff = mediaMotion.matches; applyMotion(true); });
shortViewport.addEventListener('change', () => applyMotion(true));
addEventListener('scroll', scheduleScroll, {passive:true});
addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => { refreshSceneEnabled(); scheduleScroll(); });
new ResizeObserver(measure).observe(document.body);
new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting;
  refreshSceneEnabled();
}, {rootMargin: '120px'}).observe(hero);
new IntersectionObserver(entries => {
  journeyVisible = entries[0].isIntersecting;
  if (journeyVisible) loadJourney();
  refreshSceneEnabled();
}, {rootMargin: '300px'}).observe(world);
const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
}), {threshold: .12});
$$('.reveal').forEach(element => revealObserver.observe(element));

function setView(rotation = viewRotation, zoom = viewZoom) {
  viewRotation = clamp(rotation, -1, 1);
  viewZoom = clamp(zoom, .8, 1.2);
  scene?.setView(viewRotation, viewZoom);
  hero.dataset.rotation = viewRotation.toFixed(3);
}
const objectHit = $('.hero-object-hit');
let bookDrag = null;
objectHit.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  bookDrag = {x: event.clientX, y: event.clientY, rotation:viewRotation, active:false, id:event.pointerId};
});
objectHit.addEventListener('pointermove', event => {
  if (bookDrag) {
    const dx = event.clientX - bookDrag.x;
    const dy = event.clientY - bookDrag.y;
    if (!bookDrag.active && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      bookDrag.active = true;
      objectHit.setPointerCapture(event.pointerId);
      objectHit.classList.add('is-dragging');
    }
    if (bookDrag.active) {
      event.preventDefault();
      setView(bookDrag.rotation + dx / Math.max(180, innerWidth * .35));
      scene?.setPointer(0,0);
    }
  } else if (finePointer.matches && !motionOff) {
    const bounds = objectHit.getBoundingClientRect();
    scene?.setPointer((event.clientX-bounds.left)/bounds.width*2-1, (event.clientY-bounds.top)/bounds.height*2-1);
  }
});
function endBookDrag() { bookDrag = null; objectHit.classList.remove('is-dragging'); }
objectHit.addEventListener('pointerup', endBookDrag);
objectHit.addEventListener('pointercancel', endBookDrag);
objectHit.addEventListener('lostpointercapture', endBookDrag);
objectHit.addEventListener('pointerleave', () => { if (!bookDrag?.active) { endBookDrag(); scene?.setPointer(0,0); } });

const experienceScroll = $('.experience-scroll');
const experienceGrid = $('.experience-grid');
const wayLinks = $$('[data-way]');
const wayPanels = $$('.way-panel');
let experiencePinned;
let wayExitTimer;

function setExperienceMode() {
  const pinned = !mobile.matches && !naturalFlow;
  if (pinned === experiencePinned) return;
  experiencePinned = pinned;
  root.classList.toggle('experience-pinned', pinned);
  experienceScroll.dataset.mode = pinned ? 'pinned' : 'flow';
  clearTimeout(wayExitTimer);
  activeWay = -1;
  wayPanels.forEach(panel => {
    panel.classList.remove('is-current', 'is-leaving', 'is-revealed');
    panel.inert = pinned;
    if (pinned) panel.setAttribute('aria-hidden', 'true');
    else panel.removeAttribute('aria-hidden');
  });
}
function activateWay(index) {
  if (index === activeWay) return;
  const previous = activeWay;
  activeWay = index;
  experienceScroll.dataset.step = String(index);
  experienceScroll.dataset.direction = index < previous ? 'back' : 'forward';
  wayLinks.forEach((link, i) => {
    if (i === index) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  });
  if (!experiencePinned) return;
  clearTimeout(wayExitTimer);
  wayPanels.forEach((panel, i) => {
    panel.classList.remove('is-current', 'is-leaving', 'is-revealed');
    panel.inert = i !== index;
    panel.setAttribute('aria-hidden', String(i !== index));
    if (i === previous && previous !== index) panel.classList.add('is-leaving');
  });
  // Restart an interrupted entrance when reversing or skipping several sections.
  void wayPanels[index].offsetWidth;
  wayPanels[index].classList.add('is-current', 'is-revealed');
  wayExitTimer = setTimeout(() => wayPanels.forEach(panel => panel.classList.remove('is-leaving')), 1400);
}
function updateExperience() {
  if (!geometry.ways) return;
  if (experiencePinned) {
    const start = geometry.experience - geometry.wayTop;
    const progress = clamp((scrollY - start) / geometry.wayRange);
    if (geometry.experience - scrollY < innerHeight * .78) {
      activateWay(Math.min(wayPanels.length - 1, Math.floor(progress * wayPanels.length)));
    } else if (activeWay !== -1) {
      clearTimeout(wayExitTimer);
      activeWay = -1;
      wayPanels.forEach(panel => panel.classList.remove('is-current', 'is-leaving', 'is-revealed'));
    }
    experienceScroll.dataset.progress = progress.toFixed(3);
  } else {
    const focusLine = geometry.wayTop + (mobile.matches ? $('.experience-menu').offsetHeight : 0) + innerHeight * .22;
    let index = 0;
    geometry.ways.forEach((bounds, i) => {
      const top = bounds.top - scrollY;
      if (top <= focusLine) index = i;
      const entrance = mobile.matches ? bounds.imageTop - scrollY < innerHeight * .9 : top < innerHeight * .8;
      if (motionOff || entrance) wayPanels[i].classList.add('is-revealed');
      else if (top > innerHeight) wayPanels[i].classList.remove('is-revealed');
    });
    activateWay(index);
  }
}
function goToWay(index, behavior = motionOff ? 'instant' : 'smooth') {
  measure();
  index = (index + wayPanels.length) % wayPanels.length;
  const top = experiencePinned
    ? geometry.experience - geometry.wayTop + (index + .12) * geometry.wayRange / wayPanels.length
    : geometry.ways[index].top - geometry.wayTop - (mobile.matches ? $('.experience-menu').offsetHeight + 16 : 16);
  scrollTo({top, behavior});
}
wayLinks.forEach((link, index) => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.replaceState(null, '', link.hash);
    goToWay(index);
  });
  link.addEventListener('keydown', event => {
    const next = {ArrowDown:index+1, ArrowRight:index+1, ArrowUp:index-1, ArrowLeft:index-1, Home:0, End:wayLinks.length-1}[event.key];
    if (next !== undefined) {
      event.preventDefault();
      const index = (next + wayLinks.length) % wayLinks.length;
      wayLinks[index].focus({preventScroll:true});
      history.replaceState(null, '', wayLinks[index].hash);
      goToWay(index);
    }
  });
});
function followWayHash() {
  const index = wayPanels.findIndex(panel => '#' + panel.id === location.hash);
  if (index !== -1) goToWay(index, 'instant');
}
addEventListener('hashchange', followWayHash);
mobile.addEventListener('change', measure);

const rail = $('.scene-rail');
const cards = $$('.scene-card');
const railButtons = $$('[data-rail]');
function updateRail() {
  const maximum = rail.scrollWidth - rail.clientWidth;
  const progress = maximum > 0 ? clamp(rail.scrollLeft / maximum) : 0;
  $('.rail-count').textContent = String(Math.round(progress * 3) + 1).padStart(2,'0') + ' / 04';
  $('.rail-meter > span').style.transform = 'translateX(' + progress * 300 + '%)';
  railButtons[0].disabled = rail.scrollLeft < 2;
  railButtons[1].disabled = rail.scrollLeft > maximum - 2;
}
function stepRail(direction) {
  const step = cards[1].offsetLeft - cards[0].offsetLeft;
  rail.scrollBy({left: step * direction, behavior: motionOff ? 'instant' : 'smooth'});
}
railButtons.forEach(button => button.addEventListener('click', () => stepRail(Number(button.dataset.rail))));
rail.addEventListener('scroll', updateRail, {passive:true});
rail.addEventListener('keydown', event => {
  if (event.target !== rail) return;
  if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault();
    if (event.key==='Home' || event.key==='End') rail.scrollTo({left:event.key==='Home'?0:rail.scrollWidth,behavior:motionOff?'instant':'smooth'});
    else stepRail(event.key==='ArrowRight'?1:-1);
  }
});
let railDrag = null;
let suppressRailClick = false;
rail.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  suppressRailClick = false;
  railDrag = {x:event.clientX, left:rail.scrollLeft, id:event.pointerId, active:false};
});
rail.addEventListener('pointermove', event => {
  if (!railDrag) return;
  const dx = event.clientX - railDrag.x;
  if (!railDrag.active && Math.abs(dx)>6) {
    railDrag.active = true;
    rail.setPointerCapture(event.pointerId);
    rail.classList.add('is-dragging');
  }
  if (railDrag.active) { event.preventDefault(); rail.scrollLeft = railDrag.left - dx; }
});
function endRailDrag() {
  suppressRailClick = !!railDrag?.active;
  railDrag = null;
  rail.classList.remove('is-dragging');
  if (suppressRailClick) setTimeout(() => { suppressRailClick = false; },0);
}
rail.addEventListener('pointerup',endRailDrag);
rail.addEventListener('pointercancel',endRailDrag);
rail.addEventListener('lostpointercapture',() => { if(railDrag) endRailDrag(); });
rail.addEventListener('click', event => { if(suppressRailClick) { event.preventDefault(); event.stopImmediatePropagation(); } },true);
new ResizeObserver(updateRail).observe(rail);

function openDialog(dialog, trigger) {
  returnFocus = trigger;
  dialog.showModal();
  document.body.classList.add('has-dialog');
  refreshSceneEnabled();
}
function afterDialogClose() {
  document.body.classList.remove('has-dialog');
  video.pause();
  refreshSceneEnabled();
  returnFocus?.focus({preventScroll:true});
  returnFocus = null;
  scheduleScroll();
}
[filmDialog,galleryDialog].forEach(dialog => {
  dialog.addEventListener('close',afterDialogClose);
  dialog.addEventListener('click',event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
  });
});
$$('[data-film-open]').forEach(button => button.addEventListener('click', () => {
  setInlineFilmPlayback(false);
  if (!video.getAttribute('src')) video.src = trailerUrl;
  openDialog(filmDialog,button);
  video.play().catch(() => {});
}));
$('[data-film-close]').addEventListener('click',() => filmDialog.close());
const galleryItems = cards.map(card => ({
  src: $('img',card).getAttribute('src'), alt:$('img',card).alt,
  title:$('h3',card).textContent, caption:$('figcaption p',card).textContent
}));
function showGallery(index) {
  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[galleryIndex];
  $('.gallery-large').src = item.src;
  $('.gallery-large').alt = item.alt;
  $('#gallery-heading').textContent = item.title;
  $('.gallery-caption').textContent = item.caption;
  $('.gallery-count').textContent = String(galleryIndex+1).padStart(2,'0')+' / 04';
}
$$('[data-gallery-open]').forEach(button => button.addEventListener('click', () => {
  showGallery(Number(button.dataset.galleryOpen));
  openDialog(galleryDialog,button);
}));
$('[data-gallery-close]').addEventListener('click',() => galleryDialog.close());
$$('[data-gallery-step]').forEach(button => button.addEventListener('click',() => showGallery(galleryIndex+Number(button.dataset.galleryStep))));
galleryDialog.addEventListener('keydown',event => {
  if(['ArrowLeft','ArrowRight'].includes(event.key)) {event.preventDefault();showGallery(galleryIndex+(event.key==='ArrowRight'?1:-1));}
});
filmSurface.addEventListener('pointermove', event => {
  if(motionOff || !finePointer.matches) return;
  const rect = filmSurface.getBoundingClientRect();
  filmPlay.style.translate = ((event.clientX - rect.left - rect.width/2)*.055)+'px '+((event.clientY-rect.top-rect.height/2)*.055)+'px';
});
filmSurface.addEventListener('pointerleave', () => {filmPlay.style.translate='0 0';});
filmMedia.addEventListener('ended', () => {
  filmAutoplayActive = false;
  filmSurface.dataset.autoplay = 'ended';
});
applyMotion();
updateRail();
document.fonts.ready.then(() => { measure(); followWayHash(); });
import('./scene.js').then(({createBookScene}) => {
  scene = createBookScene($('#book-world'));
  scene.setTheme(bookThemes[themeIndex]);
  hero.dataset.theme = bookThemes[themeIndex];
  scene.setView(viewRotation,viewZoom);
  scene.setReducedMotion(motionOff);
  refreshSceneEnabled();
  root.classList.add('world-ready');
  hero.dataset.bookWorld = 'ready';
  scheduleScroll();
  setInterval(() => {
    themeIndex = (themeIndex + 1) % bookThemes.length;
    scene.setTheme(bookThemes[themeIndex]);
    hero.dataset.theme = bookThemes[themeIndex];
  }, 2000);
}).catch(error => {
  hero.dataset.bookWorld='fallback';
  console.warn('3D book preview unavailable.', error);
  objectHit.hidden = true;
});
