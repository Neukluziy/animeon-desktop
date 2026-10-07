const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function createUpdateManager({
  app,
  BrowserWindow,
  Notification,
  ipcMain,
  config,
  compareVersions,
  ensureRollbackDir,
  getWindow,
  isTrustedAppEvent,
  saveConfig,
  setQuitting,
}) {
const REPO_API = 'https://api.github.com/repos/Neukluziy/animeon-desktop';

function normalizeVersion(value) {
  return String(value || '').replace(/^v/i, '').trim();
}

function findReleaseAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  return list.find((a) => /setup.*\.exe$/i.test(a.name)) || list.find((a) => /\.exe$/i.test(a.name)) || list[0] || null;
}

let lastUpdate = null;
let updateNotified = false;
let downloadedInstaller = null;
let updateWindow = null;

async function checkUpdate(silent = !!config?.silentUpdates) {
  try {
    const res = await fetch(`${REPO_API}/releases/latest`, { headers: { 'User-Agent': 'AnimeOn-Desktop' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { ok: false, reason: 'github ' + res.status, silent };
    const payload = await res.json();
    const history = Array.isArray(payload) ? payload : [payload];
    const release = history.find((item) => item && !item.draft && !item.prerelease);
    if (!release) return { ok: false, reason: 'обновлений пока нет', silent };
    const latest = normalizeVersion(release.tag_name || release.name || '');
    const asset = findReleaseAsset(release.assets || []);
    const notes = String(release.body || '').replace(/\r/g, '');
    const force = /force[-\s]?update|must[-\s]?update|critical|urgent/i.test(notes);
    const info = {
      ok: true,
      latest,
      current: app.getVersion(),
      hasUpdate: compareVersions(latest, app.getVersion()) > 0,
      url: asset ? asset.browser_download_url : release.html_url,
      notes,
      digest: asset?.digest || null,
      size: Number(asset?.size || 0),
      force,
      prerelease: !!release.prerelease,
      releaseName: String(release.name || release.tag_name || `v${latest}`),
      history: history
        .map((item) => ({
          version: normalizeVersion(item?.tag_name || item?.name || 'v0.0.0'),
          name: String(item?.name || item?.tag_name || 'Release'),
          notes: String(item?.body || '').replace(/\r/g, ''),
          date: item?.published_at || item?.created_at || null,
          prerelease: !!item?.prerelease,
          force: /force[-\s]?update|must[-\s]?update|critical|urgent/i.test(String(item?.body || '')),
        }))
        .filter((item) => item.version)
        .slice(0, 12),
      silent,
    };
    lastUpdate = info;
    if (info.hasUpdate && !updateNotified) {
      updateNotified = true;
      if (!silent) showUpdateToast();
    }
    return info;
  } catch (err) {
    return { ok: false, reason: String(err && err.message || err), silent };
  }
}

function showUpdateToast() {
  if (!Notification.isSupported() || !lastUpdate) return;
  const title = lastUpdate.force ? `Требуется обязательное обновление — v${lastUpdate.latest}` : `Доступна новая версия — v${lastUpdate.latest}`;
  const n = new Notification({
    title,
    body: lastUpdate.force ? 'Нужно установить обновление сейчас' : 'Нажми, чтобы посмотреть изменения',
    icon: path.join(__dirname, '../assets', 'logo.png'),
    silent: false,
  });
  n.on('click', () => openUpdateWindow());
  n.show();
}

function openUpdateWindow() {
  if (!lastUpdate) return;
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.show();
    updateWindow.focus();
    return;
  }
  updateWindow = new BrowserWindow({
    width: 520,
    height: 690,
    minWidth: 440,
    minHeight: 560,
    frame: false,
    show: false,
    backgroundColor: '#0f0d14',
    icon: path.join(__dirname, '../assets', 'logo.ico'),
    title: 'Обновление AnimeOn',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  updateWindow.setMenuBarVisibility(false);
  updateWindow.loadFile(path.join(__dirname, '../windows/update.html'));
  updateWindow.once('ready-to-show', () => {
    updateWindow.show();
    updateWindow.focus();
  });
  updateWindow.webContents.on('did-finish-load', () => {
    updateWindow.webContents.send('upd:data', lastUpdate);
  });
  updateWindow.on('closed', () => {
    updateWindow = null;
  });
}

function updProgress(pct, stage, extra = {}) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send('upd:progress', { pct, stage, ...extra });
  }
}

async function downloadUpdate() {
  if (!lastUpdate || !lastUpdate.url) return { ok: false, error: 'нет данных об обновлении' };
  try {
    const dest = path.join(app.getPath('temp'), `AnimeOn-Setup-${lastUpdate.latest}.exe`);
    updProgress(0, 'download');
    const res = await fetch(lastUpdate.url, { signal: AbortSignal.timeout(600000) });
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    const ws = fs.createWriteStream(dest);
    let received = 0;
    let lastPct = -1;
    let lastTime = Date.now();
    let lastBytes = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      ws.write(Buffer.from(value));
      received += value.length;
      const now = Date.now();
      if (now - lastTime >= 180) {
        const speed = Math.max(0, (received - lastBytes) / Math.max(0.18, (now - lastTime) / 1000));
        const pct = total > 0 ? Math.max(0, Math.min(100, (received / total) * 100)) : null;
        if (pct === null || Math.floor(pct) !== lastPct) {
          lastPct = pct === null ? lastPct : Math.floor(pct);
          updProgress(pct, 'download', { received, total, speed });
          if (getWindow() && !getWindow().isDestroyed()) getWindow().setProgressBar(pct === null ? 0 : Math.max(0, Math.min(1, pct / 100)), { mode: pct === null ? 'indeterminate' : 'normal' }); 
        }
        lastTime = now;
        lastBytes = received;
      }
    }
    await new Promise((r) => ws.end(r));
    updProgress(95, 'verify');
    const crypto = require('node:crypto');
    let verified = false;
    if (lastUpdate.digest) {
      const expected = String(lastUpdate.digest).replace(/^sha256:/i, '');
      const hash = crypto.createHash('sha256');
      const data = fs.readFileSync(dest);
      hash.update(data);
      const actual = hash.digest('hex');
      verified = actual.toLowerCase() === expected.toLowerCase();
      if (!verified) {
        fs.unlinkSync(dest);
        return { ok: false, error: 'Контрольная сумма не совпадает — файл повреждён или подменён' };
      }
    } else if (lastUpdate.size && total && received !== total) {
      fs.unlinkSync(dest);
      return { ok: false, error: 'Размер файла не совпадает с ожидаемым' };
    } else {
      verified = true;
    }
    if (verified) {
      try {
        const logEntry = { time: new Date().toISOString(), version: lastUpdate.latest, file: dest };
        const logs = Array.isArray(config.errorLog) ? config.errorLog : [];
        logs.push({ type: 'update-download', message: JSON.stringify(logEntry) });
        config.errorLog = logs.slice(-200);
      } catch {}
    }
    downloadedInstaller = dest;
    updProgress(100, 'ready', { received, total, speed: 0 });
    if (getWindow() && !getWindow().isDestroyed()) getWindow().setProgressBar(1);
    setTimeout(() => { if (getWindow() && !getWindow().isDestroyed()) getWindow().setProgressBar(-1); }, 900);
    return { ok: true };
  } catch (err) {
    if (getWindow() && !getWindow().isDestroyed()) getWindow().setProgressBar(-1);
    return { ok: false, error: String(err && err.message || err) };
  }
}

function backupCurrentExecutable() {
  const rollbackDir = ensureRollbackDir();
  const current = process.execPath;
  if (!current || !fs.existsSync(current)) return null;
  const backupFile = path.join(rollbackDir, `AnimeOn-${app.getVersion()}.exe`);
  try {
    fs.copyFileSync(current, backupFile);
    config.rollbackVersion = app.getVersion();
    config.lastGoodVersion = app.getVersion();
    saveConfig();
    return backupFile;
  } catch {
    return null;
  }
}

function rollbackUpdate() {
  const rollbackDir = ensureRollbackDir();
  const candidates = fs.existsSync(rollbackDir) ? fs.readdirSync(rollbackDir).filter((name) => /AnimeOn-.*\.exe$/i.test(name)).sort().reverse() : [];
  const backupFile = candidates.length ? path.join(rollbackDir, candidates[0]) : null;
  if (!backupFile || !fs.existsSync(backupFile)) return { ok: false, error: 'Резервная копия версии не найдена' };
  try {
    const target = process.env.PORTABLE_EXECUTABLE_PATH || process.execPath;
    if (target && target !== backupFile) {
      const backupPath = path.join(app.getPath('temp'), `animeon-rollback-${Date.now()}.bat`);
      fs.writeFileSync(backupPath, [
        '@echo off',
        'timeout /t 2 /nobreak >nul',
        `copy /y "${backupFile}" "${target}" >nul`,
        `start "" "${target}"`,
        `del /q "${backupPath}" 2>nul`,
      ].join('\r\n'));
      spawn('cmd.exe', ['/c', backupPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      setQuitting(true);
      setTimeout(() => app.exit(0), 500);
      return { ok: true, rollback: backupFile };
    }
    spawn(backupFile, ['--rollback'], { detached: true, stdio: 'ignore' }).unref();
    setQuitting(true);
    setTimeout(() => app.exit(0), 500);
    return { ok: true, rollback: backupFile };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function applyUpdate() {
  if (!downloadedInstaller || !fs.existsSync(downloadedInstaller)) return false;
  backupCurrentExecutable();
  const portablePath = process.env.PORTABLE_EXECUTABLE_PATH;
  if (portablePath) {
    const bat = path.join(app.getPath('temp'), `animeon-update-${Date.now()}.bat`);
    fs.writeFileSync(bat, [
      '@echo off',
      'timeout /t 2 /nobreak >nul',
      `move /y "${portablePath}" "${portablePath}.old"`,
      `copy /y "${downloadedInstaller}" "${portablePath}" >nul`,
      `start "" "${portablePath}"`,
      `del /q "${portablePath}.old" 2>nul`,
      `del /q "${bat}" 2>nul`,
    ].join('\r\n'));
    spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setQuitting(true);
    setTimeout(() => app.exit(0), 300);
    return true;
  }

  spawn(downloadedInstaller, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  setQuitting(true);
  setTimeout(() => app.exit(0), 500);
  return true;
}

ipcMain.handle('upd:check', (event) => isTrustedAppEvent(event) ? checkUpdate() : { ok: false, reason: 'untrusted sender' });

ipcMain.on('upd:open', (event) => { if (isTrustedAppEvent(event)) openUpdateWindow(); });
ipcMain.on('upd:close', (event) => {
  if (!isTrustedAppEvent(event)) return;
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
});
ipcMain.on('upd:install', (event) => { if (isTrustedAppEvent(event)) applyUpdate(); });
ipcMain.handle('upd:download', (event) => isTrustedAppEvent(event) ? downloadUpdate() : { ok: false, error: 'untrusted sender' });
ipcMain.handle('upd:rollback', (event) => isTrustedAppEvent(event) ? rollbackUpdate() : { ok: false, error: 'untrusted sender' });

  return { checkUpdate };
}

module.exports = { createUpdateManager };
