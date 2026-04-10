---
phase: 04-dashboard
plan: 07
subsystem: ui
tags: [react, react-router-dom, useLocation, recharts, AppShell, CoachPanel]

# Dependency graph
requires:
  - phase: 04-dashboard-05
    provides: ArchivePlan page with its own readonly CoachPanel and gray FAB

provides:
  - AppShell suppresses live CoachPanel on /archive/:id routes
  - AppShell suppresses mobile FAB on /archive/:id routes
  - Pace vs Heart Rate ComposedChart in Dashboard (pace + BPM dual-axis)

affects: [ArchivePlan, AppShell, Dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useLocation regex route guard for conditional rendering in layout shell
    - ComposedChart with dual YAxis for pace and BPM overlay

key-files:
  created: []
  modified:
    - web/src/components/layout/AppShell.tsx
    - web/src/pages/Dashboard.tsx

key-decisions:
  - "AppShell uses /^\/archive\/.+/ regex via useLocation to suppress CoachPanel and FAB on archive detail routes"
  - "Pace vs Heart Rate ComposedChart uses dual YAxis (left=pace, right=BPM) with connectNulls for sparse data"

patterns-established:
  - "Layout components use useLocation + regex for route-aware conditional rendering"

requirements-completed: [DASH-04]

# Metrics
duration: 12min
completed: 2026-04-10
---

# Phase 04 Plan 07: AppShell Route-Awareness Summary

**AppShell CoachPanel and FAB suppressed on /archive/:id via useLocation regex guard; Pace vs Heart Rate dual-axis chart wired in Dashboard**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-10T10:40:00Z
- **Completed:** 2026-04-10T10:52:00Z
- **Tasks:** 2 (Task 1 executed; Task 2 was pre-completed in commit 5d056a2)
- **Files modified:** 2

## Accomplishments

- AppShell.tsx imports `useLocation` and derives `isArchivePlanRoute` using `/^\/archive\/.+/` regex
- CoachPanel render gated by `!isArchivePlanRoute` — live chat column not mounted on archive pages
- Mobile FAB gated by `showFab && !isArchivePlanRoute` — blue FAB no longer paints over the gray clock FAB on archive pages
- Dashboard.tsx wires `paceBpmData` into a `ComposedChart` with dual YAxis (pace left, BPM right) and `connectNulls`
- E2E fixes (Task 2) were pre-applied in commit 5d056a2: useDashboard `plan.phases ?? []` guard, coach.spec.ts heading assertion, training-plan.spec.ts navigation fix

## Task Commits

1. **Task 1: Add useLocation route guard to AppShell** - `a77d861` (feat) — also fixes ComposedChart stub
2. **Task 2: Fix E2E test failures (pre-completed)** - `5d056a2` (fix) — prior commit

**Plan metadata:** (see final docs commit)

## Files Created/Modified

- `web/src/components/layout/AppShell.tsx` - Added `useLocation` import, `isArchivePlanRoute` regex, gates CoachPanel and FAB
- `web/src/pages/Dashboard.tsx` - Wired `paceBpmData` into ComposedChart with dual YAxis; removed unused stub imports

## Decisions Made

- Implemented Pace vs Heart Rate chart inline in Dashboard.tsx — plan 04-06 had added stub imports/hook return but left JSX unimplemented, causing TS build failure. Wired chart rather than stripping it.
- Used `/^\/archive\/.+/` regex (not `startsWith`) for future-proof path matching

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript build failure from unused ComposedChart/Legend/paceBpmData stubs**
- **Found during:** Task 1 verification (npm run build)
- **Issue:** Plan 04-06 had added `ComposedChart`, `Legend`, and `paceBpmData` to Dashboard.tsx as stub imports/destructuring but never rendered the chart JSX. TypeScript emitted TS6133 unused-variable errors causing build failure.
- **Fix:** Implemented the Pace vs Heart Rate ComposedChart JSX with dual YAxis (pace left, BPM right), Legend, and connectNulls. 411 web unit tests pass.
- **Files modified:** web/src/pages/Dashboard.tsx
- **Verification:** `npm run build` exits 0; `npm test -- --run` 411/411 pass
- **Committed in:** a77d861 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking build failure)
**Impact on plan:** Auto-fix was necessary to pass TypeScript build verification. Chart implementation was the intended outcome of plan 04-06 and is now complete.

## Issues Encountered

- Plan 04-06 (parallel plan) had added stub code to Dashboard.tsx without completing the chart JSX, causing a TypeScript build error that blocked Task 1 verification. Fixed inline per Rule 3.

## Known Stubs

None - all data paths are wired.

## Next Phase Readiness

- UAT gap 8 (AppShell live chat on archive) and gap 9 (FAB z-index conflict on archive) are closed
- Pace vs Heart Rate chart is fully functional when avgHR data is available on runs
- Phase 04 gap closure plans 06 and 07 are both complete

---
*Phase: 04-dashboard*
*Completed: 2026-04-10*
