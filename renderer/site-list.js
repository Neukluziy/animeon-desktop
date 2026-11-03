function createSiteListController({ cfg, native, sites, getCurrentSite, updateMirrorBtn, updateSiteFromUrl, renderTabs }) {
  function applySiteList(list) {
    if (!Array.isArray(list) || list.length < 2) return false;

    const [first, second] = list;
    if (!first?.url || !second?.url) return false;

    sites.cc = {
      url: String(first.url).endsWith('/') ? String(first.url) : `${String(first.url)}/`,
      label: String(first.label || first.url).replace(/^https?:\/\//i, '').replace(/\/$/, ''),
    };
    sites.co = {
      url: String(second.url).endsWith('/') ? String(second.url) : `${String(second.url)}/`,
      label: String(second.label || second.url).replace(/^https?:\/\//i, '').replace(/\/$/, ''),
    };

    document.querySelectorAll('[data-site-label="cc"]').forEach((element) => {
      element.textContent = sites.cc.label;
    });
    document.querySelectorAll('[data-site-label="co"]').forEach((element) => {
      element.textContent = sites.co.label;
    });

    document.querySelectorAll('[data-site]').forEach((element) => {
      const site = sites[element.dataset.site];
      if (site) element.title = site.url;
    });

    const currentSite = getCurrentSite();
    if (currentSite) {
      updateMirrorBtn();
      updateSiteFromUrl?.(sites[currentSite].url);
    }
    renderTabs();
    return true;
  }

  async function loadSitesFromRemote() {
    try {
      const previousSites = { cc: { ...sites.cc }, co: { ...sites.co } };
      const result = await native.fetchSites();
      if (result?.ok && applySiteList(result.sites)) {
        const remapSiteUrl = (value) => {
          try {
            const url = new URL(String(value || ''));
            for (const id of ['cc', 'co']) {
              const oldHost = new URL(previousSites[id].url).hostname.toLowerCase();
              if (url.hostname.toLowerCase() !== oldHost && !url.hostname.toLowerCase().endsWith(`.${oldHost}`)) continue;
              const newSiteUrl = new URL(sites[id].url);
              url.protocol = newSiteUrl.protocol;
              url.host = newSiteUrl.host;
              return url.href;
            }
          } catch { void 0; }
          return value;
        };
        const remapItems = (items) => (Array.isArray(items) ? items.map((item) => {
          if (typeof item === 'string') return remapSiteUrl(item);
          return item && typeof item === 'object' && item.url ? { ...item, url: remapSiteUrl(item.url) } : item;
        }) : []);
        cfg.siteList = result.sites;
        cfg.tabs = remapItems(cfg.tabs);
        cfg.lastUrl = remapSiteUrl(cfg.lastUrl);
        cfg.history = remapItems(cfg.history);
        cfg.favorites = remapItems(cfg.favorites);
        cfg.recentPages = remapItems(cfg.recentPages);
        cfg.pageFavorites = remapItems(cfg.pageFavorites);
        native.setConfig({
          siteList: cfg.siteList,
          tabs: cfg.tabs,
          lastUrl: cfg.lastUrl,
          history: cfg.history,
          favorites: cfg.favorites,
          recentPages: cfg.recentPages,
          pageFavorites: cfg.pageFavorites,
        });
        return true;
      }
      applySiteList(result?.sites || cfg.siteList);
    } catch (error) {
      try {
        applySiteList(cfg.siteList);
      } catch (fallbackError) {
        console.warn('[AnimeOn] Could not restore the saved site list:', fallbackError);
      }
      console.warn('[AnimeOn] Could not load the remote site list:', error);
    }
  }

  return { applySiteList, loadSitesFromRemote };
}

export { createSiteListController };
