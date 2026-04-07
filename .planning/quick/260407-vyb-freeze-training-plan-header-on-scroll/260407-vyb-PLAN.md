---
phase: quick-260407-vyb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/pages/TrainingPlan.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Training Plan title + PlanActions is always visible at the top while scrolling"
    - "Goal/target date card is always visible at the top while scrolling"
    - "Coach Feedback panel header is always visible while scrolling"
    - "The sticky header does not overlap the plan day rows (correct z-index and spacing)"
  artifacts:
    - path: "web/src/pages/TrainingPlan.tsx"
      provides: "Sticky header wrapping title, goal card, and coach feedback panel"
  key_links:
    - from: "web/src/pages/TrainingPlan.tsx sticky header"
      to: "AppShell main overflow-y-auto scroll container"
      via: "CSS position: sticky; top: 0 — sticks within the scrolling main element"
      pattern: "sticky top-0"
---

<objective>
Freeze the top section of the Training Plan page so it remains visible while scrolling through plan weeks/days.

Purpose: Long training plans (10+ weeks) require a lot of scrolling. The plan title, goal + target date, and Coach Feedback header are contextually useful at all scroll positions.
Output: A sticky header block in TrainingPlan.tsx containing the title row, objective card, and coach feedback panel, sitting above the scrollable PlanView.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@web/src/pages/TrainingPlan.tsx

AppShell scroll architecture:
- `<div className="flex h-[100dvh] overflow-hidden bg-gray-50">` — outer container, no scroll
- `<main className="flex-1 overflow-y-auto">` — the actual scroll container
- TrainingPlan renders inside `<main>`, so `position: sticky; top: 0` works correctly here

Current TrainingPlan structure (inside `<div className="p-6">`):
1. Title row: `<div className="flex items-center gap-3 mb-4">` — h1 + PlanActions
2. Error block (conditional)
3. Objective card: `<div className="mb-4 p-4 bg-blue-50 ...">` — only when hasActivePlan
4. Coach Feedback panel: `<div className="mt-2 mb-4 border ...">` — only when hasActivePlan
5. PlanView (long scrollable content)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wrap header elements in sticky container</name>
  <files>web/src/pages/TrainingPlan.tsx</files>
  <action>
In TrainingPlan.tsx, restructure the JSX so the top section is sticky:

1. Change the outer `<div className="p-6">` to `<div>` (remove padding — move it to children so sticky header gets full width).

2. Create a sticky header wrapper immediately inside:
   ```tsx
   <div className="sticky top-0 z-10 bg-gray-50 px-6 pt-6 pb-2 border-b border-gray-100">
   ```
   Inside this sticky div, place:
   - The title row (`<div className="flex items-center gap-3 mb-4">` with h1 + PlanActions)
   - The error block (keep it here — it's above the plan content)
   - The objective card (inside the `hasActivePlan` check)
   - The Coach Feedback panel (inside the `hasActivePlan` check)

3. Below the sticky div, create a scrollable content area:
   ```tsx
   <div className="px-6 pt-4 pb-6">
   ```
   Inside this div, place:
   - The PlanView component
   - The onboarding/empty-state paragraph
   - The RunDetailModal (it's a modal, position doesn't matter, leave at bottom)

Key details:
- `bg-gray-50` matches AppShell's main background (`bg-gray-50`) so the sticky header blends in when scrolling
- `z-10` ensures it sits above plan day rows (DayRow dropdowns/buttons use no explicit z-index)
- `border-b border-gray-100` gives a subtle visual separator when content scrolls underneath
- Keep `pb-2` on sticky header (tight) — the objective card and feedback panel already have their own bottom margin
- Keep `pt-4` on the content div below so PlanView has breathing room from the sticky header

Do not change any logic, state, or event handlers — this is a structural/styling-only change.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>
    TypeScript build passes with no errors.
    Visually: title, goal card, and coach feedback header remain visible at the top of the viewport as the user scrolls down through plan weeks.
    The sticky header background covers scrolled-under content cleanly (no bleed-through).
  </done>
</task>

</tasks>

<verification>
After the build passes:
1. Open the app at http://localhost:5173/plan
2. With a multi-week active plan, scroll down past week 3+
3. Confirm "Training Plan" title, objective card, and "Coach Feedback" panel header are still visible at the top
4. Confirm plan day rows scroll underneath the sticky header cleanly
5. Confirm no visual artifacts (white flash, z-index bleed from dropdowns)
</verification>

<success_criteria>
- `npm run build` passes with no TypeScript errors
- Sticky header contains: title + PlanActions, objective card, Coach Feedback panel
- PlanView content scrolls underneath the frozen header
- Background color matches page (no jarring white box)
</success_criteria>

<output>
After completion, create `.planning/quick/260407-vyb-freeze-training-plan-header-on-scroll/260407-vyb-SUMMARY.md`
</output>
