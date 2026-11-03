function createProtocolHandler({
  app,
  path,
  scheme,
  sitePattern,
  getSiteContents,
  getSiteList,
  showMainWindow,
  writeLog,
  startupDelayMs,
}) {
  function extractDeepLink(argv = []) {
    return argv.find((arg) => typeof arg === 'string' && arg.toLowerCase().startsWith(`${scheme}://`)) || '';
  }

  function openDeepLink(rawUrl) {
    const value = String(rawUrl || '');
    if (!new RegExp(`^${scheme}:\\/\\/`, 'i').test(value)) return false;
    try {
      const url = new URL(value);
      const siteContents = getSiteContents();
      const target = url.searchParams.get('url');
      if (target && sitePattern.test(target)) {
        siteContents?.loadURL(target);
        showMainWindow();
        return true;
      }
      const pathPart = `${url.pathname || ''}${url.search || ''}${url.hash || ''}`;
      if (pathPart && siteContents && !siteContents.isDestroyed()) {
        const baseUrl = getSiteList()?.[0]?.url || 'https://animeon.cc';
        siteContents.loadURL(new URL(pathPart, baseUrl).href);
        showMainWindow();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function register() {
    try {
      if (process.defaultApp) {
        const entry = path.resolve(process.argv[1] || '.');
        app.setAsDefaultProtocolClient(scheme, process.execPath, [entry]);
      } else {
        app.setAsDefaultProtocolClient(scheme);
      }
    } catch (error) {
      writeLog('warn', 'Could not register the application protocol', { error: String(error?.message || error) });
    }
  }

  function handleStartup(argv = []) {
    const link = extractDeepLink(argv);
    if (link) setTimeout(() => openDeepLink(link), startupDelayMs);
  }

  return { extractDeepLink, handleStartup, openDeepLink, register };
}

module.exports = { createProtocolHandler };
