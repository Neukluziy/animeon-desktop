function initFindInPage({ native }) {
  const findBar = document.getElementById('find-bar');
  const findInput = document.getElementById('find-input');
  const findPrevious = document.getElementById('find-prev');
  const findNext = document.getElementById('find-next');
  const findClose = document.getElementById('find-close');
  const findCount = document.getElementById('find-count');

  function openFind() {
    if (!findBar) return;
    findBar.hidden = false;
    findBar.style.display = 'flex';
    findBar.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      findInput?.focus();
      findInput?.select();
    });
  }

  function closeFind() {
    if (findBar) {
      findBar.hidden = true;
      findBar.style.display = 'none';
      findBar.setAttribute('aria-hidden', 'true');
      findCount.textContent = '';
    }
    native.stopFindInPage?.();
  }

  async function doFind(next = false) {
    const query = findInput?.value || '';
    if (!query) return;
    try {
      const result = await native.findInPage(query);
      if (result?.id) findCount.textContent = '';
    } catch (error) {
      console.warn('[AnimeOn] Could not search in the page:', error);
    }
  }

  findInput?.addEventListener('input', () => doFind(false));
  findInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      doFind(true);
    }
    if (event.key === 'Escape') closeFind();
  });
  findPrevious?.addEventListener('click', () => doFind(true));
  findNext?.addEventListener('click', () => doFind(true));
  findClose?.addEventListener('click', closeFind);
  native.onFindOpen?.(openFind);
  closeFind();
  setTimeout(closeFind, 0);

  return { closeFind, openFind };
}

export { initFindInPage };
