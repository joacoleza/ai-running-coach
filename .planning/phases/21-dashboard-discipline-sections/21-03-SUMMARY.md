---
phase: 21-dashboard-discipline-sections
plan: "03"
subsystem: web-tests
tags: [tests, e2e, dashboard, discipline, charts]
dependency_graph:
  requires: [21-02]
  provides: [DASH2-03, DASH2-04, DASH2-05]
  affects: [web/src/__tests__, e2e]
tech_stack:
  added: []
  patterns: [vitest, playwright, vi.mock, recharts-mock]
key_files:
  created:
    - web/src/__tests__/WeeklySpeedChart.test.tsx
    - web/src/__tests__/WeeklyDurationChart.test.tsx
  modified:
    - web/src/__tests__/WeightProgressionChart.test.tsx
    - web/src/__tests__/useDashboard.test.ts
    - e2e/dashboard.spec.ts
  deleted:
    - web/src/__tests__/WeeklyVolumeChart.test.tsx (was deleted in Plan 02)
decisions:
  - Dashboard.test.tsx was already fully rewritten in Plan 02 (recognized as pre-completed, not duplicated)
  - E2E test label fixed from "Total Speed" to "Avg Speed" (exact: true) to avoid strict mode violation with "Weekly Avg Speed" heading
  - WeightProgressionChart E2E test updated to check for combobox presence instead of h3 heading (chart renders as card without heading)
  - cycleRun E2E fixture needs planId to survive current-plan client-side filter
metrics:
  duration_minutes: 20
  completed_date: "2026-05-10"
  tasks_completed: 3
  files_changed: 5
---

# Phase 21 Plan 03: Test coverage for per-discipline Dashboard sections

Added 12 new unit tests for WeeklySpeedChart, WeeklyDurationChart, WeightProgressionChart defaultExercise prop, and useDashboard per-discipline filter combinations; fixed 2 E2E regressions from Phase 21-02's dashboard restructure.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add defaultExercise and per-discipline unit test coverage | 7e66b64 | WeightProgressionChart.test.tsx, useDashboard.test.ts |
| 2 | Create WeeklySpeedChart and WeeklyDurationChart test files + build verify | d004c7a | WeeklySpeedChart.test.tsx (new), WeeklyDurationChart.test.tsx (new) |
| 3 | E2E regression fixes + full suite run | 1489a29 | e2e/dashboard.spec.ts |

## Verification Results

- `npm test` in web/: 643 passed (0 failing) — up from 631 before Plan 03
- `npm run build` in web/: exits 0 (TypeScript + Vite build succeeds)
- `npx playwright test`: 100 passed (0 failing)
- `WeeklyVolumeChart.test.tsx`: confirmed deleted, no references in __tests__/
- `WeeklySpeedChart.test.tsx`: 5 tests (empty state, null-only, chart rendering, single point, mixed nulls)
- `WeeklyDurationChart.test.tsx`: 4 tests (empty state, non-empty, single point, zero-duration)
- `WeightProgressionChart.test.tsx`: 2 new tests (defaultExercise auto-fetch on mount, no auto-fetch when omitted)
- `useDashboard.test.ts`: 1 new test (filterRunsByDiscipline combination coverage)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dashboard.test.tsx was already rewritten in Plan 02**
- **Found during:** Task 1 — discovered Dashboard.test.tsx already contained all the new section structure from Plan 02 execution
- **Fix:** Skipped rewrite; only added the missing describe blocks (defaultExercise prop + per-discipline exports) as specified
- **Files modified:** None (no change needed)

**2. [Rule 1 - Bug] E2E test "Total Speed" label did not match Dashboard "Avg Speed" implementation**
- **Found during:** Task 3 — E2E failures in dashboard.spec.ts
- **Issue:** Plan 02 renamed stat card labels to "Avg Speed" but E2E test from Phase 16 still looked for "Total Speed"
- **Fix:** Updated test to check `getByText('Avg Speed', { exact: true })` — exact needed to avoid strict mode violation with the "Weekly Avg Speed" chart heading
- **Files modified:** e2e/dashboard.spec.ts
- **Commit:** 1489a29

**3. [Rule 1 - Bug] E2E test "Weight Progression" heading no longer exists in new Dashboard structure**
- **Found during:** Task 3 — E2E failure looking for `getByRole('heading', { name: 'Weight Progression' })`
- **Issue:** Phase 21-02 removed the standalone WeightProgressionChart section wrapper with h3 heading; chart renders directly inside Gym section grid without its own heading
- **Fix:** Updated test to check `getByRole('combobox')` (the exercise dropdown) as the WeightProgressionChart visibility indicator; also added exercises to gymRun fixture so the dropdown renders (previously empty exerciseOptions showed "Log a gym session..." text instead)
- **Files modified:** e2e/dashboard.spec.ts
- **Commit:** 1489a29

**4. [Rule 1 - Bug] E2E cycle run fixture missing planId caused current-plan filter to exclude it**
- **Found during:** Task 3 — diagnosing "Avg Speed" not visible after Cycle button click
- **Issue:** cycleRun in E2E fixture lacked `planId: 'plan-dash-001'`, so the `current-plan` client-side filter (which filters by `r.planId === plan._id`) removed it from `runs`, leaving `cycleRuns = []` and preventing the Cycling section stat cards from rendering
- **Fix:** Added `planId: 'plan-dash-001'` to cycleRun fixture
- **Files modified:** e2e/dashboard.spec.ts
- **Commit:** 1489a29

## Known Stubs

None — all test files cover real behavior, no placeholder stubs.

## Self-Check: PASSED

- WeeklySpeedChart.test.tsx: `ls web/src/__tests__/WeeklySpeedChart.test.tsx` → FOUND
- WeeklyDurationChart.test.tsx: `ls web/src/__tests__/WeeklyDurationChart.test.tsx` → FOUND
- WeeklyVolumeChart.test.tsx: `ls web/src/__tests__/WeeklyVolumeChart.test.tsx` → NOT FOUND (confirmed deleted)
- Commits 7e66b64, d004c7a, 1489a29: verified in `git log --oneline`
- npm test: 643 passed
- npm run build: exits 0
- npx playwright test: 100 passed
