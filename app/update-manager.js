const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { verifySignedUpdateManifest } = require('./update-manifest');
const { copyFileAtomically, writeFileAtomically } = require('./persistence');

function createUpdateManager({
  app,
  Notification,
  ipcMain,
  config,
  compareVersions,
  ensureRollbackDir,
  getWindow,
  isTrustedAppEvent,
  saveConfig,
  writeLog,
  trayController,
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

async function readReleaseAsset(asset, maxBytes) {
  if (!asset?.browser_download_url) throw new Error('Release asset URL is unavailable');
  const response = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'AnimeOn-Desktop' },
    signal: globalThis.AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.body) throw new Error(`Could not download ${asset.name}: HTTP ${response.status}`);
  const contentLength = Number(response.headers.get('content-length')) || 0;
  if (contentLength > maxBytes) throw new Error(`${asset.name} exceeds the allowed size`);
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new Error(`${asset.name} exceeds the allowed size`);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

let lastUpdate = null;
let updateNotified = false;
let downloadedInstaller = null;
let downloadedInstallerVersion = null;
let activeDownload = null;

async function checkUpdate(silent = !!config?.silentUpdates) {
  try {
    const res = await fetch(`${REPO_API}/releases/latest`, { headers: { 'User-Agent': 'AnimeOn-Desktop' }, signal: globalThis.AbortSignal.timeout(15000) });
    if (!res.ok) return { ok: false, reason: 'github ' + res.status, silent };
    const payload = await res.json();
    const history = Array.isArray(payload) ? payload : [payload];
    const release = history.find((item) => item && !item.draft && !item.prerelease);
    if (!release) return { ok: false, reason: 'обновлений пока нет', silent };
    const latest = normalizeVersion(release.tag_name || release.name || '');
    const asset = findReleaseAsset(release.assets || []);
    let digest = asset?.digest || null;
    let size = Number(asset?.size || 0);
    const trustPath = path.join(__dirname, 'update-trust.json');
    let trustConfig = null;
    try {
      trustConfig = JSON.parse(await fs.promises.readFile(trustPath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Could not load update trust key: ${String(error.message || error)}`);
    }
    if (trustConfig) {
      if (trustConfig.algorithm !== 'Ed25519' || typeof trustConfig.publicKey !== 'string') {
        throw new Error('Update trust key configuration is invalid');
      }
      const publicKey = crypto.createPublicKey(trustConfig.publicKey);
      if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('Update trust key must be Ed25519');
      const assets = Array.isArray(release.assets) ? release.assets : [];
      const manifestAsset = assets.find((item) => item?.name === 'update-manifest.json');
      const signatureAsset = assets.find((item) => item?.name === 'update-manifest.json.sig');
      if (!asset || !manifestAsset || !signatureAsset) {
        throw new Error('Signed update manifest is missing from this release');
      }
      const [manifestBytes, signatureBytes] = await Promise.all([
        readReleaseAsset(manifestAsset, 64 * 1024),
        readReleaseAsset(signatureAsset, 4096),
      ]);
      const verifiedAsset = verifySignedUpdateManifest({
        manifestBytes,
        signatureText: signatureBytes.toString('utf8'),
        publicKey,
        version: latest,
        assetName: asset.name,
        assetSize: Number(asset.size || 0),
        assetDigest: asset.digest || '',
      });
      digest = `sha256:${verifiedAsset.sha256}`;
      size = verifiedAsset.size;
    }
    const notes = String(release.body || '').replace(/\r/g, '');
    const force = /force[-\s]?update|must[-\s]?update|critical|urgent/i.test(notes);
    const info = {
      ok: true,
      latest,
      current: app.getVersion(),
      hasUpdate: compareVersions(latest, app.getVersion()) > 0,
      url: asset ? asset.browser_download_url : release.html_url,
      notes,
      digest,
      size,
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
    if (lastUpdate?.latest !== info.latest) {
      downloadedInstaller = null;
      downloadedInstallerVersion = null;
    }
    lastUpdate = info;
    trayController?.setUpdateAvailable(info.hasUpdate);
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
  n.on('click', () => openUpdatePanel());
  n.show();
}

function openUpdatePanel() {
  const win = getWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send('upd:open');
}

function updProgress(pct, stage, extra = {}) {
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send('upd:progress', { pct, stage, ...extra });
}

function reportDownloadState(download, stage) {
  const pct = download.total > 0 ? Math.min(100, (download.received / download.total) * 100) : null;
  updProgress(pct, stage, {
    received: download.received,
    total: download.total,
    speed: 0,
  });
}

async function verifyInstallerFile(file, info) {
  let stat;
  try {
    stat = await fs.promises.stat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  if (!stat.isFile() || !stat.size) return false;
  if (info.size > 0 && stat.size !== info.size) return false;
  if (info.digest) {
    const expected = String(info.digest).replace(/^sha256:/i, '');
    if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
    const hash = require('node:crypto').createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    return hash.digest('hex').toLowerCase() === expected.toLowerCase();
  }
  return info.size > 0 && stat.size === info.size;
}

async function restoreDownloadedInstaller(info) {
  if (!info?.ok || !info.hasUpdate || activeDownload) return false;
  const file = path.join(app.getPath('temp'), `AnimeOn-Setup-${info.latest}.exe`);
  if (!await verifyInstallerFile(file, info)) {
    if (downloadedInstallerVersion === info.latest) {
      downloadedInstaller = null;
      downloadedInstallerVersion = null;
    }
    return false;
  }
  downloadedInstaller = file;
  downloadedInstallerVersion = info.latest;
  return true;
}

function setDownloadPaused(paused) {
  const download = activeDownload;
  if (!download || download.cancelled || typeof paused !== 'boolean') return;
  download.paused = paused;
  if (!paused) {
    const resume = download.resume;
    download.resume = null;
    resume?.();
  }
  reportDownloadState(download, paused ? 'paused' : 'download');
}

function cancelDownload() {
  const download = activeDownload;
  if (!download || download.cancelled) return;
  download.cancelled = true;
  download.controller.abort();
  const resume = download.resume;
  download.resume = null;
  resume?.();
}

async function waitForDownloadResume(download) {
  while (download.paused && !download.cancelled) {
    await new Promise((resolve) => { download.resume = resolve; });
  }
  if (download.cancelled || download.timedOut) {
    const error = new Error('Скачивание отменено');
    error.name = 'AbortError';
    throw error;
  }
}

async function downloadUpdate() {
  if (!lastUpdate || !lastUpdate.url) return { ok: false, error: 'нет данных об обновлении' };
  if (activeDownload) return { ok: false, error: 'скачивание уже выполняется' };
  const existingInstaller = path.join(app.getPath('temp'), `AnimeOn-Setup-${lastUpdate.latest}.exe`);
  if (await verifyInstallerFile(existingInstaller, lastUpdate)) {
    downloadedInstaller = existingInstaller;
    downloadedInstallerVersion = lastUpdate.latest;
    const size = (await fs.promises.stat(existingInstaller)).size;
    updProgress(100, 'ready', { received: size, total: lastUpdate.size || size, speed: 0 });
    return { ok: true, cached: true };
  }
  const download = {
    controller: new AbortController(),
    paused: false,
    cancelled: false,
    resume: null,
    received: 0,
    total: 0,
    timedOut: false,
  };
  activeDownload = download;
  let dest;
  let ws;
  let writerClosed = Promise.resolve();
  const timeout = setTimeout(() => {
    download.timedOut = true;
    download.controller.abort();
    const resume = download.resume;
    download.resume = null;
    resume?.();
  }, 600000);
  try {
    dest = path.join(app.getPath('temp'), `AnimeOn-Setup-${lastUpdate.latest}.exe`);
    downloadedInstaller = null;
    updProgress(0, 'download');
    const res = await fetch(lastUpdate.url, { signal: download.controller.signal });
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    download.total = total;
    ws = fs.createWriteStream(dest);
    writerClosed = new Promise((resolve) => ws.once('close', resolve));
    let received = 0;
    let lastPct = -1;
    let lastTime = Date.now();
    let lastBytes = 0;
    const reader = res.body.getReader();
    for (;;) {
      await waitForDownloadResume(download);
      const { value, done } = await reader.read();
      if (done) break;
      await waitForDownloadResume(download);
      ws.write(Buffer.from(value));
      received += value.length;
      download.received = received;
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
      for await (const chunk of fs.createReadStream(dest)) hash.update(chunk);
      const actual = hash.digest('hex');
      verified = actual.toLowerCase() === expected.toLowerCase();
      if (!verified) {
        await fs.promises.unlink(dest);
        return { ok: false, error: 'Контрольная сумма не совпадает — файл повреждён или подменён' };
      }
    } else if (lastUpdate.size && total && received !== total) {
      await fs.promises.unlink(dest);
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
        saveConfig();
      } catch (error) {
        writeLog('warn', 'Could not record update download metadata', { error: String(error?.message || error) });
      }
    }
    downloadedInstaller = dest;
    downloadedInstallerVersion = lastUpdate.latest;
    updProgress(100, 'ready', { received, total, speed: 0 });
    if (getWindow() && !getWindow().isDestroyed()) getWindow().setProgressBar(1);
    setTimeout(() => { if (getWindow() && !getWindow().isDestroyed()) getWindow().setProgressBar(-1); }, 900);
    return { ok: true };
  } catch (err) {
    if (getWindow() && !getWindow().isDestroyed()) getWindow().setProgressBar(-1);
    if (download.cancelled) {
      if (ws && !ws.closed) {
        ws.destroy();
        await writerClosed;
      }
      if (dest && await fileExists(dest)) {
        try {
          await fs.promises.unlink(dest);
        } catch (cleanupError) {
          return { ok: false, error: `Не удалось удалить незавершённый файл: ${String(cleanupError.message || cleanupError)}` };
        }
      }
      downloadedInstaller = null;
      downloadedInstallerVersion = null;
      updProgress(null, 'cancelled');
      return { ok: false, cancelled: true };
    }
    if (ws && !ws.closed) {
      ws.destroy();
      await writerClosed;
    }
    if (download.timedOut) return { ok: false, error: 'Истекло время ожидания загрузки' };
    return { ok: false, error: String(err && err.message || err) };
  } finally {
    clearTimeout(timeout);
    if (activeDownload === download) activeDownload = null;
  }
}

async function backupCurrentExecutable() {
  const rollbackDir = await ensureRollbackDir();
  const current = process.execPath;
  if (!current || !await fileExists(current)) return null;
  const backupFile = path.join(rollbackDir, `AnimeOn-${app.getVersion()}.exe`);
  await copyFileAtomically(current, backupFile);
  config.rollbackVersion = app.getVersion();
  config.lastGoodVersion = app.getVersion();
  saveConfig();
  return backupFile;
}

async function getRollbackCandidates() {
  const rollbackDir = await ensureRollbackDir();
  let names = [];
  try {
    names = await fs.promises.readdir(rollbackDir);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return names
    .filter((name) => /^AnimeOn-.*\.exe$/i.test(name))
    .filter((name) => normalizeVersion(name.replace(/^AnimeOn-(.*)\.exe$/i, '$1')) !== normalizeVersion(app.getVersion()))
    .sort((left, right) => compareVersions(
      right.replace(/^AnimeOn-(.*)\.exe$/i, '$1'),
      left.replace(/^AnimeOn-(.*)\.exe$/i, '$1'),
    ))
    .map((name) => path.join(rollbackDir, name));
}

async function rollbackUpdate() {
  const candidates = await getRollbackCandidates();
  const backupFile = candidates[0] || null;
  if (!backupFile || !await fileExists(backupFile)) return { ok: false, error: 'Резервная копия версии не найдена' };
  try {
    const target = process.env.PORTABLE_EXECUTABLE_PATH || process.execPath;
    if (target && target !== backupFile) {
      const backupPath = path.join(app.getPath('temp'), `animeon-rollback-${Date.now()}.bat`);
      await writeFileAtomically(backupPath, [
        '@echo off',
        'timeout /t 2 /nobreak >nul',
        `copy /y "${backupFile}" "${target}" >nul`,
        `start "" "${target}"`,
        `del /q "${backupPath}" 2>nul`,
      ].join('\r\n'), { encoding: 'utf8' });
      spawn('cmd.exe', ['/c', backupPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      setQuitting(true);
      setTimeout(() => app.quit(), 500);
      return { ok: true, rollback: backupFile };
    }
    spawn(backupFile, ['--rollback'], { detached: true, stdio: 'ignore' }).unref();
    setQuitting(true);
    setTimeout(() => app.quit(), 500);
    return { ok: true, rollback: backupFile };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

async function applyUpdate() {
  if (!downloadedInstaller || downloadedInstallerVersion !== lastUpdate?.latest || !await fileExists(downloadedInstaller)) return false;
  await backupCurrentExecutable();
  const portablePath = process.env.PORTABLE_EXECUTABLE_PATH;
  if (portablePath) {
    const bat = path.join(app.getPath('temp'), `animeon-update-${Date.now()}.bat`);
    await writeFileAtomically(bat, [
      '@echo off',
      'timeout /t 2 /nobreak >nul',
      `move /y "${portablePath}" "${portablePath}.old"`,
      `copy /y "${downloadedInstaller}" "${portablePath}" >nul`,
      `start "" "${portablePath}"`,
      `del /q "${portablePath}.old" 2>nul`,
      `del /q "${bat}" 2>nul`,
    ].join('\r\n'), { encoding: 'utf8' });
    spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setQuitting(true);
    setTimeout(() => app.quit(), 300);
    return true;
  }

  spawn(downloadedInstaller, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  setQuitting(true);
  setTimeout(() => app.quit(), 500);
  return true;
}

ipcMain.handle('upd:check', (event) => isTrustedAppEvent(event) ? checkUpdate() : { ok: false, reason: 'untrusted sender' });
ipcMain.handle('upd:get-data', async (event) => {
  if (!isTrustedAppEvent(event)) return { ok: false, reason: 'untrusted sender' };
  const info = lastUpdate || await checkUpdate(true);
  const candidates = await getRollbackCandidates();
  const rollbackFiles = await Promise.all(
    candidates.map(async (candidate) => (await fileExists(candidate) ? candidate : null)),
  );
  const rollbackFile = rollbackFiles.find(Boolean);
  const rollbackVersion = rollbackFile?.match(/^.*[\\/]AnimeOn-(.*)\.exe$/i)?.[1] || null;
  if (!info?.ok) return { ...info, rollbackAvailable: !!rollbackVersion, rollbackVersion };
  return {
    ...info,
    downloaded: await restoreDownloadedInstaller(info),
    rollbackAvailable: !!rollbackVersion,
    rollbackVersion,
  };
});

ipcMain.on('upd:open', (event) => { if (isTrustedAppEvent(event)) openUpdatePanel(); });
ipcMain.on('upd:close', (event) => {
  if (!isTrustedAppEvent(event)) return;
  event.sender.send('upd:close');
});
ipcMain.on('upd:pause', (event, paused) => { if (isTrustedAppEvent(event)) setDownloadPaused(paused); });
ipcMain.on('upd:cancel', (event) => { if (isTrustedAppEvent(event)) cancelDownload(); });
ipcMain.handle('upd:install', async (event) => isTrustedAppEvent(event) ? { ok: await applyUpdate() } : { ok: false, error: 'untrusted sender' });
ipcMain.handle('upd:download', (event) => isTrustedAppEvent(event) ? downloadUpdate() : { ok: false, error: 'untrusted sender' });
ipcMain.handle('upd:rollback', async (event) => isTrustedAppEvent(event) ? rollbackUpdate() : { ok: false, error: 'untrusted sender' });

  return { checkUpdate };
}

module.exports = { createUpdateManager };
