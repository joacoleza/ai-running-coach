---
plan: 05-03
phase: 05-missing-features
status: complete
completed: 2026-04-11
---

## What Was Built

**`usePlan.ts`** — Added `addPhase(name?, description?)` to `UsePlanReturn` interface and implementation (POST /api/plan/phases, calls `refreshPlan` on success).

**`PlanView.tsx`** — Added `onAddPhase?: () => Promise<void>` prop. Changed `key={phase.name}` to `key={idx}` in phases.map to prevent duplicate key warnings. Added `+ Add phase` button after the phases loop (shown when not readonly and `onAddPhase` is provided).

**`TrainingPlan.tsx`** — Added inline target date editor to the plan header:
- `editingDate` state, `dateValue` state synced from `plan.targetDate`, `dateInputRef`
- `saveDate()` calls `PATCH /api/plan { targetDate }` then `refreshPlan()`; no change = no PATCH
- Escape reverts; Enter/blur saves; empty value clears date (passed as `""` → $unset in API)
- `+ Set target date` placeholder shown when no date is set
- `onAddPhase={addPhase}` wired into `PlanView`

Existing test mocks updated to include `addPhase: vi.fn()`.

## Key Files Modified

- `web/src/hooks/usePlan.ts`
- `web/src/components/plan/PlanView.tsx`
- `web/src/pages/TrainingPlan.tsx`
- `web/src/__tests__/TrainingPlan.test.tsx` (mock update)
- `web/src/__tests__/TrainingPlan.feedback.test.tsx` (mock update)
- `web/src/__tests__/TrainingPlan.scroll.test.tsx` (mock update)

## Self-Check: PASSED
- TypeScript build: ✓
- `text-[16px]` on date input prevents iOS auto-zoom: ✓
- No window.confirm on non-destructive add phase: ✓
- refreshPlan() called directly in saveDate (not plan-updated event): ✓
