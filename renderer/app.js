import { initLocalTools } from './local-tools.js';
import { initScreenshots } from './screenshots.js';
import { initTabsView } from './tabs-view.js';
import { initHotkeys } from './hotkeys.js';
import { initAccessKeyFeature } from './access-key.js';
import { initPageLibrary } from './pages.js';
import { initThemeController } from './theme.js';
import { initSiteAppearance } from './site-appearance.js';


const __splashFallback = (() => {
  const root = document.getElementById('splash');
  const fill = root?.querySelector('.s-bar i');
  const pct = root?.querySelector('.s-pct');
  if (!root || !fill || !pct) return null;
  let value = Number.parseFloat(fill.style.width) || 5;
  let target = value;
  let raf = 0;
  let takenOver = false;
  const paint = () => {
    if (takenOver) return;
    value += (target - value) * 0.075;
    if (Math.abs(target - value) < 0.08) value = target;
    fill.style.width = `${Math.round(value * 10) / 10}%`;
    pct.textContent = `${Math.round(value)}%`;
    raf = requestAnimationFrame(paint);
  };
  const set = (v) => {
    if (Number.isFinite(v)) target = Math.max(target, Math.min(94, v));
  };
  set(8);
  setTimeout(() => set(18), 220);
  setTimeout(() => set(32), 520);
  setTimeout(() => set(48), 900);
  setTimeout(() => set(64), 1350);
  setTimeout(() => set(78), 1900);
  setTimeout(() => set(88), 2600);
  raf = requestAnimationFrame(paint);
  return {
    takeOver() {
      takenOver = true;
      cancelAnimationFrame(raf);
    }
  };
})();
const webviewHost = document.getElementById('view-area');
const firstWebview = document.getElementById('wv');
let activeWebview = firstWebview;
const webviewListeners = [];
const webviewListenerMap = new WeakMap();

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
              try { webview.removeEventListener(item[0], item[2], item[3]); } catch {}
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
  if (index === 0) return firstWebview;
  const webview = document.createElement('webview');
  webview.id = `wv-tab-${index}`;
  webview.setAttribute('allowpopups', '');
  webview.setAttribute('partition', 'persist:animeon');
  webview.setAttribute('webpreferences', 'webSecurity=yes,contextIsolation=yes,sandbox=yes,allowRunningInsecureContent=no');
  webview.className = 'animeon-tab-webview';
  webview.style.cssText = 'display:none;visibility:hidden;position:absolute;inset:0;width:100%;height:100%;border:0;z-index:0;background:#050507;';
  webviewHost?.appendChild(webview);
  tabWebviews[index] = webview;
  attachWebviewListeners(webview);
  webview.addEventListener('dom-ready', () => {
    if (tabWebviews[index] === webview && activeWebview === webview) {
      try { webview.focus(); } catch {}
      try { updateNav(); } catch {}
      try { applyGuestStyles(); } catch {}
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
btnBack?.addEventListener('click', () => { if (wv.canGo()) wv.goBack(); });
btnFwd?.addEventListener('click', () => { if (wv.canGoForward()) wv.goForward(); });
btnHome?.addEventListener('click', () => openSite(currentSite || cfg.site || 'cc'));
btnReload?.addEventListener('click', () => wv.reload());
btnMax?.addEventListener('click', () => window.native.minimizeWindow());
btnFs?.addEventListener('click', () => window.native.toggleMaximize());
btnClose?.addEventListener('click', () => window.native.close());
window.native.onWinState?.((maximized) => btnFs?.classList.toggle('is-max', !!maximized));
window.native.onFsState?.((fullscreen) => document.body.classList.toggle('is-fs', !!fullscreen));
const btnSettings = document.getElementById('btn-settings');
const btnHotkeysMain = document.getElementById('btn-hotkeys-main');
const btnScreenshotsMain = document.getElementById('btn-screenshots-main');
const btnVolume = document.getElementById('btn-volume');
const volumeWrap = document.querySelector('.volume-wrap');
const volumePanel = document.getElementById('volume-panel');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const volumeMinus = document.getElementById('volume-minus');
const volumePlus = document.getElementById('volume-plus');
const volumeMute = document.getElementById('volume-mute');
const settingsOverlay = document.getElementById('settings');
const hotkeysModal = document.getElementById('hotkeys-modal');
const btnHotkeys = document.getElementById('btn-hotkeys');
const btnCloseHotkeys = document.getElementById('btn-close-hotkeys');
const screenshotsModal = document.getElementById('screenshots-modal');
const btnCloseScreenshots = document.getElementById('btn-close-screenshots');
const screenshotsList = document.getElementById('screenshots-list');
const screenshotsCount = document.getElementById('screenshots-count');
const btnScreenshotsOpenFolder = document.getElementById('btn-screenshots-open-folder');
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
const btnRestartWebview = document.getElementById('btn-restart-webview');
const btnClearCache = document.getElementById('btn-clear-cache');
const btnDevtools = document.getElementById('btn-devtools');
const btnDiagnostics = document.getElementById('btn-diagnostics');
const diagnosticsOutput = document.getElementById('diagnostics-output');
const commandPalette = document.getElementById('command-palette');
const commandInput = document.getElementById('command-input');
const commandList = document.getElementById('command-list');
const offlineScreen = document.getElementById('offline-screen');
const offlineRetry = document.getElementById('offline-retry');
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
const smoothScrollToggle = document.getElementById('smooth-scroll-toggle');
const siteScrollbarsToggle = document.getElementById('site-scrollbars-toggle');
let profileValue = '';
const profileSelect = initCSelect('profile-select', null);
const styleProfileName = document.getElementById('style-profile-name');
const btnProfileSave = document.getElementById('btn-profile-save');
const btnProfileLoad = document.getElementById('btn-profile-load');
const btnProfileDelete = document.getElementById('btn-profile-delete');
const btnUpdOpenRelease = document.getElementById('btn-upd-open-release');
const settingsNav = document.getElementById('settings-nav');
const toastStack = document.getElementById('toast-stack');
const mediaOverlay = document.getElementById('media-overlay');
const mediaOverlayText = document.getElementById('media-overlay-text');
const hotkeysList = document.getElementById('hotkeys-list');
const btnHotkeysReset = document.getElementById('btn-hotkeys-reset');
const stVersion = document.getElementById('st-version');
const updStatus = document.getElementById('upd-status');
const btnUpdGet = document.getElementById('btn-upd-get');
const btnUpdCheck = document.getElementById('btn-upd-check');
const errorScreen = document.getElementById('error-screen');
const errorMessage = document.getElementById('error-message');
const btnErrorRetry = document.getElementById('btn-error-retry');
const btnErrorMirror = document.getElementById('btn-error-mirror');
const posterWall = document.getElementById('poster-wall');
const pageToolbar = document.getElementById('page-toolbar');
const tabsBar = document.getElementById('tabs-bar');
const tabsCount = document.getElementById('tabs-count');
const tabsSidebarToggle = document.getElementById('btn-tabs-sidebar-toggle');
const btnNewTab = document.getElementById('btn-new-tab');
const btnDnd = document.getElementById('btn-dnd');
const findBar = document.getElementById('find-bar');
const findInput = document.getElementById('find-input');
const findPrev = document.getElementById('find-prev');
const findNext = document.getElementById('find-next');
const findClose = document.getElementById('find-close');
const findCount = document.getElementById('find-count');
const watchNotesModal = document.getElementById('watch-notes-modal');
const btnCloseWatchNotes = document.getElementById('btn-close-watch-notes');
const btnWatchNotes = document.getElementById('btn-watch-notes');
const resumeToggle = document.getElementById('resume-toggle');
const autoNextToggle = document.getElementById('autonext-toggle');
const dndToggle = document.getElementById('dnd-toggle');
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

setTimeout(() => {
  try {
    if (booted) return;
    console.error('[AnimeOn] Инициализация зависла дольше 8 сек — принудительно показываю интерфейс.');
    try { __splashFallback?.takeOver(); } catch {}
    try { revealApp(0); } catch {}
    try {
      if (!firstLaunchOnboarding) {
        const p = document.getElementById('site-picker');
        if (p) { p.classList.add('show'); document.body.classList.add('picker-visible'); }
      }
    } catch {}
  } catch (e) {
    try { console.error('[AnimeOn] watchdog error', e); } catch {}
    try { document.getElementById('splash')?.remove(); } catch {}
  }
}, 8000);
let currentSite = null;

const cfg = window.native.getConfig() || {};
firstLaunchOnboarding = cfg.onboardingComplete !== true;
window.__startupOnboarding = firstLaunchOnboarding;
const accessKeyFeature = initAccessKeyFeature({
  native: window.native, cfg, toast, askConfirmation,
  isFirstLaunch: () => firstLaunchOnboarding,
  isRememberedSite: () => rememberSite,
  reloadWebviews: () => tabWebviews.forEach((webview) => { try { webview?.reload(); } catch {} }),
});
const DEFAULT_DISCORD_RPC_SETTINGS = {
  enabled: true,
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
    toast(key === 'enabled' ? (input.checked ? 'Статус Discord включён' : 'Статус Discord выключен') : 'Настройки Discord сохранены');
  });
}

const SITES = {
  cc: { url: 'https://animeon.cc/', label: 'animeon.cc' },
  co: { url: 'https://v1.animeon.co/', label: 'v1.animeon.co' },
};

function applySiteList(list) {
  if (!Array.isArray(list) || list.length < 2) return false;

  const first = list[0];
  const second = list[1];
  if (!first?.url || !second?.url) return false;

  SITES.cc = {
    url: String(first.url).endsWith('/') ? String(first.url) : `${String(first.url)}/`,
    label: String(first.label || first.url).replace(/^https?:\/\//i, '').replace(/\/$/, ''),
  };
  SITES.co = {
    url: String(second.url).endsWith('/') ? String(second.url) : `${String(second.url)}/`,
    label: String(second.label || second.url).replace(/^https?:\/\//i, '').replace(/\/$/, ''),
  };

  document.querySelectorAll('[data-site-label="cc"]').forEach((el) => {
    el.textContent = SITES.cc.label;
  });
  document.querySelectorAll('[data-site-label="co"]').forEach((el) => {
    el.textContent = SITES.co.label;
  });

  document.querySelectorAll('[data-site]').forEach((el) => {
    const id = el.dataset.site;
    const site = SITES[id];
    if (!site) return;
    el.title = site.url;
  });

  if (currentSite) {
    updateMirrorBtn();
    updateSiteFromUrl?.(SITES[currentSite].url);
  }
  renderTabs();
  return true;
}

try {
  applySiteList(cfg.siteList);
} catch {}

async function loadSitesFromRemote() {
  try {
    const previousSites = { cc: { ...SITES.cc }, co: { ...SITES.co } };
    const r = await window.native.fetchSites();
    if (r?.ok) {
      if (applySiteList(r.sites)) {
        const remapSiteUrl = (value) => {
          try {
            const url = new URL(String(value || ''));
            for (const id of ['cc', 'co']) {
              const oldHost = new URL(previousSites[id].url).hostname.toLowerCase();
              if (url.hostname.toLowerCase() !== oldHost && !url.hostname.toLowerCase().endsWith(`.${oldHost}`)) continue;
              const newSiteUrl = new URL(SITES[id].url);
              url.protocol = newSiteUrl.protocol;
              url.host = newSiteUrl.host;
              return url.href;
            }
          } catch {}
          return value;
        };
        const remapItems = (items) => (Array.isArray(items) ? items.map((item) => {
          if (typeof item === 'string') return remapSiteUrl(item);
          return item && typeof item === 'object' && item.url ? { ...item, url: remapSiteUrl(item.url) } : item;
        }) : []);
        cfg.siteList = r.sites;
        cfg.tabs = remapItems(cfg.tabs);
        cfg.lastUrl = remapSiteUrl(cfg.lastUrl);
        cfg.history = remapItems(cfg.history);
        cfg.favorites = remapItems(cfg.favorites);
        cfg.recentPages = remapItems(cfg.recentPages);
        cfg.pageFavorites = remapItems(cfg.pageFavorites);
        window.native.setConfig({
          siteList: cfg.siteList,
          tabs: cfg.tabs,
          lastUrl: cfg.lastUrl,
          history: cfg.history,
          favorites: cfg.favorites,
          recentPages: cfg.recentPages,
          pageFavorites: cfg.pageFavorites,
        });
        return true;
      }
    }
    applySiteList(r?.sites || cfg.siteList);
  } catch {
    try { applySiteList(cfg.siteList); } catch {}
  }
}
const remoteSitesReady = loadSitesFromRemote();
const appInfo = window.native.getAppInfo() || { version: '' };
document.getElementById('about-version-value')?.append(`v${appInfo.version || ''}`);

function store(k, v) {
  if (v === undefined) return cfg[k];
  cfg[k] = v;
  window.native.setConfig({ [k]: v });
}

const siteAppearance = initSiteAppearance({
  cfg,
  store,
  applyGuestStyles,
  toast,
  smoothScrollToggle,
  siteScrollbarsToggle,
});

function refreshProfiles(){
  if(!profileSelect) return;
  const list = profileSelect.root.querySelector('.cselect-list');
  list.innerHTML = '';
  Object.keys(cfg.profiles || {}).sort().forEach(name=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = name;
    b.innerHTML = '<span class="cselect-t"><b></b></span><svg class="cselect-check" viewBox="0 0 24 24"><path d="M5 13l4 4 10-11"/></svg>';
    b.querySelector('b').textContent = name;
    list.appendChild(b);
  });
  const keep = (cfg.profiles || {})[profileValue] ? profileValue : '';
  profileValue = keep;
  const label = profileSelect.root.querySelector('.cselect-label');
  if (keep) profileSelect.pick(keep);
  else { profileSelect.root.dataset.value = ''; if (label) { label.textContent = 'Выберите профиль'; label.classList.add('dim'); } }
}

btnProfileSave?.addEventListener('click',()=>{
  const name=(styleProfileName?.value||'').trim();
  if(!name){toast('Введите название профиля','error');return}
  const key=currentSite==='co'?'co':'cc';
  if(!cfg.profiles||typeof cfg.profiles!=='object')cfg.profiles={};
  cfg.profiles[name]={theme:getActiveTheme(),visual:siteAppearance.getVisual(),smoothSite:cfg.smoothSite!==false,showSiteScrollbars:!!cfg.showSiteScrollbars,css:cfg.customCss?.[key]||'',resumeEnabled:cfg.resumeEnabled!==false,autoNext:!!cfg.autoNext,notify:!!cfg.notify,doNotDisturb:!!cfg.doNotDisturb,performance:cfg.performance||'balanced',lowPower:!!cfg.lowPower,memorySaver:!!cfg.memorySaver,autoCacheCleanup:cfg.autoCacheCleanup!==false,cacheLimitMB:Number(cfg.cacheLimitMB)||512,playbackSpeed:Number(cfg.playbackSpeed)||1,hotkeys:{...(cfg.hotkeys||{})}};
  store('profiles',cfg.profiles);
  refreshProfiles();
  profileValue=name;
  profileSelect?.pick(name);
  toast('Профиль сохранён');
});
btnProfileLoad?.addEventListener('click',()=>{
  const name=profileValue; const profile=cfg.profiles?.[name];
  if(!profile){toast('Выберите профиль','error');return}
  applyTheme(profile.theme||'violet',{skipSave:false});
  cfg.visual=profile.visual||siteAppearance.getVisual();cfg.smoothSite=profile.smoothSite!==false;cfg.showSiteScrollbars=!!profile.showSiteScrollbars;cfg.resumeEnabled=profile.resumeEnabled!==false;cfg.autoNext=!!profile.autoNext;cfg.notify=!!profile.notify;cfg.doNotDisturb=!!profile.doNotDisturb;cfg.performance=profile.performance||'balanced';cfg.lowPower=!!profile.lowPower;cfg.memorySaver=!!profile.memorySaver;cfg.autoCacheCleanup=profile.autoCacheCleanup!==false;cfg.cacheLimitMB=Number(profile.cacheLimitMB)||512;cfg.playbackSpeed=Number(profile.playbackSpeed)||1;cfg.hotkeys={...(profile.hotkeys||cfg.hotkeys||{})};
  const key=currentSite==='co'?'co':'cc';
  if(!cfg.customCss)cfg.customCss={cc:'',co:''};cfg.customCss[key]=profile.css||'';
  store('visual',cfg.visual);store('smoothSite',cfg.smoothSite);store('showSiteScrollbars',cfg.showSiteScrollbars);store('customCss',cfg.customCss);
  siteAppearance.syncVisualUI();loadSiteEditor();applyGuestStyles(); if(resumeToggle)resumeToggle.checked=cfg.resumeEnabled!==false;if(autoNextToggle)autoNextToggle.checked=!!cfg.autoNext;if(dndToggle)dndToggle.checked=!!cfg.doNotDisturb;if(notifyAdvancedToggle)notifyAdvancedToggle.checked=!!cfg.notify;if(memorySaverToggle)memorySaverToggle.checked=!!cfg.memorySaver;if(cacheAutoToggle)cacheAutoToggle.checked=cfg.autoCacheCleanup!==false;if(cacheLimit)cacheLimit.value=String(cfg.cacheLimitMB||512);toast('Профиль загружен');
});
btnProfileDelete?.addEventListener('click',()=>{
  const name=profileValue;if(!name||!cfg.profiles?.[name]){toast('Выберите профиль','error');return}
  delete cfg.profiles[name];store('profiles',cfg.profiles);refreshProfiles();toast('Профиль удалён');
});

async function applyGuestStyles() {
  if (!currentSite || !wv) return;
  const key = currentSite || 'cc';
  const custom = cfg.customCss && typeof cfg.customCss === 'object' ? String(cfg.customCss[key] || '') : '';
  const smooth = cfg.smoothSite !== false;
  const css = `${siteAppearance.buildCss()}\n${custom}\n${smooth ? 'html{scroll-behavior:smooth!important;}' : ''}`;
  try { await window.native.applySiteCss(css); } catch {}
}

const { applyTheme, getActiveTheme } = initThemeController({ cfg, store, applyGuestStyles, toast });

function activateSite(id, { save = true, updatePicker = true } = {}) {
  currentSite = id;
  if (save && rememberPick?.checked) store('site', id);
  document.querySelectorAll('.st-section [data-site]').forEach((el) => {
    const on = el.dataset.site === id;
    el.classList.toggle('selected', on);
    el.classList.toggle('active', on);
  });
  if (updatePicker) {
    document.querySelectorAll('#site-picker [data-site]').forEach((el) => {
      const on = el.dataset.site === id;
      el.classList.toggle('selected', on);
      el.classList.toggle('active', on);
    });
  }
  updateMirrorBtn();
  loadSiteEditor();
}

function openSite(id) {
  const s = SITES[id];
  if (!s) return;
  document.body.classList.add('site-content-ready');
  activateSite(id, { save: false });
  if (!pageTabs.length) pageTabs = [{ url: s.url, title: s.label }];
  else pageTabs[activeTab] = { url: s.url, title: s.label };
  if (!tabWebviews[activeTab]) createTabWebview(activeTab);
  showTabWebview(activeTab);
  loadTabUrl(tabWebviews[activeTab], s.url);
  saveTabs();
}

function loadSiteEditor() {
  if (!siteCssInput) return;
  siteAppearance.syncVisualUI();
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
  if (!cfg.customCss || typeof cfg.customCss !== 'object') cfg.customCss = { cc: '', co: '' };
  cfg.customCss[key] = siteCssInput?.value || '';
  store('customCss', cfg.customCss);
  await applyGuestStyles();
  toast('Оформление сайта применено');
});

btnSiteCssReset?.addEventListener('click', async () => {
  if (!currentSite) return;
  const key = currentSite || 'cc';
  if (!cfg.customCss || typeof cfg.customCss !== 'object') cfg.customCss = { cc: '', co: '' };
  cfg.customCss[key] = '';
  if (siteCssInput) siteCssInput.value = '';
  store('customCss', cfg.customCss);
  await applyGuestStyles();
  toast('Свой CSS сброшен');
});

function getOtherSiteId() {
  const keys = Object.keys(SITES);
  if (keys.length < 2) return keys[0] || 'cc';
  return keys.find(k => k !== currentSite) || keys[0];
}

function switchMirror() {
  const otherId = getOtherSiteId();
  document.body.classList.add('mirror-switching');
  setTimeout(() => { store('site', otherId); openSite(otherId); }, 180);
  setTimeout(() => document.body.classList.remove('mirror-switching'), 520);
}

function updateMirrorBtn() {
  if (!currentSite) return;
  const otherId = getOtherSiteId();
  btnSite.title = `Сейчас ${SITES[currentSite].label} — переключить на ${SITES[otherId].label}`;
}

btnSite.addEventListener('click', switchMirror);

document.querySelectorAll('[data-site]').forEach((card) => {
  card.addEventListener('click', () => {
    const id = card.dataset.site;
    if (!SITES[id]) return;
    activateSite(id);
    if (picker && picker.isConnected) btnContinue.classList.add('show');
  });
});
document.querySelectorAll('.st-section [data-site]').forEach((card) => {
  card.addEventListener('click', () => {
    const id = card.dataset.site;
    if (!SITES[id]) return;
    if (card.closest('.settings-group-card')) {
      store('site', id);
      openSite(id);
    }
  });
});
document.querySelectorAll('.about-detail-link[data-url]').forEach((el) => {
  el.addEventListener('click', () => window.native.openExternal(el.dataset.url));
});

btnContinue.addEventListener('click', async () => {
  if (!currentSite) return;

  if (firstLaunchOnboarding) {
    firstLaunchOnboarding = false;
    window.__startupOnboarding = false;
    store('onboardingComplete', true);
  }
  store('remember', rememberPick.checked ? '1' : '0');
  if (rememberPick.checked) store('site', currentSite);
  else store('site', null);

  let accessStatus;
  try { accessStatus = await accessKeyFeature.statusPromise; }
  catch (error) { toast(`Не удалось проверить ключ доступа: ${String(error?.message || error)}`, 'error'); return; }
  if (!accessStatus?.ok) {
    toast(accessStatus?.error || 'Не удалось проверить ключ доступа', 'error');
    return;
  }
  if (accessStatus.enabled) await accessKeyFeature.gate;
  else if (!accessStatus.promptDismissed) {
    if (!accessKeyFeature.isVisible()) accessKeyFeature.showPrompt('prompt');
    await accessKeyFeature.gate;
  } else accessKeyFeature.releaseSecurityGate();

  picker.classList.add('hide');
  setTimeout(() => {
    document.body.classList.remove('picker-visible');
    document.body.classList.remove('onboarding-mode');
    picker.classList.remove('show');
    if (pendingPosterUrls) {
      const urls = pendingPosterUrls;
      pendingPosterUrls = null;
      requestAnimationFrame(() => setPosterWall(urls));
    }
    openSite(currentSite);
  }, 140);
});

function showWelcomeScreen() {
  if (!firstLaunchOnboarding || !welcomeScreen) return;
  welcomeScreen.classList.add('show');
  welcomeScreen.setAttribute('aria-hidden', 'false');
  document.body.classList.add('onboarding-mode');
  requestAnimationFrame(() => welcomeContinue?.focus());
}

welcomeContinue?.addEventListener('click', () => {
  if (!picker) return;
  welcomeScreen?.classList.remove('show');
  welcomeScreen?.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    picker.classList.remove('hide');
    picker.classList.add('show');
    document.body.classList.add('picker-visible', 'onboarding-mode');
    document.querySelector('#site-picker [data-site].selected')?.focus();
  }, 260);
});

