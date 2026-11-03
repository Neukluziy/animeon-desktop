function createCustomSelectManager({ document: documentRef = document, window: windowRef = window }) {
  const refreshers = new WeakMap();

  function closeOpenCSelects(except = null) {
    documentRef.querySelectorAll('.cselect.open').forEach((root) => {
      if (root === except) return;
      root.classList.remove('open', 'opens-up');
      const list = root._cselectList || root.querySelector('.cselect-list');
      const button = root.querySelector('.cselect-btn');
      if (list) {
        list.hidden = true;
        button?.after(list);
      }
      button?.setAttribute('aria-expanded', 'false');
      root.closest('.settings-group-card')?.classList.remove('has-open-select');
    });
  }

  function positionCSelect(root, list, button) {
    const bounds = button.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 10;
    const below = windowRef.innerHeight - bounds.bottom - gap - viewportPadding;
    const above = bounds.top - gap - viewportPadding;
    const openAbove = below < Math.min(list.scrollHeight, 220) && above > below;
    const available = Math.max(80, Math.min(300, openAbove ? above : below));
    const height = Math.min(list.scrollHeight, available);
    const left = Math.max(viewportPadding, Math.min(bounds.left, windowRef.innerWidth - bounds.width - viewportPadding));
    root.classList.toggle('opens-up', openAbove);
    list.classList.toggle('opens-up', openAbove);
    list.style.position = 'fixed';
    list.style.left = `${Math.round(left)}px`;
    list.style.width = `${Math.round(bounds.width)}px`;
    list.style.maxHeight = `${Math.floor(available)}px`;
    list.style.overflowY = list.scrollHeight > available ? 'auto' : 'visible';
    list.style.top = openAbove
      ? `${Math.max(viewportPadding, Math.round(bounds.top - height - gap))}px`
      : `${Math.round(bounds.bottom + gap)}px`;
    list.style.bottom = 'auto';
  }

  function setCSelectOpen(root, open) {
    const button = root.querySelector('.cselect-btn');
    const list = root._cselectList || root.querySelector('.cselect-list');
    if (!button || !list || (open && button.disabled)) return;
    if (open) {
      closeOpenCSelects(root);
      root._cselectList = list;
      documentRef.body.append(list);
    } else {
      button.after(list);
    }
    root.classList.toggle('open', open);
    root.closest('.settings-group-card')?.classList.toggle('has-open-select', open);
    button.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    if (open) positionCSelect(root, list, button);
    else root.classList.remove('opens-up');
  }

  function enhanceNativeSelect(select) {
    if (!select || select.dataset.customized === 'true') return;
    const root = documentRef.createElement('div');
    root.className = 'cselect native-cselect';
    root.dataset.value = select.value;
    root.dataset.customized = 'true';
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'cselect-btn';
    button.id = `${select.id}-trigger`;
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const label = documentRef.createElement('span');
    label.className = 'cselect-label';
    const chevron = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('aria-hidden', 'true');
    const chevronPath = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'M6 9l6 6 6-6');
    chevron.append(chevronPath);
    button.append(label, chevron);
    const list = documentRef.createElement('div');
    list.className = 'cselect-list';
    list.id = `${select.id}-options`;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    button.setAttribute('aria-controls', list.id);
    root._cselectList = list;
    select.before(root);
    root.append(button, list, select);
    select.hidden = true;
    select.dataset.customized = 'true';
    select.labels?.forEach((associatedLabel) => {
      if (associatedLabel.htmlFor === select.id) associatedLabel.htmlFor = button.id;
    });

    function refresh() {
      root.dataset.value = select.value;
      root.classList.toggle('disabled', select.disabled);
      button.disabled = select.disabled;
      const selectedOption = select.selectedOptions[0];
      label.textContent = selectedOption?.textContent?.trim() || '';
      label.classList.toggle('dim', !select.value);
      list.replaceChildren();
      for (const option of select.options) {
        const item = documentRef.createElement('button');
        item.type = 'button';
        item.dataset.value = option.value;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.selected));
        item.setAttribute('aria-disabled', String(option.disabled));
        item.disabled = option.disabled;
        item.className = option.selected ? 'sel' : '';
        const dot = documentRef.createElement('span');
        dot.className = 'cselect-dot';
        dot.setAttribute('aria-hidden', 'true');
        const text = documentRef.createElement('span');
        text.className = 'cselect-t';
        const bold = documentRef.createElement('b');
        bold.textContent = option.textContent.trim();
        text.append(bold);
        const check = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
        check.classList.add('cselect-check');
        check.setAttribute('viewBox', '0 0 24 24');
        check.setAttribute('aria-hidden', 'true');
        const checkPath = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
        checkPath.setAttribute('d', 'M5 13l4 4 10-11');
        check.append(checkPath);
        item.append(dot, text, check);
        list.append(item);
      }
    }

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setCSelectOpen(root, !root.classList.contains('open'));
    });
    list.addEventListener('click', (event) => {
      const item = event.target.closest('button[data-value]');
      if (!item || item.disabled) return;
      select.value = item.dataset.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      refresh();
      setCSelectOpen(root, false);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setCSelectOpen(root, false);
      } else if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setCSelectOpen(root, true);
        const options = [...list.querySelectorAll('button:not(:disabled)')];
        const selected = options.find((option) => option.getAttribute('aria-selected') === 'true');
        const next = event.key === 'ArrowUp' ? options.at(-1) : selected || options[0];
        next?.focus();
      }
    });
    list.addEventListener('keydown', (event) => {
      const options = [...list.querySelectorAll('button:not(:disabled)')];
      const current = options.indexOf(event.target.closest('button'));
      if (event.key === 'Escape') {
        event.preventDefault();
        setCSelectOpen(root, false);
        button.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        options[(current + step + options.length) % options.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.closest('button')?.click();
      }
    });
    documentRef.addEventListener('click', (event) => {
      if (!root.contains(event.target)) setCSelectOpen(root, false);
    });
    documentRef.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && root.classList.contains('open')) {
        setCSelectOpen(root, false);
        button.focus();
      }
    });
    documentRef.addEventListener('scroll', (event) => {
      if (root.classList.contains('open') && !list.contains(event.target)) setCSelectOpen(root, false);
    }, true);
    windowRef.addEventListener('resize', () => {
      if (root.classList.contains('open')) setCSelectOpen(root, false);
    });
    select.addEventListener('change', refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'label'] });
    refreshers.set(select, refresh);
    refresh();
    return refresh;
  }

  function syncCustomSelect(select) {
    refreshers.get(select)?.();
  }

  function initCSelect(id, onChange) {
    const root = documentRef.getElementById(id);
    if (!root) return null;
    const button = root.querySelector('.cselect-btn');
    const label = button.querySelector('.cselect-label');
    const list = root.querySelector('.cselect-list');
    function pick(value) {
      root.dataset.value = value;
      list.querySelectorAll('button[data-value]').forEach((option) => {
        const selected = option.dataset.value === value;
        option.classList.toggle('sel', selected);
        option.setAttribute('aria-selected', String(selected));
      });
      const current = list.querySelector(`button[data-value="${CSS.escape(value)}"] .cselect-t b`)
        || list.querySelector(`button[data-value="${CSS.escape(value)}"]`);
      if (current) {
        label.textContent = current.textContent.trim();
        label.classList.remove('dim');
      }
      if (onChange) onChange(value);
    }
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setCSelectOpen(root, !root.classList.contains('open'));
    });
    list.addEventListener('click', (event) => {
      const option = event.target.closest('button[data-value]');
      if (!option) return;
      pick(option.dataset.value);
      setCSelectOpen(root, false);
    });
    list.querySelectorAll('button[data-value]').forEach((option) => {
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(option.classList.contains('sel')));
    });
    return { pick, root, get value() { return root.dataset.value; } };
  }

  function initialize() {
    documentRef.addEventListener('click', (event) => {
      if (!event.target.closest('.cselect') && !event.target.closest('.cselect-list')) closeOpenCSelects();
    });
    documentRef.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeOpenCSelects();
    });
    documentRef.addEventListener('scroll', (event) => {
      const openRoot = documentRef.querySelector('.cselect.open');
      if (!openRoot?._cselectList?.contains(event.target)) closeOpenCSelects();
    }, true);
    windowRef.addEventListener('resize', closeOpenCSelects);
  }

  return { closeOpenCSelects, enhanceNativeSelect, initCSelect, initialize, syncCustomSelect };
}

export { createCustomSelectManager };
