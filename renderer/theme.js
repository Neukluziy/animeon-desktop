export function initThemeController({ cfg, store, applyGuestStyles, toast }) {
  const themeSwatches = [...document.querySelectorAll('.theme-swatch')];
  const themeName = document.getElementById('theme-name');
  const customColorInput = document.getElementById('custom-color-input');
  const customColorOpen = document.getElementById('custom-color-open');
  const customPicker = document.getElementById('custom-picker');
  const customPickerClose = document.getElementById('custom-picker-close');
  const customPickerDone = document.getElementById('custom-picker-done');
  const customHexInput = document.getElementById('custom-hex-input');
  const customPickerCopy = document.getElementById('custom-picker-copy');
  const customPickerEyedropper = document.getElementById('custom-picker-eyedropper');
  const pickerSv = document.getElementById('picker-sv');
  const pickerCursor = document.getElementById('picker-cursor');
  const pickerHue = document.getElementById('picker-hue');
  const pickerHueCursor = document.getElementById('picker-hue-cursor');
  const pickerPreviewName = document.getElementById('custom-picker-preview-name');
  const customColorValue = document.getElementById('custom-color-value');
  const customColorCopy = document.getElementById('custom-color-copy');
  const themeNames = { violet: 'Фиолетовый', blue: 'Синий', cyan: 'Бирюзовый', sky: 'Небесный', indigo: 'Индиго', emerald: 'Изумрудный', green: 'Зелёный', lime: 'Лаймовый', yellow: 'Жёлтый', amber: 'Янтарный', orange: 'Оранжевый', red: 'Красный', rose: 'Розовый', pink: 'Розовый', fuchsia: 'Фуксия', slate: 'Серо-синий', gray: 'Серый', teal: 'Тёмная бирюза', mint: 'Мята', gold: 'Золото', coral: 'Коралл', lavender: 'Лаванда', crimson: 'Алый', electric: 'Электрик', light: 'Светлая' };
  const presetThemes = new Set(['violet', 'blue', 'cyan', 'sky', 'indigo', 'emerald', 'green', 'lime', 'yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia', 'slate', 'gray', 'teal', 'mint', 'gold', 'coral', 'lavender', 'crimson', 'electric', 'light']);
  let activeTheme = presetThemes.has(cfg.theme) || cfg.theme === 'custom' ? cfg.theme : 'violet';
  let pickerHueValue = 260;
  let pickerSatValue = 0.65;
  let pickerValValue = 0.96;
  let pickerOpen = false;
  if (!cfg.custom) cfg.custom = '#8b5cf6';

  function resetThemeVars() {
    ['--a-rgb', '--al-rgb', '--am-rgb', '--ad-rgb'].forEach((property) => document.documentElement.style.removeProperty(property));
  }

  function hexRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((value) => value + value).join('') : clean.padEnd(6, '0').slice(0, 6);
    const value = Number.parseInt(full, 16) || 0x8b5cf6;
    return [value >> 16 & 255, value >> 8 & 255, value & 255];
  }

  function mixRgb(rgb, target, amount) {
    return rgb.map((value, index) => Math.round(value + (target[index] - value) * amount));
  }

  function applyCustomColor(hex) {
    const rgb = hexRgb(hex);
    const light = mixRgb(rgb, [255, 255, 255], 0.42);
    const mid = mixRgb(rgb, [0, 0, 0], 0.18);
    const dark = mixRgb(rgb, [0, 0, 0], 0.38);
    const root = document.documentElement;
    root.style.setProperty('--a-rgb', rgb.join(','));
    root.style.setProperty('--al-rgb', light.join(','));
    root.style.setProperty('--am-rgb', mid.join(','));
    root.style.setProperty('--ad-rgb', dark.join(','));
  }

  function isNight() {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 6;
  }

  function applyTheme(theme, options = {}) {
    document.documentElement.classList.add('theme-transitioning');
    clearTimeout(window.__themeTransitionTimer);
    window.__themeTransitionTimer = setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 520);
    if (theme !== undefined) activeTheme = theme;
    resetThemeVars();
    document.documentElement.dataset.theme = activeTheme;
    if (activeTheme === 'custom') applyCustomColor(cfg.custom);
    themeSwatches.forEach((swatch) => swatch.classList.toggle('active', swatch.dataset.theme === activeTheme));
    if (themeName) themeName.textContent = activeTheme === 'custom' ? 'Свой цвет' : (themeNames[activeTheme] || activeTheme);
    if (customColorInput) customColorInput.value = cfg.custom || '#8b5cf6';
    if (customColorValue) customColorValue.textContent = String(cfg.custom || '#8b5cf6').toUpperCase();
    customColorOpen?.style.setProperty('--picker-color', cfg.custom || '#8b5cf6');
    if (pickerOpen) updatePickerVisual(cfg.custom || '#8B5CF6');
    if (!options.skipSave) store('theme', activeTheme);
    applyGuestStyles();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hsvToHex(hue, saturation, value) {
    const chroma = value * saturation;
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = value - chroma;
    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = chroma; g = x; }
    else if (hue < 120) { r = x; g = chroma; }
    else if (hue < 180) { g = chroma; b = x; }
    else if (hue < 240) { g = x; b = chroma; }
    else if (hue < 300) { r = x; b = chroma; }
    else { r = chroma; b = x; }
    return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }

  function hexToHsv(hex) {
    const [r, g, b] = hexRgb(hex).map((value) => value / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = 60 * ((g - b) / delta % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
      if (hue < 0) hue += 360;
    }
    return [hue, max ? delta / max : 0, max];
  }

  function validHex(value) {
    return /^#?(?:[0-9a-f]{6}|[0-9a-f]{3})$/i.test(String(value).trim());
  }

  function normalizeHex(value) {
    let result = String(value).trim().replace(/^#/, '');
    if (result.length === 3) result = result.split('').map((char) => char + char).join('');
    return `#${result.toUpperCase()}`;
  }

  function updatePickerVisual(hex) {
    const [hue, saturation, value] = hexToHsv(hex);
    pickerHueValue = hue;
    pickerSatValue = saturation;
    pickerValValue = value;
    if (pickerSv) pickerSv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,rgba(255,255,255,0)),hsl(${hue} 100% 50%)`;
    if (pickerCursor) {
      pickerCursor.style.left = `${saturation * 100}%`;
      pickerCursor.style.top = `${(1 - value) * 100}%`;
    }
    if (pickerHueCursor) pickerHueCursor.style.left = `${hue / 360 * 100}%`;
    if (customHexInput) customHexInput.value = normalizeHex(hex);
    if (pickerPreviewName) pickerPreviewName.textContent = normalizeHex(hex);
  }

  function setCustomHex(hex, save = true) {
    if (!validHex(hex)) return false;
    const value = normalizeHex(hex);
    cfg.custom = value;
    activeTheme = 'custom';
    if (save) {
      store('custom', value);
      store('theme', 'custom');
    }
    applyTheme('custom', { skipSave: true });
    updatePickerVisual(value);
    return true;
  }

  function openCustomPicker() {
    if (!customPicker) return;
    pickerOpen = true;
    customPicker.hidden = false;
    updatePickerVisual(cfg.custom || '#8B5CF6');
    customHexInput?.focus();
    customHexInput?.select();
  }

  function closeCustomPicker() {
    pickerOpen = false;
    if (customPicker) customPicker.hidden = true;
  }

  function pickFromSv(event) {
    const rect = pickerSv.getBoundingClientRect();
    pickerSatValue = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    pickerValValue = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    setCustomHex(hsvToHex(pickerHueValue, pickerSatValue, pickerValValue));
  }

  function pickFromHue(event) {
    const rect = pickerHue.getBoundingClientRect();
    pickerHueValue = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360;
    setCustomHex(hsvToHex(pickerHueValue, pickerSatValue, pickerValValue));
  }

  function dragPicker(element, callback) {
    if (!element) return;
    let down = false;
    const apply = (event) => { callback(event); event.preventDefault(); };
    element.addEventListener('pointerdown', (event) => { down = true; try { element.setPointerCapture(event.pointerId); } catch {} apply(event); });
    element.addEventListener('pointermove', (event) => { if (down) apply(event); });
    element.addEventListener('pointerup', () => { down = false; });
    element.addEventListener('pointercancel', () => { down = false; });
    element.addEventListener('lostpointercapture', () => { down = false; });
    element.addEventListener('click', apply);
    element.addEventListener('mousedown', apply);
  }

  customColorOpen?.addEventListener('click', () => pickerOpen ? closeCustomPicker() : openCustomPicker());
  customPickerClose?.addEventListener('click', closeCustomPicker);
  customPickerDone?.addEventListener('click', () => {
    if (validHex(customHexInput?.value || '')) {
      setCustomHex(customHexInput.value);
      closeCustomPicker();
    } else toast('Введи HEX вроде #8B5CF6', 'error');
  });
  customHexInput?.addEventListener('input', () => {
    const raw = customHexInput.value.trim();
    if (validHex(raw)) setCustomHex(raw);
  });
  customHexInput?.addEventListener('paste', () => setTimeout(() => {
    if (validHex(customHexInput.value)) setCustomHex(customHexInput.value);
  }, 0));
  customHexInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (validHex(customHexInput.value)) {
      setCustomHex(customHexInput.value);
      closeCustomPicker();
    } else toast('Введи HEX вроде #8B5CF6', 'error');
  });
  dragPicker(pickerSv, pickFromSv);
  dragPicker(pickerHue, pickFromHue);
  customPickerCopy?.addEventListener('click', async () => {
    const value = normalizeHex(cfg.custom || '#8B5CF6');
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    toast('HEX скопирован');
  });
  customColorCopy?.addEventListener('click', async () => {
    const value = normalizeHex(cfg.custom || '#8B5CF6');
    try {
      await navigator.clipboard.writeText(value);
      customColorCopy.querySelector('span:last-child').textContent = 'Скопировано';
      setTimeout(() => {
        const label = customColorCopy.querySelector('span:last-child');
        if (label) label.textContent = 'Копировать';
      }, 1100);
      toast('HEX скопирован');
    } catch {
      toast('Не удалось скопировать', 'error');
    }
  });
  customPickerEyedropper?.addEventListener('click', async () => {
    if (!window.EyeDropper) {
      toast('Пипетка недоступна в этой версии Chromium', 'error');
      return;
    }
    try {
      const result = await new EyeDropper().open();
      setCustomHex(result.sRGBHex);
      toast('Цвет выбран');
    } catch {}
  });

  setInterval(() => {
    const night = isNight();
    if (night === document.documentElement.hasAttribute('data-night')) return;
    if (night) document.documentElement.dataset.night = '1';
    else delete document.documentElement.dataset.night;
    applyTheme(undefined, { skipSave: true });
  }, 60000);

  themeSwatches.forEach((swatch) => swatch.addEventListener('click', () => applyTheme(swatch.dataset.theme)));
  return { applyTheme, getActiveTheme: () => activeTheme };
}
