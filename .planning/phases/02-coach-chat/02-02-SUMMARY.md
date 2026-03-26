---
phase: 02-coach-chat
plan: "02"
subsystem: ui
tags: [react, tailwind, layout, coach-panel]

# Dependency graph
requires:
  - phase: 02-01
    provides: Phase 2 initialization and plan structure
provides:
  - Three-column app layout (sidebar | main content | persistent coach panel)
  - CoachPanel shell component with placeholder content
  - Sidebar with 3 nav items (Dashboard, Training Plan, Runs)
  - /coach route removed; coach embedded in layout
affects: [02-03, 02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-column layout via flexbox, persistent right-side panel using fixed-width aside]

key-files:
  created:
    - web/src/components/coach/CoachPanel.tsx
  modified:
    - web/src/components/layout/AppShell.tsx
    - web/src/components/layout/Sidebar.tsx
    - web/src/components/layout/Sidebar.test.tsx
    - web/src/App.tsx

key-decisions:
  - "CoachPanel uses fixed width (w-80 default, w-96 on lg) so flex-1 main content fills remaining space naturally"
  - "Sidebar test updated to assert 3 nav items and explicit absence of Coach Chat"
  - "web/src/pages/Coach.tsx retained — not deleted per plan instructions (will be cleaned up later)"

patterns-established:
  - "Persistent panel pattern: fixed-width aside placed after main in flex container"
  - "CoachPanel lives in web/src/components/coach/ — coach-specific components go here"

requirements-completed: [COACH-01]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 2 Plan 02: Persistent Coach Panel Layout Summary

**Three-column layout (sidebar | main | CoachPanel) embedded in AppShell, /coach route removed, sidebar trimmed to 3 nav items**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T15:36:54Z
- **Completed:** 2026-03-23T15:39:02Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `CoachPanel` shell component with "AI Coach" header and placeholder content visible on every page
- Updated `AppShell` from two-column to three-column layout using flexbox with fixed-width aside
- Removed `/coach` dedicated route from `App.tsx` and `Sidebar.tsx` per D-13
- Updated Sidebar test to reflect 3 nav items (no Coach Chat) and added explicit absence assertion

## Task Commits

Each task was committed atomically:

1. **Task 1: Create coach panel shell and update layout to three columns** - `4f3776f` (feat)
2. **Task 2: Remove /coach route and update sidebar navigation** - `cafd77f` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `web/src/components/coach/CoachPanel.tsx` - New shell component: "AI Coach" header + "Coach chat loading..." placeholder
- `web/src/components/layout/AppShell.tsx` - Updated to import and render CoachPanel after main content
- `web/src/components/layout/Sidebar.tsx` - Removed Coach Chat nav item, now has 3 items
- `web/src/components/layout/Sidebar.test.tsx` - Updated test name and assertions for 3-item nav
- `web/src/App.tsx` - Removed Coach import and /coach route

## Decisions Made
- Used fixed width (w-80 / w-96) for CoachPanel so flex-1 naturally gives remaining space to main content — no explicit percentage needed
- Updated sidebar test to be explicit about both what IS present and what is NOT present (Coach Chat), making the intent clear

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Sidebar test that would have failed after nav item removal**
- **Found during:** Task 2 (Remove /coach route and update sidebar navigation)
- **Issue:** Sidebar.test.tsx asserted "Coach Chat" was in the document — would fail after removing the nav item
- **Fix:** Renamed test to "renders three navigation links" and replaced Coach Chat assertion with `queryByText('Coach Chat').not.toBeInTheDocument()`
- **Files modified:** web/src/components/layout/Sidebar.test.tsx
- **Verification:** `npm test` passes with 12 tests (3 in Sidebar.test.tsx)
- **Committed in:** `cafd77f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing test would have broken)
**Impact on plan:** Test fix was essential for correctness. No scope creep.

## Issues Encountered
None - TypeScript compiled clean on both tasks, tests passed after auto-fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- CoachPanel shell is in place and visible on every page — ready for Plans 03-05 to add chat functionality
- Three-column layout established — future plans can add real content to CoachPanel
- No blockers

---
*Phase: 02-coach-chat*
*Completed: 2026-03-23*

## Self-Check: PASSED
- FOUND: web/src/components/coach/CoachPanel.tsx
- FOUND: web/src/components/layout/AppShell.tsx
- FOUND: .planning/phases/02-coach-chat/02-02-SUMMARY.md
- FOUND commit: 4f3776f (feat(02-02): add CoachPanel shell and three-column layout)
- FOUND commit: cafd77f (feat(02-02): remove /coach route and update sidebar to 3 items)
