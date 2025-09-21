- Author API-first design covering auth, sessions, and persistence
- Specify components, interfaces, and contracts with request/response shapes
- Define MongoDB schemas, indexes, and TTL strategy
- Detail security model: JWT + refresh cookies, rate limiting, validation
- Add architecture and data model diagrams (Mermaid)
- Outline testing strategy and quality gates; note trade-offs and open questions

## Overview

Purpose: Evolve the current demo (client-only auth and in-memory session history) into a production-ready, secure, and persistent system deployed on Netlify, backed by MongoDB Atlas, and using Resend for email verification.

Scope (included):
- Server-backed authentication with hashed passwords, JWT access tokens, and httpOnly Secure refresh cookies
- Email verification flow (Resend) with signed, expiring tokens and resend capability
- Persistence for per-user session metrics with 90-day retention (MongoDB TTL)
- API endpoints for auth, session start/finish, session retrieval, health, and basic admin (RBAC hooks)
- Frontend integration updates to replace local in-memory state with server APIs while keeping the existing UI/UX patterns
- Security hardening: input validation, rate limiting, CORS, headers, error handling, logging hooks

Out of scope (for this phase):
- Advanced admin dashboards, automated backups beyond documented scripts, detailed analytics pipelines, and full observability stack (Sentry wiring stubbed, can be enabled later)

Goals:
- Persistent, secure auth and session data for ~50 users over 90 days
- Clear contracts and component responsibilities for straightforward implementation
- Safe defaults suitable for Netlify serverless and Next.js


## Architecture

High-level: Next.js app deployed to Netlify. Pages render frontend; API routes execute as Netlify Functions. MongoDB Atlas stores users and session records. Resend sends verification emails. JWT access token is short-lived; refresh token is long-lived in httpOnly Secure cookie. Session metrics are produced client-side, aggregated into a SessionReport, validated, and persisted server-side (raw events are not uploaded or stored).

```mermaid
flowchart TD
  browser[Browser (Next.js Frontend)]
  subgraph Netlify
    FE[Next.js Pages + Components]
    API[Next.js API Routes (Serverless)]
  end
  DB[(MongoDB Atlas)]
  Email[Resend]
  Log[(Netlify Logs/Sentry)]

  browser <--> FE
  FE -->|fetch| API
  API -->|connection pool| DB
  API -->|send verification| Email
  API -->|structured logs| Log

  subgraph Security
    JWT[JWT Access Token (15m)]
    Cookie[Refresh Token Cookie (30d, httpOnly, Secure, SameSite=Strict)]
  end
  FE <-->|Bearer JWT| JWT
  browser <-->|Set-Cookie| Cookie
```

Key flows:
- Signup: client -> /api/auth/signup -> user created with emailVerified=false, verification email sent.
- Verify: user clicks link -> /api/auth/verify-email?token=... -> marks emailVerified=true.
- Login: client -> /api/auth/login -> access token returned, refresh cookie set.
- Refresh: client -> /api/auth/refresh -> new access token if valid refresh cookie.
- Sessions: client -> /api/sessions/start -> id -> /api/sessions/:id/finish with aggregated payload { schemaVersion: 2, report, summary } -> persisted (report + summary). Raw metrics are never uploaded or stored. Legacy v1 payloads are accepted for backward compatibility.

Serverless MongoDB pooling:
- Use a globally cached MongoClient to avoid opening a new connection per invocation (critical for Netlify cold starts and Atlas free-tier limits). Pattern:
  - In `lib/server/db.ts`, keep `let client: MongoClient | null = globalThis.__MONGO__ || null;` and assign back to `globalThis.__MONGO__` after connecting.
  - Reuse the same client across function invocations where possible; only call `client.connect()` if not connected.
  - Expose `getDb()` and typed collection getters.


## Components & Interfaces

Modules and responsibilities (TypeScript-centric):

