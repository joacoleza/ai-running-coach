# Phase 5: Missing Features - Research

**Researched:** 2026-04-10
**Domain:** Azure Functions API extensions, React hook XML tag processing, inline edit UI patterns
**Confidence:** HIGH — all findings are based on direct reading of the codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `+ Add phase` button below the last phase in `PlanView`. Only visible when not in readonly mode.
- **D-02:** New phase defaults: name "Phase N" (auto-numbered), empty description, one empty week. No modal — created immediately on click, user edits inline via existing `PhaseHeader` editing.
- **D-03:** `POST /api/plan/phases` — new endpoint that appends a phase (with one empty week) to the active plan's `phases` array. Returns the updated plan. `assignPlanStructure` runs on save to assign correct week numbers.
- **D-04:** Agent command: `<plan:add-phase name="Race Prep" description="Final 4-week push"/>` — appends a new phase with the given name/description and one empty week.
- **D-05:** `useChat.ts` strips `<plan:add-phase>` during streaming, processes it after `done`. POSTs to `POST /api/plan/phases`. Dispatches `plan-updated` window event.
- **D-06:** System prompt updated to document `<plan:add-phase>` command.
- **D-07:** Target date shown in the Training Plan header as an inline-editable field. Clicking it switches to a date input. On blur/confirm, `PATCH /api/plan` saves the new value.
- **D-08:** Target date is optional — can be cleared (set to empty/null). If not set, nothing is shown in the header.
- **D-09:** `PATCH /api/plan` extended to accept `targetDate` (ISO date string or empty string to clear).
- **D-10:** Agent command: `<plan:update-goal targetDate="2026-11-01"/>` — updates the plan's target date. Empty string clears it.
- **D-11:** `useChat.ts` handles `<plan:update-goal>` tag (strip during streaming, apply after `done`, dispatch `plan-updated`). Calls `PATCH /api/plan` with `{ targetDate }`.
- **D-12:** System prompt updated to document `<plan:update-goal>` command.
- **D-13:** Agent command: `<run:create date="2026-04-10" distance="8" unit="km" duration="45:00" weekNumber="3" dayLabel="B" avgHR="148" notes="Felt strong"/>`. Required fields: `date`, `distance`, `unit`, `duration`. Optional: `weekNumber`, `dayLabel`, `avgHR`, `notes`.
- **D-14:** `useChat.ts` strips `<run:create>` during streaming, processes after `done`. Calls `POST /api/runs` with the parsed data.
- **D-15:** `run:create` tags handled in `applyPlanOperations`. Errors surfaced as `⚠️ <error>` appended to assistant message.
- **D-16:** System prompt documents `<run:create>` with examples.
- **D-17:** Agent command: `<run:update-insight runId="<objectId>" insight="Great negative split..."/>`.
- **D-18:** Agent uses this at end of run feedback responses in natural chat.
- **D-19:** `useChat.ts` strips `<run:update-insight>` during streaming, processes after `done`. Calls `PATCH /api/runs/:runId` with `{ insight }`.
- **D-20:** Silent save — no toast. Coach may mention it in chat text.
- **D-21:** System prompt gives agent run IDs from the synthetic plan-state context.

### Claude's Discretion

- Exact wording for the agent when it creates a run
- Whether `+ Add phase` button shows a spinner or immediately renders the new phase
- Error handling UI if `POST /api/plan/phases` fails (follow existing `⚠️` pattern)
- How the system prompt presents run IDs to the agent for `run:update-insight`

### Deferred Ideas (OUT OF SCOPE)

- `+ Add week` button inside a phase
- Apple Health upload
- Goal type editing
</user_constraints>

---

## Summary

Phase 5 adds four capabilities. The codebase is well-structured and each capability slots cleanly into an established pattern. The main work is mechanical: add tag regexes in two places in `useChat.ts`, add one new API endpoint, extend one existing endpoint, update the system prompt, and wire a new `+ Add phase` button into `PlanView`.

