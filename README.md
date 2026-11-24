# Task Manager — Node.js · Express · SQLite · React

Secure task management app: register, login (optional TOTP 2FA), and task CRUD.

```
server/   Express REST API + SQLite (better-sqlite3), zod validation, tests
client/   React (Vite) SPA, component-based, zod validation
```

## Run it

Requires Node 20+.

```bash
# 1) API
cd server
cp .env.example .env
#   fill JWT_SECRET and MFA_ENCRYPTION_KEY using the commands shown in .env.example
npm install
npm run dev            # http://localhost:4000

# 2) UI (new terminal)
cd client
npm install
npm run dev            # http://localhost:5173  (proxies /api to :4000)
```

Tests: `cd server && npm test` (25 API tests: auth, CSRF, BOLA, validation, MFA, headers).

### Production
`cd client && npm run build` — the API then serves `client/dist` itself (single origin).
Set `NODE_ENV=production`, `CLIENT_ORIGIN=https://your-domain` (https is enforced), and
`TRUST_PROXY=1` if behind one reverse proxy. **Serve over HTTPS only** (cookies are `Secure`, `__Host-` prefixed).

## Data model
All ids are UUID v4; every table has `created_at` (default) and `updated_at`.

| users | tasks |
|---|---|
| id, first_name, last_name, email (unique), password_hash, created_at, updated_at, + mfa/lockout/token_version columns | id, task_name, description, due_date, status (`Pending`\|`In-progress`\|`Completed`\|`Blocked`), created_by, **assigned_to**, created_at, updated_at |

## REST API (`/api`)
| Method | Path | Notes |
|---|---|---|
| GET | `/auth/csrf` | issue CSRF token |
| POST | `/auth/register` · `/auth/login` · `/auth/logout` | |
| POST | `/auth/mfa/login` | 2nd step when 2FA enabled |
| GET | `/auth/me` | |
| POST | `/auth/mfa/setup` · `/auth/mfa/enable` · `/auth/mfa/disable` | TOTP |
| GET | `/users` | id + name only, for the assignee dropdown |
| GET/POST | `/tasks` | list supports `status`, `q`, `page`, `limit` (≤50) |
| GET/PUT/PATCH/DELETE | `/tasks/:id` | |

Errors: `{ "error": { "code", "message", "details": [{ "field", "message" }] } }`

**Task permissions:** you see tasks you created or are assigned to. Creator: full control.
Assignee: may change *status only*. Anyone else gets `404` (existence is not revealed).

## Security checklist → implementation
| Item | How |
|---|---|
| SQL injection | Only parameterized statements; dynamic column names come from a fixed allow-list; LIKE wildcards escaped |
| XSS | React escaping, no `dangerouslySetInnerHTML`, strict CSP (`script-src 'self'`, no inline) via helmet, `nosniff` |
| CSRF | Double-submit token (HttpOnly cookie + `X-CSRF-Token` header) + `Origin` check + `SameSite=Strict` cookies |
| File uploads | Not applicable — the app has no upload endpoints |
| BOLA | Every task query is scoped to creator/assignee in the repository layer; per-action creator/assignee rules in the route; tested |
| Rate limiting | Global API limiter + strict limiter (10/15 min/IP) on login, register, MFA; per-account lockout after 5 failures (15 min) |
| JWT secrets | Server exits if `JWT_SECRET` is missing, <32 chars or a known placeholder; HS256 pinned, `iss`/`aud` verified, 1 h expiry |
| API secrets server-side | Secrets only in server env; client holds none |
| Password hashing | argon2id; password length capped at 128 to prevent hashing-DoS; complexity rules |
| MFA | TOTP (RFC 6238), seed AES-256-GCM encrypted at rest, replay protection, MFA challenge token is single-purpose (`aud: mfa`) |
| CORS | Exact single-origin allow-list, credentials on, never `*` |
| Tokens out of localStorage | JWT lives only in an HttpOnly, SameSite=Strict, Secure (prod) cookie; CSRF/MFA tokens in memory only. Verified in browser: web storage is empty and `document.cookie` is empty |
| Server-side permissions | All authorization decided in the API; UI hiding is cosmetic |
| RLS | SQLite has no native RLS — equivalent row-level scoping is enforced in the data-access layer for every query (see `taskRepo.js`) |
| Webhook signatures / SSRF | Not applicable — no webhooks and the server makes no outbound requests from user input |
| Source maps | `build.sourcemap = false`; verified no `.map` files in `dist` |
| Default credentials | None exist; no seeded users; app refuses to start without secrets |
| Sensitive data in logs | Access log = method, path (no query), status, time. Error log = name + message only. Verified |
| Vulnerable dependencies | `npm audit`: 0 vulnerabilities (server and client). Re-run regularly |

Also: login errors are identical for unknown email / wrong password / locked account (with equal hashing time),
logout revokes tokens server-side (`token_version`), 10 KB body limit, strict unknown-field rejection (mass-assignment),
`Cache-Control: no-store` on authenticated data, DB file mode `0600`.

## Known limitations / next steps
- No email verification or password reset (needs an email provider).
- 2FA has no backup/recovery codes yet.
- Rate-limit counters are in-memory (per process); use a shared store (e.g. Redis) if you run multiple instances.
- Registration of an existing email returns a generic error, which is a deliberate trade-off (account enumeration is still possible via timing/side channels without email verification).