rememberPick.addEventListener('change', () => {
  rememberSettings.checked = rememberPick.checked;
  store('remember', rememberPick.checked ? '1' : '0');
  if (!rememberPick.checked) store('site', null);
  else if (currentSite) store('site', currentSite);
});
rememberSettings.addEventListener('change', () => {
  rememberPick.checked = rememberSettings.checked;
  store('remember', rememberSettings.checked ? '1' : '0');
  if (!rememberSettings.checked) store('site', null);
  else if (currentSite) store('site', currentSite);
});
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
lowPowerToggle.addEventListener('change', () => { store('lowPower', lowPowerToggle.checked); document.body.classList.toggle('low-power', lowPowerToggle.checked || performanceSelect?.value === 'economy'); });
autoRecoveryToggle?.addEventListener('change', () => store('autoRecovery', autoRecoveryToggle.checked));
confirmCloseToggle?.addEventListener('change', () => { const v=confirmCloseToggle.checked; store('confirmClose', v); store('closeBehavior', v ? 'ask' : (store('closeBehavior') === 'ask' ? 'exit' : store('closeBehavior'))); if (closeBehaviorSelect) closeBehaviorSelect.pick(store('closeBehavior') || (v ? 'ask' : 'exit')); });

function applyPerformance(mode) {
  document.body.dataset.performance = mode;
  document.body.classList.toggle('performance-mode', mode === 'performance');
  document.body.classList.toggle('economy-mode', mode === 'economy');
}

