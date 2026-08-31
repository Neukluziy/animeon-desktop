const AnimeOnModules = window.AnimeOn?.features || { modules: [] };

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
  webview.setAttribute('webpreferences', 'webSecurity=no,contextIsolation=yes,sandbox=no,allowRunningInsecureContent=yes');
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
const performanceSelect = document.getElementById('performance-select');
const autoRecoveryToggle = document.getElementById('autorecovery-toggle');
const confirmCloseToggle = document.getElementById('confirmclose-toggle');
const closeBehaviorSelect = document.getElementById('close-behavior-select');
const btnClearData = document.getElementById('btn-clear-data');
const btnConnectionCheck = document.getElementById('btn-connection-check');
const btnExportSettings = document.getElementById('btn-export-settings');
const btnImportSettings = document.getElementById('btn-import-settings');
const btnResetSettings = document.getElementById('btn-reset-settings');
const btnResetWebviewState = document.getElementById('btn-reset-webview-state');
const btnOpenDataFolder = document.getElementById('btn-open-data-folder');
const smoothSiteToggle = document.getElementById('smoothsite-toggle');
const siteCssInput = document.getElementById('site-css-input');
const btnSiteCssApply = document.getElementById('btn-site-css-apply');
const btnSiteCssReset = document.getElementById('btn-site-css-reset');
const visualRadius = document.getElementById('visual-radius');
const visualOpacity = document.getElementById('visual-opacity');
const visualBlur = document.getElementById('visual-blur');
const visualScale = document.getElementById('visual-scale');
const visualDensity = document.getElementById('visual-density');
const visualGlow = document.getElementById('visual-glow');
const visualAnimation = document.getElementById('visual-animation');
const visualApply = document.getElementById('btn-visual-apply');
const visualReset = document.getElementById('btn-visual-reset');
const styleProfileSelect = document.getElementById('style-profile-select');
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
const btnPages = document.getElementById('btn-pages');
const btnPageFavorite = document.getElementById('btn-page-favorite');
const btnPageFavorites = document.getElementById('btn-page-favorites');
const btnNewTab = document.getElementById('btn-new-tab');
const btnDnd = document.getElementById('btn-dnd');
const findBar = document.getElementById('find-bar');
const findInput = document.getElementById('find-input');
const findPrev = document.getElementById('find-prev');
const findNext = document.getElementById('find-next');
const findClose = document.getElementById('find-close');
const findCount = document.getElementById('find-count');
const pagesModal = document.getElementById('pages-modal');
const btnClosePages = document.getElementById('btn-close-pages');
const recentPagesList = document.getElementById('recent-pages-list');
const favoritesModal = document.getElementById('favorites-modal');
const btnCloseFavorites = document.getElementById('btn-close-favorites');
const favoritePagesList = document.getElementById('favorite-pages-list');
const resumeToggle = document.getElementById('resume-toggle');
const autoNextToggle = document.getElementById('autonext-toggle');
const dndToggle = document.getElementById('dnd-toggle');
const notifyAdvancedToggle = document.getElementById('notify-toggle-advanced');
const cacheAutoToggle = document.getElementById('cache-auto-toggle');
const cacheLimit = document.getElementById('cache-limit');
const cacheInfoText = document.getElementById('cache-info-text');
const memorySaverToggle = document.getElementById('memory-saver-toggle');


let booted = false;

setTimeout(() => {
  try {
    if (booted) return;
    console.error('[AnimeOn] Инициализация зависла дольше 8 сек — принудительно показываю интерфейс.');
    try { __splashFallback?.takeOver(); } catch {}
    try { revealApp(0); } catch {}
    try {
      const p = document.getElementById('site-picker');
      if (p) { p.classList.add('show'); document.body.classList.add('picker-visible'); }
    } catch {}
  } catch (e) {
    try { console.error('[AnimeOn] watchdog error', e); } catch {}
    try { document.getElementById('splash')?.remove(); } catch {}
  }
}, 8000);
let currentSite = null;

const cfg = window.native.getConfig() || {};

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
    const r = await window.native.fetchSites();
    if (r?.ok) {
      if (applySiteList(r.sites)) return;
    }
    applySiteList(r?.sites || cfg.siteList);
  } catch {
    try { applySiteList(cfg.siteList); } catch {}
  }
}
loadSitesFromRemote();
const appInfo = window.native.getAppInfo() || { version: '' };
document.getElementById('about-version-value')?.append(`v${appInfo.version || ''}`);

function store(k, v) {
  if (v === undefined) return cfg[k];
  cfg[k] = v;
  window.native.setConfig({ [k]: v });
}

function getAccentRgb() {
  return getComputedStyle(document.documentElement).getPropertyValue('--a-rgb').trim() || '139,92,246';
}

function scrollCss(rgb) {
  return [
    '::-webkit-scrollbar{width:9px;height:9px}',
    '::-webkit-scrollbar-track{background:rgba(255,255,255,.04)}',
    `::-webkit-scrollbar-thumb{background:rgba(${rgb},.55);border-radius:8px}`,
    `::-webkit-scrollbar-thumb:hover{background:rgba(${rgb},.85)}`,
    '::-webkit-scrollbar-corner{background:transparent}',
  ].join('');
}

function getVisual() {
  const v = cfg.visual && typeof cfg.visual === 'object' ? cfg.visual : {};
  return { radius:Number.isFinite(Number(v.radius)) ? Number(v.radius) : 18, opacity:Number.isFinite(Number(v.opacity)) ? Number(v.opacity) : 96, blur:Number.isFinite(Number(v.blur)) ? Number(v.blur) : 0, scale:Number.isFinite(Number(v.scale)) ? Number(v.scale) : 100, density:Number.isFinite(Number(v.density)) ? Number(v.density) : 100, accentGlow:Number.isFinite(Number(v.accentGlow)) ? Number(v.accentGlow) : 55, animations:['off','smooth','cinematic'].includes(v.animations) ? v.animations : 'smooth' };
}

function visualCss() {
  const v = getVisual();
  const scale = v.scale / 100;
  const density = v.density / 100;
  const alpha = v.opacity / 100;
  const glow = v.accentGlow / 100;
  const transition = v.animations === 'cinematic' ? '620ms cubic-bezier(.16,1,.3,1)' : v.animations === 'smooth' ? '360ms cubic-bezier(.22,1,.36,1)' : '0ms';
  return `:root{--animeon-radius:${v.radius}px;--animeon-alpha:${alpha};--animeon-blur:${v.blur}px;--animeon-density:${density};--animeon-transition:${transition};--animeon-glow:${glow};--animeon-scale:${scale}}html{scroll-behavior:${cfg.smoothSite !== false ? 'smooth' : 'auto'}!important;scroll-padding-top:16px}${hideScrollbarCss()}`;
}

function hideScrollbarCss() {
  return '*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}';
}

function syncVisualUI() {
  const v=getVisual();
  const set=(el,val,out,suffix)=>{if(!el)return;el.value=val;if(out)out.textContent=`${val}${suffix}`};
  set(visualRadius,v.radius,document.getElementById('visual-radius-value'),'px');
  set(visualOpacity,v.opacity,document.getElementById('visual-opacity-value'),'%');
  set(visualBlur,v.blur,document.getElementById('visual-blur-value'),'px');
  set(visualScale,v.scale,document.getElementById('visual-scale-value'),'%');
  set(visualDensity,v.density,document.getElementById('visual-density-value'),'%');
  set(visualGlow,v.accentGlow,document.getElementById('visual-glow-value'),'%');
  if(visualAnimation) visualAnimation.value=v.animations;
}

function readVisualUI() {
  return {radius:Number(visualRadius?.value)||18,opacity:Number(visualOpacity?.value)||92,blur:Number.isFinite(Number(visualBlur?.value)) ? Number(visualBlur?.value) : 0,scale:Number(visualScale?.value)||100,density:Number(visualDensity?.value)||100,accentGlow:Number(visualGlow?.value)||70,animations:visualAnimation?.value||'smooth'};
}

async function applyVisualStyle(save=true) {
  cfg.visual=readVisualUI();
  if(save) store('visual',cfg.visual);
  await applyGuestStyles();
}

let visualApplyTimer=null;
[visualRadius,visualOpacity,visualBlur,visualScale,visualDensity,visualGlow].forEach((el)=>el?.addEventListener('input',()=>{
  const out=document.getElementById(el.id+'-value');
  if(out) out.textContent=`${el.value}${el.id.includes('radius')||el.id.includes('blur')?'px':'%'}`;
  clearTimeout(visualApplyTimer);
  visualApplyTimer=setTimeout(()=>applyVisualStyle(true),120);
}));
visualAnimation?.addEventListener('change',()=>applyVisualStyle(true));
visualApply?.addEventListener('click',()=>applyVisualStyle(true).then(()=>toast('Визуальный стиль применён')));
visualReset?.addEventListener('click',()=>{cfg.visual={radius:18,opacity:96,blur:0,scale:100,density:100,accentGlow:55,animations:'smooth'};store('visual',cfg.visual);syncVisualUI();applyGuestStyles();toast('Визуальный стиль сброшен')});

function refreshProfiles(){
  if(!styleProfileSelect)return;
  const current=styleProfileSelect.value;
  styleProfileSelect.innerHTML='<option value="">Выберите профиль</option>';
  Object.keys(cfg.profiles||{}).sort().forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;styleProfileSelect.appendChild(o)});
  if((cfg.profiles||{})[current])styleProfileSelect.value=current;
}

