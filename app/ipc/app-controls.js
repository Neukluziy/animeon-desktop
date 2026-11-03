function registerAppControlIpc({
  ipcMain,
  BrowserWindow,
  config,
  appVersion,
  constants,
  getWindow,
  getWindowId,
  isTrustedAppEvent,
  getSiteContents,
  getWindowSiteContents,
  getAccountSessions,
  windowSiteContents,
  windowIdsByBrowserId,
  approvedCloseWindows,
  saveConfig,
  setTaskbarOverlay,
  setAlwaysOnTop,
  registerGlobalHotkeys,
  isSiteUrl,
  shell,
  safeAsync,
  writeLog,
}) {
  ipcMain.handle('app:clear-cache', async () => {
    try {
      const sessions = getAccountSessions();
      await Promise.all(sessions.map(async (siteSession) => {
        await siteSession.clearCache();
        await siteSession.clearStorageData({ storages: ['serviceworkers', 'shadercache'] });
      }));
      const browserWindow = getWindow();
      if (browserWindow && !browserWindow.isDestroyed()) {
        safeAsync(
          () => browserWindow.webContents.session.clearCache(),
          writeLog,
          'Could not clear the application session cache',
        );
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  });

  ipcMain.on('app:restart-webview', (event) => {
    if (!isTrustedAppEvent(event)) return;
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow || browserWindow.isDestroyed()) return;
    browserWindow.webContents.send('restart-webview');
    setTaskbarOverlay('none');
  });

  ipcMain.on('app:taskbar-overlay', (_, kind) => setTaskbarOverlay(kind));
  ipcMain.on('app:confirm-close-result', (event, ok) => {
    if (!isTrustedAppEvent(event) || !ok) return;
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow || browserWindow.isDestroyed()) return;
    const windowId = getWindowId(browserWindow);
    if (!windowId) return;
    approvedCloseWindows.add(windowId);
    browserWindow.close();
  });

  ipcMain.on('app:set-performance', (event, mode) => {
    if (!isTrustedAppEvent(event)) return;
    config.performance = ['performance', 'balanced', 'economy'].includes(mode) ? mode : 'balanced';
    saveConfig();
    for (const siteContents of windowSiteContents.values()) {
      try {
        if (siteContents && !siteContents.isDestroyed()) {
          siteContents.setBackgroundThrottling(config.memorySaver || config.performance !== 'performance');
        }
      } catch (error) {
        writeLog('debug', 'Could not update site background throttling', { error: String(error?.message || error) });
      }
    }
  });

  ipcMain.on('site:navigate', (event, url) => {
    const siteContents = getWindowSiteContents(event);
    if (!siteContents || !isSiteUrl(String(url))) return;
    try {
      siteContents.loadURL(String(url));
    } catch (error) {
      writeLog('warn', 'Could not navigate to the requested URL', { error: String(error?.message || error) });
    }
  });

  ipcMain.on('app:open-browser', (event) => {
    try {
      const siteContents = getWindowSiteContents(event);
      if (siteContents) safeAsync(() => shell.openExternal(siteContents.getURL()), writeLog, 'Could not open site in browser');
    } catch (error) {
      writeLog('warn', 'Could not open site in the system browser', { error: String(error?.message || error) });
    }
  });

  ipcMain.on('app:always-on-top', setAlwaysOnTop);
  ipcMain.on('app:zoom', (event, delta) => {
    const siteContents = getWindowSiteContents(event);
    if (!siteContents) return;
    const amount = Number(delta) || 0;
    const current = siteContents.getZoomFactor();
    siteContents.setZoomFactor(amount === 0 ? 1 : Math.max(0.5, Math.min(3, current + amount)));
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

  ipcMain.on('app:toggle-devtools', (event) => {
    const contents = getWindowSiteContents(event);
    if (!contents || contents.isDestroyed()) return;
    try {
      if (contents.isDevToolsOpened()) {
        contents.closeDevTools();
        return;
      }
      setTimeout(() => {
        try {
          if (!contents.isDestroyed() && !contents.isDevToolsOpened()) {
            contents.openDevTools({ mode: 'detach', activate: true });
          }
        } catch (error) {
          writeLog('debug', 'Could not open detached developer tools', { error: String(error?.message || error) });
          try {
            if (!contents.isDestroyed() && !contents.isDevToolsOpened()) {
              contents.openDevTools({ mode: 'right', activate: true });
            }
          } catch (fallbackError) {
            writeLog('warn', 'Could not open developer tools', { error: String(fallbackError?.message || fallbackError) });
          }
        }
      }, 80);
    } catch (error) {
      writeLog('warn', 'Could not schedule developer tools', { error: String(error?.message || error) });
    }
  });

  ipcMain.handle('site:apply-css', async (_, css) => {
    const siteContents = getSiteContents();
    if (!siteContents || siteContents.isDestroyed()) return { ok: false, error: 'страница ещё не загружена' };
    const value = typeof css === 'string' ? css.slice(0, 200000) : '';
    try {
      await siteContents.executeJavaScript(`(() => {
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
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  });

  ipcMain.on('taskbar-progress', (event, value) => {
    if (!isTrustedAppEvent(event)) return;
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow || browserWindow.isDestroyed()) return;
    const progress = Number(value);
    if (progress < 0) browserWindow.setProgressBar(-1);
    else if (progress >= 1) browserWindow.setProgressBar(1);
    else browserWindow.setProgressBar(Math.max(0, Math.min(1, progress)), { mode: 'normal' });
  });

  ipcMain.on('app:info', (event) => {
    event.returnValue = {
      version: appVersion,
      name: 'AnimeOn Desktop',
      electron: process.versions.electron,
      platform: process.platform,
      isPrimaryWindow: BrowserWindow.fromWebContents(event.sender) === getWindow(),
      constants,
    };
  });
}

module.exports = { registerAppControlIpc };
