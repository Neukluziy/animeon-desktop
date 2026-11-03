function createTrayController({
  Tray,
  BrowserWindow,
  screen,
  nativeImage,
  shell,
  path,
  appDir,
  getWindow,
  showMainWindow,
  getConfig,
  getSiteContents,
  mediaAction,
  quit,
}) {
  let tray = null;
  let trayMenuWindow = null;
  const status = { playing: false, title: '', updateAvailable: false };

  function updatePresentation() {
    if (!tray || tray.isDestroyed()) return;
    const config = getConfig();
    const labels = ['AnimeOn'];
    if (status.playing) labels.push(status.title ? status.title.slice(0, 55) : 'Воспроизведение');
    if (config.doNotDisturb) labels.push('Не беспокоить');
    if (status.updateAvailable) labels.push('Доступно обновление');
    tray.setToolTip(labels.join(' · '));
  }

  function ensureTray() {
    if (tray) return;
    const logoPath = path.join(appDir, '../assets', 'logo.png');
    const iconPath = path.join(appDir, '../assets', 'logo.ico');
    let logo = nativeImage.createFromPath(logoPath);
    if (logo.isEmpty()) logo = nativeImage.createFromPath(iconPath);
    if (logo.isEmpty()) throw new Error(`Unable to load tray icon from ${logoPath} or ${iconPath}`);
    const { width, height } = logo.getSize();
    if (width <= 0 || height <= 0) throw new Error(`Tray icon has invalid dimensions: ${width}x${height}`);
    const insetX = Math.round(width * 0.15);
    const insetY = Math.round(height * 0.15);
    const trayIcon = logo
      .crop({
        x: insetX,
        y: insetY,
        width: width - insetX * 2,
        height: height - insetY * 2,
      })
      .resize({ width: 32, height: 32 });
    tray = new Tray(trayIcon);
    updatePresentation();
    tray.on('click', toggleTrayMenu);
    tray.on('double-click', showMainWindow);
    tray.on('right-click', toggleTrayMenu);
  }

  function setPlaybackState({ playing = false, title = '' } = {}) {
    status.playing = !!playing;
    status.title = String(title || '').slice(0, 70);
    updatePresentation();
  }

  function setUpdateAvailable(available) {
    status.updateAvailable = !!available;
    updatePresentation();
  }

  function refreshPresentation() {
    updatePresentation();
  }

  function toggleTrayMenu() {
    if (trayMenuWindow && trayMenuWindow.isVisible()) {
      trayMenuWindow.hide();
      return;
    }
    const width = 220;
    const height = 158;
    const cursor = screen.getCursorScreenPoint();
    const trayBounds = tray && !tray.isDestroyed() ? tray.getBounds() : null;
    const anchor =
      trayBounds && trayBounds.width > 0 && trayBounds.height > 0
        ? {
            x: Math.round(trayBounds.x + trayBounds.width / 2),
            y: Math.round(trayBounds.y + trayBounds.height / 2),
            bottom: Math.round(trayBounds.y + trayBounds.height),
          }
        : { x: cursor.x, y: cursor.y, bottom: cursor.y };
    const workArea = screen.getDisplayNearestPoint({ x: anchor.x, y: anchor.y }).workArea;
    const centeredX = Math.round(anchor.x - width / 2);
    const aboveY = Math.round(anchor.y - height - 8);
    const belowY = Math.round(anchor.bottom + 8);
    const x = Math.max(workArea.x + 4, Math.min(centeredX, workArea.x + workArea.width - width - 4));
    const y = aboveY >= workArea.y + 4 ? aboveY : Math.min(belowY, workArea.y + workArea.height - height - 4);
    trayMenuWindow = new BrowserWindow({
      width,
      height,
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
        preload: path.join(appDir, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    trayMenuWindow.setAlwaysOnTop(true, 'screen-saver');
    trayMenuWindow.loadFile(path.join(appDir, '../windows/tray.html'));
    trayMenuWindow.once('ready-to-show', () => {
      trayMenuWindow.show();
      trayMenuWindow.focus();
    });
    trayMenuWindow.on('blur', () => {
      if (trayMenuWindow) trayMenuWindow.hide();
    });
  }

  function handleAction(action) {
    if (trayMenuWindow && !trayMenuWindow.isDestroyed()) trayMenuWindow.hide();
    const win = getWindow();
    if (action === 'open') showMainWindow();
    if (action === 'hide') win?.hide();
    if (action === 'settings' && win) {
      showMainWindow();
      win.webContents.send('open-settings');
    }
    if (action === 'menu') toggleTrayMenu();
    if (action === 'menu-reload') {
      const contents = getSiteContents();
      if (contents && !contents.isDestroyed()) contents.reload();
    }
    if (action === 'visit-site') {
      const siteUrl = getConfig().siteList?.[0]?.url || 'https://animeon.cc';
      shell.openExternal(siteUrl);
    }
    if (action === 'playpause') mediaAction('playpause');
    if (action === 'next') mediaAction('next');
    if (action === 'previous') mediaAction('previous');
    if (action === 'quit') quit();
  }

  return { ensureTray, getTray: () => tray, handleAction, toggleTrayMenu, setPlaybackState, setUpdateAvailable, refreshPresentation };
}

module.exports = { createTrayController };
