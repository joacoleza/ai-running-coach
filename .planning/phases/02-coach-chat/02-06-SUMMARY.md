---
phase: 02-coach-chat
plan: 06
subsystem: ui
tags: [react, react-big-calendar, date-fns, training-plan, calendar, modal]

# Dependency graph
requires:
  - phase: 02-04
    provides: GET /api/plan and PATCH /api/sessions/{id} endpoints
  - phase: 02-02
    provides: AppShell layout with persistent coach panel and TrainingPlan route

provides:
  - Training Plan page with react-big-calendar weekly view
  - usePlan hook for plan data fetching and session updates
  - PlanCalendar component with color-coded sessions and click handler
  - SessionModal with inline-editable fields and complete/incomplete toggle

affects: [02-coach-chat, phase-3-run-logging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - usePlan hook pattern: fetch plan from /api/plan, patch sessions via /api/sessions/{id}
    - react-big-calendar dateFnsLocalizer with date-fns v4 locale imports
    - Session color coding derived from notes field text (long/tempo/interval/recovery)
    - import type syntax enforced for type-only imports (verbatimModuleSyntax TS config)

key-files:
  created:
    - web/src/hooks/usePlan.ts
    - web/src/components/plan/PlanCalendar.tsx
    - web/src/components/plan/SessionModal.tsx
  modified:
    - web/src/pages/TrainingPlan.tsx

key-decisions:
  - "import type required for View from react-big-calendar and PlanSession — verbatimModuleSyntax tsconfig enforces this"
  - "Session color coding derives from notes field substring matching (no separate type field)"

patterns-established:
  - "usePlan hook: useCallback + useEffect for initial fetch, refreshPlan called after PATCH"
  - "Modal overlay: fixed inset-0 backdrop, stopPropagation on inner div, z-50"

requirements-completed: [PLAN-02, PLAN-03, PLAN-04, GOAL-01, GOAL-02]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 2 Plan 06: Training Plan Calendar Summary

**react-big-calendar weekly view with color-coded sessions, click-to-edit SessionModal, and goal details header — all wired to /api/plan and /api/sessions endpoints**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-23T15:47:23Z
- **Completed:** 2026-03-23T15:55:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- usePlan hook fetches plan from /api/plan and patches sessions via /api/sessions/{id} with auth headers
- PlanCalendar renders weekly react-big-calendar view, color-codes sessions by type derived from notes text
- SessionModal shows all session fields inline-editable; Mark Complete/Incomplete toggle calls PATCH endpoint
- TrainingPlan page displays goal details (event type, target date, weekly mileage) as read-only per D-04

## Task Commits

1. **Task 1: Create usePlan hook and PlanCalendar component** - `f7c7909` (feat)
2. **Task 2: Create SessionModal and wire up TrainingPlan page** - `653fa95` (feat)

## Files Created/Modified

- `web/src/hooks/usePlan.ts` - Plan data hook with GET /api/plan and PATCH /api/sessions/{id}
- `web/src/components/plan/PlanCalendar.tsx` - Weekly calendar with dateFnsLocalizer and color-coded events
- `web/src/components/plan/SessionModal.tsx` - Session detail modal with inline editing and completion toggle
- `web/src/pages/TrainingPlan.tsx` - Rewrote stub: goal summary + PlanCalendar + SessionModal integration

## Decisions Made

- `import type` required for `View` (react-big-calendar) and `PlanSession` (usePlan) — TypeScript `verbatimModuleSyntax` enforces this; fixed immediately during Task 1 compilation
- Session color derives from notes field substring matching (long, tempo, interval/speed, recovery/rest, cross/xt) since no separate type field exists per D-05

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type-only import syntax for verbatimModuleSyntax**
- **Found during:** Task 1 (PlanCalendar compilation)
- **Issue:** `import { View } from 'react-big-calendar'` and `import { PlanSession } from '../../hooks/usePlan'` failed with TS1484 — both are type-only imports and verbatimModuleSyntax requires `import type`
- **Fix:** Changed to `import type { View }` and `import type { PlanSession }` separately from value imports
- **Files modified:** web/src/components/plan/PlanCalendar.tsx
- **Verification:** `npx tsc -b` exits 0
- **Committed in:** f7c7909 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type import syntax)
**Impact on plan:** Required for TypeScript correctness with verbatimModuleSyntax. No scope creep.

## Issues Encountered

None beyond the type import fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Training Plan page fully functional once /api/plan returns a plan document
- Phase 3 (Run Logging) can use the sessions structure from usePlan as reference
- PlanCalendar navigates across weeks with react-big-calendar built-in prev/next controls

---
*Phase: 02-coach-chat*
*Completed: 2026-03-23*
