function createMediaController({
  ipcMain,
  config,
  saveConfig,
  getWindow,
  getSiteContents,
  getTray,
  getLatestMediaState,
  setLatestMediaState,
  isTrustedAppEvent,
  updateMediaSession,
  updateThumbar,
  updateDiscordActivity,
  platform = process.platform,
}) {
  let volumeState = { volume: 100, muted: false };
  let mediaPollTimer = null;
  let lastResumeUrl = '';
  let lastPlaybackPersist = 0;
  let lastAutoNextUrl = '';

  function getGuestFrames() {
    const guest = getSiteContents();
    if (!guest || guest.isDestroyed()) return [];
    try {
      return guest.mainFrame.framesInSubtree.filter(frame => frame && !frame.isDestroyed());
    } catch {
      return [];
    }
  }

  async function executeGuest(script, userGesture = false) {
    const frames = getGuestFrames();
    if (!frames.length) return null;
    const results = await Promise.all(frames.map(frame => {
      try { return frame.executeJavaScript(script, userGesture).catch(() => null); } catch { return null; }
    }));
    return results.find(result => result !== null && result !== undefined) ?? null;
  }

  async function applyVolumeToGuest() {
    const state = volumeState;
    const script = `(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      if (!videos.length) return false;
      const level = ${state.volume};
      const muted = ${!!state.muted};
      window.__animeonVolume = level;
      for (const video of videos) {
        try {
          if (!video.__animeonGainContext) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) throw new Error('audio');
            const ctx = new Ctx();
            const source = ctx.createMediaElementSource(video);
            const gain = ctx.createGain();
            source.connect(gain);
            gain.connect(ctx.destination);
            video.__animeonGainContext = ctx;
            video.__animeonGainNode = gain;
          }
          if (video.__animeonGainContext.state === 'suspended') video.__animeonGainContext.resume().catch(() => {});
          video.volume = level <= 100 ? level / 100 : 1;
          video.__animeonGainNode.gain.value = level > 100 ? level / 100 : 1;
          video.muted = muted;
        } catch {
          video.volume = Math.min(1, level / 100);
          video.muted = muted;
        }
      }
      return true;
    })()`;
    await executeGuest(script, true);
  }

  async function setVolume(delta) {
    const change = Number(delta) || 0;
    volumeState.volume = Math.max(0, Math.min(200, volumeState.volume + change));
    await applyVolumeToGuest();
    return volumeState;
  }

  async function setMuted(value) {
    volumeState.muted = value === null ? !volumeState.muted : !!value;
    await applyVolumeToGuest();
    return volumeState;
  }

  async function applyPlaybackPreferences() {
    const speed = Number(config.playbackSpeed) || 1;
    const siteContents = getSiteContents();
    const resumeUrl = String(siteContents?.getURL?.() || '');
    const saved = resumeUrl && config.playbackPositions ? config.playbackPositions[resumeUrl] : null;
    const resume = config.resumeEnabled !== false && saved && Number(saved.time) > 3 ? Number(saved.time) : 0;
    if (resumeUrl && resumeUrl !== lastResumeUrl) lastResumeUrl = resumeUrl;
    await executeGuest(`(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      if (!videos.length) return false;
      const active = videos.find(v => !v.paused && !v.ended) || videos[0];
      for (const video of videos) video.playbackRate = ${speed};
      if (${resume > 0 ? 'true' : 'false'} && active.readyState >= 1 && Math.abs(active.currentTime - ${resume}) > 2) active.currentTime = Math.max(0, Math.min(Number.isFinite(active.duration) ? active.duration - 0.5 : ${resume}, ${resume}));
      return true;
    })()`, true);
  }

  function setPlaybackSpeed(value) {
    const allowed = [0.25,0.5,0.75,1,1.25,1.5,1.75,2];
    const speed = allowed.includes(Number(value)) ? Number(value) : 1;
    config.playbackSpeed = speed;
    saveConfig();
    return executeGuest(`(() => { const videos = Array.from(document.querySelectorAll('video')); for (const video of videos) video.playbackRate = ${speed}; return videos.length > 0; })()`).then(() => speed);
  }

  async function getSelectedDubbingFromFrames() {
    const script = `(() => {
      const clean = value => String(value || '').replace(/\\s+/g, ' ').trim();
      const voicePattern = /ТО Дубляжная|AniLibria(?:_TV)?|Crunchyroll_Subtitles|AniDUB|AnimeVost|Dream\\s*Cast|AniMaunt|FumoDub|JAM/i;
      const selectedSelector = '[aria-selected="true"],[aria-current="true"],[aria-pressed="true"],option:checked,input:checked,[class~="active"],[class~="selected"]';
      const textOf = element => clean(element?.value || element?.getAttribute('aria-label') || element?.title || element?.innerText || element?.textContent);
      const selected = Array.from(document.querySelectorAll(selectedSelector));
      const knownSelection = selected.map(textOf).map(value => value.match(voicePattern)?.[0]).find(Boolean);
      const voiceContainerSelector = '[class*="voice" i],[class*="dubb" i],[class*="translation" i],[data-type*="voice" i],[data-type*="dubb" i],[aria-label*="озвуч" i],[aria-label*="дубляж" i],[title*="озвуч" i],[title*="дубляж" i]';
      const scopedSelection = Array.from(document.querySelectorAll(voiceContainerSelector)).map(container => {
        if (container.matches('select')) return textOf(container.selectedOptions?.[0]);
        const option = container.matches('[aria-selected="true"],[aria-current="true"],[aria-pressed="true"],option:checked,input:checked')
          ? container
          : container.querySelector(selectedSelector);
        return option ? textOf(option) : '';
      }).find(Boolean);
      const voiceSelect = Array.from(document.querySelectorAll('select')).find(element => {
        const label = [element.id, element.name, element.className, element.getAttribute('aria-label'), element.title, element.closest('label')?.innerText].join(' ');
        return /voice|dubb|audio|translation|озвуч|дубляж|перевод/i.test(label);
      });
      const hasVideo = !!document.querySelector('video');
      return { hasVideo, dubbing: knownSelection || scopedSelection || (voiceSelect ? textOf(voiceSelect.selectedOptions?.[0]) : '') };
    })()`;
    const frames = getGuestFrames();
    const results = await Promise.all(frames.map(async frame => {
      try { return await frame.executeJavaScript(script, false); }
      catch { return null; }
    }));
    return results.find(result => result?.hasVideo && result.dubbing)?.dubbing
      || results.find(result => result?.dubbing)?.dubbing
      || '';
  }

  async function getMediaState() {
    const media = await executeGuest(`(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      if (!videos.length) return null;
      const active = videos.find(v => !v.paused && !v.ended) || videos.find(v => v.readyState >= 2) || videos[0];
      return {
        currentTime: Number(active.currentTime || 0),
        duration: Number.isFinite(active.duration) ? active.duration : 0,
        paused: !!active.paused,
        ended: !!active.ended,
        rate: Number(active.playbackRate || 1),
        src: active.currentSrc || active.src || '',
      };
    })()`);
    if (!media) return null;

    let page = {};
    const siteContents = getSiteContents();
    try {
      page = await siteContents.executeJavaScript(`(() => {
        const clean = value => String(value || '').replace(/\\s+/g, ' ').trim();
        const heading = clean(document.querySelector('h1')?.innerText);
        const metaTitle = clean(document.querySelector('meta[property="og:title"]')?.content);
        const stripSite = value => clean(value).replace(/\\s*[|·–—-]\\s*(?:AnimeOn|смотреть онлайн).*$/i, '').slice(0, 128);
        const animeTitle = stripSite(heading || metaTitle || document.title) || 'AnimeOn';
        const pageParams = new URL(location.href).searchParams;
        const episodePattern = /(?:эпизод|серия|эп\\.?|episode|ep\\.?)\\s*[№#]?\\s*(\\d{1,4})|(\\d{1,4})\\s*(?:эпизод|серия)/i;
        const seasonPattern = /(?:сезон|season)\\s*[№#]?\\s*(\\d{1,3})|(\\d{1,3})\\s*(?:сезон(?:а|ов|е)?|season)/i;
        const episodeNumber = value => {
          const text = clean(value);
          const match = text.match(episodePattern);
          return match ? match[1] || match[2] : /^\\d{1,4}$/.test(text) ? text : '';
        };
        const episodeNodes = Array.from(document.querySelectorAll('[data-episode],[data-episode-number],[class*="episode" i],[class*="series" i],[aria-current="true"],[aria-selected="true"],.active,.selected'));
        const episode = episodeNodes.map(element => episodeNumber(element.dataset.episode || element.dataset.episodeNumber || element.getAttribute('aria-label') || element.title || element.innerText || element.textContent)).find(Boolean)
          || pageParams.get('episode') || pageParams.get('episode_id') || pageParams.get('episodeId') || pageParams.get('ep')
          || clean(document.body?.innerText).match(episodePattern)?.[1]
          || clean(document.body?.innerText).match(episodePattern)?.[2]
          || '';
        const season = clean(document.body?.innerText).match(seasonPattern)?.[1]
          || clean(document.body?.innerText).match(seasonPattern)?.[2]
          || pageParams.get('season')
          || '';
        const voicePattern = /ТО Дубляжная|AniLibria(?:_TV)?|Crunchyroll_Subtitles|AniDUB|AnimeVost|Dream\\s*Cast|AniMaunt|FumoDub|JAM/i;
        const selectedSelector = '[aria-selected="true"],[aria-current="true"],[aria-pressed="true"],option:checked,input:checked,[class~="active"],[class~="selected"]';
        const selected = Array.from(document.querySelectorAll(selectedSelector));
        const selectedText = element => clean(element.value || element.getAttribute('aria-label') || element.title || element.innerText || element.textContent);
        const knownSelection = selected.map(element => selectedText(element).match(voicePattern)?.[0]).find(Boolean);
        const voiceContainerSelector = '[class*="voice" i],[class*="dubb" i],[class*="translation" i],[data-type*="voice" i],[data-type*="dubb" i],[aria-label*="озвуч" i],[aria-label*="дубляж" i],[title*="озвуч" i],[title*="дубляж" i]';
        const scopedSelection = Array.from(document.querySelectorAll(voiceContainerSelector)).map(container => {
          if (container.matches('select')) return selectedText(container.selectedOptions?.[0]);
          const option = container.matches(selectedSelector) ? container : container.querySelector(selectedSelector);
          return option ? selectedText(option) : '';
        }).find(Boolean);
        const dubbing = knownSelection || scopedSelection || '';
        const safeSiteUrl = value => {
          try {
            const url = new URL(value, location.href);
            return /^https?:$/.test(url.protocol) && /(^|\\.)animeon\\.(?:cc|co)$/i.test(url.hostname) ? url.href : '';
          } catch { return ''; }
        };
        const animeUrlFor = value => {
          const valueUrl = safeSiteUrl(value);
          if (!valueUrl) return '';
          const url = new URL(valueUrl);
          const path = url.pathname.match(/^\\/anime\\/[^/]+/i)?.[0];
          return path ? url.origin + path : '';
        };
        const titleKey = animeTitle.toLocaleLowerCase();
        const link = Array.from(document.querySelectorAll('a[href*="/anime/"]')).find(anchor => {
          const text = clean(anchor.innerText || anchor.textContent).toLocaleLowerCase();
          return text && (text.includes(titleKey) || titleKey.includes(text));
        });
        const watchUrl = safeSiteUrl(location.href);
        const animeUrl = animeUrlFor(location.href) || animeUrlFor(document.querySelector('link[rel="canonical"]')?.href)
          || animeUrlFor(document.querySelector('meta[property="og:url"]')?.content) || animeUrlFor(link?.href) || watchUrl;
        return { animeTitle, episode, season, dubbing, animeUrl, watchUrl };
      })()`);
    } catch {}

    const frameDubbing = await getSelectedDubbingFromFrames().catch(() => '');
    return {
      ...media,
      ...page,
      dubbing: frameDubbing,
      title: page.animeTitle || media.title || 'AnimeOn',
      animeTitle: page.animeTitle || media.animeTitle || media.title || 'AnimeOn',
    };
  }

  async function pollMediaState() {
    const win = getWindow();
    const siteContents = getSiteContents();
    if (!win || win.isDestroyed() || !siteContents || siteContents.isDestroyed()) return;
    try {
      const state = await getMediaState();
      const url = String(siteContents.getURL?.() || '');
      if (!state) {
        win.webContents.send('media-state', { available: false, url });
        updateThumbar({ available: false });
        setLatestMediaState(null);
        updateDiscordActivity();
        return;
      }
      const payload = { available: true, url, ...state };
      win.webContents.send('media-state', payload);
      updateMediaSession(payload);
      updateThumbar(payload);
      setLatestMediaState(payload);
      updateDiscordActivity();
      const tray = getTray();
      if (platform === 'win32' && tray) tray.setToolTip(payload.title ? `AnimeOn — ${String(payload.title).slice(0, 70)}` : 'AnimeOn');
      if (config.autoNext && state.ended && url && url !== lastAutoNextUrl) {
        lastAutoNextUrl = url;
        setTimeout(() => mediaAction('next'), 350);
      }
      if (!state.ended && url !== lastAutoNextUrl) lastAutoNextUrl = '';
      if (url && /^https:\/\/(?:www\\.)?animeon\\.(?:cc|co)\\//i.test(url) && state.duration > 0 && state.currentTime >= 0) {
        const now = Date.now();
        if (now - lastPlaybackPersist >= 5000) {
          lastPlaybackPersist = now;
          config.playbackPositions[url] = { time: Math.round(state.currentTime * 10) / 10, duration: Math.round(state.duration * 10) / 10, title: String(state.title || '').slice(0, 180), updatedAt: new Date().toISOString() };
          const entries = Object.entries(config.playbackPositions).sort((a,b) => String(b[1]?.updatedAt || '').localeCompare(String(a[1]?.updatedAt || ''))).slice(0, 300);
          config.playbackPositions = Object.fromEntries(entries);
          saveConfig();
        }
      }
    } catch {}
  }

  function startMediaPolling() {
    if (mediaPollTimer) clearInterval(mediaPollTimer);
    mediaPollTimer = setInterval(() => pollMediaState(), 1000);
  }

  function togglePictureInPicture() {
    return executeGuest(`(async () => {
      const videos = Array.from(document.querySelectorAll('video'));
      if (!videos.length) return { ok:false, reason:'no-video' };
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return { ok:true, active:false }; }
      const active = videos.find(v => !v.paused && !v.ended) || videos[0];
      if (!active.requestPictureInPicture) return { ok:false, reason:'unsupported' };
      await active.requestPictureInPicture();
      return { ok:true, active:true };
    })()`, true);
  }

  async function inspectPlaybackOptions() {
    const result = await executeGuest(`(() => {
      const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim();
      const textOf = el => normalize(el?.innerText || el?.textContent || el?.getAttribute('aria-label') || el?.title || '');
      const selectors = 'button,a,[role="button"],option';
      const nodes = Array.from(document.querySelectorAll(selectors));
      const qualityRx = /(?:2160|1440|1080|720|576|480|360)p?|4k|ultra|full hd|hd/i;
      const dubRx = /озвуч|дубляж|voice|dub|anilibria|anidub|dream ?cast|shiza|jam|studio band|студийн/i;
      const quality = [...new Set(nodes.map(textOf).filter(x => qualityRx.test(x)).slice(0, 40))];
      const dubbing = [...new Set(nodes.map(textOf).filter(x => dubRx.test(x)).slice(0, 60))];
      const sources = [...new Set(nodes.map(textOf).filter(x => /источник|source|плеер|player|kodik|alloha|sibnet|lumex|collaps|cdn/i.test(x)).slice(0, 40))];
      return { quality, dubbing, sources, url: location.href, title: document.title };
    })()`);
    return result || { quality: [], dubbing: [], sources: [] };
  }

  async function selectPlaybackOption(kind, value) {
    const target = String(value || '').trim();
    if (!target || !['quality', 'dubbing', 'source'].includes(kind)) return { ok: false, reason: 'invalid' };
    const result = await executeGuest(`(() => {
      const target = ${JSON.stringify(target)};
      const kind = ${JSON.stringify(kind)};
      const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const needle = normalize(target);
      const nodes = Array.from(document.querySelectorAll('button,a,[role="button"],option'));
      const el = nodes.find(node => normalize(node.innerText || node.textContent || node.getAttribute('aria-label') || node.title).includes(needle));
      if (!el) return { ok:false, reason:'not-found', kind, value:target };
      try { el.click(); } catch {}
      return { ok:true, kind, value:target };
    })()`, true);
    return result || { ok: false, reason: 'not-found' };
  }

  async function smartSelectPlayback(preferences = {}) {
    const options = await inspectPlaybackOptions();
    const prefs = {
      dubbing: Array.isArray(preferences.dubbing) ? preferences.dubbing : [],
      quality: Array.isArray(preferences.quality) ? preferences.quality : [],
      source: Array.isArray(preferences.source) ? preferences.source : [],
    };
    const choose = async (kind, available, preferred) => {
      for (const pref of preferred) {
        const exact = available.find(item => String(item).toLowerCase() === String(pref).toLowerCase());
        const partial = available.find(item => String(item).toLowerCase().includes(String(pref).toLowerCase()));
        const selected = exact || partial;
        if (selected) return selectPlaybackOption(kind, selected);
      }
      return { ok:false, reason:'no-preference-match' };
    };
    const dubbing = await choose('dubbing', options.dubbing, prefs.dubbing);
    const quality = await choose('quality', options.quality, prefs.quality);
    const source = await choose('source', options.sources, prefs.source);
    return { ok: dubbing.ok || quality.ok || source.ok, options, selected: { dubbing, quality, source } };
  }

  async function smartFallback(preferences = {}) {
    const attempts = [];
    const sourcePrefs = Array.isArray(preferences.source) ? preferences.source : [];
    const options = await inspectPlaybackOptions();
    const candidates = [...sourcePrefs, ...options.sources].filter(Boolean);
    for (const candidate of [...new Set(candidates)]) {
      const result = await selectPlaybackOption('source', candidate);
      attempts.push({ candidate, ok: !!result?.ok });
      if (result?.ok) return { ok:true, selected:candidate, attempts, options };
    }
    return { ok:false, attempts, options };
  }

  function seekVideo(seconds) {
    return executeGuest(`(() => { const v = Array.from(document.querySelectorAll('video')); if (!v.length) return false; const active = v.find(x => !x.paused && !x.ended) || v[0]; active.currentTime = Math.max(0, Math.min(Number.isFinite(active.duration) ? active.duration : active.currentTime + ${Number(seconds)}, active.currentTime + ${Number(seconds)})); return true; })()`);
  }

  function togglePlayback() {
    const guest = getSiteContents();
    if (!guest || guest.isDestroyed()) return;
    try {
      guest.executeJavaScript(`(() => {
          const videos = Array.from(document.querySelectorAll('video'));
          if (!videos.length) return false;
          const active = videos.find(v => !v.paused && !v.ended) || videos[0];
          if (active.paused || active.ended) {
            const p = active.play();
            if (p?.catch) p.catch(() => {});
          } else {
            active.pause();
          }
          return true;
        })()`, false).catch(() => {});
    } catch {}
  }

  function mediaAction(action) {
    if (action === 'playpause') return togglePlayback();
    if (action === 'next') return executeGuest(`(() => { const selectors = ['[aria-label*="next" i]','[title*="next" i]','button[class*="next" i]','a[class*="next" i]']; const el = selectors.map(s => document.querySelector(s)).find(Boolean); if (el) { el.click(); return true; } const text = Array.from(document.querySelectorAll('button,a')).find(x => /следующ|next/i.test(x.innerText || x.getAttribute('aria-label') || x.title || '')); if (text) { text.click(); return true; } return false; })()`);
    if (action === 'previous') return executeGuest(`(() => { const selectors = ['[aria-label*="previous" i]','[aria-label*="prev" i]','[title*="previous" i]','[title*="prev" i]','button[class*="prev" i]','a[class*="prev" i]']; const el = selectors.map(s => document.querySelector(s)).find(Boolean); if (el) { el.click(); return true; } const text = Array.from(document.querySelectorAll('button,a')).find(x => /предыдущ|previous|prev/i.test(x.innerText || x.getAttribute('aria-label') || x.title || '')); if (text) { text.click(); return true; } return false; })()`);
  }

  function registerIpc() {
    ipcMain.on('media:volume', (_, delta) => setVolume(Number(delta) || 0).then(v => { const win = getWindow(); if (v && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'volume', value: v.volume, muted: v.muted }); }));
    ipcMain.handle('media:volume-state', () => volumeState);
    ipcMain.handle('media:state', async () => { const state = await getMediaState(); const siteContents = getSiteContents(); return { available: !!state, url: String(siteContents?.getURL?.() || ''), ...(state || {}) }; });
    ipcMain.handle('media:seek-to', async (event, seconds) => {
      if (!isTrustedAppEvent(event)) return { ok: false };
      const target = Math.max(0, Number(seconds) || 0);
      try {
        const ok = await executeGuest(`(() => { const video = Array.from(document.querySelectorAll('video')).find(item => !item.paused && !item.ended) || document.querySelector('video'); if (!video) return false; video.currentTime = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : ${target}, ${target})); return true; })()`);
        return { ok: !!ok };
      } catch { return { ok: false }; }
    });
    ipcMain.handle('media:speed', async (_, value) => { try { return { ok:true, speed: await setPlaybackSpeed(value) }; } catch (e) { return { ok:false, error:String(e?.message || e) }; } });
    ipcMain.handle('media:pip', async () => { try { return await togglePictureInPicture(); } catch (e) { return { ok:false, reason:String(e?.message || e) }; } });
    ipcMain.handle('media:options', async () => { try { return await inspectPlaybackOptions(); } catch (e) { return { quality:[], dubbing:[], sources:[], error:String(e?.message || e) }; } });
    ipcMain.handle('media:select-option', async (_, kind, value) => { try { return await selectPlaybackOption(kind, value); } catch (e) { return { ok:false, reason:String(e?.message || e) }; } });
    ipcMain.handle('media:smart-select', async (_, preferences) => { try { return await smartSelectPlayback(preferences || {}); } catch (e) { return { ok:false, error:String(e?.message || e) }; } });
    ipcMain.handle('media:fallback', async (_, preferences) => { try { return await smartFallback(preferences || {}); } catch (e) { return { ok:false, error:String(e?.message || e) }; } });
    ipcMain.on('media:mute', () => setMuted(null).then(v => { const win = getWindow(); if (v && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'volume', value: v.volume, muted: v.muted }); }));
    ipcMain.on('media:seek', (_, seconds) => { const n = Number(seconds) || 0; seekVideo(n).then(ok => { const win = getWindow(); if (ok && win && !win.isDestroyed()) win.webContents.send('media-overlay', { type: 'seek', value: n }); }); });
    ipcMain.on('media:action', (_, action) => mediaAction(action));
  }

  return {
    applyPlaybackPreferences,
    applyVolumeToGuest,
    getLatestMediaState,
    getMediaState,
    mediaAction,
    registerIpc,
    seekVideo,
    setMuted,
    setPlaybackSpeed,
    setVolume,
    startMediaPolling,
    togglePlayback,
  };
}

module.exports = { createMediaController };
