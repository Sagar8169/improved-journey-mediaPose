# System Information Flows

The table below maps all notable information movements in the app: what is transferred, the originating component/service, and the destination where it is used or stored.

| Information | Source | Destination |
|---|---|---|
| Pose landmarks (per frame) and camera frames | Browser camera via `navigator.mediaDevices` and MediaPipe in `pages/drill.tsx` | On-canvas drawing in `drill.tsx` (no server transfer) and derived angles/symmetry calculations |
| Derived joint angles (elbow/knee/shoulder/hip/torso) per frame | `pages/drill.tsx` (angle math) | Live overlay debug text; `usePoseStore.updateFrameMetrics()` to feed `SessionTracker` |
| Symmetry deltas (shoulder/knee) per frame | `pages/drill.tsx` | `usePoseStore.considerSymmetry()` for "best" symmetry, and `SessionTracker.updateFrame()` |
| Bounding box area %, average landmark visibility per frame | `pages/drill.tsx` | `SessionTracker.updateFrame()` for detectionRate, intensity, visibility stats |
| Posture issue events (leaning) | `pages/drill.tsx` | `usePoseStore.recordPostureIssue()` and `SessionTracker.updateFrame({ postureIssue: true })` |
| Rep increment events and mode (curl/squat/pushup/jack) | `pages/drill.tsx` | `usePoseStore.addReps()` and `SessionTracker.updateFrame({ repMode, repIncrement: true })` |
| FPS per frame | `pages/drill.tsx` | `SessionTracker.updateFrame({ fps })` to accumulate fps stats |
| Start session intent + device info | `pages/drill.tsx` via `lib/apiClient.sessions.start()` | API route `POST /api/sessions/start` → MongoDB `sessions` insert (stub record with userId/startAt/deviceInfo) |
| Local session tracker start (user, modelComplexity, mirror) | `usePoseStore.startSessionTracking()` | Creates new `SessionTracker` (in-memory) to collect per-frame metrics |
| Live KPIs (control time %, intensity, submissions/escapes/… counters) | `SessionTracker.currentKPIs()` | Displayed in Live KPIs panel in `drill.tsx` (client-only, not persisted live) |
| Session finalize trigger | `pages/drill.tsx` calling `usePoseStore.endSessionTracking()` | `SessionTracker.finalize()` builds `SessionRecord` including computed `report` via `buildSessionReport()` |
| Finalized session record (aggregated only) | `SessionTracker.finalize()` result returned to `drill.tsx` | Sent to API `POST /api/sessions/{id}` under `finalizedReport` with { schemaVersion:2, report, summary }. No raw events uploaded. |
| Session finishing + summary computation | API `POST /api/sessions/[sessionId]` | Stores v2 `report` and `summary`. Legacy `rawReport` is set only if a v1 payload is received. Also sets `durationMs` and `qualityFlag`. |
| Session list retrieval (with optional hideLowQuality) | Account page/components via `lib/apiClient.sessions.list()` | API `GET /api/sessions` queries MongoDB and returns `SessionListResponse` to client UI |
| Single session detail (report + summary) | SessionHistory expanded row via `lib/apiClient.sessions.get()` | API `GET /api/sessions/{id}` returns `report` (v2) and legacy `rawReport` for compatibility; UI prefers `report`. |
| Account totals (sessions, reps, posture issues) | `pages/account.tsx` iterates `sessions.list()` pages | Aggregated client-side from API responses; displayed in Account overview cards |
| Access token (JWT) | API `POST /api/auth/login` response | Stored in `localStorage` by `lib/apiClient`; attached as `Authorization: Bearer` on client requests |
| Refresh token (opaque, rotating) | API `POST /api/auth/login` via httpOnly cookie | Stored as secure httpOnly cookie; rotated in `POST /api/auth/refresh`; revoked on `POST /api/auth/logout` |
| Email verification token | Server `createEmailToken()` → `sendVerificationEmail()` | Delivered via email; validated by `GET /api/auth/verify-email?token=…` to set `emailVerified=true` in MongoDB |
| Resend verification request | `POST /api/auth/resend-verification` with email | Server generates new token and re-sends email if applicable |
| Health status probe | Client/admin tools calling `GET /api/health` | Returns server uptime, memory, and MongoDB connectivity/latency (no DB writes) |
| Rate limit telemetry (implicit) | `lib/server/rateLimit.ts` middlewares (where applied) | Used to throttle endpoints; no user-visible storage shown in repo |
| Session quality flags | `SessionTracker.finalize()` and server finish handler | Stored on server as `qualityFlag` (good/low/discard) based on duration/detectionRate; used by list filter |
| Historical trend inputs | Prior session records (server) | Passed to `buildSessionReport(rec, history)` when available to compute `historicalPerformanceTrend` (placeholder uses [] in current server code) |
| User credentials (signup/login) | API auth routes | Password hashed (`bcrypt`) before storing in MongoDB; JWTs issued for access; refresh tokens hashed and stored with expiry |
| Security alert emails (login, etc.) | `sendSecurityAlert` on login | Email sent via Resend; no data stored beyond logs |
| Auth user cache (for UI hydration) | `useAuthStore.login()` persists `auth-user` to `localStorage` | Read on app load by `useAuthStore.hydrate()` to restore signed-in state (non-authoritative; server still validates) |
| Access token refresh + cookie rotation | Client `lib/apiClient` on 401 → `POST /api/auth/refresh` | New access token saved to `localStorage`; refresh cookie rotated (`Set-Cookie`), old cookie revoked |
| Session metrics API stub (example report) | `GET /api/session-metrics` | Returns `METRICS_SCHEMA_VERSION = 2` and a sample `SessionReport` JSON (no raw events) |
| DB retention policy | MongoDB `sessions` collection TTL index | Sessions auto-expire after ~90 days (`ensureIndexes()` sets TTL on `createdAt`) |
| Fallback when session start fails | `pages/drill.tsx` catch around `sessions.start()` | Continue with local `SessionTracker` only; no server `sessionId` so finalize will not persist |

Notes
- Live KPIs are computed client-side each frame by `SessionTracker.currentKPIs()` and are not persisted until session end.
- On session end, the client posts aggregated v2 metrics only (no raw events). The server stores `report` and `summary`; `rawReport` is legacy-only.
- Account totals are computed in the client by paginating `/api/sessions` and summing fields like reps and posture issues from the returned summaries/rawReport.
- Authentication uses short-lived access tokens in localStorage and rotating refresh tokens in httpOnly cookies; server middleware validates access tokens on protected APIs.
- Protected session APIs require authenticated and email-verified users (`withAuthVerifiedAndCors`); unverified users are blocked from session start/finish/list/detail endpoints.
- Data retention: session documents are subject to a TTL index and may be removed roughly 90 days after `createdAt`.
- Failure path: if starting a session on the server fails, training still works locally, but no session is saved to the backend at the end.
