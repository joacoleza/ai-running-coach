---
phase: 03-run-logging
plan: "04"
subsystem: frontend
tags: [runs, ui, modal, infinite-scroll, coaching-feedback]
dependency_graph:
  requires: [03-01]
  provides: [RunDetailModal, Runs page, open-coach-panel event]
  affects: [AppShell, ChatContext, useRuns]
tech_stack:
  added: []
  patterns: [IntersectionObserver infinite scroll, CustomEvent coach panel open, messages state for insight capture]
key_files:
  created:
    - web/src/components/runs/RunDetailModal.tsx
    - web/src/components/runs/RunEntryForm.tsx
    - web/src/hooks/useRuns.ts
  modified:
    - web/src/pages/Runs.tsx
    - web/src/components/layout/AppShell.tsx
decisions:
  - "useRuns.ts and RunEntryForm.tsx created in this plan (parallel agent — plan 03-03 not yet run)"
  - "sendMessage returns Promise<void> so insight captured from messages state after await"
  - "open-coach-panel event added alongside existing open-coach event in AppShell"
  - "RunDetailModal shows updated run after save via onUpdated callback with updated object"
metrics:
  duration: "6 min"
  completed: "2026-03-31"
  tasks: 3
  files: 5
---

# Phase 3 Plan 4: Runs Page and RunDetailModal Summary

**One-liner:** Runs page with infinite scroll and filters plus RunDetailModal with inline editing, coaching feedback trigger, insight auto-save, and delete guard.

## What Was Built

### Task 1: RunDetailModal + dependencies

Created `web/src/components/runs/RunDetailModal.tsx` — a full-featured run detail modal:
- Editable fields: date, distance, duration, avg HR, notes (all via inline inputs)
- Computed pace display (read-only, recalculated from edited distance/duration)
- Plan link badge when `weekNumber` is set
- Coaching insight display (gray-50 box, italic)
- "Add feedback to run" button: opens CoachPanel via `open-coach-panel` event, sends pre-composed message via `sendMessage`, saves insight to run record via `updateRun` after response
- Delete guard: button hidden/tooltip shown for linked runs (`planId` set); confirmation step (Confirm/Cancel) for unlinked runs
- Save changes button appears only when fields are dirty

Also created dependency files needed by this plan:
- `web/src/hooks/useRuns.ts` — Run interface + createRun, fetchRuns, fetchUnlinkedRuns, updateRun, deleteRun, linkRun
- `web/src/components/runs/RunEntryForm.tsx` — shared run entry form with date/distance/duration/avgHR/notes, live pace computation, validation

### Task 2: AppShell open-coach-panel event

Added `useEffect` in `AppShell.tsx` listening for `open-coach-panel` custom event to call `setCoachOpen(true)`. Sits alongside the existing `open-coach` listener. Allows RunDetailModal to open CoachPanel without prop drilling.

### Task 3: Runs page

Replaced placeholder `web/src/pages/Runs.tsx` with full implementation:
- Paginated fetch via `fetchRuns` with 20-item pages
- Infinite scroll via `IntersectionObserver` on a sentinel div
- Filter panel (toggled): date range (dateFrom/dateTo) + distance range (min/max)
- Clear filters button
- Run rows show: date (formatted "Day DD/MM/YYYY"), distance, duration, pace, avg HR, plan badge
- "Log a run" button opens `RunEntryForm` as modal (unlinked run, prepended to list on save)
- Clicking a run row opens `RunDetailModal`
- `onUpdated` updates the run in list and keeps modal open with new data
- `onDeleted` removes from list, decrements total, closes modal

## Deviations from Plan

### Auto-created Dependencies

**1. [Rule 3 - Blocking] Created useRuns.ts and RunEntryForm.tsx**
- **Found during:** Task 1 setup
- **Issue:** Plan 03-04 depends on artifacts from plan 03-03 (useRuns.ts, RunEntryForm.tsx) which don't exist yet — parallel wave execution means both plans run simultaneously
- **Fix:** Created useRuns.ts and RunEntryForm.tsx in this plan following the exact interfaces specified in plan 03-03
- **Files modified:** web/src/hooks/useRuns.ts, web/src/components/runs/RunEntryForm.tsx
- **Commit:** cbd3349

**2. [Rule 2 - Missing Functionality] Installed node_modules in worktree**
- **Found during:** TypeScript verification
- **Issue:** Worktree had empty node_modules, making tsc unavailable
- **Fix:** Ran npm install in web/ worktree directory
- **Files modified:** web/node_modules (not committed)

## Known Stubs

None — all data flows are wired:
- fetchRuns fetches from `/api/runs`
- RunDetailModal calls updateRun/deleteRun via useRuns
- sendMessage via ChatContext is wired; insight saved from messages state
- RunEntryForm calls createRun via useRuns

## Self-Check: PASSED

All files present. All commits verified: cbd3349, 68873c3, 2ae4003.
TypeScript compiles with zero errors.
