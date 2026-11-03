const CURRENT_CONFIG_SCHEMA_VERSION = 1;
const { SITE_RE } = require('./constants');

const ENUMS = {
  theme: [
    'violet',
    'blue',
    'cyan',
    'sky',
    'indigo',
    'emerald',
    'green',
    'lime',
    'yellow',
    'amber',
    'orange',
    'red',
    'rose',
    'pink',
    'fuchsia',
    'slate',
    'gray',
    'teal',
    'mint',
    'gold',
    'coral',
    'lavender',
    'crimson',
    'electric',
    'custom',
  ],
  site: ['cc', 'co'],
  colorMode: ['dark', 'light', 'system', 'schedule'],
  titleDisplay: ['brand', 'compact', 'page', 'page-only'],
  performance: ['performance', 'balanced', 'economy'],
  effectMode: ['full', 'moderate', 'minimum'],
  closeBehavior: ['exit', 'tray', 'ask'],
  remember: ['0', '1'],
};

const RANGES = {
  activeTab: [0, 11],
  cacheLimitMB: [0, Number.MAX_SAFE_INTEGER],
  playbackSpeed: [0.25, 2],
  playbackPositions: [0, Number.MAX_SAFE_INTEGER],
  'visual.radius': [0, 64],
  'visual.opacity': [0, 100],
  'visual.blur': [0, 14],
  'visual.scale': [50, 200],
  'visual.density': [50, 150],
  'visual.accentGlow': [0, 100],
  'api.timeout': [1000, 60000],
  'network.port': [0, 65535],
  'sleepTimer.minutes': [0, 10080],
};

const BOOLEAN_FIELDS = new Set([
  'notify',
  'autostart',
  'tray',
  'compact',
  'confirmClose',
  'autoRecovery',
  'lowPower',
  'autoHide',
  'alwaysOnTop',
  'smoothSite',
  'showSiteScrollbars',
  'tabsFixedV2',
  'doNotDisturb',
  'autoCacheCleanup',
  'memorySaver',
  'startupPolicyFixed',
  'accessKeyEnabled',
  'accessKeyPromptDismissed',
  'resumeEnabled',
  'autoNext',
  'autoUpdate',
  'silentUpdates',
  'autoMirror',
  'reduceMotion',
  'highContrast',
  'showSplash',
  'glassWindow',
  'onboardingComplete',
]);

const MAX_ARRAY_LENGTHS = {
  accounts: 20,
  tabs: 12,
  history: 1000,
  favorites: 1000,
  recentPages: 100,
  pageFavorites: 1000,
  watchNotes: 1000,
  errorLog: 300,
  siteList: 20,
};

const DYNAMIC_OBJECT_FIELDS = new Set(['hotkeys', 'profiles', 'playbackPositions', 'windowStates']);
const FORBIDDEN_FIELDS = new Set([
  'schemaVersion',
  'plugins',
  'safeMode',
  'subtitleSettings',
  'spoilerProgress',
  'spoilerShield',
  'watchStats',
  'updateChannel',
]);
const PROTECTED_CONFIG_FIELDS = new Set([
  'accessKeyEnabled',
  'accounts',
  'activeAccountId',
  'windowStates',
  'tabs',
  'activeTab',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeJsonValue(value, depth = 0) {
  if (depth > 8) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 10000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, 1000)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (!isRecord(value)) return undefined;
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 1000)) {
    if (key.length > 200 || FORBIDDEN_FIELDS.has(key)) continue;
    const sanitized = sanitizeJsonValue(item, depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function sanitizeAgainstDefault(value, fallback, path = '') {
  if (Array.isArray(fallback)) {
    if (!Array.isArray(value)) return fallback;
    const limit = MAX_ARRAY_LENGTHS[path] || 1000;
    return value
      .slice(0, limit)
      .map((item) => sanitizeJsonValue(item))
      .filter((item) => item !== undefined);
  }
  if (isRecord(fallback)) {
    if (!isRecord(value)) return fallback;
    if (DYNAMIC_OBJECT_FIELDS.has(path)) return sanitizeJsonValue(value) || fallback;
    const result = { ...fallback };
    for (const [key, nestedDefault] of Object.entries(fallback)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const sanitized = sanitizeAgainstDefault(value[key], nestedDefault, `${path}.${key}`);
        if (sanitized !== undefined) result[key] = sanitized;
      }
    }
    return result;
  }
  if (fallback === null) return value === null || typeof value === 'string' ? value : fallback;
  if (typeof value !== typeof fallback) return fallback;
  if (typeof value === 'string')
    return value.slice(0, path === 'customCss.cc' || path === 'customCss.co' ? 200000 : 10000);
  if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
  return value;
}

function sanitizeSiteList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const sites = [];
  for (const item of value.slice(0, MAX_ARRAY_LENGTHS.siteList)) {
    if (!isRecord(item) || typeof item.url !== 'string') continue;
    const rawUrl = item.url.trim();
    const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    if (!SITE_RE.test(url)) continue;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) continue;
    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
    const id = typeof item.id === 'string' && /^[\w-]{1,64}$/.test(item.id) ? item.id : `site-${sites.length + 1}`;
    const label = typeof item.label === 'string' ? item.label.trim().slice(0, 100) : '';
    sites.push({ id, url: parsed.href, label: label || parsed.hostname });
  }
  return sites.length >= 2 ? sites : fallback;
}

