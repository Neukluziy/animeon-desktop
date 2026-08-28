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
const wv = document.getElementById('wv');
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

const SITES = {
  cc: { url: 'https://animeon.cc/', label: 'animeon.cc' },
  co: { url: 'https://v1.animeon.co/', label: 'v1.animeon.co' },
};

const cfg = window.native.getConfig() || {};
const appInfo = window.native.getAppInfo() || { version: '' };

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
  const smooth = v.animations !== 'off';
  const transition = v.animations === 'cinematic' ? '620ms cubic-bezier(.16,1,.3,1)' : v.animations === 'smooth' ? '360ms cubic-bezier(.22,1,.36,1)' : '0ms';
  const anim = v.animations === 'cinematic' ? 'animeonCinematic .52s cubic-bezier(.16,1,.3,1)' : v.animations === 'smooth' ? 'animeonSmooth .28s cubic-bezier(.22,1,.36,1)' : 'none';
  const surfaces = 'header,nav,.header,.navbar,.menu,.sidebar,.modal,.dialog,.dropdown,.panel,.card,.anime-card,.tile,.poster,.chip,.badge';
  const cards = '.card,.anime-card,.tile,.poster';
  const motion = smooth ? `${surfaces},button,a,input,select,textarea,[role=button]{transition:transform var(--animeon-transition),opacity var(--animeon-transition),box-shadow var(--animeon-transition),background-color var(--animeon-transition),border-color var(--animeon-transition),color var(--animeon-transition)!important}button:hover,a:hover,[role=button]:hover,.card:hover,.anime-card:hover,.tile:hover{transform:translateY(-1px)}` : '';
  const radius = `${surfaces},button,input,select,textarea,[role=button]{border-radius:var(--animeon-radius)!important}`;
  const panel = `${surfaces}{background-color:rgba(24,20,31,var(--animeon-alpha));backdrop-filter:blur(var(--animeon-blur)) saturate(115%);-webkit-backdrop-filter:blur(var(--animeon-blur))}`;
  const densityRules = `.anime-grid,.cards-grid,.cards,.grid{gap:calc(16px * var(--animeon-density))!important}.card,.anime-card,.tile{padding:calc(12px * var(--animeon-density))!important}`;
  const glowRules = glow > 0 ? `button[class*="primary"],a[class*="primary"],.btn-primary,.button-primary,.accent-button,[data-primary=true]{box-shadow:0 8px calc(26px * var(--animeon-glow)) rgba(var(--animeon-accent-rgb),calc(.20 * var(--animeon-glow)))!important}.card:hover,.anime-card:hover,.tile:hover{box-shadow:0 14px calc(34px * var(--animeon-glow)) rgba(var(--animeon-accent-rgb),calc(.12 * var(--animeon-glow)))!important}` : '';
  const safeScale = scale === 1 ? '' : `body{zoom:${scale}}`;
  return `:root{--animeon-radius:${v.radius}px;--animeon-alpha:${alpha};--animeon-blur:${v.blur}px;--animeon-density:${density};--animeon-transition:${transition};--animeon-glow:${glow}}html{scroll-behavior:${cfg.smoothSite !== false ? 'smooth' : 'auto'}!important;scroll-padding-top:16px}${safeScale}${motion}${radius}${panel}${densityRules}${glowRules}*{scrollbar-width:thin}@keyframes animeonSmooth{from{opacity:.96;transform:translateY(4px)}to{opacity:1;transform:none}}@keyframes animeonCinematic{from{opacity:.97;transform:translateY(3px)}to{opacity:1;transform:none}}html.animeon-route-pulse main,html.animeon-route-pulse [role=main],html.animeon-route-pulse #app,html.animeon-route-pulse #root{animation:${anim}}`;
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
  cfg.profiles[name]={theme:activeTheme,visual:getVisual(),smoothSite:cfg.smoothSite!==false,css:cfg.customCss?.[key]||''};
  store('profiles',cfg.profiles);
  refreshProfiles();
  styleProfileSelect.value=name;
  toast('Профиль сохранён');
});
btnProfileLoad?.addEventListener('click',()=>{
  const name=styleProfileSelect?.value; const profile=cfg.profiles?.[name];
  if(!profile){toast('Выберите профиль','error');return}
  applyTheme(profile.theme||'violet',{skipSave:false});
  cfg.visual=profile.visual||getVisual();cfg.smoothSite=profile.smoothSite!==false;
  const key=currentSite==='co'?'co':'cc';
  if(!cfg.customCss)cfg.customCss={cc:'',co:''};cfg.customCss[key]=profile.css||'';
  store('visual',cfg.visual);store('smoothSite',cfg.smoothSite);store('customCss',cfg.customCss);
  syncVisualUI();loadSiteEditor();applyGuestStyles();toast('Профиль загружен');
});
btnProfileDelete?.addEventListener('click',()=>{
  const name=styleProfileSelect?.value;if(!name||!cfg.profiles?.[name]){toast('Выберите профиль','error');return}
  delete cfg.profiles[name];store('profiles',cfg.profiles);refreshProfiles();toast('Профиль удалён');
});

