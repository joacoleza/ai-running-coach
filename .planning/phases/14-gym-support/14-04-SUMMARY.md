---
phase: 14-gym-support
plan: "04"
subsystem: ui
tags: [react, typescript, mongodb, gym, exercise-checklist, plan-view]

# Dependency graph
requires:
  - phase: 14-01
    provides: Exercise interface in api/src/shared/types.ts and patchDay discipline support
provides:
  - Exercise interface exported from web/src/hooks/usePlan.ts
  - ExerciseChecklistItem component with checkbox, name, sets/reps/weight display
  - DayRow renders collapsible exercise checklist for gym plan days
  - patchDay API accepts exercises JSON string for atomic array replacement
affects: [14-05, 14-06, 15-gym, phase-16-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic UI update pattern for exercise checkbox toggle (update local state, then PATCH, revert on error)
    - JSON-encoded array in PATCH body for subdocument array replacement (exercises JSON string)
    - Collapsible section pattern: expand/collapse toggle with chevron ▼/▶ + count

key-files:
  created:
    - web/src/components/plan/ExerciseChecklistItem.tsx
    - web/src/__tests__/ExerciseChecklistItem.test.tsx
  modified:
    - web/src/hooks/usePlan.ts
    - web/src/components/plan/DayRow.tsx
    - web/src/__tests__/DayRow.test.tsx
    - api/src/functions/planDays.ts
    - api/src/__tests__/planDays.test.ts

key-decisions:
  - "Exercises array sent as JSON-encoded string in PATCH body (exercises field) for simplicity — patchDay parses and replaces entire array atomically"
  - "Optimistic UI update for exercise checkbox: local state updated immediately, PATCH fires async, reverts on error"
  - "ExerciseChecklistItem mocked in DayRow tests to isolate rendering from deep component tree"

patterns-established:
  - "Collapsible exercise list with chevron icon: ▶/▼ prefix + count badge pattern for gym day sections"
  - "localExercises state + useEffect sync from day.exercises props for optimistic updates with revert"

requirements-completed: [GYM-03, GYM-04]

# Metrics
duration: 25min
completed: 2026-05-04
---

# Phase 14 Plan 04: Exercise Checklist for Gym Plan Days Summary

**Interactive exercise checklist on gym plan days: ExerciseChecklistItem component + collapsible DayRow section + patchDay exercises JSON support**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-04T00:46:00Z
- **Completed:** 2026-05-04T01:10:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created ExerciseChecklistItem component with checkbox (checked/unchecked), exercise name, and sets/reps/weight display; strikethrough styling on completion
- Exported Exercise interface from usePlan.ts; extended PlanDay with discipline? and exercises? fields
- Updated DayRow to show collapsible "Exercises (N)" expand trigger for gym days; optimistic checkbox toggle calls patchDay with JSON-encoded exercises array
- Extended patchDay API to accept exercises JSON string, parse and save entire exercises array to the plan day document; added validation for malformed JSON and non-array values
- 51 web tests pass (35 DayRow + 7 ExerciseChecklistItem + 9 pre-existing); 32 API planDays tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend PlanDay type + ExerciseChecklistItem component + patchDay API for exercises** - `d442a9c` (feat)
2. **Task 2: Update DayRow to render exercise checklist for gym plan days** - `bc85c7e` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `web/src/hooks/usePlan.ts` - Added Exercise interface export, added discipline? and exercises? to PlanDay
- `web/src/components/plan/ExerciseChecklistItem.tsx` - New component: checkbox + name + sets/reps/weight, strikethrough on done
- `web/src/__tests__/ExerciseChecklistItem.test.tsx` - 7 unit tests for the component
- `web/src/components/plan/DayRow.tsx` - Added exercisesExpanded state, localExercises sync, handleExerciseToggle, gym exercise section JSX
- `web/src/__tests__/DayRow.test.tsx` - Added ExerciseChecklistItem mock, 5 new gym day tests + waitFor import
- `api/src/functions/planDays.ts` - Added exercises?: string to patchDay body type; exercises JSON parse + $set block
- `api/src/__tests__/planDays.test.ts` - Added 3 patchDay exercises tests (valid update, invalid JSON, non-array)

## Decisions Made
- Exercises array sent as JSON-encoded string in PATCH body (matching existing `discipline?: string` pattern) rather than native JSON to keep body type consistent with the Azure Functions runtime coercion patterns already established in patchDay
- Optimistic UI update chosen over waiting for PATCH response to give immediate visual feedback; reverts on error
- ExerciseChecklistItem mocked in DayRow tests to prevent deep rendering and keep test isolation clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Git worktrees do not include node_modules by default; resolved by creating PowerShell junction links pointing worktree web/ and api/ node_modules to the main repo's corresponding directories. This allowed vitest to run directly from the worktree.

## Self-Check: PASSED
- ExerciseChecklistItem.tsx: FOUND
- ExerciseChecklistItem.test.tsx: FOUND
- 14-04-SUMMARY.md: FOUND
- Commit d442a9c: FOUND
- Commit bc85c7e: FOUND

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Exercise checklist UI complete for gym plan days (GYM-03, GYM-04)
- ExerciseChecklistItem available for reuse in RunDetailModal (Plan 05 or 06)
- patchDay API already accepts discipline and exercises — no further API changes needed for gym checklist
- Ready for Plan 14-05 (gym session logging UI in RunEntryForm)

---
*Phase: 14-gym-support*
*Completed: 2026-05-04*
