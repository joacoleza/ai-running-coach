---
phase: 11-usage-tracking
plan: 03
subsystem: web
tags: [react, usage-tracking, admin, e2e, sidebar, routing]

# Dependency graph
requires:
  - phase: 11-01
    provides: usage_events collection, UsageEvent interface, computeCost()
  - phase: 11-02
    provides: GET /api/usage/me, GET /api/users/usage-summary endpoints
provides:
  - web/src/pages/Usage.tsx with stat cards and monthly breakdown table
  - Sidebar My Usage dropdown item navigating to /usage
  - /usage route registered in App.tsx
  - Admin panel Month and All-time columns (parallel usage-summary fetch)
  - e2e/usage.spec.ts with 5 tests
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel admin fetch: Promise.all([/api/users, /api/users/usage-summary]) with silent fallback on summary failure"
    - "Usage stat cards: two-column grid replicating Dashboard card style (bg-white rounded-xl shadow-sm border)"
    - "Empty usage state: monthly.length === 0 → single colspan row 'No usage recorded yet'"

key-files:
  created:
    - web/src/pages/Usage.tsx
    - e2e/usage.spec.ts
  modified:
    - web/src/components/layout/Sidebar.tsx
    - web/src/App.tsx
    - web/src/pages/Admin.tsx
    - e2e/global-setup.ts

key-decisions:
  - "formatCost() defined locally in each file (Usage.tsx and Admin.tsx) — no shared util needed for just two call sites"
  - "Usage page fetch uses useEffect with empty dep array; token from useAuth() is stable after mount"
  - "E2E tests mock /api/usage/me and /api/users/usage-summary via page.route() for deterministic assertions"
  - "global-setup.ts seeds 1 usage_event for test@example.com to support real-API E2E paths"

requirements-completed: [USAGE-08, USAGE-09, USAGE-10, USAGE-11]

# Metrics
duration: 12min
completed: 2026-04-27
---

# Phase 11 Plan 03: Usage Frontend and Admin Columns Summary

**UsagePage with all-time/this-month stat cards and monthly breakdown table, My Usage sidebar item, /usage route, Admin panel Month/All-time columns with parallel fetch, and 5 E2E tests**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-27T07:52:00Z
- **Completed:** 2026-04-27T08:03:00Z
- **Tasks:** 2 (+ auto-approved checkpoint)
- **Files modified:** 6

## Accomplishments

- Created `web/src/pages/Usage.tsx` with `useEffect` fetch of `/api/usage/me`, two stat cards (All-time / This month with cost and message count), monthly breakdown table (Month/Cost/Messages), empty state ("No usage recorded yet"), and error/loading states
- Updated `web/src/components/layout/Sidebar.tsx` to import `useNavigate` and add a "My Usage" dropdown button with bar chart icon, positioned before Logout, using `navigate('/usage')` with `setDropdownOpen(false)`
- Registered `/usage` route in `web/src/App.tsx` with `<Route path="/usage" element={<Usage />} />`
- Updated `web/src/pages/Admin.tsx` with parallel `Promise.all` fetch of `/api/users` and `/api/users/usage-summary`, `usageSummary` state, `formatCost` helper, Month/All-time `th` cells in desktop table, and matching `td` cells; mobile card list also shows usage line below Last login
- Updated `e2e/global-setup.ts` to clear `usage_events` collection on each run and seed 1 event for `test@example.com`
- Created `e2e/usage.spec.ts` with 5 tests covering: My Usage navigation, stat card display, monthly table headers, admin Month/All-time columns, and $0.00 for users with no usage

## Task Commits

Each task was committed atomically:

1. **Task 1: UsagePage, Sidebar My Usage, /usage route** - `030bac6` (feat)
2. **Task 2: Admin columns + E2E tests** - `e199693` (feat)

## Files Created/Modified

- `web/src/pages/Usage.tsx` — UsagePage component with stat cards, monthly table, error/loading states
- `web/src/components/layout/Sidebar.tsx` — useNavigate import, navigate const, My Usage button before Logout
- `web/src/App.tsx` — Usage import, /usage Route registration
- `web/src/pages/Admin.tsx` — formatCost helper, usageSummary state, Promise.all fetch, Month/All-time columns in table and mobile cards
- `e2e/global-setup.ts` — usage_events.deleteMany() + 1 insertOne for test@example.com
- `e2e/usage.spec.ts` — 5 E2E tests with mocked API responses

## Decisions Made

- `formatCost()` is defined locally in each file rather than extracted to a shared util — only two call sites, no need for shared module
- E2E tests use `page.route()` mocks for `/api/usage/me` and `/api/users/usage-summary` to ensure deterministic fixture data (avoids relying on seeded event matching exact cost values)
- Admin usage summary fetch is silently ignored on failure (summaryRes not ok → `setUsageSummary` stays `{}`) — user table still loads with $0.00 for all users
- `usageSummary[user._id]?.thisMonth ?? 0` pattern handles users absent from summary map (D-13)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data is wired to real API endpoints. The E2E tests use mock routes for determinism, but the actual fetch code calls real endpoints.

## Self-Check: PASSED

- `web/src/pages/Usage.tsx` — FOUND
- `web/src/components/layout/Sidebar.tsx` modified — FOUND (My Usage button at line 68)
- `web/src/App.tsx` modified — FOUND (/usage route at line 135)
- `web/src/pages/Admin.tsx` modified — FOUND (usage-summary fetch at line 63, Month/All-time columns)
- `e2e/global-setup.ts` modified — FOUND (usage_events at lines 47, 111)
- `e2e/usage.spec.ts` — FOUND
- Commit `030bac6` — Task 1
- Commit `e199693` — Task 2
- 332 API unit tests passing — VERIFIED
- Web build clean — VERIFIED

---
*Phase: 11-usage-tracking*
*Completed: 2026-04-27*
