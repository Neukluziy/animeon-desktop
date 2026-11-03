function initFeedback({ document: documentRef = document, requestFrame = requestAnimationFrame }) {
  const toastStack = documentRef.getElementById('toast-stack');
  const toastIcons = {
    ok: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9.3 18 20 6"/></svg>',
    error: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="0.7" fill="currentColor"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor"/></svg>',
  };
  const toastActionIcons = {
    go: '<svg viewBox="0 0 24 24"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
    retry: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg>',
  };
  const toastQueue = [];
  const activeToasts = new Set();
  const maxVisibleToasts = 4;

  function pumpToastQueue() {
    while (activeToasts.size < maxVisibleToasts && toastQueue.length) {
      const item = toastQueue.shift();
      if (item.dead) continue;
      activeToasts.add(item);
      toastStack.appendChild(item.el);
      requestFrame(() => item.el.classList.add('show'));
      item.timer = setInterval(() => {
        if (item.hover || item.dead) return;
        item.left -= 50;
        item.life.style.width = `${Math.max(0, (item.left / item.total) * 100)}%`;
        if (item.left <= 0) item.dismiss();
      }, 50);
    }
  }

  function toast(message, type = 'ok', extra = {}) {
    if (!toastStack) return () => {};
    const kind = toastIcons[type] ? type : 'ok';
    const el = documentRef.createElement('div');
    el.className = `toast ${kind}`;
    if (extra.variant === 'update') el.classList.add('toast-update');
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
    el.innerHTML = '<div class="t-icon">' + toastIcons[kind] + '</div>' +
      '<div class="t-body"><b></b>' + (extra.body ? '<span></span>' : '') + '</div>' +
      '<div class="t-side">' +
      (extra.action ? '<button class="t-action" aria-label="Действие"></button>' : '') +
      '<button class="t-close">×</button></div>' +
      '<i class="t-life"></i>';
    el.querySelector('.t-body b').textContent = message;
    if (extra.body) el.querySelector('.t-body span').textContent = extra.body;
    const life = el.querySelector('.t-life');
    const total = Number(extra.duration) > 0 ? Number(extra.duration) : 3500;
    const item = { el, total, left: total, hover: false, dead: false, timer: null, life };
    const actionButton = el.querySelector('.t-action');
    if (actionButton && extra.action) {
      actionButton.innerHTML = toastActionIcons[extra.action.icon] || '';
      actionButton.title = extra.action.title || '';
      actionButton.addEventListener('click', (event) => {
        event.stopPropagation();
        item.dismiss();
        try {
          extra.action.onClick?.();
        } catch (error) {
          console.error('[AnimeOn] Toast action failed:', error);
        }
      });
    }
    el.querySelector('.t-close').addEventListener('click', item.dismiss);
    el.addEventListener('mouseenter', () => { item.hover = true; });
    el.addEventListener('mouseleave', () => { item.hover = false; });
    item.dismiss = () => {
      if (item.dead) return;
      item.dead = true;
      clearInterval(item.timer);
      const queuedIndex = toastQueue.indexOf(item);
      if (queuedIndex >= 0) toastQueue.splice(queuedIndex, 1);
      activeToasts.delete(item);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 240);
      pumpToastQueue();
    };
    toastQueue.push(item);
    pumpToastQueue();
    return item.dismiss;
  }

  function askConfirmation(message, actionLabel = 'Продолжить') {
    const modal = documentRef.getElementById('action-confirm');
    const messageElement = documentRef.getElementById('action-confirm-message');
    const cancel = documentRef.getElementById('action-confirm-cancel');
    const accept = documentRef.getElementById('action-confirm-accept');
    if (!modal || !messageElement || !cancel || !accept) return Promise.resolve(false);
    messageElement.textContent = message;
    accept.textContent = actionLabel;
    modal.hidden = false;
    requestFrame(() => modal.classList.add('show'));
    return new Promise((resolve) => {
      const finish = (confirmed) => {
        modal.classList.remove('show');
        modal.hidden = true;
        cancel.removeEventListener('click', cancelAction);
        accept.removeEventListener('click', acceptAction);
        modal.removeEventListener('click', backdropAction);
        documentRef.removeEventListener('keydown', keyAction);
        resolve(confirmed);
      };
      const cancelAction = () => finish(false);
      const acceptAction = () => finish(true);
      const backdropAction = (event) => { if (event.target === modal) finish(false); };
      const keyAction = (event) => { if (event.key === 'Escape') finish(false); };
      cancel.addEventListener('click', cancelAction);
      accept.addEventListener('click', acceptAction);
      modal.addEventListener('click', backdropAction);
      documentRef.addEventListener('keydown', keyAction);
      cancel.focus();
    });
  }

  return { toast, askConfirmation };
}

export { initFeedback };
