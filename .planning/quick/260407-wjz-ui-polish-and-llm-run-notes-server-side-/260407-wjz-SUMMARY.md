---
phase: quick-260407-wjz
plan: 01
subsystem: api-web
tags: [ui-polish, ux-consistency, llm-context, server-side, cursor, markdown]
dependency_graph:
  requires: []
  provides:
    - "GET /api/plan embeds linkedRuns map"
    - "chat.ts synthetic context includes run notes"
    - "Global cursor-pointer CSS rule"
    - "window.confirm for delete/unlink confirmations"
    - "Log run modal X button"
    - "progressFeedback rendered as markdown"
    - "Distance/HR fields equal width in RunDetailModal"
    - "Run insight prompt uses live editNotes state"
tech_stack:
  added: []
  patterns:
    - "Server-side data embedding: embed linked runs in GET /api/plan response"
    - "window.confirm for destructive action confirmation (consistent with PhaseHeader)"
    - "ReactMarkdown for progressFeedback rendering"
    - "Relative/absolute positioning for inline suffix labels in form inputs"
key_files:
  created: []
  modified:
    - api/src/functions/plan.ts
    - api/src/functions/chat.ts
    - web/src/hooks/usePlan.ts
    - web/src/components/plan/PlanView.tsx
    - web/src/pages/TrainingPlan.tsx
    - web/src/components/runs/RunDetailModal.tsx
    - web/src/components/plan/DayRow.tsx
    - web/src/pages/Runs.tsx
    - web/src/index.css
    - web/src/__tests__/PlanView.test.tsx
    - web/src/__tests__/TrainingPlan.test.tsx
    - web/src/__tests__/TrainingPlan.feedback.test.tsx
    - web/src/__tests__/TrainingPlan.scroll.test.tsx
    - web/src/__tests__/DayRow.test.tsx
    - web/src/__tests__/RunDetailModal.nav.test.tsx
decisions:
  - "Embed linkedRuns in GET /api/plan response rather than separate endpoint to eliminate N+1 client fetches"
  - "Convert plain object from JSON to Map in usePlan.ts for O(1) lookup"
  - "Use window.confirm for delete/unlink consistency with PhaseHeader delete phase pattern"
  - "Use relative/absolute positioning for km/bpm suffix labels in RunDetailModal for equal column widths"
metrics:
  duration: "~25 min"
  completed: "2026-04-07T21:40:00Z"
  tasks: 3
  files: 15
---

# Quick Task 260407-wjz: UI Polish and LLM Run Notes (Server-Side) Summary

**One-liner:** Nine targeted UX improvements: server-side linked runs in GET /api/plan, notes in LLM context, global cursor-pointer, window.confirm dialogs, modal X button, ReactMarkdown feedback, equal-width form fields, and live editNotes in insight prompt.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Server-side linked runs in GET /api/plan + notes in LLM context | f0b49b7 | Done |
| 2 | UI consistency: cursor, window.confirm, modal X, markdown, field width | 7398a64 | Done |
| 3 | Use editNotes in insight prompt + update tests for window.confirm | 0dd233c | Done |

## Changes Made

### Task 1: Server-side linked runs + Notes in LLM context

**api/src/functions/plan.ts:**
- `GET /api/plan` now fetches all runs where `planId === plan._id` after fetching the plan
- Returns `{ plan, linkedRuns: Record<string, Run> }` — keys are `"weekNumber-dayLabel"`
- Non-fatal try/catch wraps the runs fetch so a failing runs collection doesn't break plan load

**api/src/functions/chat.ts:**
- In the synthetic plan-state context builder, after appending run date/distance/pace, now also appends `| Notes: <truncated 100 chars>` if `run.notes` exists (before the existing `| Insight:` field)

**web/src/hooks/usePlan.ts:**
- Added `linkedRuns: Map<string, Run>` to the return type and state
- `refreshPlan` converts the `Record<string, Run>` from the JSON response to a `Map<string, Run>` via `Object.entries()`

