---
phase: quick-260407-wjz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - api/src/functions/plan.ts
  - api/src/functions/chat.ts
  - web/src/components/runs/RunDetailModal.tsx
  - web/src/components/runs/RunEntryForm.tsx
  - web/src/components/plan/PlanView.tsx
  - web/src/components/plan/DayRow.tsx
  - web/src/components/plan/PlanActions.tsx
  - web/src/hooks/usePlan.ts
  - web/src/pages/TrainingPlan.tsx
  - web/src/pages/Runs.tsx
  - web/src/index.css
autonomous: true
requirements: []

must_haves:
  truths:
    - "GET /api/plan returns linked run documents embedded in the response (no extra client fetch needed)"
    - "chat.ts synthetic plan state includes run notes (truncated to 100 chars) alongside insight"
    - "All buttons and interactive elements show cursor-pointer (global CSS rule enforces this)"
    - "Log run modal has an X close button at top-right; RunDetailModal delete uses window.confirm"
    - "DayRow delete uses window.confirm instead of inline confirm state"
    - "progressFeedback renders markdown via ReactMarkdown on TrainingPlan page"
    - "Distance field in RunDetailModal has consistent width with other fields on mobile"
  artifacts:
    - path: "api/src/functions/plan.ts"
      provides: "GET /api/plan returns plan with linkedRuns map"
    - path: "api/src/functions/chat.ts"
      provides: "Synthetic plan state includes notes field"
    - path: "web/src/index.css"
      provides: "Global cursor-pointer rule for button/a/[role=button]"
    - path: "web/src/pages/TrainingPlan.tsx"
      provides: "progressFeedback rendered via ReactMarkdown"
  key_links:
    - from: "api/src/functions/plan.ts"
      to: "web/src/hooks/usePlan.ts"
      via: "GET /api/plan response shape change"
      pattern: "linkedRuns"
    - from: "web/src/components/plan/PlanView.tsx"
      to: "GET /api/runs"
      via: "remove client-side linked run fetch"
      pattern: "fetchLinkedRuns"
---

<objective>
Nine targeted UI polish and LLM context improvements: server-side linked runs, notes in LLM context, global cursor-pointer, confirmation dialog consistency, modal X button, markdown coaching feedback, mobile distance field width fix, and run notes passed to insight generation.

Purpose: Improve UX consistency (cursor, confirms, modals) and coaching quality (notes in context).
Output: Patched API response, updated components, global CSS rule.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Server-side linked runs in GET /api/plan + notes in LLM context</name>
  <files>api/src/functions/plan.ts, api/src/functions/chat.ts, web/src/components/plan/PlanView.tsx, web/src/hooks/usePlan.ts</files>
  <action>
**api/src/functions/plan.ts — embed linked runs in GET /api/plan response:**

After fetching the active plan, fetch all runs from the `runs` collection where `planId === plan._id`. Build a map `Record<string, Run>` keyed by `"weekNumber-dayLabel"`. Include it in the response as `linkedRuns`. Update the return to `{ plan, linkedRuns }`.

Import `Run` type from `../shared/types.js` (or inline the needed fields: `_id, weekNumber, dayLabel, date, distance, pace, duration, avgHR, notes, insight`).

**web/src/hooks/usePlan.ts — consume linkedRuns from GET /api/plan:**

