const { app, BrowserWindow, ipcMain, shell, Tray, Notification, screen, globalShortcut, session, dialog, nativeImage, clipboard } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const { SITE_RE, AUTH_RE, TELEGRAM_RE, APP_VERSION, compareVersions } = require('./modules');

const configPath = path.join(app.getPath('userData'), 'config.json');
const screenshotsDir = path.join(app.getPath('pictures'), 'AnimeOn');

function ensureScreenshotsDir() {
  try { fs.mkdirSync(screenshotsDir, { recursive: true }); } catch {}
}

function isInScreenshotsDir(p) {
  try {
    const resolved = path.resolve(String(p || ''));
    const rel = path.relative(screenshotsDir, resolved);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
let config = {
  theme: 'violet',
  custom: '#8b5cf6',
  site: '',
  remember: '0',
  notify: false,
  autostart: false,
  tray: false,
  compact: false,
  confirmClose: false,
  autoRecovery: true,
  performance: 'balanced',
  lowPower: false,
  autoHide: true,
  closeBehavior: 'ask',
  alwaysOnTop: false,
  hotkeys: {},
  customCss: { cc: '', co: '' },
  smoothSite: true,
  visual: { radius: 18, opacity: 92, blur: 0, scale: 100, density: 100, accentGlow: 70, animations: 'smooth' },
  profiles: {},
  lastUrl: '',
  history: [],
  favorites: [],
};

try {
  Object.assign(config, JSON.parse(fs.readFileSync(configPath, 'utf8')));
} catch {}
if (!config.customCss || typeof config.customCss !== 'object') config.customCss = { cc: '', co: '' };
if (typeof config.smoothSite !== 'boolean') config.smoothSite = true;
if (!config.visual || typeof config.visual !== 'object') config.visual = { radius:18, opacity:92, blur:0, scale:100, density:100, accentGlow:70, animations:'smooth' };
if (Number(config.visual.blur) === 18) config.visual.blur = 0;
if (!config.profiles || typeof config.profiles !== 'object') config.profiles = {};
if (!Array.isArray(config.history)) config.history = [];
if (!Array.isArray(config.favorites)) config.favorites = [];
if (typeof config.lastUrl !== 'string') config.lastUrl = '';

function buildVisualCss() {
  const v = config.visual || {};
  const radius = Number.isFinite(Number(v.radius)) ? Number(v.radius) : 18;
  const opacity = (Number.isFinite(Number(v.opacity)) ? Number(v.opacity) : 96) / 100;
  const blur = Number.isFinite(Number(v.blur)) ? Number(v.blur) : 0;
  const scale = (Number.isFinite(Number(v.scale)) ? Number(v.scale) : 100) / 100;
  const density = (Number.isFinite(Number(v.density)) ? Number(v.density) : 100) / 100;
  const glow = (Number.isFinite(Number(v.accentGlow)) ? Number(v.accentGlow) : 55) / 100;
  const animations = ['off','smooth','cinematic'].includes(v.animations) ? v.animations : 'smooth';
  const transition = animations === 'cinematic' ? '620ms cubic-bezier(.16,1,.3,1)' : animations === 'smooth' ? '360ms cubic-bezier(.22,1,.36,1)' : '0ms';
  const motion = animations !== 'off' ? `button,a,input,select,textarea,[role=button]{transition:transform var(--animeon-transition),opacity var(--animeon-transition),box-shadow var(--animeon-transition),background-color var(--animeon-transition),border-color var(--animeon-transition),color var(--animeon-transition)!important}` : '';
  const safeScale = scale === 1 ? '' : `body{zoom:${scale}}`;
  const panel = blur > 0 ? `.animeon-theme-surface{backdrop-filter:blur(${blur}px) saturate(115%);-webkit-backdrop-filter:blur(${blur}px);background-color:rgba(24,20,31,${opacity})}` : '';
  const densityRules = density === 1 ? '' : `.animeon-theme-density{--animeon-density:${density}}`;
  const glowRules = glow > 0 ? `.animeon-theme-glow{box-shadow:0 8px ${Math.round(26*glow)}px rgba(var(--animeon-accent-rgb,139,92,246),${(.20*glow).toFixed(3)})!important}` : '';
  return `:root{--animeon-radius:${radius}px;--animeon-alpha:${opacity};--animeon-blur:${blur}px;--animeon-density:${density};--animeon-transition:${transition};--animeon-glow:${glow}}html{scroll-behavior:${config.smoothSite !== false ? 'smooth' : 'auto'}!important;scroll-padding-top:12px}${safeScale}${motion}${panel}${densityRules}${glowRules}*{scrollbar-width:thin}`;
}

function saveConfig() {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch {}
}

function applySideEffects(patch) {
  if ('autostart' in patch) {
    try { app.setLoginItemSettings({ openAtLogin: !!config.autostart, path: process.execPath, args: [] }); } catch {}
  }
  if ('tray' in patch) ensureTray();
  if ('alwaysOnTop' in patch && win && !win.isDestroyed()) win.setAlwaysOnTop(!!config.alwaysOnTop);
  if ('hotkeys' in patch) registerGlobalHotkeys();
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let quitting = false;
let tray = null;
let trayMenuWin = null;
let telegramWin = null;
let siteWc = null;
let volumeState = { volume: 100, muted: false };

app.on('second-instance', (_, argv) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (argv.includes('--settings')) win.webContents.send('open-settings');
  if (argv.includes('--reload')) win.webContents.send('restart-webview');
});

function loadWindowState() {
  const defaults = { width: 1360, height: 850, x: undefined, y: undefined, maximized: false };
  try {
    const p = path.join(app.getPath('userData'), 'window-state.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ...defaults, ...data };
  } catch { return defaults; }
}

function saveWindowState() {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
  try {
    const bounds = win.getNormalBounds();
    fs.writeFileSync(path.join(app.getPath('userData'), 'window-state.json'), JSON.stringify({
      width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y,
      maximized: win.isMaximized(),
    }));
  } catch {}
}

function openTelegramExternal(url) {
  if (!url) return;
  if (/^tg:/i.test(url)) {
    try { shell.openExternal(url).catch?.(() => {}); } catch {}
    return;
  }
  if (!TELEGRAM_RE.test(url)) return;
  createTelegramWindow(url);
}

function createTelegramWindow(url) {
  if (telegramWin && !telegramWin.isDestroyed()) {
    telegramWin.show();
    telegramWin.focus();
    if (url && telegramWin.webContents.getURL() !== url) telegramWin.loadURL(url);
    return;
  }
  telegramWin = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 420,
    minHeight: 620,
    parent: win && !win.isDestroyed() ? win : undefined,
    modal: false,
    show: false,
    backgroundColor: '#111111',
    icon: path.join(__dirname, '../assets', 'logo.ico'),
    title: 'Telegram — AnimeOn',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  telegramWin.setMenuBarVisibility(false);
  telegramWin.once('ready-to-show', () => {
    if (!telegramWin || telegramWin.isDestroyed()) return;
    telegramWin.show();
    telegramWin.focus();
  });
  telegramWin.webContents.setWindowOpenHandler(({ url: childUrl }) => {
    if (/^tg:/i.test(childUrl)) {
      try { shell.openExternal(childUrl).catch?.(() => {}); } catch {}
      return { action: 'deny' };
    }
    if (TELEGRAM_RE.test(childUrl)) {
      telegramWin.loadURL(childUrl);
      return { action: 'deny' };
    }
    if (/^https?:\/\//i.test(childUrl)) {
      try { shell.openExternal(childUrl).catch?.(() => {}); } catch {}
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });
  telegramWin.webContents.on('will-navigate', (event, targetUrl) => {
    if (/^tg:/i.test(targetUrl)) {
      event.preventDefault();
      try { shell.openExternal(targetUrl).catch?.(() => {}); } catch {}
      return;
    }
  });
  telegramWin.on('closed', () => { telegramWin = null; });
  telegramWin.loadURL(url);
}

function createWindow() {
  const ws = loadWindowState();
  win = new BrowserWindow({
    width: ws.width,
    height: ws.height,
    x: Number.isFinite(ws.x) ? ws.x : undefined,
    y: Number.isFinite(ws.y) ? ws.y : undefined,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#0a0a0a',
    frame: false,
    show: false,
    icon: path.join(__dirname, '../assets', 'logo.ico'),
    title: 'AnimeOn',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(!!config.alwaysOnTop);
  win.loadFile(path.join(__dirname, '../index.html'));
  if (ws.maximized) win.maximize();

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const isDevToolsCombo = input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i');
    if (!isDevToolsCombo) return;
    try {
      if (win.webContents.isDevToolsOpened()) { win.webContents.closeDevTools(); e.preventDefault(); return; }
      try {
        win.webContents.openDevTools({ mode: 'detach', activate: true });
      } catch {
        try { win.webContents.openDevTools({ mode: 'right', activate: true }); }
        catch { win.webContents.toggleDevTools(); }
      }
    } catch {}
    e.preventDefault();
  });

  win.webContents.on('unresponsive', () => {
    console.error('[AnimeOn] Главное окно перестало отвечать (зависший рендерер).');
  });
  win.webContents.on('responsive', () => {
    console.error('[AnimeOn] Главное окно снова отвечает.');
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[AnimeOn] Рендерер главного окна упал:', details && details.reason);
    if (config.autoRecovery && win && !win.isDestroyed()) {
      try { win.loadFile(path.join(__dirname, '../index.html')); } catch {}
    }
  });
  let boundsSaveTimer = null;
  const saveBounds = () => {
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => saveWindowState(), 180);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('unmaximize', saveBounds);
  win.on('maximize', saveBounds);

  const ua = win.webContents.getUserAgent().replace(/\sElectron\/[\d.]+/i, '');
  win.webContents.session.setUserAgent(ua, 'ru-RU,ru');

  win.on('maximize', () => win.webContents.send('win-state', true));
  win.on('unmaximize', () => win.webContents.send('win-state', false));
  win.on('enter-full-screen', () => win.webContents.send('fs-state', true));
  win.on('leave-full-screen', () => win.webContents.send('fs-state', false));

  win.on('close', (e) => {
    if (!quitting && config.tray) {
      e.preventDefault();
      ensureTray();
      win.hide();
      return;
    }
    if (!quitting && config.closeBehavior === 'ask') {
      e.preventDefault();
      win.webContents.send('confirm-close');
      return;
    }
    if (!quitting && config.closeBehavior === 'tray') {
      e.preventDefault();
      ensureTray();
      win.hide();
      return;
    }
    saveWindowState();
  });

  setupJumpList();

  win.webContents.on('did-attach-webview', (_, wc) => {
    siteWc = wc;
    try { wc.setBackgroundThrottling(config.performance === 'economy'); } catch {}
    try { wc.setVisualZoomLevelLimits(0.5, 3); } catch {}
    wc.on('render-process-gone', () => {
      setTaskbarOverlay('error');
      if (config.autoRecovery && win && !win.isDestroyed()) {
        setTimeout(() => { try { wc.reload(); } catch {} }, 700);
      }
    });
    wc.on('dom-ready', async () => {
      try {
        const css = config.customCss && typeof config.customCss === 'object' ? String(config.customCss[config.site === 'co' ? 'co' : 'cc'] || '') : '';
        const injected = `${buildVisualCss()}\n${css}`;
        if (injected.trim()) {
          await wc.executeJavaScript(`(() => {
            const id='__animeon_custom_css__';
            let el=document.getElementById(id);
            if(!el){el=document.createElement('style');el.id=id;(document.head||document.documentElement).appendChild(el);}
            el.textContent=${JSON.stringify(injected)};
          })()`, true);
        const motion = buildMotionScript();
        if (motion) await wc.executeJavaScript(motion, true);
        }
      } catch {}
      try {
        const imgs = await wc.executeJavaScript(`Array.from(document.images).map(i=>i.currentSrc||i.src).filter(Boolean).filter(u=>/^https?:\/\//i.test(u)).slice(0,10)`, false);
        if (Array.isArray(imgs) && imgs.length) win?.webContents.send('mirror-posters', imgs);
      } catch {}
    });
    wc.on('did-frame-finish-load', () => { applyVolumeToGuest().catch(() => {}); });
    wc.on('will-navigate', (event, url) => {
      if (TELEGRAM_RE.test(url) || /^tg:/i.test(url)) {
        event.preventDefault();
        openTelegramExternal(url);
      }
    });
    wc.setWindowOpenHandler(({ url }) => {
      if (TELEGRAM_RE.test(url)) {
        openTelegramExternal(url);
        return { action: 'deny' };
      }

      const isAuth = AUTH_RE.test(url) || /\/(login|signin|auth|oauth)/i.test(url);

      if (isAuth) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 700,
            autoHideMenuBar: true,
            title: 'Вход в аккаунт',
            backgroundColor: '#0f0d14',
            icon: path.join(__dirname, '../assets', 'logo.ico'),
          },
        };
      }
      if (SITE_RE.test(url)) {
        wc.loadURL(url);
        return { action: 'deny' };
      }
      if (/^tg:/i.test(url)) {
        openTelegramExternal(url);
        return { action: 'deny' };
      }
      if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch?.(() => {});
      return { action: 'deny' };
    });

    wc.on('did-create-window', (childWin) => {
      let sawAuth = false;
      const checkNav = (_, u) => {
        if (AUTH_RE.test(u) || /\/(login|signin|auth|oauth|telegram)/i.test(u)) sawAuth = true;
        else if (SITE_RE.test(u) && sawAuth) {
          setTimeout(() => {
            if (!childWin.isDestroyed()) childWin.close();
            wc.reload();
          }, 700);
        }
      };
      childWin.webContents.on('did-navigate', checkNav);
      childWin.webContents.on('did-navigate-in-page', checkNav);
      childWin.webContents.setWindowOpenHandler(({ url }) => {
        if (TELEGRAM_RE.test(url)) {
          shell.openExternal(url).catch?.(() => {});
          return { action: 'deny' };
        }
        if (AUTH_RE.test(url) || /\/(login|signin|auth|oauth|telegram)/i.test(url)) return { action: 'allow' };
        if (SITE_RE.test(url)) { wc.loadURL(url); return { action: 'deny' }; }
        if (/^tg:/i.test(url)) {
          openTelegramExternal(url);
          return { action: 'deny' };
        }
        if (/^https?:\/\//i.test(url)) { shell.openExternal(url).catch?.(() => {}); return { action: 'deny' }; }
        return { action: 'deny' };
      });
      childWin.on('closed', () => {
        if (sawAuth && !wc.isDestroyed()) {
          setTimeout(() => { try { wc.reload(); } catch {} }, 500);
        }
      });
    });

    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F5') { wc.reload(); e.preventDefault(); }
      else if (input.control && input.key.toLowerCase() === 'r') { wc.reload(); e.preventDefault(); }
      else if (input.control && (input.key === '+' || input.key === '=')) {
        const z = Math.min(3, wc.getZoomFactor() + 0.1);
        wc.setZoomFactor(z);
        e.preventDefault();
      }
      else if (input.control && (input.key === '-' || input.key === '_')) {
        const z = Math.max(0.5, wc.getZoomFactor() - 0.1);
        wc.setZoomFactor(z);
        e.preventDefault();
      }
      else if (input.control && input.key === '0') {
        wc.setZoomFactor(1);
        e.preventDefault();
      }
      else if (input.key === 'F12') { try { if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools({ mode: 'detach', activate: true }); } catch { try { wc.toggleDevTools(); } catch {} } e.preventDefault(); }
      else if (input.alt && input.key === 'ArrowLeft') { wc.goBack(); e.preventDefault(); }
      else if (input.alt && input.key === 'ArrowRight') { wc.goForward(); e.preventDefault(); }
    });
  });
}

