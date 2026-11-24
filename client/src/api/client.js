// Thin fetch wrapper. Auth lives in an HttpOnly cookie (JS cannot read it), so
// no token is ever stored in localStorage/sessionStorage. CSRF token is kept in memory only.
const BASE = '/api';

let csrfToken = null;
let csrfInFlight = null;
let onUnauthorized = () => {};

export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** Map server validation details to { field: message } for forms. */
  get fieldErrors() {
    const out = {};
    for (const d of this.details || []) if (d.field && !out[d.field]) out[d.field] = d.message;
    return out;
  }
}

function loadCsrf() {
  if (!csrfInFlight) {
    csrfInFlight = fetch(`${BASE}/auth/csrf`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((b) => { csrfToken = b.csrf_token; })
      .finally(() => { csrfInFlight = null; });
  }
  return csrfInFlight;
}

const AUTH_PATHS = ['/auth/login', '/auth/mfa/login', '/auth/register', '/auth/me'];

export async function request(method, path, { body, retry = true } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    if (!csrfToken) await loadCsrf();
    headers['X-CSRF-Token'] = csrfToken;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json?.error;
    if (res.status === 403 && err?.code === 'CSRF_INVALID' && retry) {
      csrfToken = null;
      return request(method, path, { body, retry: false });
    }
    if (res.status === 401 && !AUTH_PATHS.includes(path)) onUnauthorized();
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'Request failed.', err?.details ?? []);
  }
  return json;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, body) => request('POST', p, { body }),
  put: (p, body) => request('PUT', p, { body }),
  patch: (p, body) => request('PATCH', p, { body }),
  delete: (p) => request('DELETE', p),
};
