const { app, BrowserWindow, ipcMain, shell, Tray, Notification, screen, globalShortcut, session, dialog, nativeImage, clipboard } = require('electron');
const { createUpdateManager } = require('./update-manager');
const { createMainWindowFactory } = require('./main-window');
const { createAccessKeyManager } = require('./access-key-manager');
const { createWatchLibrary } = require('./watch-library');
const { createNetworkManager } = require('./network-manager');
const { createSettingsIpc } = require('./settings-ipc');
const { createMediaController } = require('./media-controller');
const path = require('node:path');
const fs = require('node:fs');
const { fileURLToPath } = require('node:url');

const { DiscordRPC } = require('./discord-rpc');
const { SITE_RE, TELEGRAM_RE, APP_VERSION, compareVersions } = require('./modules');
const { parseProxyEndpoint, buildDiscordActivity, DEFAULT_DISCORD_RPC_SETTINGS } = require('./utils');
const { API_BASE, API_VERSION, request: apiRequest, get: apiGet, post: apiPost, health: apiHealth } = require('./api-client');
const configPath = path.join(app.getPath('userData'), 'config.json');
const accessKeyPath = path.join(app.getPath('userData'), 'access-key.json');
const screenshotsDir = path.join(app.getPath('pictures'), 'AnimeOn');

function isTrustedAppEvent(event) {
  try {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame) return false;
    const url = new URL(frame.url);
    if (url.protocol !== 'file:') return false;
    const filePath = path.resolve(fileURLToPath(url));
    const relative = path.relative(path.resolve(__dirname, '..'), filePath);
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function isTrustedAuthUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'accounts.google.com' || host === 'apis.google.com' ||
      host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com') ||
      host === 'oauth.telegram.org' || host === 'telegram.org' || host.endsWith('.telegram.org');
  } catch {
    return false;
  }
}

function isAuthFlowUrl(value) {
  if (isTrustedAuthUrl(value)) return true;
  try {
    const url = new URL(value);
    return SITE_RE.test(url.href) && /\/(login|signin|auth|oauth)(?:\/|$)/i.test(url.pathname);
  } catch {
    return false;
  }
}

