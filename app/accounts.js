function createAccountManager({
  ipcMain,
  session,
  webContents,
  BrowserWindow,
  config,
  sitePattern,
  mainWindowId,
  accountPartition,
  createAccount,
  getWindowContext,
  getWindowId,
  clearWindowSiteContents,
  activateSiteContents,
  accessKeyManager,
  applyNetworkSettings,
  saveConfig,
  writeLog,
}) {
  const configuredPermissionSessions = new WeakSet();

  function configureSitePermissions(siteSession) {
    if (!siteSession || configuredPermissionSessions.has(siteSession)) return;
    configuredPermissionSessions.add(siteSession);
    const allowedPermissions = new Set(['notifications', 'fullscreen']);
    const isTrustedSiteContents = (contents) => {
      try {
        return sitePattern.test(contents.getURL());
      } catch {
        return false;
      }
    };
    siteSession.setPermissionRequestHandler((contents, permission, callback) => {
      callback(isTrustedSiteContents(contents) && allowedPermissions.has(permission));
    });
    siteSession.setPermissionCheckHandler((contents, permission) => {
      return !!contents && isTrustedSiteContents(contents) && allowedPermissions.has(permission);
    });
  }

  function configureWindowSitePermissions(windowId) {
    const accountId = config.windowStates?.[windowId]?.accountId
      || (windowId === mainWindowId ? config.activeAccountId : 'default');
    const account = config.accounts.find((item) => item.id === accountId);
    configureSitePermissions(session.fromPartition(account?.partition || 'persist:animeon'));
  }

  function registerIpc() {
    ipcMain.handle('accounts:list', (event) => {
      const context = getWindowContext(event);
      if (!context) return { ok: false, error: 'untrusted sender' };
      return {
        ok: true,
        activeAccountId: context.accountId,
        accounts: config.accounts.map(({ id, name }) => ({ id, name })),
      };
    });

    ipcMain.handle('accounts:add', async (event, name) => {
      const context = getWindowContext(event);
      if (!context) return { ok: false, error: 'untrusted sender' };
      const account = createAccount(name);
      if (!account) return { ok: false, error: 'Укажи название аккаунта' };
      const previousActiveId = context.accountId;
      config.accounts.push(account);
      context.accountId = account.id;
      if (context === config.windowStates[mainWindowId]) config.activeAccountId = account.id;
      const accountSession = session.fromPartition(account.partition);
      configureSitePermissions(accountSession);
      accessKeyManager.guardSession(accountSession);
      try {
        await applyNetworkSettings([accountSession]);
      } catch (error) {
        config.accounts.pop();
        context.accountId = previousActiveId;
        if (context === config.windowStates[mainWindowId]) config.activeAccountId = previousActiveId;
        writeLog('error', 'Failed to initialize account network settings', { error: String(error?.message || error) });
        return { ok: false, error: 'Не удалось применить сетевые настройки к аккаунту' };
      }
      clearWindowSiteContents(event);
      saveConfig();
      return { ok: true, account };
    });

    ipcMain.handle('accounts:activate', async (event, id) => {
      const context = getWindowContext(event);
      if (!context) return { ok: false, error: 'untrusted sender' };
      const account = config.accounts.find((item) => item.id === String(id || ''));
      if (!account) return { ok: false, error: 'Аккаунт не найден' };
      const accountSession = session.fromPartition(accountPartition(account.id));
      configureSitePermissions(accountSession);
      accessKeyManager.guardSession(accountSession);
      try {
        await applyNetworkSettings([accountSession]);
      } catch (error) {
        writeLog('error', 'Failed to apply network settings to account', { error: String(error?.message || error) });
        return { ok: false, error: 'Не удалось применить сетевые настройки к аккаунту' };
      }
      context.accountId = account.id;
      if (context === config.windowStates[mainWindowId]) config.activeAccountId = account.id;
      clearWindowSiteContents(event);
      saveConfig();
      return { ok: true, activeAccountId: account.id };
    });

    ipcMain.handle('accounts:delete', async (event, id) => {
      if (!getWindowContext(event)) return { ok: false, error: 'untrusted sender' };
      const accountId = String(id || '');
      if (Object.values(config.windowStates).some((state) => state.accountId === accountId)) {
        return { ok: false, error: 'Сначала переключите с этого аккаунта все открытые окна' };
      }
      if (config.accounts.length <= 1) return { ok: false, error: 'Нельзя удалить последний аккаунт' };
      const index = config.accounts.findIndex((item) => item.id === accountId);
      if (index < 0) return { ok: false, error: 'Аккаунт не найден' };
      try {
        const accountSession = session.fromPartition(accountPartition(accountId));
        await accountSession.clearStorageData();
        await accountSession.clearCache();
        config.accounts.splice(index, 1);
        saveConfig();
        return { ok: true };
      } catch (error) {
        writeLog('error', 'Account session cleanup failed', { error: String(error?.message || error) });
        return { ok: false, error: 'Не удалось очистить данные аккаунта' };
      }
    });

    ipcMain.on('site:activate-webview', (event, id) => {
      const context = getWindowContext(event);
      if (!context) return;
      const contentsId = Number(id);
      if (!Number.isInteger(contentsId) || contentsId < 1) return;
      const guest = webContents.fromId(contentsId);
      if (!guest || guest.isDestroyed() || guest.hostWebContents !== event.sender) return;
      try {
        if (guest.session.getPartition() !== accountPartition(context.accountId)) return;
        const url = guest.getURL();
        if (url && !sitePattern.test(url)) return;
      } catch {
        return;
      }
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const windowId = getWindowId(browserWindow);
      if (!windowId) return;
      activateSiteContents(windowId, guest, browserWindow);
    });
  }

  return { configureSitePermissions, configureWindowSitePermissions, registerIpc };
}

module.exports = { createAccountManager };