The highest-complexity item is **`run:create`** — it introduces the first `run:*` namespace into `applyPlanOperations`, requires `unit` field handling (the existing `POST /api/runs` route accepts `distance` as a number but has no `unit` field on the run document), and must not expose the `unit` as a stored field (it determines how to send `distance` but the run schema stores only the numeric value). Everything else is low-complexity surgery.

**Primary recommendation:** Implement in this order: (1) `PATCH /api/plan` targetDate extension + UI — isolated change, no new endpoint. (2) `POST /api/plan/phases` endpoint + `+ Add phase` button — pure additions. (3) Four new tag handlers in `applyPlanOperations` + system prompt additions. (4) Run ID exposure in synthetic plan-state context for `run:update-insight`.

---

## Architecture Patterns

### Tag Stripping — Two Locations, Must Match

Tags must be stripped in **two separate places** in `useChat.ts`, and both must be updated for every new tag:

**Location 1 — live streaming strip** (in `onText` callback, `sendMessage` and `startPlan` both):
```typescript
content: acc
  .replace(/<training_plan>[\s\S]*/g, '')
  .replace(/<plan:update-phase[^/]*\/>/g, '')
  .replace(/<plan:delete-phase[^/]*\/>/g, '')
  .replace(/<plan:update[^/]*\/>/g, '')
  .replace(/<plan:add[^/]*\/>/g, '')
  .replace(/<plan:unlink[^/]*\/>/g, '')
  .trim(),
```

**Location 2 — history load strip** (in the `init()` useEffect on mount, for messages fetched from MongoDB):
```typescript
content: m.role === 'assistant'
  ? m.content
      .replace(/<training_plan>[\s\S]*?<\/training_plan>/g, '')
      .replace(/<plan:update-phase[^/]*\/>/g, '')
      .replace(/<plan:delete-phase[^/]*\/>/g, '')
      .replace(/<plan:update[^/]*\/>/g, '')
      .replace(/<plan:add[^/]*\/>/g, '')
      .replace(/<plan:unlink[^/]*\/>/g, '')
      .replace(/<app:[^/]*\/>/g, '')
      .trim()
  : m.content,
```

All four new tags (`<plan:add-phase>`, `<plan:update-goal>`, `<run:create>`, `<run:update-insight>`) must be added to **both** locations.

Additionally, the `planUpdateDetected` trigger in `onText` (which sets `isGeneratingPlan = true`) only checks for existing tag names. The `run:create` and `plan:add-phase` tags should also trigger this indicator since they mutate data.

### `applyPlanOperations` — Where New Handlers Go

`applyPlanOperations` is a `useCallback` in `useChat.ts` (line 231). Its current structure:

1. Declare regexes for each known tag family at the top.
2. Run `matchAll` on `accumulatedText` for each regex.
3. Check if any matches exist — if yes, strip tags from displayed message via `setMessages`.
4. Loop over each match array and call the corresponding API.
5. Collect errors into per-family arrays, then combine into `allErrors`.
6. Append `allErrors` to the last assistant message if non-empty.
7. Re-fetch plan, dispatch `plan-updated`, set `isGeneratingPlan = false`.

The condition at line 247 is:
```typescript
if (planUpdates.length > 0 || planAdds.length > 0 || phaseUpdates.length > 0 || phaseDeletes.length > 0 || planUnlinks.length > 0) {
```

This guard must be extended to include the four new tag match arrays.

The strip call inside `setMessages` (line 250–266) must also gain the new `.replace(...)` chains for the four new tag patterns.

### `POST /api/plan/phases` — New Endpoint Pattern

Model it exactly on `deleteLastPhase` in `planPhases.ts`:

```typescript
app.http('addPhase', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/phases',
  handler: async (req, context) => { ... }
});
```