btnRestartWebview?.addEventListener('click', () => { hideError(); wv.reload(); });
const toastIcons = {
  ok: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9.3 18 20 6"/></svg>',
  error: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>',
  warning: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="0.7" fill="currentColor"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/></svg>'
};
const toastActionIcons = {
  go: '<svg viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
  retry: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>'
};
function toast(message, type='ok', extra={}) {
  if (!toastStack) return () => {};
  const kind = toastIcons[type] ? type : 'ok';
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  el.innerHTML = '<div class="t-icon">' + toastIcons[kind] + '</div>' +
    '<div class="t-body"><b></b>' + (extra.body ? '<span></span>' : '') + '</div>' +
    '<div class="t-side">' +
    (extra.action ? '<button class="t-action" aria-label="Действие"></button>' : '') +
    '<button class="t-close">×</button></div>' +
    '<i class="t-life"></i>';
  el.querySelector('.t-body b').textContent = message;
  if (extra.body) el.querySelector('.t-body span').textContent = extra.body;
  const life = el.querySelector('.t-life');
  const total = Number(extra.duration) > 0 ? Number(extra.duration) : 3500;
  let left = total;
  let hover = false;
  let dead = false;
  const actBtn = el.querySelector('.t-action');
  if (actBtn && extra.action) {
    actBtn.innerHTML = toastActionIcons[extra.action.icon] || '';
    actBtn.title = extra.action.title || '';
    actBtn.addEventListener('click', (e) => { e.stopPropagation(); dismiss(); try { extra.action.onClick && extra.action.onClick(); } catch {} });
  }
  el.querySelector('.t-close').addEventListener('click', dismiss);
  el.addEventListener('mouseenter', () => { hover = true; });
  el.addEventListener('mouseleave', () => { hover = false; });
  function dismiss() {
    if (dead) return;
    dead = true;
    clearInterval(timer);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 240);
  }
  const timer = setInterval(() => {
    if (hover || dead) return;
    left -= 50;
    life.style.width = Math.max(0, (left / total) * 100) + '%';
    if (left <= 0) dismiss();
  }, 50);
  toastStack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  return dismiss;
}