async function applyGuestStyles() {
  if (!currentSite || !wv) return;
  const key = currentSite === 'co' ? 'co' : 'cc';
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
const THEME_NAMES = {violet:'Фиолетовый',blue:'Синий',cyan:'Бирюзовый',sky:'Небесный',indigo:'Индиго',emerald:'Изумрудный',green:'Зелёный',lime:'Лаймовый',yellow:'Жёлтый',amber:'Янтарный',orange:'Оранжевый',red:'Красный',rose:'Розовый',pink:'Розовый',fuchsia:'Фуксия',slate:'Серо-синий',gray:'Серый',teal:'Тёмная бирюза',mint:'Мята',gold:'Золото',coral:'Коралл',lavender:'Лаванда',crimson:'Алый',electric:'Электрик'};

const PRESET_THEMES = new Set(['violet','blue','cyan','sky','indigo','emerald','green','lime','yellow','amber','orange','red','rose','pink','fuchsia','slate','gray','teal','mint','gold','coral','lavender','crimson','electric']);
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
  if (!wv.getAttribute('src')) wv.setAttribute('src', s.url);
  else wv.loadURL(s.url);
}

function loadSiteEditor() {
  if (!siteCssInput || !smoothSiteToggle) return;
  syncVisualUI();
  refreshProfiles();
  const key = currentSite === 'co' ? 'co' : 'cc';
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
  const key = currentSite === 'co' ? 'co' : 'cc';
  if (!cfg.customCss || typeof cfg.customCss !== 'object') cfg.customCss = { cc: '', co: '' };
  cfg.customCss[key] = siteCssInput?.value || '';
  store('customCss', cfg.customCss);
  await applyGuestStyles();
  toast('Оформление сайта применено');
});

btnSiteCssReset?.addEventListener('click', async () => {
  if (!currentSite) return;
  const key = currentSite === 'co' ? 'co' : 'cc';
  if (!cfg.customCss || typeof cfg.customCss !== 'object') cfg.customCss = { cc: '', co: '' };
  cfg.customCss[key] = '';
  if (siteCssInput) siteCssInput.value = '';
  store('customCss', cfg.customCss);
  await applyGuestStyles();
  toast('Свой CSS сброшен');
});

function switchMirror() {
  const otherId = currentSite === 'co' ? 'cc' : 'co';
  document.body.classList.add('mirror-switching');
  setTimeout(() => { store('site', otherId); openSite(otherId); }, 180);
  setTimeout(() => document.body.classList.remove('mirror-switching'), 520);
}

