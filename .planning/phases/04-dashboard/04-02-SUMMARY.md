---
phase: 04-dashboard
plan: 02
subsystem: web/hooks
tags: [dashboard, hooks, data-layer, stats, charts]
dependency_graph:
  requires: [04-01]
  provides: [useDashboard hook, DashboardStats, WeeklyDataPoint, PaceDataPoint, FilterPreset]
  affects: [04-03-PLAN.md]
tech_stack:
  added: []
  patterns: [exported-helpers-for-testability, tdd-red-green, cancellable-useEffect]
key_files:
  created:
    - web/src/hooks/useDashboard.ts
    - web/src/__tests__/useDashboard.test.ts
  modified: []
decisions:
  - startOfYear timezone fix: use getFullYear() instead of toISOString().slice() for this-year dateFrom to avoid UTC offset shifting Jan 1 to Dec 31
metrics:
  duration: 5min
  completed: "2026-04-08T20:47:41Z"
  tasks: 2
  files: 2
---

# Phase 04 Plan 02: useDashboard Hook Summary

**One-liner:** useDashboard data layer hook with 7 filter presets, run fetching, stats calculation (distance/runs/time/adherence), and weekly chart data grouped by ISO week Monday start.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create useDashboard hook | 4697254 | web/src/hooks/useDashboard.ts |
| 2 | Unit tests for useDashboard helpers | 04bd202 | web/src/__tests__/useDashboard.test.ts |

## What Was Built

`web/src/hooks/useDashboard.ts` — complete data layer for the Dashboard page:

**Exported types:**
- `FilterPreset` — union type for 7 filter presets
- `DashboardStats` — `{ totalDistance, totalRuns, totalTime, adherence }`
- `WeeklyDataPoint` — `{ weekLabel, distance }` for bar chart
- `PaceDataPoint` — `{ weekLabel, pace }` for line chart

**Exported helpers (for unit testability):**
- `parseDurationToMinutes(duration)` — parses "MM:SS" or "HH:MM:SS" to decimal minutes
- `formatTotalTime(minutes)` — formats to "1h30m" or "45m"
- `computeDateRange(preset, today)` — returns null for current-plan, date range object for all others

**Hook behavior:**
- Manages `activeFilter` state (default: 'current-plan')
- On filter change or plan._id change: fetches runs via `fetchRuns()`
- 'current-plan': fetches all runs, filters client-side to `planId === plan._id`
- Date presets: fetches with `dateFrom`/`dateTo` params
- Groups runs by ISO week (Monday start) using date-fns `startOfWeek`
- Computes adherence: completed non-rest days / total non-rest days for current-plan; linkedRuns.size / total non-rest days for date filters
- Cancellable useEffect via `cancelled` flag prevents state updates after unmount

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed startOfYear timezone offset for this-year dateFrom**
- **Found during:** Task 1 GREEN phase (test failure)
- **Issue:** `startOfYear(today).toISOString().slice(0,10)` produces "2025-12-31" instead of "2026-01-01" because `new Date('2026-04-08')` parses as UTC midnight, and `startOfYear` returns midnight local time, which `.toISOString()` shifts back to the previous day in UTC+N timezones
- **Fix:** Used `yearStart.getFullYear() + '-01-01'` string construction instead of ISO conversion
- **Files modified:** web/src/hooks/useDashboard.ts
- **Commit:** 4697254

## Known Stubs

None — this is a pure data hook with no UI rendering.

## Self-Check: PASSED

- web/src/hooks/useDashboard.ts: EXISTS
- web/src/__tests__/useDashboard.test.ts: EXISTS
- Commit 4697254: EXISTS (feat(04-02): implement useDashboard hook)
- Commit 04bd202: EXISTS (test(04-02): add unit tests)
- All 380 web tests pass
- `npm run build` exits 0
