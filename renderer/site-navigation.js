function initSiteNavigation({
  sites,
  cfg,
  store,
  native,
  getCurrentSite,
  setCurrentSite,
  getPageTabs,
  setPageTabs,
  getActiveTab,
  getTabWebviews,
  createTabWebview,
  showTabWebview,
  loadTabUrl,
  saveTabs,
  loadSiteEditor,
  accessKeyFeature,
  toast,
  isFirstLaunch,
  setFirstLaunch,
  setPosterWall,
  getPendingPosterUrls,
  setPendingPosterUrls,
  elements,
}) {
  const { btnSite, picker, welcomeScreen, welcomeContinue, rememberPick, rememberSettings, btnContinue } = elements;

  function getOtherSiteId() {
    const keys = Object.keys(sites);
    if (keys.length < 2) return keys[0] || 'cc';
    return keys.find((key) => key !== getCurrentSite()) || keys[0];
  }

  function updateMirrorBtn() {
    const currentSite = getCurrentSite();
    if (!currentSite) return;
    const otherSiteId = getOtherSiteId();
    btnSite.title = `Сейчас ${sites[currentSite].label} — переключить на ${sites[otherSiteId].label}`;
  }

  function activateSite(id, { save = true, updatePicker = true } = {}) {
    setCurrentSite(id);
    if (save && rememberPick?.checked) store('site', id);
    document.querySelectorAll('.st-section [data-site]').forEach((element) => {
      const selected = element.dataset.site === id;
      element.classList.toggle('selected', selected);
      element.classList.toggle('active', selected);
    });
    if (updatePicker) {
      document.querySelectorAll('#site-picker [data-site]').forEach((element) => {
        const selected = element.dataset.site === id;
        element.classList.toggle('selected', selected);
        element.classList.toggle('active', selected);
      });
    }
    updateMirrorBtn();
    loadSiteEditor();
  }

  function openSite(id) {
    const site = sites[id];
    if (!site) return;
    document.body.classList.add('site-content-ready');
    activateSite(id, { save: false });
    const pageTabs = getPageTabs();
    const activeTab = getActiveTab();
    if (!pageTabs.length) setPageTabs([{ url: site.url, title: site.label }]);
    else pageTabs[activeTab] = { url: site.url, title: site.label };
    const tabWebviews = getTabWebviews();
    if (!tabWebviews[activeTab]) createTabWebview(activeTab);
    showTabWebview(activeTab);
    loadTabUrl(tabWebviews[activeTab], site.url);
    saveTabs();
  }

  function switchMirror() {
    const otherSiteId = getOtherSiteId();
    document.body.classList.add('mirror-switching');
    setTimeout(() => {
      store('site', otherSiteId);
      openSite(otherSiteId);
    }, 180);
    setTimeout(() => document.body.classList.remove('mirror-switching'), 520);
  }

  btnSite.addEventListener('click', switchMirror);
  document.querySelectorAll('[data-site]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.site;
      if (!sites[id]) return;
      activateSite(id);
      if (picker && picker.isConnected) btnContinue.classList.add('show');
    });
  });
  document.querySelectorAll('.st-section [data-site]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.site;
      if (!sites[id]) return;
      if (card.closest('.settings-group-card')) {
        store('site', id);
        openSite(id);
      }
    });
  });
  document.querySelectorAll('.about-detail-link[data-url]').forEach((element) => {
    element.addEventListener('click', () => native.openExternal(element.dataset.url));
  });

  btnContinue.addEventListener('click', async () => {
    const currentSite = getCurrentSite();
    if (!currentSite) return;
    if (isFirstLaunch()) {
      setFirstLaunch(false);
      window.__startupOnboarding = false;
      store('onboardingComplete', true);
    }
    store('remember', rememberPick.checked ? '1' : '0');
    store('site', rememberPick.checked ? currentSite : null);

    let accessStatus;
    try {
      accessStatus = await accessKeyFeature.statusPromise;
    } catch (error) {
      toast(`Не удалось проверить ключ доступа: ${String(error?.message || error)}`, 'error');
      return;
    }
    if (!accessStatus?.ok) {
      toast(accessStatus?.error || 'Не удалось проверить ключ доступа', 'error');
      return;
    }
    if (accessStatus.enabled) await accessKeyFeature.gate;
    else if (!accessStatus.promptDismissed) {
      if (!accessKeyFeature.isVisible()) accessKeyFeature.showPrompt('prompt');
      await accessKeyFeature.gate;
    } else {
      accessKeyFeature.releaseSecurityGate();
    }

    picker.classList.add('hide');
    setTimeout(() => {
      document.body.classList.remove('picker-visible', 'onboarding-mode');
      picker.classList.remove('show');
      const pendingPosterUrls = getPendingPosterUrls();
      if (pendingPosterUrls) {
        setPendingPosterUrls(null);
        requestAnimationFrame(() => setPosterWall(pendingPosterUrls));
      }
      openSite(currentSite);
    }, 140);
  });

  function showWelcomeScreen() {
    if (!isFirstLaunch() || !welcomeScreen) return;
    welcomeScreen.classList.add('show');
    welcomeScreen.setAttribute('aria-hidden', 'false');
    document.body.classList.add('onboarding-mode');
    requestAnimationFrame(() => welcomeContinue?.focus());
  }

  welcomeContinue?.addEventListener('click', () => {
    if (!picker) return;
    welcomeScreen?.classList.remove('show');
    welcomeScreen?.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      picker.classList.remove('hide');
      picker.classList.add('show');
      document.body.classList.add('picker-visible', 'onboarding-mode');
      document.querySelector('#site-picker [data-site].selected')?.focus();
    }, 260);
  });

  rememberPick.addEventListener('change', () => {
    rememberSettings.checked = rememberPick.checked;
    store('remember', rememberPick.checked ? '1' : '0');
    if (!rememberPick.checked) store('site', null);
    else if (getCurrentSite()) store('site', getCurrentSite());
  });
  rememberSettings.addEventListener('change', () => {
    rememberPick.checked = rememberSettings.checked;
    store('remember', rememberSettings.checked ? '1' : '0');
    if (!rememberSettings.checked) store('site', null);
    else if (getCurrentSite()) store('site', getCurrentSite());
  });

  return { activateSite, getOtherSiteId, openSite, showWelcomeScreen, switchMirror, updateMirrorBtn };
}

export { initSiteNavigation };