- API Route Handlers (Next.js under `pages/api/...`)
  - /api/health: GET — reports uptime, memory, Mongo ping
  - /api/auth/signup: POST — create user, send verification email
  - /api/auth/verify-email: GET — verify token, mark verified
  - /api/auth/login: POST — issue access + refresh
  - /api/auth/refresh: POST — rotate/issue new access token
  - /api/auth/logout: POST — revoke refresh token
  - /api/auth/resend-verification: POST — resend verification email
  - /api/sessions/start: POST — register session stub, return sessionId
  - /api/sessions/[id]/finish: POST — validate and persist report
  - /api/sessions: GET — list user sessions (paginated, filters)
  - /api/sessions/[id]: GET — get session detail (owner/admin)

- Services (`lib/server/*`)
  - db.ts: Mongo client cache and helpers
    - getDb(): Promise<Db>
    - getCollections(): { users, sessions, auditLogs }
    - Implementation notes (serverless-safe):
      - Cache client in globalThis to survive warm invocations and limit new connections.
      - Lazily connect on first call; no disconnect on function end.
      - Set `serverSelectionTimeoutMS` moderately (e.g., 5000) and enable retryable writes.
  - auth.ts: crypto and token lifecycle
    - hashPassword(pw: string): Promise<string>
    - verifyPassword(pw: string, hash: string): Promise<boolean>
    - signAccessToken(payload: { sub: string; email: string; roles: string[] }, opts): string
    - verifyAccessToken(token: string): JwtPayload
    - issueRefreshToken(userId: ObjectId, deviceInfo?): Promise<{ token: string; hash: string; cookie: string }>
      - Generate cryptographically strong random token (>=256-bit), store only SHA-256 hash (base64url) + createdAt + expiresAt + deviceInfo in user document.
      - Return plaintext token once; set it in httpOnly Secure cookie.
    - rotateRefreshToken(oldToken: string, userId: ObjectId): Promise<{ token: string; cookie: string }>
      - Look up user, compute SHA-256 hash of presented token, find matching active token; if found, revoke it and issue a new token (one-time rotation).
      - If hash not found but user matches, treat as possible token reuse attack: revoke all refresh tokens for that user and require re-login.
    - revokeRefreshToken(token: string, userId: ObjectId): Promise<void>
      - Mark token entry as revoked or remove it; clear cookie on client.
  - email.ts (Resend)
    - sendVerificationEmail(to: string, token: string): Promise<void>
    - sendSecurityAlert(to: string, type: 'login' | 'password-change'): Promise<void>
  - verification.ts
    - createEmailToken(userId: ObjectId): { token: string; expiresAt: Date }
      - Use signed tokens with expiry (24h). Options: short-lived JWT (HS256 with dedicated EMAIL_TOKEN_SECRET) or HMAC-signed random token stored hashed for single-use.
      - Include jti and userId; optionally persist token hash and expiry to enforce single-use.
    - verifyEmailToken(token: string): Promise<{ userId: ObjectId }>
      - Verify signature and expiry; if using stored hash, match and invalidate on success.
  - validation.ts (zod schemas)
    - SignupSchema, LoginSchema, StartSessionSchema, FinishSessionSchema, PaginationSchema
  - rateLimit.ts
    - withRateLimit(handler, keyFn, limit, windowMs)
      - Provide combined IP- and account/email-based limits for auth endpoints (e.g., 5 attempts per 15 minutes), exponential backoff on repeated failures.
      - Start with in-memory counters per function instance; document upgrade path to durable store (e.g., Upstash Redis via REDIS_URL) if needed.
  - kpi.ts/report.ts bridge
    - Option A: reuse existing `lib/metrics/*` server-side to recompute KPIs
    - Option B: validate client report shape and persist as-is; compute summary server-side for consistency

- Middleware utilities
  - withAuth(handler, requiredRole?): validates Bearer token (access), injects req.user
  - withVerifiedUser(handler): blocks critical endpoints if user.emailVerified=false
  - withValidation(schema): parses and validates body/query, returns 400 on failure
  - withCors(handler): restricts origins to allowed list
  - withError(handler): normalize error handling to { success, error }

- Frontend adapters (`lib/client/*`)
  - apiClient.ts: fetch wrappers that include Authorization header when present
  - useAuth hook: stores access token in memory (React state), refresh via cookie as needed
  - migration utils: optional upload of local session history to server

