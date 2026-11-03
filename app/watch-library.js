const crypto = require('node:crypto');
const { writeFileAtomically } = require('./persistence');

function createWatchNote(state, text, now = new Date()) {
  const note = String(text || '').trim().slice(0, 1000);
  if (!note) return null;
  const url = String(state?.url || state?.watchUrl || '');
  let safeUrl = '';
  try {
    const parsed = new URL(url);
    if (/^https?:$/.test(parsed.protocol) && /(^|\.)animeon\.(cc|co|gg)$/i.test(parsed.hostname)) safeUrl = parsed.href;
  } catch { void 0; }
  return {
    id: crypto.randomUUID(),
    title: String(state?.animeTitle || state?.title || 'AnimeOn').trim().slice(0, 180),
    episode: String(state?.episode || '').slice(0, 24),
    seconds: Math.max(0, Math.floor(Number(state?.currentTime) || 0)),
    url: safeUrl,
    text: note,
    createdAt: now.toISOString(),
  };
}

function createWatchLibrary({
  ipcMain,
  fs,
  path,
  nativeImage,
  shell,
  clipboard,
  screenshotsDir,
  getWindow,
  getSiteContents,
  config,
  saveConfig,
  isTrustedAppEvent,
  pageLabel,
  sanitizeName,
  writeLog,
  getLatestMediaState,
}) {
  function ensureScreenshotsDir() {
    return fs.promises.mkdir(screenshotsDir, { recursive: true });
  }

  async function isInScreenshotsDir(value) {
    try {
      const resolved = path.resolve(String(value || ''));
      const relative = path.relative(screenshotsDir, resolved);
      if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return false;
      const realRoot = await fs.promises.realpath(screenshotsDir);
      const realPath = await fs.promises.realpath(resolved);
      const realRelative = path.relative(realRoot, realPath);
      return realRelative !== '' && !realRelative.startsWith('..') && !path.isAbsolute(realRelative);
    } catch {
      return false;
    }
  }

  function formatTimestamp(date = new Date()) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  }

  function takeScreenshot() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    (async () => {
      try {
        await ensureScreenshotsDir();
        const image = await win.capturePage();
        const siteContents = getSiteContents();
        const url = String(siteContents?.getURL?.() || '');
        let title = 'AnimeOn';
        try { title = await siteContents?.executeJavaScript('document.title||"AnimeOn"', false) || title; } catch (error) {
          writeLog('debug', 'Could not read the page title for a screenshot', { error: String(error?.message || error) });
        }
        const filePath = path.join(screenshotsDir, `${sanitizeName(pageLabel(url, title))}-${formatTimestamp()}.png`);
        await writeFileAtomically(filePath, image.toPNG(), { mode: 0o600 });
        win.webContents.send('toast', { message: `Скриншот сохранён: ${path.basename(filePath)}` });
        win.webContents.send('screenshots:changed');
      } catch (error) {
        writeLog('error', 'Screenshot failed', { error: String(error?.message || error) });
      }
    })();
  }

  function registerIpc() {
    ipcMain.handle('watch:notes:list', (event) => {
      if (!isTrustedAppEvent(event)) return { ok: false, notes: [] };
      return { ok: true, notes: config.watchNotes.slice().reverse() };
    });
    ipcMain.handle('watch:notes:add', (event, text) => {
      if (!isTrustedAppEvent(event)) return { ok: false, error: 'untrusted sender' };
      const state = getLatestMediaState();
      if (!state?.available) return { ok: false, error: 'Сначала запусти видео' };
      const note = createWatchNote({ ...state, url: getSiteContents()?.getURL?.() || state.url }, text);
      if (!note) return { ok: false, error: 'Напиши заметку' };
      config.watchNotes.push(note);
      config.watchNotes = config.watchNotes.slice(-1000);
      saveConfig();
      return { ok: true, note };
    });
    ipcMain.handle('watch:notes:delete', (event, id) => {
      if (!isTrustedAppEvent(event)) return { ok: false };
      const before = config.watchNotes.length;
      config.watchNotes = config.watchNotes.filter((note) => note.id !== String(id || ''));
      if (before !== config.watchNotes.length) saveConfig();
      return { ok: true };
    });

    ipcMain.on('app:screenshot', takeScreenshot);
    ipcMain.handle('screenshots:list', async () => {
      try {
        await ensureScreenshotsDir();
        const files = (await fs.promises.readdir(screenshotsDir)).filter((file) => /\.png$/i.test(file));
        const items = await Promise.all(files.map(async (file) => {
          const fullPath = path.join(screenshotsDir, file);
          const stat = await fs.promises.stat(fullPath);
          return { name: file, path: fullPath, mtimeMs: stat.mtimeMs, size: stat.size };
        }));
        items.sort((a, b) => b.mtimeMs - a.mtimeMs);
        return { ok: true, dir: screenshotsDir, items };
      } catch (error) {
        return { ok: false, error: String(error && error.message || error) };
      }
    });
    ipcMain.handle('screenshots:thumb', async (_, filePath) => {
      try {
        if (!await isInScreenshotsDir(filePath)) throw new Error('bad path');
        const image = nativeImage.createFromPath(filePath);
        if (image.isEmpty()) throw new Error('empty image');
        const size = image.getSize();
        const width = Math.min(280, size.width || 280);
        const thumb = size.width > width ? image.resize({ width }) : image;
        return { ok: true, dataUrl: thumb.toDataURL() };
      } catch (error) {
        return { ok: false, error: String(error && error.message || error) };
      }
    });
    ipcMain.handle('screenshots:open', async (_, filePath) => {
      try {
        if (!await isInScreenshotsDir(filePath)) throw new Error('bad path');
        const error = await shell.openPath(filePath);
        if (error) throw new Error(error);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error && error.message || error) };
      }
    });
    ipcMain.handle('screenshots:show', async (_, filePath) => {
      try {
        if (!await isInScreenshotsDir(filePath)) throw new Error('bad path');
        shell.showItemInFolder(filePath);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error && error.message || error) };
      }
    });
    ipcMain.handle('screenshots:copy', async (_, filePath) => {
      try {
        if (!await isInScreenshotsDir(filePath)) throw new Error('bad path');
        const image = nativeImage.createFromPath(filePath);
        if (image.isEmpty()) throw new Error('empty image');
        clipboard.writeImage(image);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error && error.message || error) };
      }
    });
    ipcMain.handle('screenshots:delete', async (_, filePath) => {
      try {
        if (!await isInScreenshotsDir(filePath)) throw new Error('bad path');
        await fs.promises.unlink(filePath);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: String(error && error.message || error) };
      }
    });
    ipcMain.on('screenshots:open-folder', (event) => {
      if (!isTrustedAppEvent(event)) return;
      ensureScreenshotsDir()
        .then(() => shell.openPath(screenshotsDir))
        .then((error) => {
          if (error) throw new Error(error);
        })
        .catch((error) => writeLog('error', 'Failed to open screenshots folder', { error: String(error?.message || error) }));
    });
  }

  return { registerIpc, takeScreenshot, ensureScreenshotsDir };
}

module.exports = { createWatchLibrary };
