function registerWindowIpc({ ipcMain, BrowserWindow, isTrustedAppEvent, config, saveConfig, applySideEffects }) {
  ipcMain.on('win:minimize', (event) => {
    if (!isTrustedAppEvent(event)) return;
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on('win:maximize-toggle', (event) => {
    if (!isTrustedAppEvent(event)) return;
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (browserWindow) browserWindow.isMaximized() ? browserWindow.unmaximize() : browserWindow.maximize();
  });
  ipcMain.on('win:close', (event) => {
    if (isTrustedAppEvent(event)) BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.on('win:fullscreen', (event) => {
    if (!isTrustedAppEvent(event)) return;
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (browserWindow) browserWindow.setFullScreen(!browserWindow.isFullScreen());
  });
  ipcMain.handle('window:set-title', (event, value) => {
    if (!isTrustedAppEvent(event)) return { ok: false, error: 'untrusted sender' };
    const title = String(value || 'AnimeOn').replace(/[\r\n]/g, ' ').trim().slice(0, 120) || 'AnimeOn';
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow || browserWindow.isDestroyed()) return { ok: false, error: 'window unavailable' };
    browserWindow.setTitle(title);
    return { ok: true };
  });
  ipcMain.handle('window:set-material', (event, enabled) => {
    if (!isTrustedAppEvent(event)) return { ok: false, error: 'untrusted sender' };
    if (typeof enabled !== 'boolean') return { ok: false, error: 'invalid material setting' };
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (!browserWindow || browserWindow.isDestroyed()) return { ok: false, error: 'window unavailable' };
    config.glassWindow = enabled;
    try {
      const material = enabled && process.platform === 'win32' && !config.lowPower ? 'acrylic' : 'none';
      browserWindow.setBackgroundColor(material === 'none' ? '#0a0a0a' : '#00000000');
      browserWindow.setBackgroundMaterial(material);
      applySideEffects({ glassWindow: true });
    } catch (error) {
      config.glassWindow = false;
      applySideEffects({ glassWindow: true });
      saveConfig();
      return { ok: false, error: String(error?.message || error) };
    }
    saveConfig();
    return { ok: true, enabled: enabled && process.platform === 'win32' && !config.lowPower, requested: enabled };
  });
}

module.exports = { registerWindowIpc };
