---
phase: "06"
plan: "03"
subsystem: api-auth-middleware
tags: [auth, jwt, middleware, backend]
dependency_graph:
  requires: ["06-01"]
  provides: ["requireAuth middleware", "getAuthContext", "JWT-protected routes"]
  affects: ["all 8 protected API function files"]
tech_stack:
  added: []
  patterns: ["WeakMap for per-request auth context", "JWT Bearer token verification"]
key_files:
  created: []
  modified:
    - api/src/middleware/auth.ts
    - api/src/functions/health.ts
    - api/src/functions/chat.ts
    - api/src/functions/messages.ts
    - api/src/functions/plan.ts
    - api/src/functions/planArchive.ts
    - api/src/functions/planDays.ts
    - api/src/functions/planPhases.ts
    - api/src/functions/runs.ts
    - api/src/__tests__/auth.test.ts
decisions:
  - "WeakMap used to store per-request AuthContext — no JWT re-verification, no request mutation"
  - "Old lockout.integration.test.ts deleted — lockout feature (checkBlocked, MongoDB auth collection) removed entirely"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-04-15"
  tasks_completed: 2
  files_changed: 11
---

# Phase 06 Plan 03: JWT Auth Middleware Enforcement Summary

JWT-based `requireAuth` middleware replacing `requirePassword` across all 8 protected API route files, with `getAuthContext` exposing verified user identity to downstream handlers.

## What Was Built

- `api/src/middleware/auth.ts` fully rewritten: removed `requirePassword`, `checkBlocked`, `_resetConnectionForTest`, `APP_PASSWORD` logic; added stateless `requireAuth` (JWT Bearer verification) and `getAuthContext` (WeakMap lookup)
- All 8 protected function files (`health`, `chat`, `messages`, `plan`, `planArchive`, `planDays`, `planPhases`, `runs`) updated to import and call `requireAuth`
- `auth.test.ts` rewritten with 10 tests covering valid JWT, missing header, wrong scheme, expired token, wrong secret, malformed token, getAuthContext success, getAuthContext-before-auth error, and missing JWT_SECRET
- `lockout.integration.test.ts` deleted (lockout feature removed with requirePassword)
- All 8 function test mock files updated from `requirePassword` mock to `requireAuth` mock

## Verification

- `grep -rn "requirePassword" api/src/functions/` returns 0 matches
- `grep -n "export async function requireAuth" api/src/middleware/auth.ts` matches line 14
- `grep -n "export function getAuthContext" api/src/middleware/auth.ts` matches line 53
- `grep -n "APP_PASSWORD|requirePassword|checkBlocked|_resetConnectionForTest" api/src/middleware/auth.ts` returns 0 matches
- `cd api && npx tsc --noEmit` exits 0
- `npm test` — 223 tests pass (16 test files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 10 test files to use requireAuth mock**
- **Found during:** Task 2 verification
- **Issue:** All test files mocked `requirePassword` which no longer exists — would cause test failures
- **Fix:** Replaced `requirePassword` mock with `requireAuth` mock in health, chat, messages, plan, planArchive, planDays, planPhases, runs, chat.integration test files; rewrote auth.test.ts for new JWT behavior; deleted lockout.integration.test.ts (lockout feature removed)
- **Files modified:** 10 test files
- **Commits:** 9e1d91d

## Known Stubs

None — all auth functionality is fully implemented and verified.

## Self-Check: PASSED
- `api/src/middleware/auth.ts` — FOUND
- Commit 9e97603 (Task 1) — FOUND
- Commit 69567b2 (Task 2) — FOUND
- Commit 9e1d91d (Test updates) — FOUND
