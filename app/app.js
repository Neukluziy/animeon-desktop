const { app, BrowserWindow, ipcMain, shell, Tray, Notification, screen, globalShortcut, session, dialog, nativeImage, clipboard } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const { SITE_RE, AUTH_RE, TELEGRAM_RE, APP_VERSION, compareVersions } = require('./modules');
const { API_BASE, API_VERSION, request: apiRequest, get: apiGet, post: apiPost, health: apiHealth } = require('./api-client');
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
  site: 'co',
  siteList: [
    { id: 'one', url: 'https://animeon.cc/', label: 'animeon.cc' },
    { id: 'two', url: 'https://v1.animeon.co/', label: 'v1.animeon.co' },
  ],
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
  recentPages: [],
  pageFavorites: [],
  tabs: [],
  activeTab: 0,
  tabsFixedV2: false,
  doNotDisturb: false,
  sleepTimer: { enabled: false, minutes: 0, action: 'pause' },
  autoCacheCleanup: true,
  cacheLimitMB: 512,
  errorLog: [],
  memorySaver: false,
  startupPolicyFixed: false,
  api: { baseUrl: API_BASE, clientVersion: API_VERSION, timeout: 10000 },
  playbackPositions: {},
  playbackSpeed: 1,
  resumeEnabled: true,
  autoNext: false,
  library: { favorites: [], continueWatching: [], localHistory: [] },
};

