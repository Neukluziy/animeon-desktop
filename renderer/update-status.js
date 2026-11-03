function initUpdateStatus({ native, cfg, appInfo, toast, status, checkButton, openReleaseButton, getButton }) {
  let checkingUpdate = false;
  let notifiedUpdateVersion = null;

  function notifyUpdateAvailable(info) {
    if (!info?.hasUpdate || notifiedUpdateVersion === info.latest) return;
    notifiedUpdateVersion = info.latest;
    toast('Доступна новая версия AnimeOn', 'ok', {
      variant: 'update',
      body: `Версия v${info.latest} уже доступна`,
      duration: 12000,
      action: {
        icon: 'go',
        title: 'Открыть обновление',
        onClick: () => native.update.open(),
      },
    });
  }

  async function refreshUpdateStatus(auto = false, showResultToast = false) {
    if (checkingUpdate || (auto && (cfg.autoUpdate === false || !appInfo.isPrimaryWindow))) return;
    checkingUpdate = true;
    if (!auto) status.textContent = 'Проверяем…';
    const checkButtons = [checkButton, document.getElementById('btn-about-check-update')].filter(Boolean);
    checkButtons.forEach((button) => { button.disabled = true; });
    openReleaseButton?.classList.add('hidden');

    try {
      const result = await native.update.check();
      window.__lastUpdate = result;
      if (!result || !result.ok) {
        status.textContent = auto ? '' : 'Не удалось проверить обновления. Проверь подключение к интернету';
        if (showResultToast) toast(`Не удалось проверить: ${result?.reason || 'неизвестная ошибка'}`, 'error');
      } else if (result.hasUpdate) {
        status.textContent = `Свежая версия — v${result.latest} (у тебя v${result.current})`;
        getButton.classList.remove('hidden');
        getButton.onclick = () => native.update.open();
        if (openReleaseButton && result.url) openReleaseButton.classList.remove('hidden');
        if (auto) notifyUpdateAvailable(result);
        else native.update.open();
      } else {
        status.textContent = `У вас последняя версия — v${result.current}`;
        getButton.classList.add('hidden');
        if (showResultToast) toast('Обновлений нет');
      }
    } catch (error) {
      console.error('[AnimeOn] Не удалось проверить обновления:', error);
      if (!auto) status.textContent = 'Не удалось проверить обновления. Проверь подключение к интернету';
      if (showResultToast) toast('Не удалось проверить обновления', 'error');
    } finally {
      checkButtons.forEach((button) => { button.disabled = false; });
      checkingUpdate = false;
    }
  }

  checkButton.addEventListener('click', () => refreshUpdateStatus(false));
  return { refreshUpdateStatus };
}

export { initUpdateStatus };
