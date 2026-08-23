const cfg = window.native.getConfig();
if (cfg.theme === 'custom' && cfg.custom) {
  const n = parseInt(cfg.custom.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  document.documentElement.style.setProperty('--a-rgb', `${r},${g},${b}`);
  document.documentElement.style.setProperty('--al-rgb',
    `${Math.min(r + 60, 255)},${Math.min(g + 60, 255)},${Math.min(b + 60, 255)}`);
} else if (cfg.theme !== 'violet') {
  document.documentElement.dataset.theme = cfg.theme;
}

const ver = document.getElementById('tm-ver');
const info = window.native.getAppInfo();
if (info && info.version && ver) ver.textContent = 'v' + info.version;

document.getElementById('tm-open').addEventListener('click', () => window.native.trayAction('open'));
document.getElementById('tm-settings').addEventListener('click', () => window.native.trayAction('settings'));
document.getElementById('tm-quit').addEventListener('click', () => window.native.trayAction('quit'));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close();
});