try {
  Object.assign(config, JSON.parse(fs.readFileSync(configPath, 'utf8')));
} catch {}
if (!Array.isArray(config.siteList) || config.siteList.length < 2) {
  config.siteList = [
    { id: 'one', url: 'https://animeon.cc/', label: 'animeon.cc' },
    { id: 'two', url: 'https://v1.animeon.co/', label: 'v1.animeon.co' },
  ];
}
config.siteList = config.siteList.slice(0, 2).map((site, index) => {
  const rawUrl = String(site?.url || '').trim();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return {
    id: index === 0 ? 'one' : 'two',
    url: url.endsWith('/') ? url : `${url}/`,
    label: String(site?.label || url.replace(/^https?:\/\//i, '').replace(/\/$/, '')).trim(),
  };
});
if (!config.customCss || typeof config.customCss !== 'object') config.customCss = { cc: '', co: '' };
if (typeof config.smoothSite !== 'boolean') config.smoothSite = true;
if (!config.visual || typeof config.visual !== 'object') config.visual = { radius:18, opacity:92, blur:0, scale:100, density:100, accentGlow:70, animations:'smooth' };
if (Number(config.visual.blur) === 18) config.visual.blur = 0;
if (!config.profiles || typeof config.profiles !== 'object') config.profiles = {};
if (!Array.isArray(config.history)) config.history = [];
if (!Array.isArray(config.favorites)) config.favorites = [];
if (!Array.isArray(config.recentPages)) config.recentPages = [];
if (!Array.isArray(config.pageFavorites)) config.pageFavorites = [];
if (!Array.isArray(config.tabs)) config.tabs = [];
if (!Number.isInteger(config.activeTab)) config.activeTab = 0;
if (typeof config.tabsFixedV2 !== 'boolean') config.tabsFixedV2 = false;
if (!config.tabsFixedV2) { config.tabs = []; config.activeTab = 0; config.tabsFixedV2 = true; }
if (!config.sleepTimer || typeof config.sleepTimer !== 'object') config.sleepTimer = { enabled:false, minutes:0, action:'pause' };
if (!Array.isArray(config.errorLog)) config.errorLog = [];
if (typeof config.doNotDisturb !== 'boolean') config.doNotDisturb = false;
if (typeof config.autoCacheCleanup !== 'boolean') config.autoCacheCleanup = true;
if (!Number.isFinite(Number(config.cacheLimitMB))) config.cacheLimitMB = 512;
if (typeof config.memorySaver !== 'boolean') config.memorySaver = false;
if (!config.api || typeof config.api !== 'object') config.api = { baseUrl: API_BASE, clientVersion: API_VERSION, timeout: 10000 };
if (!config.playbackPositions || typeof config.playbackPositions !== 'object' || Array.isArray(config.playbackPositions)) config.playbackPositions = {};
if (!Number.isFinite(Number(config.playbackSpeed)) || ![0.25,0.5,0.75,1,1.25,1.5,1.75,2].includes(Number(config.playbackSpeed))) config.playbackSpeed = 1;
if (typeof config.resumeEnabled !== 'boolean') config.resumeEnabled = true;
if (typeof config.autoNext !== 'boolean') config.autoNext = false;
if (!config.library || typeof config.library !== 'object') config.library = { favorites: [], continueWatching: [], localHistory: [] };
for (const key of ['favorites','continueWatching','localHistory']) if (!Array.isArray(config.library[key])) config.library[key] = [];
if (config.api.baseUrl !== API_BASE) config.api.baseUrl = API_BASE;
if (!Number.isFinite(Number(config.api.timeout))) config.api.timeout = 10000;
if (typeof config.lastUrl !== 'string') config.lastUrl = '';
if (typeof config.startupPolicyFixed !== 'boolean') config.startupPolicyFixed = false;

function buildVisualCss() {
  const v = config.visual || {};
  const radius = Number.isFinite(Number(v.radius)) ? Number(v.radius) : 18;
  const opacity = (Number.isFinite(Number(v.opacity)) ? Number(v.opacity) : 96) / 100;
  const blur = Number.isFinite(Number(v.blur)) ? Number(v.blur) : 0;
  const scale = Number.isFinite(Number(v.scale)) ? Number(v.scale) : 100;
  const density = (Number.isFinite(Number(v.density)) ? Number(v.density) : 100) / 100;
  const glow = (Number.isFinite(Number(v.accentGlow)) ? Number(v.accentGlow) : 55) / 100;
  const animations = ['off','smooth','cinematic'].includes(v.animations) ? v.animations : 'smooth';
  const transition = animations === 'cinematic' ? '620ms cubic-bezier(.16,1,.3,1)' : animations === 'smooth' ? '360ms cubic-bezier(.22,1,.36,1)' : '0ms';
  return `:root{--animeon-radius:${radius}px;--animeon-alpha:${opacity};--animeon-blur:${blur}px;--animeon-density:${density};--animeon-transition:${transition};--animeon-glow:${glow};--animeon-scale:${scale / 100}}html{scroll-behavior:${config.smoothSite !== false ? 'smooth' : 'auto'}!important;scroll-padding-top:12px}*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}`;
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
let mediaPollTimer = null;
let lastResumeUrl = '';
let lastPlaybackPersist = 0;
let lastMediaState = null;
let sleepTimerHandle = null;
let lastAutoNextUrl = '';
const logPath = path.join(app.getPath('userData'), 'animeon.log');
function writeLog(level, message, meta) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const time = new Date().toISOString();
    fs.appendFileSync(logPath, JSON.stringify({ time, level, message:String(message||''), meta:meta||null })+'\n', 'utf8');
    config.errorLog = [{time, level, message:String(message||'')} , ...(config.errorLog||[])].slice(0,300);
    saveConfig();
  } catch {}
}
const originalConsoleError = console.error;
console.error = (...args) => { originalConsoleError(...args); writeLog('error', args.map(String).join(' ')); };
const originalConsoleWarn = console.warn;
console.warn = (...args) => { originalConsoleWarn(...args); writeLog('warn', args.map(String).join(' ')); };
function sanitizeName(value) {
  return String(value||'AnimeOn').replace(/[<>:"/\\|?*\x00-\x1F]/g,' ').replace(/\s+/g,' ').trim().slice(0,100) || 'AnimeOn';
}
function pageLabel(url, title='') {
  return sanitizeName(String(title||'').replace(/[-_|]+/g,' ')) || sanitizeName(String(url).split('/').filter(Boolean).pop() || 'AnimeOn');
}
function normalizePageUrl(url) {
  try {
    const u=new URL(String(url||''));
    if (!/^https?:$/i.test(u.protocol) || !/(^|\.)animeon\.(cc|co)$/i.test(u.hostname)) return '';
    u.hash='';
    return u.toString();
  } catch { return ''; }
}
function rememberRecentPage(url, title='') {
  const normalized=normalizePageUrl(url);
  if (!normalized) return;
  const item={url:normalized, title:pageLabel(normalized,title), updatedAt:new Date().toISOString()};
  config.recentPages=[item,...(config.recentPages||[]).filter(x=>normalizePageUrl(x?.url)!==normalized)].slice(0,100);
  saveConfig();
}
function setSleepTimer(minutes, action='pause') {
  if (sleepTimerHandle) clearTimeout(sleepTimerHandle);
  const m=Math.max(0,Number(minutes)||0);
  config.sleepTimer={enabled:m>0,minutes:m,action:['pause','exit','tray'].includes(action)?action:'pause'};
  saveConfig();
  if (!m) return {ok:true,enabled:false};
  sleepTimerHandle=setTimeout(()=>{
    try { if(config.sleepTimer.action==='exit'){ quitting=true; app.exit(0); } else if(config.sleepTimer.action==='tray'){ ensureTray(); win?.hide(); } else togglePlayback(); } catch {}
    config.sleepTimer={enabled:false,minutes:0,action:'pause'}; saveConfig();
  }, m*60000);
  return {ok:true,enabled:true,minutes:m,action:config.sleepTimer.action};
}
function scheduleCacheCleanup() {
  if (!config.autoCacheCleanup) return;
  setTimeout(async()=>{
    try {
      const max=Number(config.cacheLimitMB)||512;
      const usage=await session.defaultSession.getCacheSize();
      if(usage>max*1048576) await session.defaultSession.clearCache();
    } catch(e){ writeLog('warn','Cache cleanup failed',{error:String(e?.message||e)}); }
  }, 2500);
}
setInterval(() => scheduleCacheCleanup(), 15 * 60 * 1000);
const PROTOCOL = 'animeon';

function extractDeepLink(argv = []) {
  return argv.find((arg) => typeof arg === 'string' && arg.toLowerCase().startsWith(`${PROTOCOL}://`)) || '';
}

function openDeepLink(rawUrl) {
  const value = String(rawUrl || '');
  if (!/^animeon:\/\//i.test(value)) return false;
  try {
    const u = new URL(value);
    const target = u.searchParams.get('url');
    if (target && SITE_RE.test(target)) { siteWc?.loadURL(target); showMainWindow(); return true; }
    const pathPart = `${u.pathname || ''}${u.search || ''}${u.hash || ''}`;
    if (pathPart && siteWc && !siteWc.isDestroyed()) {
      const base = (config.siteList && config.siteList[0]?.url) || 'https://animeon.cc';
      siteWc.loadURL(new URL(pathPart, base).href);
      showMainWindow();
      return true;
    }
  } catch {}
  return false;
}

function updateMediaSession(state) {
  if (!siteWc || siteWc.isDestroyed()) return;
  const safe = {
    title: String(state?.title || 'AnimeOn').slice(0, 120),
    currentTime: Number(state?.currentTime || 0),
    duration: Number(state?.duration || 0),
    paused: !!state?.paused,
  };
  if (JSON.stringify(safe) === JSON.stringify(lastMediaState)) return;
  lastMediaState = safe;
  try {
    siteWc.executeJavaScript(`(() => {
      const s=${JSON.stringify(safe)};
      if (!('mediaSession' in navigator)) return false;
      navigator.mediaSession.playbackState=s.paused?'paused':'playing';
      try { navigator.mediaSession.metadata = new MediaMetadata({title:s.title,artist:'AnimeOn'}); } catch {}
      return true;
    })()`, false).catch(() => {});
  } catch {}
}

function registerProtocol() {
  try {
    if (process.defaultApp) {
      const execPath = process.execPath;
      const entry = path.resolve(process.argv[1] || '.');
      app.setAsDefaultProtocolClient(PROTOCOL, execPath, [entry]);
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL);
    }
  } catch {}
}

function handleStartupDeepLink(argv = []) {
  const link = extractDeepLink(argv);
  if (link) setTimeout(() => openDeepLink(link), 900);
}


app.on('second-instance', (_, argv) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (argv.includes('--settings')) win.webContents.send('open-settings');
  if (argv.includes('--reload')) win.webContents.send('restart-webview');
  const deepLink = extractDeepLink(argv);
  if (deepLink) openDeepLink(deepLink);
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
  try{ app.setAppUserModelId('co.animeon.desktop'); }catch{}
  const ws = loadWindowState();
  let winIcon;
  try{
    const icoPath=path.join(__dirname, '../assets', 'logo.ico');
    const pngPath=path.join(__dirname, '../assets', 'logo.png');
    if(fs.existsSync(icoPath)) winIcon=nativeImage.createFromPath(icoPath);
    else if(fs.existsSync(pngPath)) winIcon=nativeImage.createFromPath(pngPath);
  }catch{}
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
    icon: winIcon || path.join(__dirname, '../assets', 'logo.ico'),
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

  win.once('ready-to-show', () => { try{ if(winIcon && !winIcon.isEmpty()) win.setIcon(winIcon); }catch{} win.show(); });
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(!!config.alwaysOnTop);
  win.loadFile(path.join(__dirname, '../index.html'));
  if (ws.maximized) win.maximize();

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (handleLocalHotkey(input, e)) return;
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

  const siteSession = win.webContents.session;
  siteSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...(details.responseHeaders || {}) };
    try {
      const requestUrl = new URL(details.url);
      const origin = String(details.requestHeaders?.Origin || details.requestHeaders?.origin || '');
      if (origin && /(^|\.)animeon\.(cc|co)$/i.test(new URL(origin).hostname) && /(^|\.)animeon\.cloud$/i.test(requestUrl.hostname)) {
        const key = Object.keys(headers).find(k => k.toLowerCase() === 'access-control-allow-origin');
        if (key) delete headers[key];
        headers['Access-Control-Allow-Origin'] = [origin];
        const credKey = Object.keys(headers).find(k => k.toLowerCase() === 'access-control-allow-credentials');
        if (credKey) delete headers[credKey];
        headers['Access-Control-Allow-Credentials'] = ['true'];
      }
    } catch {}
    callback({ responseHeaders: headers });
  });

  const configuredSiteSessions = new WeakSet();
  win.webContents.on('did-attach-webview', (_, wc) => {
    siteWc = wc;
    try { wc.setBackgroundThrottling(config.performance === 'economy'); } catch {}
    try { wc.setVisualZoomLevelLimits(0.5, 3); } catch {}
    try {
      const session = wc.session;
      const ua = win.webContents.getUserAgent().replace(/\sElectron\/[\d.]+/i, '');
      session.setUserAgent(ua, 'ru-RU,ru');
      if (!configuredSiteSessions.has(session)) {
        configuredSiteSessions.add(session);
        session.webRequest.onHeadersReceived((details, callback) => {
          const headers={...(details.responseHeaders||{})};
          try {
            const requestUrl=new URL(details.url);
            const origin=String(details.requestHeaders?.Origin||details.requestHeaders?.origin||'');
            const allowedOrigin=origin && /(^|\.)animeon\.(cc|co)$/i.test(new URL(origin).hostname);
            const isCloud=/(^|\.)animeon\.cloud$/i.test(requestUrl.hostname);
            if (allowedOrigin && isCloud) {
              for (const key of Object.keys(headers)) {
                if (/^access-control-allow-(origin|credentials|methods|headers)$/i.test(key)) delete headers[key];
              }
              headers['Access-Control-Allow-Origin']=[origin];
              headers['Access-Control-Allow-Credentials']=['true'];
              headers['Access-Control-Allow-Methods']=['GET,HEAD,OPTIONS'];
              headers['Access-Control-Allow-Headers']=['Range,Origin,Accept,Content-Type,Authorization'];
              headers['Access-Control-Expose-Headers']=['Content-Length,Content-Range,Accept-Ranges'];
            }
          } catch {}
          callback({responseHeaders:headers});
        });
      }
    } catch {}
    wc.on('render-process-gone', () => {
      setTaskbarOverlay('error');
      if (config.autoRecovery && win && !win.isDestroyed()) {
        setTimeout(() => { try { wc.reload(); } catch {} }, 700);
      }
    });
    wc.on('dom-ready', async () => {
      setTimeout(() => applyPlaybackPreferences().catch(() => {}), 500);
      try {
        await wc.executeJavaScript(`(() => {
          if (!('mediaSession' in navigator)) return false;
          const pick = () => Array.from(document.querySelectorAll('video')).find(v => !v.paused && !v.ended) || document.querySelector('video');
          const run = (fn) => { try { const v=pick(); if(v) fn(v); } catch {} };
          const handlers = {
            play: () => run(v => v.play()),
            pause: () => run(v => v.pause()),
            seekbackward: () => run(v => { v.currentTime=Math.max(0,v.currentTime-10); }),
            seekforward: () => run(v => { v.currentTime=Math.min(v.duration||Infinity,v.currentTime+10); }),
            nexttrack: () => document.querySelector('[aria-label*="next" i],[title*="next" i],[class*="next" i]')?.click(),
            previoustrack: () => document.querySelector('[aria-label*="previous" i],[title*="previous" i],[class*="previous" i]')?.click(),
          };
          for (const [name, fn] of Object.entries(handlers)) { try { navigator.mediaSession.setActionHandler(name, fn); } catch {} }
          return true;
        })()`, false);
      } catch {}
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
    wc.on('did-frame-finish-load', () => { applyVolumeToGuest().catch(() => {}); applyPlaybackPreferences().catch(() => {}); });
    wc.on('will-navigate', (event, url) => {
      if (TELEGRAM_RE.test(url) || /^tg:/i.test(url)) {
        event.preventDefault();
        openTelegramExternal(url);
      }
    });
    const rememberWcPage = async (url) => {
      try { const title=await wc.executeJavaScript('document.title||\"\"',false); rememberRecentPage(url,title); }
      catch { rememberRecentPage(url,''); }
    };
    wc.on('did-navigate', (_, url) => { rememberWcPage(url); });
    wc.on('did-navigate-in-page', (_, url) => { rememberWcPage(url); });
    wc.on('did-finish-load', () => { try { rememberWcPage(wc.getURL()); } catch {} });
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
      if (handleLocalHotkey(input, e)) return;
      if (input.control && input.key.toLowerCase() === 'f') { win?.webContents.send('find-open'); e.preventDefault(); return; }
      if (input.control && input.key.toLowerCase() === 'tab') { win?.webContents.send('tabs-cycle', input.shift ? -1 : 1); e.preventDefault(); return; }
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

async function applyPlaybackPreferences() {
  const speed = Number(config.playbackSpeed) || 1;
  const resumeUrl = String(siteWc?.getURL?.() || '');
  const saved = resumeUrl && config.playbackPositions ? config.playbackPositions[resumeUrl] : null;
  const resume = config.resumeEnabled !== false && saved && Number(saved.time) > 3 ? Number(saved.time) : 0;
  if (resumeUrl && resumeUrl !== lastResumeUrl) lastResumeUrl = resumeUrl;
  await executeGuest(`(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return false;
    const active = videos.find(v => !v.paused && !v.ended) || videos[0];
    for (const video of videos) video.playbackRate = ${speed};
    if (${resume > 0 ? 'true' : 'false'} && active.readyState >= 1 && Math.abs(active.currentTime - ${resume}) > 2) active.currentTime = Math.max(0, Math.min(Number.isFinite(active.duration) ? active.duration - 0.5 : ${resume}, ${resume}));
    return true;
  })()`, true);
}

function setPlaybackSpeed(value) {
  const allowed = [0.25,0.5,0.75,1,1.25,1.5,1.75,2];
  const speed = allowed.includes(Number(value)) ? Number(value) : 1;
  config.playbackSpeed = speed;
  saveConfig();
  return executeGuest(`(() => { const videos = Array.from(document.querySelectorAll('video')); for (const video of videos) video.playbackRate = ${speed}; return videos.length > 0; })()`).then(() => speed);
}

function getMediaState() {
  return executeGuest(`(() => {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return null;
    const active = videos.find(v => !v.paused && !v.ended) || videos.find(v => v.readyState >= 2) || videos[0];
    const title = document.title || '';
    return { currentTime: Number(active.currentTime || 0), duration: Number.isFinite(active.duration) ? active.duration : 0, paused: !!active.paused, ended: !!active.ended, rate: Number(active.playbackRate || 1), title, src: active.currentSrc || active.src || '' };
  })()`);
}

async function pollMediaState() {
  if (!win || win.isDestroyed() || !siteWc || siteWc.isDestroyed()) return;
  try {
    const state = await getMediaState();
    const url = String(siteWc.getURL?.() || '');
    if (!state) {
      win.webContents.send('media-state', { available: false, url });
      return;
    }
    const payload = { available: true, url, ...state };
    win.webContents.send('media-state', payload);
    updateMediaSession(payload);
    if (process.platform === 'win32' && tray) tray.setToolTip(payload.title ? `AnimeOn — ${String(payload.title).slice(0, 70)}` : 'AnimeOn');
    if (config.autoNext && state.ended && url && url !== lastAutoNextUrl) {
      lastAutoNextUrl = url;
      setTimeout(() => mediaAction('next'), 350);
    }
    if (!state.ended && url !== lastAutoNextUrl) lastAutoNextUrl = '';
    if (url && /^https:\/\/(?:www\.)?animeon\.(?:cc|co)\//i.test(url) && state.duration > 0 && state.currentTime >= 0) {
      const now = Date.now();
      if (now - lastPlaybackPersist >= 5000) {
        lastPlaybackPersist = now;
        config.playbackPositions[url] = { time: Math.round(state.currentTime * 10) / 10, duration: Math.round(state.duration * 10) / 10, title: String(state.title || '').slice(0, 180), updatedAt: new Date().toISOString() };
        const entries = Object.entries(config.playbackPositions).sort((a,b) => String(b[1]?.updatedAt || '').localeCompare(String(a[1]?.updatedAt || ''))).slice(0, 300);
        config.playbackPositions = Object.fromEntries(entries);
        saveConfig();
      }
    }
  } catch {}
}

function startMediaPolling() {
  if (mediaPollTimer) clearInterval(mediaPollTimer);
  mediaPollTimer = setInterval(() => pollMediaState(), 1000);
}

function togglePictureInPicture() {
  return executeGuest(`(async () => {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return { ok:false, reason:'no-video' };
    if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return { ok:true, active:false }; }
    const active = videos.find(v => !v.paused && !v.ended) || videos[0];
    if (!active.requestPictureInPicture) return { ok:false, reason:'unsupported' };
    await active.requestPictureInPicture();
    return { ok:true, active:true };
  })()`, true);
}

async function inspectPlaybackOptions() {
  const result = await executeGuest(`(() => {
    const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim();
    const textOf = el => normalize(el?.innerText || el?.textContent || el?.getAttribute('aria-label') || el?.title || '');
    const selectors = 'button,a,[role="button"],option';
    const nodes = Array.from(document.querySelectorAll(selectors));
    const qualityRx = /(?:2160|1440|1080|720|576|480|360)p?|4k|ultra|full hd|hd/i;
    const dubRx = /озвуч|дубляж|voice|dub|anilibria|anidub|dream ?cast|shiza|jam|studio band|студийн/i;
    const quality = [...new Set(nodes.map(textOf).filter(x => qualityRx.test(x)).slice(0, 40))];
    const dubbing = [...new Set(nodes.map(textOf).filter(x => dubRx.test(x)).slice(0, 60))];
    const sources = [...new Set(nodes.map(textOf).filter(x => /источник|source|плеер|player|kodik|alloha|sibnet|lumex|collaps|cdn/i.test(x)).slice(0, 40))];
    return { quality, dubbing, sources, url: location.href, title: document.title };
  })()`);
  return result || { quality: [], dubbing: [], sources: [] };
}

async function selectPlaybackOption(kind, value) {
  const target = String(value || '').trim();
  if (!target || !['quality', 'dubbing', 'source'].includes(kind)) return { ok: false, reason: 'invalid' };
  const result = await executeGuest(`(() => {
    const target = ${JSON.stringify(target)};
    const kind = ${JSON.stringify(kind)};
    const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const needle = normalize(target);
    const nodes = Array.from(document.querySelectorAll('button,a,[role="button"],option'));
    const el = nodes.find(node => normalize(node.innerText || node.textContent || node.getAttribute('aria-label') || node.title).includes(needle));
    if (!el) return { ok:false, reason:'not-found', kind, value:target };
    try { el.click(); } catch {}
    return { ok:true, kind, value:target };
  })()`, true);
  return result || { ok: false, reason: 'not-found' };
}

async function smartSelectPlayback(preferences = {}) {
  const options = await inspectPlaybackOptions();
  const prefs = {
    dubbing: Array.isArray(preferences.dubbing) ? preferences.dubbing : [],
    quality: Array.isArray(preferences.quality) ? preferences.quality : [],
    source: Array.isArray(preferences.source) ? preferences.source : [],
  };
  const choose = async (kind, available, preferred) => {
    for (const pref of preferred) {
      const exact = available.find(item => String(item).toLowerCase() === String(pref).toLowerCase());
      const partial = available.find(item => String(item).toLowerCase().includes(String(pref).toLowerCase()));
      const selected = exact || partial;
      if (selected) return selectPlaybackOption(kind, selected);
    }
    return { ok:false, reason:'no-preference-match' };
  };
  const dubbing = await choose('dubbing', options.dubbing, prefs.dubbing);
  const quality = await choose('quality', options.quality, prefs.quality);
  const source = await choose('source', options.sources, prefs.source);
  return { ok: dubbing.ok || quality.ok || source.ok, options, selected: { dubbing, quality, source } };
}

async function smartFallback(preferences = {}) {
  const attempts = [];
  const sourcePrefs = Array.isArray(preferences.source) ? preferences.source : [];
  const options = await inspectPlaybackOptions();
  const candidates = [...sourcePrefs, ...options.sources].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    const result = await selectPlaybackOption('source', candidate);
    attempts.push({ candidate, ok: !!result?.ok });
    if (result?.ok) return { ok:true, selected:candidate, attempts, options };
  }
  return { ok:false, attempts, options };
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
      const url=String(siteWc?.getURL?.()||'');
      let title='AnimeOn';
      try { title=await siteWc?.executeJavaScript('document.title||\"AnimeOn\"',false) || title; } catch {}
      const filePath = path.join(screenshotsDir, `${sanitizeName(pageLabel(url,title))}-${formatTimestamp()}.png`);
      fs.writeFileSync(filePath, image.toPNG());
      win.webContents.send('toast', { message: `Скриншот сохранён: ${path.basename(filePath)}` });
      win.webContents.send('screenshots:changed');
    } catch (e) { writeLog('error','Screenshot failed',{error:String(e?.message||e)}); }
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

function acceleratorFromInput(input) {
  if (!input || input.type !== 'keyDown') return '';
  const parts = [];
  if (input.control) parts.push('Control');
  if (input.alt) parts.push('Alt');
  if (input.shift) parts.push('Shift');
  if (input.meta) parts.push('Command');
  const keyMap = {
    ' ': 'Space', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    PageUp: 'PageUp', PageDown: 'PageDown', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
    Insert: 'Insert', Home: 'Home', End: 'End', Add: '+', Subtract: '-', Multiply: '*', Divide: '/'
  };
  let key = keyMap[input.key] || input.key;
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) key = key.toUpperCase();
  if (key.length === 1) key = key.toUpperCase();
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return '';
  return [...parts, key].join('+');
}

function localHotkeyActions() {
  return {
    show: showMainWindow,
    toggleWindow: toggleTrayWindow,
    playPause: () => togglePlayback(),
    volumeUp: () => setVolume(5),
    volumeDown: () => setVolume(-5),
    mute: () => setMuted(null),
    seekBack: () => seekVideo(-10),
    seekForward: () => seekVideo(10),
    fullscreen: () => { if (win) win.setFullScreen(!win.isFullScreen()); },
    settings: () => { showMainWindow(); win?.webContents.send('open-settings'); },
    reload: () => siteWc?.reload(),
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
}

function handleLocalHotkey(input, event) {
  const combo = acceleratorFromInput(input);
  if (!combo) return false;
  const keys = config.hotkeys && typeof config.hotkeys === 'object' ? config.hotkeys : {};
  const actions = localHotkeyActions();
  const normalized = combo.toLowerCase();
  for (const [key, action] of Object.entries(actions)) {
    const accelerator = String(keys[key] || '').trim();
    if (!accelerator || accelerator.toLowerCase() !== normalized) continue;
    try { action(); } catch (error) { console.error(`[AnimeOn] Hotkey ${key} failed:`, error); }
    if (event) event.preventDefault();
    return true;
  }
  return false;
}

function registerGlobalHotkeys() {
  globalShortcut.unregisterAll();
  const registered = [];
  const failed = [];
  for (const [accelerator, action] of [
    ['MediaPlayPause', () => mediaAction('playpause')],
    ['MediaNextTrack', () => mediaAction('next')],
    ['MediaPreviousTrack', () => mediaAction('previous')],
  ]) {
    try {
      if (globalShortcut.register(accelerator, action)) registered.push({ key: accelerator, accelerator });
      else failed.push({ key: accelerator, accelerator, reason: 'unavailable' });
    } catch (error) {
      failed.push({ key: accelerator, accelerator, reason: String(error?.message || error) });
    }
  }
  return { registered, failed, mode: 'local' };
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
  const [w, h] = [220, 166];
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
  if (trayMenuWin && !trayMenuWin.isDestroyed()) trayMenuWin.hide();
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
  if (action === 'visit-site') { shell.openExternal((config.siteList && config.siteList[0]?.url) || 'https://animeon.cc'); }
  if (action === 'playpause') mediaAction('playpause');
  if (action === 'next') mediaAction('next');
  if (action === 'previous') mediaAction('previous');
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

ipcMain.handle('library:get', () => ({ library: config.library }));
ipcMain.handle('library:set', (_, library) => {
  if (!library || typeof library !== 'object') return { ok: false };
  for (const key of ['favorites','continueWatching','localHistory']) {
    if (Array.isArray(library[key])) config.library[key] = library[key].slice(0, 500);
  }
  saveConfig();
  return { ok: true, library: config.library };
});
ipcMain.handle('library:clear-history', () => {
  config.library.localHistory = [];
  config.library.continueWatching = [];
  saveConfig();
  return { ok: true };
});

ipcMain.on('open-external', (_, url) => {
  if (/^(https?|tg):\/\//i.test(url) || /^tg:/i.test(url)) shell.openExternal(url);
});

ipcMain.on('app:open-data-folder', () => { shell.openPath(app.getPath('userData')).catch(() => {}); });

ipcMain.handle('dnd:set', (_, enabled) => { config.doNotDisturb = !!enabled; saveConfig(); return {ok:true,enabled:config.doNotDisturb}; });

ipcMain.on('notify', (_, { title, body }) => {
  if (config.doNotDisturb || !Notification.isSupported() || !title) return;
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
    api: { baseUrl: API_BASE, clientVersion: API_VERSION },
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

const EXPORT_KEYS = ['theme','custom','site','siteList','remember','notify','autostart','tray','compact','confirmClose','autoRecovery','performance','lowPower','autoHide','closeBehavior','alwaysOnTop','hotkeys','customCss','smoothSite','visual','profiles','lastUrl','history','favorites','api','playbackPositions','playbackSpeed','library','resumeEnabled','autoNext','recentPages','pageFavorites','tabs','activeTab','tabsFixedV2','doNotDisturb','sleepTimer','autoCacheCleanup','cacheLimitMB','errorLog','memorySaver','startupPolicyFixed'];

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
    const defaults = { theme:'violet', custom:'#8b5cf6', site:'co', remember:'0', notify:false, autostart:false, tray:false, compact:false, confirmClose:false, autoRecovery:true, performance:'balanced', lowPower:false, autoHide:true, closeBehavior:'ask', alwaysOnTop:false, resumeEnabled:true, autoNext:false, hotkeys:{}, customCss:{cc:'',co:''}, siteList:[{id:'one',url:'https://animeon.cc/',label:'animeon.cc'},{id:'two',url:'https://v1.animeon.co/',label:'v1.animeon.co'}], smoothSite:true, visual:{radius:18,opacity:96,blur:0,scale:100,density:100,accentGlow:55,animations:'smooth'}, profiles:{} };
    Object.assign(config, defaults); saveConfig(); applySideEffects({ autostart:true, tray:true });
    return { ok: true, settings: config };
  } catch (e) { return { ok:false, error:String(e?.message || e) }; }
});

ipcMain.handle('pages:recent', () => ({ ok:true, items:config.recentPages||[] }));
ipcMain.handle('pages:recent-add', (_, item) => {
  const url=normalizePageUrl(item?.url);
  if(!url) return {ok:false};
  rememberRecentPage(url, String(item?.title||''));
  return {ok:true,items:config.recentPages||[]};
});

ipcMain.handle('pages:favorites', () => ({ ok:true, items:config.pageFavorites||[] }));
ipcMain.handle('pages:favorite-toggle', (_, item) => {
  const url=String(item?.url||'');
  let valid=false;
  try { const u=new URL(url); valid=(u.protocol==='http:'||u.protocol==='https:') && /(^|\.)animeon\.(cc|co)$/i.test(u.hostname); } catch {}
  if(!valid) return {ok:false,error:'bad url'};
  const idx=(config.pageFavorites||[]).findIndex(x=>(typeof x==='string'?x:x?.url)===url);
  if(idx>=0) config.pageFavorites.splice(idx,1); else config.pageFavorites.unshift({url,title:pageLabel(url,item?.title||'')});
  config.pageFavorites=config.pageFavorites.slice(0,100); saveConfig(); return {ok:true,favorite:idx<0,items:config.pageFavorites};
});
ipcMain.handle('tabs:get',()=>({ok:true,tabs:config.tabs||[],activeTab:config.activeTab||0}));
ipcMain.handle('tabs:set',(_,tabs,active=0)=>{ config.tabs=Array.isArray(tabs)?tabs.slice(0,12):[]; config.activeTab=Math.max(0,Math.min(Math.max(0,config.tabs.length-1),Number(active)||0)); saveConfig(); return {ok:true,tabs:config.tabs,activeTab:config.activeTab}; });
ipcMain.handle('find:start',(_,text)=>{ if(!siteWc||siteWc.isDestroyed()) return {ok:false}; const t=String(text||''); if(!t){try{siteWc.stopFindInPage('clearSelection')}catch{} return {ok:true};} return {ok:true,id:siteWc.findInPage(t,{findNext:false,matchCase:false})}; });
ipcMain.handle('find:stop',()=>{try{siteWc?.stopFindInPage('clearSelection');}catch{} return {ok:true};});
ipcMain.handle('sleep:set',(_,minutes,action)=>setSleepTimer(minutes,action));
ipcMain.handle('sleep:get',()=>config.sleepTimer);
ipcMain.handle('logs:get',()=>{ try { const text=fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):''; return {ok:true,path:logPath,text:text.slice(-120000)}; } catch(e){return {ok:false,error:String(e?.message||e)}}});
ipcMain.handle('logs:open',async()=>{try{fs.mkdirSync(path.dirname(logPath),{recursive:true});if(!fs.existsSync(logPath))fs.writeFileSync(logPath,'','utf8');const error=await shell.openPath(logPath);return {ok:!error,path:logPath,error:error||''};}catch(e){return {ok:false,path:logPath,error:String(e?.message||e)}}});
ipcMain.handle('logs:copy',()=>{try{const text=fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';clipboard.writeText(text);return {ok:true}}catch(e){return {ok:false,error:String(e?.message||e)}}});
ipcMain.handle('logs:clear',()=>{try{fs.writeFileSync(logPath,'','utf8');config.errorLog=[];saveConfig();return {ok:true}}catch(e){return {ok:false,error:String(e?.message||e)}}});
ipcMain.handle('cache:settings',(_,patch)=>{ if(patch&&typeof patch==='object'){if('auto' in patch)config.autoCacheCleanup=!!patch.auto;if('limitMB' in patch)config.cacheLimitMB=Math.max(64,Math.min(16384,Number(patch.limitMB)||512));saveConfig();} return {ok:true,auto:config.autoCacheCleanup,limitMB:config.cacheLimitMB};});
ipcMain.handle('cache:info',async()=>{try{return {ok:true,size:await session.defaultSession.getCacheSize(),limitMB:Number(config.cacheLimitMB)||512,auto:!!config.autoCacheCleanup}}catch(e){return {ok:false,error:String(e?.message||e)}}});
ipcMain.handle('memory:saver',(_,enabled)=>{config.memorySaver=!!enabled;saveConfig();try{siteWc?.setBackgroundThrottling(config.memorySaver||config.performance==='economy')}catch{}return {ok:true,enabled:config.memorySaver};});


ipcMain.handle('sites:fetch', async () => {
  try {
    const res = await fetch('https://raw.githubusercontent.com/Neukluziy/testip/main/ip.txt', { signal: AbortSignal.timeout(10000) });
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const sites = [];
    for (const line of lines) {
      const m = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (m) {
        const label = m[2].trim();
        sites.push({ id: m[1].trim(), url: `https://${label}/`, label });
      }
    }
    if (sites.length >= 2) {
      config.siteList = sites;
      saveConfig();
    }
    return { ok: true, sites };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), sites: config.siteList || [] };
  }
});
ipcMain.handle('sites:get', () => {
  return { ok: true, sites: config.siteList || [] };
});

ipcMain.handle('app:connection-check', async () => {
  const results = [];
  const siteList = config.siteList || [
    { id: 'one', url: 'https://animeon.cc/', label: 'animeon.cc' },
    { id: 'two', url: 'https://v2.animeon.co/', label: 'v2.animeon.co' }
  ];
  for (const site of siteList) {
    const url = site.url;
    const started = Date.now();
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AnimeOn-Desktop' } });
      results.push({ url, ok: res.ok || res.status < 500, status: res.status, ms: Date.now()-started });
    } catch (e) { results.push({ url, ok:false, status:0, ms:Date.now()-started, error:String(e?.message || e) }); }
  }
  let api = { ok:false, status:0, ms:0, results:[] };
  try { api = await apiHealth(); } catch (e) { api = { ok:false, status:0, ms:0, results:[], error:String(e?.message || e) }; }
  const internet = results.some(r => r.ok) || api.ok;
  writeLog(internet ? 'info' : 'warn', 'Проверка соединения', { internet, results, api });
  return { internet, api, results };
});

ipcMain.handle('api:health', async () => apiHealth());
ipcMain.handle('api:get', async (_, path, query) => {
  try { return await apiGet(path, query); }
  catch (e) { return { ok:false, status:0, ms:0, error:String(e?.message || e) }; }
});
ipcMain.handle('api:post', async (_, path, body) => {
  try { return await apiPost(path, body); }
  catch (e) { return { ok:false, status:0, ms:0, error:String(e?.message || e) }; }
});
ipcMain.handle('api:request', async (_, path, options) => {
  try { return await apiRequest(path, options || {}); }
  catch (e) { return { ok:false, status:0, ms:0, error:String(e?.message || e) }; }
});
ipcMain.handle('animeon:search', async (_, query, options = {}) => {
  try {
    const q = String(query || '').trim();
    if (!q) return { ok: true, items: [], query: '' };
    const result = await apiGet('/api/search', { q, query: q, page: options.page || 1, limit: options.limit || 20 });
    return normalizeAnimeCollection(result, q);
  } catch (e) {
    return { ok: false, items: [], query: String(query || ''), error: String(e?.message || e) };
  }
});

ipcMain.handle('animeon:filters', async () => {
  try {
    const result = await apiGet('/api/anime/filters');
    return { ...result, filters: result.data?.filters || result.data || {} };
  } catch (e) { return { ok:false, filters:{}, error:String(e?.message || e) }; }
});

ipcMain.handle('animeon:schedule', async (_, options = {}) => {
  try {
    const result = await apiGet('/api/anime/schedule', options);
    return { ...result, schedule: normalizeDataList(result.data) };
  } catch (e) { return { ok:false, schedule:[], error:String(e?.message || e) }; }
});

ipcMain.handle('animeon:watching-now', async (_, options = {}) => {
  try {
    const result = await apiGet('/api/anime/watching-now', options);
    return { ...result, items: normalizeDataList(result.data) };
  } catch (e) { return { ok:false, items:[], error:String(e?.message || e) }; }
});

ipcMain.handle('animeon:watchlist-counts', async () => {
  try {
    const result = await apiGet('/api/user/watchlist/counts');
    return { ...result, counts: result.data?.counts || result.data || {} };
  } catch (e) { return { ok:false, counts:{}, error:String(e?.message || e) }; }
});

ipcMain.handle('animeon:history', async (_, options = {}) => {
  try {
    const result = await apiGet('/api/user/history', options);
    return { ...result, items: normalizeDataList(result.data) };
  } catch (e) { return { ok:false, items:[], error:String(e?.message || e) }; }
});

ipcMain.handle('animeon:notifications', async (_, options = {}) => {
  try {
    const result = await apiGet('/api/user/notifications', options);
    return { ...result, items: normalizeDataList(result.data) };
  } catch (e) { return { ok:false, items:[], error:String(e?.message || e) }; }
});

function normalizeDataList(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of ['items','results','anime','data','entries','history','schedule','watching']) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function normalizeAnimeCollection(result, query) {
  const items = normalizeDataList(result.data).map(item => {
    if (!item || typeof item !== 'object') return { title: String(item) };
    return {
      ...item,
      title: item.title || item.name || item.russian || item.russian_title || item.english || item.japanese || 'Без названия',
      url: item.url || item.link || item.path || '',
      poster: item.poster || item.image || item.cover || item.poster_url || item.image_url || '',
      id: item.id || item.anime_id || item.animeId || null,
    };
  });
  return { ...result, query, items };
}

ipcMain.handle('api:session', async () => {
  try {
    const result = await apiGet('/api/auth/session');
    return { ...result, authenticated: !!(result.ok && (result.data?.user || result.data?.authenticated || result.data?.session)) };
  } catch (e) {
    return { ok:false, status:0, ms:0, authenticated:false, error:String(e?.message || e) };
  }
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

const apiCacheDir = path.join(app.getPath('userData'), 'api-cache');
function ensureApiCacheDir() { try { fs.mkdirSync(apiCacheDir, { recursive: true }); } catch {} }
function getApiCacheSize() {
  ensureApiCacheDir();
  let bytes = 0;
  try { for (const f of fs.readdirSync(apiCacheDir)) { try { bytes += fs.statSync(path.join(apiCacheDir, f)).size; } catch {} } } catch {}
  return bytes;
}
ipcMain.handle('system:cache-info', async () => {
  let sessionCache = 0;
  try { sessionCache = await session.defaultSession.getCacheSize(); } catch {}
  return { ok: true, apiCacheMB: Math.round(getApiCacheSize() / 1048576 * 10) / 10, sessionCacheMB: Math.round(sessionCache / 1048576 * 10) / 10, screenshots: fs.existsSync(screenshotsDir) ? fs.readdirSync(screenshotsDir).filter(x => /\.png$/i.test(x)).length : 0 };
});
ipcMain.handle('system:clear-api-cache', async () => {
  try { ensureApiCacheDir(); for (const f of fs.readdirSync(apiCacheDir)) { try { fs.unlinkSync(path.join(apiCacheDir, f)); } catch {} } return { ok:true }; } catch (e) { return { ok:false, error:String(e?.message || e) }; }
});
ipcMain.handle('system:status', async () => {
  const metrics = app.getAppMetrics();
  const memory = Math.round(process.memoryUsage().rss / 1048576);
  const sitePid = siteWc && !siteWc.isDestroyed() ? siteWc.getProcessId() : 0;
  const siteMetric = metrics.find(x => x.pid === sitePid);
  let api = null;
  try { api = await apiHealth(); } catch {}
  return { ok:true, uptime: Math.round(process.uptime()), memoryMB:memory, siteMemoryMB:siteMetric ? Math.round(siteMetric.memory.workingSetSize / 1024) : 0, api, gpu: app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : {}, cache: { apiCacheMB: Math.round(getApiCacheSize() / 1048576 * 10) / 10 }, performance: config.performance, autoRecovery: config.autoRecovery !== false };
});
ipcMain.handle('profiles:get', () => ({ ok:true, profiles: config.profiles || {} }));
ipcMain.handle('profiles:save', (_, name, data) => {
  const key = String(name || '').trim().slice(0, 40);
  if (!key) return { ok:false, error:'Пустое имя профиля' };
  if (!config.profiles || typeof config.profiles !== 'object') config.profiles = {};
  config.profiles[key] = { ...(data && typeof data === 'object' ? data : {}), updatedAt: Date.now() };
  saveConfig();
  return { ok:true, profiles:config.profiles };
});
ipcMain.handle('profiles:delete', (_, name) => {
  const key = String(name || '');
  if (config.profiles && Object.prototype.hasOwnProperty.call(config.profiles, key)) delete config.profiles[key];
  saveConfig();
  return { ok:true, profiles:config.profiles || {} };
});
ipcMain.handle('profiles:load', (_, name) => ({ ok:!!config.profiles?.[String(name || '')], profile:config.profiles?.[String(name || '')] || null }));

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
ipcMain.handle('media:state', async () => { const state = await getMediaState(); return { available: !!state, url: String(siteWc?.getURL?.() || ''), ...(state || {}) }; });
ipcMain.handle('media:speed', async (_, value) => { try { return { ok:true, speed: await setPlaybackSpeed(value) }; } catch (e) { return { ok:false, error:String(e?.message || e) }; } });
ipcMain.handle('media:pip', async () => { try { return await togglePictureInPicture(); } catch (e) { return { ok:false, reason:String(e?.message || e) }; } });
ipcMain.handle('media:options', async () => { try { return await inspectPlaybackOptions(); } catch (e) { return { quality:[], dubbing:[], sources:[], error:String(e?.message || e) }; } });
ipcMain.handle('media:select-option', async (_, kind, value) => { try { return await selectPlaybackOption(kind, value); } catch (e) { return { ok:false, reason:String(e?.message || e) }; } });
ipcMain.handle('media:smart-select', async (_, preferences) => { try { return await smartSelectPlayback(preferences || {}); } catch (e) { return { ok:false, error:String(e?.message || e) }; } });
ipcMain.handle('media:fallback', async (_, preferences) => { try { return await smartFallback(preferences || {}); } catch (e) { return { ok:false, error:String(e?.message || e) }; } });
ipcMain.on('media:mute', () => setMuted(null).then(v => { if (v && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'volume', value: v.volume, muted: v.muted }); }));
ipcMain.on('media:seek', (_, seconds) => { const n = Number(seconds) || 0; seekVideo(n).then(ok => { if (ok && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'seek', value: n }); }); });
ipcMain.on('media:action', (_, action) => mediaAction(action));
startMediaPolling();
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
    width: 520,
    height: 690,
    minWidth: 440,
    minHeight: 560,
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
  registerProtocol();
  if (!config.startupPolicyFixed) {
    config.autostart = false;
    config.startupPolicyFixed = true;
    try { app.setLoginItemSettings({ openAtLogin: false }); } catch {}
    saveConfig();
  }
  createWindow();
  ensureTray();

  setTimeout(() => {
    checkUpdate().catch(() => {});
  }, 1200);

  if (process.argv.includes('--settings')) setTimeout(() => win?.webContents.send('open-settings'), 900);
  if (process.argv.includes('--reload')) setTimeout(() => win?.webContents.send('restart-webview'), 1200);
  registerGlobalHotkeys();
  handleStartupDeepLink(process.argv);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  saveWindowState();
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => app.quit());
