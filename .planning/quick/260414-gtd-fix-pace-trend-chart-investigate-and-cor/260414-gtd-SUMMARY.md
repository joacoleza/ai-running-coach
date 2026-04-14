---
phase: quick-260414-gtd
plan: 01
subsystem: web/dashboard
tags: [bug-fix, pace-calculation, dashboard, charts]
dependency_graph:
  requires: []
  provides: [correct-pace-trend-chart]
  affects: [web/src/hooks/useDashboard.ts]
tech_stack:
  added: []
  patterns: [distance-weighted-average, tdd]
key_files:
  modified:
    - web/src/hooks/useDashboard.ts
    - web/src/__tests__/useDashboard.test.ts
decisions:
  - "Used totalDurationMinutes / totalDistance (distance-weighted) instead of arithmetic mean of pace values"
  - "Exported groupRunsByWeek and WeekBucket to enable direct unit testing without hook harness"
  - "Zero-duration or zero-distance runs produce avgPace = null (no spurious zero values in chart)"
metrics:
  duration: ~8min
  completed: "2026-04-14"
  tasks: 2
  files: 2
---

# Quick Task 260414-gtd: Fix Pace Trend Chart Summary

**One-liner:** Fixed weekly pace aggregation in `groupRunsByWeek` to use `totalDurationMinutes / totalDistance` (distance-weighted), replacing the incorrect arithmetic mean of per-run pace values.

## What Was Done

The Pace Trend chart was computing weekly average pace as the arithmetic mean of per-run pace values. This is mathematically incorrect when runs have different distances — it equally weights a short run and a long run, producing a misleading pace.

**Bug example:**
- 5km @ 8:00/km (40 min) + 10km @ 7:00/km (70 min) in same week
- Old (wrong): (8.0 + 7.0) / 2 = **7.5 min/km**
- New (correct): (40 + 70) / (5 + 10) = 110 / 15 = **7.333 min/km**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix weekly pace aggregation (TDD) | 240f76e | useDashboard.ts, useDashboard.test.ts |
| 2 | Build verification | — | (no code changes — build confirmed passing) |

## Changes

### `web/src/hooks/useDashboard.ts`
- Replaced `paceValues: number[]` in `WeekBucket` with `totalDurationMinutes: number`
- Per-run accumulation now calls `parseDurationToMinutes(run.duration)` instead of pushing to `paceValues`
- avgPace computation: `totalDurationMinutes / distance` (returns null if either is 0)
- Exported `groupRunsByWeek` and `WeekBucket` for direct unit testing
- HR averaging logic untouched (arithmetic mean of HR values is still correct)

### `web/src/__tests__/useDashboard.test.ts`
- Added `groupRunsByWeek` to import list
- Added helper `makeRun()` for constructing minimal Run stubs
- Added `describe('groupRunsByWeek')` with 5 tests:
  1. Single run: avgPace = duration / distance
  2. Two equal runs: avgPace unchanged
  3. Two unequal runs: distance-weighted result (7.333, not 7.5)
  4. Zero distance: avgPace is null
  5. Zero duration: avgPace is null

## Test Results

22/22 tests pass. `npm run build` exits 0 with no TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `web/src/hooks/useDashboard.ts` — modified and committed
- `web/src/__tests__/useDashboard.test.ts` — modified and committed
- Commit `240f76e` exists in git log
- All 22 tests pass
- TypeScript build passes
