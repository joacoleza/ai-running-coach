---
phase: 12-delete-last-empty-week
verified: 2026-04-27T15:17:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 12: Delete Last Empty Week — Verification Report

**Phase Goal:** Allow users and the AI coach to remove trailing empty weeks from a training phase — symmetric inverse of the existing "+ Add week" / `<plan:add-week>` functionality. Guards prevent deleting weeks that contain any workout days.
**Verified:** 2026-04-27T15:17:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01 — Backend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DELETE /api/plan/phases/:phaseIndex/weeks/last removes last week when it has no non-rest days | VERIFIED | Handler at planPhases.ts:149 — slices `p.weeks.slice(0, -1)`, returns 200 with updated plan |
| 2 | Endpoint returns 400 when last week has any non-rest days | VERIFIED | planPhases.ts:179 — `lastWeek.days.some(d => d.type !== 'rest')` → 400 "Cannot delete a week that contains workout days" |
| 3 | Endpoint returns 400 when phase would be left with 0 weeks | VERIFIED | planPhases.ts:174 — `phase.weeks.length <= 1` → 400 "Cannot delete the only week in a phase" |
| 4 | Endpoint returns 404 when phaseIndex is out of bounds | VERIFIED | planPhases.ts:168 — `phaseIndex >= plan.phases.length` → 404 |
| 5 | Week numbers are globally recomputed via assignPlanStructure after deletion | VERIFIED | planPhases.ts:188 — `const recomputed = assignPlanStructure(updatedPhases)` called before findOneAndUpdate |

### Observable Truths (Plan 02 — Frontend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | "− week" button appears per phase, enabled only when last week has no non-rest days | VERIFIED | PlanView.tsx:248-281 — IIFE computes `lastWeekIsEmpty`, renders button disabled when false |
| 7 | Clicking "− week" shows window.confirm then calls DELETE endpoint | VERIFIED | PlanView.tsx:265-268 — `window.confirm(...)` guard → `void onDeleteLastWeek(idx)` |
| 8 | Plan refreshes automatically after successful deletion | VERIFIED | usePlan.ts:189 — `await refreshPlan()` called on success in `deleteLastWeek` callback |
| 9 | plan:delete-week chat tag is stripped and triggers the delete API call | VERIFIED | useChat.ts:209,252,264,289,460,567,702,896 — stripped in 4 locations; fetch loop at line 469 |

**Score:** 9/9 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/functions/planPhases.ts` | deleteLastWeekOfPhase handler | VERIFIED | Lines 149-202 — handler registered as `'deleteLastWeekOfPhase'`, route `plan/phases/{phaseIndex}/weeks/last`, method DELETE |
| `api/src/__tests__/planPhases.test.ts` | Unit tests for DELETE endpoint | VERIFIED | Lines 335-467 — `makeDeleteLastWeekReq` helper + 9-test describe block covering all guard conditions and happy paths |
| `web/src/hooks/usePlan.ts` | deleteLastWeek(phaseIndex) method | VERIFIED | Lines 180-190 — `deleteLastWeek` useCallback, interface line 59, return object line 210 |
| `web/src/components/plan/PlanView.tsx` | onDeleteLastWeek prop + "− week" button | VERIFIED | Interface line 132, destructured line 138, button rendered lines 262-279 |
| `web/src/pages/TrainingPlan.tsx` | Passes onDeleteLastWeek to PlanView | VERIFIED | Line 19 (destructures `deleteLastWeek`), line 269 (`onDeleteLastWeek={deleteLastWeek}`) |
| `web/src/hooks/useChat.ts` | plan:delete-week tag processing | VERIFIED | 4 strip sites + `deleteWeekRegex`/`deleteWeekMatches` + fetch loop in `applyPlanOperations` |
| `e2e/training-plan.spec.ts` | E2E tests for delete-last-week | VERIFIED | Lines 1284-1396 — two tests: button visible + DELETE fires on confirm; button disabled when last week has workout |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PlanView.tsx` | `usePlan.deleteLastWeek` | `onDeleteLastWeek` prop → TrainingPlan passes `deleteLastWeek` | WIRED | TrainingPlan.tsx:269 passes `onDeleteLastWeek={deleteLastWeek}` to PlanView |
| `useChat.ts` | `DELETE /api/plan/phases/:phaseIndex/weeks/last` | fetch in applyPlanOperations deleteWeek loop | WIRED | useChat.ts:469 — `fetch('/api/plan/phases/${phaseIndex}/weeks/last', { method: 'DELETE', ... })` |
| `planPhases.ts` | `planUtils.ts` | assignPlanStructure call after week removal | WIRED | planPhases.ts:188 — `const recomputed = assignPlanStructure(updatedPhases)` |
| `planPhases.test.ts` | `planPhases.ts` | `handlers.get('deleteLastWeekOfPhase')` | WIRED | planPhases.test.ts:378+ — all 9 tests call `handlers.get('deleteLastWeekOfPhase')!(req, ctx)` |

