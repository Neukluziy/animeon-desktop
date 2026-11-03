function acceleratorFromInput(input) {
  if (!input || input.type !== 'keyDown') return '';
  const parts = [];
  if (input.control) parts.push('Control');
  if (input.alt) parts.push('Alt');
  if (input.shift) parts.push('Shift');
  if (input.meta) parts.push('Super');
  const keyMap = {
    ' ': 'Space',
    Escape: 'Esc',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    Add: '+',
    Subtract: '-',
    Multiply: '*',
    Divide: '/',
  };
  let key = keyMap[input.key] || input.key;
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) key = key.toUpperCase();
  if (key.length === 1) key = key.toUpperCase();
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return '';
  return [...parts, key].join('+');
}

function normalizeHotkeyAccelerator(value) {
  return String(value || '')
    .trim()
    .split('+')
    .map((part) => (/^command$/i.test(part.trim()) ? 'Super' : part.trim()))
    .join('+');
}

function createHotkeyManager({ globalShortcut, getBindings, getActions, onActionError = console.error }) {
  const registeredHotkeyAccelerators = new Set();

  function handleLocalHotkey(input, event) {
    const combo = acceleratorFromInput(input);
    if (!combo) return false;
    const bindings = getBindings();
    const actions = getActions();
    const normalized = combo.toLowerCase();
    for (const [key, action] of Object.entries(actions)) {
      const accelerator = normalizeHotkeyAccelerator(bindings[key]);
      if (!accelerator || accelerator.toLowerCase() !== normalized) continue;
      if (registeredHotkeyAccelerators.has(normalized)) {
        event?.preventDefault();
        return true;
      }
      try {
        action();
      } catch (error) {
        onActionError(key, error);
      }
      event?.preventDefault();
      return true;
    }
    return false;
  }

  function registerGlobalHotkeys() {
    globalShortcut.unregisterAll();
    registeredHotkeyAccelerators.clear();
    const registered = [];
    const failed = [];
    const shortcuts = [
      ['MediaPlayPause', 'MediaPlayPause', () => getActions().playPause?.()],
      ['MediaNextTrack', 'MediaNextTrack', () => getActions().next?.()],
      ['MediaPreviousTrack', 'MediaPreviousTrack', () => getActions().previous?.()],
    ];
    const actions = getActions();
    const bindings = getBindings();
    const accelerators = new Set(shortcuts.map(([, accelerator]) => accelerator.toLowerCase()));
    for (const [key, action] of Object.entries(actions)) {
      const accelerator = normalizeHotkeyAccelerator(bindings[key]);
      if (!accelerator) continue;
      const normalized = accelerator.toLowerCase();
      if (accelerators.has(normalized)) {
        failed.push({ key, accelerator, reason: 'duplicate' });
        continue;
      }
      accelerators.add(normalized);
      shortcuts.push([key, accelerator, action]);
    }
    for (const [key, accelerator, action] of shortcuts) {
      try {
        if (globalShortcut.register(accelerator, action)) {
          registered.push({ key, accelerator });
          if (actions[key]) registeredHotkeyAccelerators.add(accelerator.toLowerCase());
        } else {
          failed.push({ key, accelerator, reason: 'unavailable' });
        }
      } catch (error) {
        failed.push({ key, accelerator, reason: String(error?.message || error) });
      }
    }
    return { registered, failed, mode: 'global' };
  }

  return { handleLocalHotkey, registerGlobalHotkeys };
}

module.exports = { acceleratorFromInput, createHotkeyManager, normalizeHotkeyAccelerator };
