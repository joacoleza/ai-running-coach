---
phase: 10-login-rate-limiting
plan: "03"
subsystem: auth
tags: [rate-limiting, security, ip-based, enumeration-prevention]
dependency_graph:
  requires: []
  provides: [IP-based login rate limiting, LoginAttempt model, login_attempts collection]
  affects: [api/src/functions/auth.ts, api/src/shared/types.ts, api/src/shared/db.ts, web/src/pages/LoginPage.tsx]
tech_stack:
  added: [login_attempts MongoDB collection]
  patterns: [IP-based lockout via x-forwarded-for, TTL index for automatic record expiry, getClientIp helper]
key_files:
  created:
    - api/src/__tests__/loginRateLimit.test.ts
  modified:
    - api/src/shared/types.ts
    - api/src/shared/db.ts
    - api/src/functions/auth.ts
    - api/src/__tests__/authEndpoints.test.ts
    - api/src/__tests__/adminAuth.test.ts
    - api/src/__tests__/login.tempPassword.test.ts
    - e2e/global-setup.ts
    - e2e/auth.spec.ts
    - web/src/pages/LoginPage.tsx
    - web/src/__tests__/LoginPage.test.tsx
  deleted:
    - api/src/__tests__/loginRateLimiting.test.ts
decisions:
  - IP-based lockout using login_attempts collection instead of per-user fields eliminates email enumeration attack vector
  - lockedUntil absent = not locked; TTL index (7 days) automatically expires inactive records
  - getClientIp reads x-forwarded-for first (Azure load balancer) then client-ip then defaults to 127.0.0.1
  - 401 responses are now byte-identical for nonexistent email vs wrong password at all attempt counts
metrics:
  duration_seconds: 391
  completed: "2026-04-22"
  tasks_completed: 3
  files_changed: 10
  files_deleted: 1
---

# Phase 10 Plan 03: IP-Based Rate Limiting — Gap Closure Summary

**One-liner:** Replaced account-based lockout with IP-keyed login_attempts collection, eliminating email enumeration while keeping 5-attempt progressive lockout behavior; LoginPage now surfaces 429 API message instead of "Network error".

## What Was Built

### Task 1: IP-based rate limiting — types, db indexes, auth handler

- **types.ts:** Removed `failedLoginAttempts`, `lockedUntil`, `lockoutCount` from `User` interface; added new `LoginAttempt` interface with `ip`, `attempts`, `lockoutCount`, `lockedUntil?`, `updatedAt` fields.
- **db.ts:** Added two indexes for `login_attempts` — unique on `ip`, TTL on `updatedAt` (expireAfterSeconds: 604800, 7 days).
- **auth.ts:** Rewrote `getLoginHandler` to:
  1. Check IP lockout in `login_attempts` before touching `users` collection
  2. Run bcrypt dummy hash for missing-email path (timing mitigation unchanged)
  3. Increment IP counter on every failed attempt (nonexistent email and wrong password identical)
  4. Trigger lockout at attempt 5 with progressive duration (15→30→60→...1440 min)
  5. Reset IP counter on successful login
  6. Add `getClientIp()` helper reading `x-forwarded-for`

### Task 2: API unit tests rewritten for IP-based behavior

- **loginRateLimiting.test.ts:** Deleted (tested account-based lockout, now obsolete)
- **loginRateLimit.test.ts:** Full rewrite — 10 IP-based scenarios covering: email-not-found timing, enumeration prevention (identical 401 for fake vs real email), wrong-password increments, 5th-attempt lockout, progressive lockout duration, already-locked early return, expired lockout passthrough, successful login reset, deactivated account isolation
- **authEndpoints.test.ts:** Updated wrong-password assertion from "remaining before account lockout" to plain "Invalid credentials"
- **adminAuth.test.ts, login.tempPassword.test.ts:** Added `login_attempts` mock returning `null` (no prior record) to unblock login handler which now always queries that collection

### Task 3: E2E cleanup + LoginPage 429 handler

- **global-setup.ts:** Removed `lockout@example.com` seeded user; added `login_attempts.deleteMany({})` cleanup to prevent IP lockout from blocking subsequent E2E test runs
- **auth.spec.ts:** Updated rate limiting smoke test to use `doesnotexist@example.com` (non-existent email) proving enumeration fix; asserts `Too many failed attempts` (new message)
- **LoginPage.tsx:** Added 429 branch between 401 and 503 — reads `response.json().error` and falls back to `'Account locked. Try again later.'`; clears password field
- **LoginPage.test.tsx:** Two new tests — 429 with API error body shown, 429 with empty body uses fallback

## Test Results

| Suite | Before | After |
|-------|--------|-------|
| API (vitest) | 309 pass | 309 pass |
| Web (vitest) | 467 pass | 469 pass (+2 new 429 tests) |
| E2E auth.spec.ts | 8 pass | 8 pass |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing mock] Added login_attempts mock to adminAuth.test.ts and login.tempPassword.test.ts**
- **Found during:** Task 2 (first test run)
- **Issue:** Two existing test files mocked `getDb` but only handled `users` and `refresh_tokens` collections. After the auth handler started calling `db.collection('login_attempts')`, those tests received an empty `{}` object and threw when calling `findOne`, causing 500 responses.
- **Fix:** Added `login_attempts` stub returning `{ findOne: vi.fn().mockResolvedValue(null), updateOne: vi.fn() }` in both files' `getDb` mock.
- **Files modified:** `api/src/__tests__/adminAuth.test.ts`, `api/src/__tests__/login.tempPassword.test.ts`
- **Commit:** 7021cf2

## Known Stubs

None — all data flows are wired end-to-end.

## Self-Check: PASSED

- SUMMARY.md: FOUND
- types.ts: FOUND
- auth.ts: FOUND
- loginRateLimit.test.ts: FOUND
- loginRateLimiting.test.ts: DELETED (correct)
- Commit aa99c42: FOUND
- Commit 7021cf2: FOUND
- Commit bbec361: FOUND
