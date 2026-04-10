---
status: resolved
trigger: "Adherence stat card on Dashboard shows meaningless value on date-based filters. Move to Training Plan view (near target date) and Archive plan detail."
created: 2026-04-09T00:00:00Z
updated: 2026-04-10T00:00:00Z
---

## Current Focus

hypothesis: Adherence is computed entirely in useDashboard.ts and rendered in Dashboard.tsx as a 4th stat card. It ignores the active filter's date range and always counts plan days against the full plan structure — making it meaningless outside current-plan mode. The fix is purely a relocation: remove the stat card + adherence computation from the dashboard layer, and surface the same metric (completed / total non-rest days) inside TrainingPlan.tsx and ArchivePlan.tsx where the plan is already fully available.
test: n/a — design/placement issue, no runtime error to reproduce
expecting: n/a
next_action: return diagnosis

## Symptoms

expected: Adherence is shown on Training Plan view (near target date) and archived plan detail — not on Dashboard.
actual: Adherence is a 4th stat card in the Dashboard grid. On date-based filters (last-4-weeks, etc.) the value is calculated as linkedRuns.size / totalNonRest, which counts all plan-linked runs ever logged against the full plan regardless of the selected date window — producing a misleading number.
errors: none
reproduction: Open Dashboard → note "Adherence" card → switch filter to "Last 4 weeks"
started: Discovered during Phase 4 UAT

## Eliminated

- hypothesis: useDashboard computes adherence differently per filter (date-window-scoped)
  evidence: computeStats() lines 186-199 — on non-current-plan filters it uses linkedRuns.size (all plan runs ever) / totalNonRest (all plan days ever). Not date-scoped. Confirmed meaningless.
  timestamp: 2026-04-09

## Evidence

- timestamp: 2026-04-09
  checked: web/src/hooks/useDashboard.ts lines 144-207
  found: countNonRestDays(), countCompletedNonRestDays() and computeStats() all live here. adherence field is in DashboardStats interface (line 10). computeStats receives (runs, plan, filter, linkedRuns) and computes adherence separately from the runs array — it uses plan structure counts directly, ignoring the date-filtered run list.
  implication: Adherence is logically decoupled from the date filter. Removing it from Dashboard requires: (1) deleting adherence from DashboardStats, (2) removing computeStats adherence branch, (3) removing the stat card JSX from Dashboard.tsx.

- timestamp: 2026-04-09
  checked: web/src/pages/Dashboard.tsx lines 78-99
  found: The grid is `grid-cols-2 md:grid-cols-4`. Fourth cell (lines 92-99) is the Adherence card — it has a role="button" click handler that navigates to /plan, and displays stats.adherence.
  implication: Removing the card collapses to 3 cells. Grid class must change to `grid-cols-2 md:grid-cols-3` (or keep cols-4 with 3 items and leave the last slot blank — but collapsing to cols-3 is cleaner).

- timestamp: 2026-04-09
  checked: web/src/pages/TrainingPlan.tsx lines 132-141
  found: The "objective + target date" block is inside the sticky header at lines 134-141. It is a blue info box (bg-blue-50) containing plan.objective and plan.targetDate. This is the correct insertion point for Adherence — underneath or alongside the target date within the same box.
  implication: Adherence for the active plan = countCompletedNonRestDays(plan) / countNonRestDays(plan). Both helper functions exist in useDashboard.ts — they are pure functions that only need a PlanData argument. They should be moved to a shared planUtils.ts or inlined in TrainingPlan.tsx / ArchivePlan.tsx.

- timestamp: 2026-04-09
  checked: web/src/pages/ArchivePlan.tsx lines 33-128
  found: ArchivePlan fetches the archived plan via GET /api/plans/archived/:id and stores it as local state `plan: PlanData | null`. The plan object has full phases/weeks/days structure identical to the active plan. There is no adherence displayed anywhere on this page.
  implication: Can compute adherence directly from plan state: same countCompleted/countTotal logic. No additional API call needed. Should display near the plan title or in a summary block.

- timestamp: 2026-04-09
  checked: web/src/hooks/usePlan.ts — PlanData interface
  found: PlanData.phases is PlanPhase[] → PlanWeek[] → PlanDay[]. PlanDay has completed: boolean and type: 'run'|'rest'|'cross-train' and label: string. countNonRestDays and countCompletedNonRestDays in useDashboard.ts already correctly traverse this structure.
  implication: No schema changes needed. The helper logic is immediately portable.

## Resolution

root_cause: Adherence was placed in the Dashboard as a 4th stat card (Dashboard.tsx:92-99, useDashboard.ts:184-199). The metric is plan-scoped, not time-window-scoped, making it semantically wrong inside a date-filtered dashboard. The two pure helper functions (countNonRestDays, countCompletedNonRestDays) that power it live only in useDashboard.ts.

fix: (1) Remove adherence field from DashboardStats interface and computeStats() in useDashboard.ts. (2) Remove the Adherence stat card JSX from Dashboard.tsx and adjust the grid to cols-3. (3) Export/move the two count helpers to a shared location (or duplicate inline). (4) Add an Adherence line inside the objective/target-date box in TrainingPlan.tsx (lines 134-141). (5) Add an Adherence line to ArchivePlan.tsx near the plan heading.

verification: empty
files_changed: []
