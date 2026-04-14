---
status: testing
phase: 05-missing-features
source: [05-UAT.md gaps section]
started: 2026-04-13T20:11:41Z
updated: 2026-04-13T20:11:41Z
note: Re-validation of 3 gaps from original UAT after fixes committed in 7e9056e and 80df606
---

## Current Test

number: 1
name: Coach run insight auto-saved after run:create
expected: |
  After the coach logs a run for you (e.g. "Log yesterday's 8km run, took 45 minutes"), the coaching insight text from that same response is automatically saved to the run's insight field. Open the run detail — the insight is visible without manually asking for feedback.
awaiting: user response

## Tests

### 1. Coach run insight auto-saved after run:create
expected: After the coach logs a run for you (e.g. "Log yesterday's 8km run, took 45 minutes"), the coaching insight text from that same response is automatically saved to the run's insight field. Open the run detail — the insight is visible without manually asking for feedback.
result: pass

### 2. Add week to a phase manually
expected: On the Training Plan page, within any phase, a "+ Add week" button is visible at the bottom of that phase's week list. Clicking it adds a new empty week to the phase and it appears immediately without a page reload.
result: pass

### 3. Coach feedback saved from organic chat
expected: Ask the coach "how am I doing?" or a similar progress question in the CoachPanel. The coach responds with a plan assessment. That feedback text is saved and appears in the "Coach Feedback" section on the Training Plan page without needing to click "Get feedback".
result: issue
reported: "plan:update-feedback tag is NOT stripped from the chat display — it shows raw XML in the message. Feedback is also not saved to the Coach Feedback section on the Training Plan page."
severity: major

### 4. Coach adds a week via plan:add-week chat command
expected: Ask the coach to add a week to a named phase (e.g. "Add one week at the end of the maintenance phase"). The coach emits a plan:add-week tag with the correct phaseIndex. The week is added and the plan refreshes. No error shown.
result: issue
reported: "Coach emits plan:add-week with wrong phaseIndex. Error shown: ⚠️ Phase index 3 does not exist. The maintenance phase is not at index 3 (0-based). Coach is calculating or guessing the wrong index."
severity: major

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Coach plan:add-week tag uses correct 0-based phaseIndex matching the named phase"
  status: failed
  reason: "User reported: ⚠️ Phase index 3 does not exist — coach sent phaseIndex=3 but the maintenance phase is at a different index"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "plan:update-feedback tag is stripped from chat display and feedback is saved to plan.progressFeedback"
  status: failed
  reason: "User reported: plan:update-feedback tag shows raw XML in chat, not stripped. Feedback also not saved to Coach Feedback section on Training Plan page."
  severity: major
  test: 3
  root_cause: "Strip regex /<plan:update-feedback[^/]*\\/>/g and extraction regex [^/]+ both break on the first '/' inside an attribute value (e.g. '5:36/km'). Regex stops at the slash, so the full tag is never matched — neither stripped from display nor processed by applyPlanOperations."
  artifacts:
    - path: "web/src/hooks/useChat.ts"
      issue: "All .replace(/<plan:update-feedback[^/]*\\/>/g, '') strip calls (lines ~208, 285, 538, 672, 865) fail when feedback attr contains '/'. Extraction regex /<plan:update-feedback\\s+([^/]+)\\/>/g at line 250 also fails."
  missing:
    - "Change strip regex to /<plan:update-feedback[\\s\\S]*?\\/>/g (lazy match any char including '/') in all 5 .replace() calls"
    - "Change extraction regex to /<plan:update-feedback\\s+((?:(?!\\/>)[\\s\\S])+)\\/>/g so the capture group includes '/' chars"

- truth: "Coach plan:add-week tag uses correct 0-based phaseIndex matching the named phase"
  status: failed
  reason: "User reported: ⚠️ Phase index 3 does not exist — coach sent phaseIndex=3 but the maintenance phase is at a different index"
  severity: major
  test: 4
  root_cause: "Synthetic plan context in chat.ts only lists individual day lines (Week N Day X ...) with no phase name or 0-based index. Coach cannot reliably map 'maintenance phase' to index 2. It guesses phaseIndex=3 (1-based or off-by-one)."
  artifacts:
    - path: "api/src/functions/chat.ts"
      issue: "planStateContent at line ~172 has no phase summary header — Claude cannot see which phases exist at which index"
  missing:
    - "Before the day lines, inject a phase summary: 'Phases (use 0-based index for plan:add-week): Phase 0: Base Building (Weeks 1-3), Phase 1: Build (Weeks 4-6), Phase 2: Maintenance (Weeks 7-9)'"
    - "Build this summary by iterating plan.phases with their array index and collecting week number ranges per phase"
