function createWindowActions({
  BrowserWindow,
  config,
  getWindow,
  getSiteContents,
  isAppWindow,
  taskbarController,
  trayController,
  getMediaController,
  takeScreenshot,
  shell,
  saveConfig,
  writeLog,
}) {
  function showMainWindow() {
    const window = getWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  function ensureTray() {
    trayController.ensureTray();
  }

  function setTaskbarOverlay(kind = 'none') {
    taskbarController.setOverlay(kind);
  }

  function setupJumpList() {
    taskbarController.setupJumpList();
  }

  function toggleTrayMenu() {
    trayController.toggleTrayMenu();
  }

  function updateThumbar(state) {
    taskbarController.updateThumbar(state);
  }

  function toggleAlwaysOnTop() {
    const window = getWindow();
    if (!window || window.isDestroyed()) return;
    config.alwaysOnTop = !window.isAlwaysOnTop();
    for (const browserWindow of BrowserWindow.getAllWindows()) {
      if (isAppWindow(browserWindow) && !browserWindow.isDestroyed()) browserWindow.setAlwaysOnTop(config.alwaysOnTop);
    }
    saveConfig();
    for (const browserWindow of BrowserWindow.getAllWindows()) {
      if (isAppWindow(browserWindow) && !browserWindow.isDestroyed()) browserWindow.webContents.send('always-on-top', config.alwaysOnTop);
    }
  }

  function toggleTrayWindow() {
    const window = getWindow();
    if (!window) return;
    if (window.isVisible()) {
      if (config.tray) ensureTray();
      window.hide();
    } else {
      showMainWindow();
    }
  }

  function localHotkeyActions() {
    const mediaController = getMediaController();
    return {
      show: showMainWindow,
      toggleWindow: toggleTrayWindow,
      playPause: () => mediaController.togglePlayback(),
      volumeUp: () => mediaController.setVolume(1),
      volumeDown: () => mediaController.setVolume(-1),
      mute: () => mediaController.setMuted(null),
      seekBack: () => mediaController.seekVideo(-10),
      seekForward: () => mediaController.seekVideo(10),
      fullscreen: () => {
        const window = getWindow();
        if (window) window.setFullScreen(!window.isFullScreen());
      },
      settings: () => {
        showMainWindow();
        getWindow()?.webContents.send('open-settings');
      },
      reload: () => getSiteContents()?.reload(),
      screenshot: takeScreenshot,
      alwaysOnTop: toggleAlwaysOnTop,
      next: () => mediaController.mediaAction('next'),
      previous: () => mediaController.mediaAction('previous'),
      pip: () => togglePictureInPictureFromHotkey(),
      speedDown: () => stepPlaybackSpeedFromHotkey(-1),
      speedUp: () => stepPlaybackSpeedFromHotkey(1),
      trayMenu: toggleTrayMenu,
      command: () => {
        showMainWindow();
        getWindow()?.webContents.send('open-command-palette');
      },
      home: () => getWindow()?.webContents.send('go-home'),
      back: () => getSiteContents()?.goBack(),
      forward: () => getSiteContents()?.goForward(),
      zoomIn: () => {
        const siteContents = getSiteContents();
        if (siteContents) siteContents.setZoomFactor(Math.min(3, siteContents.getZoomFactor() + 0.1));
      },
      zoomOut: () => {
        const siteContents = getSiteContents();
        if (siteContents) siteContents.setZoomFactor(Math.max(0.5, siteContents.getZoomFactor() - 0.1));
      },
      zoomReset: () => getSiteContents()?.setZoomFactor(1),
      switchSite: () => getWindow()?.webContents.send('switch-site'),
      openBrowser: () => {
        const siteContents = getSiteContents();
        if (siteContents) return shell.openExternal(siteContents.getURL());
      },
    };
  }

  function stepPlaybackSpeedFromHotkey(direction) {
    getMediaController().stepPlaybackSpeed(direction).then((speed) => {
      for (const browserWindow of BrowserWindow.getAllWindows()) {
        if (!browserWindow.isDestroyed()) browserWindow.webContents.send('media:speed-changed', speed);
      }
    }).catch((error) => {
      writeLog('warn', 'Could not change playback speed from hotkey', { error: String(error?.message || error) });
    });
  }

  function togglePictureInPictureFromHotkey() {
    getMediaController().togglePictureInPicture().then((result) => {
      const message = result?.ok
        ? result.active ? 'Картинка в картинке включена' : 'Картинка в картинке выключена'
        : 'Картинка в картинке недоступна для этого видео';
      getWindow()?.webContents.send('toast', { message, type: result?.ok ? 'ok' : 'error' });
    }).catch((error) => {
      writeLog('warn', 'Could not toggle picture-in-picture from hotkey', { error: String(error?.message || error) });
      getWindow()?.webContents.send('toast', { message: 'Не удалось включить картинку в картинке', type: 'error' });
    });
  }

  return {
    ensureTray,
    localHotkeyActions,
    setTaskbarOverlay,
    setupJumpList,
    showMainWindow,
    toggleAlwaysOnTop,
    toggleTrayMenu,
    updateThumbar,
  };
}

module.exports = { createWindowActions };
