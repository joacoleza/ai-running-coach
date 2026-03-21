---
phase: 01-infrastructure-auth
plan: 02
subsystem: auth, ui
tags: [azure-static-web-apps, react-router, tailwindcss, vitest, testing-library]

# Dependency graph
requires:
  - phase: 01-infrastructure-auth/01-01
    provides: Vite+React scaffold, react-router-dom, tailwindcss v4, vitest setup, shared/types/index.ts with NavRoute interface
provides:
  - staticwebapp.config.json locking all routes to owner role with GitHub OAuth redirect on 401
  - React app shell with AppShell layout, Sidebar navigation, and four placeholder pages
  - Sidebar tests verifying 4 nav links, navigation role, and data-testid
affects:
  - 01-03 (owner role assignment via az staticwebapp users update)
  - All future phases (use AppShell/Sidebar, add pages to routes)

# Tech tracking
tech-stack:
  added: []
  patterns: [SWA owner-role lockdown, React Router BrowserRouter + AppShell layout, responsive sidebar (icon-only mobile / labeled desktop)]

key-files:
  created:
    - staticwebapp.config.json
    - src/components/layout/AppShell.tsx
    - src/components/layout/Sidebar.tsx
    - src/components/layout/Sidebar.test.tsx
    - src/pages/Dashboard.tsx
    - src/pages/TrainingPlan.tsx
    - src/pages/Coach.tsx
    - src/pages/Runs.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "owner role (not authenticated) on /* and /api/* — prevents any random GitHub user from logging in"
  - "Sidebar collapses to icon-only on mobile (w-16) and expands on desktop (md:w-56) using Tailwind responsive prefix"
  - "NavLink with end={true} on / prevents Dashboard being always-active when on sub-routes"

patterns-established:
  - "Pattern 1: All SWA routes require owner role — add new routes to staticwebapp.config.json navigationFallback, not routes array"
  - "Pattern 2: New pages go in src/pages/, get a Route in App.tsx, and a NavLink entry in Sidebar.tsx navItems"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 1 Plan 02: SWA Auth Lockdown and React App Shell Summary

**SWA owner-only auth lockdown (GitHub OAuth redirect on 401) plus React sidebar app shell with four placeholder pages wired via React Router**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-22T00:18:40Z
- **Completed:** 2026-03-22T00:20:15Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- staticwebapp.config.json enforces owner-only access on /* and /api/*; unauthenticated requests redirect to GitHub OAuth (AUTH-01, AUTH-02)
- AppShell layout with responsive Sidebar (icon-only on mobile, labeled on desktop) wraps all routes
- Four placeholder pages (Dashboard, TrainingPlan, Coach, Runs) at routes /, /plan, /coach, /runs with catch-all Navigate redirect
- Sidebar.test.tsx with 3 passing tests verifying nav links, navigation role, and data-testid

## Task Commits

Each task was committed atomically:

1. **Task 1: Create staticwebapp.config.json with owner-only auth lockdown** - `a0649a7` (feat)
2. **Task 2: Build React app shell with sidebar navigation and placeholder pages** - `22471f0` (feat)

## Files Created/Modified

- `staticwebapp.config.json` - SWA routing config: owner-only lock on /* and /api/*, GitHub OAuth 401 redirect, SPA navigationFallback
- `src/App.tsx` - Updated with BrowserRouter, AppShell wrapper, Routes for all 4 pages, catch-all Navigate
- `src/components/layout/AppShell.tsx` - Layout wrapper: Sidebar + main content flex container
- `src/components/layout/Sidebar.tsx` - Nav sidebar: 4 NavLinks, responsive w-16/md:w-56, data-testid, aria roles
- `src/components/layout/Sidebar.test.tsx` - 3 tests: nav links rendered, navigation role, data-testid present
- `src/pages/Dashboard.tsx` - Placeholder Dashboard page
- `src/pages/TrainingPlan.tsx` - Placeholder Training Plan page
- `src/pages/Coach.tsx` - Placeholder Coach Chat page
- `src/pages/Runs.tsx` - Placeholder Runs page

## Decisions Made

- Used `"allowedRoles": ["owner"]` (not `"authenticated"`) on all routes — prevents any GitHub user from accessing the app; only the explicitly assigned owner can log in
- Sidebar uses Tailwind responsive prefix `md:w-56` for desktop expansion and `w-16` icon-only on mobile without JavaScript state
- NavLink `end={true}` on the `/` path prevents Dashboard from being active on all routes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Owner role assignment is handled in Plan 03.

## Known Stubs

The following pages are intentional stubs — placeholder content only, no data wired:
- `src/pages/Dashboard.tsx` — "Your training overview will appear here." (Phase 4 will implement)
- `src/pages/TrainingPlan.tsx` — "Your weekly training calendar will appear here." (Phase 2/4 will implement)
- `src/pages/Coach.tsx` — "Chat with your AI running coach here." (Phase 2 will implement)
- `src/pages/Runs.tsx` — "Your run history and uploads will appear here." (Phase 3 will implement)

These stubs are intentional for this plan — the plan's goal is the navigation structure and auth lockdown, not the page content. Future phases will fill each page.

## Self-Check: PASSED

- staticwebapp.config.json: FOUND
- src/components/layout/AppShell.tsx: FOUND
- src/components/layout/Sidebar.tsx: FOUND
- src/components/layout/Sidebar.test.tsx: FOUND
- src/pages/Dashboard.tsx: FOUND
- src/pages/TrainingPlan.tsx: FOUND
- src/pages/Coach.tsx: FOUND
- src/pages/Runs.tsx: FOUND
- .planning/phases/01-infrastructure-auth/01-02-SUMMARY.md: FOUND
- Commit a0649a7 (Task 1): FOUND
- Commit 22471f0 (Task 2): FOUND

## Next Phase Readiness

- SWA auth boundary is in place — deploy config is ready for Plan 03 (CI/CD and owner role assignment)
- App shell is ready for all future feature phases to add real content to the placeholder pages
- No blockers

---
*Phase: 01-infrastructure-auth*
*Completed: 2026-03-22*
