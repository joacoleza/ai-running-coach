---
phase: 04-dashboard
plan: 06
subsystem: ui
tags: [recharts, dashboard, useDashboard, heart-rate, adherence, ComposedChart]

# Dependency graph
requires:
  - phase: 04-dashboard
    provides: "useDashboard hook, Dashboard page with filter presets and chart infrastructure"
provides:
  - "PaceBpmDataPoint type exported from useDashboard.ts"
  - "paceBpmData computed and exported from useDashboard() with weekly HR bucketing"
  - "Adherence stat card conditionally visible only when activeFilter === 'current-plan'"
  - "Pace vs Heart Rate ComposedChart with dual Y-axes (pace/bpm) below existing charts"
affects: [04-dashboard, dashboard-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WeekBucket accumulates both pace and HR values; avgBPM computed as rounded average"
    - "Conditional chart rendering via paceBpmData.length > 0 guard"
    - "Adherence card gated behind activeFilter === 'current-plan' for semantic accuracy"

key-files:
  created: []
  modified:
    - web/src/hooks/useDashboard.ts
    - web/src/pages/Dashboard.tsx
    - web/src/__tests__/Dashboard.test.tsx

key-decisions:
  - "paceBpmData includes weeks where avgPace !== null OR hrValues.length > 0 (either metric sufficient)"
  - "avgBPM rounded to 1 decimal via Math.round(...* 10) / 10 for display precision"
  - "Adherence guard uses activeFilter === 'current-plan' inline (not a separate boolean)"
  - "ComposedChart placed below 2-col charts grid with mt-6 spacing (full-width card)"

patterns-established:
  - "Dual-axis recharts: yAxisId prop on YAxis + Line components links axis to series"

requirements-completed: [DASH-02, DASH-03]

# Metrics
duration: 15min
completed: 2026-04-10
---

# Phase 04 Plan 06: Dashboard Gap Closure — Adherence Guard + Pace/BPM Chart Summary

**Adherence stat card hidden for non-plan filters; Pace vs Heart Rate ComposedChart with dual Y-axes added to Dashboard using recharts**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-10T10:37:32Z
- **Completed:** 2026-04-10T10:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `hrValues: number[]` to `WeekBucket` and `PaceBpmDataPoint` interface to `useDashboard.ts`
- Derived `paceBpmData` from weekly HR buckets; exported from `useDashboard()` return value
- Wrapped Adherence stat card in `activeFilter === 'current-plan'` guard — hidden for 6 other filter presets
- Added `ComposedChart` with dual YAxis (pace left, BPM right) below existing charts grid

## Task Commits

Each task was committed atomically:

1. **Task 1: Add HR bucketing and paceBpmData to useDashboard.ts** - `ce38ea5` (feat)
2. **Task 2: Adherence guard + ComposedChart in Dashboard.tsx** - `a77d861` (feat, included in parallel plan-07 commit)

## Files Created/Modified

- `web/src/hooks/useDashboard.ts` - Added `hrValues[]` to WeekBucket, `PaceBpmDataPoint` export, `paceBpmData` derivation and return
- `web/src/pages/Dashboard.tsx` - ComposedChart + Legend imports, paceBpmData destructure, adherence guard, Pace vs Heart Rate chart block
- `web/src/__tests__/Dashboard.test.tsx` - Added ComposedChart/Legend to recharts mock, `paceBpmData: []` to makeDefaults, new adherence guard tests, new ComposedChart tests

## Decisions Made

- `paceBpmData` includes any week with pace data OR HR data (not requiring both), matching plan spec
- `avgBPM` is null when `hrValues` is empty (graceful — only pace line renders if no HR data)
- Adherence guard uses inline `{activeFilter === 'current-plan' && (...)}` per plan spec
- `ComposedChart` placed as a full-width card after the 2-column charts grid with `mt-6`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added Dashboard test mocks for new recharts components and paceBpmData**
- **Found during:** Task 1 (TypeScript build after adding PaceBpmDataPoint export)
- **Issue:** Dashboard.test.tsx mock for `useDashboard` didn't include `paceBpmData`, causing TS2322 type error; recharts mock lacked `ComposedChart` and `Legend`
- **Fix:** Added `paceBpmData: []` to `makeDefaults()`, added `ComposedChart` and `Legend` to recharts mock, updated loading state test assertion (4 → 3 min dashes, since Adherence card now hidden for non-plan filters), added adherence guard tests and ComposedChart render tests
- **Files modified:** `web/src/__tests__/Dashboard.test.tsx`
- **Verification:** TypeScript build passes, 411 tests pass
- **Committed in:** `ce38ea5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical — test mock completeness)
**Impact on plan:** Auto-fix necessary for TypeScript correctness. No scope creep — all changes directly related to the new exports.

## Issues Encountered

- The Edit tool reported a stale-file error on Dashboard.tsx after my first edit succeeded; the actual file content was correct (confirmed via bash). The plan 07 parallel agent's commit `a77d861` captured the Dashboard.tsx changes in its commit.

## Known Stubs

None — paceBpmData is computed from real run data; the chart only renders when data is present.

## Next Phase Readiness

- Adherence card now semantically correct (only shown for current-plan context)
- Pace vs Heart Rate chart ready to display once user has runs with avgHR data
- Both UAT gaps (test 3 and test 5) closed by this plan

## Self-Check: PASSED

- FOUND: web/src/hooks/useDashboard.ts
- FOUND: web/src/pages/Dashboard.tsx
- FOUND: .planning/phases/04-dashboard/04-06-SUMMARY.md
- FOUND commit: ce38ea5
- Build: passes (tsc -b && vite build exits 0)
- Tests: 411/411 pass

---
*Phase: 04-dashboard*
*Completed: 2026-04-10*