Interfaces (selected):

- Standard API Response
  - type ApiResponse<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } }

- Auth Payloads
  - SignupRequest: { email: string; password: string; displayName: string }
  - LoginRequest: { email: string; password: string }
  - LoginResponse: { accessToken: string; user: { id: string; email: string; displayName: string; emailVerified: boolean; roles: string[] } }

- Session Payloads
  - StartSessionRequest: { drillType?: string; deviceInfo?: any; metadata?: Record<string, any>; startAt?: string }
  - StartSessionResponse: { sessionId: string }
  - FinishSessionRequest (v2): { schemaVersion: 2; report: SessionReport; summary: MinimalSummary; endAt: string }
    - Notes: Raw event streams are not accepted in v2; only aggregated SessionReport is sent. Legacy clients may still POST a v1 raw payload which is stored under rawReport (optional) for backward compatibility.
  - SessionListQuery: { page?: number; limit?: number; hideLowQuality?: boolean }
  - Limits: `/api/sessions/[id]/finish` enforces strict body size (default 2MB). Requests exceeding limit return 413 Payload Too Large.


## Data Models

MongoDB Collections and schemas.

- users
  - _id: ObjectId
  - email: string (unique, indexed)
  - passwordHash: string
  - displayName: string
  - emailVerified: boolean
  - roles: string[] (default ["user"]) 
  - refreshTokens: Array<{ tokenHash: string; createdAt: Date; expiresAt: Date; deviceInfo?: any }>
  - createdAt: Date
  - updatedAt: Date
  - Indexes: { email: 1 } unique, { 'refreshTokens.expiresAt': 1 }

- sessions
  - _id: ObjectId
  - userId: ObjectId (indexed)
  - startAt: Date
  - endAt: Date
  - durationMs: number
  - report: object (canonical aggregated SessionReport)
  - summary: { /* selected KPIs derived from report */ }
  - rawReport?: object (legacy v1 SessionTracker JSON; optional for backward compatibility)
  - qualityFlag: 'good' | 'low' | 'discard'
  - deviceInfo?: any
  - mediaType?: string
  - drillType?: string
  - createdAt: Date
  - updatedAt: Date
  - Indexes: { userId: 1, createdAt: -1 }, TTL on createdAt (90 days)

- auditLogs (optional)
  - _id: ObjectId
  - userId?: ObjectId
  - action: string
  - ip?: string
  - userAgent?: string
  - createdAt: Date

Schema TS types (for implementation):
- See above fields; prefer zod schemas for validation and TypeScript types inferred from zod.

Data model diagram:
```mermaid
classDiagram
  class User {
    ObjectId _id
    string email
    string passwordHash
    string displayName
    boolean emailVerified
    string[] roles
    RefreshToken[] refreshTokens
    Date createdAt
    Date updatedAt
  }
  class RefreshToken {
    string tokenHash
    Date createdAt
    Date expiresAt
    any deviceInfo
  }
  class Session {
    ObjectId _id
    ObjectId userId
    Date startAt
    Date endAt
    number durationMs
    object report
    object summary
    %% rawReport is optional legacy (v1 compatibility only)
    object rawReport
    string qualityFlag
    any deviceInfo
    string mediaType
    string drillType
    Date createdAt
    Date updatedAt
  }
  class AuditLog {
    ObjectId _id
    ObjectId userId
    string action
    string ip
    string userAgent
    Date createdAt
  }

  User "1" --> "*" Session : owns
  User "1" --> "*" RefreshToken : has
  User "1" --> "*" AuditLog : creates
```

Indexes and retention:
- TTL index on `sessions.createdAt` with expireAfterSeconds = 90*24*60*60
- Unique index on `users.email`
- Consider sparse index on `auditLogs.userId`


## Error Handling & Edge Cases

Standard error response: { success:false, error:{ code, message } }

Validation errors (400):
- Invalid email/password format, weak password
- Invalid session payload (missing report/schemaVersion, malformed endAt)

Auth errors (401/403):
- 401: Invalid/missing access token; expired access token
- 403: Email not verified for endpoints requiring verification (e.g., session start/finish)
- 403: User not owner of requested session; admin required

