---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - api/src/functions/plan.ts
  - api/src/functions/planDays.ts
  - api/src/__tests__/plan.test.ts
  - api/src/__tests__/planDays.test.ts
  - web/src/hooks/useChat.ts
  - web/src/__tests__/useChat.trainingPlan.test.ts
  - CLAUDE.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "POST /api/plan/generate succeeds even when the plan has completed days"
    - "POST /api/plan succeeds even when an active plan has completed days"
    - "POST /api/plan/days allows past dates when completed=true or skipped=true"
    - "POST /api/plan/days still rejects past dates with no completed/skipped flag"
    - "When plan:update or plan:add API calls fail, the user sees the error in the coach chat"
  artifacts:
    - path: "api/src/functions/plan.ts"
      provides: "generatePlan and createPlan without 409 completed-day guards"
    - path: "api/src/functions/planDays.ts"
      provides: "addDay allowing past dates with completed/skipped flags"
    - path: "web/src/hooks/useChat.ts"
      provides: "Error surfacing for both plan:update and plan:add failures"
  key_links:
    - from: "web/src/hooks/useChat.ts"
      to: "/api/plan/days/:date"
      via: "PATCH with error collection"
      pattern: "updateErrors.*push"
    - from: "web/src/hooks/useChat.ts"
      to: "/api/plan/days"
      via: "POST with error collection"
      pattern: "addErrors.*push"
---

<objective>
Fix three plan adjustment restrictions: (1) remove 409 guards that block plan regeneration/creation when completed days exist, (2) allow past dates in plan:add when completed/skipped flags are set, (3) surface all plan:update and plan:add API errors to the user in the chat.

Purpose: Users currently cannot regenerate their plan or have the coach add past training history because of overly aggressive guards. Additionally, failed plan modifications are silently swallowed.
Output: Updated API endpoints, updated useChat error handling, updated tests, updated CLAUDE.md.
</objective>

<execution_context>
@.planning/quick/260328-uuj-fix-plan-adjustment-409-conflict-complet/260328-uuj-PLAN.md
</execution_context>

<context>
@CLAUDE.md
@api/src/functions/plan.ts
@api/src/functions/planDays.ts
@web/src/hooks/useChat.ts
@api/src/__tests__/plan.test.ts
@api/src/__tests__/planDays.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove 409 guards and allow past dates with flags in API</name>
  <files>api/src/functions/plan.ts, api/src/functions/planDays.ts, api/src/__tests__/plan.test.ts, api/src/__tests__/planDays.test.ts</files>
  <action>
**In `api/src/functions/plan.ts` — generatePlan handler:**
Remove the entire completed-day guard block (lines 198-228): delete "Check 1" (lines 200-213 that query existingPlan and check hasCompleted), and delete "Check 2" (lines 214-228 that query otherActiveWithHistory). The comment above ("Refuse to replace a plan...") should also be removed.

**In `api/src/functions/plan.ts` — createPlan handler:**
Remove the completed-day guard block (lines 57-70): delete the `activePlanWithHistory` query and its 409 response. Remove the comment above it ("Refuse to start a new plan if there's already an active plan with training history").

**In `api/src/functions/planDays.ts` — addDay handler:**
Replace the unconditional past-date rejection (lines 214-218) with conditional logic:
```
const today = new Date().toISOString().split('T')[0];
if (date < today) {
  const completed = body.completed === 'true' || (body.completed as unknown) === true;
  const skipped = body.skipped === 'true' || (body.skipped as unknown) === true;
  if (!completed && !skipped) {
    return { status: 400, jsonBody: { error: `Cannot add a pending training day in the past (${date} is before today ${today}). Past dates require completed or skipped status.` } };
  }
}
```
Also add `completed` and `skipped` to the body type (add `completed?: string | boolean; skipped?: string | boolean;`), and when setting `$set`, use the payload values for completed/skipped instead of hardcoding `false`:
```
'phases.$[].weeks.$[].days.$[day].completed': body.completed === 'true' || (body.completed as unknown) === true ? true : false,
'phases.$[].weeks.$[].days.$[day].skipped': body.skipped === 'true' || (body.skipped as unknown) === true ? true : false,
```

**In `api/src/__tests__/plan.test.ts`:**
- Update the test "returns 409 when plan already has a completed day" (line 394) — change it to "allows generating plan even when plan has completed days", expect status 200 instead of 409.
- Update the test "returns 409 when a different active plan has completed days" (line 415) — change it to "allows generating plan even when another active plan has completed days", expect status 200.
- Update the test "returns 409 when active plan with completed days exists" (line 466) — change it to "allows creating a new plan even when active plan has completed days", expect status 201.
- Remove or update the "allows creating a new plan when active plan has no completed days" test (line 484) — it is redundant now since both cases allow creation; keep it but rename to clarify it still works.

