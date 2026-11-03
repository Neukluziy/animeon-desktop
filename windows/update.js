export function initUpdatePanel({ native, host, template }) {
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.append(template.content.cloneNode(true));
  const $ = (id) => shadow.getElementById(id);
  const dialog = shadow.querySelector('.update-window');
  const backdrop = shadow.querySelector('.update-backdrop');
  const versionEl = $('ud-version');
  const currentEl = $('ud-current');
  const latestEl = $('ud-latest');
  const statusTitleEl = $('ud-status-title');
  const downloadCard = $('download-card');
  const notesEl = $('ud-notes');
  const statusEl = $('ud-status');
  const forceChip = $('force-chip');
  const progressEl = $('ud-progress');
  const fillEl = $('udp-fill');
  const pctEl = $('udp-pct');
  const speedEl = $('udp-speed');
  const sizeEl = $('udp-size');
  const btnDownload = $('btn-download');
  const btnLater = $('btn-later');
  const downloadControls = $('download-controls');
  const btnPause = $('btn-pause');
  const btnCancel = $('btn-cancel');

  let downloading = false;
  let paused = false;
  let previousFocus = null;

  function showActionError(message) {
    downloading = false;
    paused = false;
    btnDownload.disabled = false;
    btnLater.classList.remove('hidden');
    downloadControls.classList.add('hidden');
    btnPause.disabled = false;
    btnCancel.disabled = false;
    btnPause.textContent = 'Пауза';
    btnPause.setAttribute('aria-pressed', 'false');
    progressEl.classList.add('hidden');
    downloadCard.classList.remove('state-downloading', 'state-ready', 'state-paused');
    downloadCard.classList.add('state-error');
    btnDownload.classList.remove('ready');
    downloadIcon.innerHTML = idleIcon;
    statusTitleEl.textContent = 'Не удалось выполнить действие';
    statusEl.textContent = message;
    statusEl.className = 'ud-status err';
  }

  function showCancelled() {
    downloading = false;
    paused = false;
    btnDownload.disabled = false;
    btnDownload.classList.remove('ready');
    btnDownload.querySelector('span').textContent = 'Повторить скачивание';
    btnLater.classList.remove('hidden');
    downloadControls.classList.add('hidden');
    btnPause.disabled = false;
    btnCancel.disabled = false;
    btnPause.textContent = 'Пауза';
    btnPause.setAttribute('aria-pressed', 'false');
    progressEl.classList.add('hidden');
    downloadCard.classList.remove('state-downloading', 'state-ready', 'state-error', 'state-paused');
    statusTitleEl.textContent = 'Скачивание отменено';
    statusEl.textContent = 'Можно начать загрузку заново.';
    statusEl.className = '';
    downloadIcon.innerHTML = idleIcon;
  }

  async function loadUpdateInfo() {
    try {
      const info = await native.update.getData();
      renderUpdateInfo(info);
    } catch (error) {
      console.error('[AnimeOn] Не удалось загрузить данные обновления:', error);
      showUpdateInfoError(String(error?.message || error));
    }
  }

  function renderUpdateInfo(info) {
    if (!info?.ok) {
      showUpdateInfoError(info?.reason || 'Не удалось получить сведения об обновлении.');
      return;
    }
    downloadCard.classList.remove('state-error', 'state-downloading');
    progressEl.classList.add('hidden');
    statusEl.className = '';
    const force = !!info.force;
    versionEl.textContent = `v${info.current} → v${info.latest}`;
    currentEl.textContent = `v${info.current}`;
    latestEl.textContent = `v${info.latest}`;
    forceChip.classList.toggle('hidden', !force);
    if (force) forceChip.textContent = 'Обязательно';
    const notes = (info.notes || '').trim();
    renderNotes(notes || 'Описание обновления не добавлено.');
    notesEl.classList.toggle('dim', !notes);
    if (info.hasUpdate) {
      statusTitleEl.textContent = 'Готово к установке';
      statusEl.textContent = 'Нажмите кнопку ниже, чтобы скачать обновление.';
      statusEl.className = '';
      btnDownload.querySelector('span').textContent = 'Скачать и обновить';
      btnDownload.disabled = false;
    } else {
      statusTitleEl.textContent = 'Обновлений нет';
      statusEl.textContent = `У вас установлена последняя версия v${info.current}.`;
      btnDownload.querySelector('span').textContent = 'Обновлений нет';
      btnDownload.disabled = true;
    }
    if (info.downloaded) showDownloadedInstaller(info);
  }

  function showDownloadedInstaller(info) {
    downloading = false;
    paused = false;
    downloadCard.classList.remove('state-downloading', 'state-error', 'state-paused');
    downloadCard.classList.add('state-ready');
    progressEl.classList.remove('hidden');
    fillEl.style.width = '100%';
    fillEl.parentElement.classList.remove('indeterminate');
    pctEl.textContent = '100%';
    sizeEl.textContent = `${formatBytes(info.size)} / ${formatBytes(info.size)}`;
    speedEl.textContent = '';
    downloadControls.classList.add('hidden');
    btnPause.disabled = false;
    btnCancel.disabled = false;
    btnPause.textContent = 'Пауза';
    btnPause.setAttribute('aria-pressed', 'false');
    btnLater.classList.remove('hidden');
    statusTitleEl.textContent = 'Обновление уже скачано';
    statusEl.textContent = 'Файл проверен и готов к установке.';
    statusEl.className = 'ud-status ok';
    downloadIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="draw" d="M8.5 12.5l2.5 2.5 4.5-5.5"/></svg>';
    btnDownload.classList.add('ready');
    btnDownload.querySelector('span').textContent = 'Установить и перезапустить';
    btnDownload.disabled = false;
  }

  function renderNotes(text) {
    notesEl.replaceChildren();
    const doc = shadow.ownerDocument;

    function appendInline(parent, value) {
      const pattern = /\\([\\`*_{}[\]()#+.!>-])|`([^`\n]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)|(\*\*|__)(.+?)\5|~~(.+?)~~|(\*|_)(.+?)\8|(https?:\/\/[^\s<]+)/g;
      let offset = 0;
      let match;
      while ((match = pattern.exec(value))) {
        const precedingText = value.slice(offset, match.index);
        const adjacentLink = (match[3] || match[10]) && parent.lastElementChild?.tagName === 'A' && !precedingText.trim();
        if (adjacentLink) parent.appendChild(doc.createElement('br'));
        else parent.appendChild(doc.createTextNode(precedingText));
        if (match[1]) {
          parent.appendChild(doc.createTextNode(match[1]));
        } else if (match[2]) {
          const code = doc.createElement('code');
          code.textContent = match[2];
          parent.appendChild(code);
        } else if (match[3]) {
          appendLink(parent, match[3], match[4]);
        } else if (match[5]) {
          const strong = doc.createElement('strong');
          appendInline(strong, match[6]);
          parent.appendChild(strong);
        } else if (match[7]) {
          const deleted = doc.createElement('del');
          appendInline(deleted, match[7]);
          parent.appendChild(deleted);
        } else if (match[8]) {
          const emphasis = doc.createElement('em');
          appendInline(emphasis, match[9]);
          parent.appendChild(emphasis);
        } else if (match[10]) {
          const punctuation = match[10].match(/[),.!?;:]+$/);
          const urlText = punctuation ? match[10].slice(0, -punctuation[0].length) : match[10];
          appendLink(parent, urlText, urlText);
          if (punctuation) parent.appendChild(doc.createTextNode(punctuation[0]));
        }
        offset = pattern.lastIndex;
      }
      parent.appendChild(doc.createTextNode(value.slice(offset)));
    }

    function appendLink(parent, label, href) {
      let url;
      try {
        url = new URL(href);
      } catch {
        parent.appendChild(doc.createTextNode(label));
        return;
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        parent.appendChild(doc.createTextNode(label));
        return;
      }
      const link = doc.createElement('a');
      link.href = url.href;
      link.textContent = label;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        native.openExternal(url.href);
      });
      parent.appendChild(link);
    }

    function isBlockStart(line) {
      return /^(?:\s*```|\s{0,3}#{1,6}\s|\s{0,3}>\s?|\s{0,3}[-*+]\s+|\s{0,3}\d+[.)]\s+)/.test(line);
    }

    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }

      const fence = line.match(/^\s*```(?:[\w+-]+)?\s*$/);
      if (fence) {
        index += 1;
        const codeLines = [];
        while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const pre = doc.createElement('pre');
        const code = doc.createElement('code');
        code.textContent = codeLines.join('\n');
        pre.appendChild(code);
        notesEl.appendChild(pre);
        continue;
      }

      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        const element = doc.createElement(`h${heading[1].length}`);
        appendInline(element, heading[2]);
        notesEl.appendChild(element);
        index += 1;
        continue;
      }

      if (/^\s{0,3}>\s?/.test(line)) {
        const quote = doc.createElement('blockquote');
        while (index < lines.length && /^\s{0,3}>\s?/.test(lines[index])) {
          if (quote.childNodes.length) quote.appendChild(doc.createElement('br'));
          appendInline(quote, lines[index].replace(/^\s{0,3}>\s?/, ''));
          index += 1;
        }
        notesEl.appendChild(quote);
        continue;
      }

      const unordered = line.match(/^\s{0,3}([-*+])\s+(.+)$/);
      const ordered = line.match(/^\s{0,3}\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        const list = doc.createElement(unordered ? 'ul' : 'ol');
        while (index < lines.length) {
          const item = lines[index].match(unordered ? /^\s{0,3}[-*+]\s+(.+)$/ : /^\s{0,3}\d+[.)]\s+(.+)$/);
          if (!item) break;
          const li = doc.createElement('li');
          appendInline(li, item[1]);
          list.appendChild(li);
          index += 1;
        }
        notesEl.appendChild(list);
        continue;
      }

      const paragraph = doc.createElement('p');
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
        if (paragraph.childNodes.length) paragraph.appendChild(doc.createElement('br'));
        appendInline(paragraph, lines[index].trim());
        index += 1;
      }
      if (!paragraph.childNodes.length) {
        appendInline(paragraph, line);
        index += 1;
      }
      notesEl.appendChild(paragraph);
    }
  }

  function showUpdateInfoError(message) {
    versionEl.textContent = 'Не удалось проверить версию';
    currentEl.textContent = '—';
    latestEl.textContent = '—';
    notesEl.textContent = message;
    notesEl.classList.add('dim');
    statusTitleEl.textContent = 'Не удалось загрузить обновление';
    statusEl.textContent = 'Проверьте подключение и повторите проверку.';
    statusEl.className = 'ud-status err';
    btnDownload.disabled = true;
  }

  function openPanel() {
    previousFocus = shadow.ownerDocument.activeElement;
    host.hidden = false;
    host.classList.add('open');
    host.setAttribute('aria-hidden', 'false');
    dialog.focus();
    if (!downloading && !downloadCard.classList.contains('state-ready')) void loadUpdateInfo();
  }

  function closePanel() {
    native.update.close();
  }

  native.update.onOpen(openPanel);
  native.update.onClose(() => {
    host.classList.remove('open');
    host.setAttribute('aria-hidden', 'true');
    host.hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus();
  });

  function formatBytes(n) { if (!Number.isFinite(Number(n)) || Number(n) <= 0) return '—'; const u=['B','KB','MB','GB']; let x=Number(n),i=0; while(x>=1024&&i<u.length-1){x/=1024;i++} return `${x.toFixed(i?1:0)} ${u[i]}`; }
  function formatSpeed(n) { return Number.isFinite(Number(n)) && Number(n)>0 ? `${formatBytes(n)}/с` : '—'; }
  function formatRemaining(received, total, speed) {
    const remaining = Number(total) - Number(received);
    const seconds = Number(speed) > 0 ? Math.ceil(remaining / Number(speed)) : 0;
    if (!Number.isFinite(seconds) || seconds <= 0 || remaining <= 0) return '';
    if (seconds < 60) return ` · ~${seconds} с`;
    const minutes = Math.ceil(seconds / 60);
    return ` · ~${minutes} мин`;
  }
  const spark = $('spark');
  const sctx = spark.getContext('2d');
  const hist = new Array(48).fill(0);
  const downloadIcon = $('download-icon');
  const idleIcon = downloadIcon.innerHTML;
  function drawSpark() {
    const W = spark.width, H = spark.height;
    sctx.clearRect(0, 0, W, H);
    const max = Math.max(...hist);
    if (max <= 0) return;
    const accent = getComputedStyle(host).getPropertyValue('--al-rgb').trim() || '165,180,252';
    const grad = sctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, `rgb(${accent})`);
    grad.addColorStop(1, `rgba(${accent},.65)`);
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
    fill.addColorStop(0, `rgba(${accent},.35)`);
    fill.addColorStop(1, `rgba(${accent},0)`);
    sctx.fillStyle = fill;
    sctx.fill();
  }
  function setProgress(pct, stage, extra={}) {
    progressEl.classList.remove('hidden');
    const known=pct !== null && pct !== undefined && Number.isFinite(Number(pct));
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
    if(speedEl) speedEl.textContent=stage==='download'?`${formatSpeed(extra.speed)}${formatRemaining(extra.received, extra.total, extra.speed)}`:'';
    if(sizeEl) sizeEl.textContent=stage==='download'?`${formatBytes(extra.received)} / ${formatBytes(extra.total)}`:'';
    if (stage === 'verify') {
      downloadControls.classList.add('hidden');
      btnLater.classList.remove('hidden');
      btnPause.disabled = true;
      btnCancel.disabled = true;
      statusTitleEl.textContent = 'Проверка файла';
      statusEl.textContent = 'Проверяю целостность скачанного файла…';
      statusEl.className = '';
    }
    if (stage === 'paused') {
      paused = true;
      downloadCard.classList.remove('state-downloading');
      downloadCard.classList.add('state-paused');
      statusTitleEl.textContent = 'Скачивание на паузе';
      statusEl.textContent = 'Нажмите «Продолжить», чтобы возобновить загрузку.';
      btnPause.textContent = 'Продолжить';
      btnPause.setAttribute('aria-pressed', 'true');
      return;
    }
    if (stage === 'download' && paused) {
      paused = false;
      downloadCard.classList.remove('state-paused');
      downloadCard.classList.add('state-downloading');
      statusTitleEl.textContent = 'Скачивание обновления';
      statusEl.textContent = 'Загрузка продолжается…';
      btnPause.textContent = 'Пауза';
      btnPause.setAttribute('aria-pressed', 'false');
    }
    if (stage === 'ready') {
      downloading = false;
      paused = false;
      statusTitleEl.textContent = 'Обновление скачано';
      statusEl.textContent = 'Файл проверен, всё готово к установке';
      downloadCard.classList.remove('state-downloading');
      downloadCard.classList.add('state-ready');
      downloadControls.classList.add('hidden');
      btnLater.classList.remove('hidden');
      statusEl.className = 'ud-status ok';
      downloadIcon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="draw" d="M8.5 12.5l2.5 2.5 4.5-5.5"/></svg>';
      btnDownload.classList.add('ready');
      btnDownload.querySelector('span').textContent = 'Установить и перезапустить';
      btnDownload.disabled = false;
    }
  }

  native.update.onProgress(({ pct, stage, received, total, speed } = {}) => {
    if (stage === 'cancelled') {
      showCancelled();
      return;
    }
    setProgress(pct, stage, {received,total,speed});
  });

  btnDownload.addEventListener('click', async () => {
    if (downloadCard.classList.contains('state-ready')) {
      btnDownload.disabled = true;
      try {
        const result = await native.update.install();
        if (!result?.ok) throw new Error(result?.error || 'Не удалось запустить установщик');
      } catch (error) {
        showActionError(String(error?.message || error));
      }
      return;
    }
    if (downloading) return;
    downloading = true;
    paused = false;
    btnDownload.disabled = true;
    btnLater.classList.add('hidden');
    downloadControls.classList.remove('hidden');
    btnPause.disabled = false;
    btnCancel.disabled = false;
    btnPause.textContent = 'Пауза';
    btnPause.setAttribute('aria-pressed', 'false');
    statusTitleEl.textContent = 'Скачивание обновления';
    statusEl.textContent = 'Загружаю новую версию, это может занять некоторое время…';
    downloadCard.classList.remove('state-error','state-ready','state-paused');
    downloadCard.classList.add('state-downloading');
    statusEl.className = 'ud-status';
    downloadIcon.innerHTML = idleIcon;
    btnDownload.classList.remove('ready');
    btnDownload.querySelector('span').textContent = 'Скачать и обновить';
    hist.fill(0);
    drawSpark();

    let res;
    try {
      res = await native.update.download();
    } catch (error) {
      showActionError(String(error?.message || error));
      return;
    }
    if (!res || !res.ok) {
      if (res?.cancelled) showCancelled();
      else showActionError('Не получилось скачать: ' + ((res && res.error) || 'неизвестная ошибка'));
    }
  });

  btnPause.addEventListener('click', () => {
    if (!downloading) return;
    native.update.setPaused(!paused);
  });

  btnCancel.addEventListener('click', () => {
    if (!downloading) return;
    btnPause.disabled = true;
    btnCancel.disabled = true;
    statusTitleEl.textContent = 'Отмена скачивания…';
    statusEl.textContent = 'Удаляю незавершённый файл.';
    native.update.cancel();
  });

  btnLater.addEventListener('click', closePanel);
  $('btn-close').addEventListener('click', closePanel);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closePanel();
  });

  shadow.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    }
  });
}
