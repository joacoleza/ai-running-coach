---
phase: 16-multi-discipline-dashboard
plan: "01"
subsystem: api
tags: [exercise-weights, gym, dashboard, tdd]
dependency_graph:
  requires: []
  provides: [GET /api/runs/exercise-weights]
  affects: [api/src/functions/runs.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, MongoMemoryServer unit test, Azure Functions HTTP handler]
key_files:
  created:
    - api/src/__tests__/exerciseWeights.test.ts
  modified:
    - api/src/functions/runs.ts
decisions:
  - Route runs/exercise-weights registered before runs/{id} wildcard to prevent Azure Functions parameter shadowing
  - Filter by discipline:'gym' server-side (not client-side) for correctness and efficiency
  - Exercises without weight (body-weight) excluded by checking weight !== undefined && !== null
metrics:
  duration: "2m 27s"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 16 Plan 01: Exercise Weights API Endpoint Summary

## One-liner

GET /api/runs/exercise-weights endpoint returning max weight per gym session for a specific exercise, powering the weight progression chart.

## What Was Built

Added the `getExerciseWeights` Azure Functions HTTP handler to `api/src/functions/runs.ts`. The endpoint queries the `runs` collection for gym sessions containing the requested exercise name, extracts the weight for each session, and returns a sorted (ascending by date) array of `{ date, maxWeight, unit }` data points.

Key implementation details:
- Route `runs/exercise-weights` registered **before** `runs/{id}` wildcard routes (line 224 vs line 273) to prevent Azure Functions from matching `exercise-weights` as the `:id` parameter
- Filters: `{ userId: ObjectId, discipline: 'gym', 'exercises.name': exercise }` — server-side gym-only filter
- Exercises without `weight` field (body-weight exercises) are excluded from results
- Empty result set returns `{ exercise, data: [] }` with HTTP 200 (not 404)
- Missing/blank `exercise` query param returns 400

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing tests (TDD RED) | 49758a7 | api/src/__tests__/exerciseWeights.test.ts |
| 2 | Implement getExerciseWeights handler (TDD GREEN) | feb88f2 | api/src/functions/runs.ts |

## Test Coverage

8 unit tests added in `exerciseWeights.test.ts`:
1. Missing ?exercise param → 400
2. No matching sessions → 200 with empty data array
3. Single gym session with Squat (80kg) → correct data point
4. Two sessions → separate points, sorted ascending by date
5. Exercise without weight → excluded from results
6. Run session (not gym) with exercises → excluded
7. Different user's session → excluded (userId isolation)
8. Multi-exercise gym session → only queried exercise returned

All 396 API tests pass (no regressions).

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- api/src/__tests__/exerciseWeights.test.ts: FOUND
- api/src/functions/runs.ts contains getExerciseWeights: FOUND
- Commit 49758a7 exists: FOUND
- Commit feb88f2 exists: FOUND
- All 8 tests pass: CONFIRMED (396/396 API tests pass)
