function createPlaybackControls({ native, cfg, toast, syncSelect, controls }) {
  const {
    playbackSpeedSelect,
    playbackDubbingSelect,
    playbackQualitySelect,
    playbackSourceSelect,
    playbackOptionsStatus,
    refreshPlaybackOptionsButton,
    sleepTimerModal,
    sleepTimerMinutes,
    sleepTimerAction,
    sleepTimerStatus,
  } = controls;

  async function setPlayerSpeed(value, showToast = true) {
    try {
      const result = await native.media.setPlaybackSpeed(Number(value));
      if (!result?.ok) throw new Error(result?.error || 'Не удалось изменить скорость');
      cfg.playbackSpeed = result.speed;
      if (playbackSpeedSelect) {
        playbackSpeedSelect.value = String(result.speed);
        syncSelect?.(playbackSpeedSelect);
      }
      if (showToast) toast(`Скорость воспроизведения: ${result.speed}×`);
    } catch (error) {
      if (playbackSpeedSelect) {
        playbackSpeedSelect.value = String(cfg.playbackSpeed || 1);
        syncSelect?.(playbackSpeedSelect);
      }
      toast(String(error?.message || error), 'error');
    }
  }

  function populateOptions(select, values, placeholder) {
    if (!select) return;
    const options = [
      ...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean)),
    ];
    select.replaceChildren();
    const first = document.createElement('option');
    first.value = '';
    first.textContent = options.length ? placeholder : 'Нет доступных вариантов';
    select.appendChild(first);
    for (const value of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.disabled = options.length === 0;
    select.value = '';
    syncSelect?.(select);
  }

  async function refreshPlaybackOptions() {
    if (refreshPlaybackOptionsButton) refreshPlaybackOptionsButton.disabled = true;
    if (playbackOptionsStatus) playbackOptionsStatus.textContent = 'Ищу варианты на странице…';
    try {
      const result = await native.media.getPlaybackOptions();
      populateOptions(playbackDubbingSelect, result?.dubbing, 'Выбери озвучку');
      populateOptions(playbackQualitySelect, result?.quality, 'Выбери качество');
      populateOptions(playbackSourceSelect, result?.sources, 'Выбери источник');
      const total = ['dubbing', 'quality', 'sources'].reduce((sum, key) => sum + (result?.[key]?.length || 0), 0);
      if (playbackOptionsStatus) {
        playbackOptionsStatus.textContent = result?.error
          ? `Не удалось получить варианты: ${result.error}`
          : total
            ? 'Выбери нужный вариант. Список зависит от текущей страницы.'
            : 'На странице пока не найдены варианты озвучки или качества.';
      }
    } catch (error) {
      if (playbackOptionsStatus)
        playbackOptionsStatus.textContent = `Не удалось получить варианты: ${String(error?.message || error)}`;
      toast('Не удалось загрузить варианты плеера', 'error');
    } finally {
      if (refreshPlaybackOptionsButton) refreshPlaybackOptionsButton.disabled = false;
    }
  }

  async function selectPlaybackOption(kind, value) {
    if (!value) return;
    try {
      const result = await native.media.selectPlaybackOption(kind, value);
      if (!result?.ok)
        throw new Error(
          result?.reason === 'not-found' ? 'Вариант больше не найден на странице' : 'Не удалось выбрать вариант',
        );
      toast('Настройка плеера применена');
    } catch (error) {
      toast(String(error?.message || error), 'error');
    }
  }

  function updateSleepTimerStatus(timer) {
    const enabled = !!timer?.enabled && Number(timer.minutes) > 0;
    if (sleepTimerStatus) {
      sleepTimerStatus.textContent = enabled
        ? `Таймер включён: ${timer.minutes} мин. · ${{ pause: 'остановить видео', tray: 'свернуть в трей', exit: 'закрыть приложение' }[timer.action] || 'остановить видео'}`
        : 'Таймер сна выключен';
    }
    const button = document.getElementById('btn-sleep-timer');
    if (button) button.textContent = enabled ? 'Изменить таймер сна' : 'Таймер сна';
  }

  async function openSleepTimer() {
    try {
      const timer = await native.getSleepTimer();
      if (sleepTimerMinutes) sleepTimerMinutes.value = String(timer?.enabled ? timer.minutes : 30);
      if (sleepTimerAction)
        sleepTimerAction.value = ['pause', 'tray', 'exit'].includes(timer?.action) ? timer.action : 'pause';
      syncSelect?.(sleepTimerAction);
      sleepTimerModal.hidden = false;
      requestAnimationFrame(() => sleepTimerMinutes?.focus());
    } catch (error) {
      toast(`Не удалось открыть таймер: ${String(error?.message || error)}`, 'error');
    }
  }

  function closeSleepTimer() {
    if (sleepTimerModal) sleepTimerModal.hidden = true;
    document.getElementById('btn-sleep-timer')?.focus();
  }

  function togglePictureInPicture() {
    native.media
      .togglePiP()
      .then((result) => {
        if (result?.ok) toast(result.active ? 'Картинка в картинке включена' : 'Картинка в картинке выключена');
        else
          toast(
            result?.reason === 'no-video'
              ? 'На странице не найдено видео'
              : 'Картинка в картинке недоступна для этого видео',
            'error',
          );
      })
      .catch((error) => toast(`Не удалось включить картинку в картинке: ${String(error?.message || error)}`, 'error'));
  }

  if (playbackSpeedSelect) {
    playbackSpeedSelect.value = String(Number(cfg.playbackSpeed) || 1);
    syncSelect?.(playbackSpeedSelect);
    playbackSpeedSelect.addEventListener('change', () => setPlayerSpeed(playbackSpeedSelect.value));
  }
  native.media.onPlaybackSpeedChanged?.((speed) => {
    cfg.playbackSpeed = Number(speed) || 1;
    if (playbackSpeedSelect) {
      playbackSpeedSelect.value = String(cfg.playbackSpeed);
      syncSelect?.(playbackSpeedSelect);
    }
  });
  refreshPlaybackOptionsButton?.addEventListener('click', refreshPlaybackOptions);
  playbackDubbingSelect?.addEventListener('change', () => selectPlaybackOption('dubbing', playbackDubbingSelect.value));
  playbackQualitySelect?.addEventListener('change', () => selectPlaybackOption('quality', playbackQualitySelect.value));
  playbackSourceSelect?.addEventListener('change', () => selectPlaybackOption('source', playbackSourceSelect.value));
  document.getElementById('btn-sleep-timer')?.addEventListener('click', openSleepTimer);
  document.getElementById('sleep-timer-cancel')?.addEventListener('click', closeSleepTimer);
  document.getElementById('sleep-timer-save')?.addEventListener('click', async () => {
    const minutes = Number(sleepTimerMinutes?.value);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) {
      toast('Укажи целое число минут от 0 до 10080', 'error');
      sleepTimerMinutes?.focus();
      return;
    }
    const action = minutes ? sleepTimerAction?.value || 'pause' : 'pause';
    try {
      const result = await native.setSleepTimer(minutes, action);
      if (!result?.ok) throw new Error(result?.error || 'Не удалось сохранить таймер');
      cfg.sleepTimer = { enabled: !!result.enabled, minutes: result.minutes || 0, action: result.action || 'pause' };
      updateSleepTimerStatus(cfg.sleepTimer);
      closeSleepTimer();
      toast(result.enabled ? `Таймер установлен на ${result.minutes} мин.` : 'Таймер сна отключён');
    } catch (error) {
      toast(String(error?.message || error), 'error');
    }
  });
  sleepTimerModal?.addEventListener('click', (event) => {
    if (event.target === sleepTimerModal) closeSleepTimer();
  });

  if (playbackDubbingSelect || playbackQualitySelect || playbackSourceSelect) {
    void refreshPlaybackOptions();
  }
  if (sleepTimerStatus || sleepTimerModal) {
    native
      .getSleepTimer()
      .then(updateSleepTimerStatus)
      .catch((error) => {
        if (sleepTimerStatus)
          sleepTimerStatus.textContent = `Не удалось получить состояние таймера: ${String(error?.message || error)}`;
      });
  }

  return {
    closeSleepTimer,
    refreshPlaybackOptions,
    setPlayerSpeed,
    togglePictureInPicture,
    updateSleepTimerStatus,
  };
}

export { createPlaybackControls };
