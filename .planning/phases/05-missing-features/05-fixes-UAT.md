---
status: complete
phase: 05-missing-features
source: [05-gaps-UAT.md diagnosed issues 3 and 4]
started: 2026-04-13T20:25:28Z
updated: 2026-04-13T20:25:28Z
note: Re-validation of 2 diagnosed issues after inline fixes (regex + synthetic context)
---

## Current Test

[testing complete]

## Tests

### 1. plan:update-feedback tag stripped and saved (with slashes in text)
expected: Ask the coach "how am I doing?" The coach responds with a progress assessment including pace values (e.g. 5:36/km). The plan:update-feedback XML tag does NOT appear in the chat message. The feedback IS saved in the "Coach Feedback" section on the Training Plan page.
result: pass

### 2. Coach adds week to named phase via chat
expected: Ask the coach to add a week to a named phase (e.g. "Add a week to the maintenance phase"). The coach identifies the correct 0-based phase index and emits plan:add-week. The week is added successfully — no ⚠️ error shown, plan refreshes with the new week visible.
result: pass

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
