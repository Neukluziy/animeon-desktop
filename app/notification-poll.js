function createNotificationPollIpc({ ipcMain, config, session, getWindowContext, apiGet }) {
  function normalizeDataList(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    for (const key of ['items', 'results', 'data', 'entries', 'notifications']) {
      if (Array.isArray(data[key])) return data[key];
    }
    return [];
  }

  function registerIpc() {
    ipcMain.handle('animeon:notifications', async (event, options = {}) => {
      const context = getWindowContext(event);
      if (!context) return { ok: false, items: [], error: 'untrusted sender' };
      const account = config.accounts.find((item) => item.id === context.accountId);
      const apiSession = session.fromPartition(account?.partition || 'persist:animeon');
      try {
        const result = await apiGet('/api/user/notifications', options, { session: apiSession });
        return { ...result, items: normalizeDataList(result.data) };
      } catch (error) {
        return { ok: false, items: [], error: String(error?.message || error) };
      }
    });
  }

  return { registerIpc };
}

module.exports = { createNotificationPollIpc };