function askConfirmation(message, actionLabel = 'Продолжить') {
  const modal = document.getElementById('action-confirm');
  const messageElement = document.getElementById('action-confirm-message');
  const cancel = document.getElementById('action-confirm-cancel');
  const accept = document.getElementById('action-confirm-accept');
  if (!modal || !messageElement || !cancel || !accept) return Promise.resolve(false);
  messageElement.textContent = message;
  accept.textContent = actionLabel;
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('show'));
  return new Promise((resolve) => {
    const finish = (confirmed) => {
      modal.classList.remove('show');
      modal.hidden = true;
      cancel.removeEventListener('click', cancelAction);
      accept.removeEventListener('click', acceptAction);
      modal.removeEventListener('click', backdropAction);
      document.removeEventListener('keydown', keyAction);
      resolve(confirmed);
    };
    const cancelAction = () => finish(false);
    const acceptAction = () => finish(true);
    const backdropAction = (event) => { if (event.target === modal) finish(false); };
    const keyAction = (event) => { if (event.key === 'Escape') finish(false); };
    cancel.addEventListener('click', cancelAction);
    accept.addEventListener('click', acceptAction);
    modal.addEventListener('click', backdropAction);
    document.addEventListener('keydown', keyAction);
    cancel.focus();
  });
}

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
btnDiagnostics?.addEventListener('click', async () => {
  if (!diagnosticsOutput) return;
  diagnosticsOutput.textContent = 'Собираю данные…';
  const d = await window.native.diagnostics();
  diagnosticsOutput.textContent = [
    `AnimeOn v${d.version}`,
    `Electron ${d.electron} · Chromium ${d.chrome}`,
    `Windows ${d.platform} · ${d.arch}`,
    `Память процесса: ${d.memoryMB} MB`,
    `Окно: ${d.visible ? 'видно' : 'скрыто'} · ${d.maximized ? 'на весь экран' : 'обычный размер'}`,
    `GPU: ${d.gpu?.gpu_compositing || 'unknown'}`,
  ].join('\n');
});

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


function setVolumeUI(state) {
  if (!state) return;
  const volume = Math.max(0, Math.min(200, Number.isFinite(Number(state.volume)) ? Number(state.volume) : 100));
  if (volumeSlider) {
    volumeSlider.value = String(volume);
    volumeSlider.dataset.last = String(volume);
    volumeSlider.style.setProperty('--volume-fill', `${(volume / 200) * 100}%`);
  }
  if (volumeValue) volumeValue.textContent = `${volume}%`;
  if (btnVolume) { btnVolume.dataset.volume = `${volume}`; btnVolume.classList.toggle('muted', !!state.muted); btnVolume.title = state.muted ? 'Звук выключен' : `Громкость ${volume}%`; }
  if (volumeMute) volumeMute.textContent = state.muted ? 'Включить звук' : 'Без звука';
  btnVolume?.classList.toggle('muted', !!state.muted);
}
async function refreshVolume() {
  try { setVolumeUI(await window.native.getVolumeState()); } catch {}
}
setVolumeUI({ volume: 100, muted: false });
function setVolumePanelOpen(open) {
  const show = Boolean(open);
  volumePanel?.classList.toggle('show', show);
  btnVolume?.setAttribute('aria-expanded', String(show));
  if (show) refreshVolume();
}
btnVolume?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!volumePanel) return;
  setVolumePanelOpen(!volumePanel.classList.contains('show'));
});
volumePanel?.addEventListener('pointerdown', e => e.stopPropagation());
document.addEventListener('pointerdown', e => {
  if (!volumeWrap?.contains(e.target)) setVolumePanelOpen(false);
});
volumeSlider?.addEventListener('input', () => {
  const target = Number(volumeSlider.value);
  window.native.setVolume(target - Number(volumeSlider.dataset.last || 100));
  volumeSlider.dataset.last = String(target);
  setVolumeUI({ volume: target, muted: false });
});
volumeMinus?.addEventListener('click', () => { window.native.setVolume(-5); setTimeout(refreshVolume, 50); });
volumePlus?.addEventListener('click', () => { window.native.setVolume(5); setTimeout(refreshVolume, 50); });
volumeMute?.addEventListener('click', () => { window.native.toggleMute(); setTimeout(refreshVolume, 50); });
window.native.onAlwaysOnTop?.(v => { if (alwaysOnTopToggle) alwaysOnTopToggle.checked = !!v; toast(v ? 'Режим «Поверх всех окон» включён' : 'Режим «Поверх всех окон» выключен'); });
window.native.onToast?.(v => { if (v?.message || v?.title) toast(v.title || v.message, v.type || 'ok', { body: v.body || '' }); });
window.native.onMediaOverlay?.(v => { if (!mediaOverlay || !mediaOverlayText) return; mediaOverlayText.textContent = v.type === 'seek' ? `${v.value > 0 ? '+' : ''}${v.value} сек.` : `${v.muted ? 'Звук выключен' : `Громкость ${v.value}%`}`; mediaOverlay.classList.remove('show'); void mediaOverlay.offsetWidth; mediaOverlay.classList.add('show'); clearTimeout(window.__mediaOverlayTimer); window.__mediaOverlayTimer = setTimeout(() => mediaOverlay.classList.remove('show'), 850); });
function openSettings() {
  settingsOverlay.classList.add('show');
  btnSettings.classList.add('open');
}


