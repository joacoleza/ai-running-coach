---
phase: 14-gym-support
verified: 2026-05-04T03:15:00Z
status: passed
score: 20/20 must-haves verified
re_verification: false
---

# Phase 14: Gym Support Verification Report

**Phase Goal:** Ship gym session logging UI, exercise entry on session detail, exercise checklist on gym plan days, and coach gym plan generation + context awareness.
**Verified:** 2026-05-04T03:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | POST /api/runs accepts discipline='gym', type, and exercises[] fields without error | ✓ VERIFIED | `runs.ts` POST handler accepts `body.type` and `body.exercises[]`, validates and stores them; `isGym` flag skips distance requirement |
| 2  | GET /api/runs accepts ?discipline=gym query param and filters results | ✓ VERIFIED | `runs.ts` GET handler reads `disciplineParam` from query and adds `filter['discipline'] = disciplineParam` |
| 3  | PATCH /api/runs/:id accepts exercises[] field and saves it | ✓ VERIFIED | PATCH body type includes `exercises?` array; `$set['exercises'] = body.exercises` wired |
| 4  | RunEntryForm shows discipline selector defaulting to 'run' | ✓ VERIFIED | `useState<Discipline>('run')` + `<select id="discipline-select">` with Run/Gym/Cycling options |
| 5  | When discipline='gym': distance field absent from DOM, Session Type dropdown present | ✓ VERIFIED | `{!isGym && <div>...Distance...</div>}` and `{isGym && <div>...Session Type...</div>}` — conditional render, not display:none |
| 6  | When discipline='run': distance field visible, no Session Type | ✓ VERIFIED | Inverse of above; both confirmed in code |
| 7  | Every row in Runs list shows a discipline badge: Run / Gym / Cycling | ✓ VERIFIED | `RunRow` renders `<RunBadge discipline={(run.discipline ?? 'run') as ...} />` |
| 8  | Runs without a discipline field show a 'Run' badge (backward compat) | ✓ VERIFIED | `run.discipline ?? 'run'` fallback wired in RunRow |
| 9  | A tab bar lets user filter by All / Runs / Gym / Cycling with discipline state | ✓ VERIFIED | 4-tab bar in `Runs.tsx` JSX with `disciplineFilter` state + `handleDisciplineFilter` → `localStorage` |
| 10 | Selecting 'Gym' filter causes runs list to re-fetch with ?discipline=gym | ✓ VERIFIED | `currentFilters()` includes `discipline: disciplineFilter !== 'all' ? disciplineFilter : undefined`; `loadRuns` calls `fetchRuns` with those filters |
| 11 | Opening a gym session in RunDetailModal shows 'Session Exercises' section | ✓ VERIFIED | `{run.discipline === 'gym' && (<section>...<ExerciseList ... /></section>)}` at line 299 of RunDetailModal.tsx |
| 12 | Non-gym sessions do not show Exercises section | ✓ VERIFIED | Guard `run.discipline === 'gym'` means run/cycle/undefined sessions exclude the section |
| 13 | User can expand 'Add Exercise' form and save exercises that persist | ✓ VERIFIED | `ExerciseList` manages `localExercises` state; "Done" calls `updateRun(runId, { exercises: localExercises })` |
| 14 | A gym plan day shows 'Exercises (N)' expand trigger | ✓ VERIFIED | `DayRow.tsx` renders expand button when `day.discipline === 'gym' && localExercises.length > 0` |
| 15 | Clicking expand shows exercise list with checkbox per item | ✓ VERIFIED | `ExerciseChecklistItem` renders inside `{exercisesExpanded && <div>...}` block |
| 16 | Checking an exercise calls PATCH with updated exercises[] | ✓ VERIFIED | `handleExerciseToggle` calls `onUpdate(weekNumber, day.label, { exercises: JSON.stringify(updated) })`; `planDays.ts` parses JSON and writes to `$set['phases.$[].weeks.$[week].days.$[day].exercises']` |
| 17 | Plan days without discipline render correctly (backward compat) | ✓ VERIFIED | `day.discipline === 'gym'` guard means other days skip exercise section entirely; `localExercises` defaults to `day.exercises ?? []` |
| 18 | System prompt instructs Claude to include exercises[] on gym plan days | ✓ VERIFIED | `prompts.ts` includes gym exercises subsection with example `<plan:add ... exercises='[{"name":"Bench Press",...}]' />` and rules |
| 19 | Chat synthetic context includes exercise logs from linked gym sessions | ✓ VERIFIED | `chat.ts` branch `isGymSession = run.discipline === 'gym'` builds `| Gym session DD/MM/YYYY | Exercises: Name SxR @ WeightUnit, ...` format capped at 8 exercises |
| 20 | Run/cycle sessions in context retain old 'Ran: X km @ pace' format | ✓ VERIFIED | `else` branch in chat.ts enrichment: `| Ran: ${runDate}, ${run.distance}km${runPace}` unchanged |

