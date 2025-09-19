# Implementation Tasks Plan — Production-Ready Auth + Sessions (Netlify + MongoDB + Resend)

This plan translates the approved design and requirements into concrete, dependency-ordered tasks for implementation and delivery.

## At-a-glance checklist

- Establish backend foundations (Mongo client, schemas, validation, auth/verification, rate limiting)
- Implement core API endpoints (auth, sessions) with security, logging, and size limits
- Wire frontend adapters and UI to new APIs; add verify and account management flows
- Enforce non-functional requirements (security headers, CORS, monitoring, backups)
- Add automated tests (unit, integration, E2E) and quality gates
- Integrate CodeRabbit reviews into each implementation step

## Task List Summary

| Task ID | Title | Expected Outcome |
|---|---|---|
| 1 | Clarify production domains and CORS | Cookie domain/CORS allowlist agreed and documented |
| 2 | Confirm Netlify adapter and payload limits | Chosen body size limits and adapter constraints documented |
| 3 | Decide rawReport compression at rest | Compression policy finalized and documented |
| 4 | Define password policy | Validated password rules for input validation and UI |
| 5 | Approve email sender/templates | Resend sender + templates approved |
| 6 | Confirm unverified-login policy | Policy finalized (allow login; restrict session endpoints) |
| 7 | Finalize migration plan for local sessions | UX copy and batch limits agreed |
| 8 | Backend foundation: Mongo client + collections | Serverless-safe Mongo client cache; typed getters |
| 9 | Validation schemas (zod) | Shared schemas/types for requests and pagination |
| 10 | Auth service (hash/JWT/refresh lifecycle) | Working crypto, JWT, refresh rotate/revoke logic |
| 11 | Email + verification services | Verification token lifecycle + Resend wrappers |
| 12 | Middleware utilities | withAuth, withVerifiedUser, withValidation, withCors, withError |
| 13 | Rate limiting middleware | IP/email rate limits with backoff; docs for Redis upgrade |
| 14 | Health endpoint upgrade | DB ping + uptime + memory in /api/health |
| 15 | Auth API: signup | Create user, send verification email |
| 16 | Auth API: verify-email | Verify token and mark user verified |
| 17 | Auth API: login | Return access token and set refresh cookie |
| 18 | Auth API: refresh | Rotate refresh and return new access token |
| 19 | Auth API: logout | Revoke refresh and clear cookie |
| 20 | Auth API: resend-verification | Send new verification email (rate-limited) |
| 21 | Sessions API: start | Create session stub and return sessionId |
| 22 | Sessions API: finish | Validate/report, enforce size, persist, compute summary |
| 23 | Sessions API: list | Paginated session list for current user |
| 24 | Sessions API: detail | Fetch single session (owner/admin) |
| 25 | Data model: indexes & TTL | Unique email; sessions TTL 90 days created |
| 26 | Frontend client adapters | apiClient, useAuth hook w/ refresh handling |
| 27 | Frontend UI changes | Verify page, auth modals, session list wiring |
| 28 | Migration UI for local sessions | Optional upload of local sessions to server |
| 29 | Security headers & CORS | HSTS, X-Frame-Options, CSP, CORS allowlist |
| 30 | Logging/Audit & Sentry hook | Structured logs + audit logs; Sentry hook points |
| 31 | Unit tests (services) | auth, verification, validation, rateLimit |
| 32 | Integration tests (API) | signup->verify->login->refresh->logout; sessions flow |
| 33 | E2E smoke (Playwright/Cypress) | User flows verified in preview |
| 34 | Deployment & env setup | Netlify build, env vars, secrets doc |
| 35 | Backup/export operational script | Weekly export documented/scripted |
| 36 | Documentation updates | README and ops docs updated |
| 37 | Security scan & dependency audit | npm audit run; critical issues addressed |
| 38 | Uptime monitoring setup | UptimeRobot/healthchecks configured hitting /api/health |
| 39 | Account API: profile (GET/PUT) | Authenticated endpoints to read/update profile |
| 40 | Account API: password change | Endpoint to change password (requires old password) |
| 41 | Account API: delete account | Endpoint to delete account and user data |
| 42 | Frontend: account page updates | UI for profile edit, password change, delete |

