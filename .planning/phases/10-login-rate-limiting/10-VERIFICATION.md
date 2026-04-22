---
phase: 10-login-rate-limiting
verified: 2026-04-22T21:03:00Z
status: passed
score: 4/4 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 10/10
  note: >
    Previous verification (2026-04-20) verified plans 01+02 (account-based lockout).
    Plan 03 replaced the entire implementation with IP-based lockout — this is a full
    re-verification of the final codebase state, not incremental gap closure.
  gaps_closed:
    - "IP-based rate limiting replaces account-based lockout (enumeration gap fixed)"
    - "All 401 responses now return identical 'Invalid credentials' (no attempt count)"
    - "LoginPage.tsx handles 429 and shows API error body"
    - "loginRateLimiting.test.ts deleted; loginRateLimit.test.ts rewritten for IP-based behavior"
    - "User interface no longer carries rate-limiting fields"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:
  - test: "E2E lockout smoke test (requires running API + MongoDB)"
    expected: "5 consecutive failed logins to doesnotexist@example.com return 401x4 then 429 with Retry-After header and 'Too many failed attempts' body"
    why_human: "Requires live Azure Functions server on port 7071 and MongoDB — cannot run without docker + func start"
---

# Phase 10: Login Rate Limiting Verification Report

**Phase Goal:** Brute-force login protection — rate-limit the login endpoint to block credential stuffing attacks
**Verified:** 2026-04-22T21:03:00Z
**Status:** passed
**Re-verification:** Yes — full re-verification after plan 03 gap closure (IP-based implementation replaced account-based)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rate limiting is IP-based — lockout fires after 5 failures from the same IP regardless of whether the email is real or not | VERIFIED | `auth.ts` lines 43-87: `login_attempts` collection keyed by `ip` (from `getClientIp()`); both `user not found` and `wrong password` paths increment the same IP counter identically |
| 2 | All 401 responses return identical plain 'Invalid credentials' — no information that distinguishes email existence | VERIFIED | `auth.ts` line 87: `{ error: 'Invalid credentials' }` and line 115: `{ error: 'Invalid credentials' }` — no attempt count, no per-user state exposed; Test 2 in `loginRateLimit.test.ts` asserts byte-identical responses |
| 3 | After 5 failed attempts from the same IP, both real and non-existent emails return 429 | VERIFIED | `auth.ts` line 66: `if (newAttempts >= 5)` on non-existent email path; line 94: same condition on wrong-password path; both write identical lockout to `login_attempts`; E2E test uses `doesnotexist@example.com` to prove this |
| 4 | UI shows the lockout message from the API body on 429 instead of 'Network error' | VERIFIED | `LoginPage.tsx` lines 55-58: `else if (response.status === 429)` branch reads `response.json().error` and falls back to `'Account locked. Try again later.'`; `LoginPage.test.tsx` lines 142-165: two passing tests cover API body path and fallback |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/shared/types.ts` | `LoginAttempt` interface; `User` interface WITHOUT rate-limiting fields | VERIFIED | Lines 109-116: `LoginAttempt` with `ip`, `attempts`, `lockoutCount`, `lockedUntil?`, `updatedAt`; `User` interface (lines 90-100) has no `failedLoginAttempts`, `lockedUntil`, or `lockoutCount` fields |
| `api/src/functions/auth.ts` | IP-based rate limiting using `login_attempts` collection | VERIFIED | Lines 27-31: `getClientIp()` helper; lines 45-87: full IP-keyed lockout logic; no references to `failedLoginAttempts` anywhere |
| `web/src/pages/LoginPage.tsx` | 429 handler reading API error body | VERIFIED | Lines 55-58: `response.status === 429` branch with `response.json()` read and fallback message |
| `api/src/__tests__/loginRateLimit.test.ts` | 10 IP-based test scenarios | VERIFIED | 280 lines; 10 tests; all pass (vitest confirms: `10 passed 71ms`) |
| `api/src/__tests__/loginRateLimiting.test.ts` | File deleted (tested obsolete account-based lockout) | VERIFIED | `ls` confirms file does not exist |
| `api/src/shared/db.ts` | `login_attempts` collection indexes | VERIFIED | Lines 25-26: unique index on `ip`; TTL index on `updatedAt` (expireAfterSeconds: 604800) |
| `e2e/global-setup.ts` | `login_attempts.deleteMany({})` cleanup; no `lockout@example.com` | VERIFIED | Line 45: `deleteMany({})` present; `lockout@example.com` absent from file |
| `e2e/auth.spec.ts` | Smoke test uses non-existent email to prove enumeration fix | VERIFIED | Line 153: `doesnotexist@example.com`; line 171: asserts `'Too many failed attempts'` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.ts getLoginHandler` | `login_attempts` collection | `attemptsCol.findOne({ ip })` pre-check | VERIFIED | Lines 48-57: lockout check fires before any user lookup |
| `auth.ts getLoginHandler` | `login_attempts` collection | `attemptsCol.updateOne` on failed attempt | VERIFIED | Lines 82-86 (non-existent email) and lines 110-114 (wrong password): identical update shape |
| `auth.ts getLoginHandler` | `login_attempts` collection | `attemptsCol.updateOne` reset on success | VERIFIED | Lines 123-126: `{ attempts: 0, lockoutCount: 0, updatedAt }` on successful login |
| `auth.ts getLoginHandler` | `users` collection | `findOne` only after IP lockout check | VERIFIED | Line 59: user lookup deferred until after IP check passes |
| `LoginPage.tsx` | API `response.json()` | `response.status === 429` branch | VERIFIED | Lines 55-58: reads error body and sets it as the displayed error state |
| `loginRateLimit.test.ts` | `auth.ts getLoginHandler` | dynamic import per test | VERIFIED | Each test: `const { getLoginHandler } = await import('../functions/auth.js')` |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces API behavior (rate limiting writes to MongoDB) rather than data-rendering components. `LoginPage.tsx` renders the API error body directly from `response.json().error`, which is verified wired in lines 55-58.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 10 IP-based unit tests pass | `npx vitest run src/__tests__/loginRateLimit.test.ts` (api/) | 10 passed, 71ms | PASS |
| Full API test suite — 309 tests | `npx vitest run` (api/) | 309 passed, 29 files | PASS |
| Web test suite — 469 tests | `npm test -- --run` (web/) | 469 passed, 34 files | PASS |
| E2E smoke test (live server) | `npx playwright test e2e/auth.spec.ts` | Requires Docker + func start | SKIP (human needed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RATE-01 | 10-03-PLAN.md | IP-based login rate limiting (gap closure) | SATISFIED (implementation) / ORPHANED (not in REQUIREMENTS.md) | Implementation fully delivers IP-based lockout; however `RATE-01` does not appear anywhere in `.planning/REQUIREMENTS.md` |
| AUTH-07 | 10-01-PLAN.md, 10-02-PLAN.md | Login rate limiting / brute-force protection | SATISFIED (implementation) / ORPHANED (not in REQUIREMENTS.md) | `AUTH-07` referenced in earlier plan frontmatter and ROADMAP but absent from `.planning/REQUIREMENTS.md` — the requirements list, traceability table, and coverage count all omit it |

**Orphaned requirements (documentation gap, not implementation gap):** Both `RATE-01` and `AUTH-07` are referenced across plan frontmatter and ROADMAP.md but neither exists in `.planning/REQUIREMENTS.md`. The implementation fully satisfies the intent of both. The REQUIREMENTS.md traceability table should be updated to include Phase 10 / AUTH-07 (or RATE-01).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TODOs, FIXMEs, placeholder returns, or stub patterns in any modified file |

### Human Verification Required

#### 1. E2E Lockout Smoke Test

**Test:** Ensure Docker is running, then run `npx playwright test e2e/auth.spec.ts --reporter=line` from the repo root (global-setup starts MongoDB automatically).
**Expected:** 8 tests pass including "returns 429 after 5 consecutive failed attempts — works for non-existent email". First 4 requests to `doesnotexist@example.com` return 401; 5th returns 429 with `json.error` containing "Too many failed attempts" and `retry-after` header matching `/^\d+$/` with value > 0.
**Why human:** Requires live Azure Functions server on port 7071 and MongoDB with `running-coach-e2e` database. Cannot validate without Docker + `func start`.

### Gaps Summary

No implementation gaps. All phase must-haves for the final IP-based implementation (plan 03) are present and passing:

- `User` interface is clean — no rate-limiting fields (`failedLoginAttempts`, `lockedUntil`, `lockoutCount` removed)
- `LoginAttempt` interface exported from `types.ts` with correct shape
- `login_attempts` collection has both required indexes in `db.ts` (unique on `ip`, TTL on `updatedAt`)
- `getLoginHandler` uses `getClientIp()` + `login_attempts` collection for all lockout state — zero references to per-user rate limiting fields
- Non-existent email and wrong-password paths produce byte-identical 401 responses at every attempt count
- `LoginPage.tsx` has `response.status === 429` branch reading API error body
- `loginRateLimiting.test.ts` (old account-based tests) deleted; `loginRateLimit.test.ts` rewritten with 10 IP-based scenarios, all passing
- API test suite: 309 pass. Web test suite: 469 pass (includes 2 new 429 tests).
- E2E smoke test updated to use non-existent email, asserting "Too many failed attempts"
- `login_attempts.deleteMany({})` in global-setup prevents IP lockout from blocking subsequent E2E runs
- `lockout@example.com` removed from global-setup (no longer needed)

The only finding is a documentation gap: `AUTH-07` / `RATE-01` are not registered in `.planning/REQUIREMENTS.md`. This does not affect correctness.

---

_Verified: 2026-04-22T21:03:00Z_
_Verifier: Claude (gsd-verifier)_
