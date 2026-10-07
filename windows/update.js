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
const currentEl = document.getElementById('ud-current');
const latestEl = document.getElementById('ud-latest');
const statusTitleEl = document.getElementById('ud-status-title');
const downloadCard = document.getElementById('download-card');
const notesEl = document.getElementById('ud-notes');
const statusEl = document.getElementById('ud-status');
const forceChip = document.getElementById('force-chip');
const progressEl = document.getElementById('ud-progress');
const fillEl = document.getElementById('udp-fill');
const pctEl = document.getElementById('udp-pct');
const speedEl = document.getElementById('udp-speed');
const sizeEl = document.getElementById('udp-size');
const btnDownload = document.getElementById('btn-download');
const btnLater = document.getElementById('btn-later');
const historyList = document.getElementById('history-list');
const btnRollback = document.createElement('button');
btnRollback.type = 'button';
btnRollback.className = 'secondary-btn rollback-btn';
btnRollback.textContent = 'Откатиться к прошлой версии';
btnRollback.addEventListener('click', async () => {
  const result = await window.native.rollbackUpdate();
  if (!result || !result.ok) {
    statusTitleEl.textContent = 'Откат недоступен';
    statusEl.textContent = result?.error || 'Не удалось найти резервную копию';
    return;
  }
  statusTitleEl.textContent = 'Откат запускается';
  statusEl.textContent = 'Нажмите ОК в системном диалоге, если он появится';
});

let downloading = false;

function renderUpdateInfo(info) {
  if (!info) return;
  const force = !!info.force;
  versionEl.textContent = `v${info.current} → v${info.latest}`;
  currentEl.textContent = `v${info.current}`;
  latestEl.textContent = `v${info.latest}`;
  forceChip.classList.toggle('hidden', !force);
  if (force) forceChip.textContent = 'Обязательно';
  const notes = (info.notes || '').trim();
  notesEl.textContent = notes || 'Описание обновления не добавлено.';
  notesEl.classList.toggle('dim', !notes);
  renderHistory(info.history || []);
  if (!document.body.contains(btnRollback)) {
    const actions = document.querySelector('.update-actions');
    if (actions) actions.appendChild(btnRollback);
  }
}

function renderHistory(items = []) {
  if (!historyList) return;
  if (!Array.isArray(items) || !items.length) {
    historyList.innerHTML = '<div class="history-empty">История релизов пока недоступна.</div>';
    return;
  }
  historyList.innerHTML = items.slice(0, 6).map((item) => `
    <div class="history-item ${item.force ? 'history-force' : ''}">
      <b>${(item.name || item.version || 'Release').replace(/\s+/g, ' ').trim()}</b>
      <span>${item.version || '—'}${item.force ? ' • обязательно' : ''}</span>
      <small>${item.notes ? (item.notes.slice(0, 160) || 'Изменения не добавлены') : 'Изменения не добавлены'}</small>
    </div>
  `).join('');
}

window.native.onUpdData((info) => renderUpdateInfo(info));