## Detailed Tasks

### Task 1: Clarify production domains and CORS
- Description: Confirm production and staging domains for cookie Domain, SameSite behavior, and CORS allowlist. Update env variable `CORS_ALLOWED_ORIGINS` and document.
- Dependencies: None
- Estimated Effort: 0.5h
- Sub-tasks:
  - Decide canonical prod domain (e.g., rollmetric.com) and staging URL
  - Set cookie Domain policy and SameSite=Strict implications
  - Update env/config docs

### Task 2: Confirm Netlify adapter and payload limits
- Description: Confirm @netlify/plugin-nextjs version and Netlify function body size limits; set `/finish` size limit accordingly and note any streaming constraints.
- Dependencies: None
- Estimated Effort: 0.5h
- Sub-tasks:
  - Check Netlify current function payload limits for Next.js
  - Choose sizeLimit (e.g., 2mb) and document

### Task 3: Decide rawReport compression at rest
- Description: Choose whether to compress `rawReport` before store. If yes, define approach and add field marker; else store as-is.
- Dependencies: None
- Estimated Effort: 0.5h
- Sub-tasks:
  - Decide gzip at rest vs as-is; document trade-offs

### Task 4: Define password policy
- Description: Confirm minimum length and complexity rules to enforce via zod schemas and UI messages.
- Dependencies: None
- Estimated Effort: 0.5h
- Sub-tasks:
  - Minimum length (>=10 recommended) and optional complexity

### Task 5: Approve email sender/templates
- Description: Approve `EMAIL_FROM` and verification email template content/branding for Resend.
- Dependencies: None
- Estimated Effort: 1h
- Sub-tasks:
  - Define subject/body; include link with token

### Task 6: Confirm unverified-login policy
- Description: Finalize policy to allow login for unverified users but block session endpoints; align UI.
- Dependencies: None
- Estimated Effort: 0.25h

### Task 7: Finalize migration plan for local sessions
- Description: Decide cutoff date and max batch size for local session migration; confirm UX copy.
- Dependencies: None
- Estimated Effort: 0.5h

### Task 8: Backend foundation: Mongo client + collections
- Description: Implement `lib/server/db.ts` with global client cache and typed getters; configure connection options for serverless.
- Dependencies: 1, 2
- Estimated Effort: 3h
- Sub-tasks:
  - Global cached MongoClient; `getDb()`
  - `getCollections()` => users, sessions, auditLogs

### Task 9: Validation schemas (zod)
- Description: Create `lib/server/validation.ts` schemas for Signup, Login, StartSession, FinishSession, Pagination.
- Dependencies: 4
- Estimated Effort: 2h

### Task 10: Auth service (hash/JWT/refresh lifecycle)
- Description: Implement `lib/server/auth.ts` for password hashing (bcrypt), JWT sign/verify, refresh token issuance/rotation/revocation (store hashes).
- Dependencies: 8, 9
- Estimated Effort: 6h
- Sub-tasks:
  - `hashPassword`, `verifyPassword`
  - `signAccessToken`, `verifyAccessToken`
  - `issueRefreshToken`, `rotateRefreshToken`, `revokeRefreshToken`

### Task 11: Email + verification services
- Description: Implement `lib/server/email.ts` (Resend) and `lib/server/verification.ts` (create/verify tokens; single-use optional).
- Dependencies: 8, 9, 5
- Estimated Effort: 4h

### Task 12: Middleware utilities
- Description: Implement `withAuth`, `withVerifiedUser`, `withValidation`, `withCors`, `withError` wrappers.
- Dependencies: 9, 10, 1
- Estimated Effort: 4h

### Task 13: Rate limiting middleware
- Description: Implement `lib/server/rateLimit.ts` with in-memory counters per instance; document Redis upgrade path.
- Dependencies: 12
- Estimated Effort: 3h

