export function initSiteAppearance({ cfg, store, applyGuestStyles, toast, smoothScrollToggle, siteScrollbarsToggle }) {
  const visualRadius = document.getElementById('visual-radius');
  const visualOpacity = document.getElementById('visual-opacity');
  const visualBlur = document.getElementById('visual-blur');
  const visualScale = document.getElementById('visual-scale');
  const visualDensity = document.getElementById('visual-density');
  const visualGlow = document.getElementById('visual-glow');
  const visualApply = document.getElementById('btn-visual-apply');
  const visualReset = document.getElementById('btn-visual-reset');
  const siteStylePresetButtons = [...document.querySelectorAll('[data-site-style-preset]')];

  function getAccentRgb() {
    return getComputedStyle(document.documentElement).getPropertyValue('--a-rgb').trim() || '139,92,246';
  }

  function scrollCss(rgb) {
    return [
      '::-webkit-scrollbar{width:9px;height:9px}',
      '::-webkit-scrollbar-track{background:rgba(255,255,255,.04)}',
      `::-webkit-scrollbar-thumb{background:rgba(${rgb},.55);border-radius:8px}`,
      `::-webkit-scrollbar-thumb:hover{background:rgba(${rgb},.85)}`,
      '::-webkit-scrollbar-corner{background:transparent}',
    ].join('');
  }

  function getVisual() {
    const v = cfg.visual && typeof cfg.visual === 'object' ? cfg.visual : {};
    return {
      radius: Number.isFinite(Number(v.radius)) ? Number(v.radius) : 18,
      opacity: Number.isFinite(Number(v.opacity)) ? Number(v.opacity) : 96,
      blur: Number.isFinite(Number(v.blur)) ? Number(v.blur) : 0,
      scale: Number.isFinite(Number(v.scale)) ? Number(v.scale) : 100,
      density: Number.isFinite(Number(v.density)) ? Number(v.density) : 100,
      accentGlow: Number.isFinite(Number(v.accentGlow)) ? Number(v.accentGlow) : 55,
      animations: ['off', 'smooth', 'cinematic'].includes(v.animations) ? v.animations : 'smooth',
    };
  }

  function hideScrollbarCss() {
    return cfg.showSiteScrollbars
      ? scrollCss(getAccentRgb())
      : '*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}';
  }

  function buildCss() {
    const v = getVisual();
    const scale = v.scale / 100;
    const density = v.density / 100;
    const alpha = v.opacity / 100;
    const glow = v.accentGlow / 100;
    const transition = v.animations === 'cinematic' ? '620ms cubic-bezier(.16,1,.3,1)' : v.animations === 'smooth' ? '360ms cubic-bezier(.22,1,.36,1)' : '0ms';
    return `:root{--animeon-radius:${v.radius}px;--animeon-alpha:${alpha};--animeon-blur:${v.blur}px;--animeon-density:${density};--animeon-transition:${transition};--animeon-glow:${glow};--animeon-scale:${scale}}html{font-size:${v.scale}%!important;scroll-behavior:${cfg.smoothSite !== false ? 'smooth' : 'auto'}!important;scroll-padding-top:16px}body{opacity:${alpha}!important;line-height:calc(1.45 * ${density})!important}:where(article,[class*="card"],[class*="Card"],[role="dialog"],[role="menu"],button,input,select,[role="button"]){border-radius:var(--animeon-radius)!important}:where([role="dialog"],[role="menu"],[class*="modal"],[class*="Modal"],[class*="popover"],[class*="Popover"]){backdrop-filter:blur(var(--animeon-blur)) saturate(135%)!important;-webkit-backdrop-filter:blur(var(--animeon-blur)) saturate(135%)!important}:where(button,a,[role="button"]):hover{box-shadow:0 0 18px rgba(${getAccentRgb()},${glow * 0.22})!important}${hideScrollbarCss()}`;
  }

  function syncRangeFill(element) {
    if (!element) return;
    const min = Number(element.min) || 0;
    const max = Number(element.max) || 100;
    const value = Number(element.value);
    element.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
  }

  function syncAllRangeFills() {
    [visualRadius, visualOpacity, visualBlur, visualScale, visualDensity, visualGlow].forEach(syncRangeFill);
  }

  function syncVisualUI() {
    const visual = getVisual();
    const set = (element, value, output, suffix) => {
      if (!element) return;
      element.value = value;
      if (output) output.textContent = `${value}${suffix}`;
    };
    set(visualRadius, visual.radius, document.getElementById('visual-radius-value'), 'px');
    set(visualOpacity, visual.opacity, document.getElementById('visual-opacity-value'), '%');
    set(visualBlur, visual.blur, document.getElementById('visual-blur-value'), 'px');
    set(visualScale, visual.scale, document.getElementById('visual-scale-value'), '%');
    set(visualDensity, visual.density, document.getElementById('visual-density-value'), '%');
    set(visualGlow, visual.accentGlow, document.getElementById('visual-glow-value'), '%');
    syncAllRangeFills();
    const presetValues = {
      default: [18, 92, 0, 100, 100, 70],
      compact: [12, 100, 0, 92, 90, 20],
      readable: [20, 100, 0, 110, 110, 45],
      glass: [22, 94, 14, 100, 100, 65],
    };
    const actual = [visual.radius, visual.opacity, visual.blur, visual.scale, visual.density, visual.accentGlow];
    siteStylePresetButtons.forEach((button) => {
      const values = presetValues[button.dataset.siteStylePreset];
      button.classList.toggle('active', !!values && values.every((value, index) => value === actual[index]));
    });
  }

  function readVisualUI() {
    const read = (element, fallback) => Number.isFinite(Number(element?.value)) ? Number(element.value) : fallback;
    return {
      radius: read(visualRadius, 18),
      opacity: read(visualOpacity, 92),
      blur: read(visualBlur, 0),
      scale: read(visualScale, 100),
      density: read(visualDensity, 100),
      accentGlow: read(visualGlow, 70),
      animations: getVisual().animations,
    };
  }

  async function applyVisualStyle(save = true) {
    cfg.visual = readVisualUI();
    if (save) store('visual', cfg.visual);
    await applyGuestStyles();
  }

  let visualApplyTimer = null;
  [visualRadius, visualOpacity, visualBlur, visualScale, visualDensity, visualGlow].forEach((element) => element?.addEventListener('input', () => {
    const output = document.getElementById(`${element.id}-value`);
    if (output) output.textContent = `${element.value}${element.id.includes('radius') || element.id.includes('blur') ? 'px' : '%'}`;
    syncRangeFill(element);
    siteStylePresetButtons.forEach((button) => button.classList.remove('active'));
    clearTimeout(visualApplyTimer);
    visualApplyTimer = setTimeout(() => applyVisualStyle(true), 120);
  }));
  syncAllRangeFills();
  visualApply?.addEventListener('click', () => applyVisualStyle(true).then(() => toast('Визуальный стиль применён')));
  visualReset?.addEventListener('click', () => {
    cfg.visual = { radius: 18, opacity: 92, blur: 0, scale: 100, density: 100, accentGlow: 70, animations: 'smooth' };
    store('visual', cfg.visual);
    syncVisualUI();
    applyGuestStyles();
    toast('Оформление сброшено');
  });

  const siteStylePresets = {
    default: { radius: 18, opacity: 92, blur: 0, scale: 100, density: 100, accentGlow: 70, animations: 'smooth' },
    compact: { radius: 12, opacity: 100, blur: 0, scale: 92, density: 90, accentGlow: 20, animations: 'off' },
    readable: { radius: 20, opacity: 100, blur: 0, scale: 110, density: 110, accentGlow: 45, animations: 'smooth' },
    glass: { radius: 22, opacity: 94, blur: 14, scale: 100, density: 100, accentGlow: 65, animations: 'cinematic' },
  };
  siteStylePresetButtons.forEach((button) => button.addEventListener('click', () => {
    const preset = siteStylePresets[button.dataset.siteStylePreset];
    if (!preset) return;
    cfg.visual = { ...preset };
    store('visual', cfg.visual);
    syncVisualUI();
    applyGuestStyles();
  }));

  smoothScrollToggle?.addEventListener('change', () => {
    store('smoothSite', smoothScrollToggle.checked);
    applyGuestStyles();
  });
  siteScrollbarsToggle?.addEventListener('change', () => {
    store('showSiteScrollbars', siteScrollbarsToggle.checked);
    applyGuestStyles();
  });

  return { getVisual, syncVisualUI, buildCss };
}
