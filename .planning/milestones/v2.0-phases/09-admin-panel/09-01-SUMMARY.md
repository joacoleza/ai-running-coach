---
phase: 09-admin-panel
plan: 01
subsystem: api
tags: [mongodb, bcrypt, jwt, azure-functions, admin]

# Dependency graph
requires:
  - phase: 08-data-isolation
    provides: Per-user data isolation, userId scoping, isAdmin flag on User model
  - phase: 06-backend-auth
    provides: requireAuth middleware, JWT signing, User/RefreshToken types, getDb pattern
provides:
  - Admin API: GET/POST /api/admin/users, POST /api/admin/users/:id/reset-password, PATCH /api/admin/users/:id
  - active field on User type enforced at login and every authenticated request
  - Admin handler factory pattern in api/src/functions/admin.ts
affects: [09-02-admin-ui, 09-03-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireAdmin() guard at top of every admin handler (calls requireAuth internally)"
    - "active !== false logic for legacy document compatibility (missing field = active)"
    - "Uniform 401 'Invalid credentials' for deactivated login (no user enumeration)"

key-files:
  created:
    - api/src/functions/admin.ts
    - api/src/__tests__/admin.test.ts
    - api/src/__tests__/adminAuth.test.ts
  modified:
    - api/src/shared/types.ts
    - api/src/middleware/auth.ts
    - api/src/functions/auth.ts
    - api/src/index.ts
    - api/src/__tests__/auth.test.ts
    - api/src/middleware/requireAdmin.test.ts

key-decisions:
  - "requireAuth does a DB lookup on every authenticated request to enforce active flag — no JWT claim caching"
  - "Deactivated login returns 401 'Invalid credentials' (not 'Account deactivated') to prevent user enumeration"
  - "Legacy documents without active field treated as active using user.active !== false pattern"
  - "Self-deactivation guard returns 400 'You cannot deactivate your own account.' (admin safety)"

patterns-established:
  - "Admin handlers: getXxxHandler() factory exported for unit testability, registered via app.http()"
  - "All admin routes call requireAdmin(req) as first line and return immediately if non-null"
  - "DB active check in requireAuth: after JWT verify, before authContextMap.set"

requirements-completed: [USER-01, USER-02, USER-03, USER-04, DATA-03]

# Metrics
duration: 35min
completed: 2026-04-19
---

# Phase 09 Plan 01: Admin Backend Summary

**Admin-only REST API (4 endpoints) with active-flag enforcement in every authenticated request and login**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-19T12:15:00Z
- **Completed:** 2026-04-19T12:27:00Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `active: boolean` field to User interface and enforced it in `requireAuth` (DB lookup after JWT verify) and `getLoginHandler` (check after bcrypt compare)
- Created `api/src/functions/admin.ts` with 4 handler factories: list users, create user with temp password, reset password, toggle active
- Full unit test coverage: 19 new tests across `admin.test.ts` and `adminAuth.test.ts` (296 total, all passing)
- Updated `auth.test.ts` and `requireAdmin.test.ts` to mock `getDb` for the new active check (auto-fix: Rule 1)

## Task Commits

1. **Task 1: Add `active` field and enforce in requireAuth + login** - `8e3af13` (feat)
2. **Task 2: Create admin API handlers** - `9d3b1ab` (feat)
3. **Task 3: Unit tests for admin handlers and deactivated user auth** - `2e0725c` (test)

## Files Created/Modified

- `api/src/shared/types.ts` - Added `active: boolean` field to User interface
- `api/src/middleware/auth.ts` - DB lookup after JWT verify to reject deactivated users; added ObjectId/getDb/User imports
- `api/src/functions/auth.ts` - Check `user.active === false` after bcrypt compare in login handler
- `api/src/functions/admin.ts` - 4 handler factories + Azure Functions registrations (NEW)
- `api/src/index.ts` - Added `import './functions/admin.js'`
- `api/src/__tests__/admin.test.ts` - Unit tests for all 4 admin handlers (NEW)
- `api/src/__tests__/adminAuth.test.ts` - Unit tests for deactivated user login/requireAuth (NEW)
- `api/src/__tests__/auth.test.ts` - Added getDb mock, valid ObjectId for sub, 2 new test cases
- `api/src/middleware/requireAdmin.test.ts` - Added getDb mock and valid ObjectId for sub field

## Decisions Made

- `requireAuth` performs a DB lookup on every authenticated request (not cached in JWT claim) to ensure deactivated users are immediately blocked without waiting for token expiry
- Login returns uniform `401 "Invalid credentials"` for deactivated accounts — same as wrong password — to prevent user enumeration
- `user.active !== false` pattern used throughout so existing documents without the field remain active (backward compatible)
- Self-deactivation blocked at PATCH handler level with 400 "You cannot deactivate your own account."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated auth.test.ts and requireAdmin.test.ts to mock getDb**
- **Found during:** Task 1 verification (running npm test after requireAuth change)
- **Issue:** `requireAuth` now calls `getDb()` after JWT verify; existing tests had no DB mock and failed with "MONGODB_CONNECTION_STRING not set"
- **Fix:** Added `vi.hoisted` + `vi.mock('../shared/db.js')` to both test files; updated token `sub` fields to use valid ObjectId strings; added 2 new test cases (deactivated user, legacy document)
- **Files modified:** `api/src/__tests__/auth.test.ts`, `api/src/middleware/requireAdmin.test.ts`
- **Verification:** All 277 (pre-task-3) tests passing after fix
- **Committed in:** `8e3af13` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in existing tests caused by new behavior)
**Impact on plan:** Necessary to maintain test suite integrity after requireAuth change. No scope creep.

## Issues Encountered

None — plan executed smoothly after auto-fixing the test suite for the new DB lookup in requireAuth.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 admin API endpoints are ready for the frontend admin UI (Phase 09 Plan 02)
- `active` flag enforcement is complete — deactivated users are blocked at login and on every API request
- Test coverage complete: 296 tests, all passing; TypeScript build clean

---
*Phase: 09-admin-panel*
*Completed: 2026-04-19*
