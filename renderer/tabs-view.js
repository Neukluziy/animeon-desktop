export function initTabsView({ getPageTabs, getActiveTab, getActiveWebview, webview, switchTab, closeTab }) {
  const pageToolbar = document.getElementById('page-toolbar');
  const tabsBar = document.getElementById('tabs-bar');
  const tabsCount = document.getElementById('tabs-count');
  const tabsSidebarToggle = document.getElementById('btn-tabs-sidebar-toggle');

  function tabTitle(item) {
    return String(item?.title || item?.url || 'Новая страница').replace(/^AnimeOn\s*[—-]\s*/i, '').slice(0, 48);
  }

  function toggleTabsSidebar(forceOpen) {
    const open = typeof forceOpen === 'boolean' ? forceOpen : !pageToolbar?.classList.contains('is-open');
    pageToolbar?.classList.toggle('is-open', open);
    tabsSidebarToggle?.classList.toggle('is-open', open);
    tabsSidebarToggle?.setAttribute('aria-expanded', String(open));
    tabsSidebarToggle?.setAttribute('aria-label', open ? 'Закрыть список вкладок' : 'Открыть список вкладок');
    tabsSidebarToggle?.setAttribute('title', open ? 'Закрыть список вкладок' : 'Открыть список вкладок');
    tabsBar?.setAttribute('aria-hidden', String(!open));
    if (tabsBar) tabsBar.inert = !open;
  }
  tabsSidebarToggle?.addEventListener('click', () => toggleTabsSidebar());
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pageToolbar?.classList.contains('is-open')) toggleTabsSidebar(false);
  });

  function renderTabs() {
    const pageTabs = getPageTabs();
    const activeTab = getActiveTab();
    if (!tabsBar) return;
    tabsBar.innerHTML = '';
    if (tabsCount) tabsCount.textContent = String(pageTabs.length);
    pageTabs.forEach((tab, index) => {
      const button = document.createElement('button');
      button.className = 'tab-item' + (index === activeTab ? ' active' : '');
      button.title = tabTitle(tab);
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(index === activeTab));
      button.setAttribute('aria-label', `${tabTitle(tab)}${index === activeTab ? ' — активная вкладка' : ''}`);
      const icon = document.createElement('span');
      icon.className = 'tab-item-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5.5 4.5h8l5 5v10h-13z"/><path d="M13.5 4.5v5h5M8.5 13h7M8.5 16h5"/></svg>';
      const copy = document.createElement('span');
      copy.className = 'tab-item-copy';
      const title = document.createElement('strong');
      title.className = 'tab-item-title';
      title.textContent = tabTitle(tab);
      const address = document.createElement('small');
      address.className = 'tab-item-address';
      try { address.textContent = new URL(tab.url).hostname.replace(/^www\./i, ''); } catch { address.textContent = 'Новая страница'; }
      copy.append(title, address);
      const close = document.createElement('span');
      close.className = 'tab-close';
      close.setAttribute('role', 'button');
      close.setAttribute('tabindex', '0');
      close.setAttribute('aria-label', 'Закрыть вкладку');
      close.textContent = '×';
      const closeTabFromCard = (event) => {
        event.stopPropagation();
        closeTab(index);
      };
      close.addEventListener('click', closeTabFromCard);
      close.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); closeTabFromCard(event); }
      });
      button.append(icon, copy, close);
      button.addEventListener('click', (event) => {
        if (event.target.closest('.tab-close')) return;
        if (index === getActiveTab()) {
          try { getActiveWebview().focus(); } catch {}
          try { webview.reload(); } catch {}
          return;
        }
        switchTab(index);
      });
      button.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === button) {
          event.preventDefault();
          switchTab(index);
        }
      });
      button.style.pointerEvents = 'auto';
      button.style.cursor = 'pointer';
      tabsBar.appendChild(button);
    });
  }

  return { tabTitle, toggleTabsSidebar, renderTabs };
}