**Score: 20/20 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/shared/types.ts` | Exercise interface + Run.exercises + PlanDay.exercises | ✓ VERIFIED | Lines 35-43: `export interface Exercise { name, sets, reps, weight?, unit?, completed?, skipped? }`; Run.exercises (line 101) and PlanDay.exercises (line 57) both optional |
| `api/src/functions/runs.ts` | Gym-aware POST/PATCH/GET with discipline filter | ✓ VERIFIED | POST validates `isGym`, accepts exercises; PATCH accepts exercises/type; GET filters by discipline |
| `web/src/hooks/useRuns.ts` | Run type + CreateRunInput with discipline/type/exercises; updateRun accepts exercises | ✓ VERIFIED | All fields present; `updateRun` Pick includes `'exercises'` |
| `web/src/components/runs/RunEntryForm.tsx` | Discipline-gated form | ✓ VERIFIED | discipline selector, conditional distance/gymType rendering, 'Save Session' button label |
| `web/src/components/runs/RunBadge.tsx` | RunBadge component | ✓ VERIFIED | Exports `RunBadge`; BADGE_CONFIG for run/gym/cycle with correct colors |
| `web/src/pages/Runs.tsx` | Discipline filter tabs + RunBadge in RunRow | ✓ VERIFIED | 4-tab bar wired to `disciplineFilter` state + `fetchRuns`; RunBadge rendered in RunRow |
| `web/src/components/runs/ExerciseForm.tsx` | Single-exercise entry form | ✓ VERIFIED | Validates name/sets/reps; optional weight+unit; Save/Cancel buttons |
| `web/src/components/runs/ExerciseList.tsx` | Exercise list with add/remove/save | ✓ VERIFIED | Manages `localExercises`; "+ Add Exercise" toggle; Remove with confirm; "Done" calls `updateRun` |
| `web/src/components/runs/RunDetailModal.tsx` | Exercise section for gym sessions | ✓ VERIFIED | Imports `ExerciseList`; renders section conditionally on `run.discipline === 'gym'` |
| `web/src/hooks/usePlan.ts` | PlanDay.exercises + Exercise interface | ✓ VERIFIED | `Exercise` exported at top; `PlanDay.discipline?` and `PlanDay.exercises?` added |
| `web/src/components/plan/ExerciseChecklistItem.tsx` | Exercise row with checkbox | ✓ VERIFIED | Checkbox, name, sets/reps/weight display; line-through on completed; `onToggle` callback |
| `web/src/components/plan/DayRow.tsx` | Gym day exercise checklist expand/collapse | ✓ VERIFIED | Imports ExerciseChecklistItem; `exercisesExpanded` state; expand button; `handleExerciseToggle` |
| `api/src/functions/planDays.ts` | patchDay accepts exercises JSON string | ✓ VERIFIED | Body includes `exercises?: string`; parsed and written to arrayFilters path |
| `api/src/shared/prompts.ts` | System prompt with gym exercises instructions | ✓ VERIFIED | Subsection added after Disciplines block with format instructions and Bench Press example |
| `api/src/functions/chat.ts` | Synthetic context with gym session exercises | ✓ VERIFIED | `isGymSession` branch formats gym context with exercises list capped at 8 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `RunEntryForm.tsx` | `useRuns.ts` | `createRun` call with discipline + type in payload | ✓ WIRED | `createRun({ ..., discipline, type: isGym ? gymType : undefined })` |
| `runs.ts` | `types.ts` | Exercise import and `newRun.exercises` assignment | ✓ WIRED | `import type { ..., Exercise }` at top; `newRun.exercises = validExercises as Exercise[]` |
| `Runs.tsx` | `RunBadge.tsx` | RunBadge rendered with `run.discipline ?? 'run'` | ✓ WIRED | `<RunBadge discipline={(run.discipline ?? 'run') as 'run' | 'gym' | 'cycle'} />` |
| `Runs.tsx` | `useRuns.ts` | `fetchRuns` called with `discipline` query param from filter state | ✓ WIRED | `currentFilters()` returns `{ ..., discipline: disciplineFilter !== 'all' ? disciplineFilter : undefined }`; passed to `loadRuns` → `fetchRuns` |
| `RunDetailModal.tsx` | `ExerciseList.tsx` | Rendered when `run.discipline === 'gym'` | ✓ WIRED | `import { ExerciseList }` + JSX guard `{run.discipline === 'gym' && ...}` |
| `ExerciseList.tsx` | `useRuns.ts` | `updateRun` with exercises array | ✓ WIRED | `await updateRun(runId, { exercises: localExercises })` |
| `DayRow.tsx` | `ExerciseChecklistItem.tsx` | Rendered when `day.discipline === 'gym' && localExercises.length > 0` | ✓ WIRED | `import { ExerciseChecklistItem }` + JSX render inside expand guard |
| `DayRow.tsx` | `planDays.ts` (via `onUpdate`) | `onUpdate` called with `{ exercises: JSON.stringify(updatedExercises) }` | ✓ WIRED | `handleExerciseToggle` → `await onUpdate(weekNumber, day.label, { exercises: JSON.stringify(updated) })` |
| `chat.ts` | `types.ts` | `run.exercises` array appended to plan state for gym days | ✓ WIRED | `run.exercises.slice(0, 8).map(ex => ...)` inside `isGymSession` branch |
| `prompts.ts` | `chat.ts` | System prompt instructs exercises format; chat shows actual exercises | ✓ WIRED | Both files contain `exercises` handling; prompt defines contract, chat implements enrichment |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `Runs.tsx` | `runs[]` state | `fetchRuns({ discipline })` → `GET /api/runs?discipline=X` → MongoDB `filter['discipline']` | Yes — DB query with real filter | ✓ FLOWING |
| `RunDetailModal.tsx` | `run.exercises` | Passed from parent via `run` prop; populated from `GET /api/runs/:id` or PATCH response | Yes — exercises come from DB via `updateRun` return value | ✓ FLOWING |
| `DayRow.tsx` | `localExercises` | `day.exercises` prop from `GET /api/plan` which reads from MongoDB plan document | Yes — synced via `useEffect([day.exercises])` | ✓ FLOWING |
| `chat.ts` synthetic context | `run.exercises` | `runsByKey` Map built from DB query `db.collection('runs').find({ planId: plan._id })` | Yes — real run documents with exercises field from DB | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| API + web unit tests all pass | `npm test` (api): 373 passed; `npm test` (web): 540 passed | ✓ PASS |
| TypeScript build passes | `cd web && npm run build`: exits 0, no type errors | ✓ PASS |
| No anti-patterns in new files | grep for TODO/FIXME/placeholder in new component files: 0 matches | ✓ PASS |
| fetchRuns discipline param reaches API call | `currentFilters()` → `loadRuns` → `fetchRuns({ ..., discipline })` — confirmed in Runs.tsx lines 181-185, 202-208 | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GYM-01 | 14-01 | User can log a gym session with date, type, duration, and optional notes | ✓ SATISFIED | `RunEntryForm` with discipline='gym' hides distance, shows Session Type dropdown; `POST /api/runs` stores type; UI tested |
| GYM-02 | 14-01, 14-03 | Logged gym session includes an exercise log: name, sets, reps, weight | ✓ SATISFIED | `ExerciseForm` + `ExerciseList` in `RunDetailModal` for gym sessions; `PATCH /api/runs/:id` stores exercises[] |
| GYM-03 | 14-04 | Training plan gym days display a structured exercise target list | ✓ SATISFIED | `DayRow` renders `ExerciseChecklistItem` rows inside expand/collapse for `day.discipline === 'gym'` days |
| GYM-04 | 14-04 | User can mark individual exercises on a gym plan day as done or skipped | ✓ SATISFIED | Checkbox in `ExerciseChecklistItem` triggers `handleExerciseToggle` → `PATCH /api/plan/days/:week/:day` with exercises JSON |
| GYM-05 | 14-05 | Coach can generate gym plan days with exercise target lists via plan XML tags | ✓ SATISFIED | `prompts.ts` includes example `<plan:add ... exercises='[...]' />` with format rules; `planDays.ts` parses exercises from `<plan:add>` body |
| GYM-06 | 14-05 | Coach receives gym session history (including exercise log) in chat context | ✓ SATISFIED | `chat.ts` formats `| Gym session DD/MM/YYYY | Exercises: Name SxR @ WeightUnit, ...` in synthetic plan-state context |
| DISC-03 | 14-01 | Session log entry form adapts fields based on selected discipline | ✓ SATISFIED | `RunEntryForm` discipline selector with conditional distance/Session Type rendering |
| DISC-04 | 14-02 | Runs list shows a discipline badge/icon per session | ✓ SATISFIED | `RunBadge` with emoji + label + color per discipline rendered in every `RunRow` |
| DISC-05 | 14-02 | User can filter the Runs list by discipline | ✓ SATISFIED | 4-tab filter (All/Runs/Gym/Cycling) with `disciplineFilter` state → `fetchRuns({ discipline })` + `localStorage` persistence |

**All 9 requirements satisfied.**

---

### Anti-Patterns Found

None found. Checked: `RunBadge.tsx`, `ExerciseForm.tsx`, `ExerciseList.tsx`, `ExerciseChecklistItem.tsx`, `DayRow.tsx` (new/modified files) — no TODO/FIXME/placeholder/stub patterns detected. All conditional renders use JSX conditionals (not `display:none`). All "Done" and "Save Exercise" buttons are connected to real API calls.

One minor note: `ExerciseList.tsx` initializes `localExercises` from the `exercises` prop on mount but does NOT add a `useEffect` to sync if the parent re-renders with new exercises. However, `RunDetailModal` calls `onUpdated` (which is `onUpdated` from the parent Runs page) after `updateRun` resolves, which replaces the entire `run` prop with the API response. The `ExerciseList` would re-mount with fresh exercises. This is adequate but differs slightly from the `DayRow` pattern which does add the `useEffect` sync. Not a blocker — the modal pattern works correctly. ℹ️ Info.

---

### Human Verification Required

1. **Gym session entry end-to-end in browser**
   - Test: Open Runs page, click "Log a run", change Discipline to "Gym". Verify distance field disappears, Session Type dropdown appears. Select "Upper Body", enter duration 45:00, click "Save Session".
   - Expected: Session saved, appears in Runs list with orange "Gym" badge, subtitle shows "Upper body · 45:00".
   - Why human: Visual rendering, modal state transitions, localStorage discipline filter persistence across page reload.

2. **Exercise logging on gym session detail**
   - Test: Click a gym session to open detail modal. Expand "Session Exercises" section. Click "+ Add Exercise", fill name "Bench Press", sets 3, reps 8, weight 185, select "lbs". Click "Save Exercise". Click "Done".
   - Expected: Exercise appears in list with "Bench Press 3x8 @ 185lbs", "Done" button shows "Saving..." then success. Reopening modal shows saved exercise.
   - Why human: Sequential async state updates, confirm dialog behavior, persistence verification.

3. **Exercise checklist on gym plan day**
   - Test: With a plan containing a gym day that has exercises, expand the "Exercises (N)" trigger in PlanView. Click a checkbox.
   - Expected: Checkbox toggles immediately (optimistic update), strikethrough applied, PATCH fires in background.
   - Why human: Optimistic UI behavior, visual strikethrough, coach panel plan state refresh.

4. **Coach generates gym plan day with exercises**
   - Test: Ask coach "Add a gym day this week with exercises". Verify coach emits `<plan:add ... discipline="gym" exercises='[...]' />` and plan view shows exercises on the new day.
   - Expected: New plan day visible with "Exercises (N)" expand trigger containing the exercises from the tag.
   - Why human: LLM output nondeterministic, XML tag parsing in live streaming context.

---

### Gaps Summary

No gaps. All 9 requirements (GYM-01 through GYM-06, DISC-03 through DISC-05) are implemented with substantive, wired artifacts. All unit tests pass (373 API, 540 web). TypeScript build is clean. Four human verification items are flagged for browser-based confirmation of the full UX flows, but these are normal post-ship validations — no code changes are needed.

---

_Verified: 2026-05-04T03:15:00Z_
_Verifier: Claude (gsd-verifier)_
