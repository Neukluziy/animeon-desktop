import { initLocalTools } from './local-tools.js';
import { initScreenshots } from './screenshots.js';
import { initTabsView } from './tabs-view.js';
import { initHotkeys } from './hotkeys.js';
import { initAccessKeyFeature } from './access-key.js';
import { initPageLibrary } from './pages.js';
import { initThemeController } from './theme.js';
import { initSiteAppearance } from './site-appearance.js';
import { initAccounts } from './accounts.js';
import { initUpdatePanel } from '../windows/update.js';
import { createStore } from './store.js';
import { createPlaybackControls } from './playback-controls.js';
import { initFeedback } from './feedback.js';
import { createCustomSelectManager } from './custom-select.js';
import { initCommandPalette } from './command-palette.js';
import { initFindInPage } from './find-in-page.js';
import { initSiteNavigation } from './site-navigation.js';
import { initErrorScreen } from './error-screen.js';
import { initTabController } from './tab-controller.js';
import { initUpdateStatus } from './update-status.js';
import { createSplashFallback, initSplash } from './splash.js';
import { createSiteListController } from './site-list.js';
import { createProfileController } from './profile-controller.js';
import { initSettingsNavigation } from './settings-navigation.js';
import { createVolumeControls } from './volume-controls.js';
import { initWindowVisibility } from './window-visibility.js';

const customSelectManager = createCustomSelectManager({});
const { enhanceNativeSelect, initCSelect, syncCustomSelect } = customSelectManager;
const appStore = createStore(window.native.getConfig() || {}, (patch) => window.native.setConfig(patch));
const cfg = appStore.state;
const { toast, askConfirmation } = initFeedback({});
if (cfg.showSplash === false) document.getElementById('splash')?.remove();
const updateHost = document.getElementById('update-overlay-host');
const updateTemplate = document.getElementById('update-panel-template');
if (!updateHost || !updateTemplate) throw new Error('Не найдена разметка панели обновления');
initUpdatePanel({ native: window.native, host: updateHost, template: updateTemplate });

const activeAccount = () => cfg.accounts?.find((item) => item.id === cfg.activeAccountId);
const accountPartition = () => activeAccount()?.partition || 'persist:animeon';

const __splashFallback = createSplashFallback();
const webviewHost = document.getElementById('view-area');
const firstWebview = document.createElement('webview');
firstWebview.id = 'wv';
firstWebview.className = 'tab-active';
firstWebview.setAttribute('allowpopups', '');
firstWebview.setAttribute('partition', accountPartition());
firstWebview.setAttribute('webpreferences', 'webSecurity=yes,contextIsolation=yes,sandbox=yes,allowRunningInsecureContent=no');
firstWebview.setAttribute('preload', new URL('../app/site-preload.js', import.meta.url).href);
webviewHost?.appendChild(firstWebview);
let activeWebview = firstWebview;
let pageTabs = [];
let activeTab = 0;
let pendingPosterUrls = null;
const mediaStates = new WeakMap();
const inactiveTabUnloadTimers = new Map();
const webviewListeners = [];
const webviewListenerMap = new WeakMap();

function attachSiteZoomListener(webview) {
  webview.addEventListener('ipc-message', (event) => {
    if (event.channel === 'site:media-state') {
      const state = event.args?.[0];
      if (state && typeof state.playing === 'boolean' && typeof state.audible === 'boolean' && typeof state.complete === 'boolean') mediaStates.set(webview, state);
      return;
    }
    if (webview !== activeWebview) return;
    if (event.channel === 'site:ctrl-wheel-zoom') {
      const delta = event.args?.[0];
      if (delta === 0.1 || delta === -0.1) window.native.zoom(delta);
      return;
    }
    if (event.channel === 'site:scroll') {
      const state = event.args?.[0];
      if (!cfg.autoHide || !booted || picker?.classList.contains('show') || settingsOverlay?.classList.contains('show')) return;
      const y = Number(state?.y);
      if (!Number.isFinite(y)) return;
      if (y > lastScrollY + 8) setChromeHidden(true);
      else if (y < lastScrollY - 8) setChromeHidden(false);
      lastScrollY = y;
    }
  });
}

attachSiteZoomListener(firstWebview);

function attachWebviewListeners(webview) {
  if (!webview) return;
  const wrappers = [];
  for (const [type, listener, options] of webviewListeners) {
    const wrapper = (event) => {
      if (webview !== activeWebview) return;
      try { listener(event); } catch (error) { console.error('[AnimeOn] webview listener error', error); }
    };
    webview.addEventListener(type, wrapper, options);
    wrappers.push([type, listener, wrapper, options]);
  }
  webviewListenerMap.set(webview, wrappers);
}

