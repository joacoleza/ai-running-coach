---
phase: 08-data-isolation-migration
plan: "02"
subsystem: api
tags: [data-isolation, mongodb, auth, userId, ObjectId, query-scoping]

dependency_graph:
  requires:
    - phase: 08-01
      provides: userId-on-Plan/Run/ChatMessage types, getAuthContext middleware, compound indexes
  provides:
    - userId-scoped queries in all 7 protected handler files
    - userId stamped on all new plan, run, and message documents at creation
    - DATA-01 server-side enforcement of per-user data isolation
    - integration tests verifying isolation behavior
  affects: [api/src/functions/plan.ts, api/src/functions/planDays.ts, api/src/functions/planPhases.ts, api/src/functions/planArchive.ts, api/src/functions/runs.ts, api/src/functions/messages.ts, api/src/functions/chat.ts]

tech-stack:
  added: []
  patterns: [getAuthContext-userId-scope, cross-user-404-not-403, creation-time-userId-stamp]

key-files:
  created:
    - api/src/__tests__/plan.isolation.test.ts
    - api/src/__tests__/runs.isolation.test.ts
  modified:
    - api/src/functions/plan.ts
    - api/src/functions/planDays.ts
    - api/src/functions/planPhases.ts
    - api/src/functions/planArchive.ts
    - api/src/functions/runs.ts
    - api/src/functions/messages.ts
    - api/src/functions/chat.ts
    - api/src/__tests__/planArchive.test.ts
    - api/src/__tests__/messages.test.ts
    - api/src/__tests__/planPhases.test.ts
    - api/src/__tests__/chat.integration.test.ts

key-decisions:
  - "Cross-user access returns 404 (not 403) — never reveals that another user's resource exists"
  - "totalAll in listRuns now counts only the authenticated user's runs (not all runs in DB)"
  - "Existing test files required getAuthContext mock and userId in test data to stay green"

patterns-established:
  - "Every protected handler: requireAuth → getAuthContext → new ObjectId(userId) in every DB query"
  - "New document inserts always include userId: new ObjectId(userId)"

requirements-completed: [DATA-01]

duration: ~25min
completed: "2026-04-18"
---

# Phase 08 Plan 02: userId-Scoped Queries in All Handler Files Summary

**All 7 protected handler files now filter every MongoDB query by `userId: new ObjectId(userId)`, preventing any cross-user data access at the database level.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-18T02:40:00Z
- **Completed:** 2026-04-18T03:05:00Z
- **Tasks:** 3
- **Files modified:** 11 (7 handler files + 4 test files)

## Accomplishments

- Added `getAuthContext(req)` call immediately after `requireAuth` in all 7 handler files (plan.ts, planDays.ts, planPhases.ts, planArchive.ts, runs.ts, messages.ts, chat.ts)
- Added `userId: new ObjectId(userId)` to every `findOne`, `find`, `findOneAndUpdate`, `updateOne`, `deleteOne` filter in all 7 files (47 total occurrences)
- Set `userId: new ObjectId(userId)` on new documents at creation time (createPlan, createRun, user/assistant ChatMessage inserts in chat.ts)
- Created `plan.isolation.test.ts` (4 tests) and `runs.isolation.test.ts` (5 tests) verifying isolation
- Fixed 4 existing test files to add `getAuthContext` mock and `userId` to test data inserts

## Task Commits

1. **Task 1: Scope plan.ts, planDays.ts, planPhases.ts** - `603982f` (feat)
2. **Task 2: Scope planArchive.ts, runs.ts, messages.ts, chat.ts** - `4060cb1` (feat)
3. **Task 3: Integration tests for userId scoping** - `411fce9` (test)

## Files Created/Modified

- `api/src/functions/plan.ts` — getPlan, createPlan, patchPlan all filter by userId; new plan gets userId
- `api/src/functions/planDays.ts` — patchDay, deleteDay, addDay all filter by userId
- `api/src/functions/planPhases.ts` — patchPhase, addPhase, addWeekToPhase, deleteLastPhase all filter by userId
- `api/src/functions/planArchive.ts` — archivePlan, listArchivedPlans, getArchivedPlan filter by userId; linked runs also scoped
- `api/src/functions/runs.ts` — createRun sets userId; listRuns, getRun, updateRun, deleteRun, linkRun, unlinkRun all filter by userId
- `api/src/functions/messages.ts` — GET /api/messages filters by planId AND userId
- `api/src/functions/chat.ts` — userMsg and assistantMsg inserts include userId; plan fetch and linked runs fetch scoped by userId
- `api/src/__tests__/plan.isolation.test.ts` — 4 isolation tests for getPlan and createPlan
- `api/src/__tests__/runs.isolation.test.ts` — 5 isolation tests for createRun, listRuns, deleteRun

## Decisions Made

- Cross-user access returns 404 (not 403) per D-06 — prevents information leakage about resource existence
- `totalAll` in `listRuns` now counts only the authenticated user's runs to keep the count meaningful per-user
- Existing tests in planArchive, messages, planPhases, and chat.integration needed `getAuthContext` mock added and `userId` field on all test plan/run documents to remain passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 4 existing test files broken by userId scoping**
- **Found during:** Task 3 (integration tests)
- **Issue:** planArchive.test.ts, messages.test.ts, planPhases.test.ts, chat.integration.test.ts all mocked `requireAuth` but not `getAuthContext`, causing handler to throw "getAuthContext called before requireAuth". Also, all plan/run documents were inserted without `userId`, so userId-scoped queries returned no results.
- **Fix:** Added `getAuthContext: vi.fn().mockReturnValue({ userId: TEST_USER_ID, ... })` to each vi.mock call; added `userId: TEST_USER_OID` to all plan/run inserts in those test files
- **Files modified:** api/src/__tests__/planArchive.test.ts, messages.test.ts, planPhases.test.ts, chat.integration.test.ts
- **Verification:** All 249 API tests pass
- **Committed in:** 411fce9 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix in existing tests)
**Impact on plan:** Required fix for test correctness. No scope creep.

## Issues Encountered

None — implementation straightforward. Test fix was necessary and expected when adding userId filtering to queries.

## Self-Check: PASSED

- [x] api/src/functions/plan.ts — getAuthContext + new ObjectId(userId) in 4 places
- [x] api/src/functions/planDays.ts — new ObjectId(userId) in all plan queries
- [x] api/src/functions/planPhases.ts — new ObjectId(userId) in all plan queries
- [x] api/src/functions/planArchive.ts — new ObjectId(userId) in all plan/run queries
- [x] api/src/functions/runs.ts — new ObjectId(userId) in all run queries; userId set at creation
- [x] api/src/functions/messages.ts — find({ planId, userId: new ObjectId(userId) })
- [x] api/src/functions/chat.ts — userId on ChatMessage inserts; plan + run fetches scoped
- [x] api/src/__tests__/plan.isolation.test.ts — 4 isolation tests
- [x] api/src/__tests__/runs.isolation.test.ts — 5 isolation tests
- [x] npx tsc --noEmit exits 0
- [x] npm test: 249/249 pass
- [x] Commits 603982f, 4060cb1, 411fce9 exist

## Next Phase Readiness

- DATA-01 (per-user data isolation) fully implemented server-side
- Phase 08-03 (startup migration) can now run safely — migrates orphaned documents to admin user
- Phase 09 (Admin Panel) can use `requireAdmin` (from 08-01) and trust that all queries are already user-scoped
