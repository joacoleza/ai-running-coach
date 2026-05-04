---
phase: 14-gym-support
plan: "03"
subsystem: ui
tags: [react, typescript, exercise-logging, gym, modal, tailwind]

# Dependency graph
requires:
  - phase: 14-01
    provides: Exercise interface, discipline field on Run type, updateRun hook

provides:
  - ExerciseForm component (inline form: name/sets/reps/weight/unit with validation)
  - ExerciseList component (exercise management with add/remove/save-to-API)
  - RunDetailModal gym session integration (Session Exercises section for discipline=gym)
  - updateRun accepts exercises field

affects: [14-04, 14-05, 15, 16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ExerciseForm: controlled form with isValid guard on Save button, errors shown inline below fields"
    - "ExerciseList: local state buffer with PATCH flush on Done button press"
    - "Conditional section in RunDetailModal based on run.discipline === 'gym'"

key-files:
  created:
    - web/src/components/runs/ExerciseForm.tsx
    - web/src/components/runs/ExerciseList.tsx
    - web/src/__tests__/ExerciseForm.test.tsx
  modified:
    - web/src/components/runs/RunDetailModal.tsx
    - web/src/hooks/useRuns.ts
    - web/src/__tests__/RunDetailModal.test.tsx

key-decisions:
  - "ExerciseList buffers exercise changes in local state and flushes to API only on 'Done' click — avoids a PATCH per add/remove"
  - "RunDetailModal passes onUpdated directly as ExerciseList.onUpdate — no wrapper needed since API returns updated Run"
  - "Soft limit at 15 exercises (warning), hard limit at 20 (hides add button) — per UI-SPEC"

patterns-established:
  - "Local-buffer + Done flush: accumulate UI changes locally, single API call on explicit confirmation"
  - "Conditional discipline section: run.discipline === 'gym' guard in JSX (not display:none)"

requirements-completed: [GYM-02]

# Metrics
duration: 10min
completed: 2026-05-04
---

# Phase 14 Plan 03: Gym Exercise Entry UI Summary

**ExerciseForm + ExerciseList components for logging exercises against gym sessions, integrated into RunDetailModal behind a discipline=gym guard**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-04T00:45:55Z
- **Completed:** 2026-05-04T00:55:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- ExerciseForm validates name (required, max 100), sets/reps (integers 1-99), optional weight (>0) with unit selector that appears only when weight is filled
- ExerciseList renders existing exercises per run, supports add/remove locally, and saves to API via PATCH /api/runs/:id on Done
- RunDetailModal now shows "Session Exercises" section with ExerciseList exclusively when run.discipline === 'gym'; non-gym sessions see no change
- updateRun in useRuns.ts extended to accept exercises in updates parameter
- All 21 tests pass (7 ExerciseForm + 14 RunDetailModal including 2 new gym-specific tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ExerciseForm component and tests** - `061bdf0` (feat)
2. **Task 2: Create ExerciseList + integrate into RunDetailModal for gym sessions** - `2d7d8b3` (feat)

**Plan metadata:** (docs commit after SUMMARY)

_Note: Both tasks used TDD (RED → GREEN)_

## Files Created/Modified
- `web/src/components/runs/ExerciseForm.tsx` - Inline exercise entry form with field validation
- `web/src/components/runs/ExerciseList.tsx` - Exercise list manager with local buffer and PATCH flush
- `web/src/__tests__/ExerciseForm.test.tsx` - 7 unit tests for ExerciseForm
- `web/src/components/runs/RunDetailModal.tsx` - Added ExerciseList import + gym discipline conditional section
- `web/src/hooks/useRuns.ts` - Extended updateRun type to accept exercises field
- `web/src/__tests__/RunDetailModal.test.tsx` - Added ExerciseList mock + 2 new gym session tests

## Decisions Made
- ExerciseList buffers exercise changes in local state and flushes to API only on Done click — avoids a PATCH per add/remove operation
- RunDetailModal passes onUpdated directly as ExerciseList.onUpdate since API returns updated Run
- Soft limit at 15 exercises (warning banner), hard limit at 20 (hides Add Exercise button)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - ExerciseList reads from run.exercises (loaded from API) and writes back via PATCH. No hardcoded empty values in the data path.

## Next Phase Readiness
- Exercise entry UI complete for gym sessions in the run detail modal
- ExerciseForm is a standalone component ready for reuse in plan day exercise checklists (Plan 14-04)
- ExerciseList's Done pattern can be adapted for plan day exercise tick-off (separate component will be needed per UI-SPEC)

---
*Phase: 14-gym-support*
*Completed: 2026-05-04*
