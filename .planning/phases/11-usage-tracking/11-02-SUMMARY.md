---
phase: 11-usage-tracking
plan: 02
subsystem: api
tags: [mongodb, usage-tracking, aggregation, api-endpoints, admin]

# Dependency graph
requires:
  - phase: 11-01
    provides: usage_events collection, UsageEvent interface, computeCost() pricing utility
provides:
  - GET /api/usage/me — authenticated user usage totals and monthly breakdown
  - GET /api/users/usage-summary — admin-only userId→{thisMonth,allTime} map
  - usage.ts registered in index.ts
affects: [11-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MongoDB aggregation by {year,month} of timestamp field for time-bucketed cost reports"
    - "Admin aggregation groups all users in a single pipeline pass, reduce to map at app level"
    - "computeCost() applied at query time per bucket — no stored USD amounts"

key-files:
  created:
    - api/src/functions/usage.ts
    - api/src/__tests__/usage.test.ts
    - api/src/__tests__/adminUsageSummary.test.ts
  modified:
    - api/src/functions/admin.ts
    - api/src/index.ts

key-decisions:
  - "getUsageSummaryHandler uses a single aggregation pass across all users (no per-user filter) then reduces to map in JS — one DB round-trip for the entire admin summary"
  - "Users with zero usage events are absent from summary map — Admin.tsx shows $0.00 when key absent (D-13)"
  - "Route uses users/usage-summary (not admin/users/usage-summary) per Azure Functions /admin reservation rule"

requirements-completed: [USAGE-05, USAGE-06, USAGE-07]

# Metrics
duration: 4min
completed: 2026-04-27
---

# Phase 11 Plan 02: Usage API Endpoints Summary

**Two API endpoints serving usage data: GET /api/usage/me (user allTime+thisMonth+monthly breakdown) and GET /api/users/usage-summary (admin userId map), both backed by MongoDB aggregation on usage_events**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-27T07:48:38Z
- **Completed:** 2026-04-27T07:52:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `api/src/functions/usage.ts` with `getUsageMeHandler()` factory: MongoDB aggregation grouping usage_events by {year,month} per authenticated user, cost computed via `computeCost()` at query time, monthly[] sorted newest-first, thisMonth filtered by current calendar year+month
- Extended `api/src/functions/admin.ts` with `getUsageSummaryHandler()`: single aggregation pass across all users grouped by {userId,year,month}, reduced to a `Record<string, { thisMonth, allTime }>` map in application code
- Added `import './functions/usage.js'` to `api/src/index.ts` to register the route
- Added `computeCost` import to admin.ts for pricing in the new handler
- All 332 API unit tests pass; TypeScript and web builds succeed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GET /api/usage/me endpoint** - `13d2a66` (feat)
2. **Task 2: Add GET /api/users/usage-summary to admin.ts and register usage.ts in index.ts** - `168ea90` (feat)

_Both tasks used TDD flow: RED (failing test) → GREEN (implementation) → tests pass_

## Files Created/Modified

- `api/src/functions/usage.ts` — getUsageMeHandler factory, route 'usage/me' registered
- `api/src/__tests__/usage.test.ts` — 6 unit tests for usage/me (auth, zero-state, messages count, sort, thisMonth isolation, cost sum)
- `api/src/functions/admin.ts` — getUsageSummaryHandler added, computeCost import added, route 'users/usage-summary' registered
- `api/src/__tests__/adminUsageSummary.test.ts` — 6 unit tests for usage-summary (auth denial, empty state, map structure, thisMonth isolation, prior-month zero, multi-user)
- `api/src/index.ts` — added `import './functions/usage.js'`

## Decisions Made

- Single aggregation pass for admin summary (all users, all months in one pipeline) then reduced to map in JS — efficient, one DB round-trip regardless of user count
- Users with no usage events intentionally absent from summary map (Admin.tsx shows $0.00 when key absent, matching D-13)
- Route 'users/usage-summary' (not 'admin/users/usage-summary') — Azure Functions reserves /admin prefix

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `api/src/functions/usage.ts` — FOUND
- `api/src/__tests__/usage.test.ts` — FOUND
- `api/src/__tests__/adminUsageSummary.test.ts` — FOUND
- `api/src/functions/admin.ts` modified — FOUND (getUsageSummaryHandler exported, route registered)
- `api/src/index.ts` modified — FOUND (import './functions/usage.js')
- Commit `13d2a66` — FOUND
- Commit `168ea90` — FOUND
- 332 API unit tests passing — VERIFIED
- TypeScript build clean — VERIFIED
- Web build clean — VERIFIED
