export function initScreenshots({ native, toast }) {
  const screenshotsModal = document.getElementById('screenshots-modal');
  const screenshotsList = document.getElementById('screenshots-list');
  const screenshotsCount = document.getElementById('screenshots-count');
  let screenshotsLoadToken = 0;

  function formatScreenshotDate(mtimeMs) {
    try {
      return new Date(mtimeMs).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }
  function formatScreenshotSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n)) return '';
    const kb = n / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} КБ` : `${(kb / 1024).toFixed(1)} МБ`;
  }

  async function renderScreenshots() {
    if (!screenshotsList) return;
    const token = ++screenshotsLoadToken;
    screenshotsList.innerHTML = '';
    if (screenshotsCount) screenshotsCount.textContent = 'Загрузка…';
    const res = await native.listScreenshots?.();
    if (token !== screenshotsLoadToken) return;
    if (!res || !res.ok) {
      if (screenshotsCount) screenshotsCount.textContent = 'Не удалось получить список скриншотов';
      return;
    }
    const items = res.items || [];
    if (screenshotsCount) {
      screenshotsCount.textContent = items.length ? `Скриншотов: ${items.length}` : 'Пока нет ни одного скриншота';
    }
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'screenshots-empty';
      empty.textContent = 'Здесь появятся ваши скриншоты';
      screenshotsList.appendChild(empty);
      return;
    }
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'screenshot-card';

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'screenshot-thumb';
      const spinner = document.createElement('div');
      spinner.className = 'screenshot-thumb-loading';
      thumbWrap.appendChild(spinner);
      card.appendChild(thumbWrap);

      const meta = document.createElement('div');
      meta.className = 'screenshot-meta';
      const nameEl = document.createElement('b');
      nameEl.textContent = item.name;
      nameEl.title = item.name;
      const infoEl = document.createElement('i');
      infoEl.textContent = `${formatScreenshotDate(item.mtimeMs)} · ${formatScreenshotSize(item.size)}`;
      meta.append(nameEl, infoEl);
      card.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'screenshot-actions';
      const mkBtn = (label, cls, handler) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = cls ? `ghost-btn ${cls}` : 'ghost-btn';
        button.textContent = label;
        button.addEventListener('click', handler);
        return button;
      };
      actions.appendChild(mkBtn('Открыть', '', async () => {
        const result = await native.openScreenshot(item.path);
        if (!result?.ok) toast('Не удалось открыть скриншот', 'error');
      }));
      actions.appendChild(mkBtn('Скопировать', '', async () => {
        const result = await native.copyScreenshot(item.path);
        toast(result?.ok ? 'Скопировано в буфер' : 'Не удалось скопировать', result?.ok ? 'ok' : 'error');
      }));
      actions.appendChild(mkBtn('В папке', '', async () => {
        const result = await native.showScreenshotInFolder(item.path);
        if (!result?.ok) toast('Не удалось открыть папку', 'error');
      }));
      actions.appendChild(mkBtn('Удалить', 'danger', async () => {
        const result = await native.deleteScreenshot(item.path);
        if (result?.ok) { toast('Скриншот удалён'); renderScreenshots(); }
        else toast('Не удалось удалить', 'error');
      }));
      card.appendChild(actions);
      screenshotsList.appendChild(card);

      native.getScreenshotThumb?.(item.path).then((result) => {
        if (token !== screenshotsLoadToken || !result?.ok || !result.dataUrl) return;
        thumbWrap.innerHTML = '';
        const img = document.createElement('img');
        img.src = result.dataUrl;
        img.alt = item.name;
        thumbWrap.appendChild(img);
      }).catch(() => {});
    }
  }

  function openScreenshots() {
    screenshotsModal?.classList.add('show');
    renderScreenshots();
  }
  function closeScreenshots() {
    screenshotsModal?.classList.remove('show');
  }

  document.getElementById('btn-screenshots-main')?.addEventListener('click', openScreenshots);
  document.getElementById('btn-close-screenshots')?.addEventListener('click', closeScreenshots);
  document.getElementById('btn-screenshots-open-folder')?.addEventListener('click', () => native.openScreenshotsFolder?.());
  screenshotsModal?.addEventListener('click', (event) => {
    if (event.target === screenshotsModal) closeScreenshots();
  });
  native.onScreenshotsChanged?.(() => {
    if (screenshotsModal?.classList.contains('show')) renderScreenshots();
  });

  return { openScreenshots, closeScreenshots, renderScreenshots };
}
