const APP_VERSION = '1.3.4';
const SITE_HOSTS = ['animeon.cc', 'animeon.co'];
const SITE_RE = /^https?:\/\/([a-z0-9-]+\.)*animeon\.(co|cc)\//i;
const AUTH_RE = /(accounts\.google|apis\.google|googleusercontent|oauth\.telegram|telegram\.org)/i;
const TELEGRAM_RE = /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\//i;
module.exports = { APP_VERSION, SITE_HOSTS, SITE_RE, AUTH_RE, TELEGRAM_RE };
