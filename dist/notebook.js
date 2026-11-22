// A two-colour ginkgo engraving, using the same leaf outline as the field plates.
(() => {
  function printGinkgo(canvas) {
    canvas.width = 600;
    canvas.height = 640;
    const pen = canvas.getContext('2d');
    if (!pen) return;
    pen.scale(2, 2);
    pen.lineCap = 'round';
    const leaf = leafPath(0);
    function stem(x, y, cx, cy, endX, endY, width) {
      pen.beginPath();
      pen.moveTo(x, y);
      pen.quadraticCurveTo(cx, cy, endX, endY);
      pen.lineWidth = width;
      pen.strokeStyle = '#ccb788';
      pen.stroke();
    }
    function fan(x, y, angle, size) {
      pen.save();
      pen.translate(x, y);
      pen.rotate(angle);
      pen.scale(size, size);
      pen.fillStyle = '#39594b';
      pen.fill(leaf);
      pen.strokeStyle = '#deca99';
      pen.lineWidth = 1.25;
      pen.stroke(leaf);
      pen.clip(leaf);
      for (let n = -12; n <= 12; n++) {
        const dx = n * 5.3, dy = -94 + Math.abs(n) * 1.9;
        stem(0, 0, dx * .26, -27, dx, dy, .64);
        stem(dx * .4, dy * .5, dx * .65 + 2, dy * .76, dx + 3, dy, .44);
      }
      pen.restore();
    }
    stem(69, 328, 125, 264, 175, 71, 2.8);
    stem(114, 248, 78, 205, 57, 188, 1.65);
    stem(137, 192, 175, 176, 198, 158, 1.6);
    stem(157, 132, 132, 113, 118, 95, 1.3);
    stem(169, 96, 193, 77, 200, 59, 1.2);
    fan(57, 188, -.73, .68);
    fan(198, 158, .91, .82);
    fan(118, 95, -.56, .66);
    fan(200, 59, .54, .55);
    fan(174, 74, -.16, .48);
  }

  const intro = document.getElementById('bookIntro');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const seenKey = 'flora.notebook.opened';
  let timer;
  function closeBook() {
    clearTimeout(timer);
    if (intro.open) intro.close();
  }
  function openBook() {
    if (intro.open || typeof intro.showModal !== 'function') return;
    intro.showModal();
    try { sessionStorage.setItem(seenKey, '1'); } catch { /* storage is optional */ }
    // Fallback if the browser suppresses animationend, e.g. on a background tab.
    timer = setTimeout(closeBook, motion.matches ? 1100 : 2500);
  }
  document.getElementById('skipIntro').onclick = closeBook;
  intro.addEventListener('animationend', event => {
    if (event.target === intro && event.animationName === 'notebook-exit') closeBook();
  });
  intro.addEventListener('close', () => clearTimeout(timer));
  window.addEventListener('pagehide', closeBook);
  window.addEventListener('hashchange', closeBook);
  motion.addEventListener('change', () => { if (motion.matches) closeBook(); });
  printGinkgo(document.getElementById('coverPrint'));
  let seen = false;
  try { seen = sessionStorage.getItem(seenKey) === '1'; } catch { /* file preview */ }
  if (!seen && !location.hash && !motion.matches) openBook();
  document.addEventListener('DOMContentLoaded', () => {
    printGinkgo(document.getElementById('fieldPrint'));
    document.getElementById('replayIntro').onclick = openBook;
  });
})();
