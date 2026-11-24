'use strict';
// Test env MUST be set before config is loaded.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64);
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.RATE_LIMIT_AUTH_MAX = '1000';

const { openDatabase } = require('../src/db');
const { createApp } = require('../src/app');

const ORIGIN = 'http://localhost:5173';
const PASSWORD = 'Str0ng!Passw0rd#1';

async function startServer() {
  const db = openDatabase(':memory:');
  const server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return { db, server, base, close: () => new Promise((r) => server.close(r)) };
}

/** Tiny cookie-aware API client that mimics the browser SPA (CSRF header + cookie jar). */
class Client {
  constructor(base) { this.base = base; this.jar = new Map(); this.csrf = null; }

  async raw(method, path, { body, headers = {}, csrf = true, origin = ORIGIN } = {}) {
    if (csrf && !this.csrf && method !== 'GET') await this.refreshCsrf();
    const h = { ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (csrf && this.csrf && method !== 'GET') h['X-CSRF-Token'] = this.csrf;
    if (origin) h.Origin = origin;
    if (this.jar.size) h.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(this.base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [k, ...rest] = pair.split('=');
      const val = rest.join('=');
      if (!val || /expires=thu, 01 jan 1970/i.test(c)) this.jar.delete(k); else this.jar.set(k, val);
    }
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  async refreshCsrf() {
    const r = await this.raw('GET', '/auth/csrf');
    this.csrf = r.body.csrf_token;
  }

  get = (p, o) => this.raw('GET', p, o);
  post = (p, body, o) => this.raw('POST', p, { body, ...o });
  put = (p, body, o) => this.raw('PUT', p, { body, ...o });
  patch = (p, body, o) => this.raw('PATCH', p, { body, ...o });
  del = (p, o) => this.raw('DELETE', p, o);
}

let counter = 0;
async function registerAndLogin(base, overrides = {}) {
  const c = new Client(base);
  const user = {
    first_name: 'Test', last_name: 'User', email: `user${++counter}-${Date.now()}@example.com`,
    password: PASSWORD, ...overrides,
  };
  const reg = await c.post('/auth/register', user);
  if (reg.status !== 201) throw new Error(`register failed: ${JSON.stringify(reg.body)}`);
  const login = await c.post('/auth/login', { email: user.email, password: user.password });
  if (login.status !== 200) throw new Error(`login failed: ${JSON.stringify(login.body)}`);
  return { client: c, user: reg.body.data, creds: user };
}

module.exports = { startServer, Client, registerAndLogin, PASSWORD, ORIGIN };
