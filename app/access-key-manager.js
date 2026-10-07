const {
  createAccessKeyRecord,
  readAccessKeyFile,
  verifyAccessKeyRecord,
  verifyStoredAccessKey,
  writeAccessKeyFile,
} = require('./access-key');

function createAccessKeyManager({
  app,
  fs,
  ipcMain,
  path,
  session,
  accessKeyPath,
  config,
  sitePattern,
  isTrustedAppEvent,
  saveConfig,
  getWindow,
  setQuitting,
}) {
  let accessUnlocked = !config.accessKeyEnabled;
  let recoveryNotice = false;
  let recoveryTask = null;
  let failures = 0;
  let lockedUntil = 0;

  async function clearAccountCookies() {
    const sessions = new Set([session.defaultSession, session.fromPartition('persist:animeon')]);
    await Promise.all([...sessions].map((siteSession) => siteSession.clearStorageData({ storages: ['cookies'] })));
  }

  async function recoverMissingAccessKey() {
    if (!config.accessKeyEnabled || fs.existsSync(accessKeyPath)) return false;
    if (recoveryTask) return recoveryTask;
    recoveryTask = (async () => {
      await clearAccountCookies();
      config.accessKeyEnabled = false;
      accessUnlocked = true;
      recoveryNotice = true;
      saveConfig();
      getWindow()?.webContents.send('access-key:removed');
      return true;
    })();
    try {
      return await recoveryTask;
    } finally {
      recoveryTask = null;
    }
  }

  function watchAccessKeyFile() {
    try {
      const watcher = fs.watch(path.dirname(accessKeyPath), (_event, filename) => {
        if (filename && String(filename) !== path.basename(accessKeyPath)) return;
        setTimeout(() => {
          recoverMissingAccessKey().catch((error) => {
            console.error('[AnimeOn] Не удалось очистить cookies после удаления ключа доступа:', error);
          });
        }, 50);
      });
      watcher.on('error', (error) => console.error('[AnimeOn] Не удалось отслеживать файл ключа доступа:', error));
    } catch (error) {
      console.error('[AnimeOn] Не удалось отслеживать файл ключа доступа:', error);
    }
  }

  function registerIpc() {
    ipcMain.handle('access-key:status', async (event) => {
      if (!isTrustedAppEvent(event)) return { ok: false, error: 'Недоверенный источник запроса' };
      try {
        await recoverMissingAccessKey();
        const enabled = config.accessKeyEnabled;
        let type = null;
        let error = '';
        if (enabled) {
          try { type = readAccessKeyFile(accessKeyPath).type; }
          catch (readError) { error = String(readError?.message || readError); }
        }
        const recoveredMissingKey = recoveryNotice;
        recoveryNotice = false;
        return { ok: true, enabled, type, error, promptDismissed: config.accessKeyPromptDismissed, recoveredMissingKey };
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    });

    ipcMain.handle('access-key:prompt-setting', (event, dismissed) => {
      if (!isTrustedAppEvent(event) || typeof dismissed !== 'boolean') return { ok: false, error: 'Некорректная настройка' };
      config.accessKeyPromptDismissed = dismissed;
      saveConfig();
      return { ok: true, dismissed };
    });

    ipcMain.handle('access-key:set', async (event, type, value, currentValue) => {
      if (!isTrustedAppEvent(event)) return { ok: false, error: 'Недоверенный источник запроса' };
      if (!accessUnlocked) return { ok: false, error: 'Сначала разблокируйте приложение' };
      try {
        if (config.accessKeyEnabled && !await verifyStoredAccessKey(accessKeyPath, currentValue)) {
          return { ok: false, error: 'Введи установленный ключ доступа, чтобы изменить его' };
        }
        const record = await createAccessKeyRecord(type, value);
        writeAccessKeyFile(accessKeyPath, record);
        config.accessKeyEnabled = true;
        saveConfig();
        accessUnlocked = true;
        return { ok: true, type: record.type };
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    });

    ipcMain.handle('access-key:verify', async (event, value) => {
      if (!isTrustedAppEvent(event)) return { ok: false, error: 'Недоверенный источник запроса' };
      if (!config.accessKeyEnabled) { accessUnlocked = true; return { ok: true }; }
      const retryAfterMs = Math.max(0, lockedUntil - Date.now());
      if (retryAfterMs) return { ok: false, retryAfterMs, error: `Подождите ${Math.ceil(retryAfterMs / 1000)} сек. перед следующей попыткой` };
      try {
        if (!fs.existsSync(accessKeyPath)) {
          await recoverMissingAccessKey();
          return { ok: false, missing: true, error: 'Файл ключа не найден. Cookies аккаунта удалены.' };
        }
        const record = readAccessKeyFile(accessKeyPath);
        if (!await verifyAccessKeyRecord(record, value)) {
          failures += 1;
          if (failures >= 5) {
            failures = 0;
            lockedUntil = Date.now() + 30000;
            return { ok: false, retryAfterMs: 30000, error: 'Слишком много попыток. Подождите 30 секунд.' };
          }
          return { ok: false, error: 'Неверный ключ доступа' };
        }
        failures = 0;
        lockedUntil = 0;
        accessUnlocked = true;
        return { ok: true, type: record.type };
      } catch (error) {
        return { ok: false, error: String(error?.message || error) };
      }
    });

    ipcMain.handle('access-key:remove', async (event, currentValue) => {
      if (!isTrustedAppEvent(event)) return { ok: false, error: 'Недоверенный источник запроса' };
      if (!accessUnlocked) return { ok: false, error: 'Сначала разблокируйте приложение' };
      try {
        if (!config.accessKeyEnabled || !await verifyStoredAccessKey(accessKeyPath, currentValue)) {
          return { ok: false, error: 'Введи установленный ключ доступа, чтобы удалить его' };
        }
        config.accessKeyEnabled = false;
        if (fs.existsSync(accessKeyPath)) fs.unlinkSync(accessKeyPath);
        saveConfig();
        return { ok: true };
      } catch (error) {
        config.accessKeyEnabled = true;
        return { ok: false, error: String(error?.message || error) };
      }
    });

    ipcMain.handle('access-key:exit', (event) => {
      if (!isTrustedAppEvent(event)) return { ok: false, error: 'Недоверенный источник запроса' };
      setQuitting(true);
      app.quit();
      return { ok: true };
    });
  }

  async function initialize() {
    if (fs.existsSync(accessKeyPath) && !config.accessKeyEnabled) {
      config.accessKeyEnabled = true;
      accessUnlocked = false;
      saveConfig();
    }
    await recoverMissingAccessKey();
    fs.mkdirSync(path.dirname(accessKeyPath), { recursive: true });
    watchAccessKeyFile();
    const guardedSessions = new Set([session.defaultSession, session.fromPartition('persist:animeon')]);
    for (const siteSession of guardedSessions) {
      siteSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
        let isProtectedSite = false;
        try { isProtectedSite = sitePattern.test(details.url); } catch {}
        callback({ cancel: config.accessKeyEnabled && !accessUnlocked && isProtectedSite });
      });
    }
  }

  return { initialize, recoverMissingAccessKey, registerIpc };
}

module.exports = { createAccessKeyManager };
