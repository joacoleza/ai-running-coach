---
phase: 03-run-logging
plan: "02"
subsystem: api/chat
tags: [synthetic-context, run-data, coaching, prompts]
dependency_graph:
  requires: [03-01]
  provides: [enriched-coach-context]
  affects: [api/src/functions/chat.ts, api/src/shared/prompts.ts]
tech_stack:
  added: []
  patterns: [mongodb-lookup-map, synthetic-context-injection]
key_files:
  modified:
    - api/src/functions/chat.ts
    - api/src/shared/prompts.ts
decisions:
  - "Run lookup uses Map<weekNumber-dayLabel, Run> for O(1) access during line building"
  - "Insight truncated at 150 chars to avoid bloating context window"
  - "Run fetch is non-fatal: try/catch proceeds without run data on error"
  - "progressFeedback prefixed before day listing so coach sees prior assessment first"
metrics:
  duration: "8 min"
  completed: "2026-03-31"
  tasks: 1
  files: 2
---

# Phase 03 Plan 02: Extend Coach Context with Run Data Summary

**One-liner:** Extended synthetic plan-state injection to include actual run date/distance/pace/insight for completed days and plan.progressFeedback, giving the coach full context for informed feedback.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Extend synthetic plan-state injection with run data and progressFeedback | 29e6a82 | api/src/functions/chat.ts, api/src/shared/prompts.ts |

## What Was Built

### chat.ts — Synthetic Context Extension

Added two helper functions:
- `formatPace(paceDecimal: number): string` — converts decimal pace (e.g. 5.5) to "5:30" format
- `formatRunDate(isoDate: string): string` — converts "YYYY-MM-DD" to "DD/MM/YYYY" per D-04

In the synthetic plan-state injection block:
1. Fetches all runs linked to the active plan from MongoDB `runs` collection (keyed by `${weekNumber}-${dayLabel}`)
2. For each completed day, appends run data to the line: `| Ran: DD/MM/YYYY, Xkm @ M:SS/km` (and `| Insight: ...` if set, truncated to 150 chars)
3. If `plan.progressFeedback` is set, prepends `Coach's previous progress assessment: <text>` before the day listing

### prompts.ts — System Prompt Update

Added two instructions to the Current Training Schedule section:
- Tells Claude completed days may include actual run data and to use it rather than asking the user to repeat it
- Tells Claude to build on an existing progress assessment rather than repeating the same observations

## Decisions Made

- Run fetch wrapped in try/catch — non-fatal to avoid blocking the entire chat flow if the runs collection is unavailable
- Run data appended inline to existing day lines (not as a separate section) — keeps context compact
- Insight truncated at 150 chars — sufficient for Claude to reference without overwhelming context

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

Files created/modified:
- FOUND: api/src/functions/chat.ts (modified)
- FOUND: api/src/shared/prompts.ts (modified)

Commits:
- FOUND: 29e6a82 — feat(03-02): extend synthetic plan-state injection with run data and progressFeedback

Acceptance criteria verified:
- collection('runs') present in chat.ts: YES (line 121)
- progressFeedback present in chat.ts: YES (lines 158-160)
- formatPace present in chat.ts: YES (line 14)
- padStart (date formatting) present in chat.ts: YES (line 17)
- "run data" / "actual run" in prompts.ts: YES (line 152)
- "previous progress assessment" in prompts.ts: YES (line 152)
- tsc --noEmit exits 0: YES