### Task 14: Health endpoint upgrade
- Description: Enhance `/api/health` to include DB ping and memory; keep current fields.
- Dependencies: 8
- Estimated Effort: 1h

### Task 15: Auth API: signup
- Description: POST `/api/auth/signup` — create user, send verification email, standard response envelope; rate-limited.
- Dependencies: 9, 10, 11, 12, 13
- Estimated Effort: 3h

### Task 16: Auth API: verify-email
- Description: GET `/api/auth/verify-email?token=...` — verify token, set `emailVerified=true`.
- Dependencies: 11, 12
- Estimated Effort: 2h

### Task 17: Auth API: login
- Description: POST `/api/auth/login` — verify password, return access token and set refresh cookie per security flags.
- Dependencies: 9, 10, 12, 13, 6
- Estimated Effort: 3h

### Task 18: Auth API: refresh
- Description: POST `/api/auth/refresh` — rotate refresh token; handle reuse detection by revoking all tokens.
- Dependencies: 10, 12
- Estimated Effort: 3h

### Task 19: Auth API: logout
- Description: POST `/api/auth/logout` — revoke presented refresh token and clear cookie.
- Dependencies: 10, 12
- Estimated Effort: 1.5h

### Task 20: Auth API: resend-verification
- Description: POST `/api/auth/resend-verification` — send a new email for unverified accounts; rate-limited.
- Dependencies: 11, 12, 13
- Estimated Effort: 2h

### Task 21: Sessions API: start
- Description: POST `/api/sessions/start` — create session stub for authenticated, verified user; return `sessionId`.
- Dependencies: 8, 9, 12
- Estimated Effort: 2h

### Task 22: Sessions API: finish
- Description: POST `/api/sessions/[id]/finish` — enforce body size limit (from Task 2), validate payload, compute summary using `lib/metrics/report.ts`, persist.
- Dependencies: 8, 9, 12, 2, 3
- Estimated Effort: 5h
- Sub-tasks:
  - Next.js API route config `{ api: { bodyParser: { sizeLimit: '2mb' } } }`
  - Runtime Content-Length guard for 413
  - Optionally decompress gzip if chosen

### Task 23: Sessions API: list
- Description: GET `/api/sessions` — paginated list for current user with `hideLowQuality` filter.
- Dependencies: 8, 9, 12
- Estimated Effort: 2h

### Task 24: Sessions API: detail
- Description: GET `/api/sessions/[id]` — return full session JSON for owner/admin.
- Dependencies: 8, 12
- Estimated Effort: 2h

### Task 25: Data model: indexes & TTL
- Description: Ensure unique index on users.email, index on sessions.userId/createdAt, and TTL index for sessions.createdAt (90 days).
- Dependencies: 8
- Estimated Effort: 1.5h

### Task 26: Frontend client adapters
- Description: Implement `lib/client/apiClient.ts` and `useAuth` hook to manage in-memory access token and auto-refresh via cookie.
- Dependencies: 15–20, 18
- Estimated Effort: 4h

### Task 27: Frontend UI changes
- Description: Implement verify email route/page, integrate signup/login UI with server endpoints, update session list UI to use `/api/sessions`.
- Dependencies: 26, 21–24
- Estimated Effort: 6h

### Task 28: Migration UI for local sessions
- Description: Provide a one-time action to upload local session history to server in batches; show progress and success.
- Dependencies: 23, 24, 7
- Estimated Effort: 4h

### Task 29: Security headers & CORS
- Description: Configure CORS allowlist and add security headers (HSTS, X-Frame-Options, X-Content-Type-Options, CSP) per Next/Netlify guidance.
- Dependencies: 1, 12
- Estimated Effort: 3h

### Task 30: Logging/Audit & Sentry hook
- Description: Add audit logging for critical events; insert Sentry hook points (config from env).
- Dependencies: 8, 12
- Estimated Effort: 3h

### Task 31: Unit tests (services)
- Description: Tests for `auth.ts`, `verification.ts`, `validation.ts`, `rateLimit.ts` with Mongo mock or memory server.
- Dependencies: 9–13
- Estimated Effort: 6h