function sanitizeConfig(raw, defaults) {
  if (!isRecord(defaults)) throw new TypeError('Configuration defaults must be an object');
  const source = isRecord(raw) ? raw : {};
  const sanitized = { ...defaults };

  for (const [key, fallback] of Object.entries(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(source, key) || FORBIDDEN_FIELDS.has(key)) continue;
    let value = sanitizeAgainstDefault(source[key], fallback, key);
    if (value === undefined) continue;

    if (ENUMS[key] && !ENUMS[key].includes(value)) continue;
    if (BOOLEAN_FIELDS.has(key) && typeof value !== 'boolean') continue;
    if (key === 'custom' && (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value))) continue;
    if (key === 'lastUrl' && typeof value === 'string' && value.length > 2000) continue;
    if (key === 'siteList') value = sanitizeSiteList(source[key], fallback);
    if (key === 'playbackSpeed' && ![0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(value)) continue;
    if (key === 'cacheLimitMB' && (value < RANGES.cacheLimitMB[0] || value > RANGES.cacheLimitMB[1])) continue;
    if (key === 'activeTab' && (!Number.isInteger(value) || value < RANGES.activeTab[0] || value > RANGES.activeTab[1]))
      continue;

    if (isRecord(value)) {
      for (const [nestedKey, range] of Object.entries(RANGES)) {
        if (!nestedKey.startsWith(`${key}.`)) continue;
        const field = nestedKey.slice(key.length + 1);
        const nestedValue = value[field];
        if (
          nestedValue !== undefined &&
          (typeof nestedValue !== 'number' || nestedValue < range[0] || nestedValue > range[1])
        ) {
          value[field] = fallback[field];
        }
      }
      if (key === 'sleepTimer' && !['pause', 'exit', 'tray'].includes(value.action)) value.action = fallback.action;
      if (key === 'network' && !['system', 'direct', 'custom'].includes(value.mode)) value.mode = fallback.mode;
    }
    sanitized[key] = value;
  }

  sanitized.schemaVersion = CURRENT_CONFIG_SCHEMA_VERSION;
  return sanitized;
}

function sanitizeConfigPatch(patch, current, defaults, protectedFields = new Set()) {
  if (!isRecord(patch)) return {};
  const sanitized = sanitizeConfig({ ...current, ...patch }, defaults);
  return Object.fromEntries(
    Object.keys(patch)
      .filter(
        (key) =>
          Object.prototype.hasOwnProperty.call(defaults, key) &&
          !FORBIDDEN_FIELDS.has(key) &&
          !protectedFields.has(key),
      )
      .map((key) => [key, sanitized[key]]),
  );
}

function migrateConfig(raw) {
  if (!isRecord(raw)) throw new TypeError('Файл настроек должен содержать JSON-объект');
  const version = raw.schemaVersion === undefined ? 0 : Number(raw.schemaVersion);
  if (!Number.isInteger(version) || version < 0 || version > CURRENT_CONFIG_SCHEMA_VERSION) {
    throw new Error(`Неподдерживаемая версия настроек: ${String(raw.schemaVersion)}`);
  }
  const migrated = { ...raw };
  if (version < 1) migrated.schemaVersion = 1;
  if (!Object.prototype.hasOwnProperty.call(migrated, 'onboardingComplete')) migrated.onboardingComplete = true;
  return migrated;
}

module.exports = {
  CURRENT_CONFIG_SCHEMA_VERSION,
  PROTECTED_CONFIG_FIELDS,
  migrateConfig,
  sanitizeConfig,
  sanitizeConfigPatch,
};
