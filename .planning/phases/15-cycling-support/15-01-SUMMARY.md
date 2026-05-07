---
phase: 15-cycling-support
plan: "01"
subsystem: web-ui
tags: [cycling, speed, ui, discipline]
dependency_graph:
  requires: [phase-14-gym-support]
  provides: [cycling-speed-display]
  affects: [RunEntryForm, RunRow, RunDetailModal, LinkRunModal]
tech_stack:
  added: []
  patterns: [isCycle-flag, computeSpeed-helper, formatSpeed-helper]
key_files:
  created: []
  modified:
    - web/src/components/runs/RunEntryForm.tsx
    - web/src/pages/Runs.tsx
    - web/src/components/runs/RunDetailModal.tsx
    - web/src/components/runs/LinkRunModal.tsx
decisions:
  - Speed formula: (distance_km / totalMinutes) * 60, formatted to 1 decimal + ' km/h'
  - isCycle flag pattern mirrors existing isGym pattern for consistency
  - computeSpeed returns string|null (vs number for computePace) since formatted string is always the display value
  - handleAddFeedback uses isCycleSession (local const) to avoid confusion with component-level isCycle
metrics:
  duration_minutes: 30
  completed_date: "2026-05-07"
  tasks_completed: 2
  files_changed: 4
---

# Phase 15 Plan 01: Cycling Speed Display Summary

Speed display for cycling sessions replacing pace across all four UI components — `computeSpeedDisplay` in RunEntryForm, `formatSpeed` in RunRow/LinkRunModal, and `computeSpeed` in RunDetailModal showing km/h instead of min/km for cycling discipline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add speed display to RunEntryForm for cycling | ebbe0b4 | web/src/components/runs/RunEntryForm.tsx |
| 2 | Speed display in RunRow, RunDetailModal, LinkRunModal | 1151c9e | web/src/pages/Runs.tsx, web/src/components/runs/RunDetailModal.tsx, web/src/components/runs/LinkRunModal.tsx |

## What Was Built

### RunEntryForm.tsx
- Added `computeSpeedDisplay(distStr, durStr)` helper: `(dist / totalMinutes) * 60` → `X.X km/h`
- Added `isCycle = discipline === 'cycle'` flag
- Updated `pace` const to use `computeSpeedDisplay` when `isCycle`
- Pace label now renders `'Speed'` for cycling, `'Pace'` for running

### Runs.tsx (RunRow)
- Added `formatSpeed(distance, duration)` helper (same formula)
- Added `isCycle` flag in `RunRow`
- Subtitle ternary extended from binary (isGym/else) to three-way (isGym/isCycle/else)
- Cycling rows show: `Xkm · HH:MM · X.X km/h · NNNbpm`

### RunDetailModal.tsx
- Added `computeSpeed(distance, duration)` helper returning `string | null`
- Added `isCycle` and `editSpeed` computed values
- Pace label/value block now conditionally shows `'Speed (km/h)'` with `computeSpeed` result for cycling
- `handleAddFeedback` updated: `isCycleSession` const, Speed label in message, "cycling session" vs "run" text

### LinkRunModal.tsx
- Added `formatSpeed(distance, duration)` helper
- Run list item shows `formatSpeed` for cycling sessions, `formatPace` for all others

## Verification Results

- TypeScript build (`tsc -b --noEmit`): PASSED (0 errors)
- API tests (`npm test` in api/): 373/373 PASSED
- Web unit tests (`npm test` in web/): 540/540 PASSED
- E2E tests: BLOCKED — Docker daemon not running in execution environment; MongoDB unavailable

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all four components are fully wired to discipline data from run objects.

## Notes

E2E tests require Docker daemon running to start MongoDB. The changes are purely frontend label/formula substitutions — no API changes, no data model changes. The cycling discipline was already present in the dropdown from Phase 13/14 infrastructure. All 913 unit tests (API + web) pass with no regressions.

## Self-Check: PASSED

- FOUND: .planning/phases/15-cycling-support/15-01-SUMMARY.md
- FOUND: web/src/components/runs/RunEntryForm.tsx
- FOUND: web/src/pages/Runs.tsx
- FOUND: web/src/components/runs/RunDetailModal.tsx
- FOUND: web/src/components/runs/LinkRunModal.tsx
- FOUND commit: ebbe0b4 (Task 1)
- FOUND commit: 1151c9e (Task 2)
