const { DiscordRPC } = require('./discord-rpc');
const { buildDiscordActivity, DEFAULT_DISCORD_RPC_SETTINGS, safeAsync } = require('./utils');

function createDiscordRuntime({ config, getMediaState, getSiteContents, sitePattern, intervalMs, writeLog }) {
  let discordRPC = null;
  let activityTimer = null;
  let revision = 0;

  function updateActivity() {
    const settings = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...config.discordRpc };
    if (!discordRPC || !discordRPC.ready || !settings.enabled) return;
    const state = getMediaState();
    if (!state || !state.available) {
      if (!settings.showWhenIdle) {
        safeAsync(() => discordRPC.clearActivity(), writeLog, 'Could not clear Discord activity');
        return;
      }
      const currentUrl = String(getSiteContents()?.getURL?.() || '');
      const idleUrl = sitePattern.test(currentUrl)
        ? currentUrl
        : (config.siteList?.[config.site === 'co' ? 1 : 0]?.url || 'https://animeon.cc/');
      let idleText = 'В главном меню';
      try {
        const pathname = new URL(idleUrl).pathname;
        if (/\/anime\//i.test(pathname)) idleText = 'Выбирает серию';
        else if (pathname !== '/') idleText = 'Просматривает AnimeOn';
      } catch { void 0; }
      safeAsync(
        () => discordRPC.setActivity(buildDiscordActivity({ idle: true, idleText, animeUrl: idleUrl }, settings)),
        writeLog,
        'Could not update Discord activity',
      );
      return;
    }
    safeAsync(
      () => discordRPC.setActivity(buildDiscordActivity(state, settings)),
      writeLog,
      'Could not update Discord activity',
    );
  }

  function applyRuntime() {
    const currentRevision = ++revision;
    if (!config.discordRpc?.enabled) {
      if (activityTimer) {
        clearInterval(activityTimer);
        activityTimer = null;
      }
      if (!discordRPC) return;
      const rpc = discordRPC;
      const clear = rpc.ready ? rpc.clearActivity() : Promise.resolve();
      clear.then(() => {
        if (discordRPC === rpc && revision === currentRevision && !config.discordRpc?.enabled) rpc.disconnect();
      }, () => {
        if (discordRPC === rpc && revision === currentRevision && !config.discordRpc?.enabled) rpc.disconnect();
      });
      return;
    }
    if (!discordRPC) discordRPC = new DiscordRPC(undefined, writeLog);
    if (!activityTimer) activityTimer = setInterval(updateActivity, intervalMs);
    const rpc = discordRPC;
    if (!rpc.ready) safeAsync(() => rpc.connect().then(updateActivity), writeLog, 'Could not reconnect to Discord RPC');
    updateActivity();
  }

  function disconnect() {
    if (activityTimer) clearInterval(activityTimer);
    if (discordRPC) discordRPC.disconnect();
  }

  return { applyRuntime, updateActivity, disconnect };
}

module.exports = { createDiscordRuntime };
