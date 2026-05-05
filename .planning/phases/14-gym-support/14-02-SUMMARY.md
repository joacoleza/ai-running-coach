---
phase: 14-gym-support
plan: "02"
subsystem: ui
tags: [react, typescript, discipline, badge, filter, localStorage]

requires:
  - phase: 14-gym-support/14-01
    provides: Run.discipline field in useRuns.ts + fetchRuns discipline param

provides:
  - RunBadge component with run/gym/cycle colored pill badges
  - Discipline filter tab bar (All/Runs/Gym/Cycling) in Runs page
  - fetchRuns accepts discipline query param
  - RunRow discipline-aware subtitle (gym shows type+duration, others show distance+pace)
  - Filter persisted to localStorage key 'runs_discipline_filter'

affects: [14-03, 14-04]

tech-stack:
  added: []
  patterns:
    - Discipline badge config map pattern (BADGE_CONFIG object keyed by discipline)
    - localStorage-initialized useState for persistent UI filter

key-files:
  created:
    - web/src/components/runs/RunBadge.tsx
    - web/src/__tests__/RunBadge.test.tsx
  modified:
    - web/src/pages/Runs.tsx
    - web/src/__tests__/Runs.test.tsx
    - web/src/hooks/useRuns.ts

key-decisions:
  - "RunBadge mocked in Runs.test.tsx to avoid emoji rendering issues in jsdom"
  - "Gym RunRow subtitle shows 'type · duration' instead of 'Xkm · duration · pace'"

patterns-established:
  - "Discipline badge: BADGE_CONFIG map with icon/label/color per discipline"
  - "Persistent tab filter: useState initializer reads from localStorage, handler writes back"

requirements-completed: [DISC-04, DISC-05]

duration: 30min
completed: 2026-05-04
---

# Plan 14-02: Discipline Badge & Filter Tabs Summary

**RunBadge component (run/gym/cycle colored pills) + 4-tab discipline filter in Runs page with localStorage persistence**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- RunBadge renders colored pill badges (blue/orange/green) for run/gym/cycle disciplines
- Discipline filter tabs (All/Runs/Gym/Cycling) above runs list, state persisted in localStorage
- Every RunRow shows a discipline badge; gym rows show session type instead of distance/pace

## Task Commits

1. **Task 1: RunBadge component and test** - `63544f8` (feat: add RunBadge component with discipline badge styling)
2. **Task 2: Discipline filter tabs and RunBadge in Runs.tsx** - `e03d200` (feat: discipline filter tabs + RunBadge integration)

## Files Created/Modified
- `web/src/components/runs/RunBadge.tsx` - Discipline badge with BADGE_CONFIG map
- `web/src/__tests__/RunBadge.test.tsx` - 4 tests covering each discipline's label/color
- `web/src/pages/Runs.tsx` - Tab bar, discipline state, RunBadge in RunRow, gym subtitle
- `web/src/__tests__/Runs.test.tsx` - RunBadge mock + 3 new tests (tabs render, Gym tab filter, badge shown)
- `web/src/hooks/useRuns.ts` - fetchRuns discipline param added

## Decisions Made
- RunBadge mocked in tests (emoji in jsdom causes inconsistent rendering)
- Gym subtitle shows `type · duration` (no distance/pace for gym sessions)

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None - all tests passed on first run.

## Next Phase Readiness
- RunBadge available for RunDetailModal (14-03) to display discipline context
- Discipline filter wired end-to-end; gym sessions will show correctly once 14-01 API data flows through

---
*Phase: 14-gym-support*
*Completed: 2026-05-04*
