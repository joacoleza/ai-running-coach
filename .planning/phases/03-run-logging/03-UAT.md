---
status: complete
phase: 03-run-logging
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md]
started: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
result: pass

### 2. Complete a Plan Day — Run Entry Form Opens
expected: On the Training Plan page, click the "Complete" button on an active (non-completed) day. Instead of immediately marking it complete, a run entry form opens inline within that day row. The form shows fields for date (defaults to today), distance (km), duration (MM:SS or HH:MM:SS), avg HR (optional), notes (optional). The day's guidelines appear as a hint (e.g. "Target: Easy run 5km").
result: issue
reported: "Yes, the form is opened. But, Date field is too long"
severity: cosmetic

### 3. Live Pace Computation in Run Entry Form
expected: While filling in the run entry form, enter a distance (e.g. 5) and a duration (e.g. 25:00). The pace field updates automatically showing something like "5:00/km". Changing either value updates pace in real time without submitting.
result: pass

### 4. Save Run and Complete Plan Day
expected: Fill in the run entry form (date, distance, duration) and click Save. The plan day is marked as completed (green checkmark), the form closes, and the day shows the run date in "Monday DD/MM/YYYY" format. The run is saved and linked to that plan day.
result: issue
reported: "Yes, but not beneath, next to it (which is fine, prefer next to it). But the date should not be strikedthrough and it should be bold"
severity: cosmetic

### 5. Log a Standalone Run (Runs Page)
expected: Navigate to the Runs page. Click "Log a run" button. A run entry form appears (not linked to any plan day). Fill in fields and save. The new run appears at the top of the runs list showing date, distance, duration, pace, and avg HR. No plan badge appears since it's unlinked.
result: pass

### 6. Runs Page Infinite Scroll and Filters
expected: On the Runs page, if more than 20 runs exist, scrolling to the bottom loads more runs automatically. The filter panel (toggle button) shows date range and distance range filters. Applying a filter narrows the list. A "Clear filters" button resets them.
result: issue
reported: "Entries are not sorted desc by date. The bottom summary doesn't make sense: 'Showing 43 of 27 runs'. Date range filter is not working."
severity: major

### 7. View and Edit Run Details
expected: Click on any run row in the Runs page. A RunDetailModal opens showing all fields (date, distance, duration, pace read-only, avg HR, notes). You can edit date/distance/duration/avgHR/notes inline. A "Save changes" button appears only when you've edited something. Saving updates the run and the modal stays open with the new data.
result: pass

### 8. Delete a Standalone Run
expected: In RunDetailModal for a run that is NOT linked to a plan day, a delete button is visible. Clicking it shows a confirmation step (Confirm/Cancel buttons). Confirming deletes the run, closes the modal, and removes it from the list.
result: pass

### 9. Delete Guard for Linked Runs
expected: In RunDetailModal for a run that IS linked to a plan day (shows a plan badge), the delete button is hidden or shows a tooltip explaining the run must be unlinked first (by undoing the plan day completion).
result: issue
reported: "Delete button is not visible. 'Undo the training plan day first to delete this run' is visible instead. Should be a tooltip on a disabled delete button, not a standalone text."
severity: minor

### 10. Get Coaching Feedback on a Run
expected: In RunDetailModal, click "Add feedback to run". The coach panel opens and a pre-composed message is sent automatically (e.g. asking for feedback on that specific run). After the coach responds, the response is saved as an insight on the run. The insight appears in the modal in a gray box (italic text).
result: pass

### 11. Link an Existing Run to a Plan Day
expected: On the Training Plan page, an active (non-completed) day shows a "Link run" button (only if unlinked runs exist). Clicking it opens the LinkRunModal listing unlinked runs with date, distance, and pace. Clicking "Link" on a run marks the plan day as completed and links the run. The modal closes and the day shows as completed.
result: issue
reported: "I don't see all the runs I uploaded. Don't we need some kind of pagination or filter here? We can have a huge list"
severity: major

### 12. Undo Completed Day Unlinks the Run
expected: On the Training Plan page, find a completed day that has a linked run. Click the "Undo" action to mark it incomplete. The day returns to active state. Navigate to the Runs page — the previously linked run now appears as unlinked (no plan badge, and it appears in the unlinked runs list).
result: pass

### 13. PlanView Shows Run Date on Completed Days
expected: On the Training Plan page, completed days that have a linked run show the run date in "Day DD/MM/YYYY" format (e.g. "Monday 31/03/2026") beneath the day label/guidelines. Days without a linked run just show the green checkmark without a date.
result: issue
reported: "I have no way to complete a day without uploading data. I should be able to do so. Also, I should be able to link runs to completed days without a linked run."
severity: major

### 14. Get Plan Progress Feedback
expected: On the Training Plan page, there is a "Get plan feedback" (or similar) button. Clicking it opens the coach panel and sends a message asking for feedback on overall plan progress. After the coach responds, the response is saved and a "Coach Feedback" collapsible section appears on the Training Plan page showing the saved feedback text.
result: pass

### 15. Coach Has Run Data Context
expected: After logging at least one completed run, open the coach panel and ask something like "How did my last run go?" or "Give me feedback on my recent training." The coach references the actual run data (date, distance, pace) from your completed runs rather than asking you to repeat the details.
result: pass

## Summary

total: 15
passed: 9
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Date field in RunEntryForm should be reasonably sized, not full-width"
  status: failed
  reason: "User reported: Date field is too long (full-width, see screenshot)"
  severity: cosmetic
  test: 2
  artifacts: [web/src/components/runs/RunEntryForm.tsx]
  missing: []
- truth: "Run date shown next to completed day should be bold and not strikethrough"
  status: failed
  reason: "User reported: date is strikedthrough and should be bold instead"
  severity: cosmetic
  test: 4
  artifacts: [web/src/components/plan/DayRow.tsx]
  missing: []
- truth: "For linked runs in RunDetailModal, show a disabled delete button with tooltip 'Undo the training plan day first to delete this run' instead of hiding the button and showing standalone text"
  status: failed
  reason: "User reported: delete button hidden entirely, message shown as standalone text — should be tooltip on disabled button"
  severity: minor
  test: 9
  artifacts: [web/src/components/runs/RunDetailModal.tsx]
  missing: []
- truth: "User can mark a plan day as complete without entering run data (quick complete), and can link a run to an already-completed day that has no linked run"
  status: failed
  reason: "User reported: no way to complete a day without uploading data; cannot link runs to completed days that lack a linked run"
  severity: major
  test: 13
  artifacts: [web/src/components/plan/DayRow.tsx, web/src/components/plan/PlanView.tsx]
  missing: [skip run entry option in RunEntryForm/DayRow, Link run button on completed days with no linkedRun]
- truth: "LinkRunModal must show all unlinked runs with pagination or search/filter to handle large lists"
  status: failed
  reason: "User reported: not all runs visible in LinkRunModal; no pagination or filter to find the right run in a large list"
  severity: major
  test: 11
  artifacts: [web/src/components/runs/LinkRunModal.tsx]
  missing: [pagination or search filter in LinkRunModal, fetchUnlinkedRuns may have a hard limit]
- truth: "Runs page shows entries sorted by date descending, correct total count, and working date range filter"
  status: failed
  reason: "User reported: entries not sorted desc by date; summary shows 'Showing 43 of 27 runs' (impossible count); date range filter has no effect"
  severity: major
  test: 6
  artifacts: [web/src/pages/Runs.tsx]
  missing: [sort by date desc in fetchRuns/listRuns, correct total tracking across pages, filter param wiring for dateFrom/dateTo]
