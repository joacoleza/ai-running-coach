---
phase: 03-run-logging
plan: "01"
subsystem: api
tags: [run-logging, api, mongodb, azure-functions]
dependency_graph:
  requires: []
  provides: [run-crud-api, run-link-api, plan-progress-feedback]
  affects: [api/src/functions/runs.ts, api/src/shared/types.ts, api/src/functions/planDays.ts, api/src/functions/plan.ts]
tech_stack:
  added: []
  patterns: [azure-functions-http, mongodb-arrayfilters, requirePassword-middleware]
key_files:
  created:
    - api/src/functions/runs.ts
  modified:
    - api/src/shared/types.ts
    - api/src/functions/planDays.ts
    - api/src/functions/plan.ts
    - api/src/index.ts
decisions:
  - Run unlinked filter uses planId $exists: false (not $or null) for TypeScript type compatibility
  - Plan-replace guard (D-16) added to generatePlan only — createPlan starts fresh onboarding so no guard needed
metrics:
  duration: "~10 min"
  completed_date: "2026-03-31"
  tasks_completed: 2
  files_modified: 5
---

# Phase 3 Plan 01: Run Data Model & API Endpoints Summary

**One-liner:** Run CRUD API (7 endpoints) with plan-day linking/unlinking and progressFeedback support using MongoDB runs collection.

## What Was Built

### Task 1: Run type + runs.ts + index.ts import

Added `Run` interface to `api/src/shared/types.ts` with all required fields: `_id`, `date`, `distance`, `duration`, `pace`, `avgHR`, `notes`, `planId`, `weekNumber`, `dayLabel`, `insight`, `userId`, `createdAt`, `updatedAt`. Also added `progressFeedback?: string` to the `Plan` interface.

Created `api/src/functions/runs.ts` with 7 Azure Function HTTP endpoints:

| Endpoint | Route | Method |
|----------|-------|--------|
| `getUnlinkedRuns` | `runs/unlinked` | GET |
| `createRun` | `runs` | POST |
| `listRuns` | `runs` | GET |
| `getRun` | `runs/{id}` | GET |
| `updateRun` | `runs/{id}` | PATCH |
| `deleteRun` | `runs/{id}` | DELETE |
| `linkRun` | `runs/{id}/link` | POST |

Key behaviors:
- `computePace()` helper parses MM:SS or HH:MM:SS and returns minutes/distance-unit (2 decimal places)
- `createRun` optionally links to a plan day at creation time (verifies not already completed, marks day completed, sets planId on run)
- `listRuns` supports query params: `limit`, `offset`, `dateFrom`, `dateTo`, `distanceMin`, `distanceMax`, `planId`; returns `{ runs, total }` for pagination
- `getUnlinkedRuns` registered before `runs/{id}` to avoid route collision
- `deleteRun` returns 409 for linked runs (user must undo plan day first)
- `linkRun` verifies day not already completed, marks day complete, updates run with planId/weekNumber/dayLabel

Registered `import './functions/runs.js'` in `api/src/index.ts`.

### Task 2: planDays undo unlinks run + PATCH /api/plan for progressFeedback

Extended `planDays.ts` patchDay handler: when `completed` is undone (set to false), after the plan update, queries the `runs` collection and `$unset`s `planId`, `weekNumber`, `dayLabel` from the previously linked run. The run is preserved as an unlinked run — not deleted.

Added `patchPlan` handler in `plan.ts` for `PATCH /api/plan`: accepts `{ progressFeedback }` body and updates the active/onboarding plan's `progressFeedback` field.

Added D-16 plan-replace guard in `generatePlan`: returns 409 if any run has a `planId` set, blocking plan regeneration when training history is linked.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `cd36768` | feat(03-01): add Run type and all 7 run CRUD+link endpoints |
| Task 2 | `0214e69` | feat(03-01): extend planDays undo to unlink run + add PATCH /api/plan for progressFeedback |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript type error in getUnlinkedRuns filter**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `{ $or: [{ planId: { $exists: false } }, { planId: null }] }` produced TS2769 — `null` not assignable to `Condition<ObjectId | undefined>`
- **Fix:** Changed to `db.collection('runs').find({ planId: { $exists: false } })` using untyped collection to avoid MongoDB generic type constraint
- **Files modified:** `api/src/functions/runs.ts`
- **Commit:** `cd36768`

## Known Stubs

None — all endpoints connect to real MongoDB collections. No placeholder data or hardcoded responses.

## Self-Check: PASSED

- `api/src/functions/runs.ts` exists: FOUND
- `api/src/shared/types.ts` has `export interface Run {`: FOUND
- `api/src/shared/types.ts` has `progressFeedback?: string`: FOUND
- `api/src/functions/plan.ts` has `patchPlan`: FOUND
- `api/src/functions/planDays.ts` has `$unset` with planId: FOUND
- `api/src/index.ts` has `runs.js` import: FOUND
- Commits `cd36768` and `0214e69`: FOUND
- `npx tsc --noEmit`: PASS
