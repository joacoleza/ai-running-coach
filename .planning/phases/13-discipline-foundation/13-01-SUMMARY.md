---
phase: 13-discipline-foundation
plan: 01
subsystem: database
tags: [mongodb, typescript, migration, discipline]

# Dependency graph
requires: []
provides:
  - "Discipline union type (run | gym | cycle) exported from types.ts"
  - "Optional discipline field on Run interface"
  - "Optional discipline field on PlanDay interface"
  - "Idempotent startup migration that backfills discipline: 'run' on all pre-v3.0 run documents"
  - "Idempotent startup migration that backfills discipline: 'run' on non-rest plan day subdocuments via arrayFilters"
affects:
  - 13-02-PLAN
  - 13-03-PLAN
  - 14-gym-support
  - 15-cycling-support
  - 16-multi-discipline-dashboard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discipline backfill runs independently of userId orphan guard — placed after the if/else block, always executes on cold start"
    - "arrayFilters with 'day.type': { $ne: 'rest' } used to target only non-rest plan day subdocuments"
    - "Idempotency via { $exists: false } filter — already-migrated documents are naturally skipped"

key-files:
  created: []
  modified:
    - api/src/shared/types.ts
    - api/src/shared/migration.ts
    - api/src/shared/migration.test.ts

key-decisions:
  - "Discipline field is optional (?) in both Run and PlanDay to preserve backward compatibility with 30+ existing test fixtures"
  - "Discipline backfill restructured userId guard from early-return to if/else so discipline migration always runs on cold start"
  - "Test mock sequence corrected: when totalOrphans===0, conflict-check findOne is skipped, so discipline findOne is the first call"

patterns-established:
  - "Discipline type: always use the Discipline union type from types.ts, never inline string literals 'run'|'gym'|'cycle'"
  - "New startup migrations: add after existing migrations as independent sections, never inside existing guards"

requirements-completed:
  - DISC-01
  - DISC-02

# Metrics
duration: 25min
completed: 2026-04-29
---

# Phase 13 Plan 01: Discipline Foundation Summary

**Discipline union type (run|gym|cycle) added to TypeScript interfaces and startup migration extended to backfill discipline:'run' on all pre-v3.0 run and plan day documents via idempotent arrayFilter update**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-29T15:56:00Z
- **Completed:** 2026-04-29T16:21:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `export type Discipline = 'run' | 'gym' | 'cycle'` to types.ts as the single source of truth for discipline values
- Added optional `discipline?: Discipline` field to both the `Run` and `PlanDay` interfaces (backward-compatible)
- Extended `runStartupMigration` with a discipline backfill section that runs independently of the userId orphan guard
- Discipline backfill for runs uses `{ $exists: false }` filter (idempotent), for plan days uses `arrayFilters` with `type: { $ne: 'rest' }` guard
- Added 3 new unit tests covering: runs backfill, plan days backfill via arrayFilters, idempotency when all documents already have discipline

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Discipline type and optional field to types.ts** - `4583a2e` (feat)
2. **Task 2: Extend runStartupMigration with discipline backfill** - `72c5291` (feat)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN), combined into single feat commits_

## Files Created/Modified
- `api/src/shared/types.ts` - Added `Discipline` union type export and optional `discipline?` field to `Run` and `PlanDay` interfaces
- `api/src/shared/migration.ts` - Extended `runStartupMigration` with discipline backfill section placed after userId guard (if/else restructure)
- `api/src/shared/migration.test.ts` - Added `runStartupMigration — discipline backfill` describe block with 3 new tests

## Decisions Made

- **Discipline field optional**: Kept `discipline?: Discipline` optional in both interfaces. Making it required would break 30+ test files that construct `Run`/`PlanDay` objects without the field. The migration ensures all DB documents gain the field at cold start.
- **userId guard restructured**: Changed `if (totalOrphans === 0) { return; }` to `if/else` pattern so the discipline backfill section always executes, independent of whether there are userId orphans. This is the correct design for additive migrations.
- **Test mock correction**: The plan's test template had `mockResolvedValueOnce(null)` before `mockResolvedValueOnce({ _id: 'plan1' })` assuming the conflict check `findOne` fires first — but with `totalOrphans === 0`, that check is skipped. Fixed by using a single `mockResolvedValueOnce({ _id: 'plan1' })` directly for the discipline check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock sequence corrected for discipline findOne test**
- **Found during:** Task 2 (discipline backfill tests — GREEN phase)
- **Issue:** The plan's test template used two `mockResolvedValueOnce` calls (null then plan1) assuming the userId conflict-check `findOne` would fire before the discipline `findOne`. But with `orphanedPlans:0, orphanedRuns:0, orphanedMessages:0`, `totalOrphans===0` → the userId guard block is skipped entirely → the conflict check never fires → the discipline `findOne` consumes the first `null` → test failed.
- **Fix:** Removed the spurious first `mockResolvedValueOnce(null)` in the plan days test, leaving only `mockResolvedValueOnce({ _id: 'plan1' })` for the actual discipline check.
- **Files modified:** api/src/shared/migration.test.ts
- **Verification:** All 8 migration tests pass after fix.
- **Committed in:** `72c5291` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in plan's test template)
**Impact on plan:** Required correction for plan-provided test to function correctly with the restructured control flow. No scope creep.

## Issues Encountered
None beyond the test mock sequence correction documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `Discipline` type and optional fields are exported and ready for use in all downstream phases (13-02, 13-03, 14, 15, 16)
- All existing 347 API tests pass — no regressions
- Migration will run on next cold start and backfill all existing MongoDB documents
- Phase 13-02 (API discipline field exposure) can proceed immediately

---
*Phase: 13-discipline-foundation*
*Completed: 2026-04-29*