let hotkeysFeature;
hotkeysFeature = initHotkeys({ native: window.native, cfg, toast, askConfirmation });

const { openScreenshots, closeScreenshots } = initScreenshots({ native: window.native, toast });

function initSettingsNavigation() {
  const discordSection = document.getElementById('discord-status-section');
  const networkSection = document.querySelector('.settings-group-card[data-settings-group="network"]');
  if (discordSection && networkSection) networkSection.after(discordSection);
  const items=()=>Array.from(document.querySelectorAll('#settings-nav-list .settings-nav-item'));
  const content=document.getElementById('st-content');
  if(!items().length) return;
  const applyFilter=()=>{
    const btn=items().find(x=>x.classList.contains('active'))||items()[0];
    const filter=btn.dataset.settingsFilter || 'all';
    const q=(document.getElementById('settings-search')?.value||'').trim().toLowerCase();
    document.querySelectorAll('.settings-group-card').forEach(section=>{
      const okF=filter==='all'||!!q||section.dataset.settingsGroup===filter;
      const okQ=!q||section.textContent.toLowerCase().includes(q);
      const visible=okF&&okQ;
      section.classList.toggle('is-hidden',!visible);
      if(visible) section.style.removeProperty('display');
      else section.style.setProperty('display','none','important');
    });
    if(content)content.scrollTop=0;
  };
  window.__applySettingsFilter = applyFilter;
  items().forEach(btn=>btn.addEventListener('click',()=>{
    items().forEach(x=>x.classList.toggle('active',x===btn));
    applyFilter();
  }));
  document.getElementById('settings-search')?.addEventListener('input',applyFilter);
  applyFilter();
}
initSettingsNavigation();
const settingsSearch=document.getElementById('settings-search');
if (resumeToggle) { resumeToggle.checked = cfg.resumeEnabled !== false; resumeToggle.addEventListener('change',()=>store('resumeEnabled',resumeToggle.checked)); }
const saveTabsToggle=document.getElementById('save-tabs-toggle');
const restoreLastToggle=document.getElementById('restore-last-toggle');
if(saveTabsToggle){ saveTabsToggle.checked=cfg.saveTabs!==false; saveTabsToggle.addEventListener('change',()=>store('saveTabs',saveTabsToggle.checked)); }
if(restoreLastToggle){ restoreLastToggle.checked=cfg.restoreLastTab!==false; restoreLastToggle.addEventListener('change',()=>store('restoreLastTab',restoreLastToggle.checked)); }
document.getElementById('btn-clear-tabs')?.addEventListener('click',async()=>{
  if(!await askConfirmation('Очистить все вкладки? Останется только стартовая.', 'Очистить вкладки')) return;
  pageTabs=[{url:SITES[store('site')||'co']?.url||SITES.co.url, title:SITES[store('site')||'co']?.label||'AnimeOn'}];
  activeTab=0;
  if(tabWebviews[0] && tabWebviews[0]!==firstWebview) try{tabWebviews[0].remove()}catch{}
  tabWebviews.length=1;
  tabWebviews[0]=firstWebview;
  showTabWebview(0);
  loadTabUrl(firstWebview, pageTabs[0].url);
  await saveTabs();
  toast('Вкладки очищены');
});
if (autoNextToggle) { autoNextToggle.checked = !!cfg.autoNext; autoNextToggle.addEventListener('change',()=>store('autoNext',autoNextToggle.checked)); }
if (dndToggle) { dndToggle.checked = !!cfg.doNotDisturb; dndToggle.addEventListener('change',()=>{store('doNotDisturb',dndToggle.checked);updateDndButton();}); }
if (notifyAdvancedToggle) { notifyAdvancedToggle.checked = !!cfg.notify; notifyAdvancedToggle.addEventListener('change',()=>store('notify',notifyAdvancedToggle.checked)); }
if (smoothScrollToggle) smoothScrollToggle.checked = cfg.smoothSite !== false;
if (siteScrollbarsToggle) siteScrollbarsToggle.checked = !!cfg.showSiteScrollbars;
if (memorySaverToggle) { memorySaverToggle.checked = !!cfg.memorySaver; memorySaverToggle.addEventListener('change',()=>window.native.setMemorySaver(memorySaverToggle.checked)); }
if (cacheAutoToggle) { cacheAutoToggle.checked = cfg.autoCacheCleanup !== false; cacheAutoToggle.addEventListener('change',()=>window.native.cacheSettings({auto:cacheAutoToggle.checked,limitMB:Number(cacheLimit?.value)||512})); }
if (cacheLimit) { cacheLimit.value = String(Number(cfg.cacheLimitMB)||512); cacheLimit.addEventListener('change',()=>{let v=Number(cacheLimit.value)||512;v=Math.max(64,Math.min(16384,v));cacheLimit.value=String(v);window.native.cacheSettings({auto:cacheAutoToggle?.checked!==false,limitMB:v});}); }
async function refreshCacheInfo(){ try { const r=await window.native.cacheInfo(); if(r?.ok && cacheInfoText){ const mb=(Number(r.apiCacheMB)||0)+(Number(r.sessionCacheMB)||0); cacheInfoText.textContent=`Сейчас: ${mb.toFixed(1)} MB`; } } catch {} }
document.getElementById('btn-cache-refresh')?.addEventListener('click',refreshCacheInfo);
document.getElementById('btn-cache-clean')?.addEventListener('click',async()=>{const r=await window.native.clearCache();toast(r?.ok?'Кэш очищен':'Не удалось очистить кэш',r?.ok?'ok':'error');refreshCacheInfo();});
document.getElementById('btn-network-check')?.addEventListener('click',()=>btnConnectionCheck?.click());
document.getElementById('btn-network-open-log')?.addEventListener('click',async()=>{const r=await window.native.openLogs();if(!r?.ok)toast('Не удалось открыть журнал','error');});
function initCSelect(id, onChange) {
  const root = document.getElementById(id);
  if (!root) return null;
  const btn = root.querySelector('.cselect-btn');
  const label = btn.querySelector('.cselect-label');
  const list = root.querySelector('.cselect-list');
  function pick(value) {
    root.dataset.value = value;
    list.querySelectorAll('button[data-value]').forEach((b) => b.classList.toggle('sel', b.dataset.value === value));
    const cur = list.querySelector('button[data-value="' + value + '"] .cselect-t b') || list.querySelector('button[data-value="' + value + '"]');
    if (cur) { label.textContent = cur.textContent; label.classList.remove('dim'); }
    if (onChange) onChange(value);
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); root.classList.toggle('open'); list.hidden = !root.classList.contains('open'); });
  list.addEventListener('click', (e) => { const b = e.target.closest('button[data-value]'); if (!b) return; pick(b.dataset.value); root.classList.remove('open'); list.hidden = true; });
  document.addEventListener('click', (e) => { if (!root.contains(e.target)) { root.classList.remove('open'); list.hidden = true; } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { root.classList.remove('open'); list.hidden = true; } });
  return { pick, root, get value() { return root.dataset.value; } };
}
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
async function loadNetStatus(){ try { const r=await window.native.netHealth(); if(r?.ok && r.results){ netMirrorList.textContent=r.results.map(x=>`${x.label}: ${x.ok?'✓':'✗'} ${x.status?`HTTP ${x.status} `:''}${x.ms}ms`).join('\n'); } } catch {} }
document.getElementById('btn-network-check')?.addEventListener('click',async()=>{btnConnectionCheck.disabled=true; if(netMirrorList) netMirrorList.textContent='Проверяю сайты…'; const r=await window.native.netHealth(); btnConnectionCheck.disabled=false; if(r?.ok && r.results){ netMirrorList.textContent=r.results.map(x=>`${x.label}: ${x.ok?'✓':'✗'} ${x.status?`HTTP ${x.status} `:''}${x.ms}ms`).join('\n'); toast(r.internet?'Сайты проверены':'Есть недоступные сайты',r.internet?'ok':'error'); } });
document.getElementById('btn-open-log')?.addEventListener('click',async()=>{const r=await window.native.openLogs();if(!r?.ok)toast('Не удалось открыть журнал','error');});
document.getElementById('btn-copy-log')?.addEventListener('click',async()=>{const r=await window.native.copyLogs();toast(r?.ok?'Журнал скопирован':'Не удалось скопировать журнал',r?.ok?'ok':'error');});
document.getElementById('btn-clear-log')?.addEventListener('click',async()=>{if(await askConfirmation('Очистить журнал ошибок?', 'Очистить журнал')){const r=await window.native.clearLogs();toast(r?.ok?'Журнал очищен':'Не удалось очистить журнал',r?.ok?'ok':'error');}});
document.getElementById('btn-screenshots-open-settings')?.addEventListener('click',openScreenshots);
document.getElementById('btn-screenshots-folder-settings')?.addEventListener('click',()=>window.native.openScreenshotsFolder());
document.getElementById('btn-about-check-update')?.addEventListener('click',async()=>{const r=await window.native.checkUpdate();if(r?.hasUpdate)toast('Вышла новая версия','ok',{body:`v${r.latest} — нажмите, чтобы скачать`,duration:8000,action:{icon:'go',title:'Открыть окно обновления',onClick:()=>window.native.updOpen()}});else if(r?.ok)toast('Обновлений нет');else toast(`Не удалось проверить: ${r?.reason||'неизвестная ошибка'}`,'error');});
document.getElementById('btn-about-source')?.addEventListener('click',()=>window.native.openExternal('https://github.com/Neukluziy/animeon-desktop'));
document.getElementById('btn-reset-positions')?.addEventListener('click',()=>{store('playbackPositions',{});toast('Позиции просмотра очищены');});
document.getElementById('btn-sleep-timer')?.addEventListener('click',async()=>{const raw=prompt('Через сколько минут остановить видео? Введите 0 для отключения.',String(cfg.sleepTimer?.minutes||0));if(raw===null)return;const m=Math.max(0,Number(raw)||0);const action=m?(prompt('Действие: pause — остановить видео, tray — убрать в трей, exit — закрыть приложение.',cfg.sleepTimer?.action||'pause')||'pause'):'pause';const r=await window.native.setSleepTimer(m,action);toast(r?.enabled?`Таймер установлен на ${m} мин.`:'Таймер сна отключён');});

