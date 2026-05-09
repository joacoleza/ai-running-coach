---
phase: 16-multi-discipline-dashboard
plan: 02
subsystem: ui
tags: [react, typescript, dashboard, discipline-filter, weekly-buckets, date-fns]

# Dependency graph
requires:
  - phase: 16-multi-discipline-dashboard
    provides: 16-01 research + UI spec establishing discipline types and dashboard architecture
  - phase: 15-cycling-support
    provides: Run.discipline field in data model and cycling session support
provides:
  - filterRunsByDiscipline helper (client-side discipline filtering with run default)
  - groupRunsByDiscipline helper (multi-discipline weekly buckets with runDistance/gymSessions/cycleDistance)
  - computeAvgSpeed helper (km/h formatted to 1 decimal)
  - DisciplineFilter type and MultiDisciplineWeekBucket interface
  - Extended DashboardStats with optional totalSessions, avgSpeed, totalDuration fields
  - Discipline-aware computeStats that returns gym/cycle/run-specific metrics
  - activeDiscipline state with localStorage persistence in useDashboard hook
  - multiWeeklyData and runs exposed from useDashboard hook
  - 14 new unit tests for all new helpers
affects:
  - web/src/pages/Dashboard.tsx (Plan 03 consumes activeDiscipline, setActiveDiscipline, multiWeeklyData)
  - web/src/components/dashboard (DisciplineSelector, WeeklyVolumeChart consume these exports)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DisciplineFilter as 'all'|'run'|'gym'|'cycle' union type for discipline scoping"
    - "MultiDisciplineWeekBucket tracks per-discipline metrics in same week bucket"
    - "computeAvgSpeed uses totalDistance/totalMinutes*60 same as cycle context in prompts.ts"
    - "activeDiscipline localStorage key: dashboard_discipline_filter (consistent with runs_discipline_filter pattern)"
    - "filteredRuns applies discipline filter before stats computation and multiWeeklyData grouping"

key-files:
  created: []
  modified:
    - web/src/hooks/useDashboard.ts
    - web/src/__tests__/useDashboard.test.ts

key-decisions:
  - "computeStats now takes activeDiscipline param; gym returns totalSessions+totalDuration; cycle returns totalDistance+avgSpeed; run/all keeps existing behavior"
  - "filteredRuns applied to computeStats and multiWeeklyData but NOT to weekBuckets/weeklyData/paceData (those remain all-discipline for pace chart)"
  - "groupRunsByDiscipline is a separate function from groupRunsByWeek — no modification of existing weekly bucket logic"

patterns-established:
  - "Pattern: discipline default 'run' via (run.discipline ?? 'run') consistently applied in all filter/bucket helpers"
  - "Pattern: MultiDisciplineWeekBucket uses separate fields (runDistance, gymSessions, cycleDistance) not a discipline map"

requirements-completed:
  - DASH-01
  - DASH-02
  - DASH-03

# Metrics
duration: 18min
completed: 2026-05-09
---

# Phase 16 Plan 02: useDashboard Discipline Extensions Summary

**DisciplineFilter type, MultiDisciplineWeekBucket, filterRunsByDiscipline, groupRunsByDiscipline, and computeAvgSpeed added to useDashboard hook with localStorage-persisted activeDiscipline state and 14 new passing unit tests**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-09T16:40:00Z
- **Completed:** 2026-05-09T16:58:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended useDashboard.ts with 5 new exports: DisciplineFilter, MultiDisciplineWeekBucket, filterRunsByDiscipline, groupRunsByDiscipline, computeAvgSpeed
- Updated DashboardStats with optional totalSessions, avgSpeed, totalDuration fields for discipline-aware stat cards
- Extended computeStats to return gym-specific (session count + duration) and cycle-specific (distance + speed) stats when activeDiscipline is set
- Added activeDiscipline localStorage-persisted state and setActiveDiscipline setter to the useDashboard hook return
- Added filteredRuns computation that gates computeStats and multiWeeklyData on the active discipline
- Added 14 new unit tests covering all new helpers with 100% pass rate (60 total tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add new types, helpers, and extend hook in useDashboard.ts** - `77eafcd` (feat)
2. **Task 2: Extend useDashboard unit tests for new functions** - `a821cbf` (test)

## Files Created/Modified

- `web/src/hooks/useDashboard.ts` - Added DisciplineFilter type, MultiDisciplineWeekBucket interface, optional DashboardStats fields, filterRunsByDiscipline, groupRunsByDiscipline, computeAvgSpeed functions; updated computeStats signature; added activeDiscipline state + setActiveDiscipline + multiWeeklyData + runs to hook return
- `web/src/__tests__/useDashboard.test.ts` - Added makeDisciplineRun helper; added describe blocks for filterRunsByDiscipline (5 tests), groupRunsByDiscipline (6 tests), computeAvgSpeed (3 tests)

## Decisions Made

- filteredRuns is applied to computeStats and multiWeeklyData but the legacy weekBuckets/weeklyData/paceData remain unfiltered — this preserves existing pace chart behavior until Plan 03 updates the Dashboard UI
- groupRunsByDiscipline is a separate exported function from groupRunsByWeek (not a modification) to avoid breaking existing pace/HR chart data pipeline
- computeStats gym branch returns totalDistance='0km' and totalRuns=0 for the required base fields, plus totalSessions and totalDuration as discipline-specific extras

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled clean on first attempt. All 14 new tests passed immediately.

## Known Stubs

None — all data flows are wired. The activeDiscipline state is live and feeds filteredRuns, multiWeeklyData, and stats. Dashboard.tsx (Plan 03) will consume these exports to render the UI.

## Next Phase Readiness

- Plan 03 (Dashboard.tsx UI) can now consume: `activeDiscipline`, `setActiveDiscipline`, `multiWeeklyData`, `runs` from useDashboard()
- DisciplineSelector component can call `setActiveDiscipline` directly
- WeeklyVolumeChart can use `multiWeeklyData` (MultiDisciplineWeekBucket[]) with runDistance/gymSessions/cycleDistance fields
- Stat cards can branch on `activeDiscipline` to show discipline-appropriate values from `stats`

---
*Phase: 16-multi-discipline-dashboard*
*Completed: 2026-05-09*
