function createNetworkManager({
  app,
  session,
  ipcMain,
  config,
  parseProxyEndpoint,
  saveConfig,
  writeLog,
  apiHealth,
  getWindow,
}) {
  let lastMirrorHealthCheck = 0;
  let mirrorHealthTimer = null;

  async function applyNetworkSettings() {
    const proxy = config.network || { mode: 'system', host: '', port: 0, user: '', pass: '', doh: false };
    const sessions = [session.defaultSession];
    try { sessions.push(session.fromPartition('persist:animeon')); } catch {}
    const endpoint = proxy.mode === 'custom' ? parseProxyEndpoint(`${proxy.host || ''}:${proxy.port || ''}`) : null;
    const proxyConfig = proxy.mode === 'direct'
      ? { mode: 'direct' }
      : proxy.mode === 'custom' && endpoint
        ? { mode: 'fixed_servers', proxyRules: `${proxy.user ? `${encodeURIComponent(proxy.user)}:${encodeURIComponent(proxy.pass || '')}@` : ''}${endpoint.host}:${endpoint.port}` }
        : { mode: 'system' };
    await Promise.all(sessions.map(async (siteSession) => {
      await siteSession.setProxy(proxyConfig);
      await siteSession.closeAllConnections();
    }));
    try {
      if (proxy.doh) app.configureHostResolver({ secureDnsMode: 'secure', secureDnsServers: ['https://cloudflare-dns.com/dns-query', 'https://dns.google/dns-query'] });
    } catch {}
  }

  function startMirrorHealthCheck() {
    if (mirrorHealthTimer) clearInterval(mirrorHealthTimer);
    mirrorHealthTimer = setInterval(() => {
      const win = getWindow();
      if (!win || win.isDestroyed()) return;
      probeMirrors().catch(() => {});
    }, 60000);
    probeMirrors().catch(() => {});
  }

  async function probeMirrors() {
    const siteList = config.siteList || [];
    const results = await Promise.all(siteList.map(async (site) => {
      const url = site.url;
      const started = Date.now();
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AnimeOn-Desktop' } });
        return { id: site.id, url, label: site.label, ok: res.ok || res.status < 500, status: res.status, ms: Date.now() - started };
      } catch (error) {
        return { id: site.id, url, label: site.label, ok: false, status: 0, ms: Date.now() - started, error: String(error?.message || error) };
      }
    }));
    lastMirrorHealthCheck = Date.now();
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('net:status', { ok: true, results, at: lastMirrorHealthCheck });
    return { ok: true, results };
  }

  function registerIpc() {
    ipcMain.handle('sites:fetch', async () => {
      try {
        const source = `https://raw.githubusercontent.com/Neukluziy/testip/refs/heads/main/ip.txt?v=${Date.now()}`;
        const res = await fetch(source, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#'));
        const sites = [];
        for (const line of lines) {
          const match = line.match(/^\s*([\w-]+)\s*=\s*(\S.*?)\s*$/);
          if (!match) continue;
          const value = match[2].trim();
          const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
          if (!['http:', 'https:'].includes(url.protocol)) continue;
          if (!url.pathname.endsWith('/')) url.pathname += '/';
          sites.push({ id: match[1].trim(), url: url.href, label: url.hostname });
        }
        if (sites.length < 2) throw new Error('бдыщь, не удалось получить список сайтов');
        config.siteList = sites.slice(0, 2);
        saveConfig();
        return { ok: true, sites: config.siteList, source, fetchedAt: new Date().toISOString() };
      } catch (error) {
        return { ok: false, error: String(error?.message || error), sites: config.siteList || [] };
      }
    });
    ipcMain.handle('sites:get', () => ({ ok: true, sites: config.siteList || [] }));

    ipcMain.handle('net:health', async () => {
      const siteList = config.siteList || [];
      const results = await Promise.all(siteList.map(async (site) => {
        const url = site.url;
        const started = Date.now();
        try {
          const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AnimeOn-Desktop' } });
          return { id: site.id, url, label: site.label, ok: res.ok || res.status < 500, status: res.status, ms: Date.now() - started };
        } catch (error) {
          return { id: site.id, url, label: site.label, ok: false, status: 0, ms: Date.now() - started, error: String(error?.message || error) };
        }
      }));
      const internet = results.some((site) => site.ok);
      return { ok: true, internet, available: internet, results };
    });

    ipcMain.handle('net:settings', () => ({ ok: true, proxy: config.network?.proxy || {}, doh: !!config.network?.doh, autoMirror: !!config.autoMirror }));

    ipcMain.handle('net:settings:set', async (_, patch) => {
      if (!patch || typeof patch !== 'object') return { ok: false, error: 'invalid patch' };
      let changed = false;
      const previousNetwork = { ...(config.network || {}) };
      const previousAutoMirror = config.autoMirror;
      if ('autoMirror' in patch && typeof patch.autoMirror === 'boolean') { config.autoMirror = patch.autoMirror; changed = true; }
      if ('proxy' in patch && typeof patch.proxy === 'object') {
        const p = patch.proxy;
        if (!p || !['system','direct','custom'].includes(p.mode)) return { ok: false, error: 'Неверный режим прокси' };
        const endpoint = p.mode === 'custom' ? parseProxyEndpoint(`${String(p.host || '').trim()}:${p.port ?? ''}`) : null;
        if (p.mode === 'custom' && !endpoint) return { ok: false, error: 'Укажи прокси в формате host:port с портом от 1 до 65535' };
        config.network = { ...(config.network || {}), mode: p.mode };
        if (p.mode === 'custom') {
          config.network.host = endpoint.host;
          config.network.port = endpoint.port;
        } else {
          if (typeof p.host === 'string') config.network.host = p.host.trim();
          if (Number.isInteger(p.port) && p.port > 0 && p.port <= 65535) config.network.port = p.port;
        }
        if (typeof p.user === 'string') { config.network.user = p.user; changed = true; }
        if (typeof p.pass === 'string') { config.network.pass = p.pass; changed = true; }
        changed = true;
      }
      if ('doh' in patch && typeof patch.doh === 'boolean') { config.network.doh = patch.doh; changed = true; }
      if (changed) {
        try {
          await applyNetworkSettings();
        } catch (error) {
          config.network = previousNetwork;
          config.autoMirror = previousAutoMirror;
          try { await applyNetworkSettings(); } catch {}
          return { ok: false, error: String(error?.message || 'Не удалось применить настройки сети') };
        }
        saveConfig();
      }
      return { ok: true, proxy: config.network, doh: config.network.doh, autoMirror: config.autoMirror };
    });

    ipcMain.handle('net:check-proxy', async () => {
      try {
        const { net: electronNet } = require('electron');
        const siteSession = session.fromPartition('persist:animeon');
        const target = (config.siteList && config.siteList[0] && config.siteList[0].url) || 'https://animeon.cc/';
        if (config.network?.mode === 'custom') {
          const endpoint = parseProxyEndpoint(`${config.network.host || ''}:${config.network.port || ''}`);
          if (!endpoint) return { ok: false, ms: 0, status: 0, error: 'Некорректный адрес прокси' };
          const resolvedProxy = await siteSession.resolveProxy(target);
          const expectedProxy = `${endpoint.host}:${endpoint.port}`.toLowerCase();
          const usesExpectedProxy = resolvedProxy.split(';').some((entry) =>
            entry.trim().replace(/^(?:proxy|https|socks[45]?)\s+/i, '').toLowerCase() === expectedProxy);
          if (!usesExpectedProxy) return { ok: false, ms: 0, status: 0, error: 'Соединение не использует указанный прокси' };
        }
        const started = Date.now();
        return await new Promise((resolve) => {
          let done = false;
          const finish = (value) => { if (!done) { done = true; resolve(value); } };
          try {
            const req = electronNet.request({ session: siteSession, method: 'GET', url: target, redirect: 'follow', headers: { Range: 'bytes=0-0' } });
            const timer = setTimeout(() => { try { req.abort(); } catch {} finish({ ok: false, ms: Date.now() - started, status: 0, error: 'timeout' }); }, 10000);
            req.on('response', (res) => { clearTimeout(timer); try { res.resume(); } catch {} finish({ ok: res.statusCode >= 200 && res.statusCode < 400, ms: Date.now() - started, status: res.statusCode }); });
            req.on('error', (error) => { clearTimeout(timer); finish({ ok: false, ms: Date.now() - started, status: 0, error: String(error?.message || error) }); });
            req.end();
          } catch (error) { finish({ ok: false, ms: Date.now() - started, status: 0, error: String(error?.message || error) }); }
        });
      } catch (error) {
        return { ok: false, ms: 0, status: 0, error: String(error?.message || error) };
      }
    });

    ipcMain.handle('app:connection-check', async () => {
      const results = [];
      const siteList = config.siteList || [
        { id: 'one', url: 'https://animeon.cc/', label: 'animeon.cc' },
        { id: 'two', url: 'https://v2.animeon.co/', label: 'v2.animeon.co' },
      ];
      for (const site of siteList) {
        const url = site.url;
        const started = Date.now();
        try {
          const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AnimeOn-Desktop' } });
          results.push({ url, ok: res.ok || res.status < 500, status: res.status, ms: Date.now() - started });
        } catch (error) {
          results.push({ url, ok: false, status: 0, ms: Date.now() - started, error: String(error?.message || error) });
        }
      }
      let api = { ok: false, status: 0, ms: 0, results: [] };
      try { api = await apiHealth(); } catch (error) { api = { ok: false, status: 0, ms: 0, results: [], error: String(error?.message || error) }; }
      const internet = results.some((result) => result.ok) || api.ok;
      writeLog(internet ? 'info' : 'warn', 'Проверка соединения', { internet, results, api });
      return { internet, api, results };
    });
  }

  return { applyNetworkSettings, registerIpc, startMirrorHealthCheck, probeMirrors };
}

module.exports = { createNetworkManager };