function getGuestFrames() {
  const guest = siteWc;
  if (!guest || guest.isDestroyed()) return [];
  try {
    return guest.mainFrame.framesInSubtree.filter(frame => frame && !frame.isDestroyed());
  } catch {
    return [];
  }
}

async function executeGuest(script, userGesture = false) {
  const frames = getGuestFrames();
  if (!frames.length) return null;
  const results = await Promise.all(frames.map(frame => {
    try { return frame.executeJavaScript(script, userGesture).catch(() => null); } catch { return null; }
  }));
  return results.find(result => result !== null && result !== undefined) ?? null;
}

async function applyVolumeToGuest() {
  const state = volumeState;
  const script = `(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return false;
    const level = ${state.volume};
    const muted = ${!!state.muted};
    window.__animeonVolume = level;
    for (const video of videos) {
      try {
        if (!video.__animeonGainContext) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) throw new Error('audio');
          const ctx = new Ctx();
          const source = ctx.createMediaElementSource(video);
          const gain = ctx.createGain();
          source.connect(gain);
          gain.connect(ctx.destination);
          video.__animeonGainContext = ctx;
          video.__animeonGainNode = gain;
        }
        if (video.__animeonGainContext.state === 'suspended') video.__animeonGainContext.resume().catch(() => {});
        video.volume = level <= 100 ? level / 100 : 1;
        video.__animeonGainNode.gain.value = level > 100 ? level / 100 : 1;
        video.muted = muted;
      } catch {
        video.volume = Math.min(1, level / 100);
        video.muted = muted;
      }
    }
    return true;
  })()`;
  await executeGuest(script, true);
}