Conflict (409):
- Email already registered
- Session finish with mismatched id/user

Rate limiting (429):
- Excessive login/signup attempts per IP/email window

Server errors (500):
- DB connectivity issues, Resend failures (after retries)

Payload Too Large (413):
- `/api/sessions/[id]/finish` rejects bodies beyond configured limit (e.g., 2MB). Implement using Next.js API route config `{ api: { bodyParser: { sizeLimit: '2mb' } } }` and a runtime Content-Length/stream guard. Note Netlify function payload limits also apply—confirm in environment and set limit conservatively.

Edge cases:
- Resend outage: queue retry or show message to retry later; allow resend with backoff
- Token replay: refresh token rotated and old token revoked; use token jti hashing
- Stolen refresh cookie: on detection, revoke all refresh tokens for user and require re-login
- Partial session uploads: if finish fails, allow retry idempotently (upsert on sessionId)
- Large finish payload: enforce payload size limit; consider compression if the aggregated report grows in future
  - If compression is used client-side, indicate `Content-Encoding: gzip` and handle decompression server-side before validation.

Logging:
- Log security-sensitive events to auditLogs (login, failed login, password change, verification)
- Include requestId/correlationId in logs (where feasible)
- Avoid logging PII and secrets

Retries:
- Email send: simple retry (1-2 attempts) with exponential backoff
- DB transient errors: one retry where safe


## Testing Strategy

- Unit tests
  - auth.ts: password hashing/verification, JWT signing/verification, refresh lifecycle
  - verification.ts: token create/verify roundtrip and expiry
  - validation.ts: schema validations and boundary conditions
  - rateLimit.ts: window/limit behavior

- Integration tests (API)
  - Signup -> Verify -> Login -> Refresh -> Logout flow
    - Include refresh rotation: ensure old refresh token cannot be reused; detect and revoke all on reuse attempt.
  - Sessions: start -> finish (v2 aggregated payload) -> list (pagination, hideLowQuality) -> get detail (ownership enforced)
    - Verify 413 on oversize payload to finish endpoint.
  - Health endpoint with DB status

- E2E (Playwright or Cypress)
  - User signup -> email verification link (mocked) -> login -> record session -> view history
  - Unverified user experience: cannot start/finish sessions

- Mocks & test infra
  - Mock Resend API client
  - Use MongoDB Memory Server or a test DB namespace
  - Inject env via .env.test
  - Optionally mock Redis/Upstash adapter if upgrading rate limiter.

- Quality gates
  - Typecheck and ESLint pass
  - All unit + integration tests pass in CI
  - Minimal E2E smoke passes against preview deploy


## Performance, Security, Maintainability Considerations

Performance:
- Mongo client reuse via global cache to avoid connection storms on serverless cold starts
- Keep access token small; avoid oversized JWT claims
- Paginate session history; default limit 20
- Enforce payload size limits on finish endpoint (e.g., 1–2 MB)

Security:
- Bcrypt salt rounds >= 10
- Access token: HS256, 15m exp; claims: sub, email, roles, iat, exp
- Refresh token: random 256-bit, store hashed (SHA-256) with salt; cookie flags: HttpOnly, Secure, SameSite=Strict, Path=/, Max-Age=30d; domain = site domain
  - Rotation and reuse detection: on refresh, revoke the presenting token and issue a new one; if an already-rotated token is presented later, flag reuse and revoke all tokens for the user (force re-auth).
- CORS: restrict to production domain and trusted dev origins
- Headers: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, CSP defaults (script-src self plus Next CSP guidance)
- Input validation with zod; sanitize strings
- Rate limiting on auth endpoints; temporary lockout after repeated failures
- No secrets in repo; use Netlify env vars

Maintainability:
- Clear separation: API handlers -> services -> utilities
- Shared validation/types; reuse existing `lib/metrics` server-side where possible
- Minimal external deps; wrap external services (Resend, DB) behind small interfaces
- Consistent response envelope and error codes

Environment & body size limits:
- Set Next.js API `bodyParser.sizeLimit` per route where large payloads are expected; prefer 2mb default for `/finish`.
- Add an explicit runtime guard to return 413 before heavy parsing when `Content-Length` exceeds the limit.


