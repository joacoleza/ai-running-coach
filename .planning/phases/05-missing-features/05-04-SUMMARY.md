---
phase: 05-missing-features
plan: 04
subsystem: tests
tags: [testing, unit-tests, e2e, useChat, playwright, vitest]

# Dependency graph
requires:
  - phase: 05-01
    provides: POST /api/plan/phases, PATCH /api/plan targetDate, API unit tests
  - phase: 05-02
    provides: four new tag handlers in useChat.ts
  - phase: 05-03
    provides: + Add phase button in PlanView, target date inline editor in TrainingPlan

provides:
  - useChat unit tests for plan:add-phase, plan:update-goal, run:create, run:update-insight
  - E2E tests for + Add phase button and target date inline editing
  - Full passing test suite: 193 API tests, 418 web tests, 62 E2E tests

affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "mockFetch call order: mount (GET plan + GET messages), chat stream, fetchPlan after done, API call, fetchPlan inside applyPlanOperations"
    - "plan-updated event listener added/removed within test to assert no-dispatch for insight-only"
    - "E2E route mocking uses addPhaseCalled flag pattern to return different GET responses before/after POST"

key-files:
  created: []
  modified:
    - web/src/__tests__/useChat.trainingPlan.test.ts
    - e2e/training-plan.spec.ts

key-decisions:
  - "run:update-insight test uses window.addEventListener/removeEventListener to assert plan-updated NOT dispatched (insight-only)"
  - "E2E Add phase test sets addPhaseCalled flag then returns different plan on subsequent GET /api/plan call"
  - "E2E target date test uses loginWithPlan helper for simplicity since mockActivePlan already has targetDate"
  - "API unit tests (planPhases.test.ts and plan.test.ts) were already completed in Plan 01 — Task 1 verified only"

patterns-established:
  - "useChat tag test: mock 1=GET plan, 2=GET messages, 3=stream, 4=fetchPlan, 5=tag API call, 6=fetchPlan inside applyPlanOperations"

requirements-completed: [FEAT-TEST-COVERAGE]

# Metrics
duration: 10min
completed: 2026-04-11
---

# Phase 05 Plan 04: Test Coverage Summary

**useChat unit tests for all four new Phase 5 tag handlers; E2E tests for + Add phase button and target date inline editing; all test layers green**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-11T18:49:14Z
- **Completed:** 2026-04-11T18:59:39Z
- **Tasks:** 4
- **Files modified:** 2

## Accomplishments

- Added 16 new useChat unit tests covering all four Phase 5 tag handlers:
  - `plan:add-phase`: POST /api/plan/phases called, tag stripped from message
  - `plan:update-goal`: PATCH /api/plan with targetDate, empty string clears field
  - `run:create`: POST /api/runs without unit field, error on missing required fields
  - `run:update-insight`: PATCH /api/runs/:runId with insight, plan-updated NOT dispatched, error on missing runId

- Added 3 new E2E tests:
  - "+ Add phase button visible and creates a new phase on click" — POST to /api/plan/phases called
  - "shows target date and allows entering edit mode" — click shows date input, Escape reverts
  - "shows + Set target date when no target date is set" — placeholder text shown correctly

- Verified all test layers pass:
  - API: 193 tests passing
  - Web: 418 tests passing (was 402 before, added 16)
  - Build: TypeScript compiles clean
  - E2E: 62 tests passing (was 59 before, added 3)

## Task Commits

1. **Task 1: API unit tests** - Tests were already written in Plan 01 (planPhases.test.ts + plan.test.ts); verified 38 tests passing
2. **Task 2: useChat unit tests** - `3c3e517` (test)
3. **Task 3: E2E tests** - `667a68c` (test)
4. **Task 4: Full test suite verification** - No new files; all layers confirmed green

## Files Created/Modified

- `web/src/__tests__/useChat.trainingPlan.test.ts` - Added 16 tests in `describe('sendMessage — phase 5 new tag handlers')`
- `e2e/training-plan.spec.ts` - Added `test.describe('Phase 5 features — Add phase and target date editing')` with 3 tests

## Decisions Made

- API unit tests (planPhases.test.ts addPhase tests, plan.test.ts targetDate tests) were already written as part of Plan 01 — Task 1 verified they pass and move on
- The `run:update-insight` no-dispatch assertion uses `window.addEventListener` + `window.removeEventListener` within the test to precisely count `plan-updated` events
- E2E Add phase test uses a `addPhaseCalled` flag + route override that returns different plan responses before and after POST — simulates server state change without real DB

## Deviations from Plan

None - plan executed exactly as written. API tests were pre-existing from Plan 01, so Task 1 was verification only rather than new test authoring.

## Known Stubs

None.

## Self-Check: PASSED

- `web/src/__tests__/useChat.trainingPlan.test.ts` — FOUND
- `e2e/training-plan.spec.ts` — FOUND
- Commit `3c3e517` — FOUND
- Commit `667a68c` — FOUND
- All 193 API tests passing
- All 418 web tests passing
- TypeScript build clean
- All 62 E2E tests passing
