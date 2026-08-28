const path = require('node:path');
const { compareVersions, clamp } = require('./utils');
const { APP_VERSION, SITE_HOSTS, SITE_RE, AUTH_RE, TELEGRAM_RE } = require('../shared/constants');
module.exports = { path, compareVersions, clamp, APP_VERSION, SITE_HOSTS, SITE_RE, AUTH_RE, TELEGRAM_RE };