let config = {
  theme: 'violet',
  custom: '#8b5cf6',
  site: 'co',
  siteList: [
    { id: 'one', url: 'https://animeon.cc/', label: 'animeon.cc' },
    { id: 'two', url: 'https://v2.animeon.co/', label: 'v2.animeon.co' },
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
  autoHide: false,
  closeBehavior: 'ask',
  alwaysOnTop: false,
  hotkeys: {},
  customCss: { cc: '', co: '' },
  smoothSite: true,
  showSiteScrollbars: false,
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
  accessKeyEnabled: false,
  accessKeyPromptDismissed: false,
  api: { baseUrl: API_BASE, clientVersion: API_VERSION, timeout: 10000 },
  playbackPositions: {},
  playbackSpeed: 1,
  resumeEnabled: true,
  autoNext: false,
  watchNotes: [],
  library: { favorites: [], continueWatching: [], localHistory: [] },
  autoUpdate: true,
  silentUpdates: true,
  lastGoodVersion: app.getVersion(),
  rollbackVersion: null,
  discordRpc: { ...DEFAULT_DISCORD_RPC_SETTINGS },
};

try {
  Object.assign(config, JSON.parse(fs.readFileSync(configPath, 'utf8')));
} catch {}
if (!Array.isArray(config.siteList) || config.siteList.length < 2) {
  config.siteList = [
    { id: 'one', url: 'https://animeon.cc/', label: 'animeon.cc' },
    { id: 'two', url: 'https://v2.animeon.co/', label: 'v2.animeon.co' },
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
if (typeof config.showSiteScrollbars !== 'boolean') config.showSiteScrollbars = false;
if (typeof config.autoMirror !== 'boolean') config.autoMirror = true;
if (!config.network || typeof config.network !== 'object') config.network = { mode: 'system', host: '', port: 0, user: '', pass: '', doh: false };
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
if (!Array.isArray(config.watchNotes)) config.watchNotes = [];
config.watchNotes = config.watchNotes.slice(-1000);
delete config.subtitleSettings;
delete config.spoilerProgress;
delete config.spoilerShield;
delete config.plugins;
delete config.safeMode;
if (!config.library || typeof config.library !== 'object') config.library = { favorites: [], continueWatching: [], localHistory: [] };
for (const key of ['favorites','continueWatching','localHistory']) if (!Array.isArray(config.library[key])) config.library[key] = [];
if (config.api.baseUrl !== API_BASE) config.api.baseUrl = API_BASE;
if (!Number.isFinite(Number(config.api.timeout))) config.api.timeout = 10000;
if (typeof config.lastUrl !== 'string') config.lastUrl = '';
if (typeof config.startupPolicyFixed !== 'boolean') config.startupPolicyFixed = false;
if (typeof config.autoUpdate !== 'boolean') config.autoUpdate = true;
if (typeof config.silentUpdates !== 'boolean') config.silentUpdates = true;
delete config.updateChannel;
if (typeof config.lastGoodVersion !== 'string') config.lastGoodVersion = app.getVersion();
if (!config.rollbackVersion || typeof config.rollbackVersion !== 'string') config.rollbackVersion = null;
config.discordRpc = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...(config.discordRpc && typeof config.discordRpc === 'object' ? config.discordRpc : {}) };
delete config.discordRpc.showDubbing;
config.accessKeyEnabled = config.accessKeyEnabled === true;
config.accessKeyPromptDismissed = config.accessKeyPromptDismissed === true;

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

if (Object.hasOwn(config, 'watchStats')) {
  delete config.watchStats;
  saveConfig();
}

function ensureRollbackDir() {
  const dir = path.join(app.getPath('userData'), 'rollback');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
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
if (process.argv.includes('--disable-gpu')) app.disableHardwareAcceleration();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let quitting = false;
let tray = null;
let trayMenuWin = null;
let telegramWin = null;
let siteWc = null;
let lastMediaState = null;
let sleepTimerHandle = null;
let powerPausedBySystem = false;
let discordRPC = null;
let discordActivityTimer = null;
let discordRpcRevision = 0;
const accessKeyManager = createAccessKeyManager({
  app,
  fs,
  ipcMain,
  path,
  session,
  accessKeyPath,
  config,
  sitePattern: SITE_RE,
  isTrustedAppEvent,
  saveConfig,
  getWindow: () => win,
  setQuitting: (value) => { quitting = value; },
});
const networkManager = createNetworkManager({
  app,
  session,
  ipcMain,
  config,
  parseProxyEndpoint,
  saveConfig,
  writeLog,
  apiHealth,
  getWindow: () => win,
});
const { applyNetworkSettings } = networkManager;
const watchLibrary = createWatchLibrary({
  ipcMain,
  fs,
  path,
  nativeImage,
  shell,
  clipboard,
  screenshotsDir,
  getWindow: () => win,
  getSiteContents: () => siteWc,
  getLatestMediaState: () => lastMediaState,
  config,
  saveConfig,
  isTrustedAppEvent,
  pageLabel,
  sanitizeName,
  writeLog,
});
const { takeScreenshot } = watchLibrary;
const settingsIpc = createSettingsIpc({
  ipcMain,
  app,
  config,
  dialog,
  fs,
  path,
  shell,
  clipboard,
  session,
  getWindow: () => win,
  getSiteContents: () => siteWc,
  saveConfig,
  applySideEffects,
  applyDiscordRpcRuntime,
  normalizePageUrl,
  rememberRecentPage,
  pageLabel,
  setSleepTimer,
  logPath: path.join(app.getPath('userData'), 'animeon.log'),
  screenshotsDir,
  apiHealth,
  apiBase: API_BASE,
  apiVersion: API_VERSION,
  discordDefaults: DEFAULT_DISCORD_RPC_SETTINGS,
});
const registeredHotkeyAccelerators = new Set();
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
    const width = Math.max(480, Math.min(7680, Number(data.width) || defaults.width));
    const height = Math.max(360, Math.min(4320, Number(data.height) || defaults.height));
    let x = Number.isFinite(Number(data.x)) ? Number(data.x) : undefined;
    let y = Number.isFinite(Number(data.y)) ? Number(data.y) : undefined;
    if (x !== undefined && y !== undefined) {
      try {
        const inside = screen.getAllDisplays().some((d) => {
          const a = d.workArea || d.bounds;
          return x >= a.x - width + 80 && x <= a.x + a.width - 80 && y >= a.y - 40 && y <= a.y + a.height - 40;
        });
        if (!inside) { x = undefined; y = undefined; }
      } catch {}
    }
    return { width, height, x, y, maximized: !!data.maximized };
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

const mediaController = createMediaController({
  ipcMain,
  config,
  saveConfig,
  getWindow: () => win,
  getSiteContents: () => siteWc,
  getTray: () => tray,
  getLatestMediaState: () => lastMediaState,
  setLatestMediaState: (value) => { lastMediaState = value; },
  isTrustedAppEvent,
  updateMediaSession,
  updateThumbar,
  updateDiscordActivity,
});
const {
  applyPlaybackPreferences,
  applyVolumeToGuest,
  mediaAction,
  seekVideo,
  setMuted,
  setVolume,
  startMediaPolling,
  togglePlayback,
} = mediaController;

const createWindow = createMainWindowFactory({
  app,
  BrowserWindow,
  fs,
  path,
  nativeImage,
  appDir: __dirname,
  config,
  loadWindowState,
  handleLocalHotkey,
  isQuitting: () => quitting,
  setWindow: (value) => { win = value; },
  ensureTray,
  saveWindowState,
  setupJumpList,
  applyNetworkSettings,
  setSiteContents: (value) => { siteWc = value; },
  setTaskbarOverlay,
  applyPlaybackPreferences,
  applyVolumeToGuest,
  buildVisualCss,
  rememberRecentPage,
  TELEGRAM_RE,
  SITE_RE,
  isTrustedAuthUrl,
  isAuthFlowUrl,
  shell,
  openTelegramExternal,
});

let thumbarIcons = null;
function generateThumbarIcons() {
  if (thumbarIcons) return thumbarIcons;
  const { nativeImage } = require('electron');
  const size = 16;
  function makeBuffer(draw) {
    const buf = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const v = draw(x, y) ? 255 : 0;
        buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = v;
      }
    }
    return nativeImage.createFromBuffer(buf, { width: size, height: size });
  }
  const play = makeBuffer((x, y) => x > 4 && x < 12 && y > 2 && y < 14 && (x - 4) * 1.5 > Math.abs(y - 8));
  const pause = makeBuffer((x, y) => (x >= 3 && x <= 6) || (x >= 10 && x <= 13));
  const next = makeBuffer((x, y) => (x >= 10 && x <= 13) || (x > 2 && x < 10 && y > 2 && y < 14 && (x - 2) * 1.5 > Math.abs(y - 8)));
  const prev = makeBuffer((x, y) => (x >= 3 && x <= 6) || (x > 6 && x < 14 && y > 2 && y < 14 && (14 - x) * 1.5 > Math.abs(y - 8)));
  thumbarIcons = { play, pause, next, prev };
  return thumbarIcons;
}

function updateThumbar(state) {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
  try {
    if (!state?.available) { win.setThumbarButtons([]); return; }
    const icons = generateThumbarIcons();
    const isPaused = !!state.paused;
    win.setThumbarButtons([
      { icon: icons.prev, tooltip: 'Предыдущая', flags: ['enabled'], click: () => mediaAction('previous') },
      { icon: isPaused ? icons.play : icons.pause, tooltip: isPaused ? 'Играть' : 'Пауза', flags: ['enabled'], click: () => mediaAction('playpause') },
      { icon: icons.next, tooltip: 'Следующая', flags: ['enabled'], click: () => mediaAction('next') },
    ]);
  } catch {}
}

function toggleAlwaysOnTop() {
  if (!win || win.isDestroyed()) return;
  config.alwaysOnTop = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(config.alwaysOnTop);
  saveConfig();
  win.webContents.send('always-on-top', config.alwaysOnTop);
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
  if (input.meta) parts.push('Super');
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

function normalizeHotkeyAccelerator(value) {
  return String(value || '').trim().split('+').map((part) =>
    /^command$/i.test(part.trim()) ? 'Super' : part.trim()).join('+');
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
    const accelerator = normalizeHotkeyAccelerator(keys[key]);
    if (!accelerator || accelerator.toLowerCase() !== normalized) continue;
    if (registeredHotkeyAccelerators.has(normalized)) {
      if (event) event.preventDefault();
      return true;
    }
    try { action(); } catch (error) { console.error(`[AnimeOn] Hotkey ${key} failed:`, error); }
    if (event) event.preventDefault();
    return true;
  }
  return false;
}

function registerGlobalHotkeys() {
  globalShortcut.unregisterAll();
  registeredHotkeyAccelerators.clear();
  const registered = [];
  const failed = [];
  const shortcuts = [
    ['MediaPlayPause', 'MediaPlayPause', () => mediaAction('playpause')],
    ['MediaNextTrack', 'MediaNextTrack', () => mediaAction('next')],
    ['MediaPreviousTrack', 'MediaPreviousTrack', () => mediaAction('previous')],
  ];
  const actions = localHotkeyActions();
  const bindings = config.hotkeys && typeof config.hotkeys === 'object' ? config.hotkeys : {};
  const accelerators = new Set(shortcuts.map(([, accelerator]) => accelerator.toLowerCase()));
  for (const [key, action] of Object.entries(actions)) {
    const accelerator = normalizeHotkeyAccelerator(bindings[key]);
    if (!accelerator) continue;
    const normalized = accelerator.toLowerCase();
    if (accelerators.has(normalized)) {
      failed.push({ key, accelerator, reason: 'duplicate' });
      continue;
    }
    accelerators.add(normalized);
    shortcuts.push([key, accelerator, action]);
  }
  for (const [key, accelerator, action] of shortcuts) {
    try {
      if (globalShortcut.register(accelerator, action)) {
        registered.push({ key, accelerator });
        if (actions[key]) registeredHotkeyAccelerators.add(accelerator.toLowerCase());
      } else failed.push({ key, accelerator, reason: 'unavailable' });
    } catch (error) {
      failed.push({ key, accelerator, reason: String(error?.message || error) });
    }
  }
  return { registered, failed, mode: 'global' };
}

function showMainWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function ensureTray() {
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
  const [w, h] = [220, 158];
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
  if (!isTrustedAppEvent(e)) { e.returnValue = null; return; }
  e.returnValue = config;
});