function updateMirrorBtn() {
  if (!currentSite) return;
  btnSite.title = `Сейчас ${SITES[currentSite].label} — переключить на ${SITES[currentSite === 'co' ? 'cc' : 'co'].label}`;
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

btnContinue.addEventListener('click', () => {
  if (!currentSite) return;
  if (rememberPick.checked) store('remember', '1');
  picker.classList.add('hide');
  setTimeout(() => {
    document.body.classList.remove('picker-visible');
    picker.remove();
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

function closeSettings() {
  settingsOverlay.classList.remove('show');
  btnSettings.classList.remove('open');
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
  if (!/^https:\/\/(?:www\.)?animeon\.(?:cc|co)\//i.test(String(url))) return;
  cfg.lastUrl = String(url);
  const history = Array.isArray(cfg.history) ? cfg.history : [];
  const next = [String(url), ...history.filter(x => x !== url)].slice(0, 80);
  cfg.history = next;
  window.native.setConfig({ lastUrl: cfg.lastUrl, history: cfg.history });
}

wv?.addEventListener('did-navigate', e => rememberPage(e.url));
wv?.addEventListener('did-navigate-in-page', e => rememberPage(e.url));
wv?.addEventListener('dom-ready', () => {
  document.body.classList.remove('page-soft-loading');
  document.body.classList.add('page-ready');
  setTimeout(() => document.body.classList.remove('page-ready'), 360);
});

btnBack.addEventListener('click', () => wv.goBack());
btnFwd.addEventListener('click', () => wv.goForward());
btnHome.addEventListener('click', () => { if (currentSite) wv.loadURL(SITES[currentSite].url); });
btnReload.addEventListener('click', () => wv.reload());

btnMax.addEventListener('click', () => window.native.toggleMaximize());
btnFs.addEventListener('click', () => window.native.toggleFullscreen());
btnClose.addEventListener('click', () => window.native.close());

window.native.onWinState((max) => btnMax.classList.toggle('is-max', max));
window.native.onFsState((fs) => document.body.classList.toggle('is-fs', fs));

const commands = [
  ['Пауза / продолжить', () => window.native.mediaAction('playpause')],
  ['Громче', () => { window.native.setVolume(5); setTimeout(refreshVolume, 50); }],
  ['Тише', () => { window.native.setVolume(-5); setTimeout(refreshVolume, 50); }],
  ['Выключить / включить звук', () => { window.native.toggleMute(); setTimeout(refreshVolume, 50); }],
  ['10 секунд назад', () => window.native.seek(-10)],
  ['10 секунд вперёд', () => window.native.seek(10)],
  ['Следующая серия', () => window.native.mediaAction('next')],
  ['Открыть предыдущий / следующий адрес', () => { const next = currentSite === 'cc' ? 'co' : 'cc'; currentSite = next; wv.loadURL(SITES[next].url); }],
  ['animeon.cc', () => { currentSite = 'cc'; wv.loadURL(SITES.cc.url); }],
  ['v1.animeon.co', () => { currentSite = 'co'; wv.loadURL(SITES.co.url); }],
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
window.native.onGoHome?.(() => { if (currentSite) wv.loadURL(SITES[currentSite].url); });
window.native.onSwitchSite?.(() => { const next = currentSite === 'cc' ? 'co' : 'cc'; currentSite = next; wv.loadURL(SITES[next].url); });
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
  revealApp();
});

wv.addEventListener('did-stop-loading', () => {
  animateProgress(100);
  progress.classList.remove('active');
  updateNav();
  window.native.setTaskbarProgress?.(1);
  setTimeout(() => window.native.setTaskbarProgress?.(-1), 350);
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

let rememberSite = false;
let savedSite = null;
try {
  rememberSite = store('remember') === '1';
  savedSite = rememberSite && SITES[store('site')] ? store('site') : null;
  if (savedSite) activateSite(savedSite, { save: false });
  else {
    currentSite = null;
    document.querySelectorAll('[data-site]').forEach((el) => {
      el.classList.remove('selected', 'active');
    });
  }
  syncVisualUI();
  refreshProfiles();
} catch (e) {
  try { console.error('[AnimeOn] startup init error', e); } catch {}
  rememberSite = false;
  savedSite = null;
}

startSplashProgress();

try {
  if (rememberSite && savedSite) {
    picker.remove();
    openSite(savedSite);
    setTimeout(() => { if (!booted) revealApp(0); }, 6000);
  } else {
    setTimeout(() => {
      revealApp(100);
      picker.classList.add('show');
      document.body.classList.add('picker-visible');
    }, 650);
  }
} catch (e) {
  try { console.error('[AnimeOn] site open error', e); } catch {}
  try { revealApp(0); picker.classList.add('show'); document.body.classList.add('picker-visible'); } catch {}
}

setTimeout(() => refreshUpdateStatus(true), 8000);