The handler must:
1. Parse `name` and `description` from the JSON body (both optional — default `name` to `"Phase N"` where N is `plan.phases.length + 1`).
2. Build a new `PlanPhase` with one empty week (`days: []`).
3. `$push` the new phase onto `plan.phases`.
4. Run `assignPlanStructure` on the updated phases to assign correct sequential week numbers, then save back.

**Critical:** `$push` alone is insufficient — week numbers must be reassigned via `assignPlanStructure`. The simplest implementation is: fetch the plan, construct the updated phases array in JS (spread + push), run `assignPlanStructure`, then `$set` the whole `phases` array. This is what `chat.ts` does when saving a generated plan.

```typescript
// Correct pattern (not $push alone)
const updatedPhases = assignPlanStructure([...plan.phases, newPhase]);
await db.collection<Plan>('plans').findOneAndUpdate(
  { status: { $in: ['active', 'onboarding'] } },
  { $set: { phases: updatedPhases, updatedAt: new Date() } },
  { returnDocument: 'after' },
);
```

The new phase's first week needs a `days` array. An empty array `[]` is valid — the user adds days via the existing `+ Add day` button. The `assignPlanStructure` call will assign it a sequential week number.

### `PATCH /api/plan` — Extending `patchPlan`

Current handler (line 112–145 in `plan.ts`):

```typescript
let body: { progressFeedback?: string };
// ...
if (body.progressFeedback === undefined) {
  return { status: 400, jsonBody: { error: 'No updatable fields provided' } };
}
// ...
{ $set: { progressFeedback: body.progressFeedback, updatedAt: new Date() } }
```

Extension required:
1. Widen the body type: `{ progressFeedback?: string; targetDate?: string }`.
2. Change the guard: `if (body.progressFeedback === undefined && body.targetDate === undefined)`.
3. Build `$set` conditionally:
   ```typescript
   const $set: Record<string, unknown> = { updatedAt: new Date() };
   if (body.progressFeedback !== undefined) $set['progressFeedback'] = body.progressFeedback;
   if (body.targetDate !== undefined) {
     // Empty string clears the field
     if (body.targetDate === '') {
       // Use $unset instead, or set to null/undefined
     } else {
       $set['targetDate'] = body.targetDate;
     }
   }
   ```
   
**Clearing targetDate:** MongoDB `$set` cannot set a field to `undefined`. Two options: (a) use `$unset: { targetDate: '' }` when empty string is passed, or (b) store `null` and handle null display in the frontend. Option (a) is cleaner. Use a conditional update with both `$set` and optionally `$unset`.

**`targetDate` in `Plan` type:** Already present as `targetDate?: string` (line 65 of `types.ts`). No type change needed.

### `targetDate` in `PlanData` (frontend type)

`PlanData` in `useChat.ts` (line 14–20) already has `targetDate?: string`. The `PlanData` in `usePlan.ts` (line 32–42) also already has `targetDate?: string`. No type changes needed in either hook.

### Inline Edit Pattern — `PhaseHeader.tsx` as Template

`PhaseHeader.tsx` is the exact template for the target date inline edit in `TrainingPlan.tsx`. The pattern:

```typescript
const [editingDate, setEditingDate] = useState(false);
const [dateValue, setDateValue] = useState(plan.targetDate ?? '');
const dateInputRef = useRef<HTMLInputElement>(null);

useEffect(() => { if (editingDate) dateInputRef.current?.focus(); }, [editingDate]);

const saveDate = async () => {
  if (trimmed === (plan.targetDate ?? '')) { setEditingDate(false); return; }
  // PATCH /api/plan with { targetDate: trimmed }
  await refreshPlan();
  setEditingDate(false);
};
```

