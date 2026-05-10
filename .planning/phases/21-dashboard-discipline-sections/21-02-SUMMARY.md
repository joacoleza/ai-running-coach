---
phase: 21-dashboard-discipline-sections
plan: "02"
subsystem: frontend/dashboard
tags: [dashboard, discipline-sections, recharts, useDashboard]
dependency_graph:
  requires: [21-01]
  provides: [per-discipline-dashboard-sections]
  affects: [web/src/pages/Dashboard.tsx, web/src/hooks/useDashboard.ts]
tech_stack:
  added: []
  patterns:
    - Per-discipline section layout (Run/Cycling/Gym stacked vertically)
    - computeDefaultExercise pattern from gymRuns exercise frequency
    - WeekBucket-derived SpeedDataPoint and DurationDataPoint for chart components
key_files:
  created: []
  modified:
    - web/src/hooks/useDashboard.ts
    - web/src/pages/Dashboard.tsx
    - web/src/src/__tests__/Dashboard.test.tsx
    - web/src/src/__tests__/pages.test.tsx
  deleted:
    - web/src/components/dashboard/WeeklyVolumeChart.tsx
    - web/src/src/__tests__/WeeklyVolumeChart.test.tsx
decisions:
  - Per-section stats computed inline in Dashboard.tsx using per-discipline run arrays (runRuns, cycleRuns, gymRuns) rather than calling computeStats — avoids importing internal function
  - defaultGymExercise uses frequency counting (Map<name, count>) then sort by count desc, alpha asc — matches D-15 spec exactly
  - WeightProgressionChart renders its own bg-white card wrapper; placed directly in grid without extra wrapper to avoid double-nesting
metrics:
  duration_minutes: 15
  completed_date: "2026-05-10"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 7
---

# Phase 21 Plan 02: Dashboard Discipline Sections Summary

**One-liner:** Dashboard restructured into three stacked per-discipline sections (Run/Cycling/Gym), each with its own stat cards and charts, replacing the flat layout and combined WeeklyVolumeChart.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend useDashboard.ts with per-discipline data exports | 010c1ec | useDashboard.ts, Dashboard.test.tsx |
| 2 | Restructure Dashboard.tsx into per-discipline sections + delete WeeklyVolumeChart | 686b724 | Dashboard.tsx, WeeklyVolumeChart.tsx (del), Dashboard.test.tsx, pages.test.tsx, WeeklyVolumeChart.test.tsx (del) |

## What Was Built

### useDashboard.ts extensions (Task 1)

Added six new computed values to the `useDashboard` return object:
- `runRuns`, `cycleRuns`, `gymRuns` — pre-filtered `Run[]` arrays per discipline (using existing `filterRunsByDiscipline`)
- `runWeeklyBuckets`, `cycleWeeklyBuckets`, `gymWeeklyBuckets` — per-discipline `WeekBucket[]` arrays (using existing `groupRunsByWeek` + `fillWeekGaps`)

All existing return values preserved — no breaking changes.

### Dashboard.tsx restructure (Task 2)

Replaced the flat dashboard layout with three stacked discipline sections implementing all D-01 through D-15 decisions:

**Run Section** (blue #3b82f6):
- Stat cards: Total Distance, Total Runs, Total Time (+ Adherence if current-plan filter)
- Charts: Weekly Distance bar chart + Weekly Avg Pace line chart + optional Pace vs HR ComposedChart

**Cycling Section** (green #22c55e):
- Stat cards: Total Distance, Avg Speed, Total Time (+ Adherence if current-plan filter)
- Charts: Weekly Distance bar chart + WeeklySpeedChart

**Gym Section** (orange #f97316):
- Stat cards: Total Sessions, Total Duration (+ Adherence if current-plan filter)
- Charts: WeeklyDurationChart + WeightProgressionChart (with defaultExercise computed from most frequent exercise)

**Section visibility:**
- `all` mode: sections hidden when no data for that discipline (D-03)
- Single discipline mode: only that discipline's section shown (D-04)
- Global empty state when no sessions across all disciplines in `all` mode

**Deleted:**
- `WeeklyVolumeChart.tsx` — combined multi-discipline bar chart removed per D-02
- `WeeklyVolumeChart.test.tsx` — tests for the deleted component

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Dashboard.test.tsx missing new useDashboard fields**
- **Found during:** Task 1 TypeScript compile check
- **Issue:** `makeDefaults` in `Dashboard.test.tsx` did not include the 6 new fields (`runRuns`, `cycleRuns`, `gymRuns`, `runWeeklyBuckets`, `cycleWeeklyBuckets`, `gymWeeklyBuckets`), causing TS2322 type errors
- **Fix:** Added all 6 fields with empty array defaults to `makeDefaults`
- **Files modified:** `web/src/__tests__/Dashboard.test.tsx`
- **Commit:** 010c1ec

**2. [Rule 1 - Bug] WeeklyVolumeChart.test.tsx referenced deleted component**
- **Found during:** Task 2 TypeScript compile check
- **Issue:** Test file importing the deleted `WeeklyVolumeChart` caused TS2307 module not found error
- **Fix:** Deleted `WeeklyVolumeChart.test.tsx` (tests for the deleted component are also removed)
- **Files modified:** Deleted `web/src/__tests__/WeeklyVolumeChart.test.tsx`
- **Commit:** 686b724

**3. [Rule 1 - Bug] pages.test.tsx referenced old Dashboard structure**
- **Found during:** Task 2 post-restructure review
- **Issue:** `pages.test.tsx` mocked `WeeklyVolumeChart`, lacked new useDashboard fields, and had stat card assertions that no longer matched the new section-based layout
- **Fix:** Updated mock to use new imports (`WeeklySpeedChart`, `WeeklyDurationChart`, `WeightProgressionChart`), added missing useDashboard fields, updated test assertions to match new empty-state behavior
- **Files modified:** `web/src/__tests__/pages.test.tsx`
- **Commit:** 686b724

**4. [Rule 1 - Bug] Dashboard.test.tsx required full rewrite for new structure**
- **Found during:** Task 2 planning phase
- **Issue:** All existing Dashboard test cases tested old layout patterns (`renderStatCards`, flat charts, `WeeklyVolumeChart`) that no longer exist
- **Fix:** Fully rewrote `Dashboard.test.tsx` with tests covering the new per-discipline section layout, section visibility logic, chart rendering per section, and adherence card behavior
- **Files modified:** `web/src/__tests__/Dashboard.test.tsx`
- **Commit:** 686b724

## Verification Results

- `npx tsc -b --noEmit` exits 0 (no TypeScript errors)
- `grep -r "WeeklyVolumeChart" web/src` returns no matches
- Dashboard.tsx contains "Run (", "Cycling (", "Gym (" section headers
- Dashboard.tsx imports from WeeklySpeedChart, WeeklyDurationChart, WeightProgressionChart
- useDashboard.ts return object includes all 6 new per-discipline exports
- 631 web unit tests pass (44 test files)
- Production build succeeds (`tsc -b && vite build`)

## Known Stubs

None — all data is wired from `useDashboard` through `runRuns`/`cycleRuns`/`gymRuns` and their weekly bucket derivatives.

## Self-Check: PASSED

- `web/src/hooks/useDashboard.ts` — FOUND (modified with new exports)
- `web/src/pages/Dashboard.tsx` — FOUND (fully restructured)
- `web/src/components/dashboard/WeeklyVolumeChart.tsx` — CONFIRMED DELETED
- Commit 010c1ec — FOUND
- Commit 686b724 — FOUND
