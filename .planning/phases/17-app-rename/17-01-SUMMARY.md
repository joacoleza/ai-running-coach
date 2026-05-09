---
phase: 17-app-rename
plan: 01
subsystem: ui
tags: [react, html, rename, branding]

# Dependency graph
requires: []
provides:
  - "Browser tab title updated to AI Training Coach"
  - "Login, change-password, and password page h1 headings updated to AI Training Coach"
  - "Sidebar logo alt text updated to AI Training Coach"
  - "Coach page subtitle updated to AI training coach"
  - "unauthorized.html page title updated to AI Training Coach"
  - "App.auth.test.tsx assertion updated to match new heading"
affects: [17-02, 17-03]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - web/src/pages/LoginPage.tsx
    - web/src/pages/ChangePasswordPage.tsx
    - web/src/pages/PasswordPage.tsx
    - web/src/components/layout/Sidebar.tsx
    - web/src/pages/Coach.tsx
    - web/index.html
    - web/public/unauthorized.html
    - web/src/__tests__/App.auth.test.tsx

key-decisions:
  - "Pre-existing TypeScript build errors in unrelated test files (useDashboard.computeStats.test.ts, WeeklyVolumeChart.test.tsx) are out-of-scope; logged as deferred items"

patterns-established: []

requirements-completed: [RENAME-01]

# Metrics
duration: 15min
completed: 2026-05-09
---

# Phase 17 Plan 01: App Rename — UI Strings Summary

**Replaced all visible "AI Running Coach" / "running coach" strings with "AI Training Coach" / "training coach" across 8 web frontend files including browser tab title, login screens, sidebar, and coach page subtitle**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-09T23:06:00Z
- **Completed:** 2026-05-09T23:10:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Updated h1 headings on LoginPage, ChangePasswordPage, and PasswordPage from "AI Running Coach" to "AI Training Coach"
- Updated Sidebar logo alt text and Coach page subtitle to use "training coach"
- Updated browser tab title in web/index.html and unauthorized.html page title
- Updated App.auth.test.tsx assertion to match the new heading text — all 635 web unit tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace "AI Running Coach" strings in React pages and Sidebar** - `902c5c0` (feat)
2. **Task 2: Update HTML title tags and fix the unit test assertion** - `c7adc17` (feat)

## Files Created/Modified
- `web/src/pages/LoginPage.tsx` - h1 updated to "AI Training Coach"
- `web/src/pages/ChangePasswordPage.tsx` - h1 updated to "AI Training Coach"
- `web/src/pages/PasswordPage.tsx` - h1 updated to "AI Training Coach"
- `web/src/components/layout/Sidebar.tsx` - logo img alt text updated to "AI Training Coach"
- `web/src/pages/Coach.tsx` - subtitle updated to "Chat with your AI training coach here."
- `web/index.html` - `<title>` updated to "AI Training Coach"
- `web/public/unauthorized.html` - `<title>` updated to "Access Denied — AI Training Coach"
- `web/src/__tests__/App.auth.test.tsx` - test description and getByText assertion updated to "AI Training Coach"

## Decisions Made
None - followed plan as specified. All 8 file changes were pure string substitutions with no logic changes.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
Pre-existing TypeScript build errors found in two unrelated test files (useDashboard.computeStats.test.ts: unused import + missing property types, WeeklyVolumeChart.test.tsx: unused `container` variable). These errors existed before this plan's changes (confirmed via git stash check) and are out of scope per deviation rules. Logged as deferred items.

All 635 vitest unit tests pass. TypeScript build errors are limited to test files not modified in this plan.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01 complete: all visible "AI Running Coach" strings replaced across the web frontend
- Ready for Plan 02 (API/backend rename pass) and Plan 03 (README/docs updates)

---
*Phase: 17-app-rename*
*Completed: 2026-05-09*
