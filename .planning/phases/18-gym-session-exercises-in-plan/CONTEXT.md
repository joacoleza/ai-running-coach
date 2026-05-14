# Phase 18: Gym Session Exercises in Plan — Context

## What this phase is about

The original Phase 18 goal (exercise checklists on gym plan days) was delivered in Phase 14 as GYM-03/04/05. This phase now focuses on **exercise name consistency** — making it easy for names to stay the same across plan days and session logs so the dashboard can group exercise data reliably.

## Problem

The weight progression chart (`WeightProgressionChart`) groups data by exercise name string (case-sensitive exact match). If the coach writes "Bench Press" in a plan day but the user logs "bench press" or "Bench press" in their session, the chart shows them as two separate exercises. Same for typos or variations. There is no mechanism today to keep names consistent.

## Two requirements

### GYM-07 — Coach reuses logged exercise names in plan days

When Claude generates or updates a gym plan day via `<plan:add>` or `<plan:update>`, it should prefer exercise names the user has already logged. This requires:

1. A backend endpoint (or extend the existing `GET /api/runs/exercise-weights`) that returns the distinct exercise names the user has ever logged — no weight data, just names.
2. The system prompt injecting this list into Claude's context alongside the current plan state, so Claude can pick from real names when writing plan exercises.

Suggested endpoint: `GET /api/runs/exercise-names` → `{ names: string[] }` (sorted alphabetically, deduped, case-preserved from first occurrence).

### GYM-08 — Exercise name suggestion dropdown in manual entry form

When a user manually adds an exercise in `ExerciseForm` (the name `<input>` field), a dropdown appears showing previously-logged names that **contain** the typed string (case-insensitive). Selecting a suggestion populates the field. The dropdown dismisses on selection, Escape, or blur.

Implementation notes:
- Source: `GET /api/runs/exercise-names` — same endpoint as GYM-07, fetched once on `ExerciseList` mount (or `ExerciseForm` mount) and passed down as `exerciseNameSuggestions: string[]` prop.
- Filter client-side on each keystroke: `names.filter(n => n.toLowerCase().includes(typed.toLowerCase()))`.
- Show max 8 suggestions to avoid a massive dropdown.
- Keyboard navigation (↑/↓ to move, Enter to select) is a nice-to-have but not required for V1.
- Accessibility: use `role="listbox"` on the dropdown, `role="option"` on each item.

## Existing foundation (already done)

| Feature | Delivered in | Status |
|---------|-------------|--------|
| Exercise interface (`name`, `sets`, `reps`, `weight`, `unit`) | Phase 14 | ✅ Done |
| `ExerciseForm` component (manual exercise entry) | Phase 14 | ✅ Done |
| `ExerciseList` component (manages exercise list in RunDetailModal) | Phase 14 | ✅ Done |
| `ExerciseChecklistItem` in plan day DayRow | Phase 14 | ✅ Done |
| Coach generates gym plan days with exercises via XML tags | Phase 14 | ✅ Done |
| `GET /api/runs/exercise-weights` endpoint (existing) | Phase 16 | ✅ Done |
| Weight progression chart groups by exercise name | Phase 16 | ✅ Done |

## Key files to touch

- `api/src/functions/runs.ts` — add `GET runs/exercise-names` route (before `runs/{id}` wildcard)
- `api/src/shared/prompts.ts` — inject exercise name list into system prompt context (alongside plan state)
- `api/src/shared/chat.ts` — fetch exercise names and include in synthetic context injection
- `web/src/components/runs/ExerciseForm.tsx` — add name suggestion dropdown
- `web/src/components/runs/ExerciseList.tsx` — fetch exercise names on mount, pass to ExerciseForm

## Out of scope

- Forced name normalization (e.g. lowercasing all stored names) — too destructive to existing data
- A curated exercise library / catalog — free-text names stay free-text; suggestions are just a convenience
- Retroactive renaming of past exercises logged under different names

## Known bug to fix in this phase

### GYM-09 — WeightProgressionChart auto-select not working

`WeightProgressionChart` was built with a `defaultExercise` prop (Phase 21) intended to auto-select the most frequent exercise and load its data on mount — without the user having to touch the dropdown. This was verified passing in code review but confirmed **not working** in browser UAT (the chart renders but does not pre-select or load data automatically).

The bug is somewhere in the `useEffect` + `defaultExercise` → `handleExerciseSelect` flow inside `WeightProgressionChart.tsx`. Fix must be included in Phase 18 since this component is directly relevant to exercise name consistency work.

**Expected behavior:** When the Dashboard's Gym section loads and gym sessions with exercises exist, the Weight Progression chart immediately shows data for the most frequently logged exercise — no user interaction required.

## Open questions before planning

1. Should `exercise-names` deduplicate case-insensitively (e.g. "bench press" and "Bench Press" → return only "Bench Press")? Simpler UX but loses the user's original casing for the other variant.
2. Where does the exercise name list appear in the system prompt — as part of the synthetic plan-state context injection (in `chat.ts`) or baked into the static system prompt (in `prompts.ts`)? Dynamic injection in `chat.ts` is more accurate (always fresh) but adds one more DB query per message.
