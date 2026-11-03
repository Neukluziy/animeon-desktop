const { app, BrowserWindow, ipcMain: electronIpcMain, webContents, shell, Tray, Notification, screen, globalShortcut, session, dialog, nativeImage, clipboard, safeStorage, powerMonitor } = require('electron');
const { createUpdateManager } = require('./update-manager');
const { createMainWindowFactory } = require('./main-window');
const { createAccessKeyManager } = require('./access-key-manager');
const { createAccountManager } = require('./accounts');
const { createNotificationPollIpc } = require('./notification-poll');
const { createWindowStateStore } = require('./window-state');
const { createTelegramWindowManager } = require('./telegram-window');
const { registerAppControlIpc } = require('./ipc/app-controls');
const { createUserDataStore } = require('./user-data-store');
const { createWatchLibrary } = require('./watch-library');
const { createNetworkManager } = require('./network-manager');
const { createSettingsIpc } = require('./settings-ipc');
const { createMediaController } = require('./media-controller');
const { ConfigStore } = require('./config-store');
const { createProtocolHandler } = require('./protocol');
const { createTaskbarController } = require('./taskbar');
const { createHotkeyManager } = require('./hotkeys');
const { createSleepTimer } = require('./power');
const { createTrayController } = require('./tray');
const { createPageHistory } = require('./page-history');
const { buildSiteVisualCss } = require('./site-visual-css');
const { createWindowActions } = require('./window-actions');
const { createUrlPolicy } = require('./url-policy');
const { createWindowContext } = require('./window-context');
const { createSideEffectManager } = require('./side-effects');
const { registerAppUtilityIpc } = require('./ipc/app-utilities');
const { createMediaSession } = require('./media-session');
const { registerAppLifecycle } = require('./lifecycle');
const { createCacheMaintenance } = require('./cache-maintenance');
const { registerWindowLifecycle } = require('./window-lifecycle');
const { createAppLogger } = require('./logging');
const { registerFeatureIpc } = require('./ipc/index');
const path = require('node:path');
const fs = require('node:fs');
const { accountPartition, normalizeAccounts, createAccount } = require('../shared/accounts');
const { MAIN_WINDOW_ID, MAX_APP_WINDOWS, normalizeWindowStates } = require('../shared/window-state');
const {
  CURRENT_CONFIG_SCHEMA_VERSION,
  PROTECTED_CONFIG_FIELDS,
  migrateConfig,
  sanitizeConfig,
  sanitizeConfigPatch,
} = require('../shared/config-schema');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { fileURLToPath } = require('node:url');
const { createValidatedIpcMain } = require('./ipc');
const {
  APP_PROTOCOL,
  APP_VERSION,
  BYTES_PER_MEGABYTE,
  CACHE_CLEANUP_DELAY_MS,
  CACHE_CLEANUP_INTERVAL_MS,
  CONFIG_SAVE_DEBOUNCE_MS,
  DEFAULT_CACHE_LIMIT_MB,
  DEFAULT_SITE_LIST,
  DEFAULT_WINDOW_SIZE,
  DISCORD_ACTIVITY_INTERVAL_MS,
  MAX_LOG_ENTRIES,
  APP_REVEAL_FALLBACK_DELAY_MS,
  INACTIVE_TAB_UNLOAD_DELAY_MS,
  NOTIFICATION_INITIAL_POLL_DELAY_MS,
  NOTIFICATION_POLL_INTERVAL_MS,
  SITE_RE,
  SETTINGS_OPEN_DELAY_MS,
  STARTUP_BACKGROUND_CHECK_DELAY_MS,
  STARTUP_DEEP_LINK_DELAY_MS,
  TELEGRAM_RE,
} = require('../shared/constants');
const { copyFileAtomically, writeFileAtomically } = require('./persistence');

performance.mark('animeon-start');
const { createDiscordRuntime } = require('./discord-runtime');
const { compareVersions, parseProxyEndpoint, DEFAULT_DISCORD_RPC_SETTINGS, safe, safeAsync } = require('./utils');
const { API_BASE, API_VERSION, get: apiGet, health: apiHealth } = require('./api-client');
const configPath = path.join(app.getPath('userData'), 'config.json');
const logPath = path.join(app.getPath('userData'), 'animeon.log');
const userDataStore = createUserDataStore({ userDataPath: app.getPath('userData'), fs, path });
const accessKeyPath = path.join(app.getPath('userData'), 'access-key.json');
const screenshotsDir = path.join(app.getPath('pictures'), 'AnimeOn');

