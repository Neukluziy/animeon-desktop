const MAIN_WINDOW_ID = 'main';
const MAX_APP_WINDOWS = 8;

function normalizeState(state, fallback, accountIds) {
  const source = state && typeof state === 'object' && !Array.isArray(state) ? state : fallback;
  const tabs = Array.isArray(source?.tabs)
    ? source.tabs.slice(0, 12).map((tab) => ({
      url: String(tab?.url || ''),
      title: String(tab?.title || tab?.url || ''),
    }))
    : [];
  const activeTab = Math.max(0, Math.min(Math.max(0, tabs.length - 1), Number(source?.activeTab) || 0));
  const bounds = source?.bounds && typeof source.bounds === 'object' ? source.bounds : null;
  const normalizedBounds = bounds && Number.isFinite(Number(bounds.width)) && Number.isFinite(Number(bounds.height))
    ? {
      width: Math.max(480, Math.min(7680, Number(bounds.width))),
      height: Math.max(360, Math.min(4320, Number(bounds.height))),
      x: Number.isFinite(Number(bounds.x)) ? Number(bounds.x) : undefined,
      y: Number.isFinite(Number(bounds.y)) ? Number(bounds.y) : undefined,
      maximized: !!bounds.maximized,
    }
    : undefined;

  return {
    accountId: accountIds.has(String(source?.accountId || ''))
      ? String(source.accountId)
      : String(fallback?.accountId || 'default'),
    tabs,
    activeTab,
    ...(normalizedBounds ? { bounds: normalizedBounds } : {}),
  };
}

function normalizeWindowStates(config) {
  const accountIds = new Set((config.accounts || []).map((account) => account.id));
  const legacyMain = {
    accountId: config.activeAccountId,
    tabs: config.tabs,
    activeTab: config.activeTab,
  };
  const stored = config.windowStates && typeof config.windowStates === 'object' && !Array.isArray(config.windowStates)
    ? config.windowStates
    : {};
  const states = {
    [MAIN_WINDOW_ID]: normalizeState(stored[MAIN_WINDOW_ID], legacyMain, accountIds),
  };

  for (const [id, state] of Object.entries(stored)) {
    if (id === MAIN_WINDOW_ID || !/^[a-z0-9-]{1,64}$/i.test(id)) continue;
    if (Object.keys(states).length >= MAX_APP_WINDOWS) break;
    states[id] = normalizeState(state, states[MAIN_WINDOW_ID], accountIds);
  }

  config.windowStates = states;
  config.activeAccountId = states[MAIN_WINDOW_ID].accountId;
  config.tabs = states[MAIN_WINDOW_ID].tabs;
  config.activeTab = states[MAIN_WINDOW_ID].activeTab;
  return states;
}

module.exports = { MAIN_WINDOW_ID, MAX_APP_WINDOWS, normalizeWindowStates };
