---
phase: quick
plan: 260329-ws0
subsystem: api
tags: [normalization, calendar, planning, chat, prompts]
dependency_graph:
  requires: []
  provides: [normalizePlanPhases, pre-computed-calendar]
  affects: [chat.ts, plan.ts, prompts.ts]
tech_stack:
  added: []
  patterns: [UTC-safe date arithmetic, global plan normalization]
key_files:
  created: []
  modified:
    - api/src/shared/planUtils.ts
    - api/src/__tests__/planUtils.test.ts
    - api/src/shared/prompts.ts
    - api/src/functions/chat.ts
    - api/src/functions/plan.ts
    - api/src/__tests__/chat.test.ts
    - api/src/__tests__/prompts.test.ts
decisions:
  - Use UTC date parsing (Date.UTC) not local noon-time for week number arithmetic — avoids DST clock-change edge where 7 local days != 7 * 86400000ms
  - Remove getWeekDates tool entirely (function + TOOLS array + handler loop) — 26-week pre-computed calendar eliminates the need
  - Remove chat.test.ts getWeekDates tests — function no longer exported, tests were testing removed behavior
  - User message newlines: no server-side stripping found — message content stored and retrieved verbatim via MongoDB insertOne/find
metrics:
  duration: "~6 minutes"
  completed: "2026-03-29"
  tasks: 2
  files: 7
---

# Quick Task 260329-ws0: Fix Calendar Date Accuracy (Server-Side Plan Normalization)

**One-liner:** Global `normalizePlanPhases()` redistributes training days to calendar-correct weeks using UTC-safe arithmetic, replacing per-week normalization; 26-week pre-computed calendar in system prompt eliminates `get_week_dates` tool dependency.

## Objective

Fix three issues: (1) server-side plan normalization that redistributes training days to correct calendar weeks, (2) pre-computed calendar in system prompt replacing get_week_dates tool reliance, (3) newline preservation investigation in user message storage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add normalizePlanPhases and pre-computed calendar | 4c46a57 | planUtils.ts, planUtils.test.ts, prompts.ts |
| 2 | Wire normalization into chat.ts and plan.ts, remove tool reliance | 684f3b4 | chat.ts, plan.ts, chat.test.ts, prompts.test.ts |

## Implementation Details

### normalizePlanPhases

Added to `api/src/shared/planUtils.ts`. Algorithm:

1. Collect all non-rest days from all phases, tagged with phase index
2. Find earliest day date → compute anchorMonday using `getMondayOf()`
3. For each day: compute `weekNumber = floor((dayMs - anchorUTC) / MS_PER_WEEK) + 1` using `Date.UTC()` for DST-safe arithmetic
4. Group by `(phaseIndex, weekNumber)` → rebuild weeks with correct `startDates`
5. Fill each week to 7 Mon-Sun days with rest days for empty slots
6. Re-index week numbers per-phase starting from 1

Key insight: Using `new Date(dateStr + 'T12:00:00').getTime()` for anchor vs day dates causes DST mismatch (e.g. Europe spring clock change makes 7 local days = 6.99 * 86400000ms). Fixed by using `Date.UTC(y, m-1, d)` for pure date arithmetic.

### Pre-computed 26-week calendar in buildSystemPrompt

Replaces the `get_week_dates` tool instruction. Covers offsets -13 to +12 relative to current week. Format:
```
Week -13: Mon YYYY-MM-DD, Tue YYYY-MM-DD, ... Sun YYYY-MM-DD
Week 0 (this week): Mon YYYY-MM-DD, ... Sat YYYY-MM-DD, Sun YYYY-MM-DD <- today  (today marker on current day)
Week +12: Mon YYYY-MM-DD, ...
```

### Tool removal from chat.ts

- Removed `TOOLS` constant (Anthropic.Tool[] definition)
- Removed `getWeekDates` export function
- Removed `while (true)` tool-use loop — replaced with single `stream` call + `await stream.finalMessage()`
- Removed `tools: TOOLS` from `anthropic.messages.stream()` call
- Simpler, faster: no round-trip to Claude for tool results, no multi-turn loop

### Newline investigation

The plan asked to investigate newline stripping. Finding: no stripping occurs server-side. The `message` field from `req.json()` preserves newlines (JSON string encoding preserves `\n`). `buildContextMessages()` in `context.ts` returns `content: m.content` verbatim — no string transformations. User message content is stored and retrieved as-is.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DST-unsafe week number arithmetic**
- **Found during:** Task 1 (test failure)
- **Issue:** `new Date(dateStr + 'T12:00:00').getTime()` for anchor and days produces different UTC milliseconds across a DST boundary (e.g. anchor at UTC+1 noon, day at UTC+2 noon → 6.99 days difference instead of 7.0)
- **Fix:** Use `Date.UTC(y, m-1, d)` (UTC midnight) for both anchor and day timestamps — pure calendar arithmetic, DST-immune
- **Files modified:** `api/src/shared/planUtils.ts`
- **Commit:** 4c46a57

**2. [Rule 1 - Bug] Stale chat.test.ts and prompts.test.ts after tool/calendar changes**
- **Found during:** Task 2 test run
- **Issue:** `chat.test.ts` imported `getWeekDates` from `chat.ts` (now removed). `prompts.test.ts` tested for `get_week_dates` text in prompt and asserted no pre-computed calendar rows existed — both assertions now wrong
- **Fix:** Removed `getWeekDates` describe block and import from `chat.test.ts`. Updated `prompts.test.ts` to assert new calendar behavior (Week -13, Week +12, `<- today` marker, `use the calendar below`)
- **Files modified:** `api/src/__tests__/chat.test.ts`, `api/src/__tests__/prompts.test.ts`
- **Commit:** 684f3b4

## Test Results

- API tests: 135 passed (14 test files)
- Web build: success (TypeScript clean, Vite bundle 428KB)
- Test count change: -10 (removed 10 stale getWeekDates tool tests), +10 (normalizePlanPhases tests) + 2 new calendar tests = net +2

## Known Stubs

None.

## Self-Check: PASSED

Files verified:
- `api/src/shared/planUtils.ts` — FOUND, exports `normalizePlanPhases`
- `api/src/__tests__/planUtils.test.ts` — FOUND, 10 normalizePlanPhases tests
- `api/src/shared/prompts.ts` — FOUND, includes 26-week calendar
- `api/src/functions/chat.ts` — FOUND, no TOOLS array, no while loop
- `api/src/functions/plan.ts` — FOUND, uses normalizePlanPhases

Commits verified:
- 4c46a57 — FOUND
- 684f3b4 — FOUND
