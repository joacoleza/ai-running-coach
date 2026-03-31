---
phase: quick-260331-0vx
plan: 01
subsystem: training-plan
tags: [phase-management, inline-editing, api, ui, agent-commands]
dependency_graph:
  requires: []
  provides: [phase-edit-ui, phase-delete-ui, phase-management-api, agent-phase-commands]
  affects: [PlanView, useChat, usePlan, TrainingPlan, system-prompt]
tech_stack:
  added: []
  patterns: [click-to-edit, azure-functions-http, mongodb-set-pop]
key_files:
  created:
    - api/src/functions/planPhases.ts
    - api/src/__tests__/planPhases.test.ts
    - web/src/components/plan/PhaseHeader.tsx
  modified:
    - api/src/shared/prompts.ts
    - web/src/hooks/usePlan.ts
    - web/src/hooks/useChat.ts
    - web/src/components/plan/PlanView.tsx
    - web/src/pages/TrainingPlan.tsx
    - web/src/__tests__/PlanView.test.tsx
    - web/src/__tests__/TrainingPlan.test.tsx
    - web/src/__tests__/usePlan.test.ts
    - e2e/training-plan.spec.ts
    - CLAUDE.md
decisions:
  - PATCH /api/plan/phases/:phaseIndex uses $set with direct field paths (phases.0.name) rather than arrayFilters — phases are top-level array elements, not nested
  - DELETE uses $pop: { phases: 1 } to remove last element atomically
  - PhaseHeader shows delete button using title="Delete last phase" for E2E testability
  - Empty string description is valid (allowed to clear description)
metrics:
  duration: "25 min"
  completed_date: "2026-03-31"
  tasks: 2
  files: 13
---

# Quick Task 260331-0vx: Edit Phase Title/Description and Delete Summary

## One-liner

Phase-level inline editing and deletion via `PhaseHeader.tsx` component, `PATCH/DELETE /api/plan/phases` endpoints, and `<plan:update-phase>`/`<plan:delete-phase>` agent XML commands.

## What Was Built

### Task 1: API endpoints and system prompt

`api/src/functions/planPhases.ts` implements two Azure Functions:

- `PATCH /api/plan/phases/{phaseIndex}` — updates `name` and/or `description` for the given 0-based phase index. Validates the index (non-negative integer, within bounds). Returns 200 with updated plan.
- `DELETE /api/plan/phases/last` — removes the last phase. Guards: returns 400 if only one phase, 409 if last phase has completed days. Uses `$pop: { phases: 1 }`.

`api/src/shared/prompts.ts` adds a "Phase Management Commands" section documenting `<plan:update-phase>` and `<plan:delete-phase>` XML tags.

`api/src/__tests__/planPhases.test.ts` — 14 integration tests covering all guard rails and success paths for both endpoints.

### Task 2: UI, agent commands, and tests

`web/src/components/plan/PhaseHeader.tsx` — new component providing:
- Click-to-edit title (h2 → input, save on Enter/blur, cancel on Escape)
- Click-to-edit description (p → textarea, save on blur, cancel on Escape)
- Delete button visible only when `isLastPhase && totalPhases > 1 && !readonly`
- `window.confirm()` dialog before deletion
- `isSaving`/`isDeleting` spinners, inline error display
- `text-[16px]` on inputs/textareas for iOS zoom prevention

`web/src/components/plan/PlanView.tsx` — replaced static phase h2/p with `<PhaseHeader>`, added `onUpdatePhase` and `onDeletePhase` props.

`web/src/hooks/useChat.ts` — adds streaming tag stripping and done-handler processing for `<plan:update-phase>` and `<plan:delete-phase>` in both `sendMessage` and `startPlan` paths. Tags are stripped before `<plan:update>` patterns to prevent partial matches.

`web/src/pages/TrainingPlan.tsx` — passes `updatePhase` and `deleteLastPhase` to `<PlanView>`.

Tests added:
- `PlanView.test.tsx`: 3 new tests (PhaseHeader editable title, delete button on last phase only, no delete in readonly)
- `usePlan.test.ts`: 4 new tests (updatePhase success + error, deleteLastPhase success + error)
- `TrainingPlan.test.tsx`: updated `defaultUsePlan` mock to include new required methods
- `e2e/training-plan.spec.ts`: 4 new E2E tests (edit name inline, edit description inline, delete button count, delete with confirmation)

`CLAUDE.md` updated with Phase edit/delete architecture decision bullet.

## Test Results

- API tests: 145 passed (14 new in planPhases.test.ts)
- Web unit tests: 206 passed (3 new in PlanView.test.tsx, 4 new in usePlan.test.ts)
- Web build: TypeScript compiles, Vite bundle succeeds
- E2E tests: 42 passed (4 new phase edit/delete tests)

## Deviations from Plan

### Pre-existing implementation

Most of the implementation was already in place on the branch:
- `api/src/functions/planPhases.ts` — already implemented
- `api/src/__tests__/planPhases.test.ts` — already implemented
- `api/src/shared/prompts.ts` — phase management commands section already present
- `web/src/hooks/usePlan.ts` — `updatePhase` and `deleteLastPhase` already implemented
- `web/src/hooks/useChat.ts` — streaming tag stripping and done-handler processing already implemented
- `web/src/pages/TrainingPlan.tsx` — already destructures and passes phase methods
- `web/src/components/plan/PlanView.tsx` — already uses PhaseHeader

This task execution added the missing tests and fixed a TypeScript error in `TrainingPlan.test.tsx` (the `defaultUsePlan` mock was missing the newly required `updatePhase` and `deleteLastPhase` methods).

## Known Stubs

None. All functionality is wired end-to-end.

## Self-Check: PASSED

Files checked:
- `api/src/functions/planPhases.ts` — FOUND
- `api/src/__tests__/planPhases.test.ts` — FOUND
- `web/src/components/plan/PhaseHeader.tsx` — FOUND
- `web/src/hooks/useChat.ts` — FOUND (plan:update-phase and plan:delete-phase processing)
- `web/src/__tests__/PlanView.test.tsx` — FOUND (3 new PhaseHeader tests)
- `web/src/__tests__/usePlan.test.ts` — FOUND (4 new updatePhase/deleteLastPhase tests)
- `e2e/training-plan.spec.ts` — FOUND (4 new phase edit/delete tests)

Commits:
- `56741d7` — feat(quick-260331-0vx-01): API endpoints (pre-existing on branch)
- `39ba0e7` — feat(quick-260331-0vx-01): UI, agent commands, and tests
