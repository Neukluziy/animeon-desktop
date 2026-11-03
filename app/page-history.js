function createPageHistory({ config, sitePattern, saveConfig }) {
  function sanitizeName(value) {
    return String(value || 'AnimeOn').replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'AnimeOn';
  }

  function pageLabel(url, title = '') {
    return sanitizeName(String(title || '').replace(/[-_|]+/g, ' ')) || sanitizeName(String(url).split('/').filter(Boolean).pop() || 'AnimeOn');
  }

  function normalizePageUrl(url) {
    try {
      const parsedUrl = new URL(String(url || ''));
      if (!/^https?:$/i.test(parsedUrl.protocol) || !sitePattern.test(parsedUrl.hostname)) return '';
      parsedUrl.hash = '';
      return parsedUrl.toString();
    } catch {
      return '';
    }
  }

  function rememberRecentPage(url, title = '') {
    const normalized = normalizePageUrl(url);
    if (!normalized) return;
    const item = { url: normalized, title: pageLabel(normalized, title), updatedAt: new Date().toISOString() };
    config.recentPages = [item, ...(config.recentPages || []).filter((entry) => normalizePageUrl(entry?.url) !== normalized)].slice(0, 100);
    saveConfig();
  }

  return { normalizePageUrl, pageLabel, rememberRecentPage, sanitizeName };
}

module.exports = { createPageHistory };
