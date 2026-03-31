---
phase: 03-run-logging
plan: "03"
subsystem: frontend
tags: [run-logging, hooks, components, form]
dependency_graph:
  requires: [03-01]
  provides: [RunEntryForm, useRuns, DayRow-complete-flow]
  affects: [PlanView, Runs-page]
tech_stack:
  added: []
  patterns: [fetch-with-auth-headers, form-validation, live-computed-display]
key_files:
  created:
    - web/src/hooks/useRuns.ts
    - web/src/components/runs/RunEntryForm.tsx
  modified:
    - web/src/components/plan/DayRow.tsx
    - web/src/__tests__/DayRow.test.tsx
decisions:
  - Complete button opens RunEntryForm instead of directly patching plan day; plan refreshed via plan-updated window event after successful save
  - formatRunDate uses new Date(isoDate + 'T12:00:00') with noon offset to avoid timezone-shift on date-only strings (consistent with UAT-fixes-02.1 decision)
  - DayRow saving spinner tests migrated to Skip path since Complete now opens a form
  - Link run button only renders when onRunLinked callback provided (full LinkRunModal deferred to plan 05)
metrics:
  duration: 12m
  completed: "2026-03-31"
  tasks_completed: 3
  files_changed: 4
---

# Phase 3 Plan 03: Run Entry Form and DayRow Integration Summary

**One-liner:** RunEntryForm with live pace computation + useRuns hook with 6 API functions + DayRow Complete flow redirected to form with run date display.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create useRuns hook | 3aaeca4 | web/src/hooks/useRuns.ts |
| 2 | Create RunEntryForm component | 0af1456 | web/src/components/runs/RunEntryForm.tsx |
| 3 | Extend DayRow | 832a4d5 | web/src/components/plan/DayRow.tsx, web/src/__tests__/DayRow.test.tsx |

## What Was Built

### useRuns hook (`web/src/hooks/useRuns.ts`)
- `Run` interface with all fields: `_id`, `date`, `distance`, `duration`, `pace`, `avgHR`, `notes`, `planId`, `weekNumber`, `dayLabel`, `insight`
- `CreateRunInput` interface for the POST body
- 6 exported API functions: `createRun`, `fetchRuns`, `fetchUnlinkedRuns`, `updateRun`, `deleteRun`, `linkRun`
- All functions use `authHeaders()` pattern (consistent with `usePlan.ts`)

### RunEntryForm component (`web/src/components/runs/RunEntryForm.tsx`)
- Props: `weekNumber`, `dayLabel`, `dayGuidelines`, `onSave`, `onCancel`
- Form fields: date picker (defaults to today, max=today), distance (km), duration (MM:SS or HH:MM:SS)
- Optional fields: avgHR, notes
- Live pace computation from distance + duration — updates on every keystroke
- Validation: date required, positive distance, valid duration format
- Submits to `POST /api/runs` via `createRun()` with optional plan linking
- Shows `Target: {guidelines}` hint when `dayGuidelines` provided

### DayRow extensions (`web/src/components/plan/DayRow.tsx`)
- `completingRun` state replaces the direct `update({ completed: 'true' })` call
- `RunEntryForm` renders as full replacement of DayRow when `completingRun` is true
- On save: dispatches `plan-updated` window event so `usePlan` refreshes
- `formatRunDate(isoDate)` helper formats as "Monday 03/04/2026" (day-of-week + DD/MM/YYYY)
- Completed days show run date when `linkedRun` prop provided
- "Link run" button appears on active days when `onRunLinked` callback provided
- New props: `linkedRun?: Run | null`, `onRunLinked?: () => void`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DayRow tests expected direct Complete→onUpdate behavior**
- **Found during:** Task 3
- **Issue:** Existing tests for Complete button expected `onUpdate({ completed: 'true' })` to be called directly. After changing Complete to open a form, these tests would permanently fail.
- **Fix:** Updated 5 tests in `DayRow.test.tsx`:
  - `clicking complete button calls onUpdate with completed true` → replaced with form-opens test
  - `shows inline error when onUpdate rejects` → migrated to Skip path
  - `shows saving spinner while update is in flight` → migrated to Skip path
  - `clears saving state after update resolves` → migrated to Skip path
  - `clears saving state after update rejects` → migrated to Skip path
- **Files modified:** web/src/__tests__/DayRow.test.tsx
- **Commit:** 832a4d5

## Verification

- `cd web && npx tsc -b --noEmit` passes (0 errors)
- All 235 web unit tests pass (18 test files)
- `useRuns.ts` has all 6 exported functions
- `RunEntryForm` renders form with date/distance/duration/avgHR/notes fields, computes pace live
- `DayRow` Complete button opens `RunEntryForm` (not toggling complete directly)
- Completed days with `linkedRun` show formatted date in "Monday DD/MM/YYYY" format
- Link run button visible on active non-completed days when `onRunLinked` provided

## Known Stubs

- `linkedRun` prop in `DayRow` is available but `PlanView` does not yet pass it (no run data fetched by PlanView). Completed days will show the green checkmark but not the run date until `PlanView` is extended to fetch and pass linked run data (plan 04 or 05).
- `onRunLinked` callback in `DayRow` shows the "Link run" button but the `LinkRunModal` is deferred to plan 05.

## Self-Check

Verified created files:
- `web/src/hooks/useRuns.ts` — exists
- `web/src/components/runs/RunEntryForm.tsx` — exists
- `web/src/components/plan/DayRow.tsx` — modified

Verified commits exist:
- 3aaeca4 — feat(03-03): create useRuns hook with 6 API functions
- 0af1456 — feat(03-03): create RunEntryForm component
- 832a4d5 — feat(03-03): extend DayRow with run entry form and run date display

## Self-Check: PASSED
