---
phase: 12-delete-last-empty-week
plan: 02
subsystem: frontend
tags: [usePlan, PlanView, useChat, e2e, plan-management]
dependency_graph:
  requires:
    - 12-01 (deleteLastWeekOfPhase API endpoint)
  provides:
    - deleteLastWeek hook method
    - minus-week UI button in PlanView
    - plan:delete-week chat tag support
  affects:
    - TrainingPlan page (passes new prop)
    - useChat streaming pipeline
tech_stack:
  added: []
  patterns:
    - useCallback for async hook method
    - IIFE in JSX for per-phase button rendering
    - Plan tag processing in applyPlanOperations
key_files:
  created: []
  modified:
    - web/src/hooks/usePlan.ts
    - web/src/components/plan/PlanView.tsx
    - web/src/pages/TrainingPlan.tsx
    - web/src/hooks/useChat.ts
    - e2e/training-plan.spec.ts
    - web/src/__tests__/TrainingPlan.test.tsx
    - web/src/__tests__/TrainingPlan.feedback.test.tsx
    - web/src/__tests__/TrainingPlan.scroll.test.tsx
    - CLAUDE.md
decisions:
  - Used IIFE pattern in JSX to compute lastWeekIsEmpty per phase inline without a separate helper function
  - Button is disabled (not hidden) when last week has workout days — consistent with CLAUDE.md disabled button pattern
  - Phase.weeks.length > 1 guard prevents showing the button when there is only 1 week (can't delete the only week)
  - plan:delete-week tag added to all 4 strip locations in useChat.ts for complete symmetry with plan:add-week
metrics:
  duration: 25 minutes
  completed_date: 2026-04-27
  tasks: 2
  files: 9
---

# Phase 12 Plan 02: Delete Last Empty Week — Frontend Wire-up Summary

Wire the frontend for deleting the last empty week of a phase: `usePlan.deleteLastWeek`, a "− week" button in `PlanView`, and `<plan:delete-week>` chat tag support in `useChat.ts`. Symmetric with how "+ Add week" / `<plan:add-week>` work.

## Tasks Completed

### Task 1: Add deleteLastWeek to usePlan.ts and wire PlanView button

- Added `deleteLastWeek: (phaseIndex: number) => Promise<void>` to `UsePlanReturn` interface in `usePlan.ts`
- Implemented `deleteLastWeek` callback using `DELETE /api/plan/phases/${phaseIndex}/weeks/last`, calling `refreshPlan()` on success
- Added `onDeleteLastWeek?: (phaseIndex: number) => Promise<void>` prop to `PlanViewProps` in `PlanView.tsx`
- Rendered "− week" button using an IIFE in JSX that computes `lastWeekIsEmpty` per phase; button shows only when `phase.weeks.length > 1`; disabled (not hidden) when last week has workout days
- Updated `TrainingPlan.tsx` to destructure `deleteLastWeek` and pass `onDeleteLastWeek={deleteLastWeek}` to `<PlanView>`
- Fixed unit test mocks in three test files to include `deleteLastWeek: vi.fn().mockResolvedValue(undefined)` (TypeScript strict type check failure)

**Commit:** 070c7bd

### Task 2: Add plan:delete-week tag support to useChat.ts + E2E test

- Added `<plan:delete-week[^/]*\/>` strip to mount stripping block (init setMessages)
- Added strip and planUpdateDetected detection in both `sendMessage` onText and `startPlan` onText handlers
- Added strip to applyPlanOperations setMessages updater
- Added `deleteWeekRegex`, `deleteWeekMatches` in applyPlanOperations; processing loop calling `DELETE /api/plan/phases/${phaseIndex}/weeks/last`
- Added `deleteWeekErrors` array and included in `allErrors`
- Added `deleteWeekMatches.length > 0` to both `hasPlanMutation` and streaming `planUpdateDetected` conditions
- Also stripped `<plan:delete-week>` from the `insightText` cleanup in `run:create` processing
- Added 2 new E2E tests in `training-plan.spec.ts`:
  - "shows minus-week button and deletes last empty week on confirm" — verifies button visibility, dialog acceptance, DELETE request to correct URL
  - "minus-week button is disabled when last week has workout days" — verifies button visible but disabled

**Commit:** a17bcad

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript build failure in unit test mocks**
- **Found during:** Task 1 TypeScript build check
- **Issue:** Three test files (`TrainingPlan.test.tsx`, `TrainingPlan.feedback.test.tsx`, `TrainingPlan.scroll.test.tsx`) had mock objects for `usePlan` that omitted `deleteLastWeek`, causing TypeScript type errors ("Type 'undefined' is not assignable to type '(phaseIndex: number) => Promise<void>'")
- **Fix:** Added `deleteLastWeek: vi.fn().mockResolvedValue(undefined)` to the mock factory in each file
- **Files modified:** All three test files
- **Commit:** 070c7bd (included with Task 1)

## Verification Results

- TypeScript build (`npm run build` in `web/`): PASSED — 1069 modules, no errors
- Web unit tests (`npm test` in `web/`): 487/487 passed (34 test files)
- API unit tests (`npm test` in `api/`): 341/341 passed (33 test files)
- E2E tests (`npx playwright test e2e/training-plan.spec.ts`): 40/40 passed including 2 new tests

## Known Stubs

None — all functionality fully wired.

## Self-Check: PASSED
