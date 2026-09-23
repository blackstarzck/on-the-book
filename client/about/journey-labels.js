export function createJourneyLabels(figure) {
  const stage = figure.querySelector('.journey-stage');
  const notes = [...figure.querySelectorAll('.world-note')];
  let layout;
  let reducedMotion = false;

  function place() {
    if (!layout || reducedMotion) return;
    const stageBox = stage.getBoundingClientRect();
    const figureBox = figure.getBoundingClientRect();
    const compact = innerWidth <= 760;
    notes.forEach((note, index) => {
      const photo = layout.photos[index];
      const opacity = index === layout.activeStep && photo.visible ? photo.caption || 0 : 0;
      if (opacity > 0) {
        const right = stageBox.left - figureBox.left + (photo.rect.x + photo.rect.width) * stageBox.width;
        const center = stageBox.top - figureBox.top + (photo.rect.y + photo.rect.height * .42) * stageBox.height;
        note.style.left = `${(right + (compact ? 14 : 28)).toFixed(2)}px`;
        note.style.top = `${(center - note.offsetHeight / 2).toFixed(2)}px`;
      }
      note.style.setProperty('--caption-opacity', opacity.toFixed(4));
      note.classList.toggle('is-active', opacity > 0);
      note.setAttribute('aria-hidden', String(opacity === 0));
    });
  }

  return {
    setLayout(next) { layout = next; place(); },
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
      notes.forEach(note => {
        note.style.setProperty('--caption-opacity', reducedMotion ? '1' : '0');
        note.classList.toggle('is-active', reducedMotion);
        note.setAttribute('aria-hidden', String(!reducedMotion));
      });
      if (!reducedMotion) place();
    },
  };
}
