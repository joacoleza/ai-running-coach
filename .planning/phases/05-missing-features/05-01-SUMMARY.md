---
phase: 05-missing-features
plan: 01
subsystem: api
tags: [mongodb, azure-functions, training-plan, system-prompt, chat]

# Dependency graph
requires:
  - phase: 03-run-logging
    provides: run data model with weekNumber/dayLabel/insight fields
  - phase: 02.1-training-plan-redesign
    provides: assignPlanStructure, PlanPhase types, planPhases.ts handler pattern
provides:
  - POST /api/plan/phases endpoint creating new phases with sequential weekNumbers
  - PATCH /api/plan accepting targetDate (set/clear)
  - System prompt documentation for plan:add-phase, plan:update-goal, run:create, run:update-insight
  - RunId exposed in synthetic plan-state context for completed days
affects: [05-02, 05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "assignPlanStructure called after phase array mutation to recompute global week numbers"
    - "$unset used to remove targetDate field (not stored as empty string)"
    - "Run._id exposed as string in chat context so agent can reference specific runs"

key-files:
  created:
    - (no new files)
  modified:
    - api/src/functions/planPhases.ts
    - api/src/functions/plan.ts
    - api/src/shared/prompts.ts
    - api/src/functions/chat.ts
    - api/src/__tests__/planPhases.test.ts
    - api/src/__tests__/plan.test.ts

key-decisions:
  - "addPhase uses assignPlanStructure on full phases array (not $push) to ensure correct global week numbers"
  - "Empty targetDate uses MongoDB $unset (not $set to empty string) to match frontend falsy check"
  - "RunId appended to completed-day context lines enables run:update-insight agent command"
  - "Body is fully optional in addPhase — try/catch defaults to empty object when no JSON sent"

patterns-established:
  - "Phase mutations: always call assignPlanStructure after modifying phases array"
  - "Optional PATCH fields: build $set/$unset conditionally; guard on all fields undefined"

requirements-completed: [FEAT-ADD-PHASE-API, FEAT-TARGET-DATE-API, FEAT-AGENT-COMMANDS]

# Metrics
duration: 12min
completed: 2026-04-11
---

# Phase 05 Plan 01: API Endpoints + System Prompt Summary

**POST /api/plan/phases with assignPlanStructure, PATCH /api/plan targetDate with $unset, and system prompt updated with plan:add-phase, plan:update-goal, run:create, run:update-insight commands**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-11T00:57:37Z
- **Completed:** 2026-04-11T01:09:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added `POST /api/plan/phases` (addPhase handler) that appends a new phase with auto-numbered or custom name/description, uses assignPlanStructure to assign correct globally sequential weekNumbers, and returns 201
- Extended `PATCH /api/plan` to accept `targetDate`: saves when non-empty, uses MongoDB `$unset` when empty string, preserves progressFeedback behavior
- Updated system prompt with four new XML command docs (plan:add-phase, plan:update-goal, run:create, run:update-insight) plus run:update-insight requires RunId from context
- Added RunId to completed-day context lines in chat.ts so agent can reference specific run records

## Task Commits

1. **Task 1: POST /api/plan/phases endpoint** - `1a5e3a1` (feat)
2. **Task 2: Extend PATCH /api/plan for targetDate** - `17389d6` (feat)
3. **Task 3: System prompt + chat.ts RunId** - `240e422` (feat)

## Files Created/Modified

- `api/src/functions/planPhases.ts` - Added addPhase handler with POST plan/phases route
- `api/src/functions/plan.ts` - Extended patchPlan body type and update logic for targetDate
- `api/src/shared/prompts.ts` - Added plan:add-phase, plan:update-goal, Run Commands section
- `api/src/functions/chat.ts` - Append RunId to completed-day context lines
- `api/src/__tests__/planPhases.test.ts` - 6 TDD tests for addPhase (404, auto-name, custom name, week number, empty week, missing body)
- `api/src/__tests__/plan.test.ts` - 6 TDD tests for targetDate (save, unset, combined, 400, 404, regression)

## Decisions Made

- `addPhase` calls `assignPlanStructure` on the full phases array (not `$push` to DB) to ensure weekNumbers are computed globally across all phases
- Empty `targetDate` string triggers MongoDB `$unset` rather than storing `""` — the field is fully removed from the document, consistent with how the frontend treats falsy/absent targetDate
- RunId appended using `(run as any)._id.toString()` since Run type doesn't expose `_id` in TypeScript — non-fatal pattern consistent with existing codebase
- Body is optional in addPhase — wrapped `req.json()` in try/catch defaults to `{}` for callers sending no body

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- POST /api/plan/phases and PATCH /api/plan targetDate are ready for frontend UI wiring (plans 05-02 and 05-03)
- System prompt is ready for useChat.ts wiring of run:create, run:update-insight, plan:add-phase, plan:update-goal tags (plan 05-04)
- All 193 API tests passing; TypeScript build clean

---
*Phase: 05-missing-features*
*Completed: 2026-04-11*
