function createMediaSession({ getSiteContents, getLastMediaState, setLastMediaState, writeLog }) {
  return function updateMediaSession(state) {
    const siteContents = getSiteContents();
    if (!siteContents || siteContents.isDestroyed()) return;
    const safeState = {
      title: String(state?.title || 'AnimeOn').slice(0, 120),
      currentTime: Number(state?.currentTime || 0),
      duration: Number(state?.duration || 0),
      paused: !!state?.paused,
    };
    if (JSON.stringify(safeState) === JSON.stringify(getLastMediaState())) return;
    setLastMediaState(safeState);
    try {
      siteContents.executeJavaScript(`(() => {
        const s=${JSON.stringify(safeState)};
        if (!('mediaSession' in navigator)) return false;
        navigator.mediaSession.playbackState=s.paused?'paused':'playing';
        try { navigator.mediaSession.metadata = new MediaMetadata({title:s.title,artist:'AnimeOn'}); } catch { void 0; }
        return true;
      })()`, false).catch((error) => {
        writeLog('debug', 'Could not update media session', { error: String(error?.message || error) });
      });
    } catch (error) {
      writeLog('debug', 'Could not update media session', { error: String(error?.message || error) });
    }
  };
}

module.exports = { createMediaSession };
