function createMainWindowFactory({
  app,
  BrowserWindow,
  fs,
  path,
  nativeImage,
  appDir,
  config,
  loadWindowState,
  handleLocalHotkey,
  isQuitting,
  setWindow,
  ensureTray,
  saveWindowState,
  setupJumpList,
  applyNetworkSettings,
  setSiteContents,
  setTaskbarOverlay,
  applyPlaybackPreferences,
  applyVolumeToGuest,
  buildVisualCss,
  rememberRecentPage,
  TELEGRAM_RE,
  SITE_RE,
  isTrustedAuthUrl,
  isAuthFlowUrl,
  shell,
  openTelegramExternal,
}) {
  let win = null;
function createWindow() {
  try{ app.setAppUserModelId('co.animeon.desktop'); }catch{}
  const ws = loadWindowState();
  let winIcon;
  try{
    const icoPath=path.join(appDir, '../assets', 'logo.ico');
    const pngPath=path.join(appDir, '../assets', 'logo.png');
    if(fs.existsSync(icoPath)) winIcon=nativeImage.createFromPath(icoPath);
    else if(fs.existsSync(pngPath)) winIcon=nativeImage.createFromPath(pngPath);
  }catch{}
  win = new BrowserWindow({
    width: ws.width,
    height: ws.height,
    x: Number.isFinite(ws.x) ? ws.x : undefined,
    y: Number.isFinite(ws.y) ? ws.y : undefined,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#0a0a0a',
    frame: false,
    show: false,
    icon: winIcon || path.join(appDir, '../assets', 'logo.ico'),
    title: 'AnimeOn',
    webPreferences: {
      preload: path.join(appDir, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: true,
      spellcheck: false,
    },
  });
  setWindow(win);

  win.once('ready-to-show', () => { try{ if(winIcon && !winIcon.isEmpty()) win.setIcon(winIcon); }catch{} win.show(); });
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(!!config.alwaysOnTop);
  try { win.webContents.setZoomFactor(1); } catch {}
  try { win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {}); } catch {}
  win.webContents.once('did-finish-load', () => {
    try { win.webContents.setZoomFactor(1); } catch {}
    try { win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {}); } catch {}
  });
  win.loadFile(path.join(appDir, '../index.html'));
  if (ws.maximized) win.maximize();

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (handleLocalHotkey(input, e)) return;
    if (input.control && ['+', '=', '-', '_', '0'].includes(input.key)) { e.preventDefault(); return; }
    const isDevToolsCombo = input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i');
    if (!isDevToolsCombo) return;
    try {
      if (win.webContents.isDevToolsOpened()) { win.webContents.closeDevTools(); e.preventDefault(); return; }
      try {
        win.webContents.openDevTools({ mode: 'detach', activate: true });
      } catch {
        try { win.webContents.openDevTools({ mode: 'right', activate: true }); }
        catch { win.webContents.toggleDevTools(); }
      }
    } catch {}
    e.preventDefault();
  });

  win.webContents.on('unresponsive', () => {
    console.error('[AnimeOn] Главное окно перестало отвечать (зависший рендерер).');
  });
  win.webContents.on('responsive', () => {
    console.error('[AnimeOn] Главное окно снова отвечает.');
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[AnimeOn] Рендерер главного окна упал:', details && details.reason);
    if (config.autoRecovery && win && !win.isDestroyed()) {
      try { win.loadFile(path.join(appDir, '../index.html')); } catch {}
    }
  });
  let boundsSaveTimer = null;
  const saveBounds = () => {
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => saveWindowState(), 180);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  win.on('unmaximize', saveBounds);
  win.on('maximize', saveBounds);

  const ua = win.webContents.getUserAgent().replace(/\sElectron\/[\d.]+/i, '');
  win.webContents.session.setUserAgent(ua, 'ru-RU,ru');

  win.on('maximize', () => win.webContents.send('win-state', true));
  win.on('unmaximize', () => win.webContents.send('win-state', false));
  win.on('enter-full-screen', () => win.webContents.send('fs-state', true));
  win.on('leave-full-screen', () => win.webContents.send('fs-state', false));

  win.on('close', (e) => {
    if (!isQuitting() && config.tray) {
      e.preventDefault();
      ensureTray();
      win.hide();
      return;
    }
    if (!isQuitting() && config.closeBehavior === 'ask') {
      e.preventDefault();
      win.webContents.send('confirm-close');
      return;
    }
    if (!isQuitting() && config.closeBehavior === 'tray') {
      e.preventDefault();
      ensureTray();
      win.hide();
      return;
    }
    saveWindowState();
  });

  setupJumpList();
  applyNetworkSettings().catch((error) => console.error('[AnimeOn] Failed to apply network settings:', error));

  const siteSession = win.webContents.session;
  siteSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...(details.responseHeaders || {}) };
    try {
      const requestUrl = new URL(details.url);
      const origin = String(details.requestHeaders?.Origin || details.requestHeaders?.origin || '');
      if (origin && /(^|\.)animeon\.(cc|co)$/i.test(new URL(origin).hostname) && /(^|\.)animeon\.cloud$/i.test(requestUrl.hostname)) {
        const key = Object.keys(headers).find(k => k.toLowerCase() === 'access-control-allow-origin');
        if (key) delete headers[key];
        headers['Access-Control-Allow-Origin'] = [origin];
        const credKey = Object.keys(headers).find(k => k.toLowerCase() === 'access-control-allow-credentials');
        if (credKey) delete headers[credKey];
        headers['Access-Control-Allow-Credentials'] = ['true'];
      }
    } catch {}
    callback({ responseHeaders: headers });
  });

  const configuredSiteSessions = new WeakSet();
  win.webContents.on('did-attach-webview', (_, wc) => {
    setSiteContents(wc);
    try { wc.setBackgroundThrottling(config.performance === 'economy'); } catch {}
    try { wc.setVisualZoomLevelLimits(1, 1).catch(() => {}); } catch {}
    try {
      const session = wc.session;
      const ua = win.webContents.getUserAgent().replace(/\sElectron\/[\d.]+/i, '');
      session.setUserAgent(ua, 'ru-RU,ru');
      if (!configuredSiteSessions.has(session)) {
        configuredSiteSessions.add(session);
        session.webRequest.onHeadersReceived((details, callback) => {
          const headers={...(details.responseHeaders||{})};
          try {
            const requestUrl=new URL(details.url);
            const origin=String(details.requestHeaders?.Origin||details.requestHeaders?.origin||'');
            const allowedOrigin=origin && /(^|\.)animeon\.(cc|co)$/i.test(new URL(origin).hostname);
            const isCloud=/(^|\.)animeon\.cloud$/i.test(requestUrl.hostname);
            if (allowedOrigin && isCloud) {
              for (const key of Object.keys(headers)) {
                if (/^access-control-allow-(origin|credentials|methods|headers)$/i.test(key)) delete headers[key];
              }
              headers['Access-Control-Allow-Origin']=[origin];
              headers['Access-Control-Allow-Credentials']=['true'];
              headers['Access-Control-Allow-Methods']=['GET,HEAD,OPTIONS'];
              headers['Access-Control-Allow-Headers']=['Range,Origin,Accept,Content-Type,Authorization'];
              headers['Access-Control-Expose-Headers']=['Content-Length,Content-Range,Accept-Ranges'];
            }
          } catch {}
          callback({responseHeaders:headers});
        });
      }
    } catch {}
    wc.on('render-process-gone', () => {
      setTaskbarOverlay('error');
      if (config.autoRecovery && win && !win.isDestroyed()) {
        setTimeout(() => { try { wc.reload(); } catch {} }, 700);
      }
    });
    wc.on('dom-ready', async () => {
      setTimeout(() => applyPlaybackPreferences().catch(() => {}), 500);
      try {
        await wc.executeJavaScript(`(() => {
          if (!('mediaSession' in navigator)) return false;
          const pick = () => Array.from(document.querySelectorAll('video')).find(v => !v.paused && !v.ended) || document.querySelector('video');
          const run = (fn) => { try { const v=pick(); if(v) fn(v); } catch {} };
          const handlers = {
            play: () => run(v => v.play()),
            pause: () => run(v => v.pause()),
            seekbackward: () => run(v => { v.currentTime=Math.max(0,v.currentTime-10); }),
            seekforward: () => run(v => { v.currentTime=Math.min(v.duration||Infinity,v.currentTime+10); }),
            nexttrack: () => document.querySelector('[aria-label*="next" i],[title*="next" i],[class*="next" i]')?.click(),
            previoustrack: () => document.querySelector('[aria-label*="previous" i],[title*="previous" i],[class*="previous" i]')?.click(),
          };
          for (const [name, fn] of Object.entries(handlers)) { try { navigator.mediaSession.setActionHandler(name, fn); } catch {} }
          return true;
        })()`, false);
      } catch {}
      try {
        const css = config.customCss && typeof config.customCss === 'object' ? String(config.customCss[config.site === 'co' ? 'co' : 'cc'] || '') : '';
        const injected = `${buildVisualCss()}\n${css}`;
        if (injected.trim()) {
          await wc.executeJavaScript(`(() => {
            const id='__animeon_custom_css__';
            let el=document.getElementById(id);
            if(!el){el=document.createElement('style');el.id=id;(document.head||document.documentElement).appendChild(el);}
            el.textContent=${JSON.stringify(injected)};
          })()`, true);
          }
      } catch {}
      try {
        const imgs = await wc.executeJavaScript(`Array.from(document.images).map(i=>i.currentSrc||i.src).filter(Boolean).filter(u=>/^https?:\/\//i.test(u)).slice(0,10)`, false);
        if (Array.isArray(imgs) && imgs.length) win?.webContents.send('mirror-posters', imgs);
      } catch {}
    });
    wc.on('did-frame-finish-load', () => { applyVolumeToGuest().catch(() => {}); applyPlaybackPreferences().catch(() => {}); });
    wc.on('will-navigate', (event, url) => {
      if (TELEGRAM_RE.test(url) || /^tg:/i.test(url)) {
        event.preventDefault();
        openTelegramExternal(url);
        return;
      }
      if (!SITE_RE.test(url) && !isTrustedAuthUrl(url)) {
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch?.(() => {});
      }
    });
    wc.on('will-redirect', (event, url) => {
      if (TELEGRAM_RE.test(url) || /^tg:/i.test(url)) {
        event.preventDefault();
        openTelegramExternal(url);
        return;
      }
      if (!SITE_RE.test(url) && !isTrustedAuthUrl(url)) {
        event.preventDefault();
        if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch?.(() => {});
      }
    });
    const rememberWcPage = async (url) => {
      try { const title=await wc.executeJavaScript('document.title||\"\"',false); rememberRecentPage(url,title); }
      catch { rememberRecentPage(url,''); }
    };
    wc.on('did-navigate', (_, url) => { rememberWcPage(url); });
    wc.on('did-navigate-in-page', (_, url) => { rememberWcPage(url); });
    wc.on('did-finish-load', () => { try { rememberWcPage(wc.getURL()); } catch {} });
    wc.setWindowOpenHandler(({ url }) => {
      if (TELEGRAM_RE.test(url)) {
        openTelegramExternal(url);
        return { action: 'deny' };
      }

      const isAuth = isAuthFlowUrl(url);

      if (isAuth) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 520,
            height: 700,
            autoHideMenuBar: true,
            title: 'Вход в аккаунт',
            backgroundColor: '#0f0d14',
            icon: path.join(appDir, '../assets', 'logo.ico'),
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              webSecurity: true,
              allowRunningInsecureContent: false,
            },
          },
        };
      }
      if (SITE_RE.test(url)) {
        wc.loadURL(url);
        return { action: 'deny' };
      }
      if (/^tg:/i.test(url)) {
        openTelegramExternal(url);
        return { action: 'deny' };
      }
      if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch?.(() => {});
      return { action: 'deny' };
    });

    wc.on('did-create-window', (childWin) => {
      let sawAuth = false;
      const checkNav = (_, u) => {
        if (isAuthFlowUrl(u) || TELEGRAM_RE.test(u)) sawAuth = true;
        else if (SITE_RE.test(u) && sawAuth) {
          setTimeout(() => {
            if (!childWin.isDestroyed()) childWin.close();
            wc.reload();
          }, 700);
        }
      };
      childWin.webContents.on('did-navigate', checkNav);
      childWin.webContents.on('did-navigate-in-page', checkNav);
      childWin.webContents.setWindowOpenHandler(({ url }) => {
        if (TELEGRAM_RE.test(url)) {
          shell.openExternal(url).catch?.(() => {});
          return { action: 'deny' };
        }
        if (isAuthFlowUrl(url)) return { action: 'allow' };
        if (SITE_RE.test(url)) { wc.loadURL(url); return { action: 'deny' }; }
        if (/^tg:/i.test(url)) {
          openTelegramExternal(url);
          return { action: 'deny' };
        }
        if (/^https?:\/\//i.test(url)) { shell.openExternal(url).catch?.(() => {}); return { action: 'deny' }; }
        return { action: 'deny' };
      });
      childWin.on('closed', () => {
        if (sawAuth && !wc.isDestroyed()) {
          setTimeout(() => { try { wc.reload(); } catch {} }, 500);
        }
      });
    });

    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      if (handleLocalHotkey(input, e)) return;
      if (input.control && input.key.toLowerCase() === 'f') { win?.webContents.send('find-open'); e.preventDefault(); return; }
      if (input.control && input.key.toLowerCase() === 'tab') { win?.webContents.send('tabs-cycle', input.shift ? -1 : 1); e.preventDefault(); return; }
      if (input.key === 'F5') { wc.reload(); e.preventDefault(); }
      else if (input.control && input.key.toLowerCase() === 'r') { wc.reload(); e.preventDefault(); }
      else if (input.control && (input.key === '+' || input.key === '=')) {
        const z = Math.min(3, wc.getZoomFactor() + 0.1);
        wc.setZoomFactor(z);
        e.preventDefault();
      }
      else if (input.control && (input.key === '-' || input.key === '_')) {
        const z = Math.max(0.5, wc.getZoomFactor() - 0.1);
        wc.setZoomFactor(z);
        e.preventDefault();
      }
      else if (input.control && input.key === '0') {
        wc.setZoomFactor(1);
        e.preventDefault();
      }
      else if (input.key === 'F12') { try { if (wc.isDevToolsOpened()) wc.closeDevTools(); else wc.openDevTools({ mode: 'detach', activate: true }); } catch { try { wc.toggleDevTools(); } catch {} } e.preventDefault(); }
      else if (input.alt && input.key === 'ArrowLeft') { wc.goBack(); e.preventDefault(); }
      else if (input.alt && input.key === 'ArrowRight') { wc.goForward(); e.preventDefault(); }
    });
  });
}
  return createWindow;
}

module.exports = { createMainWindowFactory };
