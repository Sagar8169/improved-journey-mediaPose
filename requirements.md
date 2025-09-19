# Production-ready requirements —  (Netlify + MongoDB + Resend)


---

## 1) Constraints & goals

* Hosting: Netlify (free tier) with dedicated domain .
* Database: MongoDB (Atlas free tier).
* Email verification: Resend (free plan).
* Target load: \~50 random users over a 90-day window.
* Primary goals: persistent, secure authentication and per-user session history; email verification; safe defaults for production; ability to recover/backup 90-day session data.

---

## 2) High-level architecture

* Frontend: Next.js (existing code) built and deployed to Netlify.
* Backend: Next.js API routes (serverless functions) connecting to MongoDB Atlas. All stateful logic and persistence move from client memory to server.
* Auth: JWT access tokens + refresh token pattern; refresh stored as **httpOnly, Secure cookie**. Passwords hashed with bcrypt. Email verification via Resend link containing a signed token (or short code).
* Data retention: Session documents stored in MongoDB; TTL index or scheduled job enforces 90-day retention.
* Logging & monitoring: health endpoint + Sentry for error monitoring + simple request logging. Uptime monitoring (e.g., UptimeRobot).

---

## 3) Functional requirements (must-have)

### Authentication & accounts

* Server-side signup endpoint that:

  * accepts email, password, displayName (validate input);
  * hashes passwords with bcrypt (salt rounds >= 10);
  * creates user doc with `emailVerified: false`;
  * sends verification email (Resend) containing a short verification token (signed, expires e.g. 24h).
* Email verification endpoint:

  * verifies token, sets `emailVerified: true`, returns success.
  * support resending verification email.
* Login endpoint:

  * verifies password and `emailVerified` (optionally allow login but restrict features until verified — choose one; recommend: block critical features until verified).
  * returns short-lived JWT access token (exp 15m) and a long-lived refresh token stored as httpOnly cookie (exp e.g. 30 days).
* Refresh token endpoint:

  * issues new access token for valid refresh cookie.
  * supports revocation (store refresh token hashes in DB).
* Logout endpoint:

  * revokes refresh token and clears cookie.
* Account management endpoints:

  * GET/PUT profile (displayName, avatar, preferences).
  * Password change (requires old password).
  * Delete account (GDPR-friendly flow).

### Session recording & history (per-user)

* Start session endpoint: server registers session record stub (userId, startTs, metadata).
* End session endpoint: accepts finalized session metrics JSON produced by SessionTracker; server validates and persists to `sessions` collection.
* Retrieve session history endpoint: paginated, filterable by userId (must be enforced server-side).
* Session detail endpoint: returns full JSON for a session.
* Server-side compute or store KPIs from the report (allow future analytics).

### Admin / basic ops

* `/api/health` (existing) — expand to include DB connection status and uptime.
* Admin-only endpoint(s) for:

  * listing users (controlled by admin role).
  * purge or export sessions (for backups or compliance).
  * view system logs/metrics (or integrate with Sentry/Datadog).

---

## 4) Non-functional & security requirements

* All traffic served over HTTPS (Netlify automatic certs). Enforce `Strict-Transport-Security` header.
* Secrets in environment variables only; never check them into repo:

  * `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_BASE_URL`, etc.
* Password hashing: bcrypt with salt.
* Token security:

  * Access tokens: JWT signed by `JWT_SECRET`, short TTL.
  * Refresh tokens: stored hashed server-side, cookie flagged `HttpOnly`, `Secure`, `SameSite=Strict`.
* Input validation & sanitization (server-side): use a schema validator (zod or Joi).
* Rate limiting: per-IP and per-account endpoints (e.g., login attempts) – lightweight in-memory for free tier or middleware using serverless function memory; add lockout after repeated failures.
* CORS: allow only `https://rollmetric.com` and trusted dev origins.
* CSP, X-Frame-Options, XSS protections (helmet headers/checks).
* No plaintext credentials anywhere.
* Dependency scanning: run `npm audit` and fix critical issues before deployment.
* Session isolation: each user sees only their own session history.

---

## 5) Data model (MongoDB collections)

### `users`

* `_id: ObjectId`
* `email: string` (unique, indexed)
* `passwordHash: string`
* `displayName: string`
* `emailVerified: boolean`
* `roles: [ "user" | "admin" ]`
* `createdAt`, `updatedAt`
* `refreshTokens: [{ tokenHash, createdAt, expiresAt, deviceInfo }]` (for revocation)
* indexes: `{ email: 1 }`

### `sessions` (per-session metrics)

