---
phase: 07-frontend-auth
plan: "03"
subsystem: testing
tags: [auth, jwt, vitest, playwright, bcrypt, e2e, unit-tests]

requires:
  - phase: 07-02
    provides: [App.tsx auth gate with JWT, AuthContext with login/logout, 401 interceptor]
  - phase: 07-01
    provides: [AuthContext, LoginPage, ChangePasswordPage, change-password endpoint]
provides:
  - JWT-based unit tests for App auth gate (LoginPage, ChangePasswordPage, AppShell, 401 interceptor)
  - Sidebar logout button unit test with AuthContext mock
  - E2E global-setup seeds test users with bcrypt hashes in running-coach DB
  - E2E auth.spec.ts covering login/failure/temp-password/change-password/logout flows
  - All existing E2E specs migrated from app_password to access_token
affects: [phase-08, CI-badge-counts]

tech-stack:
  added: [bcrypt at root level for global-setup.ts]
  patterns:
    - vi.mock AuthContext pattern for components/hooks that call useAuth
    - page.route api/runs mock in E2E helpers to prevent 401 interceptor logout

key-files:
  created:
    - e2e/auth.spec.ts
  modified:
    - web/src/__tests__/App.auth.test.tsx
    - web/src/components/layout/Sidebar.test.tsx
    - web/src/__tests__/AppShell.test.tsx
    - web/src/__tests__/Archive.test.tsx
    - web/src/__tests__/ArchivePlan.test.tsx
    - web/src/__tests__/Runs.test.tsx
    - web/src/__tests__/TrainingPlan.test.tsx
    - web/src/__tests__/TrainingPlan.feedback.test.tsx
    - web/src/__tests__/TrainingPlan.scroll.test.tsx
    - web/src/__tests__/useChat.startOver.test.ts
    - web/src/__tests__/useChat.trainingPlan.test.ts
    - web/src/__tests__/usePlan.test.ts
    - web/src/__tests__/useRuns.test.ts
    - e2e/global-setup.ts
    - playwright.config.ts
    - e2e/dashboard.spec.ts
    - e2e/runs.spec.ts
    - e2e/training-plan.spec.ts
    - e2e/coach.spec.ts

key-decisions:
  - "AuthContext mocked via vi.mock in each test file rather than global setup — keeps test isolation explicit"
  - "client.db('running-coach') in global-setup to match API database name (default db() would use 'test')"
  - "api/runs mock added to E2E helpers because fake JWT triggers 401 interceptor -> logout on unmocked endpoints"
  - "bcrypt installed at root level (not api/) to keep global-setup.ts dependency clear"

requirements-completed:
  - AUTH-03
  - AUTH-04

duration: ~90min
completed: 2026-04-16
---

# Phase 7 Plan 03: Test Coverage for JWT Auth — Summary

**JWT auth unit tests rewritten and E2E auth flow fully covered: 427 web unit tests + 66 E2E tests all green after migrating from app_password to access_token auth pattern**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-04-16T00:04:00Z
- **Completed:** 2026-04-16T03:22:00Z
- **Tasks:** 3
- **Files modified:** 22

## Accomplishments

- Rewrote App.auth.test.tsx with 4 JWT-based tests: LoginPage when no token, ChangePasswordPage when tempPassword, AppShell when authenticated, 401 triggers logout
- Added vi.mock AuthContext to 11 test files that broke after Plan 02 introduced useAuth() in hooks/components
- Updated useRuns test to check `Authorization: Bearer` header instead of `x-app-password`
- Created e2e/auth.spec.ts with 7 tests covering the complete auth flow end-to-end
- Updated e2e/global-setup.ts to seed test@example.com and temp@example.com with bcrypt hashes in running-coach DB
- Migrated all 4 existing E2E specs from app_password to access_token + auth_email + auth_temp_password
- Added api/runs mocks to all E2E helpers to prevent 401 interceptor from firing with fake e2e tokens

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite App.auth unit test and Sidebar unit test for JWT auth** - `fa04769` (feat)
2. **Task 2: Update E2E global-setup to seed JWT test users and add auth.spec.ts** - `4141dd9` (feat)
3. **Task 3: Update existing E2E tests from app_password to access_token** - `5b1ca5c` (feat)
4. **Deviation fix: add api/runs mocks to E2E specs** - `a986ce1` (fix)

**Plan metadata:** (this summary commit)

## Files Created/Modified