const wv = new Proxy({}, {
  get(_, property) {
    if (property === 'addEventListener') {
      return (type, listener, options) => {
        if (typeof listener !== 'function') return;
        webviewListeners.push([type, listener, options]);
        if (activeWebview) {
          const wrapper = (event) => {
            if (activeWebview !== firstWebview && event?.target && event.target !== activeWebview) return;
            if (activeWebview !== firstWebview && !event?.target) return;
            try { listener(event); } catch (error) { console.error('[AnimeOn] webview listener error', error); }
          };
          activeWebview.addEventListener(type, wrapper, options);
          const list = webviewListenerMap.get(activeWebview) || [];
          list.push([type, listener, wrapper, options]);
          webviewListenerMap.set(activeWebview, list);
        }
      };
    }
    if (property === 'removeEventListener') {
      return (type, listener) => {
        for (const webview of [firstWebview, ...(window.__animeonTabWebviews || [])]) {
          const list = webviewListenerMap.get(webview) || [];
          for (const item of list.slice()) {
            if (item[0] === type && item[1] === listener) {
              try { webview.removeEventListener(item[0], item[2], item[3]); } catch { void 0; }
            }
          }
        }
      };
    }
    const target = activeWebview;
    if (!target) return undefined;
    const value = target[property];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

function createTabWebview(index) {
  if (index === 0) {
    if (!firstWebview.isConnected) webviewHost?.appendChild(firstWebview);
    tabWebviews[0] = firstWebview;
    return firstWebview;
  }
  const webview = document.createElement('webview');
  webview.id = `wv-tab-${index}`;
  webview.setAttribute('allowpopups', '');
  webview.setAttribute('partition', accountPartition());
  webview.setAttribute('webpreferences', 'webSecurity=yes,contextIsolation=yes,sandbox=yes,allowRunningInsecureContent=no');
  webview.setAttribute('preload', new URL('../app/site-preload.js', import.meta.url).href);
  webview.className = 'animeon-tab-webview';
  webview.style.cssText = 'display:none;visibility:hidden;position:absolute;inset:0;width:100%;height:100%;border:0;z-index:0;background:#050507;';
  webviewHost?.appendChild(webview);
  tabWebviews[index] = webview;
  attachSiteZoomListener(webview);
  attachWebviewListeners(webview);
  webview.addEventListener('dom-ready', () => {
    if (tabWebviews[index] === webview && activeWebview === webview) {
      try { window.native.setActiveSiteWebview(webview.getWebContentsId()); } catch { void 0; }
      try { webview.focus(); } catch { void 0; }
      try { updateNav(); } catch { void 0; }
      try { applyGuestStyles(); } catch { void 0; }
    }
  });
  return webview;
}

const tabWebviews = [firstWebview];
window.__animeonTabWebviews = tabWebviews;

function showTabWebview(index) {
  const target = tabWebviews[index];
  if (!target) return false;
  activeWebview = target;
  try { window.native.setActiveSiteWebview(target.getWebContentsId()); } catch { void 0; }
  tabWebviews.forEach((webview, i) => {
    if (!webview) return;
    const active = i === index;
    webview.classList.toggle('tab-active', active);
    webview.style.display = active ? 'block' : 'none';
    webview.style.visibility = active ? 'visible' : 'hidden';
    webview.style.width = '100%';
    webview.style.height = '100%';
    webview.style.zIndex = active ? '2' : '0';
  });
  return true;
}

const splash = document.getElementById('splash');
const splashBarFill = document.querySelector('#splash .s-bar i');
const splashPct = document.querySelector('.s-pct');
const progress = document.getElementById('progress');
const btnBack = document.getElementById('btn-back');
const btnFwd = document.getElementById('btn-fwd');
const btnHome = document.getElementById('btn-home');
const btnReload = document.getElementById('btn-reload');
const btnSite = document.getElementById('btn-site');
const btnMax = document.getElementById('btn-max');
const btnFs = document.getElementById('btn-fs');
const btnClose = document.getElementById('btn-close');
btnBack?.addEventListener('click', () => { if (wv.canGoBack()) wv.goBack(); });
btnFwd?.addEventListener('click', () => { if (wv.canGoForward()) wv.goForward(); });
btnHome?.addEventListener('click', () => openSite(currentSite || cfg.site || 'cc'));
btnReload?.addEventListener('click', () => wv.reload());
btnMax?.addEventListener('click', () => window.native.minimizeWindow());
btnFs?.addEventListener('click', () => window.native.toggleMaximize());
btnClose?.addEventListener('click', () => window.native.close());
window.native.onWinState?.((maximized) => btnFs?.classList.toggle('is-max', !!maximized));
window.native.onFsState?.((fullscreen) => document.body.classList.toggle('is-fs', !!fullscreen));
const btnSettings = document.getElementById('btn-settings');
const btnVolume = document.getElementById('btn-volume');
const volumeWrap = document.querySelector('.volume-wrap');
const volumePanel = document.getElementById('volume-panel');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const volumeMinus = document.getElementById('volume-minus');
const volumePlus = document.getElementById('volume-plus');
const volumeMute = document.getElementById('volume-mute');
const settingsOverlay = document.getElementById('settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const picker = document.getElementById('site-picker');
const welcomeScreen = document.getElementById('welcome-screen');
const welcomeContinue = document.getElementById('btn-welcome-continue');
const rememberPick = document.getElementById('remember-pick');
const rememberSettings = document.getElementById('remember-settings');
const autostartToggle = document.getElementById('autostart-toggle');
const trayToggle = document.getElementById('tray-toggle');
const btnContinue = document.getElementById('btn-continue');
const autohideToggle = document.getElementById('autohide-toggle');
const compactToggle = document.getElementById('compact-toggle');
const alwaysOnTopToggle = document.getElementById('alwaysontop-toggle');
const lowPowerToggle = document.getElementById('lowpower-toggle');
const glassWindowToggle = document.getElementById('glass-window-toggle');
const showSplashToggle = document.getElementById('show-splash-toggle');
const titleDisplaySelect = document.getElementById('title-display-select');
const btnRestartWebview = document.getElementById('btn-restart-webview');
const btnClearCache = document.getElementById('btn-clear-cache');
const btnDevtools = document.getElementById('btn-devtools');
const diagnosticsOutput = document.getElementById('diagnostics-output');
const confirmScreen = document.getElementById('confirm-close-screen');
const confirmYes = document.getElementById('confirm-close-yes');
const confirmNo = document.getElementById('confirm-close-no');
const performanceSelect = initCSelect('performance-select', (v) => { store('performance', v); window.native.setPerformance(v); applyPerformance(v); });
const autoRecoveryToggle = document.getElementById('autorecovery-toggle');
const confirmCloseToggle = document.getElementById('confirmclose-toggle');
const closeBehaviorSelect = initCSelect('close-behavior-select', (v) => { store('closeBehavior', v); store('confirmClose', v === 'ask'); if (confirmCloseToggle) confirmCloseToggle.checked = v === 'ask'; });
const btnClearData = document.getElementById('btn-clear-data');
const btnConnectionCheck = document.getElementById('btn-connection-check');
const btnExportSettings = document.getElementById('btn-export-settings');
const btnImportSettings = document.getElementById('btn-import-settings');
const btnResetSettings = document.getElementById('btn-reset-settings');
const btnResetWebviewState = document.getElementById('btn-reset-webview-state');
const btnOpenDataFolder = document.getElementById('btn-open-data-folder');
const siteCssInput = document.getElementById('site-css-input');
const btnSiteCssApply = document.getElementById('btn-site-css-apply');
const btnSiteCssReset = document.getElementById('btn-site-css-reset');
const btnSiteCssRevert = document.getElementById('btn-site-css-revert');
const siteCssSnippet = document.getElementById('site-css-snippet');
const siteCssStatus = document.getElementById('site-css-status');
const smoothScrollToggle = document.getElementById('smooth-scroll-toggle');
const siteScrollbarsToggle = document.getElementById('site-scrollbars-toggle');
const profileSelect = initCSelect('profile-select', null);
const styleProfileName = document.getElementById('style-profile-name');
const btnProfileSave = document.getElementById('btn-profile-save');
const btnProfileLoad = document.getElementById('btn-profile-load');
const btnProfileDelete = document.getElementById('btn-profile-delete');
const btnUpdOpenRelease = document.getElementById('btn-upd-open-release');
const mediaOverlay = document.getElementById('media-overlay');
const mediaOverlayText = document.getElementById('media-overlay-text');
const stVersion = document.getElementById('st-version');
const updStatus = document.getElementById('upd-status');
const btnUpdGet = document.getElementById('btn-upd-get');
const btnUpdCheck = document.getElementById('btn-upd-check');
const brandPageTitle = document.getElementById('brand-page-title');
const posterWall = document.getElementById('poster-wall');
const btnNewTab = document.getElementById('btn-new-tab');
const btnDnd = document.getElementById('btn-dnd');
const watchNotesModal = document.getElementById('watch-notes-modal');
const btnCloseWatchNotes = document.getElementById('btn-close-watch-notes');
const btnWatchNotes = document.getElementById('btn-watch-notes');
const effectsModeSelect = document.getElementById('effects-mode-select');
document.querySelectorAll('select').forEach(enhanceNativeSelect);
const notifyAdvancedToggle = document.getElementById('notify-toggle-advanced');
const discordRpcControls = {
  enabled: document.getElementById('discord-rpc-enabled'),
};
const cacheAutoToggle = document.getElementById('cache-auto-toggle');
const cacheLimit = document.getElementById('cache-limit');
const cacheInfoText = document.getElementById('cache-info-text');
const memorySaverToggle = document.getElementById('memory-saver-toggle');
const autoMirrorToggle = document.getElementById('auto-mirror-toggle');
const proxyHost = document.getElementById('proxy-host');
const proxyUser = document.getElementById('proxy-user');
const proxyPass = document.getElementById('proxy-pass');
const dohToggle = document.getElementById('doh-toggle');
const netMirrorList = document.getElementById('net-mirror-list');
const btnNetApply = document.getElementById('btn-net-apply');


let booted = false;
let firstLaunchOnboarding = false;
let revealApp = null;

setTimeout(() => {
  try {
    if (booted) return;
    console.error('[AnimeOn] Инициализация зависла дольше 8 сек — принудительно показываю интерфейс.');
    try { __splashFallback?.takeOver(); } catch (error) {
      console.warn('[AnimeOn] Could not stop the splash fallback animation:', error);
    }
    try {
      if (typeof revealApp === 'function') revealApp(0);
      else {
        booted = true;
        document.body.classList.add('loaded');
        splash?.remove();
      }
    } catch (error) {
      console.error('[AnimeOn] Could not reveal the app after startup timeout:', error);
    }
    try {
      if (!firstLaunchOnboarding) {
        const p = document.getElementById('site-picker');
        if (p) { p.classList.add('show'); document.body.classList.add('picker-visible'); }
      }
    } catch (error) {
      console.warn('[AnimeOn] Could not restore the site picker after startup timeout:', error);
    }
  } catch (e) {
    console.error('[AnimeOn] watchdog error', e);
    try { document.getElementById('splash')?.remove(); } catch { void 0; }
  }
}, 8000);
let currentSite = null;

firstLaunchOnboarding = cfg.onboardingComplete !== true;
window.__startupOnboarding = firstLaunchOnboarding;
const accessKeyFeature = initAccessKeyFeature({
  native: window.native, cfg, toast, askConfirmation,
  isFirstLaunch: () => firstLaunchOnboarding,
  isRememberedSite: () => rememberSite,
  reloadWebviews: () => tabWebviews.forEach((webview) => {
    try { webview?.reload(); } catch (error) {
      console.warn('[AnimeOn] Could not reload an account webview:', error);
    }
  }),
});
const DEFAULT_DISCORD_RPC_SETTINGS = {
  enabled: true,
  showEpisode: true,
  showSeason: true,
  showTime: true,
  showWhenIdle: true,
  showPoster: true,
  clickTitle: true,
  clickState: true,
  clickPoster: true,
  useAnimePoster: true,
};
cfg.discordRpc = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...(cfg.discordRpc || {}) };
delete cfg.discordRpc.showDubbing;

function syncDiscordRpcControls() {
  for (const [key, input] of Object.entries(discordRpcControls)) {
    if (input) input.checked = cfg.discordRpc[key] !== false;
  }
}

syncDiscordRpcControls();
for (const [key, input] of Object.entries(discordRpcControls)) {
  input?.addEventListener('change', async () => {
    const result = await window.native.setDiscordRpcSettings({ [key]: input.checked });
    if (!result?.ok) {
      input.checked = !input.checked;
      toast(result?.error || 'Не удалось применить настройки Discord RPC', 'error');
      return;
    }
    cfg.discordRpc = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...(result.settings || cfg.discordRpc) };
    syncDiscordRpcControls();
    toast(
      key === 'enabled' ? (input.checked ? 'Статус Discord включён' : 'Статус Discord выключен') : 'Настройки Discord сохранены',
      key === 'enabled' && !input.checked ? 'error' : 'ok',
    );
  });
}

const SITES = {
  cc: { url: 'https://animeon.cc/', label: 'animeon.cc' },
  co: { url: 'https://v2.animeon.co/', label: 'v2.animeon.co' },
};
function saveTabs(...args) {
  return tabController.saveTabs(...args);
}
function loadTabUrl(...args) {
  return tabController.loadTabUrl(...args);
}
const siteNavigation = initSiteNavigation({
  sites: SITES,
  cfg,
  store,
  native: window.native,
  getCurrentSite: () => currentSite,
  setCurrentSite: (value) => { currentSite = value; },
  getPageTabs: () => pageTabs,
  setPageTabs: (value) => { pageTabs = value; },
  getActiveTab: () => activeTab,
  getTabWebviews: () => tabWebviews,
  createTabWebview,
  showTabWebview,
  loadTabUrl,
  saveTabs,
  loadSiteEditor,
  accessKeyFeature,
  toast,
  isFirstLaunch: () => firstLaunchOnboarding,
  setFirstLaunch: (value) => { firstLaunchOnboarding = value; },
  setPosterWall,
  getPendingPosterUrls: () => pendingPosterUrls,
  setPendingPosterUrls: (value) => { pendingPosterUrls = value; },
  elements: {
    btnSite,
    picker,
    welcomeScreen,
    welcomeContinue,
    rememberPick,
    rememberSettings,
    btnContinue,
  },
});
const { activateSite, getOtherSiteId, openSite, showWelcomeScreen, switchMirror, updateMirrorBtn } = siteNavigation;

const siteListController = createSiteListController({
  cfg,
  native: window.native,
  sites: SITES,
  getCurrentSite: () => currentSite,
  updateMirrorBtn: () => updateMirrorBtn(),
  updateSiteFromUrl: (url) => updateSiteFromUrl?.(url),
  renderTabs: () => renderTabs(),
});
const { applySiteList, loadSitesFromRemote } = siteListController;

const appInfo = window.native.getAppInfo() || { version: '' };
const appConstants = appInfo.constants;
document.getElementById('about-version-value')?.append(`v${appInfo.version || ''}`);
if (appInfo.version && cfg.lastSeenVersion && cfg.lastSeenVersion !== appInfo.version && appInfo.isPrimaryWindow) {
  const previousVersion = cfg.lastSeenVersion;
  store('lastSeenVersion', appInfo.version);
  toast(`AnimeOn обновлён до v${appInfo.version}`, 'info', {
    body: `Предыдущая версия: v${previousVersion}`,
    duration: 12000,
    action: { icon: 'go', title: 'Что нового', onClick: () => window.native.update.open() },
  });
} else if (appInfo.version && !cfg.lastSeenVersion) {
  store('lastSeenVersion', appInfo.version);
}
let currentWindowPageTitle = '';

function updateWindowTitle(title = currentWindowPageTitle) {
  currentWindowPageTitle = String(title || '').trim().slice(0, 120);
  const mode = ['brand', 'compact', 'page', 'page-only'].includes(cfg.titleDisplay) ? cfg.titleDisplay : 'brand';
  document.documentElement.dataset.titleDisplay = mode;
  if (brandPageTitle) brandPageTitle.textContent = currentWindowPageTitle;
  const nativeTitle = mode === 'page-only' && currentWindowPageTitle
    ? currentWindowPageTitle
    : mode === 'page' && currentWindowPageTitle
      ? `AnimeOn — ${currentWindowPageTitle}`
      : 'AnimeOn';
  void window.native.setWindowTitle?.(nativeTitle);
}

updateWindowTitle();
wv.addEventListener('page-title-updated', () => {
  updateWindowTitle(activeWebview.getTitle?.() || '');
});
wv.addEventListener('did-stop-loading', () => {
  updateWindowTitle(activeWebview.getTitle?.() || '');
});
titleDisplaySelect.value = cfg.titleDisplay || 'brand';
syncCustomSelect(titleDisplaySelect);
titleDisplaySelect.addEventListener('change', () => {
  store('titleDisplay', titleDisplaySelect.value);
  updateWindowTitle();
});
glassWindowToggle.disabled = appInfo.platform !== 'win32';
glassWindowToggle.title = glassWindowToggle.disabled ? 'Эффект стекла доступен в Windows 11' : '';
glassWindowToggle.checked = !!cfg.glassWindow;
document.documentElement.dataset.glassWindow = String(appInfo.platform === 'win32' && cfg.glassWindow && !cfg.lowPower);
showSplashToggle.checked = cfg.showSplash !== false;
showSplashToggle.addEventListener('change', () => store('showSplash', showSplashToggle.checked));
glassWindowToggle.addEventListener('change', async () => {
  const result = await window.native.setWindowMaterial(glassWindowToggle.checked);
  if (!result?.ok) {
    glassWindowToggle.checked = !glassWindowToggle.checked;
    toast(result?.error || 'Не удалось изменить материал окна', 'error');
    return;
  }
  store('glassWindow', result.requested);
  glassWindowToggle.checked = result.requested;
  document.documentElement.dataset.glassWindow = String(result.enabled);
  if (result.requested && !result.enabled) toast('Эффект стекла приостановлен в режиме экономии', 'info');
});

function store(k, v) {
  if (v === undefined) return appStore.get(k);
  return appStore.set(k, v);
}

function applyEffectsMode(value = cfg.effectMode) {
  const mode = ['full', 'moderate', 'minimum'].includes(value) ? value : 'full';
  cfg.effectMode = mode;
  document.body.dataset.effects = mode;
  if (updateHost) updateHost.dataset.effects = mode;
  if (effectsModeSelect) {
    effectsModeSelect.value = mode;
    syncCustomSelect(effectsModeSelect);
  }
}

applyEffectsMode();
effectsModeSelect?.addEventListener('change', () => {
  applyEffectsMode(effectsModeSelect.value);
  store('effectMode', cfg.effectMode);
});

const siteAppearance = initSiteAppearance({
  cfg,
  store,
  applyGuestStyles,
  toast,
  smoothScrollToggle,
  siteScrollbarsToggle,
});

async function applyGuestStyles() {
  if (!currentSite || !wv) return false;
  const key = currentSite || 'cc';
  const custom = cfg.customCss && typeof cfg.customCss === 'object' ? String(cfg.customCss[key] || '') : '';
  const smooth = cfg.smoothSite !== false;
  const css = `${siteAppearance.buildCss()}\n${custom}\n${smooth ? 'html{scroll-behavior:smooth!important;}' : ''}`;
  try {
    const result = await window.native.applySiteCss(css);
    if (!result?.ok) throw new Error(result?.error || 'Стили не применены');
    return true;
  } catch (error) {
    console.warn('[AnimeOn] Could not apply site appearance:', error);
    return false;
  }
}

const { applyTheme, getActiveTheme } = initThemeController({
  cfg,
  store,
  applyGuestStyles,
  toast,
  native: window.native,
});

const profileController = createProfileController({
  cfg,
  controls: {
    profileSelect,
    styleProfileName,
    saveButton: btnProfileSave,
    loadButton: btnProfileLoad,
    deleteButton: btnProfileDelete,
    notifyToggle: notifyAdvancedToggle,
    memorySaverToggle,
    cacheAutoToggle,
    cacheLimit,
  },
  store,
  toast,
  getCurrentSite: () => currentSite,
  getActiveTheme,
  applyTheme,
  siteAppearance,
  appConstants,
  loadSiteEditor,
  applyGuestStyles,
  applyEffectsMode,
});
const { refreshProfiles } = profileController;

function loadSiteEditor() {
  if (!siteCssInput) return;
  void siteAppearance.revertVisualPreview();
  siteAppearance.syncVisualUI();
  previousAppliedSiteCss = null;
  if (btnSiteCssRevert) btnSiteCssRevert.disabled = true;
  setSiteCssStatus('');
  if (smoothScrollToggle) smoothScrollToggle.checked = cfg.smoothSite !== false;
  if (siteScrollbarsToggle) siteScrollbarsToggle.checked = !!cfg.showSiteScrollbars;
  refreshProfiles();
  const key = currentSite || 'cc';
  const css = cfg.customCss && typeof cfg.customCss === 'object' ? String(cfg.customCss[key] || '') : '';
  siteCssInput.value = css;
}

btnSiteCssApply?.addEventListener('click', async () => {
  if (!currentSite) return;
  const key = currentSite || 'cc';
  const css = String(siteCssInput?.value || '');
  if (css.length > 200000 || !hasBalancedCss(css)) {
    setSiteCssStatus(css.length > 200000 ? 'CSS слишком большой (максимум 200 КБ).' : 'Проверь скобки и кавычки в CSS.', 'error');
    return;
  }
  if (!cfg.customCss || typeof cfg.customCss !== 'object') cfg.customCss = { cc: '', co: '' };
  const previous = String(cfg.customCss[key] || '');
  cfg.customCss[key] = css;
  store('customCss', cfg.customCss);
  const applied = await applyGuestStyles();
  if (!applied) {
    cfg.customCss[key] = previous;
    store('customCss', cfg.customCss);
    setSiteCssStatus('Не удалось применить стили. Проверьте, что сайт загружен.', 'error');
    return;
  }
  previousAppliedSiteCss = previous;
  if (btnSiteCssRevert) btnSiteCssRevert.disabled = false;
  setSiteCssStatus('Стили применены.', 'ok');
  toast('Оформление сайта применено');
});

function hasBalancedCss(css) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = false;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    if (comment) {
      if (char === '*' && next === '/') { comment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '*') { comment = true; index += 1; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth < 0) return false;
  }
  return !quote && !comment && depth === 0;
}

function setSiteCssStatus(message, state = '') {
  if (!siteCssStatus) return;
  siteCssStatus.textContent = message;
  if (state) siteCssStatus.dataset.state = state;
  else delete siteCssStatus.dataset.state;
}

let previousAppliedSiteCss = null;
const siteCssSnippets = {
  rounded: '.anime-card, [class*="card" i] { border-radius: 18px !important; }',
  compact: '.anime-card, [class*="card" i] { padding: 10px !important; gap: 8px !important; }',
  'hide-banners': '[class*="banner" i], [class*="promo" i] { display: none !important; }',
};
siteCssSnippet?.addEventListener('change', () => {
  const snippet = siteCssSnippets[siteCssSnippet.value];
  if (!snippet || !siteCssInput) return;
  siteCssInput.value = `${siteCssInput.value.trimEnd()}${siteCssInput.value.trim() ? '\n\n' : ''}${snippet}\n`;
  siteCssSnippet.value = '';
  syncCustomSelect(siteCssSnippet);
  siteCssInput.focus();
  setSiteCssStatus('Сниппет добавлен — нажмите «Применить».');
});
siteCssInput?.addEventListener('input', () => setSiteCssStatus('Есть несохранённые изменения.'));
siteCssInput?.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault();
    btnSiteCssApply?.click();
  }
});
btnSiteCssRevert?.addEventListener('click', async () => {
  if (previousAppliedSiteCss === null || !currentSite) return;
  const key = currentSite;
  const current = String(cfg.customCss?.[key] || '');
  cfg.customCss[key] = previousAppliedSiteCss;
  store('customCss', cfg.customCss);
  if (siteCssInput) siteCssInput.value = previousAppliedSiteCss;
  if (!await applyGuestStyles()) {
    cfg.customCss[key] = current;
    store('customCss', cfg.customCss);
    if (siteCssInput) siteCssInput.value = current;
    setSiteCssStatus('Не удалось откатить стили.', 'error');
    return;
  }
  previousAppliedSiteCss = current;
  setSiteCssStatus('Предыдущая версия CSS восстановлена.', 'ok');
});

