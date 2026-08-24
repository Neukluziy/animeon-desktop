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
const settingsOverlay = document.getElementById('settings');
const hotkeysModal = document.getElementById('hotkeys-modal');
const btnHotkeys = document.getElementById('btn-hotkeys');
const btnCloseHotkeys = document.getElementById('btn-close-hotkeys');
const btnCloseSettings = document.getElementById('btn-close-settings');
const picker = document.getElementById('site-picker');
const rememberPick = document.getElementById('remember-pick');
const rememberSettings = document.getElementById('remember-settings');
const autostartToggle = document.getElementById('autostart-toggle');
const trayToggle = document.getElementById('tray-toggle');
const btnContinue = document.getElementById('btn-continue');
const autohideToggle = document.getElementById('autohide-toggle');
const compactToggle = document.getElementById('compact-toggle');
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
const toastStack = document.getElementById('toast-stack');
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

async function applyGuestStyles() {
  if (!currentSite) return;
  try { await wv.insertCSS(scrollCss(getAccentRgb())); } catch {}
}

function resetThemeVars() {
  ['--a-rgb', '--al-rgb', '--am-rgb', '--ad-rgb'].forEach((p) =>
    document.documentElement.style.removeProperty(p));
}

const themeSwatches = [...document.querySelectorAll('.theme-swatch')];

const PRESET_THEMES = new Set(['violet','blue','cyan','sky','indigo','emerald','green','lime','yellow','amber','orange','red','rose','pink','fuchsia','slate','gray']);
let activeTheme = PRESET_THEMES.has(cfg.theme) ? cfg.theme : 'violet';

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

  themeSwatches.forEach((b) => b.classList.toggle('active', b.dataset.theme === activeTheme));

  if (isNight()) {
    const cs = getComputedStyle(document.documentElement);
    const dim = (v, k) => v.split(',').map((c) => Math.round(parseFloat(c) * k)).join(',');
    [['--a-rgb', .55], ['--al-rgb', .65], ['--am-rgb', .5], ['--ad-rgb', .45]].forEach(([prop, k]) => {
      const v = cs.getPropertyValue(prop).trim();
      if (v) document.documentElement.style.setProperty(prop, dim(v, k));
    });
  }

  if (!opts.skipSave) store('theme', activeTheme);
  applyGuestStyles();
}

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
}

function openSite(id) {
  const s = SITES[id];
  if (!s) return;
  activateSite(id, { save: false });
  if (!wv.getAttribute('src')) wv.setAttribute('src', s.url);
  else wv.loadURL(s.url);
}

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
lowPowerToggle.addEventListener('change', () => { store('lowPower', lowPowerToggle.checked); document.body.classList.toggle('low-power', lowPowerToggle.checked); });
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
btnExportSettings?.addEventListener('click', async () => { const r = await window.native.exportSettings(); if (r?.ok) toast('Настройки экспортированы'); else if (!r?.canceled) toast(r?.error || 'Не удалось экспортировать настройки', 'error'); });
btnImportSettings?.addEventListener('click', async () => { const r = await window.native.importSettings(); if (!r?.ok) { if (!r?.canceled) toast(r?.error || 'Не удалось импортировать настройки', 'error'); return; } Object.assign(cfg, r.settings || {}); applyTheme(cfg.theme || 'violet', {skipSave:true}); rememberPick.checked=rememberSettings.checked=cfg.remember==='1'; autostartToggle.checked=!!cfg.autostart; trayToggle.checked=!!cfg.tray; compactToggle.checked=!!cfg.compact; lowPowerToggle.checked=cfg.lowPower!==false; autohideToggle.checked=cfg.autoHide!==false; if(performanceSelect) performanceSelect.value=cfg.performance||'balanced'; if(autoRecoveryToggle) autoRecoveryToggle.checked=cfg.autoRecovery!==false; if(closeBehaviorSelect) closeBehaviorSelect.value=cfg.closeBehavior|| (cfg.confirmClose?'ask':'exit'); if(confirmCloseToggle) confirmCloseToggle.checked=(closeBehaviorSelect?.value==='ask'); document.body.classList.toggle('compact-mode',!!cfg.compact); document.body.classList.toggle('low-power',cfg.lowPower!==false); applyPerformance(cfg.performance||'balanced'); toast('Настройки импортированы'); });
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

