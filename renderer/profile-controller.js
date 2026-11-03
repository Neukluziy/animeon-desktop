function createProfileController({
  cfg,
  controls,
  store,
  toast,
  getCurrentSite,
  getActiveTheme,
  applyTheme,
  siteAppearance,
  appConstants,
  loadSiteEditor,
  applyGuestStyles,
  applyEffectsMode,
}) {
  let profileValue = '';
  const { profileSelect, styleProfileName, saveButton, loadButton, deleteButton } = controls;

  function refreshProfiles() {
    if (!profileSelect) return;
    const list = profileSelect.root.querySelector('.cselect-list');
    list.innerHTML = '';
    Object.keys(cfg.profiles || {}).sort().forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.value = name;
      button.innerHTML = '<span class="cselect-t"><b></b></span><svg class="cselect-check" viewBox="0 0 24 24"><path d="M5 13l4 4 10-11"/></svg>';
      button.querySelector('b').textContent = name;
      list.appendChild(button);
    });
    const selected = (cfg.profiles || {})[profileValue] ? profileValue : '';
    profileValue = selected;
    const label = profileSelect.root.querySelector('.cselect-label');
    if (selected) profileSelect.pick(selected);
    else {
      profileSelect.root.dataset.value = '';
      if (label) {
        label.textContent = 'Выберите профиль';
        label.classList.add('dim');
      }
    }
  }

  saveButton?.addEventListener('click', () => {
    const name = (styleProfileName?.value || '').trim();
    if (!name) {
      toast('Введите название профиля', 'error');
      return;
    }
    const key = getCurrentSite() === 'co' ? 'co' : 'cc';
    if (!cfg.profiles || typeof cfg.profiles !== 'object') cfg.profiles = {};
    cfg.profiles[name] = {
      theme: getActiveTheme(),
      visual: siteAppearance.getVisual(),
      effectMode: cfg.effectMode || 'full',
      smoothSite: cfg.smoothSite !== false,
      showSiteScrollbars: !!cfg.showSiteScrollbars,
      css: cfg.customCss?.[key] || '',
      resumeEnabled: cfg.resumeEnabled !== false,
      autoNext: !!cfg.autoNext,
      notify: !!cfg.notify,
      doNotDisturb: !!cfg.doNotDisturb,
      performance: cfg.performance || 'balanced',
      lowPower: !!cfg.lowPower,
      memorySaver: !!cfg.memorySaver,
      autoCacheCleanup: cfg.autoCacheCleanup !== false,
      cacheLimitMB: Number.isFinite(Number(cfg.cacheLimitMB)) ? Number(cfg.cacheLimitMB) : appConstants.defaultCacheLimitMb,
      playbackSpeed: Number(cfg.playbackSpeed) || 1,
      hotkeys: { ...(cfg.hotkeys || {}) },
    };
    store('profiles', cfg.profiles);
    refreshProfiles();
    profileValue = name;
    profileSelect?.pick(name);
    toast('Профиль сохранён');
  });

  loadButton?.addEventListener('click', () => {
    const profile = cfg.profiles?.[profileValue];
    if (!profile) {
      toast('Выберите профиль', 'error');
      return;
    }
    applyTheme(profile.theme || 'violet', { skipSave: false });
    cfg.visual = profile.visual || siteAppearance.getVisual();
    cfg.effectMode = ['full', 'moderate', 'minimum'].includes(profile.effectMode) ? profile.effectMode : 'full';
    cfg.smoothSite = profile.smoothSite !== false;
    cfg.showSiteScrollbars = !!profile.showSiteScrollbars;
    cfg.resumeEnabled = profile.resumeEnabled !== false;
    cfg.autoNext = !!profile.autoNext;
    cfg.notify = !!profile.notify;
    cfg.doNotDisturb = !!profile.doNotDisturb;
    cfg.performance = profile.performance || 'balanced';
    cfg.lowPower = !!profile.lowPower;
    cfg.memorySaver = !!profile.memorySaver;
    cfg.autoCacheCleanup = profile.autoCacheCleanup !== false;
    const profileCacheLimit = Number(profile.cacheLimitMB);
    cfg.cacheLimitMB = Number.isFinite(profileCacheLimit) && profileCacheLimit >= 0
      ? profileCacheLimit
      : appConstants.defaultCacheLimitMb;
    cfg.playbackSpeed = Number(profile.playbackSpeed) || 1;
    cfg.hotkeys = { ...(profile.hotkeys || cfg.hotkeys || {}) };
    const key = getCurrentSite() === 'co' ? 'co' : 'cc';
    if (!cfg.customCss) cfg.customCss = { cc: '', co: '' };
    cfg.customCss[key] = profile.css || '';
    store('visual', cfg.visual);
    store('effectMode', cfg.effectMode);
    applyEffectsMode();
    store('smoothSite', cfg.smoothSite);
    store('showSiteScrollbars', cfg.showSiteScrollbars);
    store('customCss', cfg.customCss);
    siteAppearance.syncVisualUI();
    loadSiteEditor();
    applyGuestStyles();
    if (controls.resumeToggle) controls.resumeToggle.checked = cfg.resumeEnabled !== false;
    if (controls.autoNextToggle) controls.autoNextToggle.checked = !!cfg.autoNext;
    if (controls.notifyToggle) controls.notifyToggle.checked = !!cfg.notify;
    if (controls.memorySaverToggle) controls.memorySaverToggle.checked = !!cfg.memorySaver;
    if (controls.cacheAutoToggle) controls.cacheAutoToggle.checked = cfg.autoCacheCleanup !== false;
    if (controls.cacheLimit) controls.cacheLimit.value = cfg.cacheLimitMB === 0 ? '∞' : String(cfg.cacheLimitMB);
    toast('Профиль загружен');
  });

  deleteButton?.addEventListener('click', () => {
    if (!profileValue || !cfg.profiles?.[profileValue]) {
      toast('Выберите профиль', 'error');
      return;
    }
    delete cfg.profiles[profileValue];
    store('profiles', cfg.profiles);
    refreshProfiles();
    toast('Профиль удалён');
  });

  return { refreshProfiles };
}

export { createProfileController };
