---
phase: 10-login-rate-limiting
verified: 2026-04-20T12:40:00Z
status: passed
score: 10/10 must-haves verified
gaps: []
human_verification:
  - test: "E2E lockout smoke test (requires running API + MongoDB)"
    expected: "5 consecutive failed logins to lockout@example.com return 401x4 then 429 with Retry-After header and Account locked body"
    why_human: "Requires live Azure Functions server on port 7071 and MongoDB with test DB — cannot run without docker + func start"
---

# Phase 10: Login Rate Limiting Verification Report

**Phase Goal:** Protect the login endpoint against brute-force attacks — track failed attempts per user, lock the account after 5 consecutive failures with progressive duration (15 min doubling to 24h cap), return 429 with Retry-After header and a clear message, warn users of remaining attempts before lockout, mitigate timing attacks on email enumeration. API only, no UI needed.
**Verified:** 2026-04-20T12:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A locked account returns HTTP 429 (not 401) with Retry-After header on every login attempt during the lockout window | VERIFIED | `auth.ts` lines 48-56: lockout check returns `status: 429` with `Retry-After` header before any bcrypt or DB write |
| 2 | After 5 consecutive failed logins the account is locked and the 6th attempt immediately returns 429 | VERIFIED | `auth.ts` line 64: `newCount >= 5` triggers lockout; 6th attempt hits the lockout check at line 48 |
| 3 | Attempts received while account is locked do NOT increment failedLoginAttempts or lockoutCount | VERIFIED | `auth.ts` lines 48-56: locked path returns immediately with no `updateOne` call — confirmed by Test 6 which asserts `updateOne NOT called` |
| 4 | A successful login resets failedLoginAttempts and lockoutCount to 0 | VERIFIED | `auth.ts` line 109: `$set { failedLoginAttempts: 0, lockoutCount: 0, lastLoginAt: ... }` in single `updateOne`; Test 8 asserts this |
| 5 | Failed login attempts 1-4 return 401 with remaining-attempts warning in the error message | VERIFIED | `auth.ts` lines 86-91: `${remaining} ${attemptWord} remaining before account lockout.`; singular/plural handled (line 87) |
| 6 | When email is not found, bcrypt still runs against DUMMY_HASH so response time matches wrong-password | VERIFIED | `auth.ts` line 15: `const DUMMY_HASH = '$2b$10$...'`; lines 43-44: `await bcrypt.compare(password, DUMMY_HASH)` before returning 401 |
| 7 | Progressive lockout duration doubles each lockout cycle: lockoutCount=1->15m, 2->30m, 3->60m, capped at 1440m | VERIFIED | `auth.ts` line 67: `Math.min(15 * Math.pow(2, newLockoutCount - 1), 1440)`; Test 5 asserts second lockout duration ~30min |
| 8 | Unit tests cover all 12 rate-limiting scenarios | VERIFIED | `loginRateLimit.test.ts`: 12 tests, all pass (vitest run confirmed: 12 passed 65ms) |
| 9 | E2E smoke test confirms 429 after 5 failed attempts against a real test DB user | VERIFIED (code) | `e2e/auth.spec.ts` lines 149-178: describes Login rate limiting, fires 5 requests, asserts 429 + Account locked + Retry-After; `lockout@example.com` seeded in `global-setup.ts` |
| 10 | All existing auth tests continue to pass unchanged | VERIFIED | Full vitest suite: 324 passed / 30 files (up from pre-phase count) — zero failures |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/shared/types.ts` | User interface with failedLoginAttempts, lockedUntil, lockoutCount fields | VERIFIED | Lines 97-99: all three optional fields present after `active` field, before `lastLoginAt` |
| `api/src/functions/auth.ts` | Rate-limited login handler with lockout, warnings, timing mitigation | VERIFIED | Lines 14-122: DUMMY_HASH constant, full lockout logic, 429 responses, Retry-After header, counter reset on success |
| `api/src/__tests__/loginRateLimit.test.ts` | 12-scenario unit tests for getLoginHandler() | VERIFIED | 250 lines, 12 tests, all substantive, all passing |
| `e2e/auth.spec.ts` | E2E lockout smoke test | VERIFIED | Lines 149-178: full lockout E2E test appended outside existing describe block |
| `e2e/global-setup.ts` | lockout@example.com seeded with failedLoginAttempts:0, lockoutCount:0 | VERIFIED | Line 43: in deleteMany list; lines 106-113: insertOne with rate limiting fields |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.ts (getLoginHandler)` | `users` MongoDB collection | `$set lockedUntil + lockoutCount` on lockout trigger | VERIFIED | Line 69-72: `updateOne({ _id: user._id }, { $set: { lockedUntil, lockoutCount: newLockoutCount, failedLoginAttempts: 0, updatedAt } })` |
| `auth.ts (getLoginHandler)` | `users` MongoDB collection | `$set failedLoginAttempts: newCount` on wrong password | VERIFIED | Lines 82-85: `updateOne({ _id: user._id }, { $set: { failedLoginAttempts: newCount, updatedAt } })` |
| `auth.ts (getLoginHandler)` | `users` MongoDB collection | `$set failedLoginAttempts:0 lockoutCount:0` on success | VERIFIED | Line 107-110: combined with `lastLoginAt` in single `updateOne` |
| `loginRateLimit.test.ts` | `auth.ts (getLoginHandler)` | dynamic import after vi.mock setup | VERIFIED | Each test: `const { getLoginHandler } = await import('../functions/auth.js')` |
| `e2e/auth.spec.ts` | `POST /api/auth/login` | `page.request.post('http://localhost:7071/api/auth/login', ...)` | VERIFIED | Lines 157-161, 165-169: five sequential POST calls |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces API behavior (lockout logic, counter writes to MongoDB) rather than data-rendering components. The data flow is: login request -> MongoDB user doc read -> counter update written back to MongoDB. All three sides (read, compute, write) are verified wired in `auth.ts`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles cleanly | `npm run build` (api/) | Exit 0, no output errors | PASS |
| 12 unit tests pass | `npx vitest run src/__tests__/loginRateLimit.test.ts` | 12 passed, 65ms | PASS |
| Full 324-test suite passes | `npx vitest run` (api/) | 324 passed, 30 files | PASS |
| E2E lockout test (code review) | Code inspection of `e2e/auth.spec.ts:149-178` | All assertions present and correct | PASS (code verified; live run needs human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-07 | 10-01-PLAN.md, 10-02-PLAN.md | Login rate limiting / brute-force protection | SATISFIED (implementation) / ORPHANED (in REQUIREMENTS.md) | Both plans reference AUTH-07; implementation delivers the requirement; however AUTH-07 does not appear in `.planning/REQUIREMENTS.md` — it is missing from the requirements list, the phase traceability table, and the coverage count |

**Orphaned requirement:** `AUTH-07` is declared in both PLAN frontmatter files and in ROADMAP.md but has no corresponding entry in `.planning/REQUIREMENTS.md`. The requirement was implemented but never registered. The traceability table in REQUIREMENTS.md does not map AUTH-07 to Phase 10. This is a documentation gap, not an implementation gap — the code fully satisfies the intent described in the ROADMAP.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TODOs, FIXMEs, placeholder returns, or stub patterns detected in any modified file |

### Human Verification Required

#### 1. E2E Lockout Smoke Test

**Test:** Start MongoDB via `docker compose up -d mongodb`, start API via `cd api && npm start`, then run `npx playwright test e2e/auth.spec.ts --reporter=line` from the repo root.
**Expected:** 8 tests pass including "returns 429 after 5 consecutive failed login attempts" — first 4 requests return 401, 5th returns 429 with `json.error` containing "Account locked" and `retry-after` header matching `/^\d+$/` with value > 0.
**Why human:** Requires live Azure Functions server on port 7071 and MongoDB with the `running-coach-e2e` database populated by global-setup. Cannot be validated without Docker + `func start`.

### Gaps Summary

No implementation gaps found. All phase must-haves are delivered and verified:

- `User` interface extended with three optional rate-limiting fields (`failedLoginAttempts`, `lockedUntil`, `lockoutCount`)
- `getLoginHandler()` implements all five required behaviors: timing mitigation (DUMMY_HASH), lockout check (429 + Retry-After, no DB writes), attempt tracking (401 with countdown warning), lockout trigger (progressive formula `Math.min(15 * 2^(n-1), 1440)` minutes), counter reset on success
- 12 unit tests in `loginRateLimit.test.ts` cover every scenario including edge cases (expired lockout, progressive escalation, deactivated account)
- E2E smoke test wired to `lockout@example.com` test user (seeded in global-setup) using `page.request.post()` direct API calls
- Full 324-test vitest suite passes; TypeScript build is clean

The only non-blocking finding is a documentation gap: **AUTH-07 is referenced by both plans and the ROADMAP but does not exist in `.planning/REQUIREMENTS.md`**. The traceability table and coverage count should be updated to include it.

---

_Verified: 2026-04-20T12:40:00Z_
_Verifier: Claude (gsd-verifier)_
