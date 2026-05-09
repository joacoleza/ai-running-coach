---
phase: 16-multi-discipline-dashboard
plan: "03"
subsystem: ui
tags: [react, typescript, dashboard, discipline-selector, recharts, weight-progression]
dependency_graph:
  requires:
    - "16-01: GET /api/runs/exercise-weights endpoint"
    - "16-02: useDashboard discipline extensions (activeDiscipline, multiWeeklyData, runs)"
  provides:
    - DisciplineSelector component (All/Run/Gym/Cycle filter buttons)
    - WeeklyVolumeChart component (ComposedChart with three discipline bars)
    - WeightProgressionChart component (LineChart with exercise dropdown + API fetch)
    - Updated Dashboard.tsx with discipline-aware stat cards
  affects:
    - web/src/pages/Dashboard.tsx
    - web/src/components/dashboard/ (new directory)
    - web/src/__tests__/Dashboard.test.tsx
    - web/src/__tests__/pages.test.tsx
tech_stack:
  added: []
  patterns:
    - "DisciplineSelector: aria-pressed for accessibility; active/inactive Tailwind button states"
    - "WeeklyVolumeChart: ComposedChart (not BarChart) with conditional Bar rendering per discipline"
    - "WeightProgressionChart: internal fetch state via useState; X-Authorization header for gym-specific endpoint"
    - "renderStatCards() helper function extracts discipline-specific card logic from JSX"
    - "gymExerciseOptions: derived from runs array at render time using Set deduplication + sort"
key_files:
  created:
    - web/src/components/dashboard/DisciplineSelector.tsx
    - web/src/components/dashboard/WeeklyVolumeChart.tsx
    - web/src/components/dashboard/WeightProgressionChart.tsx
  modified:
    - web/src/pages/Dashboard.tsx
    - web/src/__tests__/Dashboard.test.tsx
    - web/src/__tests__/pages.test.tsx
decisions:
  - "renderStatCards() extracted as a function (not ternary JSX) to cleanly handle three discipline branches with shared adherence card logic"
  - "WeightProgressionChart manages its own fetch state (not Dashboard.tsx) to keep component self-contained"
  - "gymExerciseOptions filtered to exercises with weight !== undefined to exclude bodyweight exercises from dropdown"
  - "WeeklyVolumeChart tooltip formatter uses unknown name param (Recharts NameType can be undefined)"
  - "hasGymData guard for WeightProgressionChart uses runs.some() not multiWeeklyData to correctly detect gym sessions"
metrics:
  duration: "~25 min"
  completed: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 3
requirements:
  - DASH-01
  - DASH-02
  - DASH-03
  - DASH-04
---

# Phase 16 Plan 03: Dashboard UI Components Summary

**Three new dashboard components (DisciplineSelector, WeeklyVolumeChart, WeightProgressionChart) and an updated Dashboard.tsx wiring discipline-aware stat cards, multi-discipline volume chart, and gym weight progression chart**

## What Was Built

### DisciplineSelector.tsx
Four-button filter group (All/Run/Gym/Cycle) with `aria-pressed` accessibility attribute. Active button shows `bg-gray-200 text-gray-900 font-semibold`; inactive shows `border border-gray-300 text-gray-600 hover:bg-gray-100`. Accepts `activeDiscipline` and `onChange` props, calls `setActiveDiscipline` from `useDashboard`.

### WeeklyVolumeChart.tsx
Recharts `ComposedChart` (not `BarChart`) with three conditional `Bar` elements:
- Run: blue-600 (`#3b82f6`), dataKey `runDistance`
- Gym: orange-500 (`#f97316`), dataKey `gymSessions`
- Cycle: green-500 (`#22c55e`), dataKey `cycleDistance`

Bars conditionally rendered based on `activeDiscipline`. Y-axis label adapts: "Sessions" for gym, "Distance (km)" otherwise. Custom tooltip formatter shows unit-appropriate labels per discipline. Empty state shows "No sessions yet" in a 300px container.

### WeightProgressionChart.tsx
Exercise dropdown populated from `exerciseOptions` prop (unique sorted exercise names from gym sessions). On selection, fetches `GET /api/runs/exercise-weights?exercise=...` with `X-Authorization` header. Renders a `LineChart` with blue line (stroke `#3b82f6`), monotone interpolation, 4px dots. Three distinct empty states: no exercise selected / no weight data / loading. Falls back to a single message when `exerciseOptions` is empty.

