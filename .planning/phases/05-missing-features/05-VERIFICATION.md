---
phase: 05-missing-features
verified: 2026-04-11T19:30:00Z
updated: 2026-04-28T00:00:00Z
status: passed
score: 10/10 must-haves verified
gaps: []
human_verification:
  - test: "Click '+ Add phase' on the Training Plan page"
    expected: "A new phase appears below the existing phases without a page reload"
    why_human: "E2E mock tests confirm the button/API wiring but cannot verify the React state update renders the new phase in DOM under real server conditions"
  - test: "Click the target date text, change the date in the picker, press Enter"
    expected: "The updated date appears immediately in the plan header"
    why_human: "Native date input interaction with browser picker is not reliably testable in automated E2E"
---

# Phase 5: Missing Features Verification Report

**Phase Goal:** Add missing features — POST /api/plan/phases, PATCH /api/plan targetDate, four new agent XML commands (plan:add-phase, plan:update-goal, run:create, run:update-insight), + Add phase UI button, inline target date editor.
**Verified:** 2026-04-11T19:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/plan/phases creates a new phase with correct sequential week numbers | ✓ VERIFIED | `addPhase` handler in `planPhases.ts` lines 63-100: calls `assignPlanStructure([...plan.phases, newPhase])`, returns 201 with updated plan |
| 2 | PATCH /api/plan accepts targetDate and saves or clears it | ✓ VERIFIED | `patchPlan` in `plan.ts` lines 120-158: `body.targetDate` handled; empty string triggers `$unset`, non-empty goes to `$set` |
| 3 | System prompt documents all four new XML commands with examples | ✓ VERIFIED | `prompts.ts`: `plan:add-phase`, `plan:update-goal`, `run:create`, `run:update-insight` all present with rules and examples |
| 4 | plan:add-phase tag is stripped from chat display during streaming and on history reload | ✓ VERIFIED | All three locations strip correctly: history reload, sendMessage onText, startPlan onText — unified via `stripAgentTags()` helper (fixed 2026-04-28) |
| 5 | plan:update-goal tag triggers PATCH /api/plan with targetDate and refreshes plan | ✓ VERIFIED | `applyPlanOperations` lines 421-438: fetches PATCH `/api/plan` with `{ targetDate: attrs.targetDate ?? '' }`, then fetchPlan + plan-updated dispatched |
| 6 | run:create tag triggers POST /api/runs and dispatches plan-updated when a day is linked | ✓ VERIFIED | `applyPlanOperations` lines 441-474: POSTs to `/api/runs` without `unit` field; `hasPlanMutation` includes `runCreateMatches.length > 0` so plan-updated dispatched |
| 7 | run:update-insight tag triggers PATCH /api/runs/:runId with insight (silent, no plan refresh) | ✓ VERIFIED | `applyPlanOperations` lines 477-498: PATCH to `/api/runs/${attrs.runId}`; `hasPlanMutation` does NOT include `runInsightMatches` so no plan-updated dispatched |
| 8 | PlanView shows a '+ Add phase' button and clicking it calls POST /api/plan/phases | ✓ VERIFIED | `PlanView.tsx` lines 248-254: button rendered when `!readonly && onAddPhase`; wired in `TrainingPlan.tsx` line 251 via `addPhase` from `usePlan` |
| 9 | Training Plan header shows inline target date editor | ✓ VERIFIED | `TrainingPlan.tsx` lines 26-111, 172-200: `editingDate` state, `saveDate` calls PATCH `/api/plan`, `+ Set target date` placeholder shown when no date |
| 10 | All new features have unit and E2E test coverage | ✓ VERIFIED | 16 new useChat unit tests in `useChat.trainingPlan.test.ts`; 3 new E2E tests in `training-plan.spec.ts`; API unit tests in `planPhases.test.ts` and `plan.test.ts` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/functions/planPhases.ts` | addPhase handler at POST plan/phases | ✓ VERIFIED | Handler present lines 63-100; `assignPlanStructure` called; returns 201 |
| `api/src/functions/plan.ts` | Extended patchPlan accepting targetDate | ✓ VERIFIED | `targetDate` in body type; `$unset` for empty string; `$set` otherwise |
| `api/src/shared/prompts.ts` | System prompt with all four new XML commands | ✓ VERIFIED | `plan:add-phase`, `plan:update-goal`, `run:create`, `run:update-insight` all documented |
| `api/src/functions/chat.ts` | RunId exposed in completed-day context | ✓ VERIFIED | Line 159: `line += \` | RunId: ${(run as any)._id.toString()}\`` |
| `web/src/hooks/useChat.ts` | Four new tag handlers in applyPlanOperations + strip in both locations | ✓ VERIFIED | applyPlanOperations: all four handlers present and correct. History load strip: correct. sendMessage onText strip: correct. startPlan onText strip: fixed via `stripAgentTags()` helper (2026-04-28) |
| `web/src/components/plan/PlanView.tsx` | Add phase button and onAddPhase prop wiring | ✓ VERIFIED | `onAddPhase` in `PlanViewProps`; button rendered at lines 248-254 |
| `web/src/hooks/usePlan.ts` | addPhase function exposed from hook | ✓ VERIFIED | `addPhase` in `UsePlanReturn`; implemented with `useCallback` at line 151; included in return object |
| `web/src/pages/TrainingPlan.tsx` | Inline target date editor in plan header | ✓ VERIFIED | `editingDate` state, `saveDate`, full inline editor JSX present |
| `api/src/__tests__/planPhases.test.ts` | addPhase handler unit tests | ✓ VERIFIED | `addPhase` describe block with 404/auto-name/custom-name/weekNumber tests |
| `api/src/__tests__/plan.test.ts` | targetDate save and clear unit tests | ✓ VERIFIED | Tests for save, $unset on empty, combined fields, 400 on no fields |
| `web/src/__tests__/useChat.trainingPlan.test.ts` | Four new tag handler unit tests | ✓ VERIFIED | `describe('sendMessage — phase 5 new tag handlers')` with 16 tests |
| `e2e/training-plan.spec.ts` | E2E tests for + Add phase and target date editing | ✓ VERIFIED | `test.describe('Phase 5 features — Add phase and target date editing')` with 3 tests |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `planPhases.ts addPhase` | `planUtils.assignPlanStructure` | `assignPlanStructure([...plan.phases, newPhase])` | ✓ WIRED | Line 87: called before DB update |
| `plan.ts patchPlan` | MongoDB plans collection | `$unset when targetDate empty string` | ✓ WIRED | Lines 138-145: `$unset` built and included in updateDoc |
| `useChat.ts applyPlanOperations` | `/api/plan/phases (POST)` | `addPhaseMatches loop` | ✓ WIRED | Lines 401-418: `fetch('/api/plan/phases', { method: 'POST' })` |
| `useChat.ts applyPlanOperations` | `/api/plan (PATCH)` | `updateGoalMatches loop with targetDate` | ✓ WIRED | Lines 421-438: `fetch('/api/plan', { method: 'PATCH', body: JSON.stringify({ targetDate }) })` |
| `useChat.ts applyPlanOperations` | `/api/runs (POST)` | `runCreateMatches loop` | ✓ WIRED | Lines 441-474: `fetch('/api/runs', { method: 'POST' })`; unit not forwarded |
| `useChat.ts applyPlanOperations` | `/api/runs/:runId (PATCH)` | `runInsightMatches loop` | ✓ WIRED | Lines 477-498: `fetch(\`/api/runs/${attrs.runId}\`, { method: 'PATCH' })` |
| `TrainingPlan.tsx` | `usePlan.ts addPhase` | `addPhase from usePlan passed as onAddPhase to PlanView` | ✓ WIRED | Line 16: destructured; line 251: passed as `onAddPhase={addPhase}` |
| `TrainingPlan.tsx saveDate` | `/api/plan (PATCH)` | `inline date editor saveDate() calling fetch` | ✓ WIRED | Lines 99-107: `fetch('/api/plan', { method: 'PATCH', body: JSON.stringify({ targetDate: trimmed }) })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PlanView.tsx` | `plan.phases` (renders + Add phase button) | `usePlan.ts` → GET `/api/plan` → MongoDB | Yes — `findOneAndUpdate` returns live document | ✓ FLOWING |
| `TrainingPlan.tsx` | `plan.targetDate` (inline editor) | `usePlan.ts` → GET `/api/plan` → MongoDB | Yes — `plan.targetDate` from DB document | ✓ FLOWING |
| `useChat.ts` | `addPhaseMatches` (applyPlanOperations) | Regex match on streamed API response text | Yes — live SSE stream from Anthropic API | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running server and real MongoDB connection to test API endpoints. Key behaviors verified via unit tests and E2E mocks.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FEAT-ADD-PHASE-API | 05-01 | POST /api/plan/phases creates new phase with sequential weeks | ✓ SATISFIED | `addPhase` handler in `planPhases.ts`; unit tested in `planPhases.test.ts` |
| FEAT-TARGET-DATE-API | 05-01 | PATCH /api/plan accepts targetDate save/clear | ✓ SATISFIED | `patchPlan` extended in `plan.ts`; unit tested in `plan.test.ts` |
| FEAT-AGENT-COMMANDS | 05-01 | System prompt documents all four XML commands | ✓ SATISFIED | `prompts.ts` has plan:add-phase, plan:update-goal, run:create, run:update-insight sections |
| FEAT-AGENT-ADD-PHASE | 05-02 | plan:add-phase tag processed in useChat | ✓ SATISFIED | `applyPlanOperations` addPhase loop; unit tested |
| FEAT-AGENT-TARGET-DATE | 05-02 | plan:update-goal tag triggers PATCH /api/plan | ✓ SATISFIED | `applyPlanOperations` updateGoal loop; unit tested |
| FEAT-AGENT-RUN-CREATE | 05-02 | run:create tag triggers POST /api/runs | ✓ SATISFIED | `applyPlanOperations` runCreate loop; unit NOT forwarded; unit tested |
| FEAT-AGENT-RUN-INSIGHT | 05-02 | run:update-insight tag triggers PATCH /api/runs/:runId | ✓ SATISFIED | `applyPlanOperations` runInsight loop; no plan-updated; unit tested |
| FEAT-ADD-PHASE-UI | 05-03 | + Add phase button in PlanView; usePlan.addPhase | ✓ SATISFIED | Button in `PlanView.tsx`; `addPhase` in `usePlan.ts`; wired in `TrainingPlan.tsx` |
| FEAT-TARGET-DATE-UI | 05-03 | Inline target date editor in TrainingPlan header | ✓ SATISFIED | Full inline editor with `editingDate`, `saveDate`, `+ Set target date` placeholder |
| FEAT-TEST-COVERAGE | 05-04 | Unit and E2E tests for all new behaviors | ✓ SATISFIED | 16 useChat unit tests; 3 E2E tests; API unit tests already in plan 01 |

### Anti-Patterns Found

None. The previously flagged pattern (missing strip chains in `startPlan` onText) was resolved by refactoring all strip logic into the shared `stripAgentTags()` helper (2026-04-28).

### Human Verification Required

#### 1. + Add phase button end-to-end

**Test:** Log in, navigate to Training Plan, scroll to bottom of plan, click "+ Add phase"
**Expected:** A new empty phase appears below existing phases within 1-2 seconds, no page reload
**Result:** ✅ PASSED (2026-04-28)

#### 2. Target date inline editor — save flow

**Test:** Click "Target: YYYY-MM-DD" in the plan header, change the date in the native picker, press Enter
**Expected:** Updated date appears in header immediately after save
**Result:** ✅ PASSED (2026-04-28)

### Gaps Summary

No gaps. All 10 must-haves verified.

**Gap closed 2026-04-28:** The `startPlan` onText strip gap was resolved by extracting all repeated tag-strip chains into a shared `stripAgentTags(text, streaming)` helper in `useChat.ts`. Both `sendMessage` and `startPlan` `onText` callbacks now call this helper uniformly — the symmetry requirement from plan 05-02 is fully satisfied.

---

_Verified: 2026-04-11T19:30:00Z — Gap closed: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
