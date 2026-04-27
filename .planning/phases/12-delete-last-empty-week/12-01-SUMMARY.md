---
phase: 12-delete-last-empty-week
plan: "01"
subsystem: api
tags: [plan-management, phases, weeks, delete]
dependency_graph:
  requires: []
  provides: [deleteLastWeekOfPhase-endpoint]
  affects: [api/src/functions/planPhases.ts]
tech_stack:
  added: []
  patterns: [TDD-red-green, assignPlanStructure-recompute]
key_files:
  created: []
  modified:
    - api/src/functions/planPhases.ts
    - api/src/__tests__/planPhases.test.ts
decisions:
  - Guard checks order matches addWeekToPhase pattern: phaseIndex validation → plan lookup → bounds check → single-week guard → non-rest day guard
  - Non-rest day guard uses d.type !== 'rest' (matches spec) — catches run, cross-train, any future workout type
metrics:
  duration: "~8 minutes"
  completed: "2026-04-27"
  tasks_completed: 1
  files_modified: 2
requirements:
  - WEEK-DELETE-01
  - WEEK-DELETE-02
---

# Phase 12 Plan 01: Delete Last Empty Week — API Endpoint Summary

**One-liner:** `DELETE /api/plan/phases/:phaseIndex/weeks/last` endpoint with five safety guards and `assignPlanStructure` recompute on deletion.

## What Was Built

Added `deleteLastWeekOfPhase` Azure Function handler to `api/src/functions/planPhases.ts`. The endpoint is the symmetric inverse of `POST /api/plan/phases/:phaseIndex/weeks` — it removes the trailing week of a specified phase when that week contains no workout days.

Handler registration:
- Route: `plan/phases/{phaseIndex}/weeks/last`
- Method: `DELETE`
- Auth: `requireAuth` (user-scoped, not admin-only)

Guard hierarchy:
1. `phaseIndex` param validation (non-negative integer) → 400
2. Active plan lookup → 404
3. Phase bounds check (`phaseIndex >= plan.phases.length`) → 404
4. Single-week protection (`phase.weeks.length <= 1`) → 400
5. Non-rest day protection (`lastWeek.days.some(d => d.type !== 'rest')`) → 400

Happy path: slices off last week, calls `assignPlanStructure` to recompute globally sequential week numbers, then `findOneAndUpdate` with `returnDocument: 'after'`.

## Tests

9 unit tests added in `api/src/__tests__/planPhases.test.ts` under `describe('DELETE /api/plan/phases/:phaseIndex/weeks/last', ...)`:

| # | Test | Status |
|---|------|--------|
| 1 | 404 when no active plan exists | pass |
| 2 | 400 for non-integer phaseIndex | pass |
| 3 | 400 for negative phaseIndex | pass |
| 4 | 404 when phaseIndex out of bounds | pass |
| 5 | 400 when phase has only one week | pass |
| 6 | 400 when last week has a non-rest day | pass |
| 7 | 200 when last week is empty — week count decremented | pass |
| 8 | 200 and week numbers globally recomputed | pass |
| 9 | 200 and other phases unmodified | pass |

Full suite: 341 tests passing (was 332 before phase 11, 341 after this plan), 0 regressions.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| `89fe67a` | test | Add failing tests for DELETE /api/plan/phases/:phaseIndex/weeks/last (TDD RED) |
| `db2bb0c` | feat | Add deleteLastWeekOfPhase endpoint to planPhases.ts (TDD GREEN) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `api/src/functions/planPhases.ts` — modified, handler present
- `api/src/__tests__/planPhases.test.ts` — modified, 9 new tests
- Commits `89fe67a` and `db2bb0c` exist in git log
