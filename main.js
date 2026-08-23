const { app, BrowserWindow, ipcMain, shell, Tray, Notification, screen, globalShortcut, session } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const SITE_RE = /^https?:\/\/([a-z0-9-]+\.)*animeon\.(co|cc)\//i;
const AUTH_RE = /(accounts\.google|apis\.google|googleusercontent|oauth\.telegram|telegram\.org|t\.me)/i;

const configPath = path.join(app.getPath('userData'), 'config.json');
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
  lowPower: true,
  autoHide: true,
};

try {
  Object.assign(config, JSON.parse(fs.readFileSync(configPath, 'utf8')));
} catch {}

function saveConfig() {
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch {}
}

function applySideEffects(patch) {
  if ('autostart' in patch) {
    try { app.setLoginItemSettings({ openAtLogin: !!config.autostart }); } catch {}
  }
  if ('tray' in patch) ensureTray();
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
    icon: path.join(__dirname, 'assets', 'logo.ico'),
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
  win.loadFile('index.html');
  if (ws.maximized) win.maximize();
  const saveBounds = () => saveWindowState();
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
    if (config.confirmClose && !quitting && !config.tray) {
      e.preventDefault();
      win.webContents.send('confirm-close');
      return;
    }
    if (config.tray && !quitting) {
      e.preventDefault();
      win.hide();
    }
    saveWindowState();
  });

  setupJumpList();

  win.webContents.on('did-attach-webview', (_, wc) => {
    try { wc.setBackgroundThrottling(true); } catch {}
    try { wc.setVisualZoomLevelLimits(0.5, 3); } catch {}
    wc.on('render-process-gone', () => {
      setTaskbarOverlay('error');
      if (config.autoRecovery && win && !win.isDestroyed()) {
        setTimeout(() => { try { wc.reload(); } catch {} }, 700);
      }
    });
    wc.on('dom-ready', async () => {
      try {
        const imgs = await wc.executeJavaScript(`Array.from(document.images).map(i=>i.currentSrc||i.src).filter(Boolean).filter(u=>/^https?:\/\//i.test(u)).slice(0,10)`, false);
        if (Array.isArray(imgs) && imgs.length) win?.webContents.send('mirror-posters', imgs);
      } catch {}
    });
    wc.setWindowOpenHandler(({ url }) => {
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
            icon: path.join(__dirname, 'assets', 'logo.ico'),
          },
        };
      }
      if (SITE_RE.test(url)) {
        wc.loadURL(url);
        return { action: 'deny' };
      }
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });

    wc.on('did-create-window', (childWin) => {
      let sawAuth = false;
      const checkNav = (_, u) => {
        if (AUTH_RE.test(u)) sawAuth = true;
        else if (SITE_RE.test(u) && sawAuth) {
          setTimeout(() => {
            childWin.close();
            wc.reload();
          }, 600);
        }
      };
      childWin.webContents.on('did-navigate', checkNav);
      childWin.webContents.on('did-navigate-in-page', checkNav);
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
      else if (input.key === 'F12') { wc.toggleDevTools(); e.preventDefault(); }
      else if (input.alt && input.key === 'ArrowLeft') { wc.goBack(); e.preventDefault(); }
      else if (input.alt && input.key === 'ArrowRight') { wc.goForward(); e.preventDefault(); }
    });
  });
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
  tray = new Tray(path.join(__dirname, 'assets', 'logo.png'));
  tray.setToolTip('AnimeOn');
  tray.on('click', () => toggleTrayMenu());
  tray.on('double-click', () => showMainWindow());
  tray.on('right-click', () => toggleTrayMenu());
}

function setTaskbarOverlay(kind = 'none') {
  if (!win || win.isDestroyed()) return;
  try {
    const icon = kind === 'error' ? path.join(__dirname, 'assets', 'logo.png') : null;
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
  const [w, h] = [220, 224];
  const p = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(p).workArea;
  trayMenuWin = new BrowserWindow({
    width: w,
    height: h,
    x: Math.max(wa.x + 4, Math.min(p.x - w / 2, wa.x + wa.width - w - 4)),
    y: Math.max(wa.y + 4, p.y - h - 12),
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
  trayMenuWin.loadFile('tray.html');
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
  if (action === 'settings' && win) {
    showMainWindow();
    win.webContents.send('open-settings');
  }
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
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

ipcMain.on('notify', (_, { title, body }) => {
  if (!Notification.isSupported() || !title) return;
  const n = new Notification({ title: String(title).slice(0, 80), body: String(body || '').slice(0, 160), icon: path.join(__dirname, 'assets', 'logo.png'), silent: false });
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
  if (win && !win.isDestroyed()) win.webContents.send('performance-mode', config.performance);
});

ipcMain.on('app:toggle-devtools', () => {
  if (!win || win.isDestroyed()) return;
  win.webContents.toggleDevTools();
});

const REPO_API = 'https://api.github.com/repos/Neukluziy/animeon-desktop/releases/latest';

function compareVersions(a, b) {
  const p = (s) => String(s).split('.').map((x) => parseInt(x, 10) || 0);
  const [pa, pb] = [p(a), p(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

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
    icon: path.join(__dirname, 'assets', 'logo.png'),
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
    icon: path.join(__dirname, 'assets', 'logo.ico'),
    title: 'Обновление AnimeOn',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  updateWindow.setMenuBarVisibility(false);
  updateWindow.loadFile('update.html');
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

function updProgress(pct, stage) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send('upd:progress', { pct, stage });
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
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      ws.write(Buffer.from(value));
      received += value.length;
      const pct = total ? Math.floor((received / total) * 100) : Math.min(95, Math.floor(received / 1048576));
      if (pct !== lastPct) {
        lastPct = pct;
        updProgress(Math.min(pct, 100), 'download');
      }
    }
    await new Promise((r) => ws.end(r));
    downloadedInstaller = dest;
    updProgress(100, 'ready');
    return { ok: true };
  } catch (err) {
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

ipcMain.on('taskbar-progress', (_, value) => {
  if (!win || win.isDestroyed()) return;
  const n = Number(value);
  if (n < 0) win.setProgressBar(-1);
  else if (n >= 1) win.setProgressBar(1);
  else win.setProgressBar(Math.max(0, Math.min(1, n)), { mode: 'normal' });
});

ipcMain.on('app:info', (e) => {
  e.returnValue = { version: app.getVersion() };
});

app.whenReady().then(() => {
  saveConfig();
  createWindow();
  ensureTray();
  if (process.argv.includes('--settings')) setTimeout(() => win?.webContents.send('open-settings'), 900);
  if (process.argv.includes('--reload')) setTimeout(() => win?.webContents.send('restart-webview'), 1200);
  globalShortcut.register('Control+Alt+A', () => showMainWindow());
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  saveWindowState();
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => app.quit());