### Task 32: Integration tests (API)
- Description: API flow tests for auth and sessions; include refresh rotation reuse detection and 413 checks.
- Dependencies: 14–24, 25
- Estimated Effort: 8h

### Task 33: E2E smoke (Playwright/Cypress)
- Description: Signup -> verify -> login -> record session -> view history, plus unverified-user block check.
- Dependencies: 26–28
- Estimated Effort: 6h

### Task 34: Deployment & env setup
- Description: Verify Netlify build with Next plugin; set required env vars; document setup.
- Dependencies: 1, 2, 15–24 (core APIs complete for meaningful preview), 29
- Estimated Effort: 3h
- Sub-tasks:
  - Configure Netlify env: MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_BASE_URL, etc.
  - Ensure `netlify.toml` is aligned with plugin version

### Task 35: Backup/export operational script
- Description: Provide `mongodump` or export script and doc for weekly backups; note Atlas free tier limitations.
- Dependencies: 8, 25
- Estimated Effort: 3h

### Task 36: Documentation updates
- Description: Update README for install, env vars, API reference, and maintenance tasks.
- Dependencies: 14–35
- Estimated Effort: 4h

### Task 37: Security scan & dependency audit
- Description: Run `npm audit` and address critical/high vulnerabilities; add CI check. Optionally run static analysis.
- Dependencies: None
- Estimated Effort: 1.5h
- Sub-tasks:
  - Run `npm audit` and update or pin vulnerable packages
  - Document exceptions (if any) and remediation plan

### Task 38: Uptime monitoring setup
- Description: Configure UptimeRobot (or similar) to hit `/api/health` every 5 minutes; set alerts.
- Dependencies: 14, 34
- Estimated Effort: 0.5h

### Task 39: Account API: profile (GET/PUT)
- Description: Implement `/api/account/profile` GET/PUT for authenticated users to read/update `displayName` and preferences; validate inputs.
- Dependencies: 9, 10, 12
- Estimated Effort: 2.5h

### Task 40: Account API: password change
- Description: Implement `/api/account/password` POST — requires old password; updates `passwordHash` and revokes all refresh tokens.
- Dependencies: 9, 10, 12
- Estimated Effort: 2.5h

### Task 41: Account API: delete account
- Description: Implement `/api/account/delete` POST — deletes user and their sessions; requires re-auth confirmation step.
- Dependencies: 8, 10, 12
- Estimated Effort: 3h

### Task 42: Frontend: account page updates
- Description: Update `/account` page to support profile edit, password change, and delete account flows using new endpoints.
- Dependencies: 26, 39–41
- Estimated Effort: 4h


## Task Sequencing and Dependencies

- Critical Path: 1,2 → 8 → 9,10 → 11,12,13 → 15–20 → 21–24 → 25 → 26 → 27 → 32 → 34 → 36
- Parallelizable:
  - 3,4,5,6,7 can run in parallel and early.
  - 14 (health) can proceed after 8.
  - 29–30 (security/logging) can start after 12.
  - 31 (unit tests) can start once 9–13 exist and continue alongside.
  - 33 can begin once 26–28 are wired to a preview environment.
- Corrections:
  - Task 34 dependency line above contained a typo; actual dependencies are 1,2 and completion of core APIs (15–24) for a meaningful deploy.

- Additional sequencing:
  - Account management (39–41) can proceed after middleware/auth (9–12); frontend account UI (42) follows.
  - Security audit (37) can run anytime; repeat before release.
  - Uptime monitoring (38) after health (14) and deployment (34).


## Testing and QA Tasks

- Unit Tests (Task 31):
  - auth.ts: hashing, JWT claims, refresh issue/rotate/revoke, reuse detection
  - verification.ts: token create/verify, expiry
  - validation.ts: schema boundaries and error messages
  - rateLimit.ts: window behavior and backoff

- Integration Tests (Task 32):
  - Signup -> Verify -> Login -> Refresh (with rotate) -> Logout flow
  - Sessions: start -> finish -> list (pagination, hideLowQuality) -> detail; verify 413 on oversize payload
  - Health: DB status reachable
  - Account: profile GET/PUT, password change, delete account happy paths and common failures

