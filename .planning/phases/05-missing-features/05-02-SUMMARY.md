---
plan: 05-02
phase: 05-missing-features
status: complete
completed: 2026-04-11
---

## What Was Built

Wired four new XML tag handlers into `web/src/hooks/useChat.ts`:

- **`plan:add-phase`** — POST /api/plan/phases, dispatches plan-updated
- **`plan:update-goal`** — PATCH /api/plan with targetDate (empty string triggers $unset), dispatches plan-updated
- **`run:create`** — POST /api/runs (unit attr not forwarded), dispatches plan-updated; missing required fields surface as ⚠️ error
- **`run:update-insight`** — PATCH /api/runs/:runId with insight; silent, does NOT dispatch plan-updated

Both tag-strip locations updated (live streaming `onText` in sendMessage + startPlan, and history-load `init()` useEffect).

`applyPlanOperations` guard extended to include all four new match arrays.

`planUpdateDetected` indicator in both `sendMessage` and `startPlan` onText callbacks now also fires on `<plan:add-phase` and `<run:create` tags.

Errors from all four handlers collected and surfaced as `⚠️` on the last assistant message.

## Key Files Modified

- `web/src/hooks/useChat.ts` — four new regex declarations, four new handlers, extended guard/strip/dispatch

## Self-Check: PASSED
- TypeScript build: ✓
- Tag strip in both locations: ✓
- plan-updated not dispatched for insight-only: ✓