btnProfileSave?.addEventListener('click',()=>{
  const name=(styleProfileName?.value||'').trim();
  if(!name){toast('Введите название профиля','error');return}
  const key=currentSite==='co'?'co':'cc';
  if(!cfg.profiles||typeof cfg.profiles!=='object')cfg.profiles={};
  cfg.profiles[name]={theme:activeTheme,visual:getVisual(),smoothSite:cfg.smoothSite!==false,css:cfg.customCss?.[key]||'',resumeEnabled:cfg.resumeEnabled!==false,autoNext:!!cfg.autoNext,notify:!!cfg.notify,doNotDisturb:!!cfg.doNotDisturb,performance:cfg.performance||'balanced',lowPower:!!cfg.lowPower,memorySaver:!!cfg.memorySaver,autoCacheCleanup:cfg.autoCacheCleanup!==false,cacheLimitMB:Number(cfg.cacheLimitMB)||512,playbackSpeed:Number(cfg.playbackSpeed)||1,hotkeys:{...(cfg.hotkeys||{})}};
  store('profiles',cfg.profiles);
  refreshProfiles();
  styleProfileSelect.value=name;
  toast('Профиль сохранён');
});
btnProfileLoad?.addEventListener('click',()=>{
  const name=styleProfileSelect?.value; const profile=cfg.profiles?.[name];
  if(!profile){toast('Выберите профиль','error');return}
  applyTheme(profile.theme||'violet',{skipSave:false});
  cfg.visual=profile.visual||getVisual();cfg.smoothSite=profile.smoothSite!==false;cfg.resumeEnabled=profile.resumeEnabled!==false;cfg.autoNext=!!profile.autoNext;cfg.notify=!!profile.notify;cfg.doNotDisturb=!!profile.doNotDisturb;cfg.performance=profile.performance||'balanced';cfg.lowPower=!!profile.lowPower;cfg.memorySaver=!!profile.memorySaver;cfg.autoCacheCleanup=profile.autoCacheCleanup!==false;cfg.cacheLimitMB=Number(profile.cacheLimitMB)||512;cfg.playbackSpeed=Number(profile.playbackSpeed)||1;cfg.hotkeys={...(profile.hotkeys||cfg.hotkeys||{})};
  const key=currentSite==='co'?'co':'cc';
  if(!cfg.customCss)cfg.customCss={cc:'',co:''};cfg.customCss[key]=profile.css||'';
  store('visual',cfg.visual);store('smoothSite',cfg.smoothSite);store('customCss',cfg.customCss);
  syncVisualUI();loadSiteEditor();applyGuestStyles(); if(resumeToggle)resumeToggle.checked=cfg.resumeEnabled!==false;if(autoNextToggle)autoNextToggle.checked=!!cfg.autoNext;if(dndToggle)dndToggle.checked=!!cfg.doNotDisturb;if(notifyAdvancedToggle)notifyAdvancedToggle.checked=!!cfg.notify;if(memorySaverToggle)memorySaverToggle.checked=!!cfg.memorySaver;if(cacheAutoToggle)cacheAutoToggle.checked=cfg.autoCacheCleanup!==false;if(cacheLimit)cacheLimit.value=String(cfg.cacheLimitMB||512);toast('Профиль загружен');
});
btnProfileDelete?.addEventListener('click',()=>{
  const name=styleProfileSelect?.value;if(!name||!cfg.profiles?.[name]){toast('Выберите профиль','error');return}
  delete cfg.profiles[name];store('profiles',cfg.profiles);refreshProfiles();toast('Профиль удалён');
});

async function applyGuestStyles() {
  if (!currentSite || !wv) return;
  const key = currentSite || 'cc';
  const custom = cfg.customCss && typeof cfg.customCss === 'object' ? String(cfg.customCss[key] || '') : '';
  const smooth = cfg.smoothSite !== false;
  const css = `${visualCss()}\n${custom}\n${smooth ? 'html{scroll-behavior:smooth!important;}' : ''}`;
  try { await window.native.applySiteCss(css); } catch {}
}

function resetThemeVars() {
  ['--a-rgb', '--al-rgb', '--am-rgb', '--ad-rgb'].forEach((p) =>
    document.documentElement.style.removeProperty(p));
}

const themeSwatches = [...document.querySelectorAll('.theme-swatch')];
const themeName = document.getElementById('theme-name');
const customColorInput = document.getElementById('custom-color-input');
const customColorOpen = document.getElementById('custom-color-open');
const customPicker = document.getElementById('custom-picker');
const customPickerClose = document.getElementById('custom-picker-close');
const customPickerDone = document.getElementById('custom-picker-done');
const customHexInput = document.getElementById('custom-hex-input');
const customPickerCopy = document.getElementById('custom-picker-copy');
const customPickerEyedropper = document.getElementById('custom-picker-eyedropper');
const pickerSv = document.getElementById('picker-sv');
const pickerCursor = document.getElementById('picker-cursor');
const pickerHue = document.getElementById('picker-hue');
const pickerHueCursor = document.getElementById('picker-hue-cursor');
const pickerPreviewName = document.getElementById('custom-picker-preview-name');
const customColorValue = document.getElementById('custom-color-value');
const customColorCopy = document.getElementById('custom-color-copy');
const THEME_NAMES = {violet:'Фиолетовый',blue:'Синий',cyan:'Бирюзовый',sky:'Небесный',indigo:'Индиго',emerald:'Изумрудный',green:'Зелёный',lime:'Лаймовый',yellow:'Жёлтый',amber:'Янтарный',orange:'Оранжевый',red:'Красный',rose:'Розовый',pink:'Розовый',fuchsia:'Фуксия',slate:'Серо-синий',gray:'Серый',teal:'Тёмная бирюза',mint:'Мята',gold:'Золото',coral:'Коралл',lavender:'Лаванда',crimson:'Алый',electric:'Электрик',light:'Светлая'};

const PRESET_THEMES = new Set(['violet','blue','cyan','sky','indigo','emerald','green','lime','yellow','amber','orange','red','rose','pink','fuchsia','slate','gray','teal','mint','gold','coral','lavender','crimson','electric','light']);
let activeTheme = PRESET_THEMES.has(cfg.theme) || cfg.theme === 'custom' ? cfg.theme : 'violet';
if (!cfg.custom) cfg.custom = '#8b5cf6';

function hexRgb(hex) {
  const clean = String(hex || '').replace('#','');
  const full = clean.length === 3 ? clean.split('').map(x => x + x).join('') : clean.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16) || 0x8b5cf6;
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

function mixRgb(rgb, target, amount) {
  return rgb.map((v, i) => Math.round(v + (target[i] - v) * amount));
}

function applyCustomColor(hex) {
  const rgb = hexRgb(hex);
  const light = mixRgb(rgb, [255,255,255], .42);
  const mid = mixRgb(rgb, [0,0,0], .18);
  const dark = mixRgb(rgb, [0,0,0], .38);
  const root = document.documentElement;
  root.style.setProperty('--a-rgb', rgb.join(','));
  root.style.setProperty('--al-rgb', light.join(','));
  root.style.setProperty('--am-rgb', mid.join(','));
  root.style.setProperty('--ad-rgb', dark.join(','));
}

function isNight() {
  const h = new Date().getHours();
  return h >= 22 || h < 6;
}

function applyTheme(t, opts = {}) {
  document.documentElement.classList.add('theme-transitioning');
  clearTimeout(window.__themeTransitionTimer);
  window.__themeTransitionTimer = setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 520);

  if (t !== undefined) activeTheme = t;

  resetThemeVars();
  document.documentElement.dataset.theme = activeTheme;
  if (activeTheme === 'custom') applyCustomColor(cfg.custom);
  themeSwatches.forEach((b) => b.classList.toggle('active', b.dataset.theme === activeTheme));
  if (themeName) themeName.textContent = activeTheme === 'custom' ? 'Свой цвет' : (THEME_NAMES[activeTheme] || activeTheme);
  if (customColorInput) customColorInput.value = cfg.custom || '#8b5cf6';
  if (customColorValue) customColorValue.textContent = String(cfg.custom || '#8b5cf6').toUpperCase();
  customColorOpen?.style.setProperty('--picker-color', cfg.custom || '#8b5cf6');
  if (pickerOpen) updatePickerVisual(cfg.custom || '#8B5CF6');

  if (!opts.skipSave) store('theme', activeTheme);
  applyGuestStyles();
}


let pickerHueValue = 260;
let pickerSatValue = 0.65;
let pickerValValue = 0.96;
let pickerOpen = false;

