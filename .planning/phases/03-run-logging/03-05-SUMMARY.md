---
phase: 03-run-logging
plan: "05"
subsystem: frontend
tags: [link-run, plan-feedback, modal, useChat, PlanView]
dependency_graph:
  requires: [03-01, 03-03, 03-04]
  provides: [LinkRunModal, PlanView linked-runs wiring, TrainingPlan progress feedback]
  affects: [web/src/components/plan/PlanView.tsx, web/src/pages/TrainingPlan.tsx, web/src/hooks/useChat.ts]
tech_stack:
  added: []
  patterns: [plan-updated event, open-coach-panel event, sendMessage returns Promise<string>]
key_files:
  created:
    - web/src/components/runs/LinkRunModal.tsx
  modified:
    - web/src/components/plan/PlanView.tsx
    - web/src/pages/TrainingPlan.tsx
    - web/src/hooks/useChat.ts
    - web/src/contexts/ChatContext.tsx
    - web/src/hooks/usePlan.ts
    - web/src/__tests__/TrainingPlan.test.tsx
decisions:
  - sendMessage now returns Promise<string> (accumulated response text) to allow callers to save AI responses
  - PlanView fetches plan-linked runs via GET /api/runs?planId=... (planId filter already in API from plan 03-01)
  - refreshKey state increments on plan-updated event to retrigger linked runs effect
  - feedbackExpanded auto-set to true after getting new feedback
metrics:
  duration: "~20 min"
  completed: "2026-03-31"
  tasks: 2
  files: 7
---

# Phase 3 Plan 5: Link Run Modal and Progress Feedback Summary

LinkRunModal component and PlanView wiring for linked runs, plus Training Plan progress feedback section with "Get plan feedback" button and sendMessage returning Promise<string>.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create LinkRunModal and wire linked runs in PlanView | b9c7d44 | web/src/components/runs/LinkRunModal.tsx, web/src/components/plan/PlanView.tsx |
| 2 | Add progress feedback section to Training Plan page | 4e1ee3f | web/src/pages/TrainingPlan.tsx, web/src/hooks/useChat.ts, web/src/contexts/ChatContext.tsx |

## What Was Built

### LinkRunModal (`web/src/components/runs/LinkRunModal.tsx`)

A modal component that:
- Fetches unlinked runs via `fetchUnlinkedRuns()` on mount
- Displays each run as `{formatRunDate(date)} · {distance}km · {formatPace(pace)}`
- "Link" button calls `linkRun(runId, weekNumber, dayLabel)` then dispatches `plan-updated`
- Shows loading spinner, empty state message, and error display
- Closes via Cancel button or after successful link via `onLinked()` callback

### PlanView Updates (`web/src/components/plan/PlanView.tsx`)

- Fetches all runs linked to the plan via `GET /api/runs?planId={plan._id}&limit=500`
- Builds a `Map<string, Run>` keyed by `"{weekNumber}-{label}"`
- Passes `linkedRun` prop to each DayRow
- Passes `onRunLinked` only to active (non-completed, non-skipped) days
- Listens for `plan-updated` event via `refreshKey` state to re-fetch linked runs
- Renders `<LinkRunModal>` when `linkingDay` state is set

### Training Plan Feedback (`web/src/pages/TrainingPlan.tsx`)

- Collapsible "Coach Feedback" section shows `plan.progressFeedback` when set
- "Get plan feedback" button dispatches `open-coach-panel` and calls `sendMessage()`
- Response text saved via `PATCH /api/plan` with `{ progressFeedback: responseText }`
- Plan refreshed after save so section shows immediately

### sendMessage Returns String (`web/src/hooks/useChat.ts`, `web/src/contexts/ChatContext.tsx`)

- Changed `sendMessage: (text: string) => Promise<void>` to `Promise<string>`
- Returns `accumulatedText` on success, `''` on error or no plan
- TrainingPlan test updated to mock `useChatContext` (prevents ChatProvider requirement)
- PlanData type in `usePlan.ts` gains `progressFeedback?: string`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing field] Added progressFeedback to PlanData type**
- **Found during:** Task 2 TypeScript check
- **Issue:** `PlanData` in `usePlan.ts` was missing `progressFeedback?: string`, causing TS2339 errors
- **Fix:** Added optional field to the interface
- **Files modified:** `web/src/hooks/usePlan.ts`
- **Commit:** 4e1ee3f

**2. [Rule 2 - Missing test mock] Added useChatContext mock to TrainingPlan tests**
- **Found during:** Task 2 — TrainingPlan now imports useChatContext but tests don't wrap in ChatProvider
- **Fix:** Added `vi.mock('../contexts/ChatContext', ...)` to TrainingPlan.test.tsx
- **Files modified:** `web/src/__tests__/TrainingPlan.test.tsx`
- **Commit:** 4e1ee3f

## Verification

- `cd web && ./node_modules/.bin/tsc -b --noEmit` exits 0
- All 235 web tests pass
- All 146 API tests pass
- LinkRunModal exported from `web/src/components/runs/LinkRunModal.tsx`
- PlanView passes `linkedRun` and `onRunLinked` to DayRow
- PlanView fetches runs via `/api/runs?planId=...`
- TrainingPlan contains progressFeedback section and Get plan feedback button

## Known Stubs

None — all functionality is fully wired end-to-end.

## Self-Check: PASSED

- `web/src/components/runs/LinkRunModal.tsx` — FOUND
- `web/src/components/plan/PlanView.tsx` — modified with linked runs fetching
- `web/src/pages/TrainingPlan.tsx` — modified with feedback section
- `b9c7d44` — FOUND in git log
- `4e1ee3f` — FOUND in git log