function openFind(){ if(!findBar)return; findBar.hidden=false; findBar.style.display='flex'; findBar.setAttribute('aria-hidden','false'); requestAnimationFrame(()=>{findInput?.focus(); findInput?.select();}); }
function closeFind(){ if(findBar){findBar.hidden=true;findBar.style.display='none';findBar.setAttribute('aria-hidden','true');findCount.textContent='';} window.native.stopFindInPage?.(); }
async function doFind(next=false){const q=findInput?.value||'';if(!q)return;try{const r=await window.native.findInPage(q);if(r?.id) findCount.textContent='';}catch{}}
findInput?.addEventListener('input',()=>doFind(false));
findInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doFind(true)}if(e.key==='Escape')closeFind();});
findPrev?.addEventListener('click',()=>doFind(true)); findNext?.addEventListener('click',()=>doFind(true)); findClose?.addEventListener('click',closeFind);
window.native.onFindOpen?.(openFind);

closeFind();
setTimeout(closeFind, 0);
let pageTabs=[]; let activeTab=0;
const { tabTitle, toggleTabsSidebar, renderTabs } = initTabsView({
  getPageTabs: () => pageTabs,
  getActiveTab: () => activeTab,
  getActiveWebview: () => activeWebview,
  webview: wv,
  switchTab,
  closeTab,
});
async function saveTabs(){await window.native.tabsSet(pageTabs,activeTab);renderTabs();}
function updateSiteFromUrl(url){
  const value=String(url||'').toLowerCase();
  for(const [id,site] of Object.entries(SITES)){
    const host = new URL(site.url).hostname.toLowerCase();
    if(value.includes(host)){ currentSite=id; break; }
  }
  if(currentSite) updateMirrorBtn();
}
function isAnimeOnUrl(url){
  try{
    const u=new URL(String(url||''));
    return (u.protocol==='http:'||u.protocol==='https:') && /(^|\.)animeon\.(cc|co)$/i.test(u.hostname);
  }catch{return false;}
}
function samePageUrl(a,b){
  try{
    const ua=new URL(String(a||''));
    const ub=new URL(String(b||''));
    ua.hash=''; ub.hash='';
    if(ua.pathname.length>1) ua.pathname=ua.pathname.replace(/\/$/,'');
    if(ub.pathname.length>1) ub.pathname=ub.pathname.replace(/\/$/,'');
    return ua.protocol===ub.protocol && ua.hostname.toLowerCase()===ub.hostname.toLowerCase() && ua.port===ub.port && ua.pathname===ub.pathname && ua.search===ub.search;
  }catch{return String(a||'')===String(b||'');}
}
function normalizeTabUrl(url){
  try{
    const u=new URL(String(url||''));
    u.hash='';
    if(u.pathname.length>1) u.pathname=u.pathname.replace(/\/$/,'');
    return u.href;
  }catch{return String(url||'');}
}