**In `api/src/__tests__/planDays.test.ts`:**
- Update "returns 400 when adding a day in the past" test (line 320) — rename to "returns 400 when adding a pending day in the past" and keep the assertion but update the error message match to "pending training day".
- Add new test: "allows adding a past day with completed=true" — POST with `{ date: '2020-01-01', type: 'run', completed: 'true' }`, expect 201 (or 404 if no matching day slot — check test setup; if the test plan doesn't have a 2020 date slot, expect 404 which is fine since it means the past-date guard passed).
- Add new test: "allows adding a past day with skipped=true" — same pattern with `skipped: 'true'`.
  </action>
  <verify>
    <automated>cd C:/dev/ai-running-coach/api && npm test -- --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>All 409 completed-day guards removed from generatePlan and createPlan. addDay allows past dates with completed/skipped flags. All API tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Surface plan:update errors in chat and update CLAUDE.md</name>
  <files>web/src/hooks/useChat.ts, CLAUDE.md</files>
  <action>
**In `web/src/hooks/useChat.ts` — sendMessage function (around line 362-375):**
The `<plan:update>` PATCH calls currently have a bare `catch` that silently swallows errors. Change the pattern to collect errors just like `<plan:add>` already does:

1. Before the `for (const match of planUpdates)` loop (line 362), add: `const updateErrors: string[] = [];`
2. Inside the loop, after the `fetch` call, add response status checking:
```typescript
const res = await fetch(`/api/plan/days/${attrs.date}`, {
  method: 'PATCH',
  headers: authHeaders(),
  body: JSON.stringify(attrs),
});
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  updateErrors.push(body.error ?? `Could not update day ${attrs.date}`);
}
```
3. After the planUpdates loop and before the planAdds loop, no change needed — errors will be combined below.
4. After both loops complete (after the existing `addErrors` message append block around line 397-406), combine both error arrays. Replace the existing addErrors display logic with:
```typescript
const allErrors = [...updateErrors, ...addErrors];
if (allErrors.length > 0) {
  setMessages((prev) => {
    const updated = [...prev];
    const last = updated[updated.length - 1];
    if (last?.role === 'assistant') {
      updated[updated.length - 1] = { ...last, content: last.content + `\n\n⚠️ ${allErrors.join('; ')}` };
    }
    return updated;
  });
}
```

Apply the same pattern in the **startPlan** function's duplicate code block (around lines 629-674). That block has the same structure with `planUpdates` and `planAdds` processing. Add `updateErrors2` collection for the PATCH calls, and combine with `addErrors2` before displaying.

**In `CLAUDE.md`:**
Update three architecture decision bullets:
1. The **Plan replace guard** bullet — remove the sentence about `POST /api/plan/generate` returning 409 for completed days and the sentence about `POST /api/plan` returning 409. Keep the `DELETE /api/plan/days/:date` 409 for completed days (that guard remains). Update to say: "Plan replace guard — `POST /api/plan/generate` and `POST /api/plan` no longer block on completed days (future phase will add back when run data is tracked). `DELETE /api/plan/days/:date` returns 409 for completed days. `POST /api/plan/days` (addDay) returns 400 for past dates unless `completed: true` or `skipped: true` is set."
2. The **Past dates in initial plan generation** bullet — add a note that `<plan:add>` now also allows past dates when `completed` or `skipped` flags are provided.
3. Add a new bullet: **plan:update and plan:add error surfacing** — "When `<plan:update>` or `<plan:add>` API calls fail (non-2xx), `useChat.ts` collects the error messages and appends them to the assistant's chat message so the user sees what went wrong."
  </action>
  <verify>
    <automated>cd C:/dev/ai-running-coach/web && npm test -- --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>plan:update PATCH errors are collected and surfaced to the user alongside plan:add errors. CLAUDE.md architecture decisions updated to reflect all three changes.</done>
</task>

<task type="auto">
  <name>Task 3: Run E2E tests to verify no regressions</name>
  <files></files>
  <action>
Run the full E2E test suite to verify no regressions from the API changes. Fix any failures.
```
cd C:/dev/ai-running-coach && npx playwright test
```
  </action>
  <verify>
    <automated>cd C:/dev/ai-running-coach && npx playwright test 2>&1 | tail -20</automated>
  </verify>
  <done>All E2E tests pass with no regressions.</done>
</task>

</tasks>

<verification>
- `cd api && npm test` — all API tests pass (409 guard tests updated, past-date conditional tests added)
- `cd web && npm test` — all web tests pass (useChat error surfacing)
- `npx playwright test` — all E2E tests pass
- CLAUDE.md updated with new architecture decision bullets
</verification>

<success_criteria>
1. POST /api/plan/generate succeeds with 200 even when plan has completed days
2. POST /api/plan succeeds with 201 even when active plan has completed days
3. POST /api/plan/days returns 201 for past dates with completed/skipped=true
4. POST /api/plan/days returns 400 for past dates without completed/skipped flags
5. Failed plan:update and plan:add API calls show error text in the coach chat
6. All test layers pass (unit, integration, E2E)
</success_criteria>

<output>
After completion, create `.planning/quick/260328-uuj-fix-plan-adjustment-409-conflict-complet/260328-uuj-SUMMARY.md`
</output>
