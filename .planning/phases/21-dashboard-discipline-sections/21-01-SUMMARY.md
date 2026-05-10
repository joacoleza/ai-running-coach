---
phase: 21-dashboard-discipline-sections
plan: 01
subsystem: web/dashboard
tags: [dashboard, charts, cycling, gym, recharts]
dependency_graph:
  requires: []
  provides: [WeeklySpeedChart, WeeklyDurationChart, WeightProgressionChart-defaultExercise]
  affects: [Dashboard.tsx]
tech_stack:
  added: []
  patterns: [Recharts LineChart, Recharts BarChart, useEffect auto-select]
key_files:
  created:
    - web/src/components/dashboard/WeeklySpeedChart.tsx
    - web/src/components/dashboard/WeeklyDurationChart.tsx
  modified:
    - web/src/components/dashboard/WeightProgressionChart.tsx
key_decisions:
  - "WeeklySpeedChart exports SpeedDataPoint type so Dashboard can define speed data arrays with type safety"
  - "WeightProgressionChart useEffect placed after handleExerciseSelect definition to avoid reference-before-assignment"
  - "WeeklyDurationChart empty state checks data.length === 0 (not hasData pattern) since 0 durationMinutes bars are still meaningful to show"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-10"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
requirements: [DASH2-01, DASH2-02]
---

# Phase 21 Plan 01: Dashboard Discipline Chart Components Summary

Three chart components ready for per-discipline dashboard sections: WeeklySpeedChart (cycling line chart, green), WeeklyDurationChart (gym bar chart, orange), and WeightProgressionChart enhanced with defaultExercise auto-select prop.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WeeklySpeedChart.tsx | 94594be | web/src/components/dashboard/WeeklySpeedChart.tsx |
| 2 | Create WeeklyDurationChart.tsx + update WeightProgressionChart defaultExercise | da95a8b | web/src/components/dashboard/WeeklyDurationChart.tsx, web/src/components/dashboard/WeightProgressionChart.tsx |

## What Was Built

**WeeklySpeedChart** (`web/src/components/dashboard/WeeklySpeedChart.tsx`)
- Recharts `LineChart` rendering `SpeedDataPoint[]` (weekLabel + speed: number | null)
- Cycle green stroke `#22c55e`, `connectNulls={false}` for gap weeks
- Y-axis label "Speed (km/h)" with `domain={['auto', 'auto']}`
- Empty state when data is empty or all speed values are null
- Exports `WeeklySpeedChart` function and `SpeedDataPoint` type

**WeeklyDurationChart** (`web/src/components/dashboard/WeeklyDurationChart.tsx`)
- Recharts `BarChart` rendering `DurationDataPoint[]` (weekLabel + durationMinutes: number)
- Gym orange fill `#f97316`, bar radius `[4, 4, 0, 0]`
- Y-axis label "Duration (min)"
- Empty state when data is empty
- Exports `WeeklyDurationChart` function and `DurationDataPoint` type

**WeightProgressionChart** (updated `web/src/components/dashboard/WeightProgressionChart.tsx`)
- Added `defaultExercise?: string` to props interface
- `useState` initial value changed to `defaultExercise ?? ''`
- Added `useEffect` that calls `handleExerciseSelect(defaultExercise)` on mount when `defaultExercise` is provided
- Chart auto-populates data without user interaction when parent passes a defaultExercise

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components render real data when provided. Empty states are intentional UX (no data yet), not stubs.

## Self-Check: PASSED

- [x] web/src/components/dashboard/WeeklySpeedChart.tsx exists
- [x] web/src/components/dashboard/WeeklyDurationChart.tsx exists
- [x] WeightProgressionChart.tsx contains `defaultExercise?: string`
- [x] WeightProgressionChart.tsx contains useEffect import and hook
- [x] WeeklySpeedChart stroke is #22c55e
- [x] WeeklyDurationChart bar fill is #f97316
- [x] TypeScript build exits 0
- [x] Commits 94594be and da95a8b verified in git log
