function registerConfigIpc({
  ipcMain,
  config,
  configDefaults,
  protectedFields,
  getWindowContext,
  isTrustedAppEvent,
  sanitizeConfigPatch,
  saveConfig,
  applySideEffects,
}) {
  ipcMain.on('cfg:get', (event) => {
    const context = getWindowContext(event);
    if (!context) {
      event.returnValue = null;
      return;
    }
    const snapshot = { ...config };
    delete snapshot.windowStates;
    snapshot.activeAccountId = context.accountId;
    snapshot.tabs = context.tabs;
    snapshot.activeTab = context.activeTab;
    event.returnValue = snapshot;
  });

  ipcMain.on('cfg:set', (event, patch) => {
    if (!isTrustedAppEvent(event) || !patch || typeof patch !== 'object' || Array.isArray(patch)) return;
    const safePatch = sanitizeConfigPatch(patch, config, configDefaults, protectedFields);
    Object.assign(config, safePatch);
    saveConfig();
    applySideEffects(safePatch);
  });
}

module.exports = { registerConfigIpc };
