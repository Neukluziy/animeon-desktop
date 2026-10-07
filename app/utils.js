const { isIP } = require('node:net');
const DEFAULT_DISCORD_RPC_SETTINGS = Object.freeze({
  enabled: true,
  showEpisode: true,
  showSeason: true,
  showTime: true,
  showWhenIdle: true,
  showPoster: true,
  clickTitle: true,
  clickState: true,
  clickPoster: true,
  useAnimePoster: true,
});

function compareVersions(a, b) {
  const parse = (value) => String(value).split('.').map((part) => parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseProxyEndpoint(value) {
  const match = String(value ?? '').trim().match(/^(?:\[([0-9a-f:.]+)\]|([a-z\d.-]+)):(\d{1,5})$/i);
  if (!match) return null;

  const port = Number(match[3]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

  let host;
  if (match[1]) {
    if (isIP(match[1]) !== 6) return null;
    host = `[${match[1]}]`;
  } else {
    host = match[2];
    if (isIP(host) !== 4 && (host.length > 253 || host.split('.').some((label) =>
      label.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)))) return null;
  }

  return { host, port };
}

function formatPlaybackTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const pad = (part) => String(part).padStart(2, '0');
  return hours ? `${hours}:${pad(minutes)}:${pad(remainder)}` : `${minutes}:${pad(remainder)}`;
}

function buildDiscordActivity(media = {}, options = {}) {
  const settings = { ...DEFAULT_DISCORD_RPC_SETTINGS, ...(options || {}) };
  const idle = !!media.idle;
  const title = String(idle ? 'AnimeOn' : media.animeTitle || media.title || 'AnimeOn').replace(/\s+/g, ' ').trim().slice(0, 128) || 'AnimeOn';
  const episode = String(media.episode || '—').slice(0, 12);
  const season = String(media.season || '—').slice(0, 12);
  const duration = Number(media.duration) > 0
    ? `${formatPlaybackTime(media.currentTime)} / ${formatPlaybackTime(media.duration)}`
    : formatPlaybackTime(media.currentTime);
  const state = [];
  if (idle) {
    state.push(String(media.idleText || 'В главном меню').slice(0, 128));
  } else {
    const parts = [];
    if (settings.showEpisode) parts.push(`Серия ${episode}`);
    if (settings.showSeason) parts.push(`Сезон ${season}`);
    if (settings.showTime) parts.push(duration);
    state.push(parts.join(' · ') || 'Смотрит');
  }

  return {
    details: title,
    state: state.join('\n').slice(0, 128),
    detailsUrl: settings.clickTitle ? media.animeUrl : '',
    stateUrl: settings.clickState ? media.watchUrl : '',
    largeImageKey: settings.showPoster && settings.useAnimePoster && media.posterUrl ? media.posterUrl : 'logo',
    largeImageText: title,
    largeImageUrl: settings.clickPoster ? media.animeUrl : '',
    smallImageKey: idle ? '' : media.paused ? 'pause' : 'play',
    smallImageText: idle ? '' : media.paused ? 'Пауза' : 'Смотрит',
    buttons: [],
  };
}

module.exports = { compareVersions, clamp, parseProxyEndpoint, formatPlaybackTime, buildDiscordActivity, DEFAULT_DISCORD_RPC_SETTINGS };
