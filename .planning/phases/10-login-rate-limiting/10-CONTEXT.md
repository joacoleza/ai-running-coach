# Phase 10: Login Rate Limiting — Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers brute-force protection on `POST /api/auth/login`:

1. **Progressive account lockout** — track consecutive failed attempts per user; lock after 5 with escalating duration (15 → 30 → 60 → 120 → 240 → 480 → 1440 min, capped at 24 hours)
2. **429 response** — return 429 with time-remaining message and `Retry-After` header when account is locked
3. **Pre-lockout warnings** — include remaining attempt count in 401 responses before lockout triggers
4. **Lockout counter reset** — both `failedLoginAttempts` and `lockoutCount` reset to 0 on first successful login
5. **Timing attack mitigation** — run bcrypt against a dummy hash when email is not found, to prevent email enumeration via response timing

This phase does NOT include:
- Admin unlock endpoint or button (deferred entirely — future phase)
- IP-based rate limiting (future phase or CDN-level concern)
- Frontend lockout UI (API only — the existing 429 error display path is sufficient)

</domain>

<decisions>
## Implementation Decisions

### Storage Location

- **D-01:** Store rate limiting state on the **User document** — three new fields: `failedLoginAttempts` (number), `lockedUntil` (Date | undefined), `lockoutCount` (number). User doc is already fetched on every login attempt; no extra DB round-trip needed.
- **D-02:** Add these fields to the `User` interface in `api/src/shared/types.ts`. Existing users without these fields treat `undefined`/missing as 0 (no migration needed — MongoDB `$inc` on a missing field initializes to 0).

### Lockout Trigger and Duration

- **D-03:** Lock triggers after **5 consecutive failed login attempts** (attempts that reach the password check — not attempts during an active lockout period).
- **D-04:** Lockout duration is **progressive**, doubling each time the user triggers a lockout: `Math.min(15 * Math.pow(2, lockoutCount - 1), 1440)` minutes.
  - lockoutCount=1 → 15 min
  - lockoutCount=2 → 30 min
  - lockoutCount=3 → 60 min
  - lockoutCount=4 → 120 min
  - lockoutCount=5 → 240 min
  - lockoutCount=6 → 480 min
  - lockoutCount=7+ → 1440 min (24 hours, hard cap)
- **D-05:** On lockout trigger: increment `lockoutCount`, set `lockedUntil = now + duration`, reset `failedLoginAttempts` to 0.

### Timer Behavior During Lockout

- **D-06:** Lockout timer is **fixed from the moment it first triggers** — subsequent attempts during the lockout window return 429 but do NOT extend the deadline. The user can predict exactly when they can retry.
- **D-07:** Attempts received while `lockedUntil > now` do not increment `failedLoginAttempts` or `lockoutCount` — they are rejected immediately before any credential check.

### Lockout Reset

- **D-08:** On **successful login**: reset both `failedLoginAttempts = 0` and `lockoutCount = 0`. A legitimate user who recovers access starts fresh with the 15-min baseline for any future lockout.
- **D-09:** `failedLoginAttempts` also resets to 0 on successful login (it was already being reset per D-05 on lockout trigger; this covers the partial-failure case where the user failed <5 times then succeeded).

### 429 Response Format

- **D-10:** When account is locked, return HTTP 429 with:
  - JSON body: `{ error: 'Account locked. Try again in X minutes.' }` where X is the ceiling of remaining seconds / 60
  - HTTP header: `Retry-After: <seconds>` (integer seconds until `lockedUntil`)
- **D-11:** The `Retry-After` header uses seconds (integer), not a date string — consistent with RFC 6585 and easier to consume client-side.

### Pre-Lockout Warnings

- **D-12:** On failed login attempts (after credential check, before lockout triggers), the 401 response body includes the remaining attempt count:
  - `{ error: 'Invalid credentials. X attempt(s) remaining before account lockout.' }` where X = `5 - failedLoginAttempts` (after incrementing)
  - Example: 4th failure → "Invalid credentials. 1 attempt remaining before account lockout."
  - On the 5th failure, the response is already 429 (lockout triggered), so the warning never shows at 0 remaining.

### Timing Attack Mitigation

