function registerWindowLifecycle({
  app,
  ipcMain,
  BrowserWindow,
  config,
  windowIdsByBrowserId,
  windowSiteContents,
  getWindowContext,
  getWindowId,
  setWindow,
  setActiveSiteContents,
  createWindow,
  saveConfig,
  mainWindowId,
  maxWindows,
  createId,
}) {
  app.on('browser-window-focus', (_event, focusedWindow) => {
    const focusedId = getWindowId(focusedWindow);
    if (!focusedId) return;
    setWindow(focusedWindow);
    const guest = windowSiteContents.get(focusedId);
    setActiveSiteContents(guest && !guest.isDestroyed() ? guest : null);
  });

  app.on('activate', () => {
    if (!BrowserWindow.getAllWindows().some((window) => windowIdsByBrowserId.has(window.id))) {
      createWindow({ windowId: mainWindowId, initializeNetwork: true });
    }
  });

  ipcMain.handle('win:new', (event) => {
    const source = getWindowContext(event);
    if (!source) return { ok: false, error: 'untrusted sender' };
    if (Object.keys(config.windowStates).length >= maxWindows) {
      return { ok: false, error: `Можно открыть не более ${maxWindows} окон` };
    }
    const id = createId();
    const currentTab = source.tabs[source.activeTab] || source.tabs[0];
    config.windowStates[id] = {
      accountId: source.accountId,
      tabs: currentTab ? [{ ...currentTab }] : [],
      activeTab: 0,
    };
    saveConfig();
    try {
      createWindow({ windowId: id });
      return { ok: true, windowId: id };
    } catch (error) {
      delete config.windowStates[id];
      saveConfig();
      return { ok: false, error: String(error?.message || 'Не удалось создать окно') };
    }
  });
}

module.exports = { registerWindowLifecycle };
