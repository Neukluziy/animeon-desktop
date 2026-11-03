const { createPowerManager } = require('./power');

function registerAppLifecycle({
  app,
  BrowserWindow,
  config,
  accessKeyManager,
  registerProtocol,
  configureSitePermissions,
  configureWindowSitePermissions,
  mainWindowId,
  createWindow,
  getWindow,
  ensureTray,
  powerMonitor,
  togglePlayback,
  getMediaState,
  applyDiscordRpcRuntime,
  startBackgroundChecks,
  registerGlobalHotkeys,
  handleStartupDeepLink,
  getStartupBackgroundCheckDelay,
  getSettingsOpenDelay,
  processArgv,
  markStartup,
  saveConfig,
  saveWindowState,
  getWindowId,
  flushPlaybackPositions,
  flushConfig,
  setQuitting,
  unregisterGlobalHotkeys,
  disconnectDiscordRuntime,
  dialog,
  writeLog,
}) {
  app.whenReady().then(async () => {
    markStartup('app-ready');
    registerProtocol();
    let accessKeyInitializationError;
    const accessKeyInitialization = accessKeyManager.initialize().catch((error) => {
      accessKeyInitializationError = error;
    });
    markStartup('access-key-initialize-started');
    if (!config.startupPolicyFixed) {
      config.autostart = false;
      config.startupPolicyFixed = true;
      try {
        app.setLoginItemSettings({ openAtLogin: false });
      } catch (error) {
        writeLog('warn', 'Could not disable startup registration', { error: String(error?.message || error) });
      }
      saveConfig();
    }
    configureSitePermissions();
    configureWindowSitePermissions(mainWindowId);
    createWindow({ windowId: mainWindowId });
    markStartup('window-created');
    getWindow()?.webContents.once('did-finish-load', () => markStartup('renderer-ready'));
    for (const windowId of Object.keys(config.windowStates)) {
      if (windowId !== mainWindowId) {
        configureWindowSitePermissions(windowId);
        createWindow({ windowId });
      }
    }
    ensureTray();
    await accessKeyInitialization;
    if (accessKeyInitializationError) throw accessKeyInitializationError;
    markStartup('access-key-ready');

    const powerManager = createPowerManager({
      powerMonitor,
      togglePlayback,
      getMediaState,
      writeLog,
    });
    powerManager.registerSystemEvents();

    applyDiscordRpcRuntime();
    process.on('uncaughtException', (error) => writeLog('error', 'uncaughtException', { error: String(error?.stack || error) }));
    process.on('unhandledRejection', (error) => writeLog('error', 'unhandledRejection', { error: String(error?.stack || error) }));
    startBackgroundChecks(getStartupBackgroundCheckDelay());

    if (processArgv.includes('--settings')) setTimeout(() => getWindow()?.webContents.send('open-settings'), getSettingsOpenDelay());
    if (processArgv.includes('--reload')) setTimeout(() => getWindow()?.webContents.send('restart-webview'), 1200);
    registerGlobalHotkeys();
    handleStartupDeepLink(processArgv);
  }).catch((error) => {
    console.error('[AnimeOn] Не удалось безопасно запустить приложение:', error);
    dialog.showErrorBox('AnimeOn не запущен', `Не удалось проверить защиту доступа и cookies аккаунта.\n\n${String(error?.message || error)}`);
    app.quit();
  });

  app.on('will-quit', () => {
    unregisterGlobalHotkeys();
    disconnectDiscordRuntime();
  });

  let quitAfterConfigFlush = false;
  app.on('before-quit', (event) => {
    setQuitting(true);
    if (quitAfterConfigFlush) return;
    event.preventDefault();
    const windowWrites = [];
    for (const browserWindow of BrowserWindow.getAllWindows()) {
      const windowId = getWindowId(browserWindow);
      if (!windowId) continue;
      const write = saveWindowState(windowId, browserWindow);
      if (write) windowWrites.push(write);
    }
    Promise.all(windowWrites)
      .then(() => {
        flushPlaybackPositions();
        return flushConfig();
      })
      .catch((error) => {
        process.stderr.write(`[AnimeOn] Failed to flush app data before exit: ${String(error?.stack || error)}\n`);
        dialog.showErrorBox('Не удалось сохранить данные', `Настройки могли сохраниться не полностью.\n\n${String(error?.message || error)}`);
      })
      .finally(() => {
        quitAfterConfigFlush = true;
        app.quit();
      });
  });

  app.on('window-all-closed', () => app.quit());
}

module.exports = { registerAppLifecycle };
