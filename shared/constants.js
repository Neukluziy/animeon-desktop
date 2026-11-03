const APP_VERSION = require('../package.json').version;
const SITE_HOSTS = ['animeon.cc', 'animeon.co'];
const SITE_RE = /^https?:\/\/([a-z0-9-]+\.)*animeon\.(cc|co)(?:\/|$)/i;
const AUTH_RE = /(accounts\.google|apis\.google|googleusercontent|oauth\.telegram|telegram\.org)/i;
const TELEGRAM_RE = /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i;
const APP_PROTOCOL = 'animeon';
const CONFIG_SAVE_DEBOUNCE_MS = 400;
const STARTUP_DEEP_LINK_DELAY_MS = 900;
const STARTUP_BACKGROUND_CHECK_DELAY_MS = 7000;
const CACHE_CLEANUP_INTERVAL_MS = 900000;
const CACHE_CLEANUP_DELAY_MS = 2500;
const DISCORD_ACTIVITY_INTERVAL_MS = 15000;
const MEDIA_STATE_POLL_INTERVAL_MS = 5000;
const INACTIVE_TAB_UNLOAD_DELAY_MS = 90000;
const APP_REVEAL_FALLBACK_DELAY_MS = 15000;
const SETTINGS_OPEN_DELAY_MS = 900;
const NOTIFICATION_POLL_INTERVAL_MS = 300000;
const NOTIFICATION_INITIAL_POLL_DELAY_MS = 12000;
const DEFAULT_CACHE_LIMIT_MB = 512;
const BYTES_PER_MEGABYTE = 1048576;
const MAX_LOG_ENTRIES = 300;
const PLAYBACK_POSITION_SAVE_INTERVAL_MS = 12000;
const MAX_PLAYBACK_POSITION_ENTRIES = 300;
const DEFAULT_SITE_LIST = Object.freeze([
  Object.freeze({ id: 'one', url: 'https://animeon.cc/', label: 'animeon.cc' }),
  Object.freeze({ id: 'two', url: 'https://v2.animeon.co/', label: 'v2.animeon.co' }),
]);
const DEFAULT_WINDOW_SIZE = Object.freeze({ width: 1360, height: 850 });

module.exports = {
  APP_PROTOCOL,
  APP_VERSION,
  AUTH_RE,
  BYTES_PER_MEGABYTE,
  CACHE_CLEANUP_DELAY_MS,
  CACHE_CLEANUP_INTERVAL_MS,
  CONFIG_SAVE_DEBOUNCE_MS,
  DEFAULT_CACHE_LIMIT_MB,
  DEFAULT_SITE_LIST,
  DEFAULT_WINDOW_SIZE,
  DISCORD_ACTIVITY_INTERVAL_MS,
  APP_REVEAL_FALLBACK_DELAY_MS,
  INACTIVE_TAB_UNLOAD_DELAY_MS,
  MEDIA_STATE_POLL_INTERVAL_MS,
  MAX_PLAYBACK_POSITION_ENTRIES,
  MAX_LOG_ENTRIES,
  NOTIFICATION_INITIAL_POLL_DELAY_MS,
  NOTIFICATION_POLL_INTERVAL_MS,
  PLAYBACK_POSITION_SAVE_INTERVAL_MS,
  SITE_HOSTS,
  STARTUP_BACKGROUND_CHECK_DELAY_MS,
  SETTINGS_OPEN_DELAY_MS,
  SITE_RE,
  STARTUP_DEEP_LINK_DELAY_MS,
  TELEGRAM_RE,
};
