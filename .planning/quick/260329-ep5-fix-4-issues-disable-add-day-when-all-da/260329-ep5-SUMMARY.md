# Quick Task 260329-ep5 Summary

**Task:** disable Add Day for past weeks, planState in agent messages, fix startDate, server-side plan saving
**Date:** 2026-03-29
**Status:** Complete — merged as PR #33

## What was done

1. **Disable + Add day for past weeks** — `PlanView.tsx` computes `hasAvailableDay`: slot must be today-or-future AND unoccupied. Fully-past weeks never show the button.

2. **Synthetic plan-state injection** — `chat.ts` injects a synthetic user/assistant message pair before the actual user message when plan has phases. Contains all non-rest days with date, status, guidelines. Overrides stale references in old chat history.

3. **Fix startDate normalization** — `planUtils.ts` `normalizeWeekDays` ensures week day entries are correctly sorted/normalized when parsing Claude responses.

4. **Server-side plan saving** — `chat.ts` parses `<training_plan>` and saves to DB directly, emits `planGenerated: true`. `useChat.ts` re-fetches via `GET /api/plan` on `planGenerated: true` and never calls `POST /api/plan/generate`.

## Test coverage added

- `api/src/__tests__/chat.integration.test.ts` — 126 lines added: planGenerated, synthetic context injection
- `api/src/__tests__/plan.test.ts` — 32 lines added
- `api/src/__tests__/planUtils.test.ts` — 17 lines added
- `web/src/__tests__/PlanView.test.tsx` — 24 lines: past week button hiding
- `web/src/__tests__/useChat.trainingPlan.test.ts` — 141 lines: planGenerated flow

## E2E gap (addressed in 260329-lc2)

E2E test for `planGenerated` flow added to `e2e/coach.spec.ts` in subsequent quick task.