btnSiteCssReset?.addEventListener('click', async () => {
  if (!currentSite) return;
  const key = currentSite || 'cc';
  if (!cfg.customCss || typeof cfg.customCss !== 'object') cfg.customCss = { cc: '', co: '' };
  const previous = String(cfg.customCss[key] || '');
  cfg.customCss[key] = '';
  if (siteCssInput) siteCssInput.value = '';
  store('customCss', cfg.customCss);
  if (!await applyGuestStyles()) {
    cfg.customCss[key] = previous;
    store('customCss', cfg.customCss);
    if (siteCssInput) siteCssInput.value = previous;
    setSiteCssStatus('Не удалось сбросить CSS.', 'error');
    return;
  }
  previousAppliedSiteCss = previous;
  if (btnSiteCssRevert) btnSiteCssRevert.disabled = false;
  setSiteCssStatus('CSS сброшен.', 'ok');
  toast('Свой CSS сброшен');
});

splash?.addEventListener('click', () => revealApp(0));
autostartToggle.addEventListener('change', () => store('autostart', autostartToggle.checked));
trayToggle.addEventListener('change', () => {
  const enabled = trayToggle.checked;
  store('tray', enabled);
  const closeBehavior = enabled ? 'tray' : (confirmCloseToggle?.checked ? 'ask' : 'exit');
  store('closeBehavior', closeBehavior);
  store('confirmClose', closeBehavior === 'ask');
  if (closeBehaviorSelect) closeBehaviorSelect.pick(closeBehavior);
  if (confirmCloseToggle) confirmCloseToggle.checked = closeBehavior === 'ask';
});
autohideToggle.addEventListener('change', () => { store('autoHide', autohideToggle.checked); setChromeHidden(false); });
compactToggle.addEventListener('change', () => { store('compact', compactToggle.checked); document.body.classList.toggle('compact-mode', compactToggle.checked); });
alwaysOnTopToggle?.addEventListener('change', () => window.native.toggleAlwaysOnTop());
lowPowerToggle.addEventListener('change', () => {
  store('lowPower', lowPowerToggle.checked);
  document.body.classList.toggle('low-power', lowPowerToggle.checked || performanceSelect?.value === 'economy');
  document.documentElement.dataset.glassWindow = String(appInfo.platform === 'win32' && cfg.glassWindow && !lowPowerToggle.checked);
});
autoRecoveryToggle?.addEventListener('change', () => store('autoRecovery', autoRecoveryToggle.checked));
confirmCloseToggle?.addEventListener('change', () => { const v=confirmCloseToggle.checked; store('confirmClose', v); store('closeBehavior', v ? 'ask' : (store('closeBehavior') === 'ask' ? 'exit' : store('closeBehavior'))); if (closeBehaviorSelect) closeBehaviorSelect.pick(store('closeBehavior') || (v ? 'ask' : 'exit')); });

