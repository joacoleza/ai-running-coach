---
phase: 04-dashboard
plan: 03
subsystem: web/pages
tags: [dashboard, recharts, stat-cards, charts, ui]
dependency_graph:
  requires: [04-02]
  provides: [Dashboard UI with live data, Recharts bar/line charts, empty states]
  affects: []
tech_stack:
  added: []
  patterns: [recharts-responsive-container, vi.mock-recharts-in-tests, hook-wiring]
key_files:
  created:
    - web/src/__tests__/Dashboard.test.tsx
  modified:
    - web/src/pages/Dashboard.tsx
    - web/src/__tests__/pages.test.tsx
decisions:
  - Re-export FILTER_PRESETS from Dashboard.tsx for backward compatibility with pages.test.tsx (existing test imports it directly)
  - Tooltip formatter uses Number(v) cast instead of (v: number) parameter typing to satisfy Recharts ValueType union
  - pages.test.tsx updated to mock useDashboard and use hasPlan:true so stat card labels test renders correctly
metrics:
  duration: 10min
  completed: "2026-04-08T21:20:00Z"
  tasks: 2
  files: 3
---

# Phase 04 Plan 03: Dashboard UI Wiring Summary

**One-liner:** Dashboard.tsx fully wired to useDashboard hook with live stat cards, Recharts BarChart (Weekly Volume) and LineChart (Pace Trend), no-plan and no-runs empty states, and loading spinner.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire Dashboard to useDashboard + render stat cards + charts | 24cb9b7 | web/src/pages/Dashboard.tsx, web/src/__tests__/pages.test.tsx |
| 2 | Dashboard component tests (TDD) | 1cfef1b | web/src/__tests__/Dashboard.test.tsx |

## What Was Built

**`web/src/pages/Dashboard.tsx`** — complete Dashboard UI:
- Imports `useDashboard` hook; removes local `useState` for filter
- 4 stat cards (Total Distance, Total Runs, Total Time, Adherence) with live data from hook
- Adherence card has `role="button"`, `cursor-pointer`, and `onClick={() => navigate('/plan')}` per D-11
- `BarChart` (Weekly Volume, green-500 bars) using `recharts` with `ResponsiveContainer`
- `LineChart` (Pace Trend, blue-500 line) using `recharts` with `ResponsiveContainer`
- Empty state "No active training plan" + "Start Planning" button when `activeFilter === 'current-plan' && !hasPlan && !isLoading`
- Empty state "No runs yet" when no weeklyData and no loading
- Loading spinner (SVG `animate-spin`) while `isLoading`
- Charts section hidden when `weeklyData.length === 0`
- `FILTER_PRESETS` re-exported for backward compatibility

**`web/src/__tests__/Dashboard.test.tsx`** — 15 tests across 3 describe blocks:
- `with active plan and data`: stat values, chart headings, Adherence card click navigates to /plan
- `empty state - no active plan`: "No active training plan" copy, "Start Planning" button, no chart section
- `loading state`: SVG animate-spin present, stat cards show "—"
- Mocks: `useDashboard`, `useNavigate`, `recharts` (stub components for jsdom)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter TypeScript error**
- **Found during:** Task 1 build verification
- **Issue:** `(v: number) => [...]` is not assignable to Recharts `Formatter<ValueType, NameType>` because `ValueType` includes `undefined`
- **Fix:** Changed to `(v) => [Number(v).toFixed(1)+'km', ...]` and `Number(v).toFixed(2)` — cast avoids TS2322 without unsafe `as number`
- **Files modified:** web/src/pages/Dashboard.tsx
- **Commit:** 24cb9b7

**2. [Rule 3 - Blocking] Added useDashboard mock to pages.test.tsx**
- **Found during:** Task 1 build — existing test `renders stat card labels` would fail because Dashboard now calls `useDashboard()` which calls `usePlan()` and `fetchRuns()` with no mocks in `pages.test.tsx`
- **Fix:** Added `vi.mock('../hooks/useDashboard', ...)` with `hasPlan: true` so stat card labels render in the test
- **Files modified:** web/src/__tests__/pages.test.tsx
- **Commit:** 24cb9b7

## Known Stubs

None — all stat cards, charts, and empty states render real data from `useDashboard`.

## Self-Check: PASSED

- web/src/pages/Dashboard.tsx: EXISTS
- web/src/__tests__/Dashboard.test.tsx: EXISTS
- Commit 24cb9b7: EXISTS (feat(04-03): wire Dashboard to useDashboard with stat cards and Recharts charts)
- Commit 1cfef1b: EXISTS (test(04-03): add Dashboard component tests covering stat values, empty states, loading)
- All 403 web tests pass
- `npm run build` exits 0
