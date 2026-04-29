---
phase: 13-discipline-foundation
plan: "03"
subsystem: api/system-prompt
tags: [prompts, discipline, multi-discipline, coaching, system-prompt]
dependency_graph:
  requires: [13-01]
  provides: [discipline-aware system prompt for Phase 14+ coach interactions]
  affects: [api/src/shared/prompts.ts, api/src/__tests__/prompts.test.ts]
tech_stack:
  added: []
  patterns: [discipline discriminator pattern (type=cross-train + discipline=gym|cycle)]
key_files:
  modified:
    - api/src/shared/prompts.ts
    - api/src/__tests__/prompts.test.ts
decisions:
  - Removed bold markers (** **) from discipline list items so test substring matching works
  - Fixed contradictory test assertion: not.toContain('type="gym"') scoped to plan:add examples rather than full prompt (Disciplines section legitimately mentions type="gym" in a warning)
metrics:
  duration: "~15 minutes"
  completed: "2026-04-29T23:50:00Z"
  tasks_completed: 1
  files_modified: 2
---

# Phase 13 Plan 03: System Prompt Discipline Update Summary

Updated buildSystemPrompt with multi-discipline coaching: added ## Disciplines section explaining run/gym/cycle taxonomy, discipline attribute in plan:add table, and type=cross-train discriminator pattern.

## What Was Built

**Task 1: Update system prompt with training coach identity and discipline instructions**
- Commit: `50f99ed`
- Files: `api/src/shared/prompts.ts`, `api/src/__tests__/prompts.test.ts`

The `prompts.ts` file already had the identity change (`AI training coach`) and `plan:add` examples with `discipline` attribute from plan 01. This plan added the missing `## Disciplines` section after the Training Plan Format block.

### Changes Made

**`api/src/shared/prompts.ts`:**
- Added `## Disciplines` section after the Training Plan Format block explaining the three discipline values: run, gym, cycle
- Section instructs Claude to use `type="cross-train" discipline="gym"` for gym days and `type="cross-train" discipline="cycle"` for cycling days
- Section explicitly warns: "Never use `type="gym"` or `type="cycle"` — these are not valid types"
- Discipline list items use plain text (not bold) to match test substring expectations

**`api/src/__tests__/prompts.test.ts`:**
- Fixed contradictory assertion: the test `instructs type=cross-train for gym and cycle days` previously used `not.toContain('type="gym"')` which would fail since the Disciplines section legitimately contains `type="gym"` in the "Never use" warning text
- Updated assertion to scope to plan:add examples: `not.toContain('<plan:add week="3" day="D" type="gym"')`

## Test Results

- `prompts.test.ts`: 31/31 tests pass
- Full API suite: 357/357 tests pass
- Web build: exits 0 (no TypeScript errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed contradictory test assertion in prompts.test.ts**
- **Found during:** Task 1 — TDD RED phase
- **Issue:** The plan called for both `expect(prompt).not.toContain('type="gym"')` AND `expect(prompt).toContain('Never use \`type="gym"\`...')`. These are logically incompatible: the "Never use" warning string contains `type="gym"` as a substring, so `not.toContain('type="gym"')` would always fail when the Disciplines section is present.
- **Fix:** Changed the `not.toContain` assertion to scope specifically to plan:add examples: `not.toContain('<plan:add week="3" day="D" type="gym"')`. This correctly verifies the plan:add table doesn't use invalid types while allowing the Disciplines section to reference those strings in warning text.
- **Files modified:** `api/src/__tests__/prompts.test.ts`
- **Commit:** `50f99ed`

**2. [Rule 1 - Bug] Removed bold markdown markers from discipline list items**
- **Found during:** Task 1 — GREEN phase
- **Issue:** The Disciplines section used `- **run** — running sessions` (with markdown bold), but the test expected `'run — running sessions'` as an exact substring. The bold markers `**` prevented the substring match.
- **Fix:** Changed discipline list items to plain text: `- run — running sessions` (etc.) to match test expectations exactly.
- **Files modified:** `api/src/shared/prompts.ts`
- **Commit:** `50f99ed`

## Known Stubs

None — all discipline coaching instructions are fully wired into the system prompt.

## Self-Check: PASSED