* `_id: ObjectId`
* `userId: ObjectId` (indexed)
* `startAt: ISODate`
* `endAt: ISODate`
* `durationMs: number`
* `summary: { /* existing computed KPIs */ }`
* `rawReport: object` (the JSON produced by SessionTracker)
* `qualityFlag: enum` (good|low|discard)
* `deviceInfo`, `mediaType`, `drillType`, etc.
* `createdAt`, `updatedAt`
* indexes: `{ userId: 1, createdAt: -1 }`, and a TTL index on `createdAt` to auto-delete after 90 days (configure TTL seconds = 90 days).

### `auditLogs` (optional)

* `_id, userId, action, ip, userAgent, createdAt`

---

## 6) API endpoints (sample contract)

> All responses: `{ success: boolean, data?: any, error?: { code, message } }`

### Auth & user

* `POST /api/auth/signup`
  body: `{ email, password, displayName }`
  returns: 200 `{ success:true }` (sends verification email)
* `POST /api/auth/verify-email`
  body: `{ token }` or `GET /api/auth/verify-email?token=...`
* `POST /api/auth/login`
  body: `{ email, password }`
  returns: `{ accessToken }` and sets refresh cookie.
* `POST /api/auth/refresh`
  reads refresh cookie — returns new access token.
* `POST /api/auth/logout`
  revokes refresh token cookie.
* `POST /api/auth/resend-verification`
  body: `{ email }`

### Session metrics

* `POST /api/sessions/start`
  body: `{ drillType, deviceInfo, metadata }`
  returns session stub `{ sessionId }`
* `POST /api/sessions/:id/finish`
  body: `{ finalizedReport (SessionTracker JSON), endAt }`
  server validates and persists.
* `GET /api/sessions`
  query: `?page=1&limit=20&hideLowQuality=true` (authenticated) — returns paginated sessions for current user.
* `GET /api/sessions/:id` — returns full session report (only owner or admin).
* `GET /api/health` — server + DB health.

---

## 7) UI / Frontend changes

* Replace purely client-side auth flow with server-backed modal:

  * Signup modal posts to `/api/auth/signup`.
  * After signup, show “Check your inbox” screen. Block certain actions until `emailVerified`.
  * Login modal calls `/api/auth/login`, store `accessToken` in memory (or in React state) and let refresh cookie handle long-lived auth.
* Add `/verify-email?token=...` route in next app for handling email link clicks (calls verify endpoint and redirects to success page).
* Update `_app.tsx` session hydration:

  * Remove insecure localStorage of token; rely on access token and refresh via cookie flow.
  * Show “not verified” badge on profile until verified.
* Session history:

  * Query `/api/sessions` and show only current user’s sessions.
  * Preserve existing UI (expandable rows, filters) but load data from server.
* Account page:

  * Profile update, password change, delete account UI.
* Admin UI (optional): basic page behind admin role.

---

## 8) Retention, backups & privacy

* Retention: use MongoDB TTL index on `createdAt` of `sessions` to automatically remove documents after 90 days. **Acceptance**: no session older than 90 days should remain.
* Backup: schedule periodic (e.g., weekly) JSON export of `users` (except passwords) and `sessions` to storage (e.g., zipped JSON in S3 or local machine). On the free tier of Atlas, automated backup may be limited — implement an export script using `mongodump` or export via a scheduled serverless job and store dump elsewhere.
* Privacy: redact or avoid storing PII beyond email & displayName. Provide delete account and data export (user-requested).

---

## 9) Monitoring, logging & health

* Expand `/api/health` to include:

  * DB ping, server uptime, number of active connections, memory.
* Error reporting: integrate Sentry (or similar).
* Uptime: configure UptimeRobot to hit `/api/health` every 5 minutes.
* Basic request logging to Netlify logs; for critical errors, send to Sentry.

---

## 10) Testing & QA

* Unit tests for backend logic (auth, token handling, session validation).
* Integration tests for API endpoints (signup/login/verify/refresh/start/finish).
* E2E tests (Cypress or Playwright) for key user flows:

  * signup + verify + login + record session + view session history.
* Security tests: run `npm audit`, static code scanning, test CORS, cookie flags, password rules.
* Load test: for 50 users this is minimal — smoke test concurrency for a handful of concurrent session uploads.

---

## 11) Deployment & environment variables (Netlify specifics)