**web/src/components/plan/PlanView.tsx:**
- Removed `useState`, `useEffect`, and `useCallback` for local `linkedRuns` state and `fetchLinkedRuns`
- Removed `refreshKey` state
- Added `linkedRuns: Map<string, Run>` as a required prop
- `LinkRunModal.onLinked` now dispatches `plan-updated` event (which triggers `usePlan.refreshPlan`) instead of incrementing `refreshKey`

**web/src/pages/TrainingPlan.tsx:**
- Destructures `linkedRuns` from `usePlan()` and passes it to `<PlanView>`

### Task 2: UI consistency

**web/src/index.css:**
- Added global `button, a, [role="button"] { cursor: pointer; }` rule

**web/src/components/runs/RunDetailModal.tsx:**
- Removed `confirmDelete` and `confirmUnlink` state
- `handleDelete` now calls `window.confirm('Delete this run? This cannot be undone.')` and returns early if cancelled
- `handleUnlink` now calls `window.confirm('Unlink this run from the training plan day? ...')` and returns early if cancelled
- Removed inline `confirmDelete`/`confirmUnlink` JSX conditional branches; replaced with single buttons
- Distance field: changed from `flex items-center gap-2` to `relative` wrapper with `absolute right-3` "km" label for equal column width
- Avg HR field: same `relative`/`absolute` approach with "bpm" label

**web/src/components/plan/DayRow.tsx:**
- Removed `confirmingDelete` state
- Delete button now calls `window.confirm('Delete this training day? This cannot be undone.')` inline in `onClick`
- Removed `Remove?` / `Yes` / `No` JSX conditional; action button span no longer conditionally removes opacity-0

**web/src/pages/Runs.tsx:**
- Log run modal header updated to `flex items-center justify-between` with `&times;` close button at top-right

**web/src/pages/TrainingPlan.tsx:**
- Added `import ReactMarkdown from 'react-markdown'`
- `progressFeedback` section now renders `<ReactMarkdown>{plan.progressFeedback}</ReactMarkdown>` with `prose prose-sm max-w-none` styling instead of manual paragraph splitting

### Task 3: editNotes in insight prompt

**web/src/components/runs/RunDetailModal.tsx:**
- `handleAddFeedback` now uses `editNotes` (live state) instead of `run.notes` (stale prop) when building the prompt — lets users type notes and get insight without saving first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Updated test mocks to include linkedRuns**
- Found during: Task 1
- Issue: Three TrainingPlan test files mock `usePlan` with objects that were missing `linkedRuns`, causing TypeScript errors
- Fix: Added `linkedRuns: new Map()` to all `defaultUsePlan` mock functions in TrainingPlan.test.tsx, TrainingPlan.feedback.test.tsx, TrainingPlan.scroll.test.tsx
- Files modified: web/src/__tests__/TrainingPlan.test.tsx, web/src/__tests__/TrainingPlan.feedback.test.tsx, web/src/__tests__/TrainingPlan.scroll.test.tsx

**2. [Rule 1 - Bug] Updated DayRow and RunDetailModal tests to use window.confirm mocking**
- Found during: Task 3 (test run after Task 2 changes)
- Issue: DayRow.test.tsx had 5 tests testing the old inline confirmation UI (looking for "Remove?", "Yes", "No" buttons); RunDetailModal.nav.test.tsx had 4 tests testing the old inline unlink confirmation UI (looking for "Yes, unlink", "No, keep it")
- Fix: Updated tests to `vi.spyOn(window, 'confirm').mockReturnValue(true/false)` pattern matching the new behavior
- Files modified: web/src/__tests__/DayRow.test.tsx, web/src/__tests__/RunDetailModal.nav.test.tsx

## Known Stubs

None.

## Test Results

- API tests: 177 passed (15 test files)
- Web tests: 353 passed (30 test files)
- TypeScript build: passes

## Self-Check: PASSED

All modified files exist. All commits exist:
- f0b49b7: feat(quick-260407-wjz-01)
- 7398a64: feat(quick-260407-wjz-02)
- 0dd233c: fix(quick-260407-wjz-03)
