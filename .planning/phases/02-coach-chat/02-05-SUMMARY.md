---
phase: 02-coach-chat
plan: 05
subsystem: ui
tags: [react, typescript, sse, streaming, useChat, hooks, coach-panel]

# Dependency graph
requires:
  - phase: 02-03
    provides: POST /api/chat SSE streaming endpoint
  - phase: 02-04
    provides: GET/POST /api/plan and POST /api/plan/generate endpoints

provides:
  - useChat hook with SSE stream consumption and plan generation trigger
  - ChatMessage bubble component (user right/blue, assistant left/gray)
  - ChatHistory scrollable message list with back navigation
  - CoachPanel with three states (no-plan / onboarding / active chat)

affects:
  - 02-06-plan-calendar
  - any future phase consuming the coach panel or useChat hook

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fetch + ReadableStream reader for SSE (not EventSource — POST + auth header required)
    - Buffer accumulation pattern for SSE chunk boundary splits
    - Optimistic UI: user message added immediately, assistant placeholder appended before stream
    - <training_plan> XML tag detection in accumulated stream text triggers plan generation

key-files:
  created:
    - web/src/hooks/useChat.ts
    - web/src/components/coach/ChatMessage.tsx
    - web/src/components/coach/ChatHistory.tsx
  modified:
    - web/src/components/coach/CoachPanel.tsx

key-decisions:
  - "type-only import required for Message in ChatHistory.tsx due to verbatimModuleSyntax tsconfig"
  - "extractGoalFromText parses <goal> XML block or returns sensible defaults for plan generation"
  - "startPlan('conversational') auto-sends initial message to kick off onboarding immediately"
  - "startOver re-uses existing onboardingMode (conversational or paste)"

patterns-established:
  - "Pattern 1: SSE buffer accumulation — split on \\n, hold partial line in buffer, parse data: prefix lines"
  - "Pattern 2: <training_plan> detection — check accumulated text after done event fires, then POST /api/plan/generate"
  - "Pattern 3: CoachPanel three-state rendering — isLoading / !plan / plan exists (onboarding + active)"

requirements-completed:
  - GOAL-01
  - GOAL-02
  - GOAL-03
  - COACH-01
  - COACH-02
  - COACH-05

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 2 Plan 5: Coach Panel UI Summary

**React chat UI with SSE stream consumption, three-state CoachPanel, onboarding flows, and <training_plan> detection that triggers POST /api/plan/generate and navigates to /plan**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T15:47:19Z
- **Completed:** 2026-03-23T15:51:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- useChat hook manages all chat state, SSE streaming, plan lifecycle, and plan generation trigger
- CoachPanel renders no-plan / onboarding / active states with correct headers and actions
- ChatMessage and ChatHistory components provide message bubble UI and history view
- Buffer-safe SSE parsing handles chunk boundary splits (Pitfall 4 from RESEARCH.md)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useChat hook** - `945748d` (feat)
2. **Task 2: Build coach panel UI** - committed as part of parallel agent 02-06 run (`f7c7909`)

## Files Created/Modified

- `web/src/hooks/useChat.ts` - Chat state management, SSE stream reader, plan creation/startOver/clearError, extractGoalFromText helper, navigate to /plan after generation
- `web/src/components/coach/ChatMessage.tsx` - Message bubble: user right/blue-600, assistant left/gray-100
- `web/src/components/coach/ChatHistory.tsx` - Scrollable message list with Back to Chat button
- `web/src/components/coach/CoachPanel.tsx` - Full panel: three states, history toggle, error banner, paste mode, Start Over, auto-scroll

## Decisions Made

- `type-only import` required for `Message` interface in ChatHistory.tsx due to `verbatimModuleSyntax: true` in tsconfig — fixed immediately as Rule 3 (blocking compile error)
- `extractGoalFromText` attempts to parse `<goal>` XML block from accumulated text; falls back to sensible defaults (marathon, 90 days out, 4 days/week, km) — the backend uses whatever is provided
- `startPlan('conversational')` auto-sends `"I'd like to start a new training plan"` immediately to kick off onboarding without user action
- `startOver` reuses `plan.onboardingMode` to preserve the user's original choice of entry point

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed verbatimModuleSyntax type import error**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `import { Message }` caused TS1484 error — type must use `import type` when `verbatimModuleSyntax` is enabled
- **Fix:** Changed to `import type { Message }` in ChatHistory.tsx
- **Files modified:** `web/src/components/coach/ChatHistory.tsx`
- **Verification:** `npx tsc -b` exits 0
- **Committed in:** `f7c7909` (part of Task 2 commit in parallel agent)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial fix required by TypeScript strictness. No scope creep.

## Issues Encountered

- A parallel agent (02-06) committed ChatMessage.tsx, ChatHistory.tsx, and the updated CoachPanel.tsx as part of its own feat commit before this agent's git add could complete. The files on disk are identical to what this plan specified — the parallel commit contained this plan's exact output.

## Known Stubs

None — all three states in CoachPanel wire to real data from useChat hook. The "no plan" state shows actual buttons that call the real API. The paste textarea sends real messages.

## Next Phase Readiness

- useChat hook is ready for use by any component needing chat state
- CoachPanel is fully wired and renders in the AppShell three-column layout
- Plan generation flow (detect `<training_plan>` → POST /api/plan/generate → navigate to /plan) is complete
- Ready for Phase 2 Plan 6 (training plan calendar) which consumes the /plan route

---
*Phase: 02-coach-chat*
*Completed: 2026-03-23*
