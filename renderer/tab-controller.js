function initTabController({
  state,
  sites,
  appConstants,
  mediaStates,
  inactiveTabUnloadTimers,
  native,
  tabTitle,
  updateMirrorBtn,
  createTabWebview,
  showTabWebview,
  renderTabs,
  updateNav,
  applyGuestStyles,
}) {
  async function saveTabs() {
    await native.tabsSet(state.pageTabs, state.activeTab);
    renderTabs();
  }

  function updateSiteFromUrl(url) {
    const value = String(url || '').toLowerCase();
    for (const [id, site] of Object.entries(sites)) {
      const host = new URL(site.url).hostname.toLowerCase();
      if (value.includes(host)) {
        state.currentSite = id;
        break;
      }
    }
    if (state.currentSite) updateMirrorBtn();
  }

  function isAnimeOnUrl(url) {
    try {
      const parsedUrl = new URL(String(url || ''));
      return (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') && /(^|\.)animeon\.(cc|co)$/i.test(parsedUrl.hostname);
    } catch {
      return false;
    }
  }

  function samePageUrl(a, b) {
    try {
      const firstUrl = new URL(String(a || ''));
      const secondUrl = new URL(String(b || ''));
      firstUrl.hash = '';
      secondUrl.hash = '';
      if (firstUrl.pathname.length > 1) firstUrl.pathname = firstUrl.pathname.replace(/\/$/, '');
      if (secondUrl.pathname.length > 1) secondUrl.pathname = secondUrl.pathname.replace(/\/$/, '');
      return firstUrl.protocol === secondUrl.protocol
        && firstUrl.hostname.toLowerCase() === secondUrl.hostname.toLowerCase()
        && firstUrl.port === secondUrl.port
        && firstUrl.pathname === secondUrl.pathname
        && firstUrl.search === secondUrl.search;
    } catch {
      return String(a || '') === String(b || '');
    }
  }

  function normalizeTabUrl(url) {
    try {
      const parsedUrl = new URL(String(url || ''));
      parsedUrl.hash = '';
      if (parsedUrl.pathname.length > 1) parsedUrl.pathname = parsedUrl.pathname.replace(/\/$/, '');
      return parsedUrl.href;
    } catch {
      return String(url || '');
    }
  }

  function syncActiveTabFromWebview() {
    if (!state.pageTabs.length || !state.activeWebview) return;
    let url = '';
    try {
      url = state.activeWebview.getURL() || '';
    } catch (error) {
      console.warn('[AnimeOn] Could not read active tab URL:', error);
    }
    if (!isAnimeOnUrl(url)) return;
    updateSiteFromUrl(url);
    let title = '';
    try {
      title = state.activeWebview.getTitle() || '';
    } catch (error) {
      console.warn('[AnimeOn] Could not read active tab title:', error);
    }
    state.pageTabs[state.activeTab] = {
      ...state.pageTabs[state.activeTab],
      url,
      title: title || tabTitle({ url }),
    };
  }

  async function switchTab(index) {
    if (index < 0 || index >= state.pageTabs.length || index === state.activeTab) return;
    const previousTab = state.activeTab;
    clearTimeout(inactiveTabUnloadTimers.get(index));
    inactiveTabUnloadTimers.delete(index);
    syncActiveTabFromWebview();
    state.activeTab = index;
    scheduleInactiveTabUnload(previousTab);
    if (!state.tabWebviews[index]) {
      createTabWebview(index);
      const tab = state.pageTabs[index];
      if (tab?.url) loadTabUrl(state.tabWebviews[index], tab.url);
    }
    showTabWebview(index);
    const tab = state.pageTabs[index];
    updateSiteFromUrl(tab?.url);
    renderTabs();
    await saveTabs();
    state.syncFavoriteButton();
    setTimeout(() => {
      try {
        state.activeWebview.focus();
        updateNav();
        applyGuestStyles();
      } catch { void 0; }
    }, 80);
  }

  async function loadTabUrl(webview, url) {
    if (!webview || !url) return;
    const target = String(url);
    const load = () => {
      if (!webview.isConnected) return false;
      try {
        const current = webview.getURL?.() || '';
        if (current && current === target) return true;
      } catch { void 0; }
      try {
        webview.setAttribute('src', target);
        return true;
      } catch { void 0; }
      try {
        webview.src = target;
        return true;
      } catch { void 0; }
      try {
        webview.loadURL(target);
        return true;
      } catch { void 0; }
      return false;
    };
    const attempt = () => {
      if (!load()) setTimeout(attempt, 180);
    };
    requestAnimationFrame(() => setTimeout(attempt, 80));
  }

  async function loadActiveTab() {
    if (!state.pageTabs.length) state.pageTabs = [{ url: sites.co.url, title: sites.co.label }];
    if (!state.tabWebviews[state.activeTab]) createTabWebview(state.activeTab);
    showTabWebview(state.activeTab);
    const tab = state.pageTabs[state.activeTab];
    loadTabUrl(state.tabWebviews[state.activeTab], tab?.url);
    renderTabs();
  }

  function scheduleInactiveTabUnload(index) {
    clearTimeout(inactiveTabUnloadTimers.get(index));
    if (index === state.activeTab || state.pageTabs[index]?.pinned) return;
    const timer = setTimeout(async () => {
      inactiveTabUnloadTimers.delete(index);
      const webview = state.tabWebviews[index];
      const tab = state.pageTabs[index];
      const mediaState = webview && mediaStates.get(webview);
      if (!webview || !tab || index === state.activeTab || tab.pinned || !mediaState || !mediaState.complete || mediaState.playing || mediaState.audible) return;
      try {
        const url = webview.getURL();
        if (isAnimeOnUrl(url)) {
          tab.url = normalizeTabUrl(url);
          tab.title = webview.getTitle() || tab.title || tabTitle(tab);
        }
      } catch (error) {
        console.warn('[AnimeOn] Could not save inactive tab before unloading:', error);
      }
      state.tabWebviews[index] = null;
      webview.remove();
      await saveTabs();
    }, appConstants.inactiveTabUnloadDelayMs);
    inactiveTabUnloadTimers.set(index, timer);
  }

  async function syncTabs(url, title) {
    if (!isAnimeOnUrl(url)) return;
    if (!state.pageTabs.length) state.pageTabs = [{ url, title }];
    else state.pageTabs[state.activeTab] = { ...state.pageTabs[state.activeTab], url, title: title || tabTitle({ url }) };
    await saveTabs();
  }

  async function closeTab(index) {
    if (state.pageTabs.length <= 1) {
      const only = state.pageTabs[0] || { url: sites.co.url, title: sites.co.label };
      state.pageTabs = [only];
      state.activeTab = 0;
      if (!state.tabWebviews[0]) state.tabWebviews[0] = state.firstWebview;
      showTabWebview(0);
      renderTabs();
      return;
    }
    const closingWebview = state.tabWebviews[index];
    clearTimeout(inactiveTabUnloadTimers.get(index));
    inactiveTabUnloadTimers.delete(index);
    state.pageTabs.splice(index, 1);
    state.tabWebviews.splice(index, 1);
    if (closingWebview && closingWebview !== state.firstWebview) {
      try {
        closingWebview.remove();
      } catch { void 0; }
    }
    if (state.activeTab > index) state.activeTab--;
    else if (state.activeTab === index) state.activeTab = Math.min(state.activeTab, state.pageTabs.length - 1);
    showTabWebview(state.activeTab);
    await saveTabs();
    setTimeout(() => {
      try {
        state.activeWebview.focus();
        updateNav();
        applyGuestStyles();
      } catch (error) {
        console.warn('[AnimeOn] Could not focus selected tab:', error);
      }
    }, 50);
  }

  return {
    closeTab,
    isAnimeOnUrl,
    loadActiveTab,
    loadTabUrl,
    normalizeTabUrl,
    samePageUrl,
    saveTabs,
    scheduleInactiveTabUnload,
    syncActiveTabFromWebview,
    syncTabs,
    switchTab,
    updateSiteFromUrl,
  };
}

export { initTabController };
