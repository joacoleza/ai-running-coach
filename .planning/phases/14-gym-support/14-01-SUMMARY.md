---
phase: 14-gym-support
plan: "01"
subsystem: api, ui
tags: [typescript, react, mongodb, exercise, gym, discipline]

requires:
  - phase: 13-discipline-foundation
    provides: Discipline type and discipline field on Run/PlanDay

provides:
  - Exercise interface in api/src/shared/types.ts with all 7 fields
  - Run.exercises and PlanDay.exercises optional fields in types.ts and useRuns.ts
  - POST /api/runs accepts discipline=gym with no distance required (pace=0)
  - POST /api/runs accepts type and exercises[] fields validated (max 20, name/sets/reps required)
  - PATCH /api/runs/:id accepts type and exercises[] fields
  - GET /api/runs accepts ?discipline= filter query param
  - RunEntryForm with discipline selector (Run/Gym/Cycling) defaulting to 'run'
  - RunEntryForm conditionally renders distance (hidden for gym) vs Session Type dropdown
  - CreateRunInput extended with discipline and type fields

affects: [14-02, 14-03, 14-04, 14-05]

tech-stack:
  added: []
  patterns:
    - Discipline-gated form rendering using conditional JSX (not display:none)
    - Gym sessions stored with distance=0 and pace=0 when no distance provided

key-files:
  created: []
  modified:
    - api/src/shared/types.ts
    - api/src/functions/runs.ts
    - api/src/__tests__/runs.test.ts
    - web/src/hooks/useRuns.ts
    - web/src/components/runs/RunEntryForm.tsx
    - web/src/__tests__/RunEntryForm.test.tsx

key-decisions:
  - "Gym sessions store distance=0 and pace=0 rather than null/undefined to avoid breaking run list calculations"
  - "Exercise validation enforces max 20 items, name/sets/reps required, weight/unit optional"
  - "Discipline selector resets gymType and distance when switching disciplines"

patterns-established:
  - "Conditional form rendering: use JSX conditional ({!isGym && <DistanceField/>}) not CSS visibility"
  - "Gym validation checks gymType non-empty instead of distance > 0"

requirements-completed: [GYM-01, GYM-02, DISC-03]

duration: 45min
completed: 2026-05-04
---

# Plan 14-01: Gym Data Model, API & Entry Form Summary

**Exercise interface + gym-aware API (type/exercises fields, discipline filter, no-distance gym sessions) + RunEntryForm discipline selector with conditional field rendering**

## Performance

- **Duration:** ~45 min (split across two sessions)
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Exercise interface exported from types.ts with 7 fields (name, sets, reps, weight?, unit?, completed?, skipped?)
- POST /api/runs now accepts gym sessions without distance; PATCH accepts exercises[]/type; GET accepts ?discipline= filter
- RunEntryForm shows discipline selector, conditionally renders distance vs Session Type based on selection

## Task Commits

1. **Task 1: Add Exercise interface to types.ts and extend Run + PlanDay** - `db076f3`
2. **Task 2: Update POST/PATCH/GET runs API to handle gym fields** - `7f33c4e`
3. **Task 3: Update RunEntryForm with discipline selector + conditional field rendering** - `16cccbd`

## Files Created/Modified
- `api/src/shared/types.ts` - Exercise interface, Run.type/exercises, PlanDay.exercises
- `api/src/functions/runs.ts` - Gym-aware POST validation, type/exercises storage, discipline filter
- `api/src/__tests__/runs.test.ts` - 4 new tests (gym session, run-no-distance rejection, discipline filter, PATCH exercises)
- `web/src/hooks/useRuns.ts` - Exercise interface, Run.discipline/type/exercises, CreateRunInput.discipline/type
- `web/src/components/runs/RunEntryForm.tsx` - Discipline selector, conditional distance/Session Type, gym validation
- `web/src/__tests__/RunEntryForm.test.tsx` - 5 new tests, updated button label to "Save Session"

## Decisions Made
- distance=0/pace=0 for gym sessions rather than null to avoid breaking downstream calculations
- Button label changed from "Save run" to "Save Session" (discipline-agnostic)

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None - tests passed on first run.

## Next Phase Readiness
- All downstream plans (14-02 through 14-05) can build on Exercise interface and gym-aware API
- RunBadge (14-02) can use run.discipline to render badges
- ExerciseForm (14-03) can PATCH exercises[] via the updated API

---
*Phase: 14-gym-support*
*Completed: 2026-05-04*
