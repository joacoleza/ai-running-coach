---
phase: 03-run-logging
plan: "07"
subsystem: run-logging
tags: [bug-fix, uat-gaps, ui, frontend, api]
dependency_graph:
  requires: [03-01, 03-02, 03-04, 03-05, 03-06]
  provides: [gap-1-date-field-width, gap-2-run-date-strikethrough, gap-3-delete-button-ux, gap-4-runs-page-stale-closures, gap-5-linkrunmodal-search, gap-6-quick-complete-link-to-completed]
  affects: [RunEntryForm, DayRow, RunDetailModal, Runs, LinkRunModal, useRuns, PlanView, runs.ts]
tech_stack:
  added: []
  patterns: [useRef-for-stale-closure-elimination, callback-params-over-closure-state]
key_files:
  created: []
  modified:
    - web/src/components/runs/RunEntryForm.tsx
    - web/src/components/plan/DayRow.tsx
    - web/src/components/runs/RunDetailModal.tsx
    - web/src/pages/Runs.tsx
    - web/src/components/runs/LinkRunModal.tsx
    - web/src/hooks/useRuns.ts
    - web/src/components/plan/PlanView.tsx
    - api/src/functions/runs.ts
    - web/src/__tests__/DayRow.test.tsx
    - api/src/__tests__/runs.test.ts
    - e2e/runs.spec.ts
decisions:
  - "Use offsetRef + totalRef instead of offset state to eliminate stale closures in IntersectionObserver"
  - "loadRuns accepts filter params as arguments instead of reading from closure to ensure filter changes always use fresh values"
  - "linkRun 409 guard changed from day.completed to existingLinkedRun check — completed days with no linked run can now be retroactively linked"
  - "Checkmark button does quick-complete (no form); Log run button opens RunEntryForm"
metrics:
  duration: "~20 min"
  completed_date: "2026-04-01"
  tasks: 3
  files: 11
---

# Phase 03 Plan 07: UAT Gap Closure Summary

Closed all 6 UAT gaps from Phase 03 testing. Mix of cosmetic fixes (2), minor UX (1), and major functional bugs (3). All existing tests updated and passing.

## Tasks Completed

### Task 1: Cosmetic and minor UI fixes (gaps 1-3)

**Gap 1 — RunEntryForm date field too wide:**
Removed `col-span-2` from the Date field wrapper div in `RunEntryForm.tsx`. Date now occupies one grid column like Distance and Duration.

**Gap 2 — Run date struck through on completed days:**
Moved the run date span from inside the `line-through text-gray-400` flex div to outside it (after the closing `</div>`). Added `font-bold` class. CSS inheritance no longer applies strikethrough to the date.

**Gap 3 — Delete guard shows plain text instead of disabled button:**
Replaced the `<p>` element with a `<button disabled title="Undo the training plan day first to delete this run">` with `cursor-not-allowed` styling.

Commit: `04aa2ed`

### Task 2: Runs page stale closure bugs (gap 4)

Root cause: `loadRuns` captured `offset` state in its closure. IntersectionObserver held a stale reference. Filter changes re-used old closure values.

Fix:
- Replaced `const [offset, setOffset]` with `const offsetRef = useRef(0)`
- Added `totalRef` alongside `setTotal` for observer guard
- `loadRuns` now accepts `(reset: boolean, filters: {...})` params — no closure dependency on filter state
- `currentFilters()` useCallback builds the filter object from current state
- Both `useEffect` hooks (filter/mount and IntersectionObserver) call `loadRuns(reset, currentFilters())`
- `offsetRef.current < totalRef.current` guard prevents over-fetching in observer
- `onSave` and `onDeleted` callbacks update both state and refs atomically

Commit: `b9fa6df`

### Task 3: LinkRunModal search, quick-complete, link-to-completed (gaps 5-6)

**Gap 5 — LinkRunModal shows too few runs / no search:**
- `fetchUnlinkedRuns(limit = 100)` now passes `limit` param to query string
- `LinkRunModal` adds a search `<input>` that filters by date string or distance client-side
- Shows `filtered.length of runs.length` count when search is active
- Distinguishes "no unlinked runs" from "no search matches" in empty state

**Gap 6a — Quick-complete without run data:**
- Checkmark button now calls `update({ completed: 'true' })` directly (quick-complete)
- New "Log run" button (title="Log run data") calls `setCompletingRun(true)` to open RunEntryForm
- Action order: [checkmark] [Log run] [Skip] [Link run] [Delete]

**Gap 6b — Link run to already-completed day:**
- `PlanView` passes `onRunLinked` to completed days that have no linked run (condition changed from `!day.completed && !day.skipped` to `!day.skipped && (!day.completed || !linkedRuns.get(...))`)
- `DayRow` "Link run" button moved outside `!isReadOnly` block — rendered whenever `onRunLinked` prop is provided and not in delete-confirmation state

**Gap 6c — API allows retroactive linking:**
- `linkRun` handler no longer returns 409 just because `targetDay.completed`
- Instead queries for an existing linked run (`planId + weekNumber + dayLabel`)
- Returns 409 only if a run already exists for that day slot
- Skips the `$set completed: true` plan update when day is already completed

Commit: `04cddf1`

### Test updates

- `DayRow.test.tsx`: Updated to test quick-complete behavior on checkmark; added new test for "Log run" opening RunEntryForm
- `runs.test.ts`: Replaced single 409 test with two tests — one verifying 200 for completed day with no existing link, one verifying 409 when day already has a linked run
- `e2e/runs.spec.ts`: Updated route mock pattern for `fetchUnlinkedRuns` URL change; updated click target from checkmark to "Log run data" button

Commit: `f8bb624`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DayRow test expected old behavior (checkmark opens form)**
- **Found during:** Task 3 web unit test run
- **Issue:** `DayRow.test.tsx` had `clicking complete button opens RunEntryForm` which relied on the old behavior we explicitly changed in gap 6a
- **Fix:** Updated test to verify new quick-complete behavior (checkmark calls onUpdate directly); added separate test for "Log run" button opening RunEntryForm
- **Files modified:** `web/src/__tests__/DayRow.test.tsx`
- **Commit:** `04cddf1`

**2. [Rule 1 - Bug] API linkRun test expected 409 for completed day with no linked run**
- **Found during:** Task 3 API unit test run
- **Issue:** `runs.test.ts` tested that linking to a completed day returns 409, but we changed this logic
- **Fix:** Split into two tests — one for 200 (completed + no existing link) and one for 409 (completed + existing link)
- **Files modified:** `api/src/__tests__/runs.test.ts`
- **Commit:** `04cddf1`

**3. [Rule 1 - Bug] E2E test clicked wrong button and used wrong route mock URL**
- **Found during:** Task 3 E2E test run
- **Issue 1:** `runs.spec.ts` clicked "Mark as completed" expecting RunEntryForm but checkmark now does quick-complete
- **Issue 2:** Route mock matched `**/api/runs/unlinked` but URL changed to `/api/runs?unlinked=true&limit=100`
- **Fix:** Changed click target to `getByTitle('Log run data')`; updated route pattern to `**/api/runs?unlinked=true**`
- **Files modified:** `e2e/runs.spec.ts`
- **Commit:** `f8bb624`

## Known Stubs

None — all gaps are fully resolved.

## Test Results

- Web unit tests: 243 passed (19 files)
- API unit tests: 168 passed (16 files)
- E2E tests: 45 passed (4 spec files)

## Self-Check: PASSED