function formatBytes(n) { if (!Number.isFinite(Number(n)) || Number(n) <= 0) return '—'; const u=['B','KB','MB','GB']; let x=Number(n),i=0; while(x>=1024&&i<u.length-1){x/=1024;i++} return `${x.toFixed(i?1:0)} ${u[i]}`; }
function formatSpeed(n) { return Number.isFinite(Number(n)) && Number(n)>0 ? `${formatBytes(n)}/с` : '—'; }
const spark = document.getElementById('spark');
const sctx = spark.getContext('2d');
const hist = new Array(48).fill(0);
const idleIcon = document.getElementById('download-icon').innerHTML;
function drawSpark() {
  const W = spark.width, H = spark.height;
  sctx.clearRect(0, 0, W, H);
  const max = Math.max(...hist);
  if (max <= 0) return;
  const grad = sctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#818cf8');
  grad.addColorStop(1, '#c7d2fe');
  sctx.beginPath();
  hist.forEach((v, i) => {
    const x = (i / (hist.length - 1)) * W;
    const y = H - 4 - (v / max) * (H - 8);
    if (i === 0) sctx.moveTo(x, y); else sctx.lineTo(x, y);
  });
  sctx.strokeStyle = grad;
  sctx.lineWidth = 3;
  sctx.lineJoin = 'round';
  sctx.stroke();
  sctx.lineTo(W, H);
  sctx.lineTo(0, H);
  sctx.closePath();
  const fill = sctx.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, 'rgba(129,140,248,.35)');
  fill.addColorStop(1, 'rgba(129,140,248,0)');
  sctx.fillStyle = fill;
  sctx.fill();
}
function setProgress(pct, stage, extra={}) {
  progressEl.classList.remove('hidden');
  const known=Number.isFinite(Number(pct));
  const safePct=known?Math.max(0,Math.min(Number(pct),100)):0;
  fillEl.style.width=known?safePct+'%':'38%';
  fillEl.parentElement.classList.toggle('indeterminate',!known);
  pctEl.textContent=known?Math.round(safePct)+'%':'…';
  if (stage === 'download' && Number.isFinite(Number(extra.speed)) && Number(extra.speed) > 0) {
    hist.push(Number(extra.speed));
    hist.shift();
    drawSpark();
  } else if (stage !== 'download') {
    hist.fill(0);
    drawSpark();
  }
  if(speedEl) speedEl.textContent=stage==='download'?formatSpeed(extra.speed):'';
  if(sizeEl) sizeEl.textContent=stage==='download'?`${formatBytes(extra.received)} / ${formatBytes(extra.total)}`:'';
  if (stage === 'verify') {
    statusTitleEl.textContent = 'Проверка файла';
    statusEl.textContent = 'Проверяю целостность скачанного файла…';
    statusEl.className = '';
  }
  if (stage === 'ready') {
    downloading = false;
    statusTitleEl.textContent = 'Обновление скачано';
    statusEl.textContent = 'Файл проверен, всё готово к установке';
    downloadCard.classList.remove('state-downloading');
    downloadCard.classList.add('state-ready');
    statusEl.className = 'ud-status ok';
    document.getElementById('download-icon').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="draw" d="M8.5 12.5l2.5 2.5 4.5-5.5"/></svg>';
    btnDownload.classList.add('ready');
    btnDownload.querySelector('span').textContent = 'Установить и перезапустить';
    btnDownload.disabled = false;
  }
}

window.native.onUpdProgress(({ pct, stage, received, total, speed } = {}) => setProgress(pct, stage, {received,total,speed}));

btnDownload.addEventListener('click', async () => {
  if (downloadCard.classList.contains('state-ready')) { window.native.updInstall(); return; }
  if (downloading) return;
  downloading = true;
  btnDownload.disabled = true;
  btnLater.classList.add('hidden');
  statusTitleEl.textContent = 'Скачивание обновления';
  statusEl.textContent = 'Загружаю новую версию, это может занять некоторое время…';
  downloadCard.classList.remove('state-error','state-ready');
  downloadCard.classList.add('state-downloading');
  statusEl.className = 'ud-status';
  document.getElementById('download-icon').innerHTML = idleIcon;
  btnDownload.classList.remove('ready');
  btnDownload.querySelector('span').textContent = 'Скачать и обновить';
  hist.fill(0);
  drawSpark();

  const res = await window.native.updDownload();
  if (!res || !res.ok) {
    downloading = false;
    btnDownload.disabled = false;
    btnLater.classList.remove('hidden');
    progressEl.classList.add('hidden');
    statusTitleEl.textContent = 'Не удалось скачать обновление';
    statusEl.textContent = 'Не получилось скачать: ' + ((res && res.error) || 'неизвестная ошибка');
    downloadCard.classList.remove('state-downloading','state-ready');
    downloadCard.classList.add('state-error');
    statusEl.className = 'ud-status err';
  }
});

btnLater.addEventListener('click', () => window.native.updClose());
document.getElementById('btn-close').addEventListener('click', () => window.native.updClose());

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.native.updClose();
});
