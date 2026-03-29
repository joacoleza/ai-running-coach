---
phase: quick-260329-n0p
plan: "01"
subsystem: chat-plan-integration
tags: [plan-add, streaming, system-prompt, isGeneratingPlan]
dependency_graph:
  requires: []
  provides: [plan-add-past-dates, plan-add-streaming-strip, 12-week-calendar, plan-update-indicator]
  affects: [api/src/shared/prompts.ts, web/src/hooks/useChat.ts]
tech_stack:
  added: []
  patterns: [streaming-tag-strip, early-indicator-detection]
key_files:
  created: []
  modified:
    - api/src/shared/prompts.ts
    - web/src/hooks/useChat.ts
    - api/src/__tests__/prompts.test.ts
decisions:
  - "Use local planUpdateDetected variable (not state ref) to track mid-stream plan tag detection — avoids stale closure issues with useState"
  - "Reset isGeneratingPlan after plan-updated dispatch in both sendMessage and startPlan done handlers"
  - "12 weeks covers all marathon plan durations without needing to compute dates beyond the calendar"
metrics:
  duration: "5 min"
  completed_date: "2026-03-29"
  tasks: 3
  files_modified: 3
---

# Quick Task 260329-n0p: Fix plan:add past dates, strip plan:add tags, 12-week calendar, plan-update indicator

Fix four related bugs in chat/plan integration: strip `<plan:add>` tags during streaming, allow past-date `<plan:add>` with completed/skipped status flags, extend date calendar to 12 weeks, and show "Building your training plan..." indicator when plan update tags are applied.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix system prompt — extend calendar + allow plan:add past dates | 2fbf7e0 | api/src/shared/prompts.ts |
| 2 | Fix useChat.ts — strip plan:add streaming + isGeneratingPlan indicator | f5886ef | web/src/hooks/useChat.ts |
| 3 | Run tests + fix prompts.test.ts regression | 5f3638c | api/src/__tests__/prompts.test.ts |

## Changes Made

### Task 1 — api/src/shared/prompts.ts

- **12-week calendar:** Changed `Array.from({ length: 5 }` to `Array.from({ length: 12 }` — Claude now has exact ISO dates for 12 weeks forward, covering full marathon plan durations without computing dates independently
- **Past-date `<plan:add>` rule:** Replaced prohibition ("Never use `<plan:add>` on a past date") with allowance ("ONLY allowed when `completed="true"` or `skipped="true"` is included")
- **Table examples:** Added two rows to the `<plan:add>` table showing past completed and past skipped variants
- **Bottom allowance note:** Updated from "ONLY for the initial `<training_plan>` block" to "applies to both `<training_plan>` AND `<plan:add>`"

### Task 2 — web/src/hooks/useChat.ts

- **Strip `<plan:add>` during streaming (sendMessage):** Added `.replace(/<plan:add[^/]*\/>/g, '')` alongside existing `plan:update` strip in the `setMessages` streaming callback
- **Strip `<plan:add>` during streaming (startPlan):** Same change in the startPlan streaming callback
- **Early `isGeneratingPlan` indicator:** Added `planUpdateDetected` local boolean in both streaming loops; sets `setIsGeneratingPlan(true)` as soon as `<plan:update` or `<plan:add` appears in accumulated text mid-stream
- **Reset `isGeneratingPlan` after done:** Added `setIsGeneratingPlan(false)` after `window.dispatchEvent(new Event('plan-updated'))` in both `sendMessage` and `startPlan` done handlers; added edge-case reset when `planUpdateDetected` is true but no tags found in final text

### Task 3 — api/src/__tests__/prompts.test.ts

- Updated one test that checked for the old prohibition text — now verifies the new allowance text (`'Past completed/skipped days** can also be added with \`<plan:add>\`'`)

## Test Results

- **API tests:** 127/127 passed
- **Web tests:** 205/205 passed
- **E2E tests:** 39/39 passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated prompts.test.ts to match new plan:add past-date behavior**
- **Found during:** Task 3
- **Issue:** Test was asserting old "ONLY for the initial `<training_plan>` block" prohibition text which was intentionally replaced
- **Fix:** Updated test description and assertion to verify new allowance text
- **Files modified:** api/src/__tests__/prompts.test.ts
- **Commit:** 5f3638c

## Known Stubs

None.

## Self-Check: PASSED

- [x] api/src/shared/prompts.ts — modified, committed 2fbf7e0
- [x] web/src/hooks/useChat.ts — modified, committed f5886ef
- [x] api/src/__tests__/prompts.test.ts — modified, committed 5f3638c
- [x] All commits exist: `git log --oneline | grep "quick-260329-n0p"` shows 3 commits
- [x] Web build: `npm run build` passes cleanly
- [x] API tests: 127/127 passed
- [x] Web tests: 205/205 passed
- [x] E2E tests: 39/39 passed