async function setVolume(delta) {
  const change = Number(delta) || 0;
  volumeState.volume = Math.max(0, Math.min(200, volumeState.volume + change));
  await applyVolumeToGuest();
  return volumeState;
}

async function setMuted(value) {
  volumeState.muted = value === null ? !volumeState.muted : !!value;
  await applyVolumeToGuest();
  return volumeState;
}

function seekVideo(seconds) {
  return executeGuest(`(() => { const v = Array.from(document.querySelectorAll('video')); if (!v.length) return false; const active = v.find(x => !x.paused && !x.ended) || v[0]; active.currentTime = Math.max(0, Math.min(Number.isFinite(active.duration) ? active.duration : active.currentTime + ${Number(seconds)}, active.currentTime + ${Number(seconds)})); return true; })()`);
}

function mediaAction(action) {
  if (action === 'playpause') return togglePlayback();
  if (action === 'next') return executeGuest(`(() => { const selectors = ['[aria-label*=\"next\" i]','[title*=\"next\" i]','button[class*=\"next\" i]','a[class*=\"next\" i]']; const el = selectors.map(s => document.querySelector(s)).find(Boolean); if (el) { el.click(); return true; } const text = Array.from(document.querySelectorAll('button,a')).find(x => /следующ|next/i.test(x.innerText || x.getAttribute('aria-label') || x.title || '')); if (text) { text.click(); return true; } return false; })()`);
  if (action === 'previous') return executeGuest(`(() => { const selectors = ['[aria-label*=\"previous\" i]','[aria-label*=\"prev\" i]','[title*=\"previous\" i]','[title*=\"prev\" i]','button[class*=\"prev\" i]','a[class*=\"prev\" i]']; const el = selectors.map(s => document.querySelector(s)).find(Boolean); if (el) { el.click(); return true; } const text = Array.from(document.querySelectorAll('button,a')).find(x => /предыдущ|previous|prev/i.test(x.innerText || x.getAttribute('aria-label') || x.title || '')); if (text) { text.click(); return true; } return false; })()`);
}

