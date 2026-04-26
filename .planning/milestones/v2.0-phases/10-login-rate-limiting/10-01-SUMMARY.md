---
phase: 10-login-rate-limiting
plan: "01"
subsystem: api/auth
tags: [auth, security, rate-limiting, brute-force]
dependency_graph:
  requires: []
  provides: [brute-force-protection-on-login]
  affects: [api/src/functions/auth.ts, api/src/shared/types.ts]
tech_stack:
  added: []
  patterns: [bcrypt-timing-mitigation, progressive-lockout, retry-after-header]
key_files:
  created:
    - api/src/__tests__/loginRateLimiting.test.ts
  modified:
    - api/src/shared/types.ts
    - api/src/functions/auth.ts
    - api/src/__tests__/authEndpoints.test.ts
decisions:
  - DUMMY_HASH hardcoded as literal string (not computed at runtime) to avoid bcrypt cost on every module load
  - failedLoginAttempts uses $set (not $inc) for lockout trigger case — simplifies atomic update with lockedUntil
  - Deactivated account check kept after password check (existing behavior unchanged)
  - Pre-lockout warning uses $set for consistency with lockout trigger path
metrics:
  duration: "~8 minutes"
  completed: "2026-04-20T10:23:18Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase 10 Plan 01: Login Rate Limiting Summary

**One-liner:** Brute-force protection via 5-attempt lockout with progressive duration (15/30/60.../1440 min), 429 Retry-After responses, and timing-safe DUMMY_HASH for email enumeration prevention.

## What Was Implemented

### Task 1: User interface extension (api/src/shared/types.ts)

Three optional fields added to the `User` interface after `active`:

- `failedLoginAttempts?: number` — consecutive failed login attempts; missing treated as 0
- `lockedUntil?: Date` — lockout expiry timestamp; absent means not locked
- `lockoutCount?: number` — total lockout cycles, drives progressive duration

All optional — existing MongoDB documents without these fields work correctly. No migration required.

### Task 2: Rate-limited login handler (api/src/functions/auth.ts)

`getLoginHandler()` now enforces five behaviors:

1. **Timing mitigation** — when email not found, runs `bcrypt.compare(password, DUMMY_HASH)` before returning 401, preventing email enumeration via response time differences.

2. **Active lockout check** — if `user.lockedUntil > now`, returns 429 immediately with `Retry-After` header. No DB writes, no bcrypt call.

3. **Attempt tracking** — wrong password increments `failedLoginAttempts` via `$set`. Returns 401 with warning: `"Invalid credentials. N attempt(s) remaining before account lockout."` (singular/plural handled correctly).

4. **Lockout trigger** — on 5th failed attempt: computes `durationMinutes = Math.min(15 * Math.pow(2, newLockoutCount - 1), 1440)`, writes `lockedUntil` + `lockoutCount` + resets `failedLoginAttempts: 0`. Returns 429 with `Retry-After`.

5. **Counter reset on success** — successful login sets `failedLoginAttempts: 0, lockoutCount: 0` in the same `updateOne` as `lastLoginAt`.

Progressive lockout schedule: lockoutCount 1→15m, 2→30m, 3→60m, 4→120m, 5→240m, ..., capped at 1440m (24h).

## Key Decisions Made

- **DUMMY_HASH as literal string** — The plan specified hardcoding the output of `bcrypt.hashSync('dummy', 10)` as a constant so it never recomputes at runtime. Value used: `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`.

- **$set for failedLoginAttempts** — The plan suggested `$inc` for the warning path but `$set` was used throughout for consistency. `newCount` is computed locally as `(user.failedLoginAttempts ?? 0) + 1` and written with `$set`. This matches the lockout-trigger path (which must also write `lockedUntil` atomically in the same operation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated authEndpoints.test.ts Test 4 to match new behavior**
- **Found during:** GREEN phase (running existing tests after implementation)
- **Issue:** Test 4 in `authEndpoints.test.ts` expected `error === 'Invalid credentials'` for a wrong password, but the new handler now returns `'Invalid credentials. 4 attempts remaining before account lockout.'`
- **Fix:** Updated assertion to use `toContain('Invalid credentials')` and `toContain('remaining before account lockout')` — both expectations reflect the correct new behavior
- **Files modified:** `api/src/__tests__/authEndpoints.test.ts`
- **Commit:** included in `6d7e3a5`

## Test Results

- **New tests:** 13 tests in `loginRateLimiting.test.ts` — all pass
- **Existing API tests:** 312 total (up from 299) — all pass
- **TypeScript build:** clean (tsc exits 0)

## Verification Commands Passed

```
grep -n "failedLoginAttempts\|lockedUntil\|lockoutCount" api/src/shared/types.ts
# → 3 fields found at lines 97-99

grep -n "DUMMY_HASH\|429\|Retry-After\|lockedUntil\|lockoutCount\|remaining before account lockout" api/src/functions/auth.ts
# → All key markers found

cd api && npm run build
# → Clean (exit 0)

cd api && npx vitest run
# → 312 passed
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 5fd38ef | feat(10-01): extend User interface with rate limiting fields |
| Task 2 RED | cb76fda | test(10-01): add failing tests for login rate limiting |
| Task 2 GREEN | 6d7e3a5 | feat(10-01): implement brute-force protection on login endpoint |

## Known Stubs

None — all rate limiting logic is fully wired to the User document in MongoDB.

## Self-Check: PASSED

- FOUND: api/src/shared/types.ts
- FOUND: api/src/functions/auth.ts
- FOUND: api/src/__tests__/loginRateLimiting.test.ts
- FOUND: .planning/phases/10-login-rate-limiting/10-01-SUMMARY.md
- FOUND commit: 5fd38ef (Task 1)
- FOUND commit: cb76fda (Task 2 RED)
- FOUND commit: 6d7e3a5 (Task 2 GREEN)
