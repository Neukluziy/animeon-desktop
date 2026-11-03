function createWindowStateStore({
  app,
  config,
  fs,
  path,
  screen,
  mainWindowId,
  defaultWindowSize,
  getWindow,
  writeFileAtomically,
  writeLog,
  saveConfig,
}) {
  function loadWindowState(windowId = mainWindowId) {
    const defaults = { ...defaultWindowSize, x: undefined, y: undefined, maximized: false };
    try {
      let data = config.windowStates?.[windowId]?.bounds;
      if (!data) {
        const statePath = path.join(app.getPath('userData'), 'window-state.json');
        data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        if (windowId !== mainWindowId && Number.isFinite(Number(data.x)) && Number.isFinite(Number(data.y))) {
          const offset = (Object.keys(config.windowStates).indexOf(windowId) + 1) * 36;
          data = { ...data, x: Number(data.x) + offset, y: Number(data.y) + offset, maximized: false };
        }
      }
      const width = Math.max(480, Math.min(7680, Number(data.width) || defaults.width));
      const height = Math.max(360, Math.min(4320, Number(data.height) || defaults.height));
      let x = Number.isFinite(Number(data.x)) ? Number(data.x) : undefined;
      let y = Number.isFinite(Number(data.y)) ? Number(data.y) : undefined;
      if (x !== undefined && y !== undefined) {
        try {
          const inside = screen.getAllDisplays().some((display) => {
            const area = display.workArea || display.bounds;
            return x >= area.x - width + 80 && x <= area.x + area.width - 80
              && y >= area.y - 40 && y <= area.y + area.height - 40;
          });
          if (!inside) {
            x = undefined;
            y = undefined;
          }
        } catch { void 0; }
      }
      return { width, height, x, y, maximized: !!data.maximized };
    } catch (error) {
      writeLog('debug', 'Could not load saved window state', { windowId, error: String(error?.message || error) });
      return defaults;
    }
  }

  function saveWindowState(windowId = mainWindowId, targetWindow = getWindow()) {
    if (!targetWindow || targetWindow.isDestroyed() || targetWindow.isMinimized() || targetWindow.isFullScreen()) return;
    try {
      const bounds = targetWindow.getNormalBounds();
      const state = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        maximized: targetWindow.isMaximized(),
      };
      if (windowId === mainWindowId) {
        return writeFileAtomically(
          path.join(app.getPath('userData'), 'window-state.json'),
          JSON.stringify(state),
          { encoding: 'utf8' },
        ).catch((error) => {
          writeLog('error', 'Failed to save main window state', { error: String(error?.message || error) });
        });
      }
      if (config.windowStates[windowId]) {
        config.windowStates[windowId].bounds = state;
        saveConfig();
      }
    } catch (error) {
      writeLog('error', 'Failed to save window state', { windowId, error: String(error?.message || error) });
    }
  }

  return { loadWindowState, saveWindowState };
}

module.exports = { createWindowStateStore };