function applyPerformance(mode) {
  document.body.dataset.performance = mode;
  document.body.classList.toggle('performance-mode', mode === 'performance');
  document.body.classList.toggle('economy-mode', mode === 'economy');
}

btnRestartWebview?.addEventListener('click', () => { hideError(); wv.reload(); });
btnClearCache?.addEventListener('click', async () => {
  btnClearCache.disabled = true;
  const res = await window.native.clearCache();
  btnClearCache.disabled = false;
  if (res?.ok) { toast('Кэш очищен'); setTimeout(() => wv.reload(), 250); }
  else toast(`Ошибка: ${res?.error || 'неизвестная ошибка'}`, 'error');
});
btnClearData?.addEventListener('click', async () => {
  if (!await askConfirmation('Очистить данные сайта AnimeOn? Это может завершить текущую авторизацию.', 'Очистить данные')) return;
  btnClearData.disabled = true; const res = await window.native.clearSiteData(); btnClearData.disabled = false;
  if (res?.ok) { toast('Данные сайта очищены'); setTimeout(() => wv.reload(), 250); }
  else toast(`Ошибка: ${res?.error || 'неизвестная ошибка'}`, 'error');
});
btnConnectionCheck?.addEventListener('click', async () => {
  btnConnectionCheck.disabled = true; if (diagnosticsOutput) diagnosticsOutput.textContent = 'Проверяю интернет и сайты…';
  const r = await window.native.connectionCheck(); btnConnectionCheck.disabled = false;
  const lines = [`Интернет: ${r.internet ? 'доступен' : 'нет соединения'}`];
  (r.results || []).forEach(x => lines.push(`${new URL(x.url).hostname}: ${x.ok ? 'доступен' : 'не отвечает'}${x.status ? ` · HTTP ${x.status}` : ''} · ${x.ms} мс`));
  if (diagnosticsOutput) diagnosticsOutput.textContent = lines.join('\n');
  toast(r.internet ? 'Соединение проверено' : 'Соединение недоступно', r.internet ? 'ok' : 'error');
});
document.getElementById('btn-check-all')?.addEventListener('click', async () => {
  const button = document.getElementById('btn-check-all');
  if (button) button.disabled = true;
  if (diagnosticsOutput) diagnosticsOutput.textContent = 'Проверяю приложение и соединение…';
  try {
    const [d, r] = await Promise.all([window.native.diagnostics(), window.native.connectionCheck()]);
    const lines = [
      `Приложение: v${d.version} · Electron ${d.electron}`,
      `Память: ${d.memoryMB} MB · GPU: ${d.gpu?.gpu_compositing || 'unknown'}`,
      `Интернет: ${r.internet ? 'доступен' : 'нет соединения'}`,
      ...(r.results || []).map(x => `${new URL(x.url).hostname}: ${x.ok ? 'доступен' : 'не отвечает'}${x.status ? ` · HTTP ${x.status}` : ''} · ${x.ms} мс`)
    ];
    if (diagnosticsOutput) diagnosticsOutput.textContent = lines.join('\n');
    toast(r.internet ? 'Проверка завершена' : 'Есть проблемы с соединением', r.internet ? 'ok' : 'error');
  } catch {
    if (diagnosticsOutput) diagnosticsOutput.textContent = 'Не удалось завершить проверку.';
    toast('Проверка не завершилась', 'error');
  }
  if (button) button.disabled = false;
});
btnExportSettings?.addEventListener('click', async () => { const r = await window.native.exportSettings(); if (r?.ok) toast('Настройки экспортированы'); else if (!r?.canceled) toast(r?.error || 'Не удалось экспортировать настройки', 'error'); });
btnImportSettings?.addEventListener('click', async () => {
  const result = await window.native.importSettings();
  if (!result?.ok) {
    if (!result?.canceled) toast(result?.error || 'Не удалось импортировать настройки', 'error');
    return;
  }
  Object.assign(cfg, result.settings || {});
  cfg.discordRpc = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...(cfg.discordRpc || {}) };
  const hotkeyResult = await hotkeysFeature.applyImported(cfg.hotkeys);
  if (!hotkeyResult?.hotkeys) toast(hotkeyResult?.error || 'Не удалось применить горячие клавиши', 'error');
  applyTheme(cfg.theme || 'violet', { skipSave: true });
  titleDisplaySelect.value = cfg.titleDisplay || 'brand';
  syncCustomSelect(titleDisplaySelect);
  updateWindowTitle();
  glassWindowToggle.checked = !!cfg.glassWindow;
  showSplashToggle.checked = cfg.showSplash !== false;
  document.documentElement.dataset.glassWindow = String(appInfo.platform === 'win32' && cfg.glassWindow && !cfg.lowPower);
  try {
    const materialResult = await window.native.setWindowMaterial(!!cfg.glassWindow);
    document.documentElement.dataset.glassWindow = String(materialResult?.enabled);
    if (!materialResult?.ok) {
      cfg.glassWindow = false;
      glassWindowToggle.checked = false;
      document.documentElement.dataset.glassWindow = 'false';
      toast(materialResult?.error || 'Не удалось применить эффект стекла', 'error');
    }
  } catch (error) {
    toast(`Не удалось применить эффект стекла: ${String(error?.message || error)}`, 'error');
  }
  rememberPick.checked = rememberSettings.checked = cfg.remember === '1';
  autostartToggle.checked = !!cfg.autostart;
  trayToggle.checked = !!cfg.tray;
  compactToggle.checked = !!cfg.compact;
  lowPowerToggle.checked = cfg.lowPower !== false;
  autohideToggle.checked = cfg.autoHide !== false;
  if (performanceSelect) performanceSelect.pick(cfg.performance || 'balanced');
  if (autoRecoveryToggle) autoRecoveryToggle.checked = cfg.autoRecovery !== false;
  if (closeBehaviorSelect) closeBehaviorSelect.pick(cfg.closeBehavior || (cfg.confirmClose ? 'ask' : 'exit'));
  if (confirmCloseToggle) confirmCloseToggle.checked = (closeBehaviorSelect?.value || cfg.closeBehavior) === 'ask';
  document.body.classList.toggle('compact-mode', !!cfg.compact);
  document.body.classList.toggle('low-power', cfg.lowPower !== false);
  syncDiscordRpcControls();
  applyPerformance(cfg.performance || 'balanced');
  if (smoothScrollToggle) smoothScrollToggle.checked = cfg.smoothSite !== false;
  if (siteScrollbarsToggle) siteScrollbarsToggle.checked = !!cfg.showSiteScrollbars;
  applyGuestStyles();
  toast('Настройки импортированы');
});
btnResetWebviewState?.addEventListener('click', () => { window.native.restartWebview(); toast('Состояние страницы сброшено'); });
btnOpenDataFolder?.addEventListener('click', () => { window.native.openDataFolder?.(); });
btnUpdOpenRelease?.addEventListener('click', () => { if (window.__lastUpdate?.url) window.native.openExternal(window.__lastUpdate.url); });

