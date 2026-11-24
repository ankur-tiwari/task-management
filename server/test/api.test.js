'use strict';
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startServer, Client, registerAndLogin, PASSWORD } = require('./helpers');
const { hotp, base32Decode } = require('../src/utils/crypto');

let ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await ctx.close(); ctx.db.close(); });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('registration', () => {
  test('creates a user with uuid id, created_at, and no password in response', async () => {
    const c = new Client(ctx.base);
    const r = await c.post('/auth/register', { first_name: 'Ada', last_name: 'Lovelace', email: 'Ada@Example.com', password: PASSWORD });
    assert.equal(r.status, 201);
    assert.match(r.body.data.id, UUID);
    assert.equal(r.body.data.email, 'ada@example.com');
    assert.ok(r.body.data.created_at);
    assert.equal(JSON.stringify(r.body).includes('password'), false);
  });

  test('stores an argon2id hash, never the plaintext', () => {
    const row = ctx.db.prepare("SELECT password_hash FROM users WHERE email='ada@example.com'").get();
    assert.ok(row.password_hash.startsWith('$argon2id$'));
  });

  test('rejects weak password, bad email, unknown fields (mass assignment)', async () => {
    const c = new Client(ctx.base);
    const weak = await c.post('/auth/register', { first_name: 'A', last_name: 'B', email: 'a@b.co', password: 'short' });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.error.code, 'VALIDATION_ERROR');
    const bad = await c.post('/auth/register', { first_name: 'A', last_name: 'B', email: 'nope', password: PASSWORD });
    assert.equal(bad.status, 400);
    const extra = await c.post('/auth/register', { first_name: 'A', last_name: 'B', email: 'x@y.co', password: PASSWORD, id: 'abc', mfa_enabled: 1 });
    assert.equal(extra.status, 400);
  });

  test('duplicate email gets a generic 409', async () => {
    const c = new Client(ctx.base);
    const r = await c.post('/auth/register', { first_name: 'Ada', last_name: 'L', email: 'ada@example.com', password: PASSWORD });
    assert.equal(r.status, 409);
    assert.ok(!/exists|already registered/i.test(r.body.error.message.replace('If you already have an account', '')));
  });
});

