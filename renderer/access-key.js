export function initAccessKeyFeature({ native, cfg, toast, askConfirmation, isFirstLaunch, isRememberedSite, reloadWebviews }) {  const accessKeyLayer = document.getElementById('access-key-layer');
  const accessKeyPrompt = document.getElementById('access-key-prompt');
  const accessKeyForm = document.getElementById('access-key-form');
  const accessKeyConfirmForm = document.getElementById('access-key-confirm-form');
  const accessKeyPromptSuppress = document.getElementById('access-key-suppress-prompt');
  const accessKeySettingsStatus = document.getElementById('access-key-settings-status');
  const accessKeyPromptToggle = document.getElementById('access-key-prompt-toggle');
  const accessKeySettingsCreate = document.getElementById('btn-access-key-settings-create');
  const accessKeySettingsRemove = document.getElementById('btn-access-key-settings-remove');
  const accessKeySecret = document.getElementById('access-key-secret');
  const accessKeyConfirm = document.getElementById('access-key-confirm');
  const accessKeyError = document.getElementById('access-key-error');
  const accessKeyConfirmError = document.getElementById('access-key-confirm-error');
  const accessKeyCodeFields = document.getElementById('access-key-code-fields');
  const accessKeyPatternFields = document.getElementById('access-key-pattern-fields');
  const accessKeyConfirmCodeFields = document.getElementById('access-key-confirm-code-fields');
  const accessKeyConfirmPatternFields = document.getElementById('access-key-confirm-pattern-fields');
  const accessKeyMethods = document.getElementById('access-key-methods');
  const accessKeyFormTitle = document.getElementById('access-key-form-title');
  const accessKeyFormHint = document.getElementById('access-key-form-hint');
  const accessKeySubmit = document.getElementById('btn-access-key-submit');
  const accessKeyCancel = document.getElementById('btn-access-key-cancel');
  const accessKeyConfirmBack = document.getElementById('btn-access-key-confirm-back');
  const accessKeyConfirmSubmit = document.getElementById('btn-access-key-confirm-submit');
  const accessKeyConfirmTitle = document.getElementById('access-key-confirm-title');
  const accessKeyConfirmHint = document.getElementById('access-key-confirm-hint');
  let currentAccessKeyProof = '';
  let accessKeyInfo = { enabled: cfg.accessKeyEnabled === true, type: null, promptDismissed: cfg.accessKeyPromptDismissed === true, recoveredMissingKey: false };
  let accessKeyFlow = 'prompt';
  let accessKeyFormMode = 'setup';
  let accessKeyStartupError = '';
  let accessKeyGateReleased = false;
  let releaseAccessKeyGate;
  const accessKeyGate = new Promise((resolve) => { releaseAccessKeyGate = resolve; });
  const accessKeyStatusPromise = native.getAccessKeyStatus();
  function releaseSecurityGate() {
    if (accessKeyGateReleased) return;
    accessKeyGateReleased = true;
    releaseAccessKeyGate();
    if (accessKeyInfo.recoveredMissingKey) {
      accessKeyInfo.recoveredMissingKey = false;
      toast('Файл ключа удалён — cookies аккаунтов очищены', 'warning');
    }
  }
  function showAccessKeyPanel(panel, flow = 'prompt') {
  accessKeyFlow = flow;
  accessKeyPrompt.hidden = panel !== accessKeyPrompt;
  accessKeyForm.hidden = panel !== accessKeyForm;
  accessKeyConfirmForm.hidden = panel !== accessKeyConfirmForm;
  accessKeyLayer.classList.add('show');
  accessKeyLayer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('access-key-visible');
  accessKeyError.textContent = accessKeyStartupError;
}

function closeAccessKeyPanel() {
  accessKeyLayer.classList.remove('show');
  accessKeyLayer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('access-key-visible');
  accessKeyPrompt.hidden = true;
  accessKeyForm.hidden = true;
  accessKeyConfirmForm.hidden = true;
  accessKeySecret.value = '';
  accessKeyConfirm.value = '';
  pendingAccessKey = '';
  currentAccessKeyProof = '';
  accessKeyPatterns.secret = [];
  accessKeyPatterns.confirm = [];
  activePatternPad = null;
  document.querySelectorAll('.access-key-pattern-pad').forEach(renderAccessPattern);
}

function showAccessKeyPrompt(flow = 'prompt') {
  accessKeyPromptSuppress.checked = false;
  showAccessKeyPanel(accessKeyPrompt, flow);
  document.getElementById('btn-access-key-add')?.focus();
}

const accessKeyPatterns = { secret: [], confirm: [] };
let pendingAccessKey = '';
let activePatternPad = null;
function renderAccessPattern(pad) {
  const key = pad.dataset.patternPad;
  const points = accessKeyPatterns[key] || [];
  pad.querySelectorAll('[data-pattern-dot]').forEach((dot) => {
    dot.classList.toggle('is-selected', points.includes(Number(dot.dataset.patternDot)));
  });
  const coordinates = points.map((point) => {
    const index = point - 1;
    return `${(index % 3) * 33.333 + 16.667},${Math.floor(index / 3) * 33.333 + 16.667}`;
  });
  const line = pad.querySelector('polyline');
  line.classList.remove('is-drawing');
  line.setAttribute('points', coordinates.join(' '));
  if (coordinates.length > 1) {
    line.getBoundingClientRect();
    line.classList.add('is-drawing');
  }
}
function addAccessPatternPoint(pad, point) {
  const points = accessKeyPatterns[pad.dataset.patternPad];
  if (points.length < 9 && !points.includes(point)) points.push(point);
  renderAccessPattern(pad);
}
function getAccessPatternPoint(pad, event) {
  const rect = pad.getBoundingClientRect();
  const cellWidth = rect.width / 3;
  const cellHeight = rect.height / 3;
  const column = Math.max(0, Math.min(2, Math.round((event.clientX - rect.left) / cellWidth - .5)));
  const row = Math.max(0, Math.min(2, Math.round((event.clientY - rect.top) / cellHeight - .5)));
  const centerX = rect.left + (column + .5) * cellWidth;
  const centerY = rect.top + (row + .5) * cellHeight;
  if (Math.hypot(event.clientX - centerX, event.clientY - centerY) > Math.min(cellWidth, cellHeight) * .48) return null;
  return row * 3 + column + 1;
}
document.querySelectorAll('.access-key-pattern-pad').forEach((pad) => {
  pad.addEventListener('pointerdown', (event) => {
    const point = getAccessPatternPoint(pad, event);
    if (!point) return;
    event.preventDefault();
    activePatternPad = pad;
    pad.setPointerCapture(event.pointerId);
    pad.classList.add('is-drawing');
    addAccessPatternPoint(pad, point);
  });
  pad.addEventListener('pointermove', (event) => {
    if (activePatternPad !== pad) return;
    const point = getAccessPatternPoint(pad, event);
    if (point) addAccessPatternPoint(pad, point);
  });
  pad.addEventListener('pointerup', () => { if (activePatternPad === pad) { activePatternPad = null; pad.classList.remove('is-drawing'); } });
  pad.addEventListener('pointercancel', () => { if (activePatternPad === pad) { activePatternPad = null; pad.classList.remove('is-drawing'); } });
  pad.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const dot = event.target.closest('[data-pattern-dot]');
    if (!dot) return;
    event.preventDefault();
    addAccessPatternPoint(pad, Number(dot.dataset.patternDot));
  });
});
document.querySelectorAll('[data-pattern-clear]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.patternClear;
    accessKeyPatterns[key] = [];
    renderAccessPattern(document.querySelector(`[data-pattern-pad="${key}"]`));
  });
});
document.querySelectorAll('.access-key-keypad').forEach((keypad) => {
  keypad.addEventListener('click', (event) => {
    const button = event.target.closest('[data-keypad-key]');
    if (!button) return;
    const input = keypad.closest('.access-key-code-fields')?.querySelector('input');
    if (!input) return;
    const key = button.dataset.keypadKey;
    input.value = key === 'backspace' ? input.value.slice(0, -1) : `${input.value}${key}`.slice(0, 6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
});

function selectedAccessKeyMethod() {
  return document.querySelector('input[name="access-key-method"]:checked')?.value || 'code';
}

function updateAccessKeyMethod() {
  const type = selectedAccessKeyMethod();
  const isPattern = type === 'pattern';
  accessKeyCodeFields.hidden = isPattern;
  accessKeyPatternFields.hidden = !isPattern;
}
document.querySelectorAll('input[name="access-key-method"]').forEach((input) => input.addEventListener('change', updateAccessKeyMethod));

function showAccessKeyForm(mode = 'setup', flow = 'settings') {
  accessKeyFormMode = mode;
  pendingAccessKey = '';
  const isUnlock = mode === 'unlock';
  const type = isUnlock ? accessKeyInfo.type || 'code' : 'code';
  document.querySelectorAll('input[name="access-key-method"]').forEach((input) => {
    input.checked = input.value === type;
  });
  accessKeyMethods.hidden = isUnlock;
  accessKeyCancel.hidden = isUnlock;
  accessKeySecret.value = '';
  accessKeyConfirm.value = '';
  accessKeyPatterns.secret = [];
  accessKeyPatterns.confirm = [];
  document.querySelectorAll('.access-key-pattern-pad').forEach(renderAccessPattern);
  accessKeyFormTitle.textContent = isUnlock
    ? flow === 'settings-change' ? 'Подтверди текущий ключ' : flow === 'settings-remove' ? 'Подтверди удаление ключа' : 'Разблокировать AnimeOn'
    : accessKeyInfo.enabled ? 'Изменить ключ доступа' : 'Создать ключ доступа';
  accessKeyFormHint.textContent = isUnlock
    ? flow === 'settings-change'
      ? (type === 'pattern' ? 'Нарисуй установленный графический ключ, чтобы задать новый.' : 'Введи установленный код, чтобы задать новый.')
      : flow === 'settings-remove'
        ? (type === 'pattern' ? 'Нарисуй установленный графический ключ, чтобы удалить его.' : 'Введи установленный код, чтобы удалить его.')
        : (type === 'pattern' ? 'Нарисуй свой графический ключ для продолжения.' : 'Введи 6-значный код для продолжения.')
    : type === 'pattern' ? 'Проведи по четырём или более точкам, чтобы задать ключ.' : 'Задай код из шести цифр. На следующем экране его нужно будет подтвердить.';
  accessKeySubmit.textContent = isUnlock ? flow.startsWith('settings-') ? 'Продолжить' : 'Разблокировать' : 'Далее';
  updateAccessKeyMethod();
  showAccessKeyPanel(accessKeyForm, flow);
  requestAnimationFrame(() => (type === 'pattern' ? document.querySelector('[data-pattern-pad="secret"]') : accessKeySecret)?.focus());
}

function showAccessKeyConfirmation(type, error = '') {
  accessKeyConfirm.value = '';
  accessKeyPatterns.confirm = [];
  document.querySelectorAll('[data-pattern-pad="confirm"]').forEach(renderAccessPattern);
  accessKeyConfirmCodeFields.hidden = type !== 'code';
  accessKeyConfirmPatternFields.hidden = type !== 'pattern';
  accessKeyConfirmTitle.textContent = 'Подтверди ключ';
  accessKeyConfirmHint.textContent = type === 'pattern'
    ? 'Нарисуй тот же графический ключ ещё раз.'
    : 'Введи тот же шестизначный код ещё раз.';
  accessKeyConfirmError.textContent = error;
  accessKeySubmit.disabled = false;
  showAccessKeyPanel(accessKeyConfirmForm, accessKeyFlow);
  requestAnimationFrame(() => (type === 'pattern' ? document.querySelector('[data-pattern-pad="confirm"]') : accessKeyConfirm)?.focus());
}

async function persistPromptPreference(dismissed) {
  const result = await native.setAccessKeyPromptDismissed(dismissed);
  if (!result?.ok) throw new Error(result?.error || 'Не удалось сохранить настройку');
  accessKeyInfo.promptDismissed = dismissed;
  cfg.accessKeyPromptDismissed = dismissed;
  accessKeyPromptToggle.checked = !dismissed;
}

async function refreshAccessKeySettings() {
  accessKeySettingsStatus.textContent = accessKeyInfo.enabled
    ? `Ключ доступа установлен · ${accessKeyInfo.type === 'pattern' ? 'графический ключ' : accessKeyInfo.type === 'code' ? '6-значный код' : 'файл ключа недоступен'}`
    : 'Ключ доступа не установлен';
  accessKeySettingsCreate.textContent = accessKeyInfo.enabled ? 'Изменить ключ' : 'Создать ключ';
  accessKeySettingsRemove.hidden = !accessKeyInfo.enabled;
  accessKeyPromptToggle.checked = !accessKeyInfo.promptDismissed;
}

document.getElementById('btn-access-key-add')?.addEventListener('click', () => showAccessKeyForm('setup', 'prompt'));
document.getElementById('btn-access-key-skip')?.addEventListener('click', async () => {
  try {
    if (accessKeyPromptSuppress.checked) await persistPromptPreference(true);
    closeAccessKeyPanel();
    releaseSecurityGate();
  } catch (error) {
    toast(String(error?.message || error), 'error');
  }
});
document.getElementById('btn-access-key-cancel')?.addEventListener('click', () => {
  if (accessKeyFormMode === 'unlock') return;
  if (accessKeyFlow === 'prompt') showAccessKeyPrompt('prompt');
  else closeAccessKeyPanel();
});
accessKeySettingsCreate?.addEventListener('click', () => {
  if (accessKeyInfo.enabled) showAccessKeyForm('unlock', 'settings-change');
  else showAccessKeyForm('setup', 'settings');
});
accessKeySettingsRemove?.addEventListener('click', async () => {
  if (!await askConfirmation('Удалить ключ доступа? После этого приложение больше не будет запрашивать его при запуске.', 'Удалить ключ')) return;
  showAccessKeyForm('unlock', 'settings-remove');
});
accessKeyPromptToggle?.addEventListener('change', async () => {
  try {
    await persistPromptPreference(!accessKeyPromptToggle.checked);
    toast(accessKeyPromptToggle.checked ? 'Предложение будет показываться при запуске' : 'Предложение отключено');
  } catch (error) {
    accessKeyPromptToggle.checked = !accessKeyPromptToggle.checked;
    toast(String(error?.message || error), 'error');
  }
});
accessKeySecret?.addEventListener('input', () => {
  accessKeySecret.value = accessKeySecret.value.replace(/\D/g, '').slice(0, 6);
});
accessKeyConfirm?.addEventListener('input', () => {
  accessKeyConfirm.value = accessKeyConfirm.value.replace(/\D/g, '').slice(0, 6);
});
accessKeySecret?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') accessKeySubmit.click();
});
accessKeyConfirm?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') accessKeyConfirmSubmit.click();
});
accessKeySubmit?.addEventListener('click', async () => {
  const mode = accessKeyFormMode;
  const type = mode === 'unlock' ? accessKeyInfo.type : selectedAccessKeyMethod();
  const secret = type === 'pattern' ? accessKeyPatterns.secret.join(',') : accessKeySecret.value;
  if (mode === 'setup') {
    const isValid = type === 'code' ? /^\d{6}$/.test(secret) : /^[1-9](?:,[1-9]){3,8}$/.test(secret);
    if (!isValid) {
      accessKeyError.textContent = type === 'pattern' ? 'Графический ключ должен содержать от 4 до 9 разных точек.' : 'Введи все 6 цифр кода.';
      return;
    }
    pendingAccessKey = secret;
    accessKeyError.textContent = '';
    showAccessKeyConfirmation(type);
    return;
  }
  accessKeySubmit.disabled = true;
  accessKeyError.textContent = '';
  try {
    const result = await native.verifyAccessKey(secret);
    if (!result?.ok) {
      accessKeyError.textContent = result?.error || 'Не удалось проверить ключ доступа';
      if (result?.missing) {
        accessKeyInfo.enabled = false;
        accessKeyInfo.type = null;
        refreshAccessKeySettings();
      }
      return;
    }
    if (accessKeyFlow === 'settings-change') {
      currentAccessKeyProof = secret;
      showAccessKeyForm('setup', 'settings-change');
      return;
    }
    if (accessKeyFlow === 'settings-remove') {
      const removed = await native.removeAccessKey(secret);
      if (!removed?.ok) {
        accessKeyError.textContent = removed?.error || 'Не удалось удалить ключ доступа';
        return;
      }
      accessKeyInfo.enabled = false;
      accessKeyInfo.type = null;
      cfg.accessKeyEnabled = false;
      refreshAccessKeySettings();
      closeAccessKeyPanel();
      toast('Ключ доступа удалён');
      return;
    }
    closeAccessKeyPanel();
    releaseSecurityGate();
  } catch (error) {
    accessKeyError.textContent = String(error?.message || error);
  } finally {
    accessKeySubmit.disabled = false;
  }
});
accessKeyConfirmBack?.addEventListener('click', () => {
  if (accessKeyFormMode !== 'setup') return;
  const type = selectedAccessKeyMethod();
  accessKeyError.textContent = '';
  if (type === 'pattern') accessKeyPatterns.secret = pendingAccessKey.split(',').map(Number);
  else accessKeySecret.value = pendingAccessKey;
  renderAccessPattern(document.querySelector('[data-pattern-pad="secret"]'));
  showAccessKeyPanel(accessKeyForm, accessKeyFlow);
  requestAnimationFrame(() => (type === 'pattern' ? document.querySelector('[data-pattern-pad="secret"]') : accessKeySecret)?.focus());
});
accessKeyConfirmSubmit?.addEventListener('click', async () => {
  const type = selectedAccessKeyMethod();
  const confirmation = type === 'pattern' ? accessKeyPatterns.confirm.join(',') : accessKeyConfirm.value;
  if (!confirmation || confirmation !== pendingAccessKey) {
    accessKeyConfirmError.textContent = type === 'pattern' ? 'Ключ не совпал. Попробуй нарисовать его ещё раз.' : 'Код не совпал. Проверь цифры и попробуй ещё раз.';
    accessKeyConfirm.value = '';
    accessKeyPatterns.confirm = [];
    document.querySelectorAll('[data-pattern-pad="confirm"]').forEach(renderAccessPattern);
    return;
  }
  accessKeyConfirmSubmit.disabled = true;
  accessKeyConfirmError.textContent = '';
  try {
    const result = await native.setAccessKey(type, pendingAccessKey, currentAccessKeyProof || undefined);
    if (!result?.ok) {
      accessKeyConfirmError.textContent = result?.error || 'Не удалось создать ключ доступа';
      return;
    }
    accessKeyInfo.enabled = true;
    accessKeyInfo.type = result.type || type;
    cfg.accessKeyEnabled = true;
    currentAccessKeyProof = '';
    if (accessKeyFlow === 'prompt' && accessKeyPromptSuppress.checked) await persistPromptPreference(true);
    await refreshAccessKeySettings();
    closeAccessKeyPanel();
    toast(accessKeyFlow === 'prompt' ? 'Ключ доступа создан' : 'Ключ доступа обновлён');
    releaseSecurityGate();
  } catch (error) {
    accessKeyConfirmError.textContent = String(error?.message || error);
  } finally {
    accessKeyConfirmSubmit.disabled = false;
  }
});
native.onAccessKeyRemoved?.(() => {
  accessKeyInfo.enabled = false;
  accessKeyInfo.type = null;
  cfg.accessKeyEnabled = false;
  refreshAccessKeySettings();
  reloadWebviews();
  closeAccessKeyPanel();
  toast('Файл ключа удалён — cookies аккаунтов очищены', 'warning');
  if (!accessKeyGateReleased) {
    if (!accessKeyInfo.promptDismissed) showAccessKeyPrompt('startup');
    else releaseSecurityGate();
  }
});


  async function initializeAccessKey() {
    try {
      const result = await accessKeyStatusPromise;
      if (!result?.ok) throw new Error(result?.error || 'Не удалось проверить ключ доступа');
      accessKeyInfo = {
        enabled: !!result.enabled,
        type: result.type || null,
        promptDismissed: !!result.promptDismissed,
        recoveredMissingKey: !!result.recoveredMissingKey,
      };
      cfg.accessKeyEnabled = accessKeyInfo.enabled;
      cfg.accessKeyPromptDismissed = accessKeyInfo.promptDismissed;
      accessKeyStartupError = result.error
        ? `${result.error}. Если файл повреждён, удалите access-key.json в папке данных; cookies аккаунтов будут очищены.`
        : '';
      await refreshAccessKeySettings();
      if (accessKeyInfo.enabled) {
        if (!accessKeyInfo.type) accessKeyInfo.type = 'code';
        showAccessKeyForm('unlock', 'startup');
      } else if (accessKeyInfo.promptDismissed) {
        releaseSecurityGate();
      } else if (!isFirstLaunch() && isRememberedSite()) {
        showAccessKeyPrompt('startup');
      }
    } catch (error) {
      accessKeyInfo.enabled = true;
      accessKeyStartupError = `Не удалось проверить защиту: ${String(error?.message || error)}`;
      accessKeyInfo.type = 'code';
      await refreshAccessKeySettings();
      showAccessKeyForm('unlock', 'startup');
    }
  }

  document.getElementById('btn-access-key-exit')?.addEventListener('click', () => {
    if (accessKeyFlow === 'settings-change' || accessKeyFlow === 'settings-remove') {
      closeAccessKeyPanel();
      accessKeySettingsCreate?.focus();
      return;
    }
    native.exitAccessKeyScreen();
  });

  return {
    gate: accessKeyGate,
    statusPromise: accessKeyStatusPromise,
    releaseSecurityGate,
    showPrompt: showAccessKeyPrompt,
    isVisible: () => accessKeyLayer.classList.contains('show'),
    initialize: initializeAccessKey,
  };
}