let syncFavoriteButton = () => {};
function syncActiveTabFromWebview(){
  if(!pageTabs.length || !activeWebview) return;
  let url='';
  try { url=activeWebview.getURL() || ''; } catch {}
  if(!isAnimeOnUrl(url)) return;
  updateSiteFromUrl(url);
  let title='';
  try { title=activeWebview.getTitle() || ''; } catch {}
  pageTabs[activeTab]={url,title:title||tabTitle({url})};
}
async function switchTab(index){
  if(index<0 || index>=pageTabs.length || index===activeTab) return;
  syncActiveTabFromWebview();
  activeTab=index;
  if(!tabWebviews[index]){
    createTabWebview(index);
    const tab=pageTabs[index];
    if(tab?.url) loadTabUrl(tabWebviews[index], tab.url);
  }
  showTabWebview(index);
  const tab=pageTabs[index];
  updateSiteFromUrl(tab?.url);
  renderTabs();
  await saveTabs();
  syncFavoriteButton();
  setTimeout(()=>{try{activeWebview.focus();updateNav();applyGuestStyles();}catch{}},80);
}
async function loadTabUrl(webview, url){
  if(!webview || !url) return;
  const target=String(url);
  const load=()=>{
    if(!webview.isConnected) return false;
    try{
      const current=webview.getURL?.()||'';
      if(current && current===target) return true;
    }catch{}
    try{
      webview.setAttribute('src', target);
      return true;
    }catch{}
    try{webview.src=target;return true}catch{}
    try{webview.loadURL(target);return true}catch{}
    return false;
  };
  const attempt=()=>{if(!load())setTimeout(attempt,180)};
  if(!webview.isConnected){requestAnimationFrame(()=>setTimeout(attempt,80));return;}
  requestAnimationFrame(()=>setTimeout(attempt,80));
}
async function loadActiveTab(){
  if(!pageTabs.length) pageTabs=[{url:SITES.co.url,title:SITES.co.label}];
  if(!tabWebviews[activeTab]) createTabWebview(activeTab);
  showTabWebview(activeTab);
  const tab=pageTabs[activeTab];
  loadTabUrl(tabWebviews[activeTab], tab?.url);
  renderTabs();
}
async function syncTabs(url,title){
  if(!isAnimeOnUrl(url))return;
  if(!pageTabs.length) pageTabs=[{url,title}];
  else pageTabs[activeTab]={url,title:title||tabTitle({url})};
  await saveTabs();
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
    toast(enabled?'Уведомления приостановлены':'Уведомления снова включены');
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
async function closeTab(index){
  if(pageTabs.length<=1){
    const only=pageTabs[0]||{url:SITES.co.url,title:SITES.co.label};
    pageTabs=[only];
    activeTab=0;
    if(!tabWebviews[0]) tabWebviews[0]=firstWebview;
    showTabWebview(0);
    renderTabs();
    return;
  }
  const closingWebview=tabWebviews[index];
  pageTabs.splice(index,1);
  tabWebviews.splice(index,1);
  if(closingWebview && closingWebview!==firstWebview) {
    try{closingWebview.remove();}catch{}
  }
  if(activeTab>index) activeTab--;
  else if(activeTab===index) activeTab=Math.min(activeTab,pageTabs.length-1);
  showTabWebview(activeTab);
  await saveTabs();
  setTimeout(()=>{try{activeWebview.focus();updateNav();applyGuestStyles();}catch{}},50);
}
(async()=>{
  try{
    await remoteSitesReady;
    const selectedId=SITES[store('site')] ? store('site') : 'co';
    currentSite=selectedId;
    const selected=SITES[selectedId];
    const savedTabs=Array.isArray(cfg.tabs)?cfg.tabs:null;
    const saveOn=cfg.saveTabs!==false;
    const restoreOn=cfg.restoreLastTab!==false;
    if(saveOn && savedTabs && savedTabs.length){
      pageTabs=savedTabs.map(t=>({url:String(t.url||selected.url), title:String(t.title||t.url||selected.label)}));
      activeTab=restoreOn && Number.isInteger(cfg.activeTab) ? Math.max(0, Math.min(cfg.activeTab, pageTabs.length-1)) : 0;
      try{ updateSiteFromUrl(pageTabs[activeTab]?.url||selected.url); }catch{}
    } else {
      pageTabs=[{url:selected.url,title:selected.label}];
      activeTab=0;
    }
    if(!tabWebviews[0]) tabWebviews[0]=firstWebview;
    pageTabs.forEach((tab,i)=>{ if(!tabWebviews[i]) createTabWebview(i); });
    showTabWebview(activeTab);
    renderTabs();
    await accessKeyFeature.gate;
    if (!firstLaunchOnboarding && cfg.remember === '1') document.body.classList.add('site-content-ready');
    if (!firstLaunchOnboarding) {
      const activeUrl=pageTabs[activeTab]?.url||selected.url;
      if(tabWebviews[activeTab]) loadTabUrl(tabWebviews[activeTab], activeUrl);
      pageTabs.forEach((tab,i)=>{ if(i!==activeTab && tabWebviews[i]) loadTabUrl(tabWebviews[i], tab.url); });
    }
    await window.native.tabsSet(pageTabs,activeTab);
    updateMirrorBtn();
  }catch{
    currentSite='co';
    pageTabs=[{url:SITES.co.url,title:SITES.co.label}];
    activeTab=0;
    if(!tabWebviews[0]) tabWebviews[0]=firstWebview;
    pageTabs.forEach((tab,i)=>{ if(!tabWebviews[i]) createTabWebview(i); });
    showTabWebview(0);
    renderTabs();
    await accessKeyFeature.gate;
    if (!firstLaunchOnboarding && cfg.remember === '1') document.body.classList.add('site-content-ready');
    if (!firstLaunchOnboarding) loadTabUrl(tabWebviews[0]||firstWebview,SITES.co.url);
  }
})();

function closeSettings() {
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
offlineRetry?.addEventListener('click', () => { hideError(); wv.reload(); });

function updateNav() {
  try {
    btnBack.disabled = !wv.canGo();
    btnFwd.disabled = !wv.canGoForward();
  } catch {}
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
    try { title = activeWebview.getTitle() || document.title || ''; } catch {}
    const prevUrl = pageTabs[activeTab]?.url || '';
    if (prevUrl !== normalized || (title && pageTabs[activeTab]?.title !== title)) {
      pageTabs[activeTab] = { url:normalized, title:title || tabTitle({url:normalized}) };
      try{ updateSiteFromUrl(normalized); }catch{}
      saveTabs();
      renderTabs();
    }
  }
  window.native.setConfig({ lastUrl: cfg.lastUrl, history: cfg.history });
  window.native.recentPageAdd?.({url:normalized,title:tabTitle({url:normalized})}).catch?.(()=>{});
  syncFavoriteButton();
}


wv?.addEventListener('did-navigate', e => rememberPage(e.url));
wv?.addEventListener('did-navigate-in-page', e => rememberPage(e.url));
wv?.addEventListener('dom-ready', () => {
  document.body.classList.remove('page-soft-loading');
  document.body.classList.add('page-ready');
  setTimeout(() => document.body.classList.remove('page-ready'), 360);
});



function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

const commands = [
  ['Скорость 1×', () => { currentPlayerSpeed = 1; window.native.setPlaybackSpeed(1); renderPlayerSpeed(); }],
  ['Скорость 2×', () => { currentPlayerSpeed = 2; window.native.setPlaybackSpeed(2); renderPlayerSpeed(); }],
  ['Громче', () => { window.native.setVolume(5); setTimeout(refreshVolume, 50); }],
  ['Тише', () => { window.native.setVolume(-5); setTimeout(refreshVolume, 50); }],
  ['Выключить / включить звук', () => { window.native.toggleMute(); setTimeout(refreshVolume, 50); }],
  ['10 секунд назад', () => window.native.seek(-10)],
  ['10 секунд вперёд', () => window.native.seek(10)],
  ['Следующая серия', () => window.native.mediaAction('next')],
  ['Открыть предыдущий / следующий сайт', () => { openSite(getOtherSiteId()); }],
  ['animeon.cc', () => openSite('cc')],
  ['v1.animeon.co', () => openSite('co')],
  ['Предыдущая серия', () => window.native.mediaAction('previous')],
  ['Сделать скриншот', () => window.native.takeScreenshot()],
  ['Поверх всех окон', () => window.native.toggleAlwaysOnTop()],
  ['Открыть меню трея', () => window.native.trayAction('menu')],
  ['Перезагрузить страницу', () => wv.reload()],
  ['Назад', () => wv.canGo() && wv.goBack()],
  ['Вперёд', () => wv.canGoForward() && wv.goForward()],
  ['Полный экран', () => window.native.toggleFullscreen()],
  ['Настройки', () => openSettings()],
  ['Перезапустить WebView', () => wv.reload()],
  ['Очистить кэш', async () => { await window.native.clearCache(); wv.reload(); }],
  ['DevTools', () => window.native.toggleDevTools()],
  ['Проверить всё', () => document.getElementById('btn-check-all')?.click()],
  ['Показать нагрузку', async () => { const r = await window.native.siteMemory(); if (r?.ok) toast(`Память: приложение ${r.appMB} МБ · сайт ${r.siteMB} МБ`); else toast('Не удалось получить нагрузку', 'error'); }],
  ['Открыть в браузере', () => window.native.openExternal(wv.getURL())],
  ['Увеличить масштаб', () => window.native.zoom(0.1)],
  ['Уменьшить масштаб', () => window.native.zoom(-0.1)],
  ['Сбросить масштаб', () => window.native.zoom(0)],
  ['Каталог', () => navigatePath('/anime')],
  ['Расписание', () => navigatePath('/schedule')],
  ['Подборки', () => navigatePath('/collections')],
  ['Случайное аниме', () => navigatePath('/random')],
  ['Новости', () => navigatePath('/news')],
  ['Обновления', () => navigatePath('/roadmap')],
  ['Лидерборд', () => navigatePath('/leaderboard')],
  ['Добавить в избранное', () => toggleFavorite()],
  ['Открыть последнюю страницу', () => { if (cfg.lastUrl) window.native.navigateSite(cfg.lastUrl); }],
];

function navigatePath(path) {
  const base = SITES[currentSite || 'cc']?.url || SITES.cc.url;
  window.native.navigateSite(new URL(path, base).href);
}

function toggleFavorite() {
  const url = wv.getURL();
  if (!/^https:\/\/(?:www\.)?animeon\.(?:cc|co)\//i.test(url)) return;
  const list = Array.isArray(cfg.favorites) ? cfg.favorites : [];
  const i = list.indexOf(url);
  if (i >= 0) { list.splice(i,1); toast('Убрано из избранного'); } else { list.unshift(url); toast('Добавлено в избранное'); }
  cfg.favorites = list.slice(0,50); store('favorites', cfg.favorites);
}


function renderCommands(filter = '') {
  if (!commandList) return;
  const q = filter.trim().toLowerCase();
  commandList.innerHTML = '';
  commands.filter(([name]) => !q || name.toLowerCase().includes(q)).forEach(([name, fn], i) => {
    const b = document.createElement('button');
    b.textContent = name;
    b.dataset.index = String(i);
    b.addEventListener('click', () => { commandPalette.classList.remove('show'); fn(); });
    commandList.appendChild(b);
  });
}
window.native.onOpenCommandPalette?.(() => openCommandPalette());
window.native.onGoHome?.(() => { if (currentSite) openSite(currentSite); });
window.native.onSwitchSite?.(() => { openSite(getOtherSiteId()); });
function openCommandPalette() {
  if (!commandPalette) return;
  commandPalette.classList.add('show');
  commandInput.value = '';
  renderCommands();
  setTimeout(() => commandInput.focus(), 20);
}
commandInput?.addEventListener('input', () => renderCommands(commandInput.value));
commandPalette?.addEventListener('click', e => { if (e.target === commandPalette) commandPalette.classList.remove('show'); });

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); return; }
  if (e.key === 'Escape') { setVolumePanelOpen(false); commandPalette?.classList.remove('show'); hotkeysFeature.closeHotkeys(); closeScreenshots(); closeSettings(); watchNotesModal?.classList.remove('show'); hideError(); confirmScreen?.classList.remove('show'); return; }
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

