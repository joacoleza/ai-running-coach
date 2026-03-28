---
phase: quick
plan: 260328-uuj
subsystem: api, web
tags: [bug-fix, plan-adjustment, 409-guard, error-surfacing]
dependency_graph:
  requires: []
  provides: [plan-regeneration-without-guard, past-date-add-with-flags, plan-update-error-display]
  affects: [api/src/functions/plan.ts, api/src/functions/planDays.ts, web/src/hooks/useChat.ts]
tech_stack:
  added: []
  patterns: [error-collection-array, combined-error-display]
key_files:
  created: []
  modified:
    - api/src/functions/plan.ts
    - api/src/functions/planDays.ts
    - api/src/__tests__/plan.test.ts
    - api/src/__tests__/planDays.test.ts
    - web/src/hooks/useChat.ts
    - CLAUDE.md
decisions:
  - "Removed both completed-day 409 guards from generatePlan and createPlan — plan regeneration should always be allowed"
  - "addDay allows past dates only when completed=true or skipped=true — pending past days still rejected"
  - "Combined updateErrors + addErrors into allErrors displayed with warning emoji prefix"
metrics:
  duration: "5 min"
  completed_date: "2026-03-28"
  tasks: 3
  files: 6
---

# Quick Task 260328-uuj: Fix Plan Adjustment 409 Conflict — Summary

**One-liner:** Removed completed-day 409 guards from plan regeneration/creation, allowed past dates in plan:add with completed/skipped flags, and surfaced plan:update PATCH errors in the coach chat.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove 409 guards and allow past dates with flags in API | bd62964 | plan.ts, planDays.ts, plan.test.ts, planDays.test.ts |
| 2 | Surface plan:update errors in chat and update CLAUDE.md | 007c766 | useChat.ts, CLAUDE.md |
| 3 | Run E2E tests to verify no regressions | (no commit) | — |

## Changes Made

### Task 1 — API Changes

**`api/src/functions/plan.ts`**
- Removed the `activePlanWithHistory` check from `createPlan` (lines 57-70) — creating a new plan no longer returns 409 when completed days exist
- Removed both guard blocks from `generatePlan`: Check 1 (target plan completed days) and Check 2 (other active plan with history)

**`api/src/functions/planDays.ts`**
- Added `completed?: string | boolean; skipped?: string | boolean` to the addDay body type
- Replaced unconditional past-date rejection with conditional: only rejects if neither `completed` nor `skipped` is truthy
- Updated `$set` to use actual `completed`/`skipped` values from request body instead of hardcoding `false`

**Test updates:**
- `plan.test.ts`: Both 409 guard tests updated to expect 200/201 success; describe blocks renamed; `createPlan` guard test updated to expect 201
- `planDays.test.ts`: Past-date test error message updated to "pending training day"; two new tests added for past dates with `completed=true` and `skipped=true`

### Task 2 — Frontend + CLAUDE.md Changes

**`web/src/hooks/useChat.ts`**
- `sendMessage`: Added `updateErrors` array to collect PATCH failures from plan:update loop; combined with `addErrors` into `allErrors`; display format changed from `Note:` to `⚠️` prefix
- `startPlan`: Same pattern applied with `updateErrors2` — now collects PATCH errors and combines with `addErrors2`

**`CLAUDE.md`**
- Updated "Plan replace guard" bullet — removed 409 references for generatePlan/createPlan; clarified past-date addDay behavior
- Updated "Past dates in initial plan generation" — added note that plan:add also allows past dates with completed/skipped flags
- Added new "plan:update and plan:add error surfacing" bullet

## Test Results

- API tests: 121 passed
- Web tests: 201 passed
- E2E tests: 38 passed

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- bd62964 exists: confirmed (`git log`)
- 007c766 exists: confirmed (`git log`)
- `api/src/functions/plan.ts` modified: confirmed
- `api/src/functions/planDays.ts` modified: confirmed
- `web/src/hooks/useChat.ts` modified: confirmed
- `CLAUDE.md` modified: confirmed
