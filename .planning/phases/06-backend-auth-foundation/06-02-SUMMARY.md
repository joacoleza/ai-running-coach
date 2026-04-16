---
phase: 06-backend-auth-foundation
plan: "02"
subsystem: auth
tags: [jwt, bcrypt, mongodb, azure-functions, authentication]

# Dependency graph
requires:
  - phase: 06-01
    provides: User and RefreshToken interfaces in types.ts, DB indexes for users/refresh_tokens
  - phase: 06-03
    provides: requireAuth middleware used by logout handler
provides:
  - POST /api/auth/login — validates email+password, returns JWT + refresh token
  - POST /api/auth/refresh — exchanges valid refresh token for new JWT access token
  - POST /api/auth/logout — revokes refresh token, returns 204
  - auth.ts registered in index.ts as Azure Function
affects:
  - 06-03 (requireAuth middleware called by logout handler)
  - 06-04 (integration tests exercise all three endpoints)
  - phase-7 (frontend auth uses these three endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exported handler factories (getLoginHandler, getRefreshHandler, getLogoutHandler) for unit testability while still registering with app.http()"
    - "SHA-256 hash of raw refresh token stored in DB — raw token only in response body, never persisted"
    - "Same 401 error message for both wrong email and wrong password — prevents user enumeration"

key-files:
  created:
    - api/src/functions/auth.ts
    - api/src/__tests__/authEndpoints.test.ts
  modified:
    - api/src/index.ts

key-decisions:
  - "Exported handler factories pattern: getLoginHandler/getRefreshHandler/getLogoutHandler allow direct unit testing while app.http() registers them for Azure Functions runtime"
  - "Uniform 401 error for both user-not-found and wrong-password prevents user enumeration"

patterns-established:
  - "Handler factory pattern: export get*Handler() functions alongside app.http() registrations so tests can invoke handlers directly"

requirements-completed: [AUTH-01, AUTH-02, AUTH-05]

# Metrics
duration: 18min
completed: 2026-04-15
---

# Phase 06 Plan 02: Auth Endpoints Summary

**Three JWT auth endpoints (login/refresh/logout) with SHA-256 hashed refresh tokens, 15-min JWT access tokens, and 30-day refresh token TTL stored in MongoDB**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-15T11:00:00Z
- **Completed:** 2026-04-15T11:18:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `api/src/functions/auth.ts` with three Azure Functions HTTP handlers (login, refresh, logout)
- Login validates credentials via bcrypt, issues signed JWT (15 min) + raw refresh token (stored as SHA-256 hash, 30-day TTL)
- Refresh exchanges valid token for new JWT; logout deletes refresh token from DB and returns 204
- 15 unit tests covering all success paths and edge cases using TDD (RED → GREEN)
- Registered `import './functions/auth.js'` in `api/src/index.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth.ts with login, refresh, logout handlers** - `446d899` (feat)
2. **Task 2: Register auth.ts in index.ts** - `48ff076` (feat)

## Files Created/Modified
- `api/src/functions/auth.ts` - Three Azure Functions HTTP handlers: login, refresh, logout
- `api/src/__tests__/authEndpoints.test.ts` - 15 unit tests for all handler logic
- `api/src/index.ts` - Added `import './functions/auth.js'` after health.js

## Decisions Made
- Used exported handler factory pattern (`getLoginHandler()`, etc.) so unit tests can invoke handlers directly without needing a full Azure Functions runtime — this avoids heavy test setup while still registering via `app.http()` for production use.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Tests fail as expected during RED phase (module not found), then all 15 pass in GREEN phase. Full API suite (223 tests) remains green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Auth endpoints are fully implemented and tested
- Plan 03 (JWT middleware) runs in parallel in Wave 2 — `requireAuth` is already available from `middleware/auth.ts`
- Plan 04 (integration tests + wire-up) can proceed once Wave 2 (Plans 02 + 03) is complete
- TypeScript build will pass once Plan 03's middleware exports are fully merged

---
*Phase: 06-backend-auth-foundation*
*Completed: 2026-04-15*