btnResetSettings?.addEventListener('click', async () => { if (!await askConfirmation('Сбросить все настройки AnimeOn?', 'Сбросить настройки')) return; const r=await window.native.resetSettings(); if(!r?.ok){toast(r?.error||'Не удалось сбросить настройки','error');return;} Object.assign(cfg,r.settings||{}); applyTheme('violet',{skipSave:true}); location.reload(); });
btnDevtools?.addEventListener('click', () => window.native.toggleDevTools());
document.querySelectorAll('.link-row').forEach((l) => {
  l.addEventListener('click', () => window.native.openExternal(l.dataset.url));
});

const pointerGlowTargets = document.querySelectorAll('#titlebar button, button, .theme-swatch, .settings-nav-item, .picker-card, .site-card, .link-row');
pointerGlowTargets.forEach((b) => {
  if (!b || b.dataset.glowBound === 'true') return;
  b.dataset.glowBound = 'true';
  b.classList.add('follow-glow');
  b.addEventListener('pointermove', (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', `${e.clientX - r.left}px`);
    b.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  b.addEventListener('pointerleave', () => {
    b.style.setProperty('--mx', '50%');
    b.style.setProperty('--my', '50%');
  });
});


const volumeControls = createVolumeControls({
  native: window.native,
  controls: {
    volumeSlider,
    volumeValue,
    buttonVolume: btnVolume,
    volumeMute,
    volumePanel,
    volumeWrap,
    volumeMinus,
    volumePlus,
  },
});
const { refreshVolume, setVolumePanelOpen } = volumeControls;
window.native.onAlwaysOnTop?.(v => { if (alwaysOnTopToggle) alwaysOnTopToggle.checked = !!v; toast(v ? 'Режим «Поверх всех окон» включён' : 'Режим «Поверх всех окон» выключен', v ? 'ok' : 'error'); });
window.native.onToast?.(v => { if (v?.message || v?.title) toast(v.title || v.message, v.type || 'ok', { body: v.body || '' }); });
window.native.onMediaOverlay?.(v => { if (!mediaOverlay || !mediaOverlayText) return; mediaOverlayText.textContent = v.type === 'seek' ? `${v.value > 0 ? '+' : ''}${v.value} сек.` : `${v.muted ? 'Звук выключен' : `Громкость ${v.value}%`}`; mediaOverlay.classList.remove('show'); void mediaOverlay.offsetWidth; mediaOverlay.classList.add('show'); clearTimeout(window.__mediaOverlayTimer); window.__mediaOverlayTimer = setTimeout(() => mediaOverlay.classList.remove('show'), 850); });
function openSettings() {
  settingsOverlay.classList.add('show');
  btnSettings.classList.add('open');
}


let hotkeysFeature;
hotkeysFeature = initHotkeys({ native: window.native, cfg, toast, askConfirmation });

const { openScreenshots, closeScreenshots } = initScreenshots({ native: window.native, toast });

initSettingsNavigation();
const settingsSearch=document.getElementById('settings-search');
const playbackControls = createPlaybackControls({
  native: window.native,
  cfg,
  toast,
  syncSelect: syncCustomSelect,
  controls: {},
});
const { closeSleepTimer, setPlayerSpeed, togglePictureInPicture } = playbackControls;
const saveTabsToggle=document.getElementById('save-tabs-toggle');
const restoreLastToggle=document.getElementById('restore-last-toggle');
if(saveTabsToggle){ saveTabsToggle.checked=cfg.saveTabs!==false; saveTabsToggle.addEventListener('change',()=>store('saveTabs',saveTabsToggle.checked)); }
if(restoreLastToggle){ restoreLastToggle.checked=cfg.restoreLastTab!==false; restoreLastToggle.addEventListener('change',()=>store('restoreLastTab',restoreLastToggle.checked)); }
document.getElementById('btn-clear-tabs')?.addEventListener('click',async()=>{
  if(!await askConfirmation('Очистить все вкладки? Останется только стартовая.', 'Очистить вкладки')) return;
  pageTabs=[{url:SITES[store('site')||'co']?.url||SITES.co.url, title:SITES[store('site')||'co']?.label||'AnimeOn'}];
  activeTab=0;
  if (tabWebviews[0] && tabWebviews[0] !== firstWebview) {
    try { tabWebviews[0].remove(); } catch { void 0; }
  }
  tabWebviews.length=1;
  tabWebviews[0]=firstWebview;
  showTabWebview(0);
  loadTabUrl(firstWebview, pageTabs[0].url);
  await saveTabs();
  toast('Вкладки очищены');
});
if (notifyAdvancedToggle) { notifyAdvancedToggle.checked = !!cfg.notify; notifyAdvancedToggle.addEventListener('change',()=>store('notify',notifyAdvancedToggle.checked)); }
if (smoothScrollToggle) smoothScrollToggle.checked = cfg.smoothSite !== false;
if (siteScrollbarsToggle) siteScrollbarsToggle.checked = !!cfg.showSiteScrollbars;
if (memorySaverToggle) { memorySaverToggle.checked = !!cfg.memorySaver; memorySaverToggle.addEventListener('change',()=>window.native.setMemorySaver(memorySaverToggle.checked)); }
function parseCacheLimitInput(value) {
  const text = String(value ?? '').trim();
  if (text === '∞') return 0;
  const parsed = Number(text);
  if (!text || !Number.isFinite(parsed)) return appConstants.defaultCacheLimitMb;
  return Math.max(64, Math.min(Number.MAX_SAFE_INTEGER, Math.round(parsed)));
}
if (cacheAutoToggle) { cacheAutoToggle.checked = cfg.autoCacheCleanup !== false; cacheAutoToggle.addEventListener('change',()=>window.native.cacheSettings({auto:cacheAutoToggle.checked,limitMB:parseCacheLimitInput(cacheLimit?.value)})); }
if (cacheLimit) {
  cacheLimit.value = Number(cfg.cacheLimitMB) === 0 ? '∞' : String(Number(cfg.cacheLimitMB) || appConstants.defaultCacheLimitMb);
  cacheLimit.addEventListener('change',()=>{
    const limitMB = parseCacheLimitInput(cacheLimit.value);
    cacheLimit.value = limitMB === 0 ? '∞' : String(limitMB);
    window.native.cacheSettings({auto:cacheAutoToggle?.checked!==false,limitMB});
  });
}
async function refreshCacheInfo() {
  try {
    const result = await window.native.cacheInfo();
    if (result?.ok && cacheInfoText) {
      const mb = (Number(result.apiCacheMB) || 0) + (Number(result.sessionCacheMB) || 0);
      cacheInfoText.textContent = `Сейчас: ${mb.toFixed(1)} MB`;
    }
  } catch (error) {
    console.warn('[AnimeOn] Could not refresh cache information:', error);
  }
}
document.getElementById('btn-cache-refresh')?.addEventListener('click',refreshCacheInfo);
document.getElementById('btn-cache-clean')?.addEventListener('click',async()=>{const r=await window.native.clearCache();toast(r?.ok?'Кэш очищен':'Не удалось очистить кэш',r?.ok?'ok':'error');refreshCacheInfo();});
document.getElementById('btn-network-check')?.addEventListener('click',()=>btnConnectionCheck?.click());
customSelectManager.initialize();
if (autoMirrorToggle) { autoMirrorToggle.checked = cfg.autoMirror !== false; autoMirrorToggle.addEventListener('change',()=>window.native.netSettingsSet({autoMirror:autoMirrorToggle.checked})); }
const proxySelect = initCSelect('proxy-select', (v) => { const row = document.getElementById('proxy-custom-row'); if (row) row.hidden = v !== 'custom'; });
if (proxySelect) proxySelect.pick(cfg.network?.mode || 'system');
if (dohToggle) { dohToggle.checked = !!cfg.network?.doh; dohToggle.addEventListener('change',()=>{}); }
if (proxyHost) proxyHost.value = cfg.network?.host || '';
if (proxyUser) proxyUser.value = cfg.network?.user || '';
if (proxyPass) proxyPass.value = cfg.network?.pass || '';
function parseProxyEndpointInput(value) {
  const match = String(value || '').trim().match(/^(?:\[([0-9a-f:.]+)\]|([a-z\d.-]+)):(\d{1,5})$/i);
  if (!match) return null;
  const host = match[1] ? `[${match[1]}]` : match[2];
  const port = Number(match[3]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (!match[1] && host.split('.').some((label) => !label || label.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))) return null;
  try {
    const parsed = new URL(`http://${host}:${port}`);
    if (parsed.port !== String(port)) return null;
  } catch { return null; }
  return { host, port };
}
function proxyFormPatch(){ const endpoint=parseProxyEndpointInput(proxyHost?.value); return { mode: proxySelect ? proxySelect.root.dataset.value : 'system', host:endpoint?.host||String(proxyHost?.value||'').trim(), port:endpoint?.port||0, user:proxyUser?.value||'', pass:proxyPass?.value||'' }; }
btnNetApply?.addEventListener('click',async()=>{const patch={}; if (autoMirrorToggle) patch.autoMirror=autoMirrorToggle.checked; patch.proxy=proxyFormPatch(); patch.doh=!!dohToggle?.checked; const r=await window.native.netSettingsSet(patch); toast(r?.ok?'Настройки сети применены':r?.error||'Ошибка применения',r?.ok?'ok':'error'); if(r?.ok) loadNetStatus(); });
const btnProxyCheck = document.getElementById('btn-proxy-check');
const proxyStatus = document.getElementById('proxy-status');
btnProxyCheck?.addEventListener('click', async () => {
  btnProxyCheck.disabled = true;
  if (proxyStatus) { proxyStatus.textContent = 'Проверяю…'; proxyStatus.className = 'st-hint'; }
  try {
    const mode = proxySelect ? proxySelect.root.dataset.value : 'system';
    const raw = (proxyHost?.value || '').trim();
    const endpoint = parseProxyEndpointInput(raw);
    if (mode === 'custom' && !endpoint) throw new Error('Неверный адрес. Введи host:port, порт от 1 до 65535');
    const patch = { proxy: proxyFormPatch(), doh: !!dohToggle?.checked };
    if (autoMirrorToggle) patch.autoMirror = autoMirrorToggle.checked;
    const saved = await window.native.netSettingsSet(patch);
    if (!saved?.ok) throw new Error(saved?.error || 'Не удалось применить настройки');
    const r = await window.native.checkProxy();
    if (proxyStatus) {
      if (r?.ok) { proxyStatus.textContent = `${mode === 'custom' ? `${endpoint.host}:${endpoint.port}` : mode === 'direct' ? 'прямое соединение' : 'системный прокси'} доступен · ${r.ms} мс`; proxyStatus.className = 'st-hint pv-ok'; }
      else { proxyStatus.textContent = `${r?.error || 'Проверка не пройдена'}${r?.status ? ` · HTTP ${r.status}` : ''}`; proxyStatus.className = 'st-hint pv-err'; }
    }
  } catch (e) { if (proxyStatus) { proxyStatus.textContent = String(e?.message || e); proxyStatus.className = 'st-hint pv-err'; } }
  btnProxyCheck.disabled = false;
});
async function loadNetStatus() {
  try {
    const result = await window.native.netHealth();
    if (result?.ok && result.results) {
      netMirrorList.textContent = result.results.map((item) => `${item.label}: ${item.ok ? '✓' : '✗'} ${item.status ? `HTTP ${item.status} ` : ''}${item.ms}ms`).join('\n');
    }
  } catch (error) {
    console.warn('[AnimeOn] Could not load network status:', error);
  }
}
document.getElementById('btn-network-check')?.addEventListener('click',async()=>{btnConnectionCheck.disabled=true; if(netMirrorList) netMirrorList.textContent='Проверяю сайты…'; const r=await window.native.netHealth(); btnConnectionCheck.disabled=false; if(r?.ok && r.results){ netMirrorList.textContent=r.results.map(x=>`${x.label}: ${x.ok?'✓':'✗'} ${x.status?`HTTP ${x.status} `:''}${x.ms}ms`).join('\n'); toast(r.internet?'Сайты проверены':'Есть недоступные сайты',r.internet?'ok':'error'); } });
document.getElementById('btn-open-log')?.addEventListener('click',async()=>{const r=await window.native.openLogs();if(!r?.ok)toast('Не удалось открыть журнал','error');});
document.getElementById('btn-copy-log')?.addEventListener('click',async()=>{const r=await window.native.copyLogs();toast(r?.ok?'Журнал скопирован':'Не удалось скопировать журнал',r?.ok?'ok':'error');});
document.getElementById('btn-clear-log')?.addEventListener('click',async()=>{if(await askConfirmation('Очистить журнал ошибок?', 'Очистить журнал')){const r=await window.native.clearLogs();toast(r?.ok?'Журнал очищен':'Не удалось очистить журнал',r?.ok?'ok':'error');}});
document.getElementById('btn-screenshots-open-settings')?.addEventListener('click',openScreenshots);
document.getElementById('btn-screenshots-folder-settings')?.addEventListener('click',()=>window.native.openScreenshotsFolder());
document.getElementById('btn-about-check-update')?.addEventListener('click', async () => {
  await refreshUpdateStatus(false, true);
});
document.getElementById('btn-about-source')?.addEventListener('click',()=>window.native.openExternal('https://github.com/Neukluziy/animeon-desktop'));

initFindInPage({ native: window.native });
let switchTab = () => {};
let closeTab = () => {};
const { tabTitle, renderTabs } = initTabsView({
  getPageTabs: () => pageTabs,
  getActiveTab: () => activeTab,
  getActiveWebview: () => activeWebview,
  webview: wv,
  switchTab: (...args) => switchTab(...args),
  closeTab: (...args) => closeTab(...args),
});
initAccounts({ native: window.native, cfg, toast, askConfirmation });
document.getElementById('btn-new-window')?.addEventListener('click', async () => {
  try {
    const result = await window.native.openNewWindow();
    if (!result?.ok) throw new Error(result?.error || 'Не удалось создать окно');
  } catch (error) {
    toast(error?.message || 'Не удалось создать окно', 'error');
  }
});
let syncFavoriteButton = () => {};
const tabController = initTabController({
  state: {
    get pageTabs() { return pageTabs; },
    set pageTabs(value) { pageTabs = value; },
    get activeTab() { return activeTab; },
    set activeTab(value) { activeTab = value; },
    get activeWebview() { return activeWebview; },
    get currentSite() { return currentSite; },
    set currentSite(value) { currentSite = value; },
    get tabWebviews() { return tabWebviews; },
    get firstWebview() { return firstWebview; },
    syncFavoriteButton: () => syncFavoriteButton(),
  },
  sites: SITES,
  appConstants,
  mediaStates,
  inactiveTabUnloadTimers,
  native: window.native,
  tabTitle,
  updateMirrorBtn,
  createTabWebview,
  showTabWebview,
  renderTabs,
  updateNav,
  applyGuestStyles,
});
const {
  isAnimeOnUrl,
  normalizeTabUrl,
  samePageUrl,
  syncActiveTabFromWebview,
  updateSiteFromUrl,
} = tabController;
switchTab = tabController.switchTab;
closeTab = tabController.closeTab;
try {
  applySiteList(cfg.siteList);
} catch (error) {
  console.warn('[AnimeOn] Could not apply saved site list:', error);
}
function updateDndButton(){
  if(!btnDnd)return;
  const enabled=!!cfg.doNotDisturb;
  btnDnd.classList.toggle('active',enabled);
  btnDnd.setAttribute('aria-pressed',enabled?'true':'false');
  btnDnd.title=enabled?'Уведомления приостановлены':'Уведомления включены';
  btnDnd.setAttribute('aria-label', enabled ? 'Возобновить уведомления' : 'Приостановить уведомления');
  btnDnd.innerHTML=enabled
    ? '<span class="dnd-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><path d="M4 4l16 16"/></svg></span>'
    : '<span class="dnd-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg></span>';
}
btnDnd?.addEventListener('click',async()=>{
  const enabled=!cfg.doNotDisturb;
  try{
    const r=await window.native.setDnd(enabled);
    if(!r?.ok)throw new Error('dnd');
    cfg.doNotDisturb=enabled;
    updateDndButton();
    toast(enabled?'Уведомления приостановлены':'Уведомления снова включены', enabled ? 'error' : 'ok');
  }catch{toast('Не удалось изменить настройки уведомлений','error');}
});
updateDndButton();

const pageTabContext = {
  get pageTabs() { return pageTabs; },
  set pageTabs(value) { pageTabs = value; },
  get activeTab() { return activeTab; },
  set activeTab(value) { activeTab = value; },
  get activeWebview() { return activeWebview; },
  get currentSite() { return currentSite; },
  get tabWebviews() { return tabWebviews; },
  get firstWebview() { return firstWebview; },
  sites: SITES,
  createTabWebview,
  showTabWebview,
  loadTabUrl,
  renderTabs,
  saveTabs,
  syncActiveTabFromWebview,
};
const pageFeature = initPageLibrary({
  native: window.native, cfg, toast, askConfirmation, store, tabTitle, samePageUrl, isAnimeOnUrl,
  tabs: pageTabContext,
});
syncFavoriteButton = pageFeature.syncFavoriteButton;
btnCloseWatchNotes?.addEventListener('click', () => watchNotesModal?.classList.remove('show'));
watchNotesModal?.addEventListener('click', (event) => {
  if (event.target === watchNotesModal) watchNotesModal.classList.remove('show');
});

btnNewTab?.addEventListener('click',async()=>{
  try{
    syncActiveTabFromWebview();
    const index=pageTabs.length;
    const source=pageTabs[activeTab]?.url||'';
    const inferred=/\banimeon\.cc\b/i.test(source)?'cc':(/\banimeon\.co\b/i.test(source)?'co':(currentSite||'co'));
    const base=SITES[inferred]||SITES.co;
    const webview=createTabWebview(index);
    pageTabs.push({url:base.url,title:base.label});
    activeTab=index;
    showTabWebview(index);
    renderTabs();
    loadTabUrl(webview,base.url);
    await saveTabs();
  }catch(e){console.error('[AnimeOn] new tab error',e);toast('Не удалось создать вкладку','error');}
});
window.native.onTabsCycle?.(delta=>{if(!pageTabs.length)return;switchTab((activeTab+Number(delta||1)+pageTabs.length)%pageTabs.length);});
(async()=>{
  try{
    const selectedId=SITES[store('site')] ? store('site') : 'co';
    currentSite=selectedId;
    const selected=SITES[selectedId];
    const savedTabs=Array.isArray(cfg.tabs)?cfg.tabs:null;
    const saveOn=cfg.saveTabs!==false;
    const restoreOn=cfg.restoreLastTab!==false;
    if(saveOn && savedTabs && savedTabs.length){
      pageTabs=savedTabs.map(t=>({url:String(t.url||selected.url), title:String(t.title||t.url||selected.label), pinned:t.pinned===true}));
      activeTab=restoreOn && Number.isInteger(cfg.activeTab) ? Math.max(0, Math.min(cfg.activeTab, pageTabs.length-1)) : 0;
      try {
        updateSiteFromUrl(pageTabs[activeTab]?.url || selected.url);
      } catch (error) {
        console.warn('[AnimeOn] Could not restore the selected site for saved tabs:', error);
      }
    } else {
      pageTabs=[{url:selected.url,title:selected.label}];
      activeTab=0;
    }
    if(!tabWebviews[0]) tabWebviews[0]=firstWebview;
    if(!tabWebviews[activeTab]) createTabWebview(activeTab);
    showTabWebview(activeTab);
    renderTabs();
    await accessKeyFeature.gate;
    if (!firstLaunchOnboarding && cfg.remember === '1') document.body.classList.add('site-content-ready');
    if (!firstLaunchOnboarding) {
      const activeUrl=pageTabs[activeTab]?.url||selected.url;
      if(tabWebviews[activeTab]) loadTabUrl(tabWebviews[activeTab], activeUrl);
    }
    await window.native.tabsSet(pageTabs,activeTab);
    updateMirrorBtn();
  } catch (error) {
    console.warn('[AnimeOn] Could not restore saved tabs; opening the default site:', error);
    currentSite='co';
    pageTabs=[{url:SITES.co.url,title:SITES.co.label}];
    activeTab=0;
    if(!tabWebviews[0]) tabWebviews[0]=firstWebview;
    showTabWebview(0);
    renderTabs();
    await accessKeyFeature.gate;
    if (!firstLaunchOnboarding && cfg.remember === '1') document.body.classList.add('site-content-ready');
    if (!firstLaunchOnboarding) loadTabUrl(tabWebviews[0]||firstWebview,SITES.co.url);
  }
})();

function closeSettings() {
  void siteAppearance.revertVisualPreview();
  settingsOverlay.classList.remove('show');
  btnSettings.classList.remove('open');
  if(settingsSearch){settingsSearch.value='';window.__applySettingsFilter?.();}
}
btnSettings.addEventListener('click', openSettings);
btnWatchNotes?.addEventListener('click',()=>{
  watchNotesModal?.classList.add('show');
  setTimeout(()=>document.getElementById('watch-note-input')?.focus(),100);
});
btnCloseSettings.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) closeSettings();
});
window.native.onOpenSettings(openSettings);
window.native.onConfirmClose?.(() => confirmScreen?.classList.add('show'));
confirmYes?.addEventListener('click', () => { confirmScreen?.classList.remove('show'); window.native.confirmClose(true); });
confirmNo?.addEventListener('click', () => confirmScreen?.classList.remove('show'));