ipcMain.on('cfg:set', (event, patch) => {
  if (!isTrustedAppEvent(event) || !patch || typeof patch !== 'object' || Array.isArray(patch)) return;
  const safePatch = { ...patch };
  delete safePatch.accessKeyEnabled;
  Object.assign(config, safePatch);
  saveConfig();
  applySideEffects(safePatch);
});

accessKeyManager.registerIpc();

ipcMain.handle('discord:settings:set', (_, patch) => {
  if (!patch || typeof patch !== 'object') return { ok: false, error: 'invalid settings' };
  config.discordRpc = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...config.discordRpc };
  for (const key of Object.keys(DEFAULT_DISCORD_RPC_SETTINGS)) {
    if (typeof patch[key] === 'boolean') config.discordRpc[key] = patch[key];
  }
  saveConfig();
  applyDiscordRpcRuntime();
  return { ok: true, settings: config.discordRpc };
});

settingsIpc.registerIpc();

ipcMain.on('open-external', (event, value) => {
  if (!isTrustedAppEvent(event)) return;
  try {
    const url = new URL(String(value || ''));
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'tg:') shell.openExternal(url.href);
  } catch {}
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

ipcMain.on('win:minimize', () => win?.minimize());
ipcMain.on('win:maximize-toggle', () => {
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win:close', () => win?.close());
ipcMain.on('win:fullscreen', () => {
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
});

networkManager.registerIpc();

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

watchLibrary.registerIpc();
ipcMain.on('site:navigate', (_, url) => {
  if (!siteWc || siteWc.isDestroyed() || !SITE_RE.test(String(url))) return;
  try { siteWc.loadURL(String(url)); } catch {}
});

mediaController.registerIpc();

ipcMain.on('app:open-browser', () => {
  try { if (siteWc && !siteWc.isDestroyed()) shell.openExternal(siteWc.getURL()).catch(() => {}); } catch {}
});

startMediaPolling();
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

const { checkUpdate } = createUpdateManager({
  app,
  BrowserWindow,
  Notification,
  ipcMain,
  config,
  compareVersions,
  ensureRollbackDir,
  getWindow: () => win,
  isTrustedAppEvent,
  saveConfig,
  setQuitting: (value) => { quitting = value; },
});

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

app.whenReady().then(async () => {
  registerProtocol();
  await accessKeyManager.initialize();
  if (!config.startupPolicyFixed) {
    config.autostart = false;
    config.startupPolicyFixed = true;
    try { app.setLoginItemSettings({ openAtLogin: false }); } catch {}
    saveConfig();
  }
  createWindow();
  ensureTray();

  const { powerMonitor } = require('electron');
  powerMonitor.on('suspend', () => { try { if (lastMediaState && !lastMediaState.paused) { togglePlayback(); powerPausedBySystem = true; } } catch {} });
  powerMonitor.on('lock-screen', () => { try { if (lastMediaState && !lastMediaState.paused) { togglePlayback(); powerPausedBySystem = true; } } catch {} });
  powerMonitor.on('resume', () => { try { if (powerPausedBySystem) { togglePlayback(); powerPausedBySystem = false; } } catch {} });
  powerMonitor.on('unlock-screen', () => { try { if (powerPausedBySystem) { togglePlayback(); powerPausedBySystem = false; } } catch {} });

  discordRPC = new DiscordRPC();
  if (config.discordRpc.enabled) discordRPC.connect().catch(() => {});
  discordActivityTimer = setInterval(() => updateDiscordActivity(), 15000);
  updateDiscordActivity();

  const allowedPermissions = new Set(['notifications', 'fullscreen']);
  const isTrustedSiteContents = (wc) => {
    try { return SITE_RE.test(wc.getURL()); } catch { return false; }
  };
  const configureSitePermissions = (siteSession) => {
    siteSession.setPermissionRequestHandler((wc, permission, callback) => {
      callback(isTrustedSiteContents(wc) && allowedPermissions.has(permission));
    });
    siteSession.setPermissionCheckHandler((wc, permission) => {
      return !!wc && isTrustedSiteContents(wc) && allowedPermissions.has(permission);
    });
  };
  configureSitePermissions(session.defaultSession);
  try { configureSitePermissions(session.fromPartition('persist:animeon')); } catch {}

  process.on('uncaughtException', (e) => writeLog('error', 'uncaughtException', { error: String(e?.stack || e) }));
  process.on('unhandledRejection', (e) => writeLog('error', 'unhandledRejection', { error: String(e?.stack || e) }));

  setTimeout(() => { checkUpdate().catch(() => {}); networkManager.startMirrorHealthCheck(); }, 1200);

  if (process.argv.includes('--settings')) setTimeout(() => win?.webContents.send('open-settings'), 900);
  if (process.argv.includes('--reload')) setTimeout(() => win?.webContents.send('restart-webview'), 1200);
  registerGlobalHotkeys();
  handleStartupDeepLink(process.argv);
}).catch((error) => {
  console.error('[AnimeOn] Не удалось безопасно запустить приложение:', error);
  dialog.showErrorBox('AnimeOn не запущен', `Не удалось проверить защиту доступа и cookies аккаунта.\n\n${String(error?.message || error)}`);
  app.quit();
});

function applyDiscordRpcRuntime() {
  if (!discordRPC) return;
  const rpc = discordRPC;
  const revision = ++discordRpcRevision;
  if (!config.discordRpc?.enabled) {
    const clear = rpc.ready ? rpc.clearActivity() : Promise.resolve();
    clear.then(() => {
      if (discordRPC === rpc && discordRpcRevision === revision && !config.discordRpc?.enabled) rpc.disconnect();
    }, () => {
      if (discordRPC === rpc && discordRpcRevision === revision && !config.discordRpc?.enabled) rpc.disconnect();
    });
    return;
  }
  if (!rpc.ready) rpc.connect().then(() => updateDiscordActivity()).catch(() => {});
  updateDiscordActivity();
}

function updateDiscordActivity() {
  const settings = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...config.discordRpc };
  if (!discordRPC || !discordRPC.ready || !settings.enabled) return;
  const state = lastMediaState;
  if (!state || !state.available) {
    if (!settings.showWhenIdle) {
      discordRPC.clearActivity().catch(() => {});
      return;
    }
    const currentUrl = String(siteWc?.getURL?.() || '');
    const idleUrl = SITE_RE.test(currentUrl) ? currentUrl : (config.siteList?.[config.site === 'co' ? 1 : 0]?.url || 'https://animeon.cc/');
    let idleText = 'В главном меню';
    try {
      const pathname = new URL(idleUrl).pathname;
      if (/\/anime\//i.test(pathname)) idleText = 'Выбирает серию';
      else if (pathname !== '/') idleText = 'Просматривает AnimeOn';
    } catch {}
    discordRPC.setActivity(buildDiscordActivity({ idle: true, idleText, animeUrl: idleUrl }, settings)).catch(() => {});
    return;
  }
  discordRPC.setActivity(buildDiscordActivity(state, settings)).catch(() => {});
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  saveWindowState();
  if (discordActivityTimer) clearInterval(discordActivityTimer);
  if (discordRPC) discordRPC.disconnect();
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => app.quit());