function takeScreenshot() {
  if (!win || win.isDestroyed()) return;
  ensureScreenshotsDir();
  (async () => {
    try {
      const image = await win.capturePage();
      const filePath = path.join(screenshotsDir, `AnimeOn-${formatTimestamp()}.png`);
      fs.writeFileSync(filePath, image.toPNG());
      win.webContents.send('toast', { message: 'Скриншот сохранён' });
      win.webContents.send('screenshots:changed');
    } catch {}
  })();
}

function toggleAlwaysOnTop() {
  if (!win || win.isDestroyed()) return;
  config.alwaysOnTop = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(config.alwaysOnTop);
  saveConfig();
  win.webContents.send('always-on-top', config.alwaysOnTop);
}

function togglePlayback() {
  const guest = siteWc;
  if (!guest || guest.isDestroyed()) return;
  try {
    guest.executeJavaScript(`(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        if (!videos.length) return false;
        const active = videos.find(v => !v.paused && !v.ended) || videos[0];
        if (active.paused || active.ended) {
          const p = active.play();
          if (p?.catch) p.catch(() => {});
        } else {
          active.pause();
        }
        return true;
      })()`, false).catch(() => {});
  } catch {} 
}

function toggleTrayWindow() {
  if (!win) return;
  if (win.isVisible()) {
    if (config.tray) {
      ensureTray();
      win.hide();
    } else {
      win.hide();
    }
  } else {
    showMainWindow();
  }
}

function registerGlobalHotkeys() {
  globalShortcut.unregisterAll();
  const defaults = {
    show: 'Control+Alt+A',
    toggleWindow: 'Control+Alt+T',
    playPause: 'Control+Alt+P',
    volumeUp: 'Control+Alt+Up',
    volumeDown: 'Control+Alt+Down',
    mute: 'Control+Alt+M',
    seekBack: 'Control+Alt+Left',
    seekForward: 'Control+Alt+Right',
    fullscreen: 'Control+Alt+F',
    settings: 'Control+Alt+S',
    reload: 'Control+Alt+R',
    screenshot: 'Control+Alt+Shift+S',
    alwaysOnTop: 'Control+Alt+O',
    next: 'Control+Alt+PageDown',
    previous: 'Control+Alt+PageUp',
    trayMenu: 'Control+Alt+Y',
    command: 'Control+Alt+K',
    home: 'Control+Alt+H',
    back: 'Control+Alt+J',
    forward: 'Control+Alt+L',
    zoomIn: 'Control+Alt+=',
    zoomOut: 'Control+Alt+-',
    zoomReset: 'Control+Alt+0',
    switchSite: 'Control+Alt+W',
    openBrowser: 'Control+Alt+B',
  };
  const keys = { ...defaults, ...(config.hotkeys || {}) };
  const actions = {
    show: showMainWindow,
    toggleWindow: toggleTrayWindow,
    playPause: togglePlayback,
    volumeUp: () => setVolume(5),
    volumeDown: () => setVolume(-5),
    mute: () => setMuted(null),
    seekBack: () => seekVideo(-10),
    seekForward: () => seekVideo(10),
    fullscreen: () => { if (win) win.setFullScreen(!win.isFullScreen()); },
    settings: () => { showMainWindow(); win?.webContents.send('open-settings'); },
    reload: () => win?.webContents.send('restart-webview'),
    screenshot: takeScreenshot,
    alwaysOnTop: toggleAlwaysOnTop,
    next: () => mediaAction('next'),
    previous: () => mediaAction('previous'),
    trayMenu: toggleTrayMenu,
    command: () => { showMainWindow(); win?.webContents.send('open-command-palette'); },
    home: () => win?.webContents.send('go-home'),
    back: () => siteWc?.goBack(),
    forward: () => siteWc?.goForward(),
    zoomIn: () => siteWc && siteWc.setZoomFactor(Math.min(3, siteWc.getZoomFactor() + 0.1)),
    zoomOut: () => siteWc && siteWc.setZoomFactor(Math.max(0.5, siteWc.getZoomFactor() - 0.1)),
    zoomReset: () => siteWc?.setZoomFactor(1),
    switchSite: () => win?.webContents.send('switch-site'),
    openBrowser: () => siteWc && shell.openExternal(siteWc.getURL()),
  };
  const failed = [];
  const registered = [];
  const used = new Set();
  for (const [key, action] of Object.entries(actions)) {
    const accelerator = String(keys[key] || '').trim();
    if (!accelerator || typeof action !== 'function') continue;
    const normalized = accelerator.toLowerCase();
    if (used.has(normalized)) {
      failed.push({ key, accelerator, reason: 'duplicate' });
      continue;
    }
    used.add(normalized);
    try {
      if (globalShortcut.register(accelerator, action)) registered.push({ key, accelerator });
      else failed.push({ key, accelerator, reason: 'unavailable' });
    } catch (error) {
      failed.push({ key, accelerator, reason: String(error?.message || error) });
    }
  }
  try { globalShortcut.register('MediaPlayPause', () => mediaAction('playpause')); } catch {}
  try { globalShortcut.register('MediaNextTrack', () => mediaAction('next')); } catch {}
  try { globalShortcut.register('MediaPreviousTrack', () => mediaAction('previous')); } catch {}
  return { registered, failed };
}

function showMainWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function ensureTray() {
  if (!config.tray) {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }
  if (tray) return;
  tray = new Tray(path.join(__dirname, '../assets', 'logo.png'));
  tray.setToolTip('AnimeOn');
  tray.on('click', () => toggleTrayMenu());
  tray.on('double-click', () => showMainWindow());
  tray.on('right-click', () => toggleTrayMenu());
}

function setTaskbarOverlay(kind = 'none') {
  if (!win || win.isDestroyed()) return;
  try {
    const icon = kind === 'error' ? path.join(__dirname, '../assets', 'logo.png') : null;
    win.setOverlayIcon(icon, kind === 'error' ? 'Ошибка загрузки' : '');
  } catch {}
}

function setupJumpList() {
  if (!win || process.platform !== 'win32') return;
  try {
    win.setJumpList([
      { type: 'custom', name: 'AnimeOn', items: [
        { type: 'task', title: 'Открыть', program: process.execPath, args: '--show', iconPath: process.execPath, iconIndex: 0 },
        { type: 'task', title: 'Перезапустить страницу', program: process.execPath, args: '--reload', iconPath: process.execPath, iconIndex: 0 },
        { type: 'task', title: 'Настройки', program: process.execPath, args: '--settings', iconPath: process.execPath, iconIndex: 0 }
      ]}
    ]);
  } catch {}
}

function toggleTrayMenu() {
  if (trayMenuWin && trayMenuWin.isVisible()) {
    trayMenuWin.hide();
    return;
  }
  const [w, h] = [205, 177];
  const cursor = screen.getCursorScreenPoint();
  const trayBounds = tray && !tray.isDestroyed() ? tray.getBounds() : null;
  const anchor = trayBounds && trayBounds.width > 0 && trayBounds.height > 0
    ? { x: Math.round(trayBounds.x + trayBounds.width / 2), y: Math.round(trayBounds.y + trayBounds.height / 2), bottom: Math.round(trayBounds.y + trayBounds.height) }
    : { x: cursor.x, y: cursor.y, bottom: cursor.y };
  const wa = screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y }).workArea;
  const centeredX = Math.round(anchor.x - w / 2);
  const aboveY = Math.round(anchor.y - h - 8);
  const belowY = Math.round(anchor.bottom + 8);
  const x = Math.max(wa.x + 4, Math.min(centeredX, wa.x + wa.width - w - 4));
  const y = aboveY >= wa.y + 4 ? aboveY : Math.min(belowY, wa.y + wa.height - h - 4);
  trayMenuWin = new BrowserWindow({
    width: w,
    height: h,
    x,
    y,
    frame: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    hasShadow: false,
    show: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  trayMenuWin.setAlwaysOnTop(true, 'screen-saver');
  trayMenuWin.loadFile(path.join(__dirname, '../windows/tray.html'));
  trayMenuWin.once('ready-to-show', () => {
    trayMenuWin.show();
    trayMenuWin.focus();
  });
  trayMenuWin.on('blur', () => {
    if (trayMenuWin) trayMenuWin.hide();
  });
}

ipcMain.on('tray-action', (_, action) => {
  if (action === 'open') {
    showMainWindow();
  }
  if (action === 'hide') { if (win) win.hide(); }
  if (action === 'settings' && win) {
    showMainWindow();
    win.webContents.send('open-settings');
  }
  if (action === 'menu') { toggleTrayMenu(); }
  if (action === 'menu-reload') { if (siteWc && !siteWc.isDestroyed()) siteWc.reload(); }
  if (action === 'quit') {
    quitting = true;
    app.exit(0);
  }
});

ipcMain.on('cfg:get', (e) => {
  e.returnValue = config;
});

ipcMain.on('cfg:set', (_, patch) => {
  Object.assign(config, patch);
  saveConfig();
  applySideEffects(patch);
});

ipcMain.on('open-external', (_, url) => {
  if (/^(https?|tg):\/\//i.test(url) || /^tg:/i.test(url)) shell.openExternal(url);
});

ipcMain.on('app:open-data-folder', () => { shell.openPath(app.getPath('userData')).catch(() => {}); });

ipcMain.on('notify', (_, { title, body }) => {
  if (!Notification.isSupported() || !title) return;
  const n = new Notification({ title: String(title).slice(0, 80), body: String(body || '').slice(0, 160), icon: path.join(__dirname, '../assets', 'logo.png'), silent: false });
  n.on('click', () => {
    if (!win) return;
    win.show();
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  n.show();
});

ipcMain.on('win:maximize-toggle', () => {
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win:close', () => win?.close());
ipcMain.on('win:fullscreen', () => {
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
});

ipcMain.handle('app:diagnostics', async () => {
  const wc = win?.webContents;
  let webviewMemoryMB = 0;
  try {
    const pid = wc?.getOSProcessId?.();
    const metric = pid ? app.getAppMetrics().find(m => m.pid === pid) : null;
    webviewMemoryMB = metric?.memory?.workingSetSize ? Math.round(metric.memory.workingSetSize / 1024) : 0;
  } catch {}
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
    memoryMB: Math.round(process.memoryUsage().rss / 1048576),
    webviewMemoryMB,
    gpu: app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : {},
    visible: !!win?.isVisible(),
    maximized: !!win?.isMaximized(),
    fullscreen: !!win?.isFullScreen(),
  };
});

ipcMain.handle('app:clear-site-data', async () => {
  try {
    await session.defaultSession.clearStorageData({
      storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'serviceworkers', 'websql', 'shadercache', 'cachestorage'],
    });
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e?.message || e) }; }
});

const EXPORT_KEYS = ['theme','custom','site','remember','notify','autostart','tray','compact','confirmClose','autoRecovery','performance','lowPower','autoHide','closeBehavior','alwaysOnTop','hotkeys','customCss','smoothSite','visual','profiles','lastUrl','history','favorites'];

ipcMain.handle('settings:export', async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Экспорт настроек AnimeOn',
      defaultPath: 'AnimeOn-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    const data = { app: 'AnimeOn Desktop', version: app.getVersion(), exportedAt: new Date().toISOString(), settings: Object.fromEntries(EXPORT_KEYS.map(k => [k, config[k]])) };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (e) { return { ok: false, error: String(e?.message || e) }; }
});

ipcMain.handle('settings:import', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Импорт настроек AnimeOn',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
    const raw = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    const incoming = raw?.settings && typeof raw.settings === 'object' ? raw.settings : raw;
    const patch = {};
    for (const k of EXPORT_KEYS) if (Object.prototype.hasOwnProperty.call(incoming, k)) patch[k] = incoming[k];
    if (patch.theme && !['violet','blue','cyan','sky','indigo','emerald','green','lime','yellow','amber','orange','red','rose','pink','fuchsia','slate','gray','teal','mint','gold','coral','lavender','crimson','electric','custom'].includes(patch.theme)) delete patch.theme;
    if (patch.site && !['cc','co'].includes(patch.site)) delete patch.site;
    if (patch.performance && !['performance','balanced','economy'].includes(patch.performance)) delete patch.performance;
    if (patch.closeBehavior && !['exit','tray','ask'].includes(patch.closeBehavior)) delete patch.closeBehavior;
    for (const k of ['remember','autostart','tray','compact','confirmClose','autoRecovery','lowPower','autoHide']) if (k in patch) patch[k] = !!patch[k] || patch[k] === '1';
    Object.assign(config, patch); saveConfig(); applySideEffects(patch);
    return { ok: true, settings: Object.fromEntries(EXPORT_KEYS.map(k => [k, config[k]])) };
  } catch (e) { return { ok: false, error: 'Не удалось импортировать файл: ' + String(e?.message || e) }; }
});