* Build command: `npm run build` (Next.js).
* Publish directory: Next.js default or `.next` depending on builder. Use Netlify Next plugin or adapter if necessary. (Netlify supports Next.js builds — configure according to Netlify docs.)
* Environment variables to set in Netlify:

  * `MONGODB_URI` — MongoDB Atlas connection string (use a user with restricted privileges).
  * `JWT_SECRET` — secure random secret for access tokens.
  * `JWT_REFRESH_SECRET` — separate secret for refresh tokens.
  * `RESEND_API_KEY` — API key for Resend.
  * `NEXT_PUBLIC_BASE_URL` — `https://rollmetric.com`
  * `NODE_ENV=production`
* Netlify Functions: all Next.js API routes will become serverless functions. Ensure connection pooling to MongoDB is done in a serverless-friendly way (reuse global client to avoid connection storms).

  * Implementation note: use a cached Mongo client in global scope to avoid creating new connections per function call.

---

## 12) Security & operational checklist (acceptance criteria)

Before declaring “production-ready” ensure **all** below pass:

* [ ] Passwords hashed with bcrypt; no plaintext anywhere.
* [ ] Email verification implemented and enforced for intended flows.
* [ ] Tokens: access & refresh implemented, refresh rotated and revocable.
* [ ] Refresh tokens stored only as httpOnly Secure cookies.
* [ ] Per-user session history persisted to MongoDB; UI only shows owner sessions.
* [ ] TTL retention of session documents (90 days) in place.
* [ ] Environment variables configured (no secrets in repo).
* [ ] CORS, CSP, helmet headers configured.
* [ ] Rate limiting on auth endpoints.
* [ ] Input validation server-side for all endpoints.
* [ ] Health endpoint shows DB status; Sentry integrated for errors.
* [ ] Backups/exports scheduled at least weekly.
* [ ] Unit + integration tests covering core flows pass.
* [ ] Netlify deploy pipeline set up and tested.
* [ ] Documentation updated for install, env vars, and maintenance tasks.

---

## 13) Migration plan (from client-only demo to server-backed)

1. Create MongoDB collections & indexes. Seed minimal admin/demo user server-side (hashed).
2. Implement server-side auth endpoints (signup/login/refresh/verify). Do NOT remove demo client user yet.
3. Update frontend login/signup to call server. On successful login, map client session to server session (if any local session data exists, POST it to `/api/sessions/:id/finish`).
4. Migrate in-memory session history: Provide a one-time UI button for demo users: **"Migrate local sessions to account"** which POSTs local session JSON to server; after migration show success and remove local copies.
5. Once migration verified, remove in-memory-only user registry.

---

## 14) Tasks & priority roadmap (minimum viable production)

**MVP (must do before public use)**

1. Implement user collection, signup/login endpoints, bcrypt and JWT + refresh cookie flow (server).
2. Add email verification (Resend) + verify endpoint + resend.
3. Persist sessions to `sessions` collection, add start/finish endpoints, ensure per-user scoping.
4. Update frontend flows to use server endpoints and cookies.
5. Add TTL index for sessions (90 days).
6. Configure environment variables in Netlify & test deploy.
7. Implement input validation, rate limiting on auth, and password rules.
8. Add health endpoint DB checks + Sentry integration.
9. Add tests for signup/login/verify/session flow.

**Phase 2 (nice-to-have before scale)**

* Admin dashboards, backup automation, better analytics dashboards, fine-grained role management, export endpoint, play/record session dedupe, more robust monitoring.

---

## 15) Example sample payloads (quick reference)

**Signup**

```
POST /api/auth/signup
{ "email": "alice@example.com", "password": "Secur3Pass!", "displayName": "Alice" }
```

**Verify**

```
GET /api/auth/verify-email?token=<signed-token>
```

**Finish session**

```
POST /api/sessions/:id/finish
{
  "finalizedReport": { /* SessionTracker JSON object */ },
  "endAt": "2025-09-19T10:00:00Z"
}
```

---

## 16) Additional operational notes & recommendations

* Use a dedicated MongoDB user with least privilege for the app (no admin privileges).
* For Resend, verify domain sending policy, and ensure verification emails come from a friendly address like `no-reply@rollmetric.com`.
* Keep JWT secrets rotated periodically; store them in secret manager if possible.
* For Netlify free tier, watch function cold starts and connection reuse; use global client caching.
* For quick debugging, keep a separate staging deployment before pushing to production domain.

---

If you want, I can:

* Generate the MongoDB schema + index creation scripts.
* Draft the Next.js API route handler templates (signup/login/verify/refresh/logout and sessions start/finish).
* Create example Postman collection or cURL examples for all endpoints.
* Produce the frontend changes (auth modal + verify page + session list hooks) in code.


