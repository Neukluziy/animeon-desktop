function registerAppUtilityIpc({
  ipcMain,
  app,
  clipboard,
  config,
  shell,
  isTrustedAppEvent,
  writeLog,
  saveConfig,
  applySideEffects,
  applyDiscordRpcRuntime,
  discordDefaults,
  safeAsync,
}) {
  ipcMain.handle('clipboard:write-text', (event, text) => {
    if (!isTrustedAppEvent(event) || typeof text !== 'string' || text.length > 1000) {
      return { ok: false, error: 'Не удалось скопировать цвет' };
    }
    try {
      clipboard.writeText(text);
      return { ok: true };
    } catch (error) {
      writeLog('error', 'Clipboard write failed', { error: String(error?.message || error) });
      return { ok: false, error: 'Не удалось скопировать цвет' };
    }
  });

  ipcMain.handle('discord:settings:set', (_, patch) => {
    if (!patch || typeof patch !== 'object') return { ok: false, error: 'invalid settings' };
    config.discordRpc = { ...discordDefaults, ...config.discordRpc };
    for (const key of Object.keys(discordDefaults)) {
      if (typeof patch[key] === 'boolean') config.discordRpc[key] = patch[key];
    }
    saveConfig();
    applyDiscordRpcRuntime();
    return { ok: true, settings: config.discordRpc };
  });

  ipcMain.on('open-external', (event, value) => {
    if (!isTrustedAppEvent(event)) return;
    try {
      const url = new URL(String(value || ''));
      if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'tg:') shell.openExternal(url.href);
    } catch { void 0; }
  });

  ipcMain.on('app:open-data-folder', () => {
    safeAsync(() => shell.openPath(app.getPath('userData')), writeLog, 'Could not open the application data folder');
  });

  ipcMain.handle('dnd:set', (event, enabled) => {
    if (!isTrustedAppEvent(event)) return { ok: false, error: 'untrusted sender' };
    if (typeof enabled !== 'boolean') return { ok: false, error: 'invalid DND setting' };
    config.doNotDisturb = enabled;
    saveConfig();
    applySideEffects({ doNotDisturb: true });
    return { ok: true, enabled };
  });
}

module.exports = { registerAppUtilityIpc };