let progVal = 5;
let progTarget = 5;
let progFrame = 0;

function setProg(p) {
  const value = Number.isFinite(Number(p)) ? Math.max(0, Math.min(100, Number(p))) : progVal;
  progVal = value;
  if (splashBarFill) splashBarFill.style.width = value + '%';
  if (splashPct) splashPct.textContent = Math.round(value) + '%';
  splash?.style.setProperty('--p', (value / 100).toFixed(3));
}

function animateProgress(target) {
  const value = Number.isFinite(Number(target)) ? Math.max(0, Math.min(100, Number(target))) : progTarget;
  progTarget = Math.max(progTarget, value);
  cancelAnimationFrame(progFrame);
  const tick = () => {
    const diff = progTarget - progVal;
    if (diff <= 0.05) { setProg(progTarget); return; }
    setProg(progVal + Math.max(.12, diff * .08));
    progFrame = requestAnimationFrame(tick);
  };
  progFrame = requestAnimationFrame(tick);
}

function startSplashProgress() {
  __splashFallback?.takeOver();
  setProg(5);
  animateProgress(12);
}

function finishSplashProgress() {
  progTarget = 100;
  animateProgress(100);
}

function revealApp(delay = 220) {
  if (booted) return;
  finishSplashProgress();
  setTimeout(() => {
    booted = true;
    document.body.classList.add('loaded');
    splash?.classList.add('hide');
    showWelcomeScreen();
    setTimeout(() => {
      splash?.remove();
    }, 720);
  }, delay);
}

if (firstLaunchOnboarding) revealApp(0);

wv.addEventListener('did-start-loading', () => {
  animateProgress(18);
  document.body.classList.remove('page-ready');
  document.body.classList.add('page-soft-loading');
  progress.classList.add('active');
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
  progress.classList.remove('active');
  updateNav();
  window.native.setTaskbarProgress?.(1);
  setTimeout(() => window.native.setTaskbarProgress?.(-1), 350);
  revealApp();
  autoMirrorAttempts = 0;
});

let autoMirrorCooldown = 0;
let autoMirrorAttempts = 0;
wv.addEventListener('did-fail-load', (e) => {
  if (e.errorCode === -3) return;
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
  showError('Не удалось открыть сайт. Попробуй ещё раз или переключись на другой.');
});

setTimeout(() => revealApp(100), 15000);

let lastScrollY = 0;
let chromeTimer = null;
function setChromeHidden(hidden) { document.body.classList.toggle('chrome-hidden', hidden); }
window.addEventListener('mousemove', (e) => {
  if (e.clientY <= 7) setChromeHidden(false);
});
setInterval(async () => {
  if (!cfg.autoHide || !booted || picker?.classList.contains('show') || settingsOverlay?.classList.contains('show')) return;
  try {
    const y = await wv.executeJavaScript('Math.max(0, window.scrollY || document.documentElement.scrollTop || 0)', false);
    if (y > lastScrollY + 8) setChromeHidden(true);
    else if (y < lastScrollY - 8) setChromeHidden(false);
    lastScrollY = y;
  } catch {}
}, 1200);

function showError(msg) {
  if (errorMessage) errorMessage.textContent = msg || 'Не получилось открыть AnimeOn.';
  errorScreen?.classList.add('show');
  document.body.classList.add('error-visible', 'offline-visible');
  offlineScreen?.classList.add('show');
  window.native.taskbarOverlay?.('error');
}
function hideError() { errorScreen?.classList.remove('show'); offlineScreen?.classList.remove('show'); document.body.classList.remove('error-visible', 'offline-visible'); window.native.taskbarOverlay?.('none'); }
btnErrorRetry?.addEventListener('click', () => { hideError(); wv.reload(); });
btnErrorMirror?.addEventListener('click', () => { hideError(); switchMirror(); });

let pendingPosterUrls = null;

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
window.native.onLoadProgress?.((p) => {

window.native.onNetStatus?.((data) => { if (data?.results) { netMirrorList.textContent = data.results.map(x => `${x.label}: ${x.ok?'✓':'✗'} ${x.status?`HTTP ${x.status} `:''}${x.ms}ms`).join('\n'); } });
window.native.onRestartWebview?.(() => { try { wv.reload(); } catch {} });
  try { window.native.setTaskbarProgress?.(p); } catch {}
});


window.native.onRestartWebview?.(() => { try { wv.reload(); } catch {} });

let checkingUpdate = false;

async function refreshUpdateStatus(auto = false) {
  if (checkingUpdate) return;
  checkingUpdate = true;
  if (!auto) updStatus.textContent = 'Проверяем…';
  btnUpdCheck.disabled = true;
  btnUpdOpenRelease?.classList.add('hidden');

  const res = await window.native.checkUpdate();

  window.__lastUpdate = res;
  if (!res || !res.ok) {
    updStatus.textContent = auto
      ? ''
      : 'Не удалось проверить обновления. Проверь подключение к интернету';
  } else if (res.hasUpdate) {
    updStatus.textContent = `Свежая версия — v${res.latest} (у тебя v${res.current})`;
    btnUpdGet.classList.remove('hidden');
    btnUpdGet.onclick = () => window.native.updOpen();
    if (btnUpdOpenRelease && res.url) { btnUpdOpenRelease.classList.remove('hidden'); }
  } else {
    updStatus.textContent = `У вас последняя версия — v${res.current}`;
    btnUpdGet.classList.add('hidden');
  }

  btnUpdCheck.disabled = false;
  checkingUpdate = false;
}

btnUpdCheck.addEventListener('click', () => refreshUpdateStatus(false));

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
  try { console.error('[AnimeOn] startup init error', e); } catch {}
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
  try { console.error('[AnimeOn] site open error', e); } catch {}
  try { revealApp(0); } catch {}
}

setTimeout(() => refreshUpdateStatus(true), 8000);

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
  } catch {}
}
setTimeout(pollAnimeNotifications,12000);
setInterval(pollAnimeNotifications,300000);