- `web/src/__tests__/App.auth.test.tsx` - Rewrote all 4 tests for JWT auth gate
- `web/src/components/layout/Sidebar.test.tsx` - Added AuthContext mock + logout button test
- `web/src/__tests__/AppShell.test.tsx` - Added AuthContext mock
- `web/src/__tests__/Archive.test.tsx` - Added AuthContext mock, replaced app_password with access_token
- `web/src/__tests__/ArchivePlan.test.tsx` - Added AuthContext mock
- `web/src/__tests__/Runs.test.tsx` - Added AuthContext mock
- `web/src/__tests__/TrainingPlan.test.tsx` - Added AuthContext mock
- `web/src/__tests__/TrainingPlan.feedback.test.tsx` - Added AuthContext mock
- `web/src/__tests__/TrainingPlan.scroll.test.tsx` - Added AuthContext mock
- `web/src/__tests__/useChat.startOver.test.ts` - Added AuthContext mock, replaced app_password with access_token
- `web/src/__tests__/useChat.trainingPlan.test.ts` - Added AuthContext mock, replaced app_password with access_token
- `web/src/__tests__/usePlan.test.ts` - Added AuthContext mock, replaced app_password with access_token
- `web/src/__tests__/useRuns.test.ts` - Updated auth header assertion to Bearer token
- `e2e/global-setup.ts` - Seeds test@example.com + temp@example.com with bcrypt hashes in running-coach DB
- `playwright.config.ts` - Added JWT_SECRET env var to webServer
- `e2e/auth.spec.ts` - New: 7 E2E tests for complete auth flow
- `e2e/dashboard.spec.ts` - Migrated app_password to access_token
- `e2e/runs.spec.ts` - Migrated app_password to access_token, added api/runs mock to loginWithPlan
- `e2e/training-plan.spec.ts` - Migrated app_password to access_token, added api/runs mocks
- `e2e/coach.spec.ts` - Migrated app_password to access_token, added api/runs mocks

## Decisions Made

- AuthContext mocked via vi.mock in each test file (not global setup): keeps test isolation explicit and visible
- client.db('running-coach') in global-setup: default db() returns 'test' db which the API never uses
- api/runs mock required in all E2E helpers: fake JWT `e2e-test-token` causes real API to return 401, triggering the 401 interceptor which calls logout() and clears auth state, breaking all subsequent tests
- bcrypt installed at root level via package.json devDependencies rather than importing from api/node_modules

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing AuthContext failures in 11 test files**
- **Found during:** Task 1 (running web unit tests)
- **Issue:** Plans 01-02 added useAuth() to Sidebar, useChat, usePlan, and useRuns, but tests weren't updated. 129 of 427 tests failed with "useAuth must be used inside AuthProvider"
- **Fix:** Added vi.mock('../contexts/AuthContext', ...) to AppShell.test, Archive.test, ArchivePlan.test, Runs.test, TrainingPlan.test, TrainingPlan.feedback.test, TrainingPlan.scroll.test, useChat.startOver.test, useChat.trainingPlan.test, usePlan.test. Updated useRuns.test auth header assertion.
- **Files modified:** 11 test files
- **Committed in:** fa04769

**2. [Rule 1 - Bug] Fixed uncommitted Plan 02 source changes**
- **Found during:** Task 1 (git status showed many modified non-test files)
- **Issue:** Plan 02 changed hooks (useChat, usePlan, useRuns) and pages (Archive, ArchivePlan, TrainingPlan) from x-app-password to JWT Bearer auth but didn't commit them. Tests were failing because source and test expectations didn't match.
- **Fix:** Staged and committed alongside Task 1 test fixes
- **Files modified:** web/src/hooks/useChat.ts, web/src/hooks/usePlan.ts, web/src/hooks/useRuns.ts, web/src/pages/Archive.tsx, web/src/pages/ArchivePlan.tsx, web/src/pages/TrainingPlan.tsx, web/src/components/layout/Sidebar.tsx, web/src/App.tsx
- **Committed in:** fa04769

**3. [Rule 1 - Bug] Fixed E2E tests failing due to 401 interceptor with fake JWT token**
- **Found during:** Task 2/3 (running full E2E suite)
- **Issue:** Fake `e2e-test-token` in E2E tests caused real API calls (api/runs) to return 401. The App.tsx 401 interceptor fired, tried to refresh (also 401), then called logout() - clearing auth state and showing LoginPage mid-test.
- **Fix:** Added page.route('**/api/runs**') mock to all E2E helper functions and affected describe blocks
- **Files modified:** e2e/runs.spec.ts, e2e/training-plan.spec.ts, e2e/coach.spec.ts
- **Committed in:** a986ce1

**4. [Rule 1 - Bug] Fixed global-setup using wrong MongoDB database**
- **Found during:** Task 2 (temp-password E2E tests failing)
- **Issue:** client.db() without args uses 'test' database; API uses client.db('running-coach'). Users seeded in 'test' were never found by the auth handler.
- **Fix:** Changed to client.db('running-coach')
- **Files modified:** e2e/global-setup.ts
- **Committed in:** a986ce1

---

**Total deviations:** 4 auto-fixed (all Rule 1 - bugs from prior phases not caught before commit)
**Impact on plan:** All auto-fixes necessary for tests to function. No scope creep.

## Issues Encountered

None beyond the auto-fixed bugs.

## Known Stubs

None - all test logic is fully implemented. Auth flows are tested end-to-end with real seeded users.

## Next Phase Readiness

- Phase 7 complete: AuthContext, LoginPage, ChangePasswordPage, App auth gate, 401 interceptor, and full test coverage
- Ready for Phase 8: Data Isolation & Migration (plans/runs/messages scoped to authenticated user)

---
*Phase: 07-frontend-auth*
*Completed: 2026-04-16*

## Self-Check: PASSED