## Design Decisions & Trade-offs

- Token model: short-lived JWT + refresh cookie
  - Trade-off: More moving parts vs simple sessions; chosen for SPA + serverless compatibility
- Refresh token storage hashed in DB
  - Trade-off: Slight complexity; improves security if DB leaks
- Allow login pre-verification but restrict critical features (sessions)
  - Rationale: Enables profile access and resend flow; enforces verification before core usage
- Serverless on Netlify with Mongo Atlas
  - Trade-off: Cold starts and connection reuse constraints; mitigated with global cached client
- Rate limiting in-memory per function instance
  - Trade-off: Not globally consistent; acceptable for low traffic, documented upgrade path to durable store (e.g., Upstash Redis) if needed
- Reuse client metrics vs recompute server-side
  - Choice: Validate shape and compute summary server-side using existing `lib/metrics/*` to ensure consistency and integrity


## Environment Variables (.env)

Required (production):
- MONGODB_URI: MongoDB Atlas connection string (SRV) with least-privilege user
- MONGODB_DB_NAME: Database name (e.g., rollmetric)
- JWT_SECRET: Secret for signing access tokens (HS256); long, random
- JWT_REFRESH_SECRET: Secret for deriving cookie signature or HMAC (if used); distinct from JWT_SECRET
- RESEND_API_KEY: Resend API key
- EMAIL_FROM: Email sender address (e.g., no-reply@rollmetric.com)
- NEXT_PUBLIC_BASE_URL: Public site URL (e.g., https://rollmetric.com)
- CORS_ALLOWED_ORIGINS: Comma-separated allowlist (e.g., https://rollmetric.com,https://staging.rollmetric.com)
- NODE_ENV: production

Security & cookies:
- COOKIE_NAME_REFRESH: Name of refresh cookie (default: rm_refresh)
- SECURE_COOKIES: true | false (true in production)
- ACCESS_TOKEN_TTL: e.g., 15m
- REFRESH_TOKEN_TTL: e.g., 30d
- EMAIL_TOKEN_TTL: e.g., 24h

Operational/optional:
- SENTRY_DSN: For error monitoring (optional)
- REDIS_URL: If upgrading rate limiting to Redis/Upstash (optional)

Example .env (do not commit real secrets):
- MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
- MONGODB_DB_NAME=rollmetric
- JWT_SECRET=change-me-to-a-long-random-string
- JWT_REFRESH_SECRET=another-long-random-string
- RESEND_API_KEY=re_XXXXXXXXXXXXXXXXXXXXXXXX
- EMAIL_FROM=no-reply@rollmetric.com
- NEXT_PUBLIC_BASE_URL=https://rollmetric.com
- CORS_ALLOWED_ORIGINS=https://rollmetric.com,https://staging.rollmetric.com
- NODE_ENV=production
- COOKIE_NAME_REFRESH=rm_refresh
- SECURE_COOKIES=true
- ACCESS_TOKEN_TTL=15m
- REFRESH_TOKEN_TTL=30d
- EMAIL_TOKEN_TTL=24h
- SENTRY_DSN=
- REDIS_URL=


## Unaddressed Requirements

- Automated weekly backups/exports: documented as operational task; no built-in scheduler in this phase
- Full admin endpoints/UI beyond scaffolding: left for Phase 2
- Comprehensive Sentry wiring and dashboards: hooks planned; full integration to be completed post-MVP
- Advanced analytics and role management beyond user/admin: Phase 2


## Open Questions & Clarifications Needed

- Exact production domain(s) to set cookie Domain and CORS allowlist (e.g., rollmetric.com, staging)
- Netlify Next adapter version and function payload size limits to size finish payload cap
- Whether to compress the aggregated report (gzip) at rest or rely on Mongo storage as-is
- Password policy requirements (length/complexity) beyond defaults
- Email template/design and sender identity (from address) for Resend
- Should unverified users be able to login at all, or only after verification? (Current design: allow login but block session endpoints)
- Migration of existing local sessions: which cutoff and UX wording; maximum upload batch size


