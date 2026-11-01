const { ipcRenderer } = require('electron');

let lastZoomAt = 0;

window.addEventListener('wheel', (event) => {
  if (!event.ctrlKey) return;
  event.preventDefault();

  const now = Date.now();
  if (now - lastZoomAt < 100) return;
  lastZoomAt = now;

  ipcRenderer.sendToHost('site:ctrl-wheel-zoom', event.deltaY < 0 ? 0.1 : -0.1);
}, { capture: true, passive: false });
