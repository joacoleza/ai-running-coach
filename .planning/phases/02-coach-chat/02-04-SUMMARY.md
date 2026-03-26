---
phase: 02-coach-chat
plan: "04"
subsystem: api
tags: [azure-functions, mongodb, typescript, training-plan]

# Dependency graph
requires:
  - phase: 02-01
    provides: shared types (Plan, PlanGoal, PlanSession), getDb(), shared/db.ts
  - phase: 02-03
    provides: chat.js registered in index.ts; index.ts baseline for plan 04

provides:
  - GET /api/plan — retrieves active or onboarding plan (excludes completed/discarded)
  - POST /api/plan — creates a new onboarding plan, discards any prior onboarding plan
  - POST /api/plan/generate — extracts sessions from Claude XML <training_plan> block, saves with UUIDs, sets goal
  - PATCH /api/sessions/{sessionId} — updates individual session fields via MongoDB positional operator

affects: [02-05, 02-06, web plan views, session inline edit, plan calendar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - app.http registration pattern with requirePassword guard in every handler
    - MongoDB positional operator ($) for subdocument array field updates
    - XML tag extraction with regex for Claude structured output parsing
    - randomUUID() from crypto for deterministic session ID generation

key-files:
  created:
    - api/src/functions/plan.ts
    - api/src/functions/sessions.ts
  modified:
    - api/src/index.ts

key-decisions:
  - "updateMany used to discard existing onboarding plans (vs updateOne) to handle edge case of multiple stale onboarding docs"
  - "dynamic import of ObjectId from mongodb inside generatePlan handler to avoid top-level circular import risk"
  - "delete (updates as Record<string, unknown>).id pattern prevents session id overwrite in PATCH handler"

patterns-established:
  - "Plan endpoints: all three in one file (plan.ts) with shared imports at top"
  - "XML extraction: /<training_plan>([\s\S]*?)<\/training_plan>/ regex from Research Pitfall 3"
  - "Session subdocument update: build setObj with sessions.$.field keys, include updatedAt on plan doc"

requirements-completed: [GOAL-01, GOAL-02, PLAN-01, PLAN-04]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 2 Plan 04: Plan Management API Summary

**Four HTTP endpoints for plan lifecycle management: create/get/generate plans and PATCH individual sessions using MongoDB positional operator**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-23T16:47:04Z
- **Completed:** 2026-03-23T16:49:24Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- GET /api/plan returns only the most recent active or onboarding plan — completed and discarded plans are excluded
- POST /api/plan creates an onboarding plan and discards any pre-existing onboarding plans (D-02: one onboarding at a time)
- POST /api/plan/generate extracts sessions from Claude's `<training_plan>` XML block, assigns UUIDs, persists goal fields, transitions plan to 'active'
- PATCH /api/sessions/{sessionId} supports inline session editing and marking complete via MongoDB `sessions.$.field` positional updates

## Task Commits

1. **Task 1: Create plan API endpoints (create, get, generate)** - `464d354` (feat)
2. **Task 2: Create session PATCH endpoint and register plan + sessions in index.ts** - `d2075ab` (feat)

## Files Created/Modified

- `api/src/functions/plan.ts` — GET, POST, and POST /generate endpoints for plan management
- `api/src/functions/sessions.ts` — PATCH endpoint for session subdocument updates
- `api/src/index.ts` — Added imports for plan.js and sessions.js after chat.js

## Decisions Made

- Used `updateMany` to discard prior onboarding plans (vs `updateOne`) to cleanly handle any edge case where multiple stale onboarding documents exist
- Dynamic import of `ObjectId` inside the generatePlan handler to avoid potential top-level circular import issues
- `delete (updates as Record<string, unknown>).id` prevents callers from overwriting the session's `id` field through the PATCH endpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan management API fully functional; frontend can now call POST /api/plan to start onboarding, POST /api/plan/generate after coach chat, and PATCH /api/sessions/:id for inline edits
- GET /api/plan provides the active/onboarding plan for plan views and calendar rendering
- No blockers for Phase 02-05 or 02-06

---
*Phase: 02-coach-chat*
*Completed: 2026-03-23*