- **D-13:** When the email lookup returns no user, run bcrypt compare against a fixed dummy hash (`DUMMY_HASH` — a pre-computed bcrypt hash of a random string, defined as a module-level constant). This ensures the response time for "email not found" matches "wrong password" to prevent email enumeration via timing.
- **D-14:** The dummy hash is a hardcoded bcrypt hash string (pre-computed at development time), NOT dynamically generated on each request. Dynamic hashing would add latency and serve no security purpose.

### Admin Unlock

- **D-15:** Admin unlock is **deferred entirely** — no API endpoint and no admin panel button in Phase 10. Lockouts expire naturally.
- **D-16:** If the admin user's own account gets locked, a system admin clears the lockout directly in MongoDB by unsetting `lockedUntil` and resetting `failedLoginAttempts` and `lockoutCount` to 0.

### Claude's Discretion

- Exact dummy hash value (any valid bcrypt hash of a throwaway string, e.g. bcrypt of "dummy" with 10 rounds)
- Whether to extract rate limiting logic into a helper function or keep it inline in `getLoginHandler`
- Error message wording tweaks (e.g. "attempt" vs "attempts remaining" singular/plural)
- DB index decisions for `lockedUntil` field (probably not needed given small user base)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Implementation
- `api/src/functions/auth.ts` — Login handler to modify (`getLoginHandler`). Contains current login flow, bcrypt compare, lastLoginAt update pattern.
- `api/src/middleware/auth.ts` — Auth middleware (requireAuth, requireAdmin). Shows established DB-lookup-on-request pattern.
- `api/src/shared/types.ts` — User interface to extend with `failedLoginAttempts`, `lockedUntil`, `lockoutCount` fields.
- `api/src/shared/db.ts` — DB connection pattern and index creation location (if new indexes needed).

### Prior Phase Context
- `.planning/phases/06-backend-auth-foundation/06-CONTEXT.md` — D-16 (lockout system removed in Phase 6), D-13 (uniform 401 messages), token/middleware patterns.

### No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getLoginHandler()` in `auth.ts` — exported factory pattern for unit testability; rate limiting logic goes inside this function
- `sha256()` helper in `auth.ts` — module-level; similar pattern for `DUMMY_HASH` constant
- `bcrypt.compare()` already used for password verification — same call for dummy comparison
- `db.collection<User>('users').updateOne(...)` — established pattern for updating user doc fields (see lastLoginAt update)

### Established Patterns
- User doc is the home for per-user auth state (`active`, `lastLoginAt`, `tempPassword`) — rate limiting fields follow the same pattern
- Exported handler factories (`getLoginHandler`, `getRefreshHandler`, etc.) — unit testability without registering with Azure Functions runtime
- Uniform 401 message for wrong email AND wrong password (Phase 06 D-13) — rate limiting warnings extend this pattern rather than breaking it
- `$inc` on MongoDB for counters — natural fit for `failedLoginAttempts`

### Integration Points
- Rate limiting state written via `updateOne` on the `users` collection — same connection used for credential verification
- `failedLoginAttempts`, `lockedUntil`, `lockoutCount` fields: MongoDB treats missing fields as falsy/undefined — `$inc` on missing field initializes to 0, `lockedUntil` absent = not locked

</code_context>

<specifics>
## Specific Ideas

- **Progressive lockout escalation:** User specifically asked for this — not a simple flat 15-min lockout. The doubling formula (15 * 2^(count-1), 24h cap) was confirmed.
- **Security motivation:** The lockout escalation is a defense mechanism, not a punishment — the goal is to make automated attacks impractical while keeping legitimate users recoverable.
- **Admin lockout recovery:** System admin unlocks directly in MongoDB — no emergency API endpoint needed for v2.0 given the small closed user base.

</specifics>

<deferred>
## Deferred Ideas

- **Admin unlock endpoint + UI button** — `POST /api/users/:id/unlock` clearing `failedLoginAttempts`, `lockoutCount`, `lockedUntil`. Both API and admin panel button go in a future phase.
- **IP-based rate limiting** — Limits attempts per source IP regardless of account. Defends against distributed password stuffing. Requires handling `X-Forwarded-For` in Azure Functions context. Future phase or CDN-level.
- **Audit log for failed logins** — Structured log events for security monitoring. Future observability work.

</deferred>

---

*Phase: 10-login-rate-limiting*
*Context gathered: 2026-04-20*