const { isTrustedAppEvent, isTrustedAuthUrl, isAuthFlowUrl } = createUrlPolicy({
  path,
  fileURLToPath,
  appRoot: path.resolve(__dirname, '..'),
  sitePattern: SITE_RE,
});

const ipcMain = createValidatedIpcMain(electronIpcMain, isTrustedAppEvent, (channel, reason) => {
  writeLog('warn', 'Rejected IPC event', { channel, reason });
});

const config = {
  schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
  theme: 'violet',
  colorMode: 'dark',
  titleDisplay: 'brand',
  lastSeenVersion: '',
  onboardingComplete: false,
  reduceMotion: false,
  highContrast: false,
  showSplash: true,
  glassWindow: false,
  custom: '#8b5cf6',
  site: 'co',
  siteList: DEFAULT_SITE_LIST.map((site) => ({ ...site })),
  network: { mode: 'system', host: '', port: 0, user: '', pass: '', doh: false },
  autoMirror: true,
  remember: '0',
  notify: false,
  autostart: false,
  tray: false,
  compact: false,
  confirmClose: false,
  autoRecovery: true,
  performance: 'balanced',
  effectMode: 'full',
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
  cacheLimitMB: DEFAULT_CACHE_LIMIT_MB,
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
  accounts: [],
  activeAccountId: 'default',
  windowStates: {},
};