Display side:
```tsx
{editingDate ? (
  <input type="date" ref={dateInputRef} value={dateValue}
    onChange={e => setDateValue(e.target.value)}
    onBlur={() => void saveDate()}
    onKeyDown={e => { if (e.key === 'Enter') void saveDate(); if (e.key === 'Escape') { setDateValue(plan.targetDate ?? ''); setEditingDate(false); } }}
    className="border-b-2 border-blue-400 outline-none bg-transparent text-[16px]"
  />
) : plan.targetDate ? (
  <span className="cursor-pointer hover:text-blue-700 text-gray-600" onClick={() => setEditingDate(true)}>
    Target: {plan.targetDate}
  </span>
) : (
  <span className="cursor-pointer text-gray-400 text-sm hover:text-blue-600" onClick={() => setEditingDate(true)}>
    + Set target date
  </span>
)}
```

The `type="date"` input natively gives a date picker. Keep `text-[16px]` per CLAUDE.md (iOS auto-zoom prevention). The PATCH call can reuse the existing `handleGetFeedback` auth header pattern or call `refreshPlan()` after patching.

**Important:** `TrainingPlan.tsx` already calls `refreshPlan` from `usePlan`. After patching `targetDate`, call `refreshPlan()` to update the displayed plan. Do NOT call `window.dispatchEvent(new Event('plan-updated'))` from within the component — that would trigger `usePlan`'s listener to call `refreshPlan` again, doubling the fetch. Just call `refreshPlan()` directly.

### `+ Add phase` Button in `PlanView`

The button must go **after** the `{plan.phases.map(...)}` loop closes but **before** the `LinkRunModal`. Current structure (line 154–265 in `PlanView.tsx`):

```tsx
return (
  <>
    <div>
      {plan.phases.map((phase, idx) => (
        <section key={phase.name} className="mb-8">
          {/* ... phase content ... */}
        </section>
      ))}
    </div>
    {/* Link Run Modal */}
    {linkingDay && ( ... )}
  </>
);
```

Insert the button between the closing `</div>` and the `{linkingDay && ...}`:

```tsx
{!readonly && onAddPhase && (
  <button
    onClick={() => void onAddPhase()}
    className="cursor-pointer mt-2 text-sm text-gray-400 hover:text-blue-600 transition-colors"
  >
    + Add phase
  </button>
)}
```

`PlanViewProps` gains a new optional prop `onAddPhase?: () => Promise<void>`. `TrainingPlan.tsx` passes `onAddPhase={addPhase}` where `addPhase` is the new function from `usePlan`.

**usePlan addition:**

```typescript
const addPhase = useCallback(async (name?: string, description?: string) => {
  const res = await fetch('/api/plan/phases', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Failed to add phase' }));
    throw new Error((errData as { error?: string }).error ?? 'Failed to add phase');
  }
  await refreshPlan();
}, [refreshPlan]);
```

For the manual UI button, `name` and `description` are omitted (the server auto-names). For the agent command, `name` and `description` come from the XML tag attributes.

### Run ID Exposure in Synthetic Plan-State Context

The relevant code is in `chat.ts` lines 140–159. Completed days already get enriched with run data via `runsByKey`. The run `_id` is available on the `run` object fetched from MongoDB.

To expose the run ID to the agent, extend the line that builds the run data suffix:

```typescript
// Current:
line += ` | Ran: ${runDate}, ${run.distance}km${runPace}`;

// Extended:
const runId = run._id ? run._id.toString() : '';
line += ` | Ran: ${runDate}, ${run.distance}km${runPace} | RunId: ${runId}`;
```

This makes the run ID available in the plan-state context that the agent sees. The system prompt instructs the agent to use this ID when emitting `<run:update-insight runId="...">`.

### `run:create` Tag — Unit Field Handling

`POST /api/runs` accepts `distance` as a plain number. The `unit` attribute from `<run:create>` is not stored on the run document — it is purely informational for the coach's emission. **However**, if the plan uses miles, the distance value is already in miles in the agent's context, so `distance` can be passed through as-is regardless of unit.

The `unit` attribute should be parsed from the tag but not forwarded to `POST /api/runs`. The API body sent should be:

```typescript
const attrs = parseXmlAttrs(match[1]);
const body: Record<string, unknown> = {
  date: attrs.date,
  distance: Number(attrs.distance),
  duration: attrs.duration,
};
if (attrs.avgHR) body.avgHR = Number(attrs.avgHR);
if (attrs.notes) body.notes = attrs.notes;
if (attrs.weekNumber && attrs.dayLabel) {
  body.weekNumber = Number(attrs.weekNumber);
  body.dayLabel = attrs.dayLabel;
}
// attrs.unit is intentionally NOT forwarded — POST /api/runs does not accept it
```

Missing required fields (`date`, `distance`, `duration`) should cause an error to be added to `runCreateErrors` and surfaced as `⚠️`.

### `run:update-insight` — ObjectId Validation

`PATCH /api/runs/:id` already handles `insight` (line 258 of `runs.ts`). The client-side handler in `applyPlanOperations` should:

```typescript
const runInsightErrors: string[] = [];
for (const match of runInsightUpdates) {
  const attrs = parseXmlAttrs(match[1]);
  if (!attrs.runId || !attrs.insight) {
    runInsightErrors.push('run:update-insight: runId and insight are required');
    continue;
  }
  try {
    const res = await fetch(`/api/runs/${attrs.runId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ insight: attrs.insight }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      runInsightErrors.push(body.error ?? `Could not update insight for run ${attrs.runId}`);
    }
  } catch {
    runInsightErrors.push(`run:update-insight ${attrs.runId}: network error`);
  }
}
```

**No `plan-updated` dispatch is needed** for `run:update-insight` — it only changes a run record, not the plan structure. The insight appears silently when the user next opens `RunDetailModal`.

**No `plan-updated` dispatch needed for `run:create` either** unless the run is linked to a plan day (which marks it as completed). When `weekNumber` + `dayLabel` are present in the tag, `POST /api/runs` atomically marks the day as completed, so `plan-updated` should be dispatched after `run:create` to refresh the plan view.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Week number assignment after adding phase | Custom counter | `assignPlanStructure(phases)` from `planUtils.ts` — already handles global sequential numbering |
| XML attribute parsing | Custom parser | `parseXmlAttrs()` already exported from `useChat.ts` — used by all existing tag handlers |
| Auth headers in API calls | Inline header objects | `authHeaders()` helper already defined in both `useChat.ts` and `usePlan.ts` |
| Tag stripping during streaming | New state or DOM manipulation | Existing `.replace(regex, '')` chain in `onText` callback |
| Inline edit focus management | `setTimeout` or manual DOM | `useRef` + `useEffect(() => { if (editing) ref.current?.focus(); }, [editing])` — same as `PhaseHeader.tsx` |

---

## Common Pitfalls

### Pitfall 1: Stripping Tags in Only One Place

**What goes wrong:** New tags appear raw in the chat UI or in old messages loaded from history on next session.

**Why it happens:** `useChat.ts` strips tags in two separate locations — the `onText` streaming callback AND the history-load `init()` useEffect. Updating only the streaming strip leaves raw tags visible when the message is re-loaded from MongoDB.

**How to avoid:** Search for the string `<plan:unlink` in `useChat.ts` — it appears in exactly both strip locations. Add each new tag name alongside it in both places.

**Warning signs:** Tags visible in chat after page refresh but not during initial render.

### Pitfall 2: `applyPlanOperations` Guard Not Extended

**What goes wrong:** The new tag handlers execute their API calls but the guard condition (`if (planUpdates.length > 0 || planAdds.length > 0 || ...`) is never true for new tags alone, so the plan refresh and error surfacing logic never run.

**Why it happens:** The guard on line 247 uses OR conditions for each known tag array. New tag match arrays must be added to this condition.

**How to avoid:** When adding `runCreateMatches` and `runInsightMatches`, add `|| runCreateMatches.length > 0 || runInsightMatches.length > 0` etc. to the guard. Also add them to the inner `setMessages` strip call.

### Pitfall 3: `assignPlanStructure` Not Called on `POST /api/plan/phases`

**What goes wrong:** New phase gets an incorrect or missing week number (e.g., `weekNumber: 0` or `NaN`), causing the `+ Add day` button to silently fail when the frontend sends `weekNumber: 0` to `POST /api/plan/days`.

**Why it happens:** `$push` alone adds the phase with whatever week number you put in the object, without recalculating the global sequence. The existing `addDay` handler uses `weekNumber` as a lookup key in `arrayFilters`.

**How to avoid:** Always fetch the plan, spread phases in JS, run `assignPlanStructure`, then `$set` the entire `phases` array.

### Pitfall 4: `run:create` `unit` Field Forwarded to API

**What goes wrong:** `POST /api/runs` receives an unknown `unit` field in the body. Currently this is silently ignored (the handler only reads the fields it knows), but it's semantically wrong and may confuse future handlers.

**Why it happens:** Easy to forward `attrs` wholesale to the API body like other tag handlers do.

**How to avoid:** Explicitly construct the body for `POST /api/runs` from the tag attrs, omitting `unit`.

### Pitfall 5: `plan-updated` Dispatched Unnecessarily for `run:update-insight`

**What goes wrong:** Every `run:update-insight` triggers a full plan re-fetch in `usePlan`, causing a visible loading state flicker on the Training Plan page.

**Why it happens:** `plan-updated` is broadcast after every `applyPlanOperations` call. Since `run:update-insight` does not change plan structure, dispatching it is wasteful and may confuse the user.

**How to avoid:** Only dispatch `plan-updated` if at least one `plan:*` tag was processed OR a `run:create` with `weekNumber`/`dayLabel` was processed (which marks a day as completed). Skip dispatch for insight-only responses.

### Pitfall 6: `targetDate` Clearing via `$set: { targetDate: '' }`

**What goes wrong:** Empty string is stored in the DB for `targetDate` instead of removing the field, causing `plan.targetDate` to be truthy (`''`) which is falsy in JS but truthy as a MongoDB field presence check.

**Why it happens:** The simple `$set` approach stores whatever value is passed.

**How to avoid:** When `targetDate === ''` in the `patchPlan` handler, use `$unset: { targetDate: '' }` instead of `$set`. The frontend already treats falsy/absent `targetDate` as "not set" so returning the document without the field is correct.

---

## Code Examples

### Adding a tag to the `applyPlanOperations` guard and strip (minimal diff)

```typescript
// In applyPlanOperations — add regex declarations at the top (alongside existing ones):
const addPhaseRegex = /<plan:add-phase\s*([^/]*)\/>/g;
const updateGoalRegex = /<plan:update-goal\s+([^/]+)\/>/g;
const runCreateRegex = /<run:create\s+([^/]+)\/>/g;
const runInsightRegex = /<run:update-insight\s+([^/]+)\/>/g;

const addPhaseMatches = [...accumulatedText.matchAll(addPhaseRegex)];
const updateGoalMatches = [...accumulatedText.matchAll(updateGoalRegex)];
const runCreateMatches = [...accumulatedText.matchAll(runCreateRegex)];
const runInsightMatches = [...accumulatedText.matchAll(runInsightRegex)];

// Extend the guard condition:
if (planUpdates.length > 0 || planAdds.length > 0 || phaseUpdates.length > 0
    || phaseDeletes.length > 0 || planUnlinks.length > 0
    || addPhaseMatches.length > 0 || updateGoalMatches.length > 0
    || runCreateMatches.length > 0 || runInsightMatches.length > 0) {
```

### `POST /api/plan/phases` handler skeleton

```typescript
app.http('addPhase', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/phases',
  handler: async (req, context) => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    let body: { name?: string; description?: string } = {};
    try { body = (await req.json()) as typeof body; } catch { /* default empty */ }

    const db = await getDb();
    const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] } });
    if (!plan) return { status: 404, jsonBody: { error: 'No active plan found' } };

    const newPhaseName = body.name?.trim() || `Phase ${plan.phases.length + 1}`;
    const newPhase: PlanPhase = {
      name: newPhaseName,
      description: body.description ?? '',
      weeks: [{ weekNumber: 0, days: [] }], // weekNumber overwritten by assignPlanStructure
    };

    const updatedPhases = assignPlanStructure([...plan.phases, newPhase]);
    const result = await db.collection<Plan>('plans').findOneAndUpdate(
      { status: { $in: ['active', 'onboarding'] } },
      { $set: { phases: updatedPhases, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!result) return { status: 404, jsonBody: { error: 'Plan not found' } };
    return { status: 201, jsonBody: { plan: result } };
  },
});
```

### System prompt additions (structure only)

Add to the `## Phase Management Commands` section, after the existing `<plan:delete-phase>` table:

