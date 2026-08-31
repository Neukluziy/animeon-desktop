const APP_VERSION = '1.4.0';
const SITE_HOSTS = ['animeon.cc', 'animeon.co', 'animeon.gg'];
const SITE_RE = /^https?:\/\/([a-z0-9-]+\.)*animeon\.(cc|co|gg)(?:\/|$)/i;
const AUTH_RE = /(accounts\.google|apis\.google|googleusercontent|oauth\.telegram|telegram\.org)/i;
const TELEGRAM_RE = /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i;
module.exports = { APP_VERSION, SITE_HOSTS, SITE_RE, AUTH_RE, TELEGRAM_RE };
