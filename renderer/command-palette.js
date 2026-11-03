function initCommandPalette({
  native,
  cfg,
  sites,
  webview,
  toast,
  setPlayerSpeed,
  togglePictureInPicture,
  refreshVolume,
  openSite,
  getOtherSiteId,
  getCurrentSite,
  openSettings,
}) {
  const commandPalette = document.getElementById('command-palette');
  const commandInput = document.getElementById('command-input');
  const commandList = document.getElementById('command-list');

  function navigatePath(path) {
    const base = sites[getCurrentSite() || 'cc']?.url || sites.cc.url;
    native.navigateSite(new URL(path, base).href);
  }

  async function toggleFavorite() {
    const url = webview.getURL();
    if (!/^https:\/\/(?:www\.)?animeon\.(?:cc|co)\//i.test(url)) {
      toast('Добавлять в избранное можно только страницы AnimeOn', 'error');
      return;
    }
    const result = await native.togglePageFavorite({ url, title: webview.getTitle() });
    if (!result?.ok) throw new Error(result?.error || 'Не удалось изменить избранное');
    toast(result.favorite ? 'Добавлено в избранное' : 'Убрано из избранного');
  }

  const commands = [
    ...[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => [`Скорость ${speed}×`, () => setPlayerSpeed(speed)]),
    ['Картинка в картинке', togglePictureInPicture],
    ['Громче', () => { native.media.setVolume(1); setTimeout(refreshVolume, 50); }],
    ['Тише', () => { native.media.setVolume(-1); setTimeout(refreshVolume, 50); }],
    ['Выключить / включить звук', () => { native.media.toggleMute(); setTimeout(refreshVolume, 50); }],
    ['10 секунд назад', () => native.media.seek(-10)],
    ['10 секунд вперёд', () => native.media.seek(10)],
    ['Следующая серия', () => native.media.action('next')],
    ['Открыть предыдущий / следующий сайт', () => { openSite(getOtherSiteId()); }],
    ['animeon.cc', () => openSite('cc')],
    ['v2.animeon.co', () => openSite('co')],
    ['Предыдущая серия', () => native.media.action('previous')],
    ['Сделать скриншот', () => native.takeScreenshot()],
    ['Поверх всех окон', () => native.toggleAlwaysOnTop()],
    ['Открыть меню трея', () => native.trayAction('menu')],
    ['Перезагрузить страницу', () => webview.reload()],
    ['Назад', () => webview.canGoBack() && webview.goBack()],
    ['Вперёд', () => webview.canGoForward() && webview.goForward()],
    ['Полный экран', () => native.toggleFullscreen()],
    ['Настройки', openSettings],
    ['Перезапустить WebView', () => webview.reload()],
    ['Очистить кэш', async () => { await native.clearCache(); webview.reload(); }],
    ['DevTools', () => native.toggleDevTools()],
    ['Проверить всё', () => document.getElementById('btn-check-all')?.click()],
    ['Показать нагрузку', async () => {
      const result = await native.siteMemory();
      if (result?.ok) toast(`Память: приложение ${result.appMB} МБ · сайт ${result.siteMB} МБ`);
      else toast('Не удалось получить нагрузку', 'error');
    }],
    ['Открыть в браузере', () => native.openExternal(webview.getURL())],
    ['Увеличить масштаб', () => native.zoom(0.1)],
    ['Уменьшить масштаб', () => native.zoom(-0.1)],
    ['Сбросить масштаб', () => native.zoom(0)],
    ['Каталог', () => navigatePath('/anime')],
    ['Расписание', () => navigatePath('/schedule')],
    ['Подборки', () => navigatePath('/collections')],
    ['Случайное аниме', () => navigatePath('/random')],
    ['Новости', () => navigatePath('/news')],
    ['Обновления', () => navigatePath('/roadmap')],
    ['Лидерборд', () => navigatePath('/leaderboard')],
    ['Добавить в избранное', toggleFavorite],
    ['Открыть последнюю страницу', () => { if (cfg.lastUrl) native.navigateSite(cfg.lastUrl); }],
  ];

  function renderCommands(filter = '') {
    if (!commandList) return;
    const query = filter.trim().toLowerCase();
    commandList.innerHTML = '';
    commands.filter(([name]) => !query || name.toLowerCase().includes(query)).forEach(([name, action], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.dataset.index = String(index);
      button.addEventListener('click', async () => {
        commandPalette.classList.remove('show');
        try {
          await action();
        } catch (error) {
          console.error(`[AnimeOn] Не удалось выполнить команду «${name}»:`, error);
          toast(`Не удалось выполнить «${name}»: ${String(error?.message || error)}`, 'error');
        }
      });
      commandList.appendChild(button);
    });
  }

  function openCommandPalette() {
    if (!commandPalette) return;
    commandPalette.classList.add('show');
    commandInput.value = '';
    renderCommands();
    setTimeout(() => commandInput.focus(), 20);
  }

  function closeCommandPalette() {
    commandPalette?.classList.remove('show');
  }

  native.onOpenCommandPalette?.(openCommandPalette);
  native.onGoHome?.(() => { if (getCurrentSite()) openSite(getCurrentSite()); });
  native.onSwitchSite?.(() => openSite(getOtherSiteId()));
  commandInput?.addEventListener('input', () => renderCommands(commandInput.value));
  commandPalette?.addEventListener('click', (event) => {
    if (event.target === commandPalette) closeCommandPalette();
  });

  return { closeCommandPalette, openCommandPalette };
}

export { initCommandPalette };