function openSettings() {
  settingsOverlay.classList.add('show');
  btnSettings.classList.add('open');
}
function openHotkeys() {
  hotkeysModal?.classList.add('show');
}
function closeHotkeys() {
  hotkeysModal?.classList.remove('show');
}
btnHotkeys?.addEventListener('click', openHotkeys);
btnHotkeysMain?.addEventListener('click', openHotkeys);
btnCloseHotkeys?.addEventListener('click', closeHotkeys);
hotkeysModal?.addEventListener('click', (e) => {
  if (e.target === hotkeysModal) closeHotkeys();
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
  ['Перезагрузить страницу', () => wv.reload()],
  ['Назад', () => wv.canGo() && wv.goBack()],
  ['Вперёд', () => wv.canGoForward() && wv.goForward()],
  ['Полный экран', () => window.native.toggleFullscreen()],
  ['Настройки', () => openSettings()],
  ['Перезапустить WebView', () => wv.reload()],
  ['Очистить кэш', async () => { await window.native.clearCache(); wv.reload(); }],
  ['DevTools', () => window.native.toggleDevTools()],
  ['Проверить приложение', () => btnDiagnostics?.click()],
  ['Открыть в браузере', () => window.native.openExternal(wv.getURL())],
];

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
  if (e.key === 'Escape') { commandPalette?.classList.remove('show'); closeHotkeys(); closeSettings(); hideError(); confirmScreen?.classList.remove('show'); return; }
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

let progVal = 0;
let progTarget = 0;
let progFrame = 0;

function setProg(p) {
  progVal = p;
  if (splashBarFill) splashBarFill.style.width = p + '%';
  if (splashPct) splashPct.textContent = Math.round(p) + '%';
  splash?.style.setProperty('--p', (p / 100).toFixed(3));
}

function animateProgress(target) {
  progTarget = Math.max(progTarget, target);
  cancelAnimationFrame(progFrame);
  const tick = () => {
    const diff = progTarget - progVal;
    if (diff <= 0.05) { setProg(progTarget); return; }
    setProg(progVal + Math.max(.18, diff * .09));
    progFrame = requestAnimationFrame(tick);
  };
  progFrame = requestAnimationFrame(tick);
}

function startSplashProgress() {
  progVal = 0; progTarget = 12; setProg(0);
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
  progress.classList.add('active');
  hideError();
  window.native.setTaskbarProgress?.(0.08);
});

wv.addEventListener('dom-ready', () => {
  wv.focus();
  hideError();
  window.native.setTaskbarProgress?.(0.78);
  updateNav();
  applyGuestStyles();
  revealApp();
});

wv.addEventListener('did-stop-loading', () => {
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
  offlineScreen?.classList.add('show');
  window.native.taskbarOverlay?.('error');
}
function hideError() { errorScreen?.classList.remove('show'); offlineScreen?.classList.remove('show'); window.native.taskbarOverlay?.('none'); }
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

  const res = await window.native.checkUpdate();

  if (!res || !res.ok) {
    updStatus.textContent = auto
      ? ''
      : 'Не удалось проверить обновления. Проверь подключение к интернету';
  } else if (res.hasUpdate) {
    updStatus.textContent = `Свежая версия — v${res.latest} (у тебя v${res.current})`;
    btnUpdGet.classList.remove('hidden');
    btnUpdGet.onclick = () => window.native.updOpen();
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
lowPowerToggle.checked = store('lowPower') !== false;
if (performanceSelect) performanceSelect.value = store('performance') || 'balanced';
if (autoRecoveryToggle) autoRecoveryToggle.checked = store('autoRecovery') !== false;
if (confirmCloseToggle) confirmCloseToggle.checked = store('closeBehavior') === 'ask' || (!!store('confirmClose') && !store('closeBehavior'));
if (closeBehaviorSelect) closeBehaviorSelect.value = store('closeBehavior') || (store('confirmClose') ? 'ask' : 'exit');
applyPerformance(performanceSelect?.value || 'balanced');
document.body.classList.toggle('compact-mode', compactToggle.checked);
document.body.classList.toggle('low-power', lowPowerToggle.checked);

if (appInfo.version) stVersion.textContent = `AnimeOn Desktop · v${appInfo.version}`;

const rememberSite = store('remember') === '1';
const savedSite = rememberSite && SITES[store('site')] ? store('site') : null;
if (savedSite) activateSite(savedSite, { save: false });
else {
  currentSite = null;
  document.querySelectorAll('[data-site]').forEach((el) => {
    el.classList.remove('selected', 'active');
  });
}

startSplashProgress();

if (rememberSite && savedSite) {
  picker.remove();
  openSite(savedSite);
} else {
  setTimeout(() => {
    revealApp(100);
    picker.classList.add('show');
    document.body.classList.add('picker-visible');
  }, 650);
}

setTimeout(() => refreshUpdateStatus(true), 8000);
