function createCacheMaintenance({
  config,
  session,
  accountPartition,
  safe,
  writeLog,
  bytesPerMegabyte,
  defaultCacheLimitMb,
  cleanupDelayMs,
  cleanupIntervalMs,
}) {
  function getAccountSessions() {
    const sessions = new Set([session.defaultSession]);
    for (const account of config.accounts) {
      const accountSession = safe(
        () => session.fromPartition(accountPartition(account.id)),
        writeLog,
        'Could not initialize account session',
        null,
      );
      if (accountSession) sessions.add(accountSession);
    }
    return [...sessions];
  }

  function scheduleCacheCleanup() {
    if (!config.autoCacheCleanup) return;
    setTimeout(async () => {
      try {
        const configuredLimit = Number(config.cacheLimitMB);
        const max = configuredLimit === 0 ? 0 : configuredLimit || defaultCacheLimitMb;
        if (max === 0) return;
        const sessions = getAccountSessions();
        const sizes = await Promise.all(sessions.map((siteSession) => siteSession.getCacheSize()));
        if (sizes.reduce((total, size) => total + size, 0) > max * bytesPerMegabyte) {
          await Promise.all(sessions.map((siteSession) => siteSession.clearCache()));
        }
      } catch (error) {
        writeLog('warn', 'Cache cleanup failed', { error: String(error?.message || error) });
      }
    }, cleanupDelayMs);
  }

  setInterval(scheduleCacheCleanup, cleanupIntervalMs);
  return { getAccountSessions };
}

module.exports = { createCacheMaintenance };