describe('login / session', () => {
  test('sets HttpOnly SameSite=Strict cookie and no token in body', async () => {
    const c = new Client(ctx.base);
    const email = 'login1@example.com';
    await c.post('/auth/register', { first_name: 'L', last_name: 'One', email, password: PASSWORD });
    const r = await c.post('/auth/login', { email, password: PASSWORD });
    assert.equal(r.status, 200);
    const cookie = r.headers.getSetCookie().find((x) => x.startsWith('session='));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.equal(JSON.stringify(r.body).includes('eyJ'), false, 'JWT must not appear in body');
    const me = await c.get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, email);
  });

  test('wrong password and unknown email return the same error', async () => {
    const c = new Client(ctx.base);
    const a = await c.post('/auth/login', { email: 'ada@example.com', password: 'Wrong!Passw0rd#9' });
    const b = await c.post('/auth/login', { email: 'ghost@example.com', password: 'Wrong!Passw0rd#9' });
    assert.equal(a.status, 401);
    assert.deepEqual(a.body, b.body);
  });

  test('account locks after repeated failures, even with the right password', async () => {
    const c = new Client(ctx.base);
    const email = 'lock@example.com';
    await c.post('/auth/register', { first_name: 'L', last_name: 'K', email, password: PASSWORD });
    for (let i = 0; i < 5; i++) await c.post('/auth/login', { email, password: 'Wrong!Passw0rd#9' });
    const r = await c.post('/auth/login', { email, password: PASSWORD });
    assert.equal(r.status, 401);
  });

  test('logout revokes the token server-side', async () => {
    const { client } = await registerAndLogin(ctx.base);
    const stolen = client.jar.get('session');
    assert.equal((await client.post('/auth/logout')).status, 204);
    const replay = new Client(ctx.base);
    replay.jar.set('session', stolen);
    assert.equal((await replay.get('/auth/me')).status, 401);
  });

  test('forged / alg=none / tampered tokens are rejected', async () => {
    const c = new Client(ctx.base);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'x', aud: 'session', iss: 'task-manager' })).toString('base64url')}.`;
    c.jar.set('session', none);
    assert.equal((await c.get('/auth/me')).status, 401);
    const { client } = await registerAndLogin(ctx.base);
    const t = client.jar.get('session');
    client.jar.set('session', t.slice(0, -3) + 'abc');
    assert.equal((await client.get('/auth/me')).status, 401);
  });

  test('unauthenticated access to tasks is rejected', async () => {
    assert.equal((await new Client(ctx.base).get('/tasks')).status, 401);
  });
});

describe('CSRF', () => {
  test('state-changing request without token is rejected', async () => {
    const { client } = await registerAndLogin(ctx.base);
    const r = await client.post('/tasks', { task_name: 'x' }, { csrf: false });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'CSRF_INVALID');
  });

  test('wrong token and foreign Origin are rejected', async () => {
    const { client } = await registerAndLogin(ctx.base);
    const wrong = await client.post('/tasks', { task_name: 'x' }, { headers: { 'X-CSRF-Token': 'deadbeef' }, csrf: false });
    assert.equal(wrong.status, 403);
    const evil = await client.post('/tasks', { task_name: 'x' }, { origin: 'https://evil.example' });
    assert.equal(evil.status, 403);
  });
});

describe('tasks CRUD + authorization', () => {
  let alice, bob, carol, task;
  before(async () => {
    alice = await registerAndLogin(ctx.base, { first_name: 'Alice' });
    bob = await registerAndLogin(ctx.base, { first_name: 'Bob' });
    carol = await registerAndLogin(ctx.base, { first_name: 'Carol' });
  });

  test('create applies defaults, uuid id, timestamps', async () => {
    const r = await alice.client.post('/tasks', { task_name: '  Write docs  ', assigned_to: bob.user.id, due_date: '2030-01-31' });
    assert.equal(r.status, 201);
    task = r.body.data;
    assert.match(task.id, UUID);
    assert.equal(task.task_name, 'Write docs');
    assert.equal(task.status, 'Pending');
    assert.equal(task.assigned_to, bob.user.id);
    assert.ok(task.created_at && task.updated_at);
  });

  test('validation: bad status, bad date, impossible date, long name, bad assignee', async () => {
    const c = alice.client;
    assert.equal((await c.post('/tasks', { task_name: 'a', status: 'Done' })).status, 400);
    assert.equal((await c.post('/tasks', { task_name: 'a', due_date: '31/01/2030' })).status, 400);
    assert.equal((await c.post('/tasks', { task_name: 'a', due_date: '2030-02-31' })).status, 400);
    assert.equal((await c.post('/tasks', { task_name: 'x'.repeat(121) })).status, 400);
    assert.equal((await c.post('/tasks', { task_name: 'a', assigned_to: 'not-a-uuid' })).status, 400);
    assert.equal((await c.post('/tasks', { task_name: 'a', assigned_to: crypto.randomUUID() })).status, 400);
    assert.equal((await c.post('/tasks', { task_name: 'a', created_by: bob.user.id })).status, 400);
    assert.equal((await c.get('/tasks/not-a-uuid')).status, 400);
  });

  test('BOLA: an unrelated user cannot read, update or delete (404)', async () => {
    const c = carol.client;
    assert.equal((await c.get(`/tasks/${task.id}`)).status, 404);
    assert.equal((await c.patch(`/tasks/${task.id}`, { status: 'Completed' })).status, 404);
    assert.equal((await c.put(`/tasks/${task.id}`, { task_name: 'hijack' })).status, 404);
    assert.equal((await c.del(`/tasks/${task.id}`)).status, 404);
    const list = await c.get('/tasks');
    assert.equal(list.body.data.some((t) => t.id === task.id), false);
  });

  test('assignee may change status only; cannot edit other fields or delete', async () => {
    const c = bob.client;
    assert.equal((await c.get(`/tasks/${task.id}`)).status, 200);
    const ok = await c.patch(`/tasks/${task.id}`, { status: 'In-progress' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.status, 'In-progress');
    assert.equal((await c.patch(`/tasks/${task.id}`, { task_name: 'renamed' })).status, 403);
    assert.equal((await c.patch(`/tasks/${task.id}`, { assigned_to: carol.user.id })).status, 403);
    assert.equal((await c.put(`/tasks/${task.id}`, { task_name: 'renamed' })).status, 403);
    assert.equal((await c.del(`/tasks/${task.id}`)).status, 403);
  });

  test('creator can PUT, PATCH, list with filters/pagination', async () => {
    const c = alice.client;
    const put = await c.put(`/tasks/${task.id}`, { task_name: 'Write docs v2', description: 'd', status: 'Blocked', due_date: null, assigned_to: null });
    assert.equal(put.status, 200);
    assert.equal(put.body.data.status, 'Blocked');
    assert.equal(put.body.data.assigned_to, null);
    assert.notEqual(put.body.data.updated_at, task.updated_at);
    assert.equal((await c.patch(`/tasks/${task.id}`, {})).status, 400);
    for (let i = 0; i < 12; i++) await c.post('/tasks', { task_name: `bulk ${i}`, status: 'Completed' });
    const page = await c.get('/tasks?status=Completed&limit=5&page=3');
    assert.equal(page.status, 200);
    assert.equal(page.body.meta.total, 12);
    assert.equal(page.body.data.length, 2);
    assert.equal((await c.get('/tasks?limit=1000')).status, 400);
    assert.equal((await c.get('/tasks?sort=evil')).status, 400);
  });

  test('search treats SQL/LIKE metacharacters as literals', async () => {
    const c = alice.client;
    await c.post('/tasks', { task_name: '100% done' });
    assert.equal((await c.get(`/tasks?q=${encodeURIComponent("' OR 1=1 --")}`)).body.data.length, 0);
    const pct = await c.get(`/tasks?q=${encodeURIComponent('100%')}`);
    assert.equal(pct.body.data.length, 1);
    const wild = await c.get(`/tasks?q=${encodeURIComponent('%')}`);
    assert.equal(wild.body.data.length, 1);
  });

  test('creator can delete; then 404', async () => {
    assert.equal((await alice.client.del(`/tasks/${task.id}`)).status, 204);
    assert.equal((await alice.client.get(`/tasks/${task.id}`)).status, 404);
  });

  test('user directory exposes no emails or hashes', async () => {
    const r = await alice.client.get('/users');
    assert.equal(r.status, 200);
    const s = JSON.stringify(r.body);
    assert.equal(/email|password|mfa/.test(s), false);
  });
});

describe('MFA (TOTP)', () => {
  test('setup -> enable -> login requires code -> replay rejected -> disable', async () => {
    const { client, creds } = await registerAndLogin(ctx.base);
    const setup = await client.post('/auth/mfa/setup');
    assert.equal(setup.status, 200);
    assert.ok(setup.body.data.qr_data_url.startsWith('data:image/png'));
    const secret = setup.body.data.secret;
    const stored = ctx.db.prepare('SELECT mfa_secret_enc FROM users WHERE email=?').get(creds.email).mfa_secret_enc;
    assert.ok(stored && !stored.includes(secret), 'secret must be encrypted at rest');

    const stepNow = Math.floor(Date.now() / 30000);
    const code = (s) => hotp(secret, s);
    assert.equal((await client.post('/auth/mfa/enable', { code: '000000' })).status, 400);
    assert.equal((await client.post('/auth/mfa/enable', { code: code(stepNow) })).status, 200);

    // fresh login now needs a second factor
    const c2 = new Client(ctx.base);
    const l1 = await c2.post('/auth/login', { email: creds.email, password: creds.password });
    assert.equal(l1.body.data.mfa_required, true);
    assert.equal(c2.jar.has('session'), false, 'no session before MFA');
    const token = l1.body.data.mfa_token;
    assert.equal((await c2.post('/auth/mfa/login', { mfa_token: token, code: '123456' })).status, 401);
    // enable consumed stepNow; use the next window
    const l2 = await c2.post('/auth/mfa/login', { mfa_token: token, code: code(stepNow + 1) });
    assert.equal(l2.status, 200);
    assert.equal((await c2.get('/auth/me')).status, 200);
    // replay of same code is refused
    const c3 = new Client(ctx.base);
    const l3 = await c3.post('/auth/login', { email: creds.email, password: creds.password });
    assert.equal((await c3.post('/auth/mfa/login', { mfa_token: l3.body.data.mfa_token, code: code(stepNow + 1) })).status, 401);
    // an MFA challenge token is not a session
    const c4 = new Client(ctx.base);
    c4.jar.set('session', token);
    assert.equal((await c4.get('/auth/me')).status, 401);

    // disable needs password + valid fresh code
    assert.equal((await c2.post('/auth/mfa/disable', { password: 'Wrong!Passw0rd#9', code: code(stepNow + 1) })).status, 400);
  });
});

describe('hardening', () => {
  test('security headers present, no x-powered-by', async () => {
    const r = await new Client(ctx.base).get('/auth/csrf');
    assert.ok(r.headers.get('content-security-policy').includes("default-src 'self'"));
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });

  test('CORS only allows the configured origin', async () => {
    const evil = await fetch(`${ctx.base}/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
    const good = await fetch(`${ctx.base}/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(good.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(good.headers.get('access-control-allow-credentials'), 'true');
  });

  test('oversized and malformed bodies are rejected without leaking internals', async () => {
    const c = new Client(ctx.base);
    const big = await c.post('/auth/login', { email: 'a@b.co', password: 'x'.repeat(20000) });
    assert.equal(big.status, 413);
    await c.refreshCsrf();
    const res = await fetch(`${ctx.base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', 'X-CSRF-Token': c.csrf, Cookie: `csrf=${c.csrf}` },
      body: '{bad json',
    });
    assert.equal(res.status, 400);
    assert.equal((await res.text()).includes('at '), false);
  });

  test('unknown routes return JSON 404', async () => {
    const r = await new Client(ctx.base).get('/nope');
    assert.equal(r.status, 404);
  });
});
