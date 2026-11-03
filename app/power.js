function createPowerManager({ powerMonitor, togglePlayback, getMediaState, writeLog }) {
  let pausedBySystem = false;

  function pauseForSystemEvent(description) {
    try {
      const state = getMediaState();
      if (state && !state.paused) {
        togglePlayback();
        pausedBySystem = true;
      }
    } catch (error) {
      writeLog('debug', `Could not pause playback on ${description}`, { error: String(error?.message || error) });
    }
  }

  function resumeAfterSystemEvent(description) {
    try {
      if (pausedBySystem) {
        togglePlayback();
        pausedBySystem = false;
      }
    } catch (error) {
      writeLog('debug', `Could not resume playback after ${description}`, { error: String(error?.message || error) });
    }
  }

  function registerSystemEvents() {
    powerMonitor.on('suspend', () => pauseForSystemEvent('system suspend'));
    powerMonitor.on('lock-screen', () => pauseForSystemEvent('screen lock'));
    powerMonitor.on('resume', () => resumeAfterSystemEvent('system wake'));
    powerMonitor.on('unlock-screen', () => resumeAfterSystemEvent('screen unlock'));
  }

  return { registerSystemEvents };
}

function createSleepTimer({ config, app, togglePlayback, ensureTray, getWindow, saveConfig, setQuitting, writeLog }) {
  let timer = null;

  function set(minutes, action = 'pause') {
    if (timer) clearTimeout(timer);
    const value = Math.max(0, Math.min(10080, Math.floor(Number(minutes) || 0)));
    config.sleepTimer = {
      enabled: value > 0,
      minutes: value,
      action: ['pause', 'exit', 'tray'].includes(action) ? action : 'pause',
    };
    saveConfig();
    if (!value) return { ok: true, enabled: false };

    timer = setTimeout(() => {
      try {
        if (config.sleepTimer.action === 'exit') {
          setQuitting(true);
          app.quit();
        } else if (config.sleepTimer.action === 'tray') {
          ensureTray();
          getWindow()?.hide();
        } else {
          togglePlayback();
        }
      } catch (error) {
        writeLog('warn', 'Sleep timer action failed', { error: String(error?.message || error) });
      }
      config.sleepTimer = { enabled: false, minutes: 0, action: 'pause' };
      saveConfig();
      timer = null;
    }, value * 60000);
    return { ok: true, enabled: true, minutes: value, action: config.sleepTimer.action };
  }

  return { set };
}

module.exports = { createPowerManager, createSleepTimer };
