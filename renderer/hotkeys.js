export function initHotkeys({ native, cfg, toast, askConfirmation }) {
  const hotkeysList = document.getElementById('hotkeys-list');
  const hotkeysModal = document.getElementById('hotkeys-modal');
  const btnHotkeys = document.getElementById('btn-hotkeys');
  const btnHotkeysMain = document.getElementById('btn-hotkeys-main');
  const btnCloseHotkeys = document.getElementById('btn-close-hotkeys');
  const btnHotkeysReset = document.getElementById('btn-hotkeys-reset');

  const HOTKEYS = [
  ['show', 'Показать приложение', 'Окно', 'Открывает окно, даже если оно скрыто.'],
  ['toggleWindow', 'Скрыть / показать окно', 'Окно', 'Быстро прячет окно или возвращает его обратно.'],
  ['trayMenu', 'Открыть меню трея', 'Окно', 'Открывает маленькое меню рядом с треем.'],
  ['alwaysOnTop', 'Поверх всех окон', 'Окно', 'Оставляет AnimeOn поверх других окон.'],
  ['fullscreen', 'Полный экран', 'Окно', 'Включает или выключает полноэкранный режим.'],
  ['playPause', 'Пауза / продолжить', 'Плеер', 'Ставит видео на паузу или продолжает просмотр.'],
  ['volumeUp', 'Громче', 'Плеер', 'Добавляет немного громкости.'],
  ['volumeDown', 'Тише', 'Плеер', 'Убавляет звук.'],
  ['mute', 'Выключить / Включить', 'Плеер', 'Выключает звук и возвращает его одним нажатием.'],
  ['seekBack', 'Назад на 10 секунд', 'Плеер', 'Отматывает видео на десять секунд.'],
  ['seekForward', 'Вперёд на 10 секунд', 'Плеер', 'Перематывает видео на десять секунд вперёд.'],
  ['next', 'Следующая серия', 'Плеер', 'Переходит к следующей серии, если она есть.'],
  ['previous', 'Предыдущая серия', 'Плеер', 'Возвращает к предыдущей серии.'],
  ['settings', 'Открыть настройки', 'Программа', 'Открывает настройки приложения.'],
  ['command', 'Быстрые команды', 'Программа', 'Открывает поиск по основным действиям.'],
  ['reload', 'Перезагрузить страницу', 'Программа', 'Заново загружает текущую страницу.'],
  ['screenshot', 'Сделать скриншот', 'Программа', 'Сохраняет снимок окна в PNG.'],
  ['openBrowser', 'Открыть в браузере', 'Программа', 'Открывает текущую страницу обычным браузером.'],
  ['home', 'На главную', 'Навигация', 'Возвращает на главную выбранного сайта.'],
  ['back', 'Назад', 'Навигация', 'Переходит на предыдущую страницу.'],
  ['forward', 'Вперёд', 'Навигация', 'Возвращает следующую страницу из истории.'],
  ['zoomIn', 'Увеличить масштаб', 'Навигация', 'Делает страницу крупнее.'],
  ['zoomOut', 'Уменьшить масштаб', 'Навигация', 'Делает страницу меньше.'],
  ['zoomReset', 'Сбросить масштаб', 'Навигация', 'Возвращает обычный масштаб.'],
  ['switchSite', 'Сменить сайт AnimeOn', 'Навигация', 'Переключает между доступными сайтами AnimeOn.'],
];
const DEFAULT_HOTKEYS = {
  show: 'Control+Alt+A', toggleWindow: 'Control+Alt+T', trayMenu: 'Control+Alt+Y', playPause: 'Control+Alt+P',
  volumeUp: 'Control+Alt+Up', volumeDown: 'Control+Alt+Down', mute: 'Control+Alt+M', seekBack: 'Control+Alt+Left',
  seekForward: 'Control+Alt+Right', next: 'Control+Alt+PageDown', previous: 'Control+Alt+PageUp',
  fullscreen: 'Control+Alt+F', alwaysOnTop: 'Control+Alt+O', settings: 'Control+Alt+S', reload: 'Control+Alt+R',
  screenshot: 'Control+Alt+Shift+S', command: 'Control+Alt+K', home: 'Control+Alt+H', back: 'Control+Alt+J', forward: 'Control+Alt+L', zoomIn: 'Control+Alt+=', zoomOut: 'Control+Alt+-', zoomReset: 'Control+Alt+0', switchSite: 'Control+Alt+W', openBrowser: 'Control+Alt+B'
};
const HOTKEY_LABELS = { Control: 'Ctrl', Command: 'Win', Super: 'Win', Alt: 'Alt', Shift: 'Shift', Up: '↑', Down: '↓', Left: '←', Right: '→', PageUp: 'PgUp', PageDown: 'PgDn', Space: 'Space' };
let hotkeyDraft = { ...DEFAULT_HOTKEYS, ...(cfg.hotkeys || {}) };
let recordingHotkey = null;
let recordingCaptured = [];
native.setHotkeys(hotkeyDraft).then((result) => {
  if (!result?.hotkeys) {
    toast('Не удалось применить горячие клавиши', 'error');
    return;
  }
  cfg.hotkeys = { ...result.hotkeys };
  hotkeyDraft = { ...DEFAULT_HOTKEYS, ...result.hotkeys };
  const failedActions = (result.failed || []).filter((item) => HOTKEYS.some(([key]) => key === item.key) && hotkeyDraft[item.key]);
  if (failedActions.length) {
    toast(`Недоступны сочетания: ${failedActions.map((item) => formatHotkey(item.accelerator)).join(', ')}`, 'error');
  }
  renderHotkeys();
}).catch((error) => {
  toast(`Не удалось применить горячие клавиши: ${String(error?.message || error)}`, 'error');
});

function formatHotkey(value) {
  if (!value) return 'Не назначено';
  return String(value).split('+').map(x => HOTKEY_LABELS[x] || x).join(' + ');
}

let hotkeySectionFilter = 'all';
document.querySelectorAll('#hotkeys-nav-list .settings-nav-item').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#hotkeys-nav-list .settings-nav-item').forEach(x=>x.classList.toggle('active',x===b));
  hotkeySectionFilter = b.dataset.hkFilter || 'all';
  renderHotkeys();
}));
function renderHotkeys() {
  if (!hotkeysList) return;
  hotkeysList.innerHTML = '';
  let group = '';
  for (const [key, name, section, description] of HOTKEYS) {
    if (hotkeySectionFilter !== 'all' && section !== hotkeySectionFilter) continue;
    if (section !== group) {
      group = section;
      if (hotkeySectionFilter === 'all') {
        const title = document.createElement('div');
        title.className = 'hotkeys-group-title';
        title.textContent = section;
        hotkeysList.appendChild(title);
      }
    }
    const row = document.createElement('div');
    row.className = 'hotkey-row editable' + (recordingHotkey === key ? ' recording' : '');
    const textWrap = document.createElement('div');
    textWrap.className = 'hotkey-text';
    const text = document.createElement('b');
    text.textContent = name;
    const desc = document.createElement('i');
    desc.textContent = recordingHotkey === key ? 'Нажми нужную комбинацию. Esc — отмена, Backspace — убрать.' : description;
    textWrap.append(text, desc);
    const value = document.createElement('kbd');
    value.textContent = recordingHotkey === key
      ? (recordingCaptured.length ? formatHotkey(recordingCaptured.join('+')) : 'Нажми клавиши…')
      : formatHotkey(hotkeyDraft[key]);
    const edit = document.createElement('button');
    edit.className = 'hotkey-edit';
    edit.textContent = recordingHotkey === key ? 'Отмена' : 'Изменить';
    edit.addEventListener('click', () => {
      if (recordingHotkey === key) stopHotkeyRecording();
      else {
        recordingHotkey = key;
        recordingCaptured = [];
        renderHotkeys();
      }
    });
    row.append(textWrap, value, edit);
    hotkeysList.appendChild(row);
  }
}

