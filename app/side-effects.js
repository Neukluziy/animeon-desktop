function createSideEffectManager({
  app,
  BrowserWindow,
  config,
  isAppWindow,
  getTrayController,
  ensureTray,
  registerGlobalHotkeys,
  writeLog,
}) {
  function applySideEffects(patch) {
    if ('autostart' in patch) {
      try {
        app.setLoginItemSettings({ openAtLogin: !!config.autostart, path: process.execPath, args: [] });
      } catch (error) {
        writeLog('warn', 'Could not update startup settings', { error: String(error?.message || error) });
      }
    }
    if ('tray' in patch) ensureTray();
    if ('alwaysOnTop' in patch) {
      for (const browserWindow of BrowserWindow.getAllWindows()) {
        if (isAppWindow(browserWindow) && !browserWindow.isDestroyed()) browserWindow.setAlwaysOnTop(!!config.alwaysOnTop);
      }
    }
    if ('lowPower' in patch || 'glassWindow' in patch) {
      const material = process.platform === 'win32' && config.glassWindow && !config.lowPower ? 'acrylic' : 'none';
      for (const browserWindow of BrowserWindow.getAllWindows()) {
        if (!isAppWindow(browserWindow) || browserWindow.isDestroyed()) continue;
        try {
          browserWindow.setBackgroundColor(material === 'none' ? '#0a0a0a' : '#00000000');
          browserWindow.setBackgroundMaterial(material);
        } catch (error) {
          writeLog('warn', 'Could not update window background material', { error: String(error?.message || error) });
        }
      }
    }
    if ('doNotDisturb' in patch) getTrayController()?.refreshPresentation();
    if ('hotkeys' in patch) registerGlobalHotkeys();
  }

  return { applySideEffects };
}

module.exports = { createSideEffectManager };
