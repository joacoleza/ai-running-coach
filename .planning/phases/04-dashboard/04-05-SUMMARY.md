---
phase: 04-dashboard
plan: 05
subsystem: e2e
tags: [playwright, e2e, dashboard, archive-plan, routing]
dependency_graph:
  requires: [04-03, 04-04]
  provides: [E2E coverage for Dashboard routing, filters, stat cards, Adherence navigation, ArchivePlan FAB]
  affects: []
tech_stack:
  added: []
  patterns: [playwright-route-mock, beforeEach-auth-setup, mobile-viewport-e2e]
key_files:
  created:
    - e2e/dashboard.spec.ts
  modified: []
decisions:
  - "All 7 dashboard/archive E2E tests pass; 48 pre-existing failures in other specs are out of scope (caused by Phase 04-01 home route change from /plan to /dashboard)"
  - "ArchivePlan FAB test sets mobile viewport before page.goto() to ensure FAB is visible on first render"
  - "Empty state test overrides the beforeEach plan mock locally with null plan to test no-plan scenario"
metrics:
  duration: 8min
  completed: "2026-04-09T14:39:00Z"
  tasks: 1
  files: 1
---

# Phase 04 Plan 05: Dashboard + ArchivePlan E2E Tests Summary

**One-liner:** Playwright E2E tests for Dashboard routing redirect, filter preset active states, stat card labels, Adherence card navigation, empty state (no plan), and ArchivePlan mobile FAB visibility.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | E2E tests for Dashboard + ArchivePlan | 5c02c41 | e2e/dashboard.spec.ts |

## What Was Built

**`e2e/dashboard.spec.ts`** — 7 tests across 2 describe blocks:

**Dashboard describe (6 tests):**
- `/ redirects to /dashboard` — auth in localStorage + route mocks + goto('/') → asserts URL matches /dashboard
- `Dashboard sidebar link is first nav item` — gets all nav links, asserts first link text contains "Dashboard"
- `filter presets render and active state changes on click` — asserts "Current Plan" has bg-gray-200 active class, clicks "Last 4 weeks", asserts it gains active class and "Current Plan" loses it
- `stat cards render correct labels` — asserts "Total Distance", "Total Runs", "Total Time", "Adherence" all visible
- `Adherence card navigates to /plan on click` — clicks `[role="button"]` with "Adherence" text, asserts URL matches /plan
- `empty state when no active plan and Current Plan filter` — overrides plan mock with null, asserts "No active training plan" and "Start Planning" button visible

**ArchivePlan describe (1 test):**
- `archived plan page shows readonly panel FAB on mobile` — sets 375x812 viewport, mocks /api/plans/archived/archive-001, asserts "View plan history" FAB button visible

**Pattern:** `beforeEach` sets auth via `addInitScript` (localStorage) + mocks `/api/plan`, `/api/plans/archived`, `/api/runs*`, `/api/messages**`. Individual tests override mocks locally when needed. Consistent with existing `runs.spec.ts` and `training-plan.spec.ts` patterns.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Pre-existing Issues (Out of Scope)

48 failures exist in `auth.spec.ts`, `coach.spec.ts`, `runs.spec.ts`, and `training-plan.spec.ts`. These tests use a `loginWithMocks` helper that expects `toHaveURL(/\/plan/)` after goto('/'), but Phase 04-01 changed the home route to redirect to `/dashboard`. These failures pre-date this plan and are not caused by any changes in this plan. Logged to deferred-items for Phase 04 wrap-up.

## Self-Check: PASSED

- e2e/dashboard.spec.ts: EXISTS
- Commit 5c02c41: EXISTS (test(04-05): add E2E tests for Dashboard routing, filters, stat cards, and ArchivePlan FAB)
- `npx playwright test e2e/dashboard.spec.ts`: 7 passed, 0 failed
- `cd web && npm test`: 403 passed, 0 failed
- `cd web && npm run build`: exits 0