function stopHotkeyRecording() {
  recordingHotkey = null;
  recordingCaptured = [];
  renderHotkeys();
}

function hotkeyTokenFromEvent(e) {
  const map = {
    ' ': 'Space',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End'
  };
  if (['Control','Alt','Shift','Meta'].includes(e.key)) return null;
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(e.key)) return e.key.toUpperCase();
  return map[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
}

function getRecordedModifiers(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Control');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');
  return parts;
}

function normalizeRecordedCombo(e) {
  const token = hotkeyTokenFromEvent(e);
  if (!token) return '';
  return [...getRecordedModifiers(e), token].join('+');
}

function hasHotkeyConflict(combo, currentKey) {
  const normalize = (value) => String(value || '').trim().split('+').map((part) =>
    /^command$/i.test(part.trim()) ? 'Super' : part.trim()).join('+').toLowerCase();
  const target = normalize(combo);
  return HOTKEYS.some(([key]) => key !== currentKey && normalize(hotkeyDraft[key]) === target);
}

async function saveRecordedHotkey(combo) {
  const key = recordingHotkey;
  if (!key || !combo) return;
  if (hasHotkeyConflict(combo, key)) {
    toast('Эта комбинация уже назначена другой команде', 'error');
    return;
  }
  const previous = hotkeyDraft[key];
  hotkeyDraft[key] = combo;
  const result = await native.setHotkeys(hotkeyDraft);
  if (result?.failed?.some(item => item.key === key)) {
    hotkeyDraft[key] = previous;
    await native.setHotkeys(hotkeyDraft);
    toast(`Не удалось назначить ${formatHotkey(combo)}`, 'error');
    renderHotkeys();
    return;
  }
  cfg.hotkeys = { ...hotkeyDraft };
  recordingHotkey = null;
  recordingCaptured = [];
  renderHotkeys();
  toast(`Хоткей изменён: ${formatHotkey(combo)}`);
}

