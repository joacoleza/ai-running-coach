---
phase: 14-gym-support
plan: "05"
subsystem: api-coach-context
tags: [gym, exercises, system-prompt, coach-context, synthetic-context]
dependency_graph:
  requires: [14-01, 14-03, 14-04]
  provides: [GYM-05, GYM-06]
  affects: [api/src/shared/prompts.ts, api/src/functions/chat.ts]
tech_stack:
  added: []
  patterns: [discipline-aware-context-enrichment, exercise-target-formatting]
key_files:
  created: []
  modified:
    - api/src/shared/prompts.ts
    - api/src/functions/chat.ts
    - api/src/__tests__/prompts.test.ts
    - api/src/__tests__/chat.test.ts
decisions:
  - "Gym session context uses 'Gym session DD/MM/YYYY | Exercises: ...' format (not 'Ran:') — discipline discriminator is run.discipline === 'gym'"
  - "Exercise list capped at 8 entries in synthetic context to prevent token explosion"
  - "Body-weight exercises omit weight/unit — only append '@ WeightUnit' when weight field is present"
  - "Notes, Insight, and RunId appended for all disciplines after the discipline-specific block"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-04"
  tasks_completed: 2
  files_changed: 4
---

# Phase 14 Plan 05: Gym Coach Integration Summary

**One-liner:** System prompt teaches gym exercise targets via plan:add exercises[] JSON; synthetic context enriched with gym session exercise logs for discipline-aware coach feedback.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update system prompt — gym exercises instructions | f6963c3 | prompts.ts, prompts.test.ts |
| 2 | Enrich chat.ts synthetic context with gym session exercise logs | 4feec6d | chat.ts, chat.test.ts |

## What Was Built

### Task 1 — System Prompt: Gym Exercise Targets (GYM-05)

Added a "Gym plan days with exercise targets" subsection to the `## Disciplines` section in `prompts.ts`. The coach is now instructed to:

- Include an `exercises` attribute (JSON array) in `plan:add` tags for gym days
- Format each exercise as `{ "name": "...", "sets": N, "reps": N, "weight": N, "unit": "lbs|kg" }` (weight/unit optional for body-weight exercises)
- Include 3-6 exercise targets per gym day
- Use the same format for `plan:update` when revising gym days
- Treat exercises as TARGETS (planned work), not completion records

An example `plan:add` with Bench Press, Shoulder Press, and Push-ups is shown in the prompt.

### Task 2 — Synthetic Context: Gym Session Exercise Logs (GYM-06)

Updated the plan-state line builder in `chat.ts` to branch on `run.discipline === 'gym'`:

- **Gym sessions:** `| Gym session DD/MM/YYYY | Exercises: Bench Press 3x8 @ 185lbs, Pull-ups 3x10`
- **Run/cycle sessions:** `| Ran: DD/MM/YYYY, Xkm @ M:SS/km` (unchanged)
- Notes, Insight, and RunId appended after discipline block for all session types
- Exercise list capped at 8 entries to prevent context token explosion

## Test Results

- API tests: 373 passed (33 test files)
- Web tests: 540 passed (39 test files)
- TypeScript build: exits 0
- New tests added: 4 prompts tests + 5 chat tests

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — exercises data flows from the Run document's `exercises` field (populated by Plan 03 gym session entry UI).

## Self-Check: PASSED

- `api/src/shared/prompts.ts` — exists with exercises instructions
- `api/src/functions/chat.ts` — exists with discipline-aware context enrichment
- `api/src/__tests__/prompts.test.ts` — exists with 4 new gym exercises tests
- `api/src/__tests__/chat.test.ts` — exists with 5 new gym context tests
- Commit f6963c3 — Task 1 (prompts)
- Commit 4feec6d — Task 2 (chat)
