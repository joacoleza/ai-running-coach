# Phase 6: Backend Auth Foundation — Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 delivers the API-layer authentication foundation for v2.0:

1. **User model** — `users` collection with email, bcrypt-hashed password, `isAdmin` flag, `tempPassword` flag (consumed by Phase 7), `lastLoginAt`, `createdAt`
2. **Login endpoint** — `POST /api/auth/login` validates email+password, returns signed JWT access token + refresh token
3. **Refresh endpoint** — `POST /api/auth/refresh` exchanges a valid refresh token for a new access token
4. **Logout endpoint** — `POST /api/auth/logout` revokes the refresh token server-side
5. **JWT middleware** — replaces `requirePassword` on all existing routes; rejects missing/expired/invalid JWTs with 401
6. **Retire APP_PASSWORD** — `x-app-password` header no longer grants access; old `requirePassword` middleware removed

This phase does NOT include:
- Frontend login/logout UI (Phase 7)
- Force-change-password flow (Phase 7)
- Data isolation / userId scoping on existing collections (Phase 8)
- Admin panel (Phase 9)

</domain>

<decisions>
## Implementation Decisions

### Token Delivery

- **D-01:** JWT access token returned in JSON response body — `{ token, refreshToken, expiresIn }`. Client stores in `localStorage` and sends as `Authorization: Bearer <token>` on every request.
- **D-02:** No httpOnly cookie for this phase. Cookie-based delivery noted as a future security improvement (deferred).

### Token Lifetime

- **D-03:** Access token TTL: **15 minutes**. Short-lived; expires naturally after logout so a denylist is not required.
- **D-04:** Refresh token TTL: **30 days**. Stored server-side in a `refresh_tokens` collection. User must re-login after 30 days of inactivity (or explicit logout).

### Logout & Token Invalidation

- **D-05:** Logout deletes the refresh token document from the `refresh_tokens` collection. The access token expires naturally within ≤15 minutes — this satisfies success criterion #3 ("subsequent requests with that token are rejected").
- **D-06:** `refresh_tokens` collection schema: `{ _id, userId (ObjectId), tokenHash (SHA-256 of the raw token), expiresAt (Date) }`. TTL index on `expiresAt` auto-purges expired documents.
- **D-07:** Refresh tokens are **not rotated** on use (simpler; acceptable for a closed app with known users). One token per session until logout or 30d expiry.

### User Model

- **D-08:** `users` collection schema: `{ _id (ObjectId), email (string, unique index), passwordHash (string, bcrypt), isAdmin (boolean), tempPassword (boolean, default true for new accounts), lastLoginAt (Date), createdAt (Date), updatedAt (Date) }`.
- **D-09:** `tempPassword: true` is set on all admin-created accounts. Phase 7 reads this flag to trigger force-change-password redirect. Phase 6 creates the model but does not enforce the redirect.

### JWT Signing

- **D-10:** JWT payload: `{ sub: userId (string), email, isAdmin (boolean), iat, exp }`. Signed with `JWT_SECRET` env var using HS256.
- **D-11:** No `jti` (JWT ID) needed since we're not using a denylist — revocation is handled via refresh token deletion.

### New Auth Middleware

- **D-12:** New `requireAuth` middleware in `api/src/middleware/auth.ts` (replaces `requirePassword`). Reads `Authorization: Bearer <token>` header, verifies JWT, attaches `{ userId, email, isAdmin }` to request context for downstream handlers.
- **D-13:** Returns exactly 401 for all auth failures (missing token, expired, invalid signature). Never 403 or 500 for auth failures.
- **D-14:** `POST /api/ping` remains unauthenticated (liveness probe). `POST /api/auth/login`, `POST /api/auth/refresh` are unauthenticated (obviously). All other routes require `requireAuth`.

### JWT / bcrypt Libraries

- **D-15:** Use `jsonwebtoken` for JWT signing/verification and `bcrypt` (or `bcryptjs`) for password hashing. Both are well-tested, Node.js-native, and compatible with Azure Functions v4 + Node.js 22.

### APP_PASSWORD Retirement

- **D-16:** `requirePassword`, `checkBlocked`, `_resetConnectionForTest` are removed from `auth.ts`. The `auth` collection (lockout documents) can remain in MongoDB — no migration needed. `APP_PASSWORD` env var is no longer read.