function updateNav() {
  try {
    btnBack.disabled = !wv.canGoBack();
    btnFwd.disabled = !wv.canGoForward();
  } catch { void 0; }
}

function rememberPage(url) {
  if (!isAnimeOnUrl(url)) return;
  const normalized = normalizeTabUrl(url);
  cfg.lastUrl = String(normalized);
  const history = Array.isArray(cfg.history) ? cfg.history : [];
  const next = [normalized, ...history.filter(x => normalizeTabUrl(x) !== normalized)].slice(0, 80);
  cfg.history = next;
  if (pageTabs.length) {
    let title='';
    try { title = activeWebview.getTitle() || document.title || ''; } catch { void 0; }
    const prevUrl = pageTabs[activeTab]?.url || '';
    if (prevUrl !== normalized || (title && pageTabs[activeTab]?.title !== title)) {
      pageTabs[activeTab] = { ...pageTabs[activeTab], url:normalized, title:title || tabTitle({url:normalized}) };
      try {
        updateSiteFromUrl(normalized);
      } catch (error) {
        console.warn('[AnimeOn] Could not update the current site from navigation:', error);
      }
      saveTabs();
      renderTabs();
    }
  }
  window.native.setConfig({ lastUrl: cfg.lastUrl, history: cfg.history });
  window.native.recentPageAdd?.({ url: normalized, title: tabTitle({ url: normalized }) }).catch?.((error) => {
    console.warn('[AnimeOn] Could not save the recent page:', error);
  });
  syncFavoriteButton();
}


