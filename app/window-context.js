function createWindowContext({
  BrowserWindow,
  config,
  isTrustedAppEvent,
  windowIdsByBrowserId,
  windowSiteContents,
  getActiveSiteContents,
  setActiveSiteContents,
  writeLog,
}) {
  function windowIdForBrowserWindow(browserWindow) {
    return browserWindow && !browserWindow.isDestroyed()
      ? windowIdsByBrowserId.get(browserWindow.id) || null
      : null;
  }

  function getWindowContext(event) {
    if (!isTrustedAppEvent(event)) return null;
    try {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const id = windowIdForBrowserWindow(browserWindow);
      return id ? config.windowStates[id] || null : null;
    } catch {
      return null;
    }
  }

  function getWindowSiteContents(event) {
    if (!isTrustedAppEvent(event)) return null;
    try {
      const id = windowIdForBrowserWindow(BrowserWindow.fromWebContents(event.sender));
      const guest = id ? windowSiteContents.get(id) : null;
      return guest && !guest.isDestroyed() ? guest : null;
    } catch {
      return null;
    }
  }

  function clearWindowSiteContents(event) {
    try {
      const id = windowIdForBrowserWindow(BrowserWindow.fromWebContents(event.sender));
      const guest = id ? windowSiteContents.get(id) : null;
      if (guest === getActiveSiteContents()) setActiveSiteContents(null);
      if (id) windowSiteContents.delete(id);
    } catch (error) {
      writeLog('debug', 'Could not clear closed window site contents', { error: String(error?.message || error) });
    }
  }

  return { clearWindowSiteContents, getWindowContext, getWindowSiteContents, windowIdForBrowserWindow };
}

module.exports = { createWindowContext };