### Claude's Discretion

- bcrypt salt rounds (12 is a sensible default)
- Error message wording for 401 responses
- Whether to seed a default admin user in a dev/test setup (or leave user creation to Phase 9)
- Test seeding strategy for the `users` collection in unit/integration tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Auth (being replaced)
- `api/src/middleware/auth.ts` — current `requirePassword` implementation to be replaced
- `api/src/__tests__/auth.test.ts` — existing auth tests; rewrite for JWT-based middleware

### All Protected Routes (need middleware swap)
- `api/src/functions/chat.ts`
- `api/src/functions/health.ts`
- `api/src/functions/messages.ts`
- `api/src/functions/plan.ts`
- `api/src/functions/planArchive.ts`
- `api/src/functions/planDays.ts`
- `api/src/functions/planPhases.ts`
- `api/src/functions/runs.ts`

### Unprotected Routes (leave as-is)
- `api/src/functions/ping.ts` — liveness probe, no auth
- `api/src/functions/keepAlive.ts` — check if this needs protection

### Types & Shared
- `api/src/shared/types.ts` — add `User` interface
- `api/src/shared/db.ts` — model for MongoDB connection pattern to replicate
- `api/src/index.ts` — register new `auth.ts` function file here

### Architecture
- `CLAUDE.md` §Architecture Decisions — MongoDB pattern, Azure Functions v4 structure
- `REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-05, AUTH-06

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns
- `api/src/shared/db.ts` — singleton MongoDB connection pattern; new `users` and `refresh_tokens` collections follow this pattern
- `api/src/middleware/auth.ts` — current structure shows how middleware integrates with Azure Functions v4 (returns `HttpResponseInit | null`); new `requireAuth` follows the same interface
- Every protected function calls `const authError = await requirePassword(req); if (authError) return authError;` — same call pattern for `requireAuth`

### Integration Points
- New file: `api/src/functions/auth.ts` — registers `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- `api/src/index.ts` — add `import './functions/auth.js'`
- `api/src/shared/types.ts` — add `User` interface
- `api/src/middleware/auth.ts` — replace entire file with JWT-based `requireAuth`

### What Doesn't Change in Phase 6
- No frontend files change (Phase 7 owns frontend)
- No `userId` scoping on existing collections (Phase 8 owns data isolation)
- Existing `plans`, `runs`, `messages` collections untouched

</code_context>

<specifics>
## Specific Requirements

- **`POST /api/auth/login`** — body: `{ email, password }`. Returns: `{ token, refreshToken, expiresIn: 900 }` (900s = 15 min). On failure: 401 with `{ error: 'Invalid credentials' }` (no distinction between wrong email vs wrong password — prevents user enumeration).
- **`POST /api/auth/refresh`** — body: `{ refreshToken }`. Returns: `{ token, expiresIn: 900 }`. On failure: 401.
- **`POST /api/auth/logout`** — requires valid access token (Authorization header). Deletes matching refresh token from `refresh_tokens`. Returns 204.
- **Refresh token storage** — store SHA-256 hash of the raw token (never store raw). Look up by hashing the incoming value.
- **`tempPassword` flag** — stored on User document; set to `true` for all new accounts; set to `false` when password is changed (Phase 7 implements that flow). Phase 6 creates the field but doesn't act on it.
- **`keepAlive` function** — check whether it calls `requirePassword`; if so, decide whether it should be protected or left open (likely protected since it keeps the MongoDB connection warm).

</specifics>

<deferred>
## Deferred Ideas

- **httpOnly cookie for JWT storage** — noted as a future security improvement. Prevents XSS from stealing tokens. Requires CSRF protection on mutating routes and `credentials: 'include'` on all fetches. Deferred: complexity vs risk tradeoff not worth it for a closed app.
- **Refresh token rotation** — issue a new refresh token on every use, invalidate the old one. Improves security against refresh token theft. Deferred: not needed for a closed known-user app.
- **Rate limiting on login endpoint** — protect against brute force. The old APP_PASSWORD gate had a 30-failure lockout. Deferred: acceptable risk for a closed app; can add later.
- **Per-device session tracking** — multiple refresh tokens per user (one per device). Deferred: single session per user is fine for now.

</deferred>

---

*Phase: 06-backend-auth-foundation*
*Context gathered: 2026-04-15*