```
To add a new phase at the end of the plan:

| Tag | Effect |
|-----|--------|
| `<plan:add-phase name="Race Prep" description="Final 4-week push"/>` | Add a new phase with one empty week |

To update the plan's target race date:

| Tag | Effect |
|-----|--------|
| `<plan:update-goal targetDate="2026-11-01"/>` | Set or update the target race date |
| `<plan:update-goal targetDate=""/>` | Clear the target race date |
```

Add a new `## Run Creation Commands` section:

```
## Run Creation Commands

To log a run on the user's behalf:

| Tag | Effect |
|-----|--------|
| `<run:create date="2026-04-10" distance="8" unit="km" duration="45:00"/>` | Log a run |
| `<run:create date="2026-04-10" distance="8" unit="km" duration="45:00" weekNumber="3" dayLabel="B" avgHR="148" notes="Felt strong"/>` | Log a linked run |

Required: `date` (YYYY-MM-DD), `distance` (number), `unit` ("km" or "miles"), `duration` (MM:SS or HH:MM:SS).
Optional: `weekNumber` + `dayLabel` (links to a plan day and marks it completed), `avgHR`, `notes`.

To save a coaching insight to a specific run:

| Tag | Effect |
|-----|--------|
| `<run:update-insight runId="6614f..." insight="Great negative split — your fitness is building well."/>` | Save insight to run |

Run IDs are shown in the current training schedule for completed days (RunId: ...). Use this tag at the end of a detailed run feedback response.
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| API Framework | Vitest with MongoMemoryServer |
| Web Framework | Vitest with @testing-library/react |
| Config | `api/vitest.config.ts` and `web/vitest.config.ts` |
| Quick run (API) | `cd api && npm test` |
| Quick run (web) | `cd web && npm test` |
| E2E | `npx playwright test` from root |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| D-03 | `POST /api/plan/phases` creates new phase | unit | `cd api && npm test -- planPhases` | `api/src/__tests__/planPhases.test.ts` (extend) |
| D-03 | `assignPlanStructure` assigns correct week to new phase | unit | `cd api && npm test -- planUtils` | `api/src/__tests__/planUtils.test.ts` (extend) |
| D-09 | `PATCH /api/plan` accepts and saves `targetDate` | unit | `cd api && npm test -- plan.test` | `api/src/__tests__/plan.test.ts` (extend) |
| D-09 | `PATCH /api/plan` with empty `targetDate` unsets field | unit | `cd api && npm test -- plan.test` | `api/src/__tests__/plan.test.ts` (extend) |
| D-05,D-11,D-15,D-19 | New tags stripped from display during streaming | unit | `cd web && npm test -- useChat` | `web/src/__tests__/useChat.trainingPlan.test.ts` (extend) |
| D-05 | `plan:add-phase` triggers `POST /api/plan/phases` | unit | `cd web && npm test -- useChat` | `web/src/__tests__/useChat.trainingPlan.test.ts` (extend) |
| D-11 | `plan:update-goal` triggers `PATCH /api/plan` | unit | `cd web && npm test -- useChat` | `web/src/__tests__/useChat.trainingPlan.test.ts` (extend) |
| D-14 | `run:create` triggers `POST /api/runs` | unit | `cd web && npm test -- useChat` | `web/src/__tests__/useChat.trainingPlan.test.ts` (extend) |
| D-19 | `run:update-insight` triggers `PATCH /api/runs/:id` | unit | `cd web && npm test -- useChat` | `web/src/__tests__/useChat.trainingPlan.test.ts` (extend) |
| D-01 | `+ Add phase` button visible in PlanView when not readonly | E2E | `npx playwright test` | `e2e/` (extend or new spec) |
| D-07 | Target date inline edit visible and saves on blur | E2E | `npx playwright test` | `e2e/` (extend or new spec) |

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. Tests go in existing files (`planPhases.test.ts`, `plan.test.ts`, `useChat.trainingPlan.test.ts`).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 makes no changes to external dependencies. Same Azure Functions + MongoDB + React stack as all prior phases.

---

## Open Questions

1. **`plan:add-phase` body parsing on missing JSON body**
   - What we know: `addDay` in `planDays.ts` returns 400 for missing `weekNumber/label/type`. `deleteLastPhase` in `planPhases.ts` has no body.
   - What's unclear: Should `POST /api/plan/phases` require a body at all, or treat body as fully optional with defaults?
   - Recommendation: Wrap `req.json()` in try/catch and default to empty `{}` — the body is fully optional (defaults to `"Phase N"` name). This matches the UX requirement (click button → phase created immediately, no modal).

2. **`plan-updated` dispatch scope for `run:create`**
   - What we know: When `run:create` includes `weekNumber`+`dayLabel`, the API atomically marks the plan day as completed. `usePlan` needs to refresh to show the day as green.
   - What's unclear: Should the dispatch be conditional (only when linking attrs present) or always?
   - Recommendation: Always dispatch `plan-updated` after `run:create` succeeds, even for unlinked runs. The re-fetch is cheap and simplifies the logic.

3. **`+ Add phase` button key warning**
   - What we know: `PlanView` uses `phase.name` as the React key for each phase section. A freshly created phase always gets unique auto-numbered names (`"Phase 2"`, `"Phase 3"`) so keys should be unique.
   - What's unclear: If two phases somehow end up with the same name, React would warn about duplicate keys.
   - Recommendation: Use `phaseIndex` as the key instead of `phase.name` to be safe. This is a minor improvement the planner can include.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `api/src/functions/plan.ts`, `planDays.ts`, `planPhases.ts`, `runs.ts`, `chat.ts`
- Direct code reading: `api/src/shared/types.ts`, `prompts.ts`, `planUtils.ts`
- Direct code reading: `web/src/hooks/useChat.ts`, `usePlan.ts`
- Direct code reading: `web/src/components/plan/PlanView.tsx`, `PhaseHeader.tsx`
- Direct code reading: `web/src/pages/TrainingPlan.tsx`
- Direct code reading: `api/src/__tests__/plan.test.ts`, `planPhases.test.ts`
- Direct code reading: `web/src/__tests__/useChat.trainingPlan.test.ts`

### Secondary
None needed — all research is based on direct codebase reading.

---

## Metadata

**Confidence breakdown:**
- API extension patterns (patchPlan, addPhase): HIGH — read full source
- Frontend tag stripping pattern: HIGH — read full source, counted exact occurrences of both strip locations
- `assignPlanStructure` requirement for addPhase: HIGH — traced the code path from `deleteLastPhase` (which uses `$pop`) vs addPhase (which must recompute all week numbers)
- Inline edit pattern: HIGH — read full `PhaseHeader.tsx`
- `run:create` unit field handling: HIGH — read full `POST /api/runs` handler
- Test patterns: HIGH — read all relevant test files

**Research date:** 2026-04-10
**Valid until:** Indefinitely (all findings are from the codebase itself, not external docs)