function clamp(n,min,max){return Math.min(max,Math.max(min,n))}
function hsvToHex(h,s,v){
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
  return '#'+[r,g,b].map(q=>Math.round((q+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function hexToHsv(hex){
  const [r,g,b]=hexRgb(hex).map(v=>v/255);
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0;
  if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);if(h<0)h+=360}
  return [h,max?d/max:0,max];
}
function validHex(v){return /^#?(?:[0-9a-f]{6}|[0-9a-f]{3})$/i.test(String(v).trim())}
function normalizeHex(v){
  let x=String(v).trim().replace(/^#/,'');
  if(x.length===3)x=x.split('').map(c=>c+c).join('');
  return '#'+x.toUpperCase();
}
function updatePickerVisual(hex){
  const [h,s,v]=hexToHsv(hex);
  pickerHueValue=h;pickerSatValue=s;pickerValValue=v;
  if(pickerSv)pickerSv.style.background=`linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,rgba(255,255,255,0)),hsl(${h} 100% 50%)`;
  if(pickerCursor){pickerCursor.style.left=`${s*100}%`;pickerCursor.style.top=`${(1-v)*100}%`}
  if(pickerHueCursor)pickerHueCursor.style.left=`${h/360*100}%`;
  if(customHexInput)customHexInput.value=normalizeHex(hex);
  if(pickerPreviewName)pickerPreviewName.textContent=normalizeHex(hex);
}
function setCustomHex(hex,save=true){
  if(!validHex(hex))return false;
  const value=normalizeHex(hex);
  cfg.custom=value;
  activeTheme='custom';
  if(save){store('custom',value);store('theme','custom')}
  applyTheme('custom',{skipSave:true});
  updatePickerVisual(value);
  return true;
}
function openCustomPicker(){
  if(!customPicker)return;
  pickerOpen=true;customPicker.hidden=false;
  updatePickerVisual(cfg.custom||'#8B5CF6');
  customHexInput?.focus();customHexInput?.select();
}
function closeCustomPicker(){pickerOpen=false;if(customPicker)customPicker.hidden=true}
function pickFromSv(e){
  const r=pickerSv.getBoundingClientRect();
  pickerSatValue=clamp((e.clientX-r.left)/r.width,0,1);
  pickerValValue=clamp(1-(e.clientY-r.top)/r.height,0,1);
  setCustomHex(hsvToHex(pickerHueValue,pickerSatValue,pickerValValue));
}
function pickFromHue(e){
  const r=pickerHue.getBoundingClientRect();
  pickerHueValue=clamp((e.clientX-r.left)/r.width,0,1)*360;
  setCustomHex(hsvToHex(pickerHueValue,pickerSatValue,pickerValValue));
}
function dragPicker(el,fn){
  if(!el)return;
  let down=false;
  const apply=e=>{fn(e);e.preventDefault()};
  const move=e=>{if(down)apply(e)};
  el.addEventListener('pointerdown',e=>{down=true;try{el.setPointerCapture(e.pointerId)}catch{}apply(e)});
  el.addEventListener('pointermove',move);
  el.addEventListener('pointerup',()=>{down=false});
  el.addEventListener('pointercancel',()=>{down=false});
  el.addEventListener('lostpointercapture',()=>{down=false});
  el.addEventListener('click',e=>apply(e));
  el.addEventListener('mousedown',e=>apply(e));
}
customColorOpen?.addEventListener('click',()=>pickerOpen?closeCustomPicker():openCustomPicker());
customPickerClose?.addEventListener('click',closeCustomPicker);
customPickerDone?.addEventListener('click',()=>{if(validHex(customHexInput?.value||'')){setCustomHex(customHexInput.value);closeCustomPicker()}else{toast('Введи HEX вроде #8B5CF6','error')}});
customHexInput?.addEventListener('input',()=>{
  const raw=customHexInput.value.trim();
  if(validHex(raw))setCustomHex(raw);
});
customHexInput?.addEventListener('paste',()=>setTimeout(()=>{if(validHex(customHexInput.value))setCustomHex(customHexInput.value)},0));
customHexInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(validHex(customHexInput.value)){setCustomHex(customHexInput.value);closeCustomPicker()}else toast('Введи HEX вроде #8B5CF6','error')}});
dragPicker(pickerSv,pickFromSv);
dragPicker(pickerHue,pickFromHue);
customPickerCopy?.addEventListener('click',async()=>{
  const value=normalizeHex(cfg.custom||'#8B5CF6');
  try{await navigator.clipboard.writeText(value);toast('HEX скопирован')}catch{
    const ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('HEX скопирован');
  }
});
customColorCopy?.addEventListener('click',async()=>{
  const value=normalizeHex(cfg.custom||'#8B5CF6');
  try{await navigator.clipboard.writeText(value);customColorCopy.querySelector('span:last-child').textContent='Скопировано';setTimeout(()=>{const el=customColorCopy.querySelector('span:last-child');if(el)el.textContent='Копировать'},1100);toast('HEX скопирован')}catch{toast('Не удалось скопировать','error')}
});
customPickerEyedropper?.addEventListener('click',async()=>{
  if(!window.EyeDropper){toast('Пипетка недоступна в этой версии Chromium','error');return}
  try{const result=await new EyeDropper().open();setCustomHex(result.sRGBHex);toast('Цвет выбран')}catch{}
});

setInterval(() => {
  const n = isNight();
  if (n !== document.documentElement.hasAttribute('data-night')) {
    if (n) document.documentElement.dataset.night = '1';
    else delete document.documentElement.dataset.night;
    applyTheme(undefined, { skipSave: true });
  }
}, 60000);

themeSwatches.forEach((sw) => {
  sw.addEventListener('click', () => applyTheme(sw.dataset.theme));
});

function activateSite(id, { save = true } = {}) {
  currentSite = id;
  if (save && rememberPick?.checked) store('site', id);
  document.querySelectorAll('[data-site]').forEach((el) => {
    const on = el.dataset.site === id;
    el.classList.toggle('selected', on);
    el.classList.toggle('active', on);
  });
  updateMirrorBtn();
  loadSiteEditor();
}

function openSite(id) {
  const s = SITES[id];
  if (!s) return;
  activateSite(id, { save: false });
  if (!pageTabs.length) pageTabs = [{ url: s.url, title: s.label }];
  else pageTabs[activeTab] = { url: s.url, title: s.label };
  if (!tabWebviews[activeTab]) createTabWebview(activeTab);
  showTabWebview(activeTab);
  loadTabUrl(tabWebviews[activeTab], s.url);
  saveTabs();
}

function loadSiteEditor() {
  if (!siteCssInput || !smoothSiteToggle) return;
  syncVisualUI();
  refreshProfiles();
  const key = currentSite || 'cc';
  const css = cfg.customCss && typeof cfg.customCss === 'object' ? String(cfg.customCss[key] || '') : '';
  siteCssInput.value = css;
  smoothSiteToggle.checked = cfg.smoothSite !== false;
}

smoothSiteToggle?.addEventListener('change', async () => {
  cfg.smoothSite = smoothSiteToggle.checked;
  store('smoothSite', smoothSiteToggle.checked);
  await applyGuestStyles();
});

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

btnContinue.addEventListener('click', () => {
  if (!currentSite) return;

  store('remember', rememberPick.checked ? '1' : '0');
  if (rememberPick.checked) store('site', currentSite);
  else store('site', null);

  picker.classList.add('hide');
  setTimeout(() => {
    document.body.classList.remove('picker-visible');
    picker.classList.remove('show');
    if (pendingPosterUrls) {
      const urls = pendingPosterUrls;
      pendingPosterUrls = null;
      requestAnimationFrame(() => setPosterWall(urls));
    }
    openSite(currentSite);
  }, 140);
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
  if (enabled) {
    store('closeBehavior', 'tray');
    store('confirmClose', false);
    if (closeBehaviorSelect) closeBehaviorSelect.value = 'tray';
    if (confirmCloseToggle) confirmCloseToggle.checked = false;
  }
});
autohideToggle.addEventListener('change', () => { store('autoHide', autohideToggle.checked); setChromeHidden(false); });
compactToggle.addEventListener('change', () => { store('compact', compactToggle.checked); document.body.classList.toggle('compact-mode', compactToggle.checked); });
alwaysOnTopToggle?.addEventListener('change', () => window.native.toggleAlwaysOnTop());
lowPowerToggle.addEventListener('change', () => { store('lowPower', lowPowerToggle.checked); document.body.classList.toggle('low-power', lowPowerToggle.checked || performanceSelect?.value === 'economy'); });
performanceSelect?.addEventListener('change', () => { store('performance', performanceSelect.value); window.native.setPerformance(performanceSelect.value); applyPerformance(performanceSelect.value); });
autoRecoveryToggle?.addEventListener('change', () => store('autoRecovery', autoRecoveryToggle.checked));
confirmCloseToggle?.addEventListener('change', () => { const v=confirmCloseToggle.checked; store('confirmClose', v); store('closeBehavior', v ? 'ask' : (store('closeBehavior') === 'ask' ? 'exit' : store('closeBehavior'))); if (closeBehaviorSelect) closeBehaviorSelect.value = store('closeBehavior') || (v ? 'ask' : 'exit'); });
closeBehaviorSelect?.addEventListener('change', () => { store('closeBehavior', closeBehaviorSelect.value); store('confirmClose', closeBehaviorSelect.value === 'ask'); if (confirmCloseToggle) confirmCloseToggle.checked = closeBehaviorSelect.value === 'ask'; });

function applyPerformance(mode) {
  document.body.dataset.performance = mode;
  document.body.classList.toggle('performance-mode', mode === 'performance');
  document.body.classList.toggle('economy-mode', mode === 'economy');
}

btnRestartWebview?.addEventListener('click', () => { hideError(); wv.reload(); });
function toast(message, type='ok') {
  if (!toastStack) return;
  const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
  toastStack.appendChild(el); requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 220); }, 2600);
}
btnClearCache?.addEventListener('click', async () => {
  btnClearCache.disabled = true;
  const res = await window.native.clearCache();
  btnClearCache.disabled = false;
  if (res?.ok) { toast('Кэш очищен'); setTimeout(() => wv.reload(), 250); }
  else toast(`Ошибка: ${res?.error || 'неизвестная ошибка'}`, 'error');
});
btnClearData?.addEventListener('click', async () => {
  if (!confirm('Очистить данные сайта AnimeOn? Это может завершить текущую авторизацию.')) return;
  btnClearData.disabled = true; const res = await window.native.clearSiteData(); btnClearData.disabled = false;
  if (res?.ok) { toast('Данные сайта очищены'); setTimeout(() => wv.reload(), 250); }
  else toast(`Ошибка: ${res?.error || 'неизвестная ошибка'}`, 'error');
});
btnConnectionCheck?.addEventListener('click', async () => {
  btnConnectionCheck.disabled = true; if (diagnosticsOutput) diagnosticsOutput.textContent = 'Проверяю интернет и зеркала…';
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
btnImportSettings?.addEventListener('click', async () => { const r = await window.native.importSettings(); if (!r?.ok) { if (!r?.canceled) toast(r?.error || 'Не удалось импортировать настройки', 'error'); return; } Object.assign(cfg, r.settings || {}); applyTheme(cfg.theme || 'violet', {skipSave:true}); rememberPick.checked=rememberSettings.checked=cfg.remember==='1'; autostartToggle.checked=!!cfg.autostart; trayToggle.checked=!!cfg.tray; compactToggle.checked=!!cfg.compact; lowPowerToggle.checked=cfg.lowPower!==false; autohideToggle.checked=cfg.autoHide!==false; if(performanceSelect) performanceSelect.value=cfg.performance||'balanced'; if(autoRecoveryToggle) autoRecoveryToggle.checked=cfg.autoRecovery!==false; if(closeBehaviorSelect) closeBehaviorSelect.value=cfg.closeBehavior|| (cfg.confirmClose?'ask':'exit'); if(confirmCloseToggle) confirmCloseToggle.checked=(closeBehaviorSelect?.value==='ask'); document.body.classList.toggle('compact-mode',!!cfg.compact); document.body.classList.toggle('low-power',cfg.lowPower!==false); applyPerformance(cfg.performance||'balanced'); toast('Настройки импортированы'); });
btnResetWebviewState?.addEventListener('click', () => { window.native.restartWebview(); toast('Состояние страницы сброшено'); });
btnOpenDataFolder?.addEventListener('click', () => { window.native.openDataFolder?.(); });
btnUpdOpenRelease?.addEventListener('click', () => { if (window.__lastUpdate?.url) window.native.openExternal(window.__lastUpdate.url); });

btnResetSettings?.addEventListener('click', async () => { if (!confirm('Сбросить все настройки AnimeOn?')) return; const r=await window.native.resetSettings(); if(!r?.ok){toast(r?.error||'Не удалось сбросить настройки','error');return;} Object.assign(cfg,r.settings||{}); applyTheme('violet',{skipSave:true}); location.reload(); });
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

document.querySelectorAll('#titlebar button').forEach((b) => {
  b.addEventListener('mousemove', (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', `${e.clientX - r.left}px`);
    b.style.setProperty('--my', `${e.clientY - r.top}px`);
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
btnVolume?.addEventListener('pointerdown', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!volumePanel) return;
  const show = !volumePanel.classList.contains('show');
  volumePanel.classList.toggle('show', show);
  if (show) await refreshVolume();
});
volumePanel?.addEventListener('pointerdown', e => e.stopPropagation());
document.addEventListener('pointerdown', e => {
  if (!volumeWrap?.contains(e.target)) volumePanel?.classList.remove('show');
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
window.native.onAlwaysOnTop?.(v => { if (alwaysOnTopToggle) alwaysOnTopToggle.checked = !!v; toast(v ? 'Поверх всех окон включено' : 'Поверх всех окон выключено'); });
window.native.onToast?.(v => { if (v?.message) toast(v.message); });
window.native.onMediaOverlay?.(v => { if (!mediaOverlay || !mediaOverlayText) return; mediaOverlayText.textContent = v.type === 'seek' ? `${v.value > 0 ? '+' : ''}${v.value} сек.` : `${v.muted ? 'Звук выключен' : `Громкость ${v.value}%`}`; mediaOverlay.classList.remove('show'); void mediaOverlay.offsetWidth; mediaOverlay.classList.add('show'); clearTimeout(window.__mediaOverlayTimer); window.__mediaOverlayTimer = setTimeout(() => mediaOverlay.classList.remove('show'), 850); });
function openSettings() {
  settingsOverlay.classList.add('show');
  btnSettings.classList.add('open');
}


const HOTKEYS = [
  ['show', 'Показать приложение', 'Окно', 'Открывает окно, даже если оно скрыто.'],
  ['toggleWindow', 'Скрыть / показать окно', 'Окно', 'Быстро прячет окно или возвращает его обратно.'],
  ['trayMenu', 'Открыть меню трея', 'Окно', 'Открывает маленькое меню рядом с треем.'],
  ['alwaysOnTop', 'Поверх всех окон', 'Окно', 'Оставляет AnimeOn поверх других окон.'],
  ['fullscreen', 'Полный экран', 'Окно', 'Включает или выключает полноэкранный режим.'],
  ['playPause', 'Пауза / продолжить', 'Плеер', 'Ставит видео на паузу или продолжает просмотр.'],
  ['volumeUp', 'Громче', 'Плеер', 'Добавляет немного громкости.'],
  ['volumeDown', 'Тише', 'Плеер', 'Убавляет звук.'],
  ['mute', 'Выключить / Включить', 'Плеер', 'Выключает звук и возвращает его одним нажатием.'],
  ['seekBack', 'Назад на 10 секунд', 'Плеер', 'Отматывает видео на десять секунд.'],
  ['seekForward', 'Вперёд на 10 секунд', 'Плеер', 'Перематывает видео на десять секунд вперёд.'],
  ['next', 'Следующая серия', 'Плеер', 'Переходит к следующей серии, если она есть.'],
  ['previous', 'Предыдущая серия', 'Плеер', 'Возвращает к предыдущей серии.'],
  ['settings', 'Открыть настройки', 'Программа', 'Открывает настройки приложения.'],
  ['command', 'Быстрые команды', 'Программа', 'Открывает поиск по основным действиям.'],
  ['reload', 'Перезагрузить страницу', 'Программа', 'Заново загружает текущую страницу.'],
  ['screenshot', 'Сделать скриншот', 'Программа', 'Сохраняет снимок окна в PNG.'],
  ['openBrowser', 'Открыть в браузере', 'Программа', 'Открывает текущую страницу обычным браузером.'],
  ['home', 'На главную', 'Навигация', 'Возвращает на главную выбранного адреса.'],
  ['back', 'Назад', 'Навигация', 'Переходит на предыдущую страницу.'],
  ['forward', 'Вперёд', 'Навигация', 'Возвращает следующую страницу из истории.'],
  ['zoomIn', 'Увеличить масштаб', 'Навигация', 'Делает страницу крупнее.'],
  ['zoomOut', 'Уменьшить масштаб', 'Навигация', 'Делает страницу меньше.'],
  ['zoomReset', 'Сбросить масштаб', 'Навигация', 'Возвращает обычный масштаб.'],
  ['switchSite', 'Сменить адрес AnimeOn', 'Навигация', 'Переключает между доступными адресами AnimeOn.'],
];
const DEFAULT_HOTKEYS = {
  show: 'Control+Alt+A', toggleWindow: 'Control+Alt+T', trayMenu: 'Control+Alt+Y', playPause: 'Control+Alt+P',
  volumeUp: 'Control+Alt+Up', volumeDown: 'Control+Alt+Down', mute: 'Control+Alt+M', seekBack: 'Control+Alt+Left',
  seekForward: 'Control+Alt+Right', next: 'Control+Alt+PageDown', previous: 'Control+Alt+PageUp',
  fullscreen: 'Control+Alt+F', alwaysOnTop: 'Control+Alt+O', settings: 'Control+Alt+S', reload: 'Control+Alt+R',
  screenshot: 'Control+Alt+Shift+S', command: 'Control+Alt+K', home: 'Control+Alt+H', back: 'Control+Alt+J', forward: 'Control+Alt+L', zoomIn: 'Control+Alt+=', zoomOut: 'Control+Alt+-', zoomReset: 'Control+Alt+0', switchSite: 'Control+Alt+W', openBrowser: 'Control+Alt+B'
};
const HOTKEY_LABELS = { Control: 'Ctrl', Command: 'Win', Alt: 'Alt', Shift: 'Shift', Up: '↑', Down: '↓', Left: '←', Right: '→', PageUp: 'PgUp', PageDown: 'PgDn', Space: 'Space' };
let hotkeyDraft = { ...DEFAULT_HOTKEYS, ...(cfg.hotkeys || {}) };
let recordingHotkey = null;
let recordingCaptured = [];

function formatHotkey(value) {
  if (!value) return 'Не назначено';
  return String(value).split('+').map(x => HOTKEY_LABELS[x] || x).join(' + ');
}

function renderHotkeys() {
  if (!hotkeysList) return;
  hotkeysList.innerHTML = '';
  let group = '';
  for (const [key, name, section, description] of HOTKEYS) {
    if (section !== group) {
      group = section;
      const title = document.createElement('div');
      title.className = 'hotkeys-group-title';
      title.textContent = section;
      hotkeysList.appendChild(title);
    }
    const row = document.createElement('div');
    row.className = 'hotkey-row editable' + (recordingHotkey === key ? ' recording' : '');
    const textWrap = document.createElement('div');
    textWrap.className = 'hotkey-text';
    const text = document.createElement('b');
    text.textContent = name;
    const desc = document.createElement('i');
    desc.textContent = recordingHotkey === key ? 'Нажми нужную комбинацию. Esc — отмена, Backspace — убрать.' : description;
    textWrap.append(text, desc);
    const value = document.createElement('kbd');
    value.textContent = recordingHotkey === key
      ? (recordingCaptured.length ? formatHotkey(recordingCaptured.join('+')) : 'Нажми клавиши…')
      : formatHotkey(hotkeyDraft[key]);
    const edit = document.createElement('button');
    edit.className = 'hotkey-edit';
    edit.textContent = recordingHotkey === key ? 'Отмена' : 'Изменить';
    edit.addEventListener('click', () => {
      if (recordingHotkey === key) stopHotkeyRecording();
      else {
        recordingHotkey = key;
        recordingCaptured = [];
        renderHotkeys();
      }
    });
    row.append(textWrap, value, edit);
    hotkeysList.appendChild(row);
  }
}

function stopHotkeyRecording() {
  recordingHotkey = null;
  recordingCaptured = [];
  renderHotkeys();
}

function hotkeyTokenFromEvent(e) {
  const map = {
    ' ': 'Space',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End'
  };
  if (['Control','Alt','Shift','Meta'].includes(e.key)) return null;
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(e.key)) return e.key.toUpperCase();
  return map[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
}

function getRecordedModifiers(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Command');
  return parts;
}

function normalizeRecordedCombo(e) {
  const token = hotkeyTokenFromEvent(e);
  if (!token) return '';
  return [...getRecordedModifiers(e), token].join('+');
}

function hasHotkeyConflict(combo, currentKey) {
  const target = String(combo).toLowerCase();
  return HOTKEYS.some(([key]) => key !== currentKey && String(hotkeyDraft[key] || '').toLowerCase() === target);
}

async function saveRecordedHotkey(combo) {
  const key = recordingHotkey;
  if (!key || !combo) return;
  if (hasHotkeyConflict(combo, key)) {
    toast('Эта комбинация уже назначена другой команде', 'error');
    return;
  }
  const previous = hotkeyDraft[key];
  hotkeyDraft[key] = combo;
  const result = await window.native.setHotkeys(hotkeyDraft);
  if (result?.failed?.some(item => item.key === key)) {
    hotkeyDraft[key] = previous;
    await window.native.setHotkeys(hotkeyDraft);
    toast(`Не удалось назначить ${formatHotkey(combo)}`, 'error');
    renderHotkeys();
    return;
  }
  cfg.hotkeys = { ...hotkeyDraft };
  recordingHotkey = null;
  recordingCaptured = [];
  renderHotkeys();
  toast(`Хоткей изменён: ${formatHotkey(combo)}`);
}

window.addEventListener('keydown', async e => {
  if (!recordingHotkey) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') {
    stopHotkeyRecording();
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const key = recordingHotkey;
    const previous = hotkeyDraft[key];
    delete hotkeyDraft[key];
    const result = await window.native.setHotkeys(hotkeyDraft);
    if (result?.failed?.length) {
      hotkeyDraft[key] = previous;
      await window.native.setHotkeys(hotkeyDraft);
      toast('Не удалось отключить хоткей', 'error');
      renderHotkeys();
      return;
    }
    cfg.hotkeys = { ...hotkeyDraft };
    recordingHotkey = null;
    recordingCaptured = [];
    renderHotkeys();
    toast('Хоткей отключён');
    return;
  }
  const combo = normalizeRecordedCombo(e);
  if (!combo) return;
  recordingCaptured = combo.split('+');
  renderHotkeys();
  await saveRecordedHotkey(combo);
}, true);

function openHotkeys() {
  stopHotkeyRecording();
  renderHotkeys();
  hotkeysModal?.classList.add('show');
}
function closeHotkeys() {
  stopHotkeyRecording();
  hotkeysModal?.classList.remove('show');
}

btnHotkeys?.addEventListener('click', openHotkeys);
btnHotkeysMain?.addEventListener('click', openHotkeys);
btnCloseHotkeys?.addEventListener('click', closeHotkeys);
btnHotkeysReset?.addEventListener('click', async () => {
  if (!confirm('Сбросить все горячие клавиши к значениям по умолчанию?')) return;
  const previous = { ...hotkeyDraft };
  hotkeyDraft = { ...DEFAULT_HOTKEYS };
  const result = await window.native.setHotkeys(hotkeyDraft);
  if (result?.failed?.length) {
    hotkeyDraft = previous;
    await window.native.setHotkeys(previous);
    toast('Не удалось сбросить горячие клавиши', 'error');
    renderHotkeys();
    return;
  }
  cfg.hotkeys = { ...hotkeyDraft };
  stopHotkeyRecording();
  renderHotkeys();
  toast('Горячие клавиши сброшены');
});
hotkeysModal?.addEventListener('click', (e) => {
  if (e.target === hotkeysModal) closeHotkeys();
});

let screenshotsLoadToken = 0;

function formatScreenshotDate(mtimeMs) {
  try {
    return new Date(mtimeMs).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
function formatScreenshotSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '';
  const kb = n / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} КБ` : `${(kb / 1024).toFixed(1)} МБ`;
}

async function renderScreenshots() {
  if (!screenshotsList) return;
  const token = ++screenshotsLoadToken;
  screenshotsList.innerHTML = '';
  if (screenshotsCount) screenshotsCount.textContent = 'Загрузка…';
  const res = await window.native.listScreenshots?.();
  if (token !== screenshotsLoadToken) return;
  if (!res || !res.ok) {
    if (screenshotsCount) screenshotsCount.textContent = 'Не удалось получить список скриншотов';
    return;
  }
  const items = res.items || [];
  if (screenshotsCount) {
    screenshotsCount.textContent = items.length ? `Скриншотов: ${items.length}` : 'Пока нет ни одного скриншота';
  }
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'screenshots-empty';
    empty.textContent = 'Здесь появятся ваши скриншоты';
    screenshotsList.appendChild(empty);
    return;
  }
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'screenshot-card';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'screenshot-thumb';
    const spinner = document.createElement('div');
    spinner.className = 'screenshot-thumb-loading';
    thumbWrap.appendChild(spinner);
    card.appendChild(thumbWrap);

    const meta = document.createElement('div');
    meta.className = 'screenshot-meta';
    const nameEl = document.createElement('b');
    nameEl.textContent = item.name;
    nameEl.title = item.name;
    const infoEl = document.createElement('i');
    infoEl.textContent = `${formatScreenshotDate(item.mtimeMs)} · ${formatScreenshotSize(item.size)}`;
    meta.appendChild(nameEl);
    meta.appendChild(infoEl);
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'screenshot-actions';
    const mkBtn = (label, cls, handler) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls ? `ghost-btn ${cls}` : 'ghost-btn';
      b.textContent = label;
      b.addEventListener('click', handler);
      return b;
    };
    actions.appendChild(mkBtn('Открыть', '', async () => {
      const r = await window.native.openScreenshot(item.path);
      if (!r?.ok) toast('Не удалось открыть скриншот', 'error');
    }));
    actions.appendChild(mkBtn('Скопировать', '', async () => {
      const r = await window.native.copyScreenshot(item.path);
      toast(r?.ok ? 'Скопировано в буфер' : 'Не удалось скопировать', r?.ok ? 'ok' : 'error');
    }));
    actions.appendChild(mkBtn('В папке', '', async () => {
      const r = await window.native.showScreenshotInFolder(item.path);
      if (!r?.ok) toast('Не удалось открыть папку', 'error');
    }));
    actions.appendChild(mkBtn('Удалить', 'danger', async () => {
      const r = await window.native.deleteScreenshot(item.path);
      if (r?.ok) { toast('Скриншот удалён'); renderScreenshots(); }
      else toast('Не удалось удалить', 'error');
    }));
    card.appendChild(actions);
    screenshotsList.appendChild(card);

    window.native.getScreenshotThumb?.(item.path).then((r) => {
      if (token !== screenshotsLoadToken || !r?.ok || !r.dataUrl) return;
      thumbWrap.innerHTML = '';
      const img = document.createElement('img');
      img.src = r.dataUrl;
      img.alt = item.name;
      thumbWrap.appendChild(img);
    }).catch(() => {});
  }
}

function openScreenshots() {
  screenshotsModal?.classList.add('show');
  renderScreenshots();
}
function closeScreenshots() {
  screenshotsModal?.classList.remove('show');
}

btnScreenshotsMain?.addEventListener('click', openScreenshots);
btnCloseScreenshots?.addEventListener('click', closeScreenshots);
btnScreenshotsOpenFolder?.addEventListener('click', () => window.native.openScreenshotsFolder?.());
screenshotsModal?.addEventListener('click', (e) => {
  if (e.target === screenshotsModal) closeScreenshots();
});
window.native.onScreenshotsChanged?.(() => {
  if (screenshotsModal?.classList.contains('show')) renderScreenshots();
});


function initSettingsNavigation() {
  const nav=document.getElementById('settings-nav');
  if(!nav) return;
  const viewport=nav.querySelector('.settings-nav-viewport');
  const prev=nav.querySelector('[data-settings-scroll=prev]');
  const next=nav.querySelector('[data-settings-scroll=next]');
  const items=()=>Array.from(nav.querySelectorAll('.settings-nav-item'));
  const scrollByPage=(dir)=>{ if(!viewport) return; viewport.scrollBy({left:dir*Math.max(220,viewport.clientWidth*.72),behavior:'smooth'}); };
  prev?.addEventListener('click',()=>scrollByPage(-1));
  next?.addEventListener('click',()=>scrollByPage(1));
  const updateArrows=()=>{
    if(!viewport) return;
    prev?.toggleAttribute('disabled',viewport.scrollLeft<=2);
    next?.toggleAttribute('disabled',viewport.scrollLeft+viewport.clientWidth>=viewport.scrollWidth-2);
  };
  viewport?.addEventListener('scroll',updateArrows,{passive:true});
  viewport?.addEventListener('wheel', (e)=>{
    if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
      e.preventDefault();
      viewport.scrollLeft += e.deltaY;
    }
  }, {passive:false});
  window.addEventListener('resize',updateArrows);
  items().forEach(btn=>btn.addEventListener('click',()=>{
    const filter=btn.dataset.settingsFilter || 'all';
    items().forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('.settings-group-card').forEach(section=>section.classList.toggle('is-hidden',filter!=='all' && section.dataset.settingsGroup!==filter));
    if(viewport){ const left=btn.offsetLeft, right=left+btn.offsetWidth, viewLeft=viewport.scrollLeft, viewRight=viewLeft+viewport.clientWidth; if(left<viewLeft) viewport.scrollTo({left:Math.max(0,left-10),behavior:'smooth'}); else if(right>viewRight) viewport.scrollTo({left:Math.max(0,right-viewport.clientWidth+10),behavior:'smooth'}); }
    requestAnimationFrame(updateArrows);
  }));
  updateArrows();
}
initSettingsNavigation();
const settingsSearch=document.getElementById('settings-search');
if(settingsSearch){
  settingsSearch.addEventListener('input',()=>{
    const q=settingsSearch.value.trim().toLowerCase();
    document.querySelectorAll('.settings-group-card').forEach(card=>{
      if(!q){card.classList.remove('search-hidden');return;}
      const text=card.textContent.toLowerCase();
      card.classList.toggle('search-hidden',!text.includes(q));
    });
  });
}
if (resumeToggle) { resumeToggle.checked = cfg.resumeEnabled !== false; resumeToggle.addEventListener('change',()=>store('resumeEnabled',resumeToggle.checked)); }
const saveTabsToggle=document.getElementById('save-tabs-toggle');
const restoreLastToggle=document.getElementById('restore-last-toggle');
if(saveTabsToggle){ saveTabsToggle.checked=cfg.saveTabs!==false; saveTabsToggle.addEventListener('change',()=>store('saveTabs',saveTabsToggle.checked)); }
if(restoreLastToggle){ restoreLastToggle.checked=cfg.restoreLastTab!==false; restoreLastToggle.addEventListener('change',()=>store('restoreLastTab',restoreLastToggle.checked)); }
document.getElementById('btn-clear-tabs')?.addEventListener('click',async()=>{
  if(!confirm('Очистить все вкладки? Останется только стартовая.')) return;
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
if (memorySaverToggle) { memorySaverToggle.checked = !!cfg.memorySaver; memorySaverToggle.addEventListener('change',()=>window.native.setMemorySaver(memorySaverToggle.checked)); }
if (cacheAutoToggle) { cacheAutoToggle.checked = cfg.autoCacheCleanup !== false; cacheAutoToggle.addEventListener('change',()=>window.native.cacheSettings({auto:cacheAutoToggle.checked,limitMB:Number(cacheLimit?.value)||512})); }
if (cacheLimit) { cacheLimit.value = String(Number(cfg.cacheLimitMB)||512); cacheLimit.addEventListener('change',()=>{let v=Number(cacheLimit.value)||512;v=Math.max(64,Math.min(16384,v));cacheLimit.value=String(v);window.native.cacheSettings({auto:cacheAutoToggle?.checked!==false,limitMB:v});}); }
async function refreshCacheInfo(){ try { const r=await window.native.cacheInfo(); if(r?.ok && cacheInfoText){ const mb=(Number(r.apiCacheMB)||0)+(Number(r.sessionCacheMB)||0); cacheInfoText.textContent=`Сейчас: ${mb.toFixed(1)} MB`; } } catch {} }
document.getElementById('btn-cache-refresh')?.addEventListener('click',refreshCacheInfo);
document.getElementById('btn-cache-clean')?.addEventListener('click',async()=>{const r=await window.native.clearCache();toast(r?.ok?'Кэш очищен':'Не удалось очистить кэш',r?.ok?'ok':'error');refreshCacheInfo();});
document.getElementById('btn-network-check')?.addEventListener('click',()=>btnConnectionCheck?.click());
document.getElementById('btn-network-open-log')?.addEventListener('click',async()=>{const r=await window.native.openLogs();if(!r?.ok)toast('Не удалось открыть журнал','error');});
document.getElementById('btn-open-log')?.addEventListener('click',async()=>{const r=await window.native.openLogs();if(!r?.ok)toast('Не удалось открыть журнал','error');});
document.getElementById('btn-copy-log')?.addEventListener('click',async()=>{const r=await window.native.copyLogs();toast(r?.ok?'Журнал скопирован':'Не удалось скопировать журнал',r?.ok?'ok':'error');});
document.getElementById('btn-clear-log')?.addEventListener('click',async()=>{if(confirm('Очистить журнал ошибок?')){const r=await window.native.clearLogs();toast(r?.ok?'Журнал очищен':'Не удалось очистить журнал',r?.ok?'ok':'error');}});
document.getElementById('btn-screenshots-open-settings')?.addEventListener('click',openScreenshots);
document.getElementById('btn-screenshots-folder-settings')?.addEventListener('click',()=>window.native.openScreenshotsFolder());
document.getElementById('btn-about-check-update')?.addEventListener('click',async()=>{const r=await window.native.checkUpdate();toast(r?.available?'Доступно обновление':'Обновлений нет',r?.available?'ok':'ok');});
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
function tabTitle(item){return String(item?.title||item?.url||'Новая страница').replace(/^AnimeOn\s*[—-]\s*/i,'').slice(0,48);}
function renderTabs(){
  if(!tabsBar)return;
  tabsBar.innerHTML='';
  pageTabs.forEach((tab,i)=>{
    const b=document.createElement('button');
    b.className='tab-item'+(i===activeTab?' active':'');
    b.title=tabTitle(tab);
    const span=document.createElement('span');
    span.textContent=tabTitle(tab);
    const close=document.createElement('span');
    close.className='tab-close';
    close.setAttribute('role','button');
    close.setAttribute('aria-label','Закрыть вкладку');
    close.textContent='×';
    close.addEventListener('click',e=>{
      e.stopPropagation();
      closeTab(i);
    });
    b.append(span,close);
    b.addEventListener('click',(e)=>{
      if(e.target.closest('.tab-close')) return;
      if(i===activeTab){
        try{ activeWebview.focus(); }catch{}
        try{ wv.reload(); }catch{}
        return;
      }
      switchTab(i);
    });
    b.style.pointerEvents='auto';
    b.style.cursor='pointer';
    tabsBar.appendChild(b);
  });
}
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

async function syncFavoriteButton(){try{const url=activeWebview?.getURL?.()||'';if(!url)return;const r=await window.native.pageFavorites();const found=(r?.items||[]).some(x=>samePageUrl(typeof x==='string'?x:x?.url, url));const icon=btnPageFavorite?.querySelector('.page-action-icon');if(icon) icon.innerHTML=found?'★':'<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z\"/></svg>';}catch{}}
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
  btnDnd.title=enabled?'Не беспокоить: включено':'Не беспокоить: выключено';
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
    toast(enabled?'Не беспокоить включён':'Не беспокоить выключен');
  }catch{toast('Не удалось изменить режим «Не беспокоить»','error');}
});
updateDndButton();

let recentPagesCache=[]; let favoritePagesCache=[];
const pagesSearch=document.getElementById('pages-search');
const favoritesSearch=document.getElementById('favorites-search');
function filterPages(items, query){
  if(!query) return items;
  const q=String(query).toLowerCase();
  return items.filter(it=>{
    const d=typeof it==='string'?{url:it,title:it}:it;
    return String(d.title||'').toLowerCase().includes(q) || String(d.url||'').toLowerCase().includes(q);
  });
}
async function openPages(){
  pagesModal?.classList.add('show');
  if(pagesSearch){ pagesSearch.value=''; }
  try {
    const r=await window.native.recentPages();
    recentPagesCache=r?.items||[];
    renderPageList(recentPagesList,recentPagesCache);
  } catch { recentPagesCache=[]; renderPageList(recentPagesList,[]); }
}
async function openFavorites(){
  favoritesModal?.classList.add('show');
  if(favoritesSearch){ favoritesSearch.value=''; }
  try {
    const f=await window.native.pageFavorites();
    favoritePagesCache=f?.items||[];
    renderPageList(favoritePagesList,favoritePagesCache);
    const url=activeWebview?.getURL?.()||'';
    const found=(favoritePagesCache||[]).some(x=>samePageUrl(typeof x==='string'?x:x?.url,url));
    const icon=btnPageFavorite?.querySelector('.page-action-icon');
    if(icon) icon.innerHTML=found?'★':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z"/></svg>';
  } catch { favoritePagesCache=[]; renderPageList(favoritePagesList,[]); }
}
function renderPageList(root,items){
  if(!root) return;
  root.innerHTML='';
  const list=Array.isArray(items)?items:[];
  if(!list.length){ root.innerHTML='<div class="st-hint pages-empty">Пока пусто</div>'; return; }
  const isRecent = root===recentPagesList;
  const isFav = root===favoritePagesList;
  const selectMode = isRecent ? pagesSelectMode : (isFav ? favSelectMode : false);
  const selectedSet = isRecent ? pagesSelected : (isFav ? favSelected : new Set());
  const toShow=list.slice(0,80);
  toShow.forEach(item=>{
    const data=typeof item==='string'?{url:item,title:item}:item;
    const urlKey=String(data.url||'');
    const b=document.createElement('div');
    b.className='page-list-item'+(selectMode?' select-mode':'');
    const check=document.createElement('input');
    check.type='checkbox';
    check.className='page-list-check';
    check.checked=selectedSet.has(urlKey);
    check.addEventListener('click', (e)=>{ e.stopPropagation(); if(check.checked) selectedSet.add(urlKey); else selectedSet.delete(urlKey); if(isRecent) updatePagesSelectUI(); else updateFavSelectUI(); });
    b.appendChild(check);
    const main=document.createElement('button');
    main.className='page-list-main';
    main.style.cssText='flex:1; background:transparent; border:0; text-align:left; cursor:pointer;';
    const title=document.createElement('strong'); title.className='page-list-title'; title.textContent=tabTitle(data);
    const urlEl=document.createElement('small'); urlEl.className='page-list-url'; urlEl.textContent=urlKey;
    main.append(title,urlEl);
    main.addEventListener('click',()=>{
      if(selectMode){
        if(selectedSet.has(urlKey)) selectedSet.delete(urlKey); else selectedSet.add(urlKey);
        check.checked=selectedSet.has(urlKey);
        if(isRecent) updatePagesSelectUI(); else updateFavSelectUI();
        return;
      }
      if(!pageTabs.length) pageTabs=[{url:data.url,title:data.title||data.url}];
      pageTabs[activeTab]={url:data.url,title:data.title||tabTitle(data)};
      if(!tabWebviews[activeTab]) createTabWebview(activeTab);
      showTabWebview(activeTab);
      loadTabUrl(activeWebview,data.url);
      renderTabs(); saveTabs(); syncFavoriteButton();
      pagesModal?.classList.remove('show'); favoritesModal?.classList.remove('show');
    });
    b.appendChild(main);
    const del=document.createElement('button');
    del.className='page-list-delete';
    del.title='Удалить';
    del.textContent='×';
    del.addEventListener('click', async (e)=>{
      e.stopPropagation();
      if(!confirm('Удалить "'+tabTitle(data)+'"?')) return;
      const targetUrl=urlKey;
      try{
        if(isRecent){
          try{ await window.native.recentPagesRemove?.(targetUrl); }catch{}
          recentPagesCache=recentPagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; return u!==targetUrl && !samePageUrl(u,targetUrl); });
          renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||''));
        } else {
          try{ await window.native.togglePageFavorite({url:targetUrl}); }catch{}
          try{ await window.native.pageFavoriteRemove?.(targetUrl); }catch{}
          favoritePagesCache=favoritePagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; return u!==targetUrl && !samePageUrl(u,targetUrl); });
          renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||''));
          syncFavoriteButton();
        }
        toast('Удалено');
      }catch{ toast('Не удалось удалить','error'); }
    });
    b.appendChild(del);
    const arrow=document.createElement('span'); arrow.className='page-list-arrow'; arrow.textContent='›';
    arrow.style.cursor='pointer';
    arrow.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(selectMode) return;
      if(!pageTabs.length) pageTabs=[{url:data.url,title:data.title||data.url}];
      pageTabs[activeTab]={url:data.url,title:data.title||tabTitle(data)};
      if(!tabWebviews[activeTab]) createTabWebview(activeTab);
      showTabWebview(activeTab);
      loadTabUrl(activeWebview,data.url);
      renderTabs(); saveTabs(); syncFavoriteButton();
      pagesModal?.classList.remove('show'); favoritesModal?.classList.remove('show');
    });
    b.appendChild(arrow);
    root.appendChild(b);
  });
}
pagesSearch?.addEventListener('input',()=>{ renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch.value)); });
favoritesSearch?.addEventListener('input',()=>{ renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch.value)); });

let pagesSelectMode=false, pagesSelected=new Set();
let favSelectMode=false, favSelected=new Set();
const pagesSelectToggle=document.getElementById('pages-select-toggle');
const pagesDeleteBtn=document.getElementById('pages-delete-selected');
const pagesCancelBtn=document.getElementById('pages-cancel-select');
const pagesCountEl=document.getElementById('pages-selected-count');
const favSelectToggle=document.getElementById('favorites-select-toggle');
const favDeleteBtn=document.getElementById('favorites-delete-selected');
const favCancelBtn=document.getElementById('favorites-cancel-select');
const favCountEl=document.getElementById('favorites-selected-count');
function updatePagesSelectUI(){
  if(!pagesSelectToggle) return;
  pagesSelectToggle.textContent=pagesSelectMode?'Готово':'Выбрать';
  const hasSel=pagesSelectMode && pagesSelected.size>0;
  pagesSelectToggle.classList.toggle('hidden-btn',pagesSelectMode && hasSel);
  pagesSelectToggle.style.display=pagesSelectMode && hasSel?'none':'inline-flex';
  if(pagesDeleteBtn){pagesDeleteBtn.classList.toggle('hidden-btn',!hasSel);pagesDeleteBtn.style.display=hasSel?'inline-flex':'none';}
  if(pagesCancelBtn){pagesCancelBtn.classList.toggle('hidden-btn',!hasSel);pagesCancelBtn.style.display=hasSel?'inline-flex':'none';}
  if(pagesCountEl) pagesCountEl.textContent=String(pagesSelected.size);
  document.querySelectorAll('#recent-pages-list .page-list-item').forEach(el=>el.classList.toggle('select-mode', pagesSelectMode));
  document.querySelectorAll('#recent-pages-list .page-list-check').forEach((cb,i)=>{
    const item=filterPages(recentPagesCache, pagesSearch?.value||'')[i];
    const key=item? (typeof item==='string'?item:item.url):'';
    cb.checked=pagesSelected.has(key);
  });
}
function updateFavSelectUI(){
  if(!favSelectToggle) return;
  favSelectToggle.textContent=favSelectMode?'Готово':'Выбрать';
  const hasSel=favSelectMode && favSelected.size>0;
  favSelectToggle.classList.toggle('hidden-btn',favSelectMode && hasSel);
  favSelectToggle.style.display=favSelectMode && hasSel?'none':'inline-flex';
  if(favDeleteBtn){favDeleteBtn.classList.toggle('hidden-btn',!hasSel);favDeleteBtn.style.display=hasSel?'inline-flex':'none';}
  if(favCancelBtn){favCancelBtn.classList.toggle('hidden-btn',!hasSel);favCancelBtn.style.display=hasSel?'inline-flex':'none';}
  if(favCountEl) favCountEl.textContent=String(favSelected.size);
  document.querySelectorAll('#favorite-pages-list .page-list-item').forEach(el=>el.classList.toggle('select-mode', favSelectMode));
  document.querySelectorAll('#favorite-pages-list .page-list-check').forEach((cb,i)=>{
    const item=filterPages(favoritePagesCache, favoritesSearch?.value||'')[i];
    const key=item? (typeof item==='string'?item:item.url):'';
    cb.checked=favSelected.has(key);
  });
}
pagesSelectToggle?.addEventListener('click',()=>{ pagesSelectMode=!pagesSelectMode; if(!pagesSelectMode) pagesSelected.clear(); updatePagesSelectUI(); renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||'')); });
pagesCancelBtn?.addEventListener('click',()=>{ pagesSelectMode=false; pagesSelected.clear(); updatePagesSelectUI(); renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||'')); });
favSelectToggle?.addEventListener('click',()=>{ favSelectMode=!favSelectMode; if(!favSelectMode) favSelected.clear(); updateFavSelectUI(); renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||'')); });
favCancelBtn?.addEventListener('click',()=>{ favSelectMode=false; favSelected.clear(); updateFavSelectUI(); renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||'')); });
pagesDeleteBtn?.addEventListener('click',async()=>{
  if(!pagesSelected.size) return;
  if(!confirm(`Удалить ${pagesSelected.size} страниц из истории?`)) return;
  const toDelete=new Set(pagesSelected);
  try{
    for(const url of toDelete){
      try{ await window.native.recentPagesRemove?.(url); }catch{}
      recentPagesCache=recentPagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; return !toDelete.has(u) && !samePageUrl(u, [...toDelete][0]); });
      recentPagesCache=recentPagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; for(const d of toDelete) if(d===u || samePageUrl(d,u)) return false; return true; });
    }
    pagesSelected.clear();
    pagesSelectMode=false;
    updatePagesSelectUI();
    renderPageList(recentPagesList, filterPages(recentPagesCache, pagesSearch?.value||''));
    toast('Удалено');
  }catch(e){ toast('Не удалось удалить','error'); }
});
favDeleteBtn?.addEventListener('click',async()=>{
  if(!favSelected.size) return;
  if(!confirm(`Удалить ${favSelected.size} из избранного?`)) return;
  const toDelete=new Set(favSelected);
  try{
    for(const url of toDelete){
      try{ await window.native.togglePageFavorite({url}); }catch{}
      try{ await window.native.pageFavoriteRemove?.(url); }catch{}
    }
    favoritePagesCache=favoritePagesCache.filter(it=>{ const u=typeof it==='string'?it:it.url; for(const d of toDelete) if(d===u || samePageUrl(d,u)) return false; return true; });
    favSelected.clear();
    favSelectMode=false;
    updateFavSelectUI();
    renderPageList(favoritePagesList, filterPages(favoritePagesCache, favoritesSearch?.value||''));
    syncFavoriteButton();
    toast('Удалено из избранного');
  }catch(e){ toast('Не удалось удалить','error'); }
});
btnPages?.addEventListener('click',openPages);
btnPageFavorites?.addEventListener('click',openFavorites);
btnClosePages?.addEventListener('click',()=>pagesModal?.classList.remove('show'));
btnCloseFavorites?.addEventListener('click',()=>favoritesModal?.classList.remove('show'));
pagesModal?.addEventListener('click',e=>{if(e.target===pagesModal)pagesModal.classList.remove('show')});
favoritesModal?.addEventListener('click',e=>{if(e.target===favoritesModal)favoritesModal.classList.remove('show')});
btnPageFavorite?.addEventListener('click',async()=>{
  let url='',title='';
  try{url=activeWebview?.getURL?.()||'';}catch{}
  if(!isAnimeOnUrl(url)) url=pageTabs[activeTab]?.url||'';
  try{title=await activeWebview?.getTitle?.()||'';}catch{}
  if(!isAnimeOnUrl(url)){toast('Открой страницу AnimeOn, чтобы добавить её в избранное','error');return;}
  try{
    const r=await window.native.togglePageFavorite({url,title});
    if(!r?.ok){toast('Не удалось изменить избранное','error');return;}
    syncFavoriteButton();
    toast(r.favorite?'Добавлено в избранное':'Удалено из избранного');
  }catch{toast('Не удалось изменить избранное','error');}
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
    const activeUrl=pageTabs[activeTab]?.url||selected.url;
    if(tabWebviews[activeTab]) loadTabUrl(tabWebviews[activeTab], activeUrl);
    pageTabs.forEach((tab,i)=>{ if(i!==activeTab && tabWebviews[i]) loadTabUrl(tabWebviews[i], tab.url); });
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
    loadTabUrl(tabWebviews[0]||firstWebview,SITES.co.url);
  }
})();

function closeSettings() {
  settingsOverlay.classList.remove('show');
  btnSettings.classList.remove('open');
  if(settingsSearch){settingsSearch.value='';document.querySelectorAll('.settings-group-card').forEach(c=>c.classList.remove('search-hidden'));}
}
btnSettings.addEventListener('click', openSettings);
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

async function loadProfiles(){
  if(!sysProfileList) return;
  const r=await window.native.getProfiles();
  const profiles=r?.profiles||{};
  sysProfileList.innerHTML=Object.keys(profiles).map(name=>`<div class="profile-chip"><span>${escapeHtml(name)}</span><button data-load-profile="${escapeHtml(name)}">Загрузить</button><button data-delete-profile="${escapeHtml(name)}">×</button></div>`).join('')||'<span class="system-status">Профилей пока нет.</span>';
  sysProfileList.querySelectorAll('[data-load-profile]').forEach(b=>b.addEventListener('click',async()=>{const r=await window.native.loadProfile(b.dataset.loadProfile);if(!r?.ok){toast('Профиль не найден','error');return;}Object.assign(cfg,r.profile||{});applyTheme(cfg.theme||'violet',{skipSave:true});window.native.setConfig(r.profile||{});toast(`Профиль «${b.dataset.loadProfile}» загружен`);}));
  sysProfileList.querySelectorAll('[data-delete-profile]').forEach(b=>b.addEventListener('click',async()=>{await window.native.deleteProfile(b.dataset.deleteProfile);loadProfiles();toast('Профиль удалён');}));
}
async function loadSystems(){
  if(!sysStatus)return;
  sysStatus.textContent='Собираю состояние системы…';
  const [status,cache,shots]=await Promise.all([window.native.systemStatus(),window.native.cacheInfo(),window.native.listScreenshots()]);
  sysApi.textContent=status?.api?.ok?`${status.api.ms||0} мс`:'Недоступен';
  sysApiDetail.textContent=status?.api?.endpoint||'API health';
  sysMemory.textContent=`${status?.memoryMB||0} MB`;
  sysSiteMemory.textContent=`WebView ${status?.siteMemoryMB||0} MB`;
  sysCache.textContent=`${cache?.sessionCacheMB||0} MB`;
  sysScreenshots.textContent=`Скриншоты ${cache?.screenshots||shots?.items?.length||0}`;
  const gpu=String(status?.gpu?.gpu_compositing||'unknown');
  sysGpu.textContent=gpu==='enabled'?'Включён':gpu==='disabled'?'Выключен':gpu;
  sysStatus.textContent=`Uptime: ${Math.floor((status?.uptime||0)/60)} мин · Performance: ${status?.performance||'balanced'} · Recovery: ${status?.autoRecovery?'ON':'OFF'}`;
  loadProfiles();
}
document.getElementById('sys-refresh')?.addEventListener('click',loadSystems);
document.getElementById('sys-clear-cache')?.addEventListener('click',async()=>{const r=await window.native.clearApiCache();toast(r?.ok?'API-кэш очищен':'Не удалось очистить кэш',r?.ok?'ok':'error');loadSystems();});
document.getElementById('sys-clear-session')?.addEventListener('click',async()=>{const r=await window.native.clearCache();toast(r?.ok?'WebView-кэш очищен':'Не удалось очистить кэш',r?.ok?'ok':'error');loadSystems();});
document.getElementById('sys-profile-save')?.addEventListener('click',async()=>{const name=sysProfileName?.value.trim();if(!name){toast('Укажи название профиля','error');return;}const data={theme:cfg.theme,custom:cfg.custom,visual:cfg.visual,playbackSpeed:cfg.playbackSpeed,playbackPreferences:cfg.playbackPreferences||{},performance:cfg.performance,lowPower:cfg.lowPower,autoHide:cfg.autoHide};const r=await window.native.saveProfile(name,data);if(r?.ok){sysProfileName.value='';loadProfiles();toast(`Профиль «${name}» сохранён`)}else toast(r?.error||'Не удалось сохранить профиль','error');});

btnBack.addEventListener('click', () => wv.goBack());
btnFwd.addEventListener('click', () => wv.goForward());
btnHome.addEventListener('click', () => { if (currentSite) loadTabUrl(activeWebview, SITES[currentSite].url); });
btnReload.addEventListener('click', () => wv.reload());

btnMax.addEventListener('click', () => window.native.toggleMaximize());
btnFs.addEventListener('click', () => window.native.toggleFullscreen());
btnClose.addEventListener('click', () => window.native.close());

window.native.onWinState((max) => { btnMax.classList.toggle('is-max', max); document.body.classList.toggle('is-maximized', max); setTimeout(()=>{ try{ syncViewAreaHeight?.(); }catch{} try{ activeWebview?.executeJavaScript('window.dispatchEvent(new Event("resize"))', false); }catch{} }, 80); });
window.native.onFsState((fs) => document.body.classList.toggle('is-fs', fs));

const commands = [
  ['Пауза / продолжить', () => window.native.mediaAction('playpause')],
  ['Picture-in-Picture', async () => { const r = await window.native.togglePiP(); if (!r?.ok) toast('Не удалось включить PiP', 'error'); }],
  ['Скорость 0.5×', () => { currentPlayerSpeed = 0.5; window.native.setPlaybackSpeed(0.5); renderPlayerSpeed(); }],
  ['Скорость 1×', () => { currentPlayerSpeed = 1; window.native.setPlaybackSpeed(1); renderPlayerSpeed(); }],
  ['Скорость 1.5×', () => { currentPlayerSpeed = 1.5; window.native.setPlaybackSpeed(1.5); renderPlayerSpeed(); }],
  ['Скорость 2×', () => { currentPlayerSpeed = 2; window.native.setPlaybackSpeed(2); renderPlayerSpeed(); }],
  ['Громче', () => { window.native.setVolume(5); setTimeout(refreshVolume, 50); }],
  ['Тише', () => { window.native.setVolume(-5); setTimeout(refreshVolume, 50); }],
  ['Выключить / включить звук', () => { window.native.toggleMute(); setTimeout(refreshVolume, 50); }],
  ['10 секунд назад', () => window.native.seek(-10)],
  ['10 секунд вперёд', () => window.native.seek(10)],
  ['Следующая серия', () => window.native.mediaAction('next')],
  ['Открыть предыдущий / следующий адрес', () => { openSite(getOtherSiteId()); }],
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
  if (e.key === 'Escape') { commandPalette?.classList.remove('show'); closeHotkeys(); closeScreenshots(); closeSettings(); hideError(); confirmScreen?.classList.remove('show'); return; }
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
    setTimeout(() => splash?.remove(), 720);
  }, delay);
}

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
});

wv.addEventListener('did-fail-load', (e) => {
  if (e.errorCode === -3) return;
  window.native.setTaskbarProgress?.(-1);
  showError('Не удалось открыть зеркало. Попробуй ещё раз или переключись на другое.');
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
if (performanceSelect) performanceSelect.value = store('performance') || 'balanced';
if (autoRecoveryToggle) autoRecoveryToggle.checked = store('autoRecovery') !== false;
if (confirmCloseToggle) confirmCloseToggle.checked = store('closeBehavior') === 'ask' || (!!store('confirmClose') && !store('closeBehavior'));
if (closeBehaviorSelect) closeBehaviorSelect.value = store('closeBehavior') || (store('confirmClose') ? 'ask' : 'exit');
applyPerformance(performanceSelect?.value || 'balanced');
document.body.classList.toggle('compact-mode', compactToggle.checked);
document.body.classList.toggle('low-power', lowPowerToggle.checked || performanceSelect?.value === 'economy');

if (appInfo.version) stVersion.textContent = `AnimeOn Desktop · v${appInfo.version}`;

let rememberSite = store('remember') === '1';
let savedSite = SITES[store('site')] ? store('site') : 'co';
try {
  activateSite(savedSite, { save: false });
  syncVisualUI();
  refreshProfiles();
} catch (e) {
  try { console.error('[AnimeOn] startup init error', e); } catch {}
}

startSplashProgress();

try {
  if (picker) {
    if (rememberSite) {
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

setInterval(async () => { try { const state = await window.native.getMediaState(); if (state?.available && Number(state.duration) > 0) persistLocalPlayback(state); } catch {} }, 15000);

let lastNotificationSignature='';
async function pollAnimeNotifications(){try{if(!cfg.notify)return;const r=await window.native.notificationPoll();const items=Array.isArray(r?.items)?r.items:[];const first=items[0];if(!first)return;const sig=String(first.id||first.notification_id||first.created_at||first.title||'');if(sig&&sig!==lastNotificationSignature){if(lastNotificationSignature) toast(first.title||first.message||'Новое уведомление');lastNotificationSignature=sig;}}catch{}}
setTimeout(pollAnimeNotifications,12000);
setInterval(pollAnimeNotifications,300000);