---

## Data-Flow Trace (Level 4)

Not applicable — this phase adds a mutation endpoint (DELETE) and a UI button. There is no read/render data flow to trace. The API returns the updated plan which is consumed by `refreshPlan()` → `setPlan()` in usePlan.ts — the standard plan refresh flow that was already verified in prior phases.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| API unit tests pass (341 total including 9 new DELETE endpoint tests) | `npm test` in api/ | 341 passed, 0 failed | PASS |
| Web unit tests pass (499 total including PlanView, usePlan, planUpdate coverage for phase 12) | `npm test` in web/ | 499 passed, 0 failed | PASS |
| TypeScript build clean | `npm run build` in web/ | 1069 modules, no errors | PASS |

E2E behavioral spot-check routed to human verification below (requires running browser).

---

## Requirements Coverage

| Requirement | Source Plan | Description (derived from plan must_haves) | Status | Evidence |
|-------------|------------|---------------------------------------------|--------|----------|
| WEEK-DELETE-01 | 12-01 | DELETE endpoint with guard conditions | SATISFIED | Handler at planPhases.ts:149-202 |
| WEEK-DELETE-02 | 12-01 | Unit tests for all endpoint guard conditions | SATISFIED | planPhases.test.ts:346-467, 9 tests |
| WEEK-DELETE-03 | 12-02 | usePlan.deleteLastWeek hook method | SATISFIED | usePlan.ts:180-190 |
| WEEK-DELETE-04 | 12-02 | PlanView "− week" button with disabled state | SATISFIED | PlanView.tsx:248-281 |
| WEEK-DELETE-05 | 12-02 | plan:delete-week chat tag + E2E test | SATISFIED | useChat.ts (4 sites) + e2e/training-plan.spec.ts:1284-1396 |

---

## Anti-Patterns Found

None found.

Scan summary:
- No TODO/FIXME/placeholder comments in modified files
- No empty return implementations — handler returns real DB result
- No hardcoded empty data flowing to rendering
- `deleteLastWeek` in usePlan.ts: the initial state check `!res.ok → throw` is correct guard behavior, not a stub
- `lastWeekIsEmpty` initialized `true` for zero-week phase is a defensive edge case, not a stub (guarded upstream by the API)

---

## Human Verification Required

### 1. E2E Browser Test — Delete Last Empty Week

**Test:** With a real running plan that has a phase with 2 weeks (last week empty), navigate to `/plan`, find the "− week" button, confirm the dialog, and verify the week disappears.
**Expected:** Button visible and enabled; clicking triggers a browser confirm dialog; after accept, the week is removed from the UI; plan refreshes to show correct week count.
**Why human:** Playwright tests use mocked API routes. Real DB interaction with actual plan data not exercised by automated tests.

### 2. E2E Browser Test — Disabled Button When Last Week Has Workout Days

**Test:** With a plan where the last week of a phase has a workout day, navigate to `/plan`, find the "− week" button.
**Expected:** Button is visible but disabled (grayed out) with title "Last week has workout days — cannot delete". Clicking does nothing.
**Why human:** E2E test mocks `loginWithPlan` — real DB interaction not tested.

---

## Gaps Summary

No gaps. All 9 must-haves verified across both plans.

---

_Verified: 2026-04-27T15:17:00Z_
_Verifier: Claude (gsd-verifier)_
