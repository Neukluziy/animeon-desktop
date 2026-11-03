const { ipcRenderer } = require('electron');

let lastZoomAt = 0;
let lastScrollAt = 0;
let lastMediaState = '';
let lastTimeUpdateAt = 0;

function notifyScroll() {
  const now = Date.now();
  if (now - lastScrollAt < 80) return;
  lastScrollAt = now;
  ipcRenderer.sendToHost('site:scroll', {
    y: Math.max(0, window.scrollY || document.documentElement?.scrollTop || 0),
    direction: window.scrollY > (window.__animeonLastScrollY || 0) ? 'down' : 'up',
  });
  window.__animeonLastScrollY = window.scrollY;
}

function reportMediaState() {
  const media = Array.from(document.querySelectorAll('video,audio'));
  const activeMedia = media.find((item) => !item.paused && !item.ended)
    || media.find((item) => item instanceof HTMLVideoElement)
    || media[0];
  const state = {
    playing: media.some((item) => !item.paused && !item.ended),
    audible: media.some((item) => !item.paused && !item.ended && !item.muted && item.volume > 0),
    complete: document.querySelectorAll('iframe').length === 0,
    currentTime: Number.isFinite(activeMedia?.currentTime) ? activeMedia.currentTime : null,
    playbackRate: Number.isFinite(activeMedia?.playbackRate) ? activeMedia.playbackRate : null,
    volume: Number.isFinite(activeMedia?.volume) ? activeMedia.volume : null,
    muted: activeMedia?.muted ?? null,
  };
  const serialized = JSON.stringify(state);
  if (serialized === lastMediaState) return;
  lastMediaState = serialized;
  ipcRenderer.sendToHost('site:media-state', state);
}

function observeMediaElement(element) {
  if (element.__animeonMediaObserved) return;
  element.__animeonMediaObserved = true;
  for (const eventName of ['play', 'pause', 'ended', 'seeked', 'ratechange', 'volumechange', 'loadedmetadata']) {
    element.addEventListener(eventName, reportMediaState);
  }
  element.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastTimeUpdateAt < 1500) return;
    lastTimeUpdateAt = now;
    reportMediaState();
  });
}

function observeMediaTree(root) {
  if (root instanceof HTMLMediaElement) observeMediaElement(root);
  root.querySelectorAll?.('video,audio').forEach(observeMediaElement);
  reportMediaState();
}

window.addEventListener('scroll', notifyScroll, { passive: true });
document.querySelectorAll('video,audio').forEach(observeMediaElement);
new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof Element) observeMediaTree(node);
    }
    if (record.removedNodes.length) reportMediaState();
  }
}).observe(document, { childList: true, subtree: true });
reportMediaState();

window.addEventListener('wheel', (event) => {
  if (!event.ctrlKey) return;
  event.preventDefault();

  const now = Date.now();
  if (now - lastZoomAt < 100) return;
  lastZoomAt = now;

  ipcRenderer.sendToHost('site:ctrl-wheel-zoom', event.deltaY < 0 ? 0.1 : -0.1);
}, { capture: true, passive: false });
