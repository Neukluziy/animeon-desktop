function initSettingsNavigation() {
  const discordSection = document.getElementById('discord-status-section');
  const networkSection = document.querySelector('.settings-group-card[data-settings-group="network"]');
  if (discordSection && networkSection) networkSection.after(discordSection);
  const items = () => Array.from(document.querySelectorAll('#settings-nav-list .settings-nav-item'));
  const content = document.getElementById('st-content');
  const accountsSection = document.querySelector('.settings-group-card[data-settings-group="accounts"]');
  const accessKeySection = document.querySelector('.settings-group-card[data-settings-group="accessKey"]');
  const screenshotsSection = document.querySelector('.settings-group-card[data-settings-group="screenshots"]');
  if (accountsSection && accessKeySection) accessKeySection.after(accountsSection);
  if (screenshotsSection && accountsSection) accountsSection.after(screenshotsSection);
  if (!items().length) return;
  const applyFilter = () => {
    const button = items().find((item) => item.classList.contains('active')) || items()[0];
    const filter = button.dataset.settingsFilter || 'all';
    const query = (document.getElementById('settings-search')?.value || '').trim().toLowerCase();
    document.querySelectorAll('.settings-group-card').forEach((section) => {
      const matchesFilter = filter === 'all' || !!query || section.dataset.settingsGroup === filter;
      const matchesQuery = !query || section.textContent.toLowerCase().includes(query);
      const visible = matchesFilter && matchesQuery;
      section.classList.toggle('is-hidden', !visible);
      section.classList.toggle('settings-search-match', !!query && matchesQuery);
      if (visible) section.style.removeProperty('display');
      else section.style.setProperty('display', 'none', 'important');
    });
    if (content) content.scrollTop = 0;
  };
  window.__applySettingsFilter = applyFilter;
  items().forEach((button) => button.addEventListener('click', () => {
    items().forEach((item) => item.classList.toggle('active', item === button));
    applyFilter();
  }));
  document.getElementById('settings-search')?.addEventListener('input', applyFilter);
  applyFilter();
}

export { initSettingsNavigation };