ipcMain.handle('settings:reset', async () => {
  try {
    const defaults = { theme:'violet', custom:'#8b5cf6', site:'', remember:'0', notify:false, autostart:false, tray:false, compact:false, confirmClose:false, autoRecovery:true, performance:'balanced', lowPower:false, autoHide:true, closeBehavior:'ask', alwaysOnTop:false, hotkeys:{}, customCss:{cc:'',co:''}, smoothSite:true, visual:{radius:18,opacity:96,blur:0,scale:100,density:100,accentGlow:55,animations:'smooth'}, profiles:{} };
    Object.assign(config, defaults); saveConfig(); applySideEffects({ autostart:true, tray:true });
    return { ok: true, settings: config };
  } catch (e) { return { ok:false, error:String(e?.message || e) }; }
});

ipcMain.handle('app:connection-check', async () => {
  const urls = ['https://animeon.cc/', 'https://v1.animeon.co/'];
  const results = [];
  for (const url of urls) {
    const started = Date.now();
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AnimeOn-Desktop' } });
      results.push({ url, ok: res.ok || res.status < 500, status: res.status, ms: Date.now()-started });
    } catch (e) { results.push({ url, ok:false, status:0, ms:Date.now()-started, error:String(e?.message || e) }); }
  }
  return { internet: results.some(r => r.ok), results };
});

ipcMain.handle('app:clear-cache', async () => {
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({ storages: ['serviceworkers', 'shadercache'] });
    if (win && !win.isDestroyed()) win.webContents.session.clearCache().catch(() => {});
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e?.message || e) }; }
});

ipcMain.on('app:restart-webview', () => {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('restart-webview');
  setTaskbarOverlay('none');
});

ipcMain.on('app:taskbar-overlay', (_, kind) => setTaskbarOverlay(kind));
ipcMain.on('app:confirm-close-result', (_, ok) => {
  if (!ok) return;
  quitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  if (trayMenuWin && !trayMenuWin.isDestroyed()) trayMenuWin.destroy();
  trayMenuWin = null;
  if (win && !win.isDestroyed()) win.close();
  app.quit();
});
ipcMain.on('app:set-performance', (_, mode) => {
  config.performance = ['performance','balanced','economy'].includes(mode) ? mode : 'balanced';
  saveConfig();
  try { if (siteWc && !siteWc.isDestroyed()) siteWc.setBackgroundThrottling(config.performance === 'economy'); } catch {}
  if (win && !win.isDestroyed()) win.webContents.send('performance-mode', config.performance);
});

ipcMain.handle('site:memory', async () => {
  try {
    const metrics = app.getAppMetrics();
    const sitePid = siteWc && !siteWc.isDestroyed() ? siteWc.getProcessId() : 0;
    const site = metrics.find(x => x.pid === sitePid);
    return { ok:true, appMB:Math.round(process.memoryUsage().rss / 1048576), siteMB:site ? Math.round(site.memory.workingSetSize / 1024) : 0, pid:sitePid, performance:config.performance };
  } catch (e) { return { ok:false, error:String(e?.message || e) }; }
});

