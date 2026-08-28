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

const versionEl = document.getElementById('ud-version');
const notesEl = document.getElementById('ud-notes');
const statusEl = document.getElementById('ud-status');
const progressEl = document.getElementById('ud-progress');
const fillEl = document.getElementById('udp-fill');
const pctEl = document.getElementById('udp-pct');
const speedEl = document.getElementById('udp-speed');
const sizeEl = document.getElementById('udp-size');
const btnDownload = document.getElementById('btn-download');
const btnLater = document.getElementById('btn-later');

let downloading = false;

window.native.onUpdData((info) => {
  if (!info) return;
  versionEl.textContent = `v${info.current} → v${info.latest}`;
  const notes = (info.notes || '').trim();
  notesEl.textContent = notes || 'Описание обновления не добавлено.';
  if (!notes) notesEl.classList.add('dim');
});

function formatBytes(n) { if (!Number.isFinite(Number(n)) || Number(n) <= 0) return '—'; const u=['B','KB','MB','GB']; let x=Number(n),i=0; while(x>=1024&&i<u.length-1){x/=1024;i++} return `${x.toFixed(i?1:0)} ${u[i]}`; }
function formatSpeed(n) { return Number.isFinite(Number(n)) && Number(n)>0 ? `${formatBytes(n)}/с` : '—'; }
function setProgress(pct, stage, extra={}) {
  progressEl.classList.remove('hidden');
  const known=Number.isFinite(Number(pct));
  const safePct=known?Math.max(0,Math.min(Number(pct),100)):0;
  fillEl.style.width=known?safePct+'%':'38%';
  fillEl.parentElement.classList.toggle('indeterminate',!known);
  pctEl.textContent=known?Math.round(safePct)+'%':'…';
  if(speedEl) speedEl.textContent=stage==='download'?formatSpeed(extra.speed):'';
  if(sizeEl) sizeEl.textContent=stage==='download'?`${formatBytes(extra.received)} / ${formatBytes(extra.total)}`:'';
  if (stage === 'ready') {
    statusEl.textContent = 'Готово. Программа сейчас перезапустится';
    statusEl.className = 'ud-status ok';
    setTimeout(() => window.native.updInstall(), 700);
  }
}

window.native.onUpdProgress(({ pct, stage, received, total, speed } = {}) => setProgress(pct, stage, {received,total,speed}));

btnDownload.addEventListener('click', async () => {
  if (downloading) return;
  downloading = true;
  btnDownload.disabled = true;
  btnLater.classList.add('hidden');
  statusEl.textContent = 'Скачиваю обновление…';
  statusEl.className = 'ud-status';

  const res = await window.native.updDownload();
  if (!res || !res.ok) {
    downloading = false;
    btnDownload.disabled = false;
    btnLater.classList.remove('hidden');
    progressEl.classList.add('hidden');
    statusEl.textContent = 'Не получилось скачать: ' + ((res && res.error) || 'неизвестная ошибка');
    statusEl.className = 'ud-status err';
  }
});

btnLater.addEventListener('click', () => window.native.updClose());
document.getElementById('btn-close').addEventListener('click', () => window.native.updClose());

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.native.updClose();
});
