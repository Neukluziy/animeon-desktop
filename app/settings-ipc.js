function createSettingsIpc({
  ipcMain,
  app,
  config,
  dialog,
  fs,
  path,
  shell,
  clipboard,
  session,
  getWindow,
  getSiteContents,
  saveConfig,
  applySideEffects,
  applyDiscordRpcRuntime,
  normalizePageUrl,
  rememberRecentPage,
  pageLabel,
  setSleepTimer,
  logPath,
  screenshotsDir,
  apiHealth,
  apiBase,
  apiVersion,
  discordDefaults,
}) {
  const exportKeys = ['theme','custom','site','siteList','remember','notify','autostart','tray','compact','confirmClose','autoRecovery','performance','lowPower','autoHide','closeBehavior','alwaysOnTop','hotkeys','customCss','smoothSite','showSiteScrollbars','visual','profiles','lastUrl','history','favorites','api','playbackPositions','playbackSpeed','library','resumeEnabled','autoNext','recentPages','pageFavorites','tabs','activeTab','tabsFixedV2','doNotDisturb','sleepTimer','autoCacheCleanup','cacheLimitMB','errorLog','memorySaver','startupPolicyFixed','discordRpc'];

  function registerIpc() {
    ipcMain.handle('library:get', () => ({ library: config.library }));
    ipcMain.handle('library:set', (_, library) => {
      if (!library || typeof library !== 'object') return { ok: false };
      for (const key of ['favorites','continueWatching','localHistory']) {
        if (Array.isArray(library[key])) config.library[key] = library[key].slice(0, 500);
      }
      saveConfig();
      return { ok: true, library: config.library };
    });
    ipcMain.handle('library:clear-history', () => {
      config.library.localHistory = [];
      config.library.continueWatching = [];
      saveConfig();
      return { ok: true };
    });

    ipcMain.handle('app:diagnostics', async () => {
      const win = getWindow();
      const wc = win?.webContents;
      let webviewMemoryMB = 0;
      try {
        const pid = wc?.getOSProcessId?.();
        const metric = pid ? app.getAppMetrics().find((item) => item.pid === pid) : null;
        webviewMemoryMB = metric?.memory?.workingSetSize ? Math.round(metric.memory.workingSetSize / 1024) : 0;
      } catch {}
      return {
        version: app.getVersion(),
        api: { baseUrl: apiBase, clientVersion: apiVersion },
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        memoryMB: Math.round(process.memoryUsage().rss / 1048576),
        webviewMemoryMB,
        gpu: app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : {},
        visible: !!win?.isVisible(),
        maximized: !!win?.isMaximized(),
        fullscreen: !!win?.isFullScreen(),
      };
    });

    ipcMain.handle('app:clear-site-data', async () => {
      try {
        await session.defaultSession.clearStorageData({
          storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'serviceworkers', 'websql', 'shadercache', 'cachestorage'],
        });
        return { ok: true };
      } catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });

    ipcMain.handle('settings:export', async () => {
      try {
        const { canceled, filePath } = await dialog.showSaveDialog(getWindow(), {
          title: 'Экспорт настроек AnimeOn',
          defaultPath: 'AnimeOn-settings.json',
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !filePath) return { ok: false, canceled: true };
        const data = { app: 'AnimeOn Desktop', version: app.getVersion(), exportedAt: new Date().toISOString(), settings: Object.fromEntries(exportKeys.map((key) => [key, config[key]])) };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return { ok: true, filePath };
      } catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });

    ipcMain.handle('settings:import', async () => {
      try {
        const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
          title: 'Импорт настроек AnimeOn',
          properties: ['openFile'],
          filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
        const raw = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
        const incoming = raw?.settings && typeof raw.settings === 'object' ? raw.settings : raw;
        const patch = {};
        for (const key of exportKeys) if (Object.prototype.hasOwnProperty.call(incoming, key)) patch[key] = incoming[key];
        if (patch.theme && !['violet','blue','cyan','sky','indigo','emerald','green','lime','yellow','amber','orange','red','rose','pink','fuchsia','slate','gray','teal','mint','gold','coral','lavender','crimson','electric','custom'].includes(patch.theme)) delete patch.theme;
        if (patch.site && !['cc','co'].includes(patch.site)) delete patch.site;
        if (patch.performance && !['performance','balanced','economy'].includes(patch.performance)) delete patch.performance;
        if (patch.closeBehavior && !['exit','tray','ask'].includes(patch.closeBehavior)) delete patch.closeBehavior;
        for (const key of ['remember','autostart','tray','compact','confirmClose','autoRecovery','lowPower','autoHide']) if (key in patch) patch[key] = !!patch[key] || patch[key] === '1';
        Object.assign(config, patch);
        saveConfig();
        applySideEffects(patch);
        if ('discordRpc' in patch) applyDiscordRpcRuntime();
        return { ok: true, settings: Object.fromEntries(exportKeys.map((key) => [key, config[key]])) };
      } catch (error) { return { ok: false, error: 'Не удалось импортировать файл: ' + String(error?.message || error) }; }
    });

    ipcMain.handle('settings:reset', async () => {
      try {
        const defaults = { theme:'violet', custom:'#8b5cf6', site:'co', remember:'0', notify:false, autostart:false, tray:false, compact:false, confirmClose:false, autoRecovery:true, performance:'balanced', lowPower:false, autoHide:true, closeBehavior:'ask', alwaysOnTop:false, resumeEnabled:true, autoNext:false, hotkeys:{}, customCss:{cc:'',co:''}, siteList:[{id:'one',url:'https://animeon.cc/',label:'animeon.cc'},{id:'two',url:'https://v1.animeon.co/',label:'v1.animeon.co'}], smoothSite:true, showSiteScrollbars:false, visual:{radius:18,opacity:92,blur:0,scale:100,density:100,accentGlow:70,animations:'smooth'}, profiles:{}, discordRpc:{...discordDefaults} };
        Object.assign(config, defaults);
        saveConfig();
        applySideEffects({ autostart: true, tray: true });
        applyDiscordRpcRuntime();
        return { ok: true, settings: config };
      } catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });

    ipcMain.handle('pages:recent', () => ({ ok: true, items: config.recentPages || [] }));
    ipcMain.handle('pages:recent-add', (_, item) => {
      const url = normalizePageUrl(item?.url);
      if (!url) return { ok: false };
      rememberRecentPage(url, String(item?.title || ''));
      return { ok: true, items: config.recentPages || [] };
    });
    ipcMain.handle('pages:favorites', () => ({ ok: true, items: config.pageFavorites || [] }));
    ipcMain.handle('pages:favorite-toggle', (_, item) => {
      const url = String(item?.url || '');
      let valid = false;
      try { const parsed = new URL(url); valid = (parsed.protocol === 'http:' || parsed.protocol === 'https:') && /(^|\.)animeon\.(cc|co)$/i.test(parsed.hostname); } catch {}
      if (!valid) return { ok: false, error: 'bad url' };
      const index = (config.pageFavorites || []).findIndex((entry) => (typeof entry === 'string' ? entry : entry?.url) === url);
      if (index >= 0) config.pageFavorites.splice(index, 1);
      else config.pageFavorites.unshift({ url, title: pageLabel(url, item?.title || '') });
      config.pageFavorites = config.pageFavorites.slice(0, 100);
      saveConfig();
      return { ok: true, favorite: index < 0, items: config.pageFavorites };
    });

    ipcMain.handle('tabs:get', () => ({ ok: true, tabs: config.tabs || [], activeTab: config.activeTab || 0 }));
    ipcMain.handle('tabs:set', (_, tabs, active = 0) => {
      config.tabs = Array.isArray(tabs) ? tabs.slice(0, 12) : [];
      config.activeTab = Math.max(0, Math.min(Math.max(0, config.tabs.length - 1), Number(active) || 0));
      saveConfig();
      return { ok: true, tabs: config.tabs, activeTab: config.activeTab };
    });
    ipcMain.handle('find:start', (_, text) => {
      const siteWc = getSiteContents();
      if (!siteWc || siteWc.isDestroyed()) return { ok: false };
      const value = String(text || '');
      if (!value) {
        try { siteWc.stopFindInPage('clearSelection'); } catch {}
        return { ok: true };
      }
      return { ok: true, id: siteWc.findInPage(value, { findNext: false, matchCase: false }) };
    });
    ipcMain.handle('find:stop', () => {
      try { getSiteContents()?.stopFindInPage('clearSelection'); } catch {}
      return { ok: true };
    });
    ipcMain.handle('sleep:set', (_, minutes, action) => setSleepTimer(minutes, action));
    ipcMain.handle('sleep:get', () => config.sleepTimer);
    ipcMain.handle('logs:get', () => {
      try {
        const text = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
        return { ok: true, path: logPath, text: text.slice(-120000) };
      } catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });
    ipcMain.handle('logs:open', async () => {
      try {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf8');
        const error = await shell.openPath(logPath);
        return { ok: !error, path: logPath, error: error || '' };
      } catch (error) { return { ok: false, path: logPath, error: String(error?.message || error) }; }
    });
    ipcMain.handle('logs:copy', () => {
      try {
        const text = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
        clipboard.writeText(text);
        return { ok: true };
      } catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });
    ipcMain.handle('logs:clear', () => {
      try {
        fs.writeFileSync(logPath, '', 'utf8');
        config.errorLog = [];
        saveConfig();
        return { ok: true };
      } catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });
    ipcMain.handle('cache:settings', (_, patch) => {
      if (patch && typeof patch === 'object') {
        if ('auto' in patch) config.autoCacheCleanup = !!patch.auto;
        if ('limitMB' in patch) config.cacheLimitMB = Math.max(64, Math.min(16384, Number(patch.limitMB) || 512));
        saveConfig();
      }
      return { ok: true, auto: config.autoCacheCleanup, limitMB: config.cacheLimitMB };
    });
    ipcMain.handle('cache:info', async () => {
      try { return { ok: true, size: await session.defaultSession.getCacheSize(), limitMB: Number(config.cacheLimitMB) || 512, auto: !!config.autoCacheCleanup }; }
      catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });
    ipcMain.handle('memory:saver', (_, enabled) => {
      config.memorySaver = !!enabled;
      saveConfig();
      try { getSiteContents()?.setBackgroundThrottling(config.memorySaver || config.performance === 'economy'); } catch {}
      return { ok: true, enabled: config.memorySaver };
    });

    const apiCacheDir = path.join(app.getPath('userData'), 'api-cache');
    const ensureApiCacheDir = () => { try { fs.mkdirSync(apiCacheDir, { recursive: true }); } catch {} };
    const getApiCacheSize = () => {
      ensureApiCacheDir();
      let bytes = 0;
      try { for (const file of fs.readdirSync(apiCacheDir)) { try { bytes += fs.statSync(path.join(apiCacheDir, file)).size; } catch {} } } catch {}
      return bytes;
    };
    ipcMain.handle('system:cache-info', async () => {
      let sessionCache = 0;
      try { sessionCache = await session.defaultSession.getCacheSize(); } catch {}
      return { ok: true, apiCacheMB: Math.round(getApiCacheSize() / 1048576 * 10) / 10, sessionCacheMB: Math.round(sessionCache / 1048576 * 10) / 10, screenshots: fs.existsSync(screenshotsDir) ? fs.readdirSync(screenshotsDir).filter((file) => /\.png$/i.test(file)).length : 0 };
    });
    ipcMain.handle('system:clear-api-cache', async () => {
      try { ensureApiCacheDir(); for (const file of fs.readdirSync(apiCacheDir)) { try { fs.unlinkSync(path.join(apiCacheDir, file)); } catch {} } return { ok: true }; }
      catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });
    ipcMain.handle('system:status', async () => {
      const metrics = app.getAppMetrics();
      const memory = Math.round(process.memoryUsage().rss / 1048576);
      const siteWc = getSiteContents();
      const sitePid = siteWc && !siteWc.isDestroyed() ? siteWc.getProcessId() : 0;
      const siteMetric = metrics.find((item) => item.pid === sitePid);
      let api = null;
      try { api = await apiHealth(); } catch {}
      return { ok: true, uptime: Math.round(process.uptime()), memoryMB: memory, siteMemoryMB: siteMetric ? Math.round(siteMetric.memory.workingSetSize / 1024) : 0, api, gpu: app.getGPUFeatureStatus ? app.getGPUFeatureStatus() : {}, cache: { apiCacheMB: Math.round(getApiCacheSize() / 1048576 * 10) / 10 }, performance: config.performance, autoRecovery: config.autoRecovery !== false };
    });
    ipcMain.handle('profiles:get', () => ({ ok: true, profiles: config.profiles || {} }));
    ipcMain.handle('profiles:save', (_, name, data) => {
      const key = String(name || '').trim().slice(0, 40);
      if (!key) return { ok: false, error: 'Пустое имя профиля' };
      if (!config.profiles || typeof config.profiles !== 'object') config.profiles = {};
      config.profiles[key] = { ...(data && typeof data === 'object' ? data : {}), updatedAt: Date.now() };
      saveConfig();
      return { ok: true, profiles: config.profiles };
    });
    ipcMain.handle('profiles:delete', (_, name) => {
      const key = String(name || '');
      if (config.profiles && Object.prototype.hasOwnProperty.call(config.profiles, key)) delete config.profiles[key];
      saveConfig();
      return { ok: true, profiles: config.profiles || {} };
    });
    ipcMain.handle('profiles:load', (_, name) => ({ ok: !!config.profiles?.[String(name || '')], profile: config.profiles?.[String(name || '')] || null }));
    ipcMain.handle('site:memory', async () => {
      try {
        const metrics = app.getAppMetrics();
        const siteWc = getSiteContents();
        const sitePid = siteWc && !siteWc.isDestroyed() ? siteWc.getProcessId() : 0;
        const site = metrics.find((item) => item.pid === sitePid);
        return { ok: true, appMB: Math.round(process.memoryUsage().rss / 1048576), siteMB: site ? Math.round(site.memory.workingSetSize / 1024) : 0, pid: sitePid, performance: config.performance };
      } catch (error) { return { ok: false, error: String(error?.message || error) }; }
    });
  }

  return { registerIpc };
}

module.exports = { createSettingsIpc };