ipcMain.on('site:navigate', (_, url) => {
  if (!siteWc || siteWc.isDestroyed() || !SITE_RE.test(String(url))) return;
  try { siteWc.loadURL(String(url)); } catch {}
});

ipcMain.on('media:volume', (_, delta) => setVolume(Number(delta) || 0).then(v => { if (v && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'volume', value: v.volume, muted: v.muted }); }));
ipcMain.handle('media:volume-state', () => volumeState);
ipcMain.on('media:mute', () => setMuted(null).then(v => { if (v && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'volume', value: v.volume, muted: v.muted }); }));
ipcMain.on('media:seek', (_, seconds) => { const n = Number(seconds) || 0; seekVideo(n).then(ok => { if (ok && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'seek', value: n }); }); });
ipcMain.on('media:action', (_, action) => mediaAction(action));
ipcMain.on('app:screenshot', takeScreenshot);

ipcMain.handle('screenshots:list', async () => {
  try {
    ensureScreenshotsDir();
    const items = fs.readdirSync(screenshotsDir)
      .filter((f) => /\.png$/i.test(f))
      .map((f) => {
        const full = path.join(screenshotsDir, f);
        let stat;
        try { stat = fs.statSync(full); } catch { return null; }
        return { name: f, path: full, mtimeMs: stat.mtimeMs, size: stat.size };
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return { ok: true, dir: screenshotsDir, items };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('screenshots:thumb', async (_, filePath) => {
  try {
    if (!isInScreenshotsDir(filePath)) throw new Error('bad path');
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) throw new Error('empty image');
    const size = img.getSize();
    const width = Math.min(280, size.width || 280);
    const thumb = size.width > width ? img.resize({ width }) : img;
    return { ok: true, dataUrl: thumb.toDataURL() };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('screenshots:open', async (_, filePath) => {
  try {
    if (!isInScreenshotsDir(filePath)) throw new Error('bad path');
    const err = await shell.openPath(filePath);
    if (err) throw new Error(err);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('screenshots:show', async (_, filePath) => {
  try {
    if (!isInScreenshotsDir(filePath)) throw new Error('bad path');
    shell.showItemInFolder(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('screenshots:copy', async (_, filePath) => {
  try {
    if (!isInScreenshotsDir(filePath)) throw new Error('bad path');
    const img = nativeImage.createFromPath(filePath);
    if (img.isEmpty()) throw new Error('empty image');
    clipboard.writeImage(img);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('screenshots:delete', async (_, filePath) => {
  try {
    if (!isInScreenshotsDir(filePath)) throw new Error('bad path');
    fs.unlinkSync(filePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.on('screenshots:open-folder', () => {
  ensureScreenshotsDir();
  shell.openPath(screenshotsDir).catch(() => {});
});
ipcMain.on('app:always-on-top', toggleAlwaysOnTop);
ipcMain.on('app:zoom', (_, delta) => {
  if (!siteWc || siteWc.isDestroyed()) return;
  const d = Number(delta) || 0;
  const current = siteWc.getZoomFactor();
  siteWc.setZoomFactor(d === 0 ? 1 : Math.max(0.5, Math.min(3, current + d)));
});
ipcMain.on('app:register-hotkeys', registerGlobalHotkeys);
ipcMain.handle('hotkeys:set', (_, hotkeys) => {
  const next = hotkeys && typeof hotkeys === 'object' ? hotkeys : {};
  const clean = {};
  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== 'string') continue;
    clean[key] = value.trim();
  }
  config.hotkeys = clean;
  saveConfig();
  const result = registerGlobalHotkeys();
  return { hotkeys: config.hotkeys, ...result };
});
ipcMain.on('app:toggle-devtools', () => {
  const wc = siteWc;
  if (!wc || wc.isDestroyed()) return;
  try {
    if (wc.isDevToolsOpened()) { wc.closeDevTools(); return; }
    setTimeout(() => {
      try {
        if (!wc.isDestroyed() && !wc.isDevToolsOpened()) wc.openDevTools({ mode:'detach', activate:true });
      } catch {
        try { if (!wc.isDestroyed() && !wc.isDevToolsOpened()) wc.openDevTools({ mode:'right', activate:true }); } catch {}
      }
    }, 80);
  } catch {}
});

const REPO_API = 'https://api.github.com/repos/Neukluziy/animeon-desktop/releases/latest';


let lastUpdate = null;
let updateNotified = false;
let downloadedInstaller = null;
let updateWindow = null;

async function checkUpdate() {
  try {
    const res = await fetch(REPO_API, { headers: { 'User-Agent': 'AnimeOn-Desktop' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { ok: false, reason: 'github ' + res.status };
    const j = await res.json();
    const latest = String(j.tag_name || j.name || '').replace(/^v/i, '').trim();
    if (!latest) return { ok: false, reason: 'обновлений пока нет' };
    const assets = Array.isArray(j.assets) ? j.assets : [];
    const setup = assets.find((a) => /setup.*\.exe$/i.test(a.name)) || assets.find((a) => /\.exe$/i.test(a.name));
    const info = {
      ok: true,
      latest,
      current: app.getVersion(),
      hasUpdate: compareVersions(latest, app.getVersion()) > 0,
      url: setup ? setup.browser_download_url : j.html_url,
      notes: String(j.body || '').replace(/\r/g, ''),
    };
    if (info.hasUpdate) {
      lastUpdate = info;
      if (!updateNotified) {
        updateNotified = true;
        showUpdateToast();
      }
    }
    return info;
  } catch (err) {
    return { ok: false, reason: String(err && err.message || err) };
  }
}

function showUpdateToast() {
  if (!Notification.isSupported() || !lastUpdate) return;
  const n = new Notification({
    title: `Доступна новая версия — v${lastUpdate.latest}`,
    body: 'Нажми, чтобы посмотреть изменения',
    icon: path.join(__dirname, '../assets', 'logo.png'),
    silent: false,
  });
  n.on('click', () => openUpdateWindow());
  n.show();
}

function openUpdateWindow() {
  if (!lastUpdate) return;
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.show();
    updateWindow.focus();
    return;
  }
  updateWindow = new BrowserWindow({
    width: 460,
    height: 580,
    minWidth: 380,
    minHeight: 440,
    frame: false,
    show: false,
    backgroundColor: '#0f0d14',
    icon: path.join(__dirname, '../assets', 'logo.ico'),
    title: 'Обновление AnimeOn',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  updateWindow.setMenuBarVisibility(false);
  updateWindow.loadFile(path.join(__dirname, '../windows/update.html'));
  updateWindow.once('ready-to-show', () => {
    updateWindow.show();
    updateWindow.focus();
  });
  updateWindow.webContents.on('did-finish-load', () => {
    updateWindow.webContents.send('upd:data', lastUpdate);
  });
  updateWindow.on('closed', () => {
    updateWindow = null;
  });
}

function updProgress(pct, stage, extra = {}) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send('upd:progress', { pct, stage, ...extra });
  }
}

async function downloadUpdate() {
  if (!lastUpdate || !lastUpdate.url) return { ok: false, error: 'нет данных об обновлении' };
  try {
    const dest = path.join(app.getPath('temp'), `AnimeOn-Setup-${lastUpdate.latest}.exe`);
    updProgress(0, 'download');
    const res = await fetch(lastUpdate.url, { signal: AbortSignal.timeout(600000) });
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    const ws = fs.createWriteStream(dest);
    let received = 0;
    let lastPct = -1;
    let lastTime = Date.now();
    let lastBytes = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      ws.write(Buffer.from(value));
      received += value.length;
      const now = Date.now();
      if (now - lastTime >= 180) {
        const speed = Math.max(0, (received - lastBytes) / Math.max(0.18, (now - lastTime) / 1000));
        const pct = total > 0 ? Math.max(0, Math.min(100, (received / total) * 100)) : null;
        if (pct === null || Math.floor(pct) !== lastPct) {
          lastPct = pct === null ? lastPct : Math.floor(pct);
          updProgress(pct, 'download', { received, total, speed });
          if (win && !win.isDestroyed()) win.setProgressBar(pct === null ? 0 : Math.max(0, Math.min(1, pct / 100)), { mode: pct === null ? 'indeterminate' : 'normal' }); 
        }
        lastTime = now;
        lastBytes = received;
      }
    }
    await new Promise((r) => ws.end(r));
    downloadedInstaller = dest;
    updProgress(100, 'ready', { received, total, speed: 0 });
    if (win && !win.isDestroyed()) win.setProgressBar(1);
    setTimeout(() => { if (win && !win.isDestroyed()) win.setProgressBar(-1); }, 900);
    return { ok: true };
  } catch (err) {
    if (win && !win.isDestroyed()) win.setProgressBar(-1);
    return { ok: false, error: String(err && err.message || err) };
  }
}

function applyUpdate() {
  if (!downloadedInstaller || !fs.existsSync(downloadedInstaller)) return false;

  const portablePath = process.env.PORTABLE_EXECUTABLE_PATH;
  if (portablePath) {
    const bat = path.join(app.getPath('temp'), `animeon-update-${Date.now()}.bat`);
    fs.writeFileSync(bat, [
      '@echo off',
      'timeout /t 2 /nobreak >nul',
      `move /y "${portablePath}" "${portablePath}.old"`,
      `copy /y "${downloadedInstaller}" "${portablePath}" >nul`,
      `start "" "${portablePath}"`,
      `del /q "${portablePath}.old" 2>nul`,
      `del /q "${bat}" 2>nul`,
    ].join('\r\n'));
    spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    quitting = true;
    setTimeout(() => app.exit(0), 300);
    return true;
  }

  spawn(downloadedInstaller, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  quitting = true;
  setTimeout(() => app.exit(0), 500);
  return true;
}

ipcMain.handle('upd:check', () => checkUpdate());

ipcMain.on('upd:open', () => openUpdateWindow());
ipcMain.on('upd:close', () => {
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
});
ipcMain.on('upd:install', () => applyUpdate());
ipcMain.handle('upd:download', () => downloadUpdate());

ipcMain.handle('site:apply-css', async (_, css) => {
  if (!siteWc || siteWc.isDestroyed()) return { ok: false, error: 'страница ещё не загружена' };
  const value = typeof css === 'string' ? css.slice(0, 200000) : '';
  try {
    await siteWc.executeJavaScript(`(() => {
      const css = ${JSON.stringify(value)};
      const id = '__animeon_custom_css__';
      let style = document.getElementById(id);
      if (!style) {
        style = document.createElement('style');
        style.id = id;
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = css;
      return true;
    })()`, true);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.on('taskbar-progress', (_, value) => {
  if (!win || win.isDestroyed()) return;
  const n = Number(value);
  if (n < 0) win.setProgressBar(-1);
  else if (n >= 1) win.setProgressBar(1);
  else win.setProgressBar(Math.max(0, Math.min(1, n)), { mode: 'normal' });
});

ipcMain.on('app:info', (e) => {
  e.returnValue = { version: APP_VERSION, name: 'AnimeOn Desktop', electron: process.versions.electron };
});

app.whenReady().then(() => {
  saveConfig();
  createWindow();
  ensureTray();

  setTimeout(() => {
    checkUpdate().catch(() => {});
  }, 1200);

  if (process.argv.includes('--settings')) setTimeout(() => win?.webContents.send('open-settings'), 900);
  if (process.argv.includes('--reload')) setTimeout(() => win?.webContents.send('restart-webview'), 1200);
  registerGlobalHotkeys();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  saveWindowState();
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => app.quit());