- E2E (Task 33):
  - Happy path: signup + verify + login + record session + view history
  - Unverified behavior: login allowed, session endpoints blocked with helpful UI

- Quality Gates:
  - Typecheck, ESLint, unit/integration tests pass in CI
  - Minimal E2E smoke in preview


## Non-functional Requirements Coverage

- Performance:
  - Global Mongo client cache (Task 8)
  - Pagination defaults (Task 23)
  - Body size limits and guards (Task 22)

- Security:
  - Bcrypt (Task 10), JWT (Task 10), refresh cookies flags (Task 17)
  - CORS and headers (Task 29)
  - Input validation (Task 9), rate limiting (Task 13)
  - Secrets via env (Task 34)
  - Dependency scanning/audit (Task 37)

- Logging & Monitoring:
  - Health endpoint expanded (Task 14)
  - Audit logs and Sentry hooks (Task 30)

- Retention & Backups:
  - TTL index (Task 25)
  - Weekly export script (Task 35)


## Review and Feedback Points (CodeRabbit)

After each task or sub-task implementation:
1. Commit changes with a clear message.
2. From repo root, run: `coderabbit review --plain` for detailed feedback.
3. Apply suggestions; re-run with `--plain` or `--prompt-only` if needed.
4. Proceed only when major issues are resolved.

Recommended review checkpoints:
- After core services (Tasks 8–13)
- After auth endpoints (Tasks 15–20)
- After sessions endpoints (Tasks 21–24)
- After frontend integration (Tasks 26–28)
- Before deployment (Tasks 29–36)

Use `coderabbit --help` or `cr --help` for options.


## Milestones and Checkpoints

- Milestone A: Backend Foundation
  - Deliverables: Tasks 1–3, 8–10, 25, initial unit tests (31 partial)
- Milestone B: Auth & Verification
  - Deliverables: Tasks 4–7, 11–20, rate limiting (13), integration tests partial (32)
- Milestone C: Sessions & KPIs
  - Deliverables: Tasks 21–24, size limits (22), integration tests for sessions (32)
- Milestone D: Frontend & UX Integration
  - Deliverables: Tasks 26–28, E2E smoke (33)
- Milestone E: Security, Ops, Deployment
  - Deliverables: Tasks 14, 29–36


## Requirements Coverage Mapping

- Functional: Auth & Accounts — Tasks 15–20, 26–27, 31–33
- Functional: Session recording & history — Tasks 21–24, 22 body limits, 26–28, 31–33
- Admin/basic ops: Health — Task 14; Audit/Logs — Task 30; Basic admin endpoints are deferred per design (Phase 2)
- Non-functional & Security — Tasks 8–13, 25, 29–30, 34–35
- Data model — Tasks 8, 25
- UI/Frontend changes — Tasks 26–28
- Retention/backups/privacy — Tasks 25, 35
- Monitoring/logging/health — Tasks 14, 30
- Testing & QA — Tasks 31–33
- Deployment & env — Task 34
- Migration plan — Task 28 (+ Task 7 clarification)
 - Account management (profile/password/delete) — Tasks 39–42
 - Security audit & uptime monitoring — Tasks 37–38

All requirements from `requirements.md` and design elements in `design.md` are mapped to at least one task.


## Notes on Existing Code Reuse

- Reuse `lib/metrics/*` to build server-side summary in Task 22 (`report.ts`, `kpi.ts`) to ensure consistency.
- Current `pages/api/health.ts` exists — enhanced by Task 14.
- Current `pages/api/session-metrics.ts` is a stub — superseded by Tasks 21–24.
- Current client `components/authStore.ts` is demo-only and will be replaced by server-backed auth (Tasks 26–27) while preserving existing UI patterns.


## Open Clarifications (Tasks 1–7)

- Domains, Netlify payload limits, compression policy, password rules, email content, unverified-login behavior, and migration limits must be finalized before dependent tasks begin.


---

Are there any tasks you want to modify or reorder before we start implementation?