Update the `fetchPlan` function to parse `data.linkedRuns` (a `Record<string, Run>` object, not a Map — Maps don't serialize to JSON). Store as state `linkedRuns: Map<string, Run>` (convert the plain object to a Map on parse). Export `linkedRuns` from the hook. Trigger re-build when `plan-updated` fires (same as the existing pattern — already handled by `refreshPlan`).

Import `Run` type from `./useRuns`.

**web/src/components/plan/PlanView.tsx — remove client-side runs fetch, consume from prop:**

Remove the `useState(new Map())` for `linkedRuns`, remove the `fetchLinkedRuns` useCallback and both useEffects that call it (the mount effect and the `plan-updated` event listener). Remove the `refreshKey` state.

Add a `linkedRuns: Map<string, Run>` prop to `PlanViewProps`. Use it directly where `linkedRuns.get(dayKey)` was called.

**web/src/pages/TrainingPlan.tsx — pass linkedRuns to PlanView:**

Destructure `linkedRuns` from `usePlan()`. Pass `linkedRuns={linkedRuns}` to `<PlanView>`.

**api/src/functions/chat.ts — append notes to synthetic plan state:**

In the completed-day line builder (around line 145, where `run.insight` is appended), also append notes if present:

```typescript
if (run.notes) {
  const truncatedNotes = run.notes.length > 100
    ? run.notes.slice(0, 100) + '...'
    : run.notes;
  line += ` | Notes: ${truncatedNotes}`;
}
```

Add this BEFORE the insight append (so order is: Ran date/dist/pace → Notes → Insight).
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/api && npm test -- --reporter=verbose 2>&1 | tail -20 && cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -10</automated>
  </verify>
  <done>GET /api/plan returns { plan, linkedRuns }. PlanView no longer makes a separate /api/runs fetch on mount. chat.ts synthetic context includes Notes field for completed days that have notes. TypeScript build passes.</done>
</task>

<task type="auto">
  <name>Task 2: UI consistency — confirm dialogs, modal X, markdown feedback, cursor, mobile width</name>
  <files>web/src/components/runs/RunDetailModal.tsx, web/src/components/plan/DayRow.tsx, web/src/components/plan/PlanActions.tsx, web/src/pages/Runs.tsx, web/src/pages/TrainingPlan.tsx, web/src/index.css</files>
  <action>
**web/src/index.css — global cursor-pointer rule:**

Add after the existing media query:

```css
/* All interactive elements use pointer cursor */
button,
a,
[role="button"] {
  cursor: pointer;
}
```

This enforces cursor-pointer globally. Individual `cursor-pointer` classes on buttons can remain (they're harmless duplicates). Remove any `cursor-not-allowed` overrides for disabled buttons if they conflict — actually keep `disabled:cursor-not-allowed` class-level overrides as they will still win via specificity when applied directly.

**web/src/components/runs/RunDetailModal.tsx — replace inline confirm state with window.confirm:**

Remove `const [confirmDelete, setConfirmDelete] = useState(false)` and `const [confirmUnlink, setConfirmUnlink] = useState(false)`.

In `handleDelete`: replace the `if (!confirmDelete) { setConfirmDelete(true); return; }` guard with `if (!window.confirm('Delete this run? This cannot be undone.')) return;`. Remove the `setConfirmDelete(false)` after failure too. 

In `handleUnlink`: same pattern — replace `if (!confirmUnlink) { setConfirmUnlink(true); return; }` with `if (!window.confirm('Unlink this run from the training plan day? The day will be marked incomplete.')) return;`.

Clean up the JSX: remove the `confirmDelete ? (...)` and `confirmUnlink ? (...)` conditional branches in the button area. Replace with a single "Delete run" button (red text, no confirmation UI needed since window.confirm handles it) and a single "Unlink" button.

The delete button when `run.planId` is set (disabled/tooltip) should remain as-is.

**web/src/components/plan/DayRow.tsx — replace inline confirm state with window.confirm:**

Remove `const [confirmingDelete, setConfirmingDelete] = useState(false)`.

In the delete handler (`handleDelete` or inline), replace the two-step confirm with:
```typescript
if (!window.confirm('Delete this training day? This cannot be undone.')) return;
await onDelete(weekNumber, day.label);
```

Remove all `confirmingDelete` references from JSX — simplify the delete button area. The button should always be visible (per CLAUDE.md: "Undo and Delete buttons are always visible").

**web/src/pages/Runs.tsx — add X close button to Log run modal:**

In the Log run modal wrapper (around line 310), update the modal header to include an X button:

```tsx
<div className="flex items-center justify-between mb-3">
  <h2 className="font-semibold text-gray-900">Log a run</h2>
  <button
    onClick={() => setShowLogForm(false)}
    className="text-gray-400 hover:text-gray-600 text-xl leading-none"
    aria-label="Close"
  >
    &times;
  </button>
</div>
```

Remove the standalone `<h2>` that was there before.

**web/src/pages/TrainingPlan.tsx — render progressFeedback as markdown:**

Replace the `plan.progressFeedback.split('\n\n').map(...)` paragraph renderer with:

```tsx
import ReactMarkdown from 'react-markdown';
// ...
<ReactMarkdown>{plan.progressFeedback}</ReactMarkdown>
```

Add `import ReactMarkdown from 'react-markdown';` at the top of the file if not already present.

**web/src/components/runs/RunDetailModal.tsx — fix distance field mobile width:**

The distance field uses `flex items-center gap-2` with `<input className="flex-1 ...">` and a `<span>km</span>`. The issue is the "km" label is inline causing the input to be shorter than other full-width fields when the flex container spans the grid cell. Fix: wrap the distance field the same way as Duration and other single-column fields — use `w-full` on the input and remove the flex wrapper, placing "km" as a suffix label below or using a relative positioned overlay instead:

```tsx
<div className="relative">
  <input
    type="number"
    ...
    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">km</span>
</div>
```

Same fix for the Avg HR field which also uses `flex items-center gap-2` with a `bpm` label — use `relative` + `absolute` label approach for consistency.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -10</automated>
  </verify>
  <done>All buttons show pointer cursor. Log run modal has X. Delete run and DayRow delete use window.confirm. progressFeedback renders markdown. Distance/HR fields are equal width in the 2-col grid. TypeScript build passes.</done>
</task>

<task type="auto">
  <name>Task 3: Pass run notes to insight prompt + run tests</name>
  <files>web/src/components/runs/RunDetailModal.tsx</files>
  <action>
**web/src/components/runs/RunDetailModal.tsx — notes already in insight prompt (verify and fix if needed):**

Check the `handleGetInsight` function around line 113. It already builds:
```typescript
const notesStr = run.notes ? `, notes: "${run.notes}"` : '';
```
and includes it in the prompt. This is already implemented. Verify it uses `editNotes` (current state) rather than `run.notes` so unsaved note edits are included in the insight request. If it uses `run.notes`, change to `editNotes` so the user can type notes and immediately get an insight without saving first.

Then run the full test suite to verify all changes from Tasks 1 and 2 pass.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/api && npm test 2>&1 | tail -20 && cd /c/dev/ai-running-coach/web && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>Run insight prompt uses editNotes (live state). All unit tests pass. Web build passes.</done>
</task>

</tasks>

<verification>
1. `cd /c/dev/ai-running-coach/web && npm run build` — no TypeScript errors
2. `cd /c/dev/ai-running-coach/api && npm test` — all API tests pass
3. `cd /c/dev/ai-running-coach/web && npm test` — all web tests pass
4. Manual check: Network tab shows single GET /api/plan on training plan load (no separate GET /api/runs from PlanView)
5. Manual check: Buttons throughout app show pointer cursor
6. Manual check: Delete run shows browser confirm dialog, not inline confirm UI
</verification>

<success_criteria>
- GET /api/plan embeds linkedRuns; PlanView no longer issues a separate runs fetch
- chat.ts synthetic state includes Notes field for completed days
- Global CSS button/a/[role=button] { cursor: pointer } in index.css
- Log run modal has X close button
- Delete run and DayRow delete use window.confirm
- progressFeedback renders markdown in TrainingPlan
- Distance and HR fields equal width in RunDetailModal grid
- Run insight prompt uses editNotes (current unsaved state)
- All tests pass, TypeScript build passes
</success_criteria>

<output>
After completion, create `.planning/quick/260407-wjz-ui-polish-and-llm-run-notes-server-side-/260407-wjz-SUMMARY.md`
</output>
