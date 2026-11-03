function createTaskbarController({ getWindow, nativeImage, path, writeLog, mediaAction }) {
  let thumbarIcons = null;

  function generateThumbarIcons() {
    if (thumbarIcons) return thumbarIcons;
    const size = 16;
    function makeBuffer(draw) {
      const buffer = Buffer.alloc(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const index = (y * size + x) * 4;
          const value = draw(x, y) ? 255 : 0;
          buffer[index] = value;
          buffer[index + 1] = value;
          buffer[index + 2] = value;
          buffer[index + 3] = value;
        }
      }
      return nativeImage.createFromBuffer(buffer, { width: size, height: size });
    }
    thumbarIcons = {
      play: makeBuffer((x, y) => x > 4 && x < 12 && y > 2 && y < 14 && (x - 4) * 1.5 > Math.abs(y - 8)),
      pause: makeBuffer((x) => (x >= 3 && x <= 6) || (x >= 10 && x <= 13)),
      next: makeBuffer(
        (x, y) => (x >= 10 && x <= 13) || (x > 2 && x < 10 && y > 2 && y < 14 && (x - 2) * 1.5 > Math.abs(y - 8)),
      ),
      previous: makeBuffer(
        (x, y) => (x >= 3 && x <= 6) || (x > 6 && x < 14 && y > 2 && y < 14 && (14 - x) * 1.5 > Math.abs(y - 8)),
      ),
    };
    return thumbarIcons;
  }

  function updateThumbar(state) {
    const win = getWindow();
    if (process.platform !== 'win32' || !win || win.isDestroyed()) return;
    try {
      if (!state?.available) {
        win.setThumbarButtons([]);
        return;
      }
      const icons = generateThumbarIcons();
      const isPaused = !!state.paused;
      win.setThumbarButtons([
        { icon: icons.previous, tooltip: 'Предыдущая', flags: ['enabled'], click: () => mediaAction('previous') },
        {
          icon: isPaused ? icons.play : icons.pause,
          tooltip: isPaused ? 'Играть' : 'Пауза',
          flags: ['enabled'],
          click: () => mediaAction('playpause'),
        },
        { icon: icons.next, tooltip: 'Следующая', flags: ['enabled'], click: () => mediaAction('next') },
      ]);
    } catch (error) {
      writeLog('warn', 'Could not update Windows media controls', { error: String(error?.message || error) });
    }
  }

  function setOverlay(kind = 'none') {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    try {
      const icon = kind === 'error' ? path.join(__dirname, '../assets', 'logo.png') : null;
      win.setOverlayIcon(icon, kind === 'error' ? 'Ошибка загрузки' : '');
    } catch (error) {
      writeLog('warn', 'Could not set the taskbar overlay', { error: String(error?.message || error) });
    }
  }

  function setupJumpList() {
    const win = getWindow();
    if (!win || process.platform !== 'win32') return;
    try {
      win.setJumpList([
        {
          type: 'custom',
          name: 'AnimeOn',
          items: [
            {
              type: 'task',
              title: 'Открыть',
              program: process.execPath,
              args: '--show',
              iconPath: process.execPath,
              iconIndex: 0,
            },
            {
              type: 'task',
              title: 'Перезапустить страницу',
              program: process.execPath,
              args: '--reload',
              iconPath: process.execPath,
              iconIndex: 0,
            },
            {
              type: 'task',
              title: 'Настройки',
              program: process.execPath,
              args: '--settings',
              iconPath: process.execPath,
              iconIndex: 0,
            },
          ],
        },
      ]);
    } catch (error) {
      writeLog('debug', 'Could not configure the Windows jump list', { error: String(error?.message || error) });
    }
  }

  return { setOverlay, setupJumpList, updateThumbar };
}

module.exports = { createTaskbarController };
