---
phase: 10-login-rate-limiting
plan: "02"
subsystem: api/auth, e2e
tags: [auth, security, rate-limiting, brute-force, tests, e2e]
dependency_graph:
  requires: [brute-force-protection-on-login]
  provides: [rate-limiting-test-coverage]
  affects:
    - api/src/__tests__/loginRateLimit.test.ts
    - e2e/auth.spec.ts
    - e2e/global-setup.ts
tech_stack:
  added: []
  patterns: [vitest-dynamic-import, vi-hoisted-mocks, playwright-request-api]
key_files:
  created:
    - api/src/__tests__/loginRateLimit.test.ts
  modified:
    - e2e/auth.spec.ts
    - e2e/global-setup.ts
decisions:
  - loginRateLimit.test.ts created as the canonical 12-test file per plan spec; loginRateLimiting.test.ts (13 tests from Wave 1) retained alongside it — both pass
  - E2E lockout test uses page.request.post() (Playwright HTTP context) for direct API calls without UI interaction
  - lockout@example.com seeded with failedLoginAttempts:0 and lockoutCount:0 so each test run starts fresh (global-setup re-seeds on every run)
metrics:
  duration: "~6 minutes"
  completed: "2026-04-20T12:31:00Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 10 Plan 02: Login Rate Limiting Tests Summary

**One-liner:** 12-scenario unit test suite for brute-force lockout logic plus E2E smoke test confirming POST /api/auth/login returns 429 with Retry-After after 5 consecutive failures.

## What Was Implemented

### Task 1: Unit tests for login rate limiting (api/src/__tests__/loginRateLimit.test.ts)

Created `loginRateLimit.test.ts` using the exact mock boilerplate from `authEndpoints.test.ts` (vi.hoisted factories, vi.mock order, makePostRequest helper, dynamic import per test).

12 tests covering all scenarios:

| Test | Scenario | Assertion |
|------|----------|-----------|
| 1 | Email not found — timing mitigation | bcrypt.compare called once against DUMMY_HASH ($2b$10$...) |
| 2 | First wrong password | 401 with "4 attempts remaining", updateOne sets failedLoginAttempts: 1 |
| 3 | Fourth wrong password | 401 with "1 attempt remaining" (singular, not "1 attempts") |
| 4 | Fifth wrong password — lockout trigger | 429 with Retry-After, updateOne sets lockedUntil + lockoutCount: 1 + failedLoginAttempts: 0 |
| 5 | Progressive escalation (lockoutCount: 1) | 429, second lockout → lockoutCount: 2, duration ~30 min |
| 6 | Already locked (lockedUntil in future) | 429 immediately, updateOne NOT called, bcrypt NOT called |
| 7 | Lockout expired (lockedUntil in past) | Treated as unlocked, proceeds to credential check → 200 |
| 8 | Successful login with prior failures | updateOne sets failedLoginAttempts: 0, lockoutCount: 0, lastLoginAt |
| 9 | Successful login with prior failures | Returns 200 |
| 10 | Locked account 429 body | Contains "Account locked. Try again in" and minutes value |
| 11 | Retry-After header format | Matches /^\d+$/, value > 0 |
| 12 | Deactivated account | Returns 401 "Invalid credentials", NOT 429 |

Note: Wave 1 (`10-01`) already created `loginRateLimiting.test.ts` with 13 tests. This plan adds the canonical `loginRateLimit.test.ts` (per plan artifact spec) with exactly 12 tests. Both files coexist and pass.

### Task 2: E2E smoke test + global-setup seeding

**e2e/global-setup.ts:**
- Added `'lockout@example.com'` to the deleteMany list (idempotent cleanup)
- Added insertOne for `lockout@example.com` with `failedLoginAttempts: 0`, `lockoutCount: 0` — ensures each test run starts with a fresh unlocked user

**e2e/auth.spec.ts:**
- Added `test.describe('Login rate limiting', ...)` block outside the existing `Auth flows` describe (to avoid the beforeEach localStorage-clearing hook)
- Test uses `page.request.post()` to fire 5 consecutive failed login attempts directly to `http://localhost:7071/api/auth/login`
- Asserts: first 4 return 401, 5th returns 429 with `json.error` containing "Account locked" and `retry-after` header matching `/^\d+$/` with value > 0

## Deviations from Plan

**1. [Rule 1 - Naming] loginRateLimit.test.ts created alongside loginRateLimiting.test.ts**
- **Found during:** Task 1 setup
- **Issue:** Wave 1 already created `loginRateLimiting.test.ts` (with "ing") while this plan's artifact spec calls for `loginRateLimit.test.ts` (without "ing")
- **Fix:** Created the plan-specified `loginRateLimit.test.ts` as a new standalone file with exactly 12 tests; the Wave 1 file was left intact as it is also valid coverage
- **Files modified:** api/src/__tests__/loginRateLimit.test.ts (created)
- **Commit:** cf00c6b

## Test Results

- **New unit tests:** 12 tests in `loginRateLimit.test.ts` — all pass
- **Full API test suite:** 324 tests — all pass (up from 312 before Wave 1, now includes both loginRateLimit.test.ts and loginRateLimiting.test.ts)
- **E2E auth tests:** 8 tests — all pass (7 existing + 1 new lockout smoke test)
- **Web TypeScript build:** clean (exits 0)

## Verification Commands

```
cd C:/dev/ai-running-coach/api && npx vitest run src/__tests__/loginRateLimit.test.ts
# → 12 passed

cd C:/dev/ai-running-coach/api && npx vitest run
# → 324 passed

cd C:/dev/ai-running-coach && npx playwright test e2e/auth.spec.ts --reporter=line
# → 8 passed (21.7s)

cd C:/dev/ai-running-coach/web && npm run build
# → built in 690ms (clean)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | cf00c6b | test(10-02): add 12-scenario unit tests for login rate limiting |
| Task 2 | d992b35 | feat(10-02): add E2E lockout smoke test and seed lockout@example.com |

## Known Stubs

None — all tests are fully implemented and passing.

## Self-Check: PASSED

- FOUND: api/src/__tests__/loginRateLimit.test.ts
- FOUND: e2e/auth.spec.ts (contains 'returns 429 after 5 consecutive failed login attempts')
- FOUND: e2e/global-setup.ts (contains 'lockout@example.com')
- FOUND commit: cf00c6b (Task 1)
- FOUND commit: d992b35 (Task 2)
