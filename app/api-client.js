const API_BASE = 'https://api.animeon.cloud';
const API_FALLBACK_BASES = ['https://api.animeon.co'];
const API_VERSION = '1.0.0';
const DEFAULT_TIMEOUT = 10000;

function normalizePath(path) {
  const value = String(path || '').trim();
  if (!value) throw new Error('API path is required');
  const normalized = value.startsWith('/') ? value : `/${value}`;
  if (!normalized.startsWith('/api/')) throw new Error('Only /api/* paths are allowed');
  return normalized;
}

async function getCookieHeader(siteSession, base) {
  if (!siteSession) return '';
  const cookies = await siteSession.cookies.get({ url: base });
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

async function request(path, options = {}) {
  const endpoint = normalizePath(path);
  const method = String(options.method || 'GET').toUpperCase();
  const timeout = Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : DEFAULT_TIMEOUT;
  const headers = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': 'AnimeOn-Desktop',
    'X-AnimeOn-Client': 'desktop',
    'X-AnimeOn-Client-Version': API_VERSION,
    ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
  };
  let body;
  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === 'string' || options.body instanceof Uint8Array) {
      body = options.body;
    } else {
      body = JSON.stringify(options.body);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
  }

  const bases = [...new Set([API_BASE, ...API_FALLBACK_BASES])];
  let lastResponse = null;
  let lastError = null;
  const started = Date.now();
  for (const base of bases) {
    try {
      const requestHeaders = { ...headers };
      const cookieHeader = await getCookieHeader(options.session, base);
      if (cookieHeader && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'cookie')) {
        requestHeaders.Cookie = cookieHeader;
      }
      const response = await fetch(`${base}${endpoint}`, {
        method,
        headers: requestHeaders,
        body,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      const text = await response.text();
      let data = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch { void 0; }
      lastResponse = {
        ok: response.ok,
        status: response.status,
        ms: Date.now() - started,
        url: response.url || `${base}${endpoint}`,
        data,
      };
      if (response.status < 500) return lastResponse;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error('All AnimeOn API servers are unavailable');
}

async function health() {
  const candidates = ['/api/config/mobile', '/api/anime/filters'];
  const results = [];
  for (const path of candidates) {
    const started = Date.now();
    try {
      const result = await request(path, { timeout: 7000 });
      results.push({ path, ok: result.ok || result.status < 500, status: result.status, ms: result.ms });
      if (result.ok) return { ok: true, status: result.status, ms: Date.now() - started, endpoint: path, results };
    } catch (error) {
      results.push({ path, ok: false, status: 0, ms: Date.now() - started, error: String(error?.message || error) });
    }
  }
  return { ok: false, status: results.at(-1)?.status || 0, ms: results.at(-1)?.ms || 0, results };
}

async function get(path, query, options = {}) {
  const params = new URLSearchParams();
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) value.forEach(item => params.append(key, String(item)));
      else params.set(key, String(value));
    }
  }
  const endpoint = normalizePath(path);
  return request(params.toString() ? `${endpoint}?${params}` : endpoint, { ...options, method: 'GET' });
}

module.exports = { API_BASE, API_FALLBACK_BASES, API_VERSION, request, get, health };
