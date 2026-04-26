---
phase: 09-admin-panel
plan: "04"
subsystem: admin-ui, auth
tags: [responsive, mobile, admin, auth, lastLoginAt]
dependency_graph:
  requires: ["09-02"]
  provides: ["mobile-admin-table", "lastLoginAt-on-refresh"]
  affects: ["web/src/pages/Admin.tsx", "api/src/functions/auth.ts"]
tech_stack:
  added: []
  patterns: ["Tailwind responsive breakpoints (md:hidden / hidden md:block)", "fire-and-forget updateOne for non-blocking DB writes", "sv-SE locale for ISO-like datetime formatting"]
key_files:
  created: []
  modified:
    - web/src/pages/Admin.tsx
    - api/src/functions/auth.ts
    - api/src/__tests__/authEndpoints.test.ts
    - web/src/__tests__/Admin.test.tsx
decisions:
  - "Used sv-SE locale in toLocaleString for YYYY-MM-DD HH:MM:SS output without manual string formatting"
  - "Fire-and-forget updateOne in getRefreshHandler keeps refresh response latency unchanged"
  - "Dual-layout (ul/li cards + hidden table) keeps desktop unchanged; no CSS media queries in JS"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-19"
  tasks: 5
  files_modified: 4
---

# Phase 09 Plan 04: Mobile Admin Table & lastLoginAt on Refresh Summary

Gap-closure plan closing 3 UAT issues: mobile table overflow, date-only last login, and stale lastLoginAt on silent refresh sessions.

## What Was Built

**1. Responsive admin table (Admin.tsx)**
Replaced the bare `<table>` in the populated-state branch with a dual-layout structure:
- `<ul className="md:hidden divide-y divide-gray-100">` — card list visible below the `md` breakpoint, showing email, StatusBadge, last login line, and action buttons stacked vertically per user
- `<div className="hidden md:block overflow-x-auto">` wrapping the unchanged `<table>` — visible at md and above

Aria-labels on card buttons are identical to table buttons so all existing unit tests target the correct elements with no selector changes (tests updated to use `getAllBy*` queries since each user now renders twice).

**2. Full datetime in Last Login (Admin.tsx)**
Updated `formatLastLogin` from `toLocaleDateString('en-GB', ...)` to `toLocaleString('sv-SE', { hour, minute, second, hour12: false })`. The sv-SE locale naturally produces `YYYY-MM-DD HH:MM:SS` format — unambiguous and sortable. Applied in both mobile card (`Last login: {formatLastLogin(...)}`) and desktop table cell.

**3. lastLoginAt updated on token refresh (auth.ts)**
Added a fire-and-forget `db.collection('users').updateOne({ _id: doc.userId }, { $set: { lastLoginAt: new Date() } }).catch(() => {})` immediately after the user document is confirmed valid in `getRefreshHandler`. This keeps the refresh response fast (no await) while ensuring `lastLoginAt` reflects the user's last active session rather than just their last password login.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 + 1c | 5f3d63a | feat(09-04): responsive admin table with card layout on mobile and full datetime last login |
| 1b | 478bff6 | feat(09-04): update lastLoginAt on token refresh in getRefreshHandler |
| 2 | a0ff8e8 | fix(09-04): remove unused imports in Admin.test.tsx to fix TypeScript build |

## Test Results

- Web unit tests: 466 passed (0 failed) — includes updated Admin.test.tsx with `getAllBy*` queries
- API unit tests: 297 passed (0 failed) — includes new Test 11b for refresh lastLoginAt
- E2E tests: 77 passed (0 failed)
- TypeScript build: exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing TypeScript build errors in Admin.test.tsx**
- **Found during:** Task 2 (TypeScript build check)
- **Issue:** Three unused imports/variables caused `tsc -b` to fail: `act` from testing-library, `App` import, and `isCreateCall` variable
- **Fix:** Removed all three unused references. These were pre-existing before this plan's changes.
- **Files modified:** `web/src/__tests__/Admin.test.tsx`
- **Commit:** a0ff8e8

**2. [Rule 1 - Bug] Admin tests failed after dual-layout (multiple elements)**
- **Found during:** Task 1 verification
- **Issue:** Tests using `getByText()` and `getByRole()` failed because elements now appear in both mobile and desktop layouts (two DOM nodes per user)
- **Fix:** Updated all affected assertions in Admin.test.tsx to use `getAllByText()` and `getAllByRole()`, then click/assert on `[0]` (first match). Also updated `getAllByText` assertions to check `.length > 0`.
- **Files modified:** `web/src/__tests__/Admin.test.tsx`
- **Commit:** 5f3d63a

## Known Stubs

None — all three gaps are fully closed with real implementations.

## Self-Check

Files modified verified:
- `web/src/pages/Admin.tsx` — contains `md:hidden`, `hidden md:block overflow-x-auto`, updated `formatLastLogin`
- `api/src/functions/auth.ts` — contains `lastLoginAt: new Date()` in `getRefreshHandler`
- `api/src/__tests__/authEndpoints.test.ts` — contains Test 11b
- `web/src/__tests__/Admin.test.tsx` — uses `getAllByText`, `getAllByRole`

Commits verified:
- 5f3d63a — feat(09-04): responsive admin table
- 478bff6 — feat(09-04): lastLoginAt on refresh
- a0ff8e8 — fix(09-04): TypeScript build

## Self-Check: PASSED
