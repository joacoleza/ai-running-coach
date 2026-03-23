---
status: partial
phase: 02-coach-chat
source: [02-VERIFICATION.md]
started: 2026-03-23T21:50:00Z
updated: 2026-03-23T21:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full Onboarding Flow
expected: Coach asks one question at a time; after question 6, summarizes and offers to generate the plan; onboardingStep increments with each exchange.
result: [pending]

### 2. Plan Generation and Calendar Navigation
expected: After onboarding, coach response contains `<training_plan>` JSON; POST /api/plan/generate called automatically; main content navigates to /plan; calendar shows color-coded weekly sessions.
result: [pending]

### 3. Session Modal Inline Editing
expected: Clicking a calendar event opens SessionModal with all fields editable (date, distance, duration, pace, BPM, notes). Saving calls PATCH /api/sessions/:id and calendar reflects the update.
result: [pending]

### 4. Mark Session Complete
expected: Clicking "Mark Complete" turns session green on calendar. Clicking again shows "Mark Incomplete" and reverts color.
result: [pending]

### 5. Chat History After Page Refresh (Gap Closure)
expected: After having a chat conversation and refreshing the page, the History view shows the previously sent messages loaded from MongoDB.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