wv?.addEventListener('did-navigate', e => { rememberPage(e.url); updateNav(); });
wv?.addEventListener('did-navigate-in-page', e => { rememberPage(e.url); updateNav(); });
wv?.addEventListener('dom-ready', () => {
  document.body.classList.remove('page-soft-loading');
  document.body.classList.add('page-ready');
  setTimeout(() => document.body.classList.remove('page-ready'), 360);
});



const commandPaletteFeature = initCommandPalette({
  native: window.native,
  cfg,
  sites: SITES,
  webview: wv,
  toast,
  setPlayerSpeed,
  togglePictureInPicture,
  refreshVolume,
  openSite,
  getOtherSiteId,
  getCurrentSite: () => currentSite,
  openSettings,
});

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); commandPaletteFeature.openCommandPalette(); return; }
  if (e.key === 'Escape') { closeSleepTimer(); setVolumePanelOpen(false); commandPaletteFeature.closeCommandPalette(); hotkeysFeature.closeHotkeys(); closeScreenshots(); closeSettings(); watchNotesModal?.classList.remove('show'); hideError(); confirmScreen?.classList.remove('show'); return; }
  if (e.key === 'F11') {
    e.preventDefault();
    window.native.toggleFullscreen();
    return;
  }
  if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
    e.preventDefault();
    wv.reload();
    return;
  }
  if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    return;
  }
  if (e.ctrlKey && (e.key === '-' || e.key === '_')) {
    e.preventDefault();
    return;
  }
  if (e.ctrlKey && e.key === '0') {
    e.preventDefault();
    return;
  }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); wv.goBack(); }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); wv.goForward(); }
});

