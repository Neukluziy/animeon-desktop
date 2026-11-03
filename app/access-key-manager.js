const {
  createAccessKeyRecord,
  readAccessKeyFile,
  verifyAccessKeyRecord,
  verifyStoredAccessKey,
  writeAccessKeyFile,
  removeAccessKeyMarker,
  accessKeyFileExists,
} = require('./access-key');
const { accountPartition } = require('../shared/accounts');

function createAccessKeyManager({
  app,
  fs,
  ipcMain,
  path,
  session,
  accessKeyPath,
  safeStorage,
  config,
  sitePattern,
  isTrustedAppEvent,
  saveConfig,
  writeLog,
  getWindow,
  setQuitting,
}) {
  let accessUnlocked = !config.accessKeyEnabled;
  let recoveryNotice = false;
  let recoveryTask = null;
  let failures = 0;
  let lockedUntil = 0;
  const guardedSessions = new WeakSet();

  function guardSession(siteSession) {
    if (!siteSession || guardedSessions.has(siteSession)) return;
    guardedSessions.add(siteSession);
    siteSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      let isProtectedSite = false;
      try { isProtectedSite = sitePattern.test(details.url); } catch (error) {
        writeLog('warn', 'Could not validate a protected site request', { error: String(error?.message || error) });
      }
      callback({ cancel: config.accessKeyEnabled && !accessUnlocked && isProtectedSite });
    });
  }

  async function clearAccountData() {
    const sessions = new Set([session.defaultSession, ...config.accounts.map((account) => session.fromPartition(accountPartition(account.id)))]);
    await Promise.all([...sessions].map((siteSession) => siteSession.clearStorageData()));
  }

  async function recoverMissingAccessKey() {
    if (!config.accessKeyEnabled || await accessKeyFileExists(accessKeyPath)) return false;
    if (recoveryTask) return recoveryTask;
    recoveryTask = (async () => {
      await clearAccountData();
      await removeAccessKeyMarker(accessKeyPath);
      config.accessKeyEnabled = false;
      config.accessKeyPromptDismissed = false;
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
            console.error('[AnimeOn] Не удалось очистить данные аккаунтов после удаления ключа доступа:', error);
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
          try { type = (await readAccessKeyFile(accessKeyPath, safeStorage)).type; }
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
        if (config.accessKeyEnabled && !await verifyStoredAccessKey(accessKeyPath, currentValue, safeStorage)) {
          return { ok: false, error: 'Введи установленный ключ доступа, чтобы изменить его' };
        }
        const record = await createAccessKeyRecord(type, value);
        await writeAccessKeyFile(accessKeyPath, record, safeStorage);
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
        if (!await accessKeyFileExists(accessKeyPath)) {
          await recoverMissingAccessKey();
          return { ok: false, missing: true, error: 'Файл ключа не найден. Данные аккаунтов очищены.' };
        }
        const record = await readAccessKeyFile(accessKeyPath, safeStorage);
        if (!await verifyAccessKeyRecord(record, value)) {
          failures += 1;
          if (failures >= 5) {
            failures = 0;
            lockedUntil = Date.now() + 30000;
          }
          await writeAccessKeyFile(accessKeyPath, { ...record, failedAttempts: failures, lockedUntil }, safeStorage);
          if (lockedUntil > Date.now()) {
            return { ok: false, retryAfterMs: 30000, error: 'Слишком много попыток. Подождите 30 секунд.' };
          }
          return { ok: false, error: 'Неверный ключ доступа' };
        }
        if (!record.encrypted || failures || lockedUntil) {
          await writeAccessKeyFile(accessKeyPath, { ...record, failedAttempts: 0, lockedUntil: 0 }, safeStorage);
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
        if (!config.accessKeyEnabled || !await verifyStoredAccessKey(accessKeyPath, currentValue, safeStorage)) {
          return { ok: false, error: 'Введи установленный ключ доступа, чтобы удалить его' };
        }
        config.accessKeyEnabled = false;
        config.accessKeyPromptDismissed = false;
        try {
          await fs.promises.unlink(accessKeyPath);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        await removeAccessKeyMarker(accessKeyPath);
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
    guardSession(session.defaultSession);
    for (const account of config.accounts) guardSession(session.fromPartition(accountPartition(account.id)));
    if (await accessKeyFileExists(accessKeyPath) && !config.accessKeyEnabled) {
      config.accessKeyEnabled = true;
      accessUnlocked = false;
      saveConfig();
    }
    await recoverMissingAccessKey();
    if (config.accessKeyEnabled && await accessKeyFileExists(accessKeyPath)) {
      try {
        const record = await readAccessKeyFile(accessKeyPath, safeStorage);
        failures = Number.isInteger(record.failedAttempts) ? Math.min(4, Math.max(0, record.failedAttempts)) : 0;
        lockedUntil = Number.isFinite(record.lockedUntil) ? Math.min(Date.now() + 30000, Math.max(0, record.lockedUntil)) : 0;
        if (!record.encrypted || !record.marked) {
          failures = 0;
          lockedUntil = 0;
          await writeAccessKeyFile(accessKeyPath, { ...record, failedAttempts: 0, lockedUntil: 0 }, safeStorage);
        }
      } catch (error) {
        console.error('[AnimeOn] Не удалось проверить файл ключа доступа:', error);
      }
    }
    await fs.promises.mkdir(path.dirname(accessKeyPath), { recursive: true });
    watchAccessKeyFile();
  }

  return { initialize, recoverMissingAccessKey, registerIpc, guardSession };
}

module.exports = { createAccessKeyManager };
