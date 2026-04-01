---
status: complete
phase: 03-run-logging
source: [03-07-SUMMARY.md, 03-HUMAN-UAT.md]
started: 2026-04-01T02:30:00Z
updated: 2026-04-01T02:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Date field width in RunEntryForm
expected: Open RunEntryForm (click "Log run" on any active plan day, or "Log a run" on the Runs page). The Date field occupies one column — same width as Distance and Duration — not stretched across the full row.
result: pass

### 1b. Pace field layout in RunEntryForm
expected: Pace field is always visible (empty when distance/duration not yet filled). It does not appear mid-form causing layout shifts. It should not span full width. It should be positioned after Avg HR.
result: issue
reported: "Pace field is not shown. When I fill Duration it appears in middle of the modal and moves everything. It should always be visible (empty when data for calculation is not there yet). It should not take the full width. It should go after avg HR."
severity: major

### 2. Run date bold and not struck through on completed days
expected: On the Training Plan page, find a completed day that has a linked run. The run date shown next to the day label is bold and NOT struck through (it sits outside the strikethrough area that applies to the day guidelines).
result: issue
reported: "On mobile it looks like shit — the run date is large bold green text pushed to the right, causing the day label and guidelines to wrap badly onto multiple lines. Broken layout on mobile."
severity: major

### 3. Disabled delete button for linked runs
expected: In RunDetailModal for a run that IS linked to a plan day, the delete area shows a disabled grey "Delete run" button (not a plain text message). Hovering over it shows a tooltip: "Undo the training plan day first to delete this run".
result: issue
reported: "Tooltip is not working — hover does not show the tooltip text."
severity: minor

### 4. Runs page — sort, count, date filter, and infinite scroll
expected: On the Runs page: (a) runs appear sorted newest-first, (b) the "Showing X of Y" summary is always accurate (X ≤ Y, never inflated), (c) selecting a date range in the filter narrows the list correctly, (d) scrolling to the bottom loads more runs without duplicating entries.
result: issue
reported: "Showing X of Y count still inflated — screenshots show 'Showing 14 of 7 runs' and 'Showing 47 of 27 runs'. Duplicates still appear when playing with filters and scrolling."
severity: major

### 5. LinkRunModal — search and sufficient runs visible
expected: Click "Link run" on an active plan day. The modal shows up to 100 unlinked runs and has a search input at the top. Typing a date fragment (e.g. "31/03") or a distance number filters the list in real time.
result: pass

### 6. Quick-complete a day without entering run data
expected: On an active plan day, the checkmark (✓) button immediately marks the day as complete WITHOUT opening a form — no run data required. A separate "Log run" button is visible next to it for when you do want to record data.
result: pass

### 7. Link a run to an already-completed day with no linked run
expected: Find a completed plan day that has NO linked run (shows the green checkmark but no run date). A "Link run" button should be visible. Clicking it opens LinkRunModal. Selecting a run links it to that completed day.
result: pass

### 8. Coaching insight saves to run after feedback
expected: Click "Add feedback to run" in RunDetailModal. CoachPanel opens with a pre-composed message. After the coach responds, close and reopen the modal — the coach's insight appears in a grey box and persists after a page reload.
result: pass

### 9. CoachPanel opens from Runs page
expected: In RunDetailModal, click "Add feedback to run". The CoachPanel slides open (or becomes visible) and a pre-composed message about that specific run is sent automatically — you should see it appear in the chat without typing anything.
result: pass

## Summary

total: 12
passed: 6
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Pace field is always visible in RunEntryForm (empty until distance/duration filled), sits after Avg HR, does not span full width, does not cause layout shift"
  status: failed
  reason: "User reported: Pace not shown initially; appears mid-form when Duration filled, pushing everything; takes full width; should be after Avg HR"
  severity: major
  test: 1b
  artifacts: [web/src/components/runs/RunEntryForm.tsx]
  missing: [always-rendered pace field, correct grid position after avg HR, no layout shift]

- truth: "On mobile, completed day rows with a linked run display the run date compactly without breaking row layout or wrapping guidelines text"
  status: failed
  reason: "User reported: on mobile the run date is large bold green text pushed right, causing day label and guidelines to wrap badly"
  severity: major
  test: 2
  artifacts: [web/src/components/plan/DayRow.tsx]
  missing: [mobile-safe run date layout — smaller/inline text that does not cause wrapping]

- truth: "Hovering over the disabled Delete run button shows a tooltip explaining the run must be unlinked first"
  status: failed
  reason: "User reported: tooltip not working — hover shows nothing"
  severity: minor
  test: 3
  artifacts: [web/src/components/runs/RunDetailModal.tsx]
  missing: [working tooltip — title on disabled button is ignored by browsers, needs wrapper span with title]

- truth: "Runs page Showing X of Y count is always accurate, no duplicate entries after filter changes and infinite scroll"
  status: failed
  reason: "User reported: count still inflated (14 of 7, 47 of 27); duplicates still appear after playing with filters"
  severity: major
  test: 4
  artifacts: [web/src/pages/Runs.tsx]
  missing: [stable reset logic that fully prevents stale observer firing after filter resets]

### 10. Log run from Training Plan uses same modal as Runs page
expected: Clicking "Log run" on a plan day opens the same RunDetailModal/entry experience as logging a run from the Runs page — no separate inline form component. Single shared implementation.
result: issue
reported: "Log run from training plan should open the exact same modal as in the run section, no need to duplicate components."
severity: major

### 11. Clicking outside a modal closes it
expected: Clicking on the backdrop/overlay behind any modal (RunEntryForm, RunDetailModal, LinkRunModal, etc.) dismisses it, the same as clicking Cancel or pressing Escape.
result: issue
reported: "Clicking outside of modals should close them."
severity: minor

- truth: "Log run from Training Plan uses the same modal component as the Runs page — no duplicate run entry UI"
  status: failed
  reason: "User reported: two separate components for the same action — should be one shared modal"
  severity: major
  test: 10
  artifacts: [web/src/components/runs/RunEntryForm.tsx, web/src/components/plan/DayRow.tsx, web/src/components/runs/RunDetailModal.tsx]
  missing: [unified run entry modal used from both Training Plan and Runs page]

- truth: "Clicking outside any modal (on the backdrop) closes it"
  status: failed
  reason: "User reported: clicking outside modals does not close them"
  severity: minor
  test: 11
  artifacts: [web/src/components/runs/RunDetailModal.tsx, web/src/components/runs/LinkRunModal.tsx]
  missing: [backdrop onClick handler on all modals]