const splashFeature = initSplash({
  splash,
  progressBar: splashBarFill,
  percentLabel: splashPct,
  fallback: __splashFallback,
  state: {
    get booted() { return booted; },
    set booted(value) { booted = value; },
  },
  showWelcomeScreen,
});
const { animateProgress, revealApp: revealSplashApp, startSplashProgress } = splashFeature;
revealApp = revealSplashApp;

if (firstLaunchOnboarding) revealApp(0);

wv.addEventListener('did-start-loading', () => {
  animateProgress(18);
  document.body.classList.remove('page-ready');
  document.body.classList.add('page-soft-loading');
  progress?.classList.add('active');
  hideError();
  window.native.setTaskbarProgress?.(0.08);
});

wv.addEventListener('dom-ready', () => {
  animateProgress(82);
  wv.focus();
  document.body.classList.remove('page-soft-loading');
  document.body.classList.add('page-ready');
  hideError();
  window.native.setTaskbarProgress?.(0.78);
  updateNav();
  applyGuestStyles();
});

wv.addEventListener('did-stop-loading', () => {
  animateProgress(100);
  progress?.classList.remove('active');
  updateNav();
  window.native.setTaskbarProgress?.(1);
  setTimeout(() => window.native.setTaskbarProgress?.(-1), 350);
  revealApp();
  autoMirrorAttempts = 0;
});

let autoMirrorCooldown = 0;
let autoMirrorAttempts = 0;
wv.addEventListener('did-fail-load', (e) => {
  if (e.errorCode === -3 || e.isMainFrame === false) return;
  window.native.setTaskbarProgress?.(-1);
  const now = Date.now();
  const autoMirror = cfg.autoMirror !== false;
  if (autoMirror && booted && now - autoMirrorCooldown > 8000 && autoMirrorAttempts < 3 && Object.keys(SITES).length > 1) {
    autoMirrorCooldown = now;
    autoMirrorAttempts += 1;
    toast('Сайт не отвечает — пробую другой…', 'error');
    const otherId = getOtherSiteId();
    if (otherId && otherId !== currentSite) { switchMirror(); return; }
  }
  const description = String(e.errorDescription || '').toLowerCase();
  const reason = /internet_disconnected/.test(description)
    ? 'Нет подключения к интернету.'
    : /name_not_resolved|dns/.test(description)
      ? 'Не удалось найти адрес сайта (ошибка DNS).'
      : /proxy/.test(description)
        ? 'Не удалось подключиться через прокси. Проверьте его настройки.'
        : /blocked|access_denied/.test(description)
          ? 'Подключение заблокировано сетью или защитной программой.'
          : 'Сайт недоступен или соединение прервано.';
  showError(`${reason} Попробуй ещё раз, запусти диагностику или переключись на другой сайт.`);
});

setTimeout(() => revealApp(100), appConstants.appRevealFallbackDelayMs);

let lastScrollY = 0;
const { setChromeHidden } = initWindowVisibility({ native: window.native, updateHost });

const { hideError, showError } = initErrorScreen({
  native: window.native,
  appInfo,
  webview: wv,
  toast,
  openSettings,
  switchMirror,
  diagnosticsOutput,
});

function setPosterWall(urls) {
  if (!posterWall) return;
  if (picker?.classList.contains('show') || document.body.classList.contains('picker-visible')) {
    pendingPosterUrls = Array.isArray(urls) ? urls.slice(0, 10) : [];
    posterWall.innerHTML = '';
    return;
  }
  posterWall.innerHTML = '';
  urls.slice(0, 10).forEach((url, i) => {
    const img = document.createElement('img');
    img.className = 'poster'; img.src = url;
    img.style.left = `${(i*13)%105 - 8}%`;
    img.style.top = `${(i*29)%95 - 10}%`;
    img.style.animationDelay = `${-i*1.7}s`;
    posterWall.appendChild(img);
  });
}
window.native.onMirrorPosters?.((urls) => setPosterWall(urls || []));
window.native.onLoadProgress?.((progress) => {
  try {
    window.native.setTaskbarProgress?.(progress);
  } catch (error) {
    console.warn('[AnimeOn] Could not update taskbar loading progress:', error);
  }
});

window.native.onNetStatus?.((data) => {
  if (data?.results && netMirrorList) {
    netMirrorList.textContent = data.results.map((item) => `${item.label}: ${item.ok ? '✓' : '✗'} ${item.status ? `HTTP ${item.status} ` : ''}${item.ms}ms`).join('\n');
  }
});
window.native.onRestartWebview?.(() => {
  try { wv.reload(); } catch (error) {
    console.warn('[AnimeOn] Could not restart the site webview:', error);
  }
});

const { refreshUpdateStatus } = initUpdateStatus({
  native: window.native,
  cfg,
  appInfo,
  toast,
  status: updStatus,
  checkButton: btnUpdCheck,
  openReleaseButton: btnUpdOpenRelease,
  getButton: btnUpdGet,
});

applyTheme(store('theme') || 'violet', { skipSave: true });
rememberPick.checked = rememberSettings.checked = store('remember') === '1';
autostartToggle.checked = !!store('autostart');
trayToggle.checked = !!store('tray');
autohideToggle.checked = store('autoHide') !== false;
compactToggle.checked = !!store('compact');
if (alwaysOnTopToggle) alwaysOnTopToggle.checked = !!store('alwaysOnTop');
lowPowerToggle.checked = store('lowPower') !== false;
if (performanceSelect) performanceSelect.pick(store('performance') || 'balanced');
if (autoRecoveryToggle) autoRecoveryToggle.checked = store('autoRecovery') !== false;
if (confirmCloseToggle) confirmCloseToggle.checked = store('closeBehavior') === 'ask' || (!!store('confirmClose') && !store('closeBehavior'));
if (closeBehaviorSelect) closeBehaviorSelect.pick(store('closeBehavior') || (store('confirmClose') ? 'ask' : 'exit'));
applyPerformance(performanceSelect?.value || 'balanced');
document.body.classList.toggle('compact-mode', compactToggle.checked);
document.body.classList.toggle('low-power', lowPowerToggle.checked || performanceSelect?.value === 'economy');

if (appInfo.version) stVersion.textContent = `AnimeOn Desktop · v${appInfo.version}`;

let rememberSite = store('remember') === '1';
let savedSite = SITES[store('site')] ? store('site') : 'co';
accessKeyFeature.initialize();
try {
  activateSite(savedSite, { save: false, updatePicker: false });
  siteAppearance.syncVisualUI();
  refreshProfiles();
} catch (e) {
  console.error('[AnimeOn] startup init error', e);
}

startSplashProgress();

try {
  if (picker) {
    if (firstLaunchOnboarding || rememberSite) {
      picker.classList.remove('show', 'hide');
      document.body.classList.remove('picker-visible');
    } else {
      picker.classList.remove('hide');
      picker.classList.add('show');
      document.body.classList.add('picker-visible');
    }
  }
  setTimeout(() => { if (!booted) revealApp(0); }, 650);
} catch (e) {
  console.error('[AnimeOn] site open error', e);
  try { revealApp(0); } catch (error) {
    console.error('[AnimeOn] Could not reveal the app after site startup failed:', error);
  }
}

function scheduleDeferredStartupChecks() {
  const delay = Number(appConstants.startupBackgroundCheckDelayMs) || 7000;
  setTimeout(async () => {
    if (mediaStates.get(activeWebview)?.playing) {
      scheduleDeferredStartupChecks();
      return;
    }
    await loadSitesFromRemote();
    if (!mediaStates.get(activeWebview)?.playing) await refreshUpdateStatus(true);
    else scheduleDeferredStartupChecks();
  }, delay);
}
scheduleDeferredStartupChecks();

initLocalTools({ native: window.native, cfg, toast });

let lastNotificationSignature='';
async function pollAnimeNotifications() {
  try {
    if (!cfg.notify) return;
    const result = await window.native.notificationPoll();
    const first = Array.isArray(result?.items) ? result.items[0] : null;
    if (!first) return;
    const signature = String(first.id || first.notification_id || first.created_at || first.title || '');
    if (!signature || signature === lastNotificationSignature) return;
    const previousSignature = lastNotificationSignature;
    lastNotificationSignature = signature;
    if (!previousSignature) return;
    toast(first.title || first.message || 'Новое уведомление');
  } catch (error) {
    console.warn('[AnimeOn] Could not poll AnimeOn notifications:', error);
  }
}
setTimeout(pollAnimeNotifications,appConstants.notificationInitialPollDelayMs);
setInterval(pollAnimeNotifications,appConstants.notificationPollIntervalMs);