### Dashboard.tsx
- Added imports for three new components
- Destructures `activeDiscipline`, `setActiveDiscipline`, `multiWeeklyData`, `runs` from `useDashboard()`
- `gymExerciseOptions`: computed via `Set` deduplication from gym run exercises with `weight !== undefined`
- `hasGymData`: `runs.some(r => r.discipline === 'gym')`
- `renderStatCards()` function handles three branches (gym/cycle/run+all) with discipline-specific labels and values
- `DisciplineSelector` added below filter preset buttons
- Existing BarChart replaced with `WeeklyVolumeChart` component
- `WeightProgressionChart` shown only when `hasGymData === true`
- Empty state heading adapts: "No gym sessions yet" when `activeDiscipline === 'gym'`

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create DisciplineSelector, WeeklyVolumeChart, WeightProgressionChart | 6808e64 | web/src/components/dashboard/ (3 files) |
| 2 | Update Dashboard.tsx and Dashboard.test.tsx | a4bd1b6 | Dashboard.tsx, Dashboard.test.tsx |
| 3 | Build verification and TypeScript error fixes | 6684eba | Dashboard.tsx, WeeklyVolumeChart.tsx, Dashboard.test.tsx, pages.test.tsx |

## Test Coverage

10 new test cases in `Dashboard.test.tsx`:
1. DisciplineSelector: renders component (data-testid present)
2. DisciplineSelector: activeDiscipline defaults to 'all'
3. Gym stats: renders Total Sessions label and value (5)
4. Gym stats: renders Total Duration label and value (2h30m)
5. Gym stats: does NOT render Total Runs label
6. Cycle stats: renders Total Speed label and value (18.5 km/h)
7. Cycle stats: does NOT render Total Runs label
8. WeightProgressionChart: shown when runs includes gym session
9. WeightProgressionChart: NOT shown when runs is empty
10. WeeklyVolumeChart: rendered when weeklyData is not empty

All 592 web unit tests pass. All 396 API tests pass. TypeScript builds clean (`npm run build` exits 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pages.test.tsx mock missing new useDashboard fields**
- **Found during:** Task 3 (build verification)
- **Issue:** The existing `pages.test.tsx` file's `useDashboard` mock didn't include `runs`, `activeDiscipline`, `setActiveDiscipline`, or `multiWeeklyData` fields. Dashboard.tsx now accesses `runs.filter(...)` on mount, causing "Cannot read properties of undefined (reading 'filter')" in the test.
- **Fix:** Updated mock to include all new fields; added vi.mock for the three new components to avoid component render errors
- **Files modified:** web/src/__tests__/pages.test.tsx
- **Commit:** 6684eba

**2. [Rule 1 - Bug] WeeklyVolumeChart tooltip formatter type incompatibility**
- **Found during:** Task 3 (npm run build TypeScript check)
- **Issue:** Recharts `Formatter` type allows `name` to be `NameType | undefined` (not just `string`), causing TS2322
- **Fix:** Changed `name` param to `unknown`, used `String(name ?? '')` for safe conversion
- **Files modified:** web/src/components/dashboard/WeeklyVolumeChart.tsx
- **Commit:** 6684eba

**3. [Rule 1 - Bug] Dashboard.tsx unused DisciplineFilter type import**
- **Found during:** Task 3 (npm run build TypeScript check)
- **Issue:** `type DisciplineFilter` imported from useDashboard but not used as a standalone type (only used implicitly via destructuring)
- **Fix:** Removed the unused type import
- **Files modified:** web/src/pages/Dashboard.tsx
- **Commit:** 6684eba

**4. [Rule 2 - Missing] Dashboard.test.tsx gym Run fixture missing required fields**
- **Found during:** Task 3 (npm run build TypeScript check)
- **Issue:** Test fixture for gym run was missing required `createdAt`/`updatedAt` fields from the `Run` interface
- **Fix:** Added `createdAt: '2026-04-07', updatedAt: '2026-04-07'` to the fixture
- **Files modified:** web/src/__tests__/Dashboard.test.tsx
- **Commit:** 6684eba

## Known Stubs

None. All three components have real implementations with actual data flows:
- DisciplineSelector calls `setActiveDiscipline` directly from useDashboard
- WeeklyVolumeChart receives `multiWeeklyData` from useDashboard (populated by `groupRunsByDiscipline`)
- WeightProgressionChart fetches live from `/api/runs/exercise-weights` endpoint (built in Plan 01)
- Dashboard stat cards branch on `activeDiscipline` with real values from `computeStats`

## Self-Check: PASSED

- web/src/components/dashboard/DisciplineSelector.tsx: FOUND
- web/src/components/dashboard/WeeklyVolumeChart.tsx: FOUND
- web/src/components/dashboard/WeightProgressionChart.tsx: FOUND
- web/src/pages/Dashboard.tsx imports all three components: CONFIRMED
- web/dist/index.html: FOUND (build succeeded)
- Commit 6808e64 exists: CONFIRMED
- Commit a4bd1b6 exists: CONFIRMED
- Commit 6684eba exists: CONFIRMED
- 592 web tests pass: CONFIRMED
- 396 API tests pass: CONFIRMED
