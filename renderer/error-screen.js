function initErrorScreen({ native, appInfo, webview, toast, openSettings, switchMirror, diagnosticsOutput }) {
  const errorScreen = document.getElementById('error-screen');
  const errorMessage = document.getElementById('error-message');
  const offlineScreen = document.getElementById('offline-screen');
  const retryButton = document.getElementById('btn-error-retry');
  const mirrorButton = document.getElementById('btn-error-mirror');
  const diagnosticsButton = document.getElementById('btn-error-diagnostics');
  const copyButton = document.getElementById('btn-error-copy-report');
  const offlineRetry = document.getElementById('offline-retry');

  function showError(message) {
    if (errorMessage) errorMessage.textContent = message || 'Не получилось открыть AnimeOn.';
    errorScreen?.classList.add('show');
    document.body.classList.add('error-visible', 'offline-visible');
    offlineScreen?.classList.add('show');
    native.taskbarOverlay?.('error');
  }

  function hideError() {
    errorScreen?.classList.remove('show');
    offlineScreen?.classList.remove('show');
    document.body.classList.remove('error-visible', 'offline-visible');
    native.taskbarOverlay?.('none');
  }

  async function buildErrorReport() {
    const [diagnostics, connection] = await Promise.all([
      native.diagnostics(),
      native.connectionCheck(),
    ]);
    return [
      `AnimeOn v${diagnostics?.version || appInfo.version || '—'}`,
      `Electron ${diagnostics?.electron || '—'} · Chromium ${diagnostics?.chrome || '—'}`,
      `Windows ${diagnostics?.platform || '—'} · ${diagnostics?.arch || '—'}`,
      `Память: ${diagnostics?.memoryMB ?? '—'} MB · GPU: ${diagnostics?.gpu?.gpu_compositing || 'unknown'}`,
      `Интернет: ${connection?.internet ? 'доступен' : 'нет соединения'}`,
      ...(connection?.results || []).map((result) => {
        let host = result.url;
        try {
          host = new URL(result.url).hostname;
        } catch { void 0; }
        return `${host}: ${result.ok ? 'доступен' : 'не отвечает'}${result.status ? ` · HTTP ${result.status}` : ''}${result.ms ? ` · ${result.ms} мс` : ''}`;
      }),
    ].join('\n');
  }

  retryButton?.addEventListener('click', () => {
    hideError();
    webview.reload();
  });
  mirrorButton?.addEventListener('click', () => {
    hideError();
    switchMirror();
  });
  offlineRetry?.addEventListener('click', () => {
    hideError();
    webview.reload();
  });
  diagnosticsButton?.addEventListener('click', async () => {
    try {
      const report = await buildErrorReport();
      openSettings();
      document.querySelector('#settings-nav-list [data-settings-filter="advanced"]')?.click();
      if (diagnosticsOutput) diagnosticsOutput.textContent = report;
    } catch (error) {
      toast(`Не удалось выполнить диагностику: ${String(error?.message || error)}`, 'error');
    }
  });
  copyButton?.addEventListener('click', async () => {
    try {
      const report = await buildErrorReport();
      const result = await native.copyText(report);
      if (!result?.ok) throw new Error(result?.error || 'Не удалось скопировать отчёт');
      toast('Отчёт диагностики скопирован');
    } catch (error) {
      toast(`Не удалось скопировать отчёт: ${String(error?.message || error)}`, 'error');
    }
  });

  return { hideError, showError };
}

export { initErrorScreen };
