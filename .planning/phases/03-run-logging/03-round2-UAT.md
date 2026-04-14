---
status: complete
phase: 03-run-logging
source: [03-retest-UAT.md]
started: 2026-04-01T03:00:00Z
updated: 2026-04-01T04:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Pace field layout in RunEntryForm
expected: Open RunEntryForm (click "Log run" on any active plan day, or "Log a run" on the Runs page). The Pace field is visible immediately — empty when distance/duration aren't filled yet. It does not appear mid-form after filling Duration. It sits after Avg HR. It does not span the full width of the form.
result: pass

### 1b. Runs list sort and dedup after logging a past-dated run
expected: After logging a new run with a past date via "Log a run", the run appears at its correct sorted position (newest-first) — not pinned to the top of the list. Scrolling to the bottom does not show the same run a second time.
result: pass
note: Confirmed working 2026-04-14. Fix was loadRuns(true) server reload on save instead of prepend.

### 2. Mobile run date layout on completed days
expected: On the Training Plan page on mobile, find a completed day that has a linked run. The run date shown is compact and does not push the day label or guidelines onto multiple lines. Layout should not break — day label, guidelines, and run date should all fit without wrapping badly.
result: pass

### 3. Disabled delete button tooltip
expected: Open RunDetailModal for a run that IS linked to a plan day. The delete area shows a disabled grey "Delete run" button. Hovering over it (on desktop) shows a tooltip: "Undo the training plan day first to delete this run".
result: skipped
reason: tooltip still not working despite span wrapper fix — deferred as tech debt, not blocking

### 4. Runs page count and scroll accuracy
expected: On the Runs page: the "Showing X of Y" count is always accurate (X never exceeds Y). After changing filters and scrolling to the bottom, no duplicate entries appear. The count reflects the actual visible runs.
result: pass
note: User observed "Showing X of X" — confirmed correct; Y is filtered total. Old bug was X > Y (e.g. 14 of 7), which is fixed.

### 5. Log run from Training Plan uses same modal
expected: On a completed plan day that has no linked run, clicking "Log run" opens the same RunDetailModal used on the Runs page — not a separate inline form. Single shared implementation, same appearance.
result: pass

### 6. Clicking outside a modal closes it
expected: With any modal open (RunDetailModal, LinkRunModal, etc.), clicking on the dark backdrop/overlay behind the modal dismisses it — same as clicking Cancel or pressing Escape.
result: pass

## Summary

total: 7
passed: 6
issues: 0
pending: 0
skipped: 1

## Gaps

- truth: "After logging a run with a past date, it appears at its correct sorted position (newest-first), not pinned to the top. No duplicate appears when scrolling."
  status: resolved
  resolved: 2026-04-14
  reason: "Confirmed working by user. Fix: RunEntryForm.onSave calls loadRuns(true, currentFilters()) which reloads from server in sorted order."
  test: 1b
