function createTelegramWindowManager({ BrowserWindow, path, appDir, getParentWindow, shell, telegramPattern, safeAsync, writeLog }) {
  let telegramWindow = null;

  function openExternal(url) {
    if (!url) return;
    if (/^tg:/i.test(url)) {
      safeAsync(() => shell.openExternal(url), writeLog, 'Could not open external URL');
      return;
    }
    if (!telegramPattern.test(url)) return;
    openTelegramWindow(url);
  }

  function openTelegramWindow(url) {
    if (telegramWindow && !telegramWindow.isDestroyed()) {
      telegramWindow.show();
      telegramWindow.focus();
      if (url && telegramWindow.webContents.getURL() !== url) telegramWindow.loadURL(url);
      return;
    }
    telegramWindow = new BrowserWindow({
      width: 520,
      height: 760,
      minWidth: 420,
      minHeight: 620,
      parent: getParentWindow() && !getParentWindow().isDestroyed() ? getParentWindow() : undefined,
      modal: false,
      show: false,
      backgroundColor: '#111111',
      icon: path.join(appDir, '../assets', 'logo.ico'),
      title: 'Telegram — AnimeOn',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    const currentWindow = telegramWindow;
    currentWindow.setMenuBarVisibility(false);
    currentWindow.once('ready-to-show', () => {
      if (telegramWindow !== currentWindow || currentWindow.isDestroyed()) return;
      currentWindow.show();
      currentWindow.focus();
    });
    currentWindow.webContents.setWindowOpenHandler(({ url: childUrl }) => {
      if (/^tg:/i.test(childUrl)) {
        safeAsync(() => shell.openExternal(childUrl), writeLog, 'Could not open external child URL');
        return { action: 'deny' };
      }
      if (telegramPattern.test(childUrl)) {
        currentWindow.loadURL(childUrl);
        return { action: 'deny' };
      }
      if (/^https?:\/\//i.test(childUrl)) {
        safeAsync(() => shell.openExternal(childUrl), writeLog, 'Could not open external child URL');
        return { action: 'deny' };
      }
      return { action: 'deny' };
    });
    currentWindow.webContents.on('will-navigate', (event, targetUrl) => {
      if (/^tg:/i.test(targetUrl)) {
        event.preventDefault();
        safeAsync(() => shell.openExternal(targetUrl), writeLog, 'Could not open external target URL');
      }
    });
    currentWindow.on('closed', () => {
      if (telegramWindow === currentWindow) telegramWindow = null;
    });
    currentWindow.loadURL(url);
  }

  return { openExternal };
}

module.exports = { createTelegramWindowManager };