const configDefaults = JSON.parse(JSON.stringify(config));
const configStore = new ConfigStore({
  config,
  defaults: configDefaults,
  configPath,
  fs,
  userDataStore,
  migrateConfig,
  sanitizeConfig,
  copyFileAtomically,
  writeFileAtomically,
  logger: { error: (message) => process.stderr.write(`${message}\n`) },
  debounceMs: CONFIG_SAVE_DEBOUNCE_MS,
});
const { loadError: configLoadError, recoveredFromBackup: configRecoveredFromBackup } = configStore.load();
const userDataRecoveryIssues = userDataStore.load(config);
normalizeAccounts(config);
if (!Array.isArray(config.siteList) || config.siteList.length < 2) {
  config.siteList = DEFAULT_SITE_LIST.map((site) => ({ ...site }));
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
normalizeWindowStates(config);
if (!config.sleepTimer || typeof config.sleepTimer !== 'object') config.sleepTimer = { enabled:false, minutes:0, action:'pause' };
if (!Array.isArray(config.errorLog)) config.errorLog = [];
if (typeof config.doNotDisturb !== 'boolean') config.doNotDisturb = false;
if (typeof config.autoCacheCleanup !== 'boolean') config.autoCacheCleanup = true;
if (!Number.isFinite(Number(config.cacheLimitMB))) config.cacheLimitMB = DEFAULT_CACHE_LIMIT_MB;
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

const buildVisualCss = () => buildSiteVisualCss(config);

function saveConfig() {
  configStore.save();
}

const { flushLogWrites, markStartup, writeLog } = createAppLogger({
  fs,
  logPath,
  config,
  maxEntries: MAX_LOG_ENTRIES,
  saveConfig,
  performance,
});

const pageHistory = createPageHistory({ config, sitePattern: SITE_RE, saveConfig });
const { normalizePageUrl, pageLabel, rememberRecentPage, sanitizeName } = pageHistory;

async function flushConfig() {
  await configStore.flush();
  await flushLogWrites();
}
saveConfig();

if (Object.hasOwn(config, 'watchStats')) {
  delete config.watchStats;
  saveConfig();
}

async function ensureRollbackDir() {
  const dir = path.join(app.getPath('userData'), 'rollback');
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.argv.includes('--disable-gpu')) app.disableHardwareAcceleration();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;
let quitting = false;
let trayController = null;
let siteWc = null;
let lastMediaState = null;
let discordRuntime = null;
const windowIdsByBrowserId = new Map();
const windowSiteContents = new Map();
const approvedCloseWindows = new Set();
const windowContext = createWindowContext({
  BrowserWindow,
  config,
  isTrustedAppEvent,
  windowIdsByBrowserId,
  windowSiteContents,
  getActiveSiteContents: () => siteWc,
  setActiveSiteContents: (contents) => { siteWc = contents; },
  writeLog,
});
const { windowIdForBrowserWindow, getWindowContext, getWindowSiteContents, clearWindowSiteContents } = windowContext;
const { applySideEffects } = createSideEffectManager({
  app,
  BrowserWindow,
  config,
  isAppWindow: (browserWindow) => windowIdsByBrowserId.has(browserWindow.id),
  getTrayController: () => trayController,
  ensureTray: () => ensureTray(),
  registerGlobalHotkeys: () => registerGlobalHotkeys(),
  writeLog,
});
const protocolHandler = createProtocolHandler({
  app,
  path,
  scheme: APP_PROTOCOL,
  sitePattern: SITE_RE,
  getSiteContents: () => siteWc,
  getSiteList: () => config.siteList,
  showMainWindow: () => showMainWindow(),
  writeLog: (...args) => writeLog(...args),
  startupDelayMs: STARTUP_DEEP_LINK_DELAY_MS,
});
trayController = createTrayController({
  Tray,
  BrowserWindow,
  screen,
  nativeImage,
  shell,
  path,
  appDir: __dirname,
  getWindow: () => win,
  showMainWindow: () => showMainWindow(),
  getConfig: () => config,
  getSiteContents: () => siteWc,
  mediaAction: (action) => mediaController.mediaAction(action),
  quit: () => {
    quitting = true;
    app.quit();
  },
});
const sleepTimerService = createSleepTimer({
  config,
  app,
  togglePlayback: () => togglePlayback(),
  ensureTray: () => trayController.ensureTray(),
  getWindow: () => win,
  saveConfig,
  setQuitting: (value) => { quitting = value; },
  writeLog: (...args) => writeLog(...args),
});
const accessKeyManager = createAccessKeyManager({
  app,
  fs,
  ipcMain,
  path,
  session,
  accessKeyPath,
  safeStorage,
  config,
  sitePattern: SITE_RE,
  isTrustedAppEvent,
  saveConfig,
  writeLog,
  getWindow: () => win,
  setQuitting: (value) => { quitting = value; },
});
const networkManager = createNetworkManager({
  app,
  session,
  ipcMain,
  config,
  accountPartition,
  parseProxyEndpoint,
  saveConfig,
  writeLog,
  apiHealth,
  getWindow: () => win,
  sitePattern: SITE_RE,
  isPlaybackActive: () => !!(lastMediaState && !lastMediaState.paused && !lastMediaState.ended),
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
  configDefaults,
  dialog,
  fs,
  path,
  shell,
  clipboard,
  session,
  getWindow: () => win,
  getSiteContents: () => siteWc,
  getWindowContext,
  getWindowSiteContents,
  getAllSiteContents: () => [...windowSiteContents.values()].filter((guest) => guest && !guest.isDestroyed()),
  saveConfig,
  writeLog,
  applySideEffects,
  applyDiscordRpcRuntime,
  normalizePageUrl,
  rememberRecentPage,
  pageLabel,
  setSleepTimer,
  logPath: path.join(app.getPath('userData'), 'animeon.log'),
  screenshotsDir,
  apiBase: API_BASE,
  apiVersion: API_VERSION,
  discordDefaults: DEFAULT_DISCORD_RPC_SETTINGS,
});
for (const issue of userDataRecoveryIssues) {
  writeLog('warn', 'Corrupt user data was recovered from legacy settings or defaults', {
    file: issue.file,
    error: String(issue.error?.message || issue.error),
    corruptPath: issue.corruptPath,
    backupError: issue.backupError ? String(issue.backupError?.message || issue.backupError) : null,
  });
}
const originalConsoleError = console.error;
console.error = (...args) => { originalConsoleError(...args); writeLog('error', args.map(String).join(' ')); };
const originalConsoleWarn = console.warn;
console.warn = (...args) => { originalConsoleWarn(...args); writeLog('warn', args.map(String).join(' ')); };
if (configLoadError) {
  writeLog('error', configRecoveredFromBackup ? 'Invalid config file; the backup was restored' : 'Invalid config file; defaults were loaded', {
    error: String(configLoadError?.message || configLoadError),
    backupError: configLoadError.backupError ? String(configLoadError.backupError?.message || configLoadError.backupError) : null,
    corruptCopyError: configLoadError.corruptCopyError ? String(configLoadError.corruptCopyError?.message || configLoadError.corruptCopyError) : null,
    restoreError: configLoadError.restoreError ? String(configLoadError.restoreError?.message || configLoadError.restoreError) : null,
  });
}
markStartup('config-loaded');
function setSleepTimer(minutes, action='pause') {
  return sleepTimerService.set(minutes, action);
}
const { getAccountSessions } = createCacheMaintenance({
  config,
  session,
  accountPartition,
  safe,
  writeLog,
  bytesPerMegabyte: BYTES_PER_MEGABYTE,
  defaultCacheLimitMb: DEFAULT_CACHE_LIMIT_MB,
  cleanupDelayMs: CACHE_CLEANUP_DELAY_MS,
  cleanupIntervalMs: CACHE_CLEANUP_INTERVAL_MS,
});
const { extractDeepLink, openDeepLink, register: registerProtocol, handleStartup: handleStartupDeepLink } = protocolHandler;

const updateMediaSession = createMediaSession({
  getSiteContents: () => siteWc,
  getLastMediaState: () => lastMediaState,
  setLastMediaState: (state) => { lastMediaState = state; },
  writeLog,
});

function applyDiscordRpcRuntime() {
  discordRuntime?.applyRuntime();
}

function updateDiscordActivity() {
  discordRuntime?.updateActivity();
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

const { loadWindowState, saveWindowState } = createWindowStateStore({
  app,
  config,
  fs,
  path,
  screen,
  mainWindowId: MAIN_WINDOW_ID,
  defaultWindowSize: DEFAULT_WINDOW_SIZE,
  getWindow: () => win,
  writeFileAtomically,
  writeLog,
  saveConfig,
});

const telegramWindowManager = createTelegramWindowManager({
  BrowserWindow,
  path,
  appDir: __dirname,
  getParentWindow: () => win,
  shell,
  telegramPattern: TELEGRAM_RE,
  safeAsync,
  writeLog,
});

const taskbarController = createTaskbarController({
  getWindow: () => win,
  nativeImage,
  path,
  writeLog,
  mediaAction: (action) => mediaController.mediaAction(action),
});
const windowActions = createWindowActions({
  BrowserWindow,
  config,
  getWindow: () => win,
  getSiteContents: () => siteWc,
  isAppWindow: (browserWindow) => windowIdsByBrowserId.has(browserWindow.id),
  taskbarController,
  trayController,
  getMediaController: () => mediaController,
  takeScreenshot,
  shell,
  saveConfig,
  writeLog,
});
const {
  ensureTray,
  localHotkeyActions,
  setTaskbarOverlay,
  setupJumpList,
  showMainWindow,
  toggleAlwaysOnTop,
  updateThumbar,
} = windowActions;

const mediaController = createMediaController({
  ipcMain,
  config,
  saveConfig,
  getWindow: () => win,
  getSiteContents: () => siteWc,
  setTrayPlaybackState: (state) => trayController.setPlaybackState(state),
  getLatestMediaState: () => lastMediaState,
  setLatestMediaState: (value) => { lastMediaState = value; },
  isTrustedAppEvent,
  updateMediaSession,
  updateThumbar,
  updateDiscordActivity,
  writeLog,
});
const {
  applyPlaybackPreferences,
  applyVolumeToGuest,
  flushPlaybackPositions,
  handleSiteMediaState,
  startMediaPolling,
  togglePlayback,
} = mediaController;
const hotkeyManager = createHotkeyManager({
  globalShortcut,
  getBindings: () => config.hotkeys && typeof config.hotkeys === 'object' ? config.hotkeys : {},
  getActions: localHotkeyActions,
  onActionError: (key, error) => console.error(`[AnimeOn] Hotkey ${key} failed:`, error),
});

function handleLocalHotkey(...args) {
  return hotkeyManager.handleLocalHotkey(...args);
}

function registerGlobalHotkeys() {
  return hotkeyManager.registerGlobalHotkeys();
}

const createWindow = createMainWindowFactory({
  BrowserWindow,
  fs,
  path,
  nativeImage,
  appDir: __dirname,
  config,
  loadWindowState,
  handleLocalHotkey,
  isQuitting: () => quitting,
  setWindow: (value, windowId) => {
    win = value;
    windowIdsByBrowserId.set(value.id, windowId);
  },
  isWindowCloseApproved: (windowId) => {
    if (!approvedCloseWindows.has(windowId)) return false;
    approvedCloseWindows.delete(windowId);
    return true;
  },
  onWindowClosed: (windowId, browserWindow) => {
    const guest = windowSiteContents.get(windowId);
    if (guest === siteWc) siteWc = null;
    windowSiteContents.delete(windowId);
    windowIdsByBrowserId.delete(browserWindow.id);
    if (windowId !== MAIN_WINDOW_ID && !quitting) {
      delete config.windowStates[windowId];
      saveConfig();
    }
    if (win === browserWindow) {
      win = BrowserWindow.getAllWindows().find((item) => windowIdsByBrowserId.has(item.id)) || null;
      const focusedId = windowIdForBrowserWindow(win);
      siteWc = focusedId ? windowSiteContents.get(focusedId) || null : null;
    }
  },
  ensureTray,
  saveWindowState,
  setupJumpList,
  applyNetworkSettings,
  setSiteContents: (value, hostWebContents) => {
    const browserWindow = BrowserWindow.fromWebContents(hostWebContents);
    const windowId = windowIdForBrowserWindow(browserWindow);
    if (!windowId) return;
    windowSiteContents.set(windowId, value);
    if (browserWindow.isFocused()) siteWc = value;
  },
  setTaskbarOverlay,
  applyPlaybackPreferences,
  applyVolumeToGuest,
  onSiteMediaState: handleSiteMediaState,
  markStartup,
  buildVisualCss,
  rememberRecentPage,
  writeLog,
  TELEGRAM_RE,
  SITE_RE,
  isTrustedAuthUrl,
  isAuthFlowUrl,
  shell,
  openTelegramExternal: telegramWindowManager.openExternal,
});
registerWindowLifecycle({
  app,
  ipcMain,
  BrowserWindow,
  config,
  windowIdsByBrowserId,
  windowSiteContents,
  getWindowContext,
  getWindowId: windowIdForBrowserWindow,
  setWindow: (window) => { win = window; },
  setActiveSiteContents: (contents) => { siteWc = contents; },
  createWindow,
  saveConfig,
  mainWindowId: MAIN_WINDOW_ID,
  maxWindows: MAX_APP_WINDOWS,
  createId: randomUUID,
});

const accountManager = createAccountManager({
  ipcMain,
  session,
  webContents,
  BrowserWindow,
  config,
  sitePattern: SITE_RE,
  mainWindowId: MAIN_WINDOW_ID,
  accountPartition,
  createAccount,
  getWindowContext,
  getWindowId: windowIdForBrowserWindow,
  clearWindowSiteContents,
  activateSiteContents: (windowId, guest, browserWindow) => {
    windowSiteContents.set(windowId, guest);
    if (browserWindow.isFocused()) siteWc = guest;
  },
  accessKeyManager,
  applyNetworkSettings,
  saveConfig,
  writeLog,
});
const { configureSitePermissions, configureWindowSitePermissions } = accountManager;
accountManager.registerIpc();

accessKeyManager.registerIpc();

registerAppUtilityIpc({
  ipcMain,
  app,
  clipboard,
  config,
  shell,
  isTrustedAppEvent,
  writeLog,
  saveConfig,
  applySideEffects,
  applyDiscordRpcRuntime,
  discordDefaults: DEFAULT_DISCORD_RPC_SETTINGS,
  safeAsync,
});

settingsIpc.registerIpc();

registerFeatureIpc({
  ipcMain,
  trayController,
  config,
  configDefaults,
  protectedFields: PROTECTED_CONFIG_FIELDS,
  getWindowContext,
  isTrustedAppEvent,
  sanitizeConfigPatch,
  saveConfig,
  applySideEffects,
  BrowserWindow,
});

networkManager.registerIpc();
createNotificationPollIpc({
  ipcMain,
  config,
  session,
  getWindowContext,
  apiGet,
}).registerIpc();

watchLibrary.registerIpc();
mediaController.registerIpc();
startMediaPolling();
registerAppControlIpc({
  ipcMain,
  app,
  BrowserWindow,
  config,
  appVersion: APP_VERSION,
  constants: {
    appRevealFallbackDelayMs: APP_REVEAL_FALLBACK_DELAY_MS,
    defaultCacheLimitMb: DEFAULT_CACHE_LIMIT_MB,
    inactiveTabUnloadDelayMs: INACTIVE_TAB_UNLOAD_DELAY_MS,
    notificationInitialPollDelayMs: NOTIFICATION_INITIAL_POLL_DELAY_MS,
    notificationPollIntervalMs: NOTIFICATION_POLL_INTERVAL_MS,
    startupBackgroundCheckDelayMs: STARTUP_BACKGROUND_CHECK_DELAY_MS,
  },
  getWindow: () => win,
  getWindowId: windowIdForBrowserWindow,
  isTrustedAppEvent,
  getSiteContents: () => siteWc,
  getWindowSiteContents,
  getAccountSessions,
  windowSiteContents,
  windowIdsByBrowserId,
  approvedCloseWindows,
  saveConfig,
  setTaskbarOverlay,
  setAlwaysOnTop: toggleAlwaysOnTop,
  registerGlobalHotkeys,
  isSiteUrl: (url) => SITE_RE.test(url),
  shell,
  safeAsync,
  writeLog,
});

const { checkUpdate } = createUpdateManager({
  app,
  Notification,
  ipcMain,
  config,
  compareVersions,
  ensureRollbackDir,
  getWindow: () => win,
  isTrustedAppEvent,
  saveConfig,
  writeLog,
  trayController,
  setQuitting: (value) => { quitting = value; },
});

registerAppLifecycle({
  app,
  BrowserWindow,
  config,
  accessKeyManager,
  registerProtocol,
  configureSitePermissions: () => configureSitePermissions(session.defaultSession),
  configureWindowSitePermissions,
  mainWindowId: MAIN_WINDOW_ID,
  createWindow,
  getWindow: () => win,
  ensureTray,
  powerMonitor,
  togglePlayback,
  getMediaState: () => lastMediaState,
  applyDiscordRpcRuntime,
  startBackgroundChecks: (delay) => {
    const runStartupBackgroundChecks = () => {
      if (lastMediaState && !lastMediaState.paused && !lastMediaState.ended) {
        setTimeout(runStartupBackgroundChecks, delay);
        return;
      }
      safeAsync(() => checkUpdate(), writeLog, 'Could not check for updates');
      networkManager.startMirrorHealthCheck();
    };
    setTimeout(runStartupBackgroundChecks, delay);
  },
  registerGlobalHotkeys,
  handleStartupDeepLink,
  getStartupBackgroundCheckDelay: () => STARTUP_BACKGROUND_CHECK_DELAY_MS,
  getSettingsOpenDelay: () => SETTINGS_OPEN_DELAY_MS,
  processArgv: process.argv,
  markStartup,
  saveConfig,
  saveWindowState,
  getWindowId: windowIdForBrowserWindow,
  flushPlaybackPositions,
  flushConfig,
  setQuitting: (value) => { quitting = value; },
  unregisterGlobalHotkeys: () => globalShortcut.unregisterAll(),
  disconnectDiscordRuntime: () => discordRuntime.disconnect(),
  dialog,
  writeLog,
});

discordRuntime = createDiscordRuntime({
  config,
  getMediaState: () => lastMediaState,
  getSiteContents: () => siteWc,
  sitePattern: SITE_RE,
  intervalMs: DISCORD_ACTIVITY_INTERVAL_MS,
  writeLog,
});
