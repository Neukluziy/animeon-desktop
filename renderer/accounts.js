export function initAccounts({ native, cfg, toast, askConfirmation }) {
  const openButton = document.getElementById('btn-accounts');
  const settingsOpenButton = document.getElementById('btn-accounts-settings');
  const label = document.getElementById('active-account-label');
  const modal = document.getElementById('accounts-modal');
  const closeButton = document.getElementById('btn-close-accounts');
  const list = document.getElementById('accounts-list');
  const nameInput = document.getElementById('account-name-input');
  const addButton = document.getElementById('btn-account-add');
  let accounts = [];

  function close() {
    modal?.classList.remove('show');
    modal?.setAttribute('aria-hidden', 'true');
  }

  async function reloadAccounts() {
    const result = await native.listAccounts();
    if (!result?.ok || !Array.isArray(result.accounts)) {
      throw new Error(result?.error || 'Не удалось загрузить список аккаунтов');
    }
    accounts = result.accounts;
    cfg.activeAccountId = result.activeAccountId;
    const active = accounts.find((item) => item.id === cfg.activeAccountId);
    if (label) label.textContent = active?.name || 'Аккаунт';
    openButton?.setAttribute('aria-label', `Аккаунты, текущий: ${active?.name || 'не выбран'}`);
    if (openButton) openButton.title = `Аккаунты · ${active?.name || 'не выбран'}`;
    render();
  }

  function render() {
    if (!list) return;
    list.replaceChildren();
    for (const account of accounts) {
      const active = account.id === cfg.activeAccountId;
      const row = document.createElement('div');
      row.className = `account-row${active ? ' active' : ''}`;

      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'account-select';
      select.disabled = active;
      const name = document.createElement('strong');
      name.textContent = account.name;
      const state = document.createElement('small');
      state.textContent = active ? 'Используется сейчас' : 'Сессия сохранена';
      const marker = document.createElement('span');
      marker.className = 'account-marker';
      marker.textContent = active ? '✓' : '↪';
      select.append(name, state, marker);
      select.addEventListener('click', async () => {
        try {
          const result = await native.activateAccount(account.id);
          if (!result?.ok) throw new Error(result?.error || 'Не удалось переключить аккаунт');
          window.location.reload();
        } catch (error) {
          toast(error?.message || 'Не удалось переключить аккаунт', 'error');
        }
      });
      row.appendChild(select);

      if (!active && accounts.length > 1) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'account-remove';
        remove.title = 'Удалить аккаунт и его сохранённую сессию';
        remove.setAttribute('aria-label', `Удалить аккаунт ${account.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', async () => {
          if (!await askConfirmation(`Удалить «${account.name}» и очистить его сохранённую сессию?`, 'Удалить')) return;
          try {
            const result = await native.deleteAccount(account.id);
            if (!result?.ok) throw new Error(result?.error || 'Не удалось удалить аккаунт');
            await reloadAccounts();
            toast('Аккаунт удалён');
          } catch (error) {
            toast(error?.message || 'Не удалось удалить аккаунт', 'error');
          }
        });
        row.appendChild(remove);
      }
      list.appendChild(row);
    }
  }

  const open = async () => {
    modal?.classList.add('show');
    modal?.setAttribute('aria-hidden', 'false');
    try {
      await reloadAccounts();
      nameInput?.focus();
    } catch (error) {
      toast(error?.message || 'Не удалось загрузить аккаунты', 'error');
    }
  };
  openButton?.addEventListener('click', open);
  settingsOpenButton?.addEventListener('click', open);
  closeButton?.addEventListener('click', close);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addButton?.click();
  });
  addButton?.addEventListener('click', async () => {
    const name = String(nameInput?.value || '').trim();
    if (!name) {
      toast('Укажи название аккаунта', 'error');
      nameInput?.focus();
      return;
    }
    addButton.disabled = true;
    try {
      const result = await native.addAccount(name);
      if (!result?.ok) throw new Error(result?.error || 'Не удалось добавить аккаунт');
      window.location.reload();
    } catch (error) {
      toast(error?.message || 'Не удалось добавить аккаунт', 'error');
    } finally {
      addButton.disabled = false;
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('show')) close();
  });

  reloadAccounts().catch((error) => console.error('[AnimeOn] accounts init failed', error));
  return { reloadAccounts };
}
