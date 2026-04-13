---
status: diagnosed
phase: 05-missing-features
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md]
started: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:00:00Z
---

## Current Test

## Current Test

[testing complete]

## Tests

### 1. Add Phase via + Add phase button
expected: On the Training Plan page with an active plan, scroll to the bottom of the phases list. A "+ Add phase" button is visible below the last phase. Clicking it creates a new phase (auto-named "Phase N") and the new phase appears in the plan immediately.
result: pass

### 2. Target date placeholder when no date set
expected: On the Training Plan page header area, when no target date is set, a clickable "+ Set target date" placeholder text is visible near the plan goal/header.
result: pass

### 3. Set a target date
expected: Click "+ Set target date" (or an existing date). A date input field appears inline. Enter a date and press Enter (or click away). The input disappears and the chosen date is shown in the header. Page does not reload.
result: pass

### 4. Clear a target date
expected: With a target date already set, click the date to enter edit mode. Clear the field and press Enter (or blur). The date disappears and "+ Set target date" placeholder returns. Page does not reload.
result: pass

### 5. Escape reverts date edit
expected: Click the target date to enter edit mode. Change the value. Press Escape. The input closes and the original date is restored (no change saved).
result: pass

### 6. Coach adds a phase via plan:add-phase tag
expected: In the coach chat, ask the coach to add a new training phase (e.g. "Add a new maintenance phase"). The coach responds and emits a plan:add-phase tag (not visible in chat). The Training Plan page auto-refreshes and the new phase appears without a page reload.
result: pass

### 7. Coach updates goal/target date via plan:update-goal tag
expected: In the coach chat, ask the coach to update your goal or target race date (e.g. "Set my target date to December 1st"). The coach responds and emits a plan:update-goal tag. The Training Plan header reflects the updated target date without a page reload.
result: pass

### 8. Coach creates a run via run:create tag
expected: In the coach chat, ask the coach to log a run for you (e.g. "Log yesterday's 5km run, took 28 minutes"). The coach responds and emits a run:create tag. The run appears in the Runs list without needing to manually enter it.
result: pass

### 9. Coach updates run insight via run:update-insight tag
expected: After completing a run that is linked to a plan day, the coach provides feedback. The coaching insight text is saved to that run record (visible in run detail). The plan does NOT reload/flash when this happens (insight-only update, no plan-updated event).
result: issue
reported: "Run was added and linked correctly but the coaching feedback shown in chat was not saved to the run's insight field. Linked run detail shows no insight."
severity: major

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Coaching feedback shown in chat is saved as insight on the linked run record"
  status: failed
  reason: "User reported: Run was added and linked correctly but the coaching feedback shown in chat was not saved to the run's insight field. Linked run detail shows no insight."
  severity: major
  test: 9
  root_cause: "run:update-insight requires runId, but newly created runs don't have an ID until after applyPlanOperations processes run:create. Claude cannot emit run:update-insight with the correct ID for a run created in the same turn. Fix: after successful run:create POST, capture returned _id and immediately PATCH the run with stripped response text as insight."
  artifacts:
    - path: "web/src/hooks/useChat.ts"
      issue: "run:create handler (line ~462) discards POST response body — does not capture returned run _id to auto-save insight"
  missing:
    - "In run:create handler, read response JSON to get created run _id"
    - "After successful create, call PATCH /api/runs/:id with { insight: accumulatedText (stripped of XML tags) }"
  debug_session: ""