window.addEventListener('keydown', async e => {
  if (!recordingHotkey) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') {
    stopHotkeyRecording();
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const key = recordingHotkey;
    const previous = hotkeyDraft[key];
    hotkeyDraft[key] = '';
    const result = await native.setHotkeys(hotkeyDraft);
    if (result?.failed?.some(item => item.key === key)) {
      hotkeyDraft[key] = previous;
      await native.setHotkeys(hotkeyDraft);
      toast('Не удалось отключить хоткей', 'error');
      renderHotkeys();
      return;
    }
    cfg.hotkeys = { ...hotkeyDraft };
    recordingHotkey = null;
    recordingCaptured = [];
    renderHotkeys();
    toast('Хоткей отключён');
    return;
  }
  const combo = normalizeRecordedCombo(e);
  if (!combo) return;
  recordingCaptured = combo.split('+');
  renderHotkeys();
  await saveRecordedHotkey(combo);
}, true);

function openHotkeys() {
  stopHotkeyRecording();
  renderHotkeys();
  hotkeysModal?.classList.add('show');
}
function closeHotkeys() {
  stopHotkeyRecording();
  hotkeysModal?.classList.remove('show');
}

btnHotkeys?.addEventListener('click', openHotkeys);
btnHotkeysMain?.addEventListener('click', openHotkeys);
btnCloseHotkeys?.addEventListener('click', closeHotkeys);
btnHotkeysReset?.addEventListener('click', async () => {
  if (!await askConfirmation('Сбросить все горячие клавиши к значениям по умолчанию?', 'Сбросить клавиши')) return;
  const previous = { ...hotkeyDraft };
  hotkeyDraft = { ...DEFAULT_HOTKEYS };
  const result = await native.setHotkeys(hotkeyDraft);
  if (result?.failed?.some(item => HOTKEYS.some(([key]) => key === item.key))) {
    hotkeyDraft = previous;
    await native.setHotkeys(previous);
    toast('Не удалось сбросить горячие клавиши', 'error');
    renderHotkeys();
    return;
  }
  cfg.hotkeys = { ...hotkeyDraft };
  stopHotkeyRecording();
  renderHotkeys();
  toast('Горячие клавиши сброшены');
});
hotkeysModal?.addEventListener('click', (e) => {
  if (e.target === hotkeysModal) closeHotkeys();
});


  async function applyImported(settings) {
    hotkeyDraft = { ...DEFAULT_HOTKEYS, ...(settings || {}) };
    const result = await native.setHotkeys(hotkeyDraft);
    if (result?.hotkeys) {
      cfg.hotkeys = { ...result.hotkeys };
      hotkeyDraft = { ...DEFAULT_HOTKEYS, ...result.hotkeys };
      const failedActions = (result.failed || []).filter((item) => HOTKEYS.some(([key]) => key === item.key) && hotkeyDraft[item.key]);
      if (failedActions.length) toast(`Недоступны сочетания: ${failedActions.map((item) => formatHotkey(item.accelerator)).join(', ')}`, 'error');
      renderHotkeys();
    }
    return result;
  }

  return { formatHotkey, renderHotkeys, openHotkeys, closeHotkeys, applyImported };
}