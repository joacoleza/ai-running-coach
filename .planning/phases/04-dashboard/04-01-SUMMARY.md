---
phase: 04-dashboard
plan: "01"
subsystem: frontend-routing-dashboard
tags: [routing, dashboard, recharts, sidebar, scaffold]
dependency_graph:
  requires: []
  provides: [dashboard-scaffold, recharts-installed, dashboard-routing]
  affects: [web/src/App.tsx, web/src/components/layout/Sidebar.tsx, web/src/pages/Dashboard.tsx]
tech_stack:
  added: [recharts@3.8.1]
  patterns: [filter-preset-state, role-button-navigation]
key_files:
  created: []
  modified:
    - web/src/App.tsx
    - web/src/components/layout/Sidebar.tsx
    - web/src/pages/Dashboard.tsx
    - web/package.json
    - web/src/__tests__/pages.test.tsx
    - web/src/components/layout/Sidebar.test.tsx
    - CLAUDE.md
decisions:
  - "Dashboard is the new app home: / and * routes redirect to /dashboard"
  - "FilterPreset type and FILTER_PRESETS exported from Dashboard.tsx for useDashboard hook consumption in plan 04-02"
  - "verbatimModuleSyntax requires export type FilterPreset separate from export FILTER_PRESETS"
  - "Adherence stat card uses role=button + navigate('/plan') per D-11"
metrics:
  duration: "3 min"
  completed_date: "2026-04-08"
  tasks_completed: 3
  files_changed: 7
---

# Phase 4 Plan 1: Routing, Recharts, and Dashboard Scaffold Summary

Dashboard becomes the app home (/ → /dashboard), Recharts installed, and Dashboard page scaffolded with filter row + 4 stat cards + 2 chart placeholder areas matching the structure downstream plans will populate.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Routing + Sidebar nav order | 8657be4 | App.tsx, Sidebar.tsx |
| 2 | Install Recharts + scaffold Dashboard page | c0d303b | package.json, Dashboard.tsx |
| 3 | Update routing + sidebar tests (TDD) | 52ac29a | pages.test.tsx, Sidebar.test.tsx |

## What Was Built

**Routing changes (App.tsx):**
- `"/"` now redirects to `"/dashboard"` (was `"/plan"`)
- `"*"` fallback also redirects to `"/dashboard"`

**Sidebar reorder (Sidebar.tsx):**
- navItems: Dashboard → Training Plan → Runs → Archive (Dashboard now first)

**Recharts installed:**
- `recharts@3.8.1` added to `web/package.json` dependencies

**Dashboard scaffold (Dashboard.tsx):**
- `FilterPreset` type with 7 presets: current-plan, last-4-weeks, last-8-weeks, last-3-months, last-12-months, this-year, all-time
- `FILTER_PRESETS` array exported — consumed by `useDashboard` in plan 04-02
- `activeFilter` useState defaulting to `'current-plan'`
- Filter row: 7 pill buttons, active state with gray-200 background
- 4 stat cards: Total Distance, Total Runs, Total Time, Adherence
- Adherence card: `role="button"` + `cursor-pointer` + `navigate('/plan')` per D-11
- 2 chart placeholder areas: Weekly Volume, Pace Trend (h-72 "Chart coming soon")

**Tests (363 passing, 0 failing):**
- `pages.test.tsx`: Dashboard wrapped in MemoryRouter; tests heading + 7 filter labels + 4 stat card labels
- `Sidebar.test.tsx`: added test asserting Dashboard link appears before Training Plan link in DOM

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript verbatimModuleSyntax type re-export error**
- **Found during:** Task 2 build verification
- **Issue:** `export { FilterPreset, FILTER_PRESETS }` fails with TS1205 when verbatimModuleSyntax is enabled — type must use `export type`
- **Fix:** Separated into `export type { FilterPreset }` and `export { FILTER_PRESETS }`
- **Files modified:** web/src/pages/Dashboard.tsx
- **Commit:** c0d303b (included in same task commit)

## Known Stubs

| File | Element | Reason |
|------|---------|--------|
| web/src/pages/Dashboard.tsx:51 | All 4 stat cards show `—` | Data wired in plan 04-02 (useDashboard hook) |
| web/src/pages/Dashboard.tsx:84 | Chart areas show "Chart coming soon" | Charts implemented in plan 04-03 |

These stubs are intentional — plan 04-01 scope is scaffold only. Plans 04-02 and 04-03 will wire data.

## Self-Check: PASSED
