# Phase 5: Missing Features — Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers four capabilities missing from the current coaching loop:

1. **Extend the training plan** — manually add a new phase (with an empty first week) at the bottom of the plan, and let the agent do the same via XML command
2. **Edit target date** — inline click-to-edit on the Training Plan header; target date is optional (can be cleared); agent can update it via XML tag
3. **Agent-created runs** — coach emits a `<run:create>` XML tag to log a run on the user's behalf, with optional plan day linkage
4. **Chat-triggered run insights** — coach emits `<run:update-insight>` to save a coaching insight to a run record during natural chat (not just via the "Add feedback" button)

This phase does NOT include:
- Add week inside a phase (no `+ Add week` button — only `+ Add phase`)
- Apple Health upload (remains out of scope)
- Dashboard changes

</domain>

<decisions>
## Implementation Decisions

### Add Phase (Manual)

- **D-01:** `+ Add phase` button appears below the last phase in `PlanView`. Only visible when not in readonly mode.
- **D-02:** New phase defaults: name "Phase N" (auto-numbered), empty description, one empty week. No modal — created immediately on click, user edits inline via existing `PhaseHeader` editing.
- **D-03:** `POST /api/plan/phases` — new endpoint that appends a phase (with one empty week) to the active plan's `phases` array. Returns the updated plan. `assignPlanStructure` runs on save to assign correct week numbers.

### Add Phase (Agent)

- **D-04:** Agent command: `<plan:add-phase name="Race Prep" description="Final 4-week push"/>` — appends a new phase with the given name/description and one empty week.
- **D-05:** `useChat.ts` strips `<plan:add-phase>` during streaming, processes it after `done` (same pattern as `plan:update`, `plan:update-phase`). POSTs to `POST /api/plan/phases`. Dispatches `plan-updated` window event so `usePlan` re-fetches.
- **D-06:** System prompt updated to document `<plan:add-phase>` command with example and usage rules.

### Target Date (Manual)

- **D-07:** Target date shown in the Training Plan header as an inline-editable field. Clicking it switches to a date input. On blur/confirm, `PATCH /api/plan` saves the new value.
- **D-08:** Target date is **optional** — can be cleared (set to empty/null). If not set, nothing is shown in the header.
- **D-09:** `PATCH /api/plan` extended to accept `targetDate` (ISO date string or empty string to clear) in addition to the existing `progressFeedback` field.

### Target Date (Agent)

- **D-10:** Agent command: `<plan:update-goal targetDate="2026-11-01"/>` — updates the plan's target date. Empty string clears it.
- **D-11:** `useChat.ts` handles `<plan:update-goal>` tag (strip during streaming, apply after `done`, dispatch `plan-updated`). Calls `PATCH /api/plan` with `{ targetDate }`.
- **D-12:** System prompt updated to document `<plan:update-goal>` command. Agent uses it when user says things like "push my race to November" or "I no longer have a target race".

### Agent Run Creation

- **D-13:** Agent command: `<run:create date="2026-04-10" distance="8" unit="km" duration="45:00" weekNumber="3" dayLabel="B" avgHR="148" notes="Felt strong"/>`.
  - **Required fields:** `date` (YYYY-MM-DD), `distance` (number), `unit` ("km" or "miles"), `duration` (MM:SS or HH:MM:SS).
  - **Optional fields:** `weekNumber`, `dayLabel` (for plan linking), `avgHR`, `notes`.
- **D-14:** `useChat.ts` strips `<run:create>` during streaming, processes after `done`. Calls `POST /api/runs` with the parsed data. If `weekNumber` + `dayLabel` are provided, run is linked and day is auto-completed (same as existing link-at-create behavior).
- **D-15:** `run:create` tags are handled in `applyPlanOperations` (same batch as `plan:update`, `plan:add`, etc.). Errors are surfaced as `⚠️ <error>` appended to the assistant message.
- **D-16:** System prompt documents `<run:create>` with examples. Agent uses it when user describes a run in chat ("I just ran 8km in 45 minutes"). Agent asks for missing required fields before emitting the tag.

### Chat-Triggered Run Insights

- **D-17:** Agent command: `<run:update-insight runId="<objectId>" insight="Great negative split..."/>`.
- **D-18:** Agent uses this at the end of a run feedback response in natural chat — e.g., after user asks "how did my Tuesday run go?".
- **D-19:** `useChat.ts` strips `<run:update-insight>` during streaming, processes after `done`. Calls `PATCH /api/runs/:runId` with `{ insight }`.
- **D-20:** **Silent save** — no toast notification. Coach may say "I've noted this on your run record" in the chat text if appropriate. Insight appears silently when user next opens the run detail modal.
- **D-21:** System prompt gives the agent run IDs from the synthetic plan-state context (run records for completed days already include date, distance, pace). Agent uses these IDs to reference specific runs. System prompt instructs agent to emit `<run:update-insight>` after providing detailed run feedback.

### Claude's Discretion

- Exact wording for the agent when it creates a run (confirmation copy in chat response)
- Whether `+ Add phase` button shows a spinner or immediately renders the new phase
- Error handling UI if `POST /api/plan/phases` fails (follow existing `⚠️` pattern)
- How the system prompt presents run IDs to the agent for `run:update-insight` (append to synthetic plan-state context, similar to how linked run data is injected today)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & XML Protocol
- `CLAUDE.md` §Architecture Decisions — key patterns:
  - `<plan:update>`, `<plan:add>`, `<plan:update-phase>`, `<plan:delete-phase>`, `<plan:unlink>` XML tag protocol (strip during streaming, apply after `done`)
  - `applyPlanOperations` in `useChat.ts` — where new tag handlers go
  - `plan-updated` window event dispatch after mutations
  - `assignPlanStructure()` in `planUtils.ts` — must run after any phase/week structure change
  - `PATCH /api/plan` currently only saves `progressFeedback` — extend for `targetDate`
  - `POST /api/runs` accepts optional `weekNumber` + `dayLabel` for linked creation
  - `insight` must be saved from `sendMessage()` return value — never from stale `messages` state

### Existing API Handlers
- `api/src/functions/plan.ts` — `patchPlan` handler (extend for `targetDate`); `getPlan` handler
- `api/src/functions/planDays.ts` — model for phase/week mutations (arrayFilters pattern)
- `api/src/functions/runs.ts` — `POST /api/runs` (link-at-create) and `PATCH /api/runs/:id`
- `api/src/shared/prompts.ts` — `buildSystemPrompt` (add `<plan:add-phase>`, `<plan:update-goal>`, `<run:create>`, `<run:update-insight>` to the XML command table)
- `api/src/shared/types.ts` — `Plan` type (add `targetDate?: string` as optional if not already)

### Frontend
- `web/src/hooks/useChat.ts` — `applyPlanOperations`, `streamChatResponse`, tag stripping patterns
- `web/src/hooks/usePlan.ts` — `plan-updated` event consumer, `refreshPlan()`
- `web/src/components/plan/PlanView.tsx` — where `+ Add phase` button goes
- `web/src/components/plan/PhaseHeader.tsx` — inline edit pattern to replicate for target date
- `web/src/pages/TrainingPlan.tsx` — target date display and `handleGetFeedback`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PhaseHeader.tsx` — inline click-to-edit pattern (title/description). Replicate for target date input in `TrainingPlan.tsx` header.
- `applyPlanOperations` in `useChat.ts` — already handles `plan:update`, `plan:add`, `plan:update-phase`, `plan:delete-phase`, `plan:unlink`. Add `plan:add-phase`, `plan:update-goal`, `run:create`, `run:update-insight` here.
- `streamChatResponse` helper — strips tags during streaming. New tag names must be added to the strip regex / detection logic.
- `POST /api/runs` — already supports `weekNumber` + `dayLabel` for linked creation at POST time.
- `PATCH /api/runs/:id` — already saves `insight` field (used by "Add feedback" button flow).

### Established Patterns
- XML tags: strip from display during streaming, apply via API calls after `done`, dispatch `plan-updated` or equivalent to trigger UI refresh
- `window.confirm` for destructive actions (not relevant here — add phase is non-destructive)
- `assignPlanStructure(phases)` must run on any operation that adds/changes phase/week structure
- Inline editing: click to reveal input, blur/Enter to save, Escape to cancel

### Integration Points
- `PlanView.tsx` — add `+ Add phase` button below the last phase block (when not readonly)
- `TrainingPlan.tsx` header — make target date inline-editable
- `useChat.ts` `applyPlanOperations` — 4 new tag handlers
- `prompts.ts` XML command table — 4 new command entries with examples
- `plan.ts` `patchPlan` — extend to accept `targetDate`
- New `POST /api/plan/phases` endpoint in `plan.ts`

</code_context>

<specifics>
## Specific Requirements

- **`+ Add phase` only** — no `+ Add week`. Phase = the unit of extension.
- **Target date is optional** — field can be empty/null. If empty, header shows nothing (no "Target:" label).
- **`<run:create>` required fields**: `date`, `distance`, `unit`, `duration`. Optional: `weekNumber`, `dayLabel`, `avgHR`, `notes`.
- **`<run:update-insight>` is silent** — no toast. Coach mentions it in chat text if it makes sense.
- **Agent gets run IDs** in the synthetic plan-state context (already present for completed days as part of the run data injection) so it can reference specific runs for `<run:update-insight>`.

</specifics>

<deferred>
## Deferred Ideas

- **`+ Add week` button inside a phase** — user chose "add phase only" for simplicity
- **Apple Health upload** — remains out of scope for this milestone
- **Goal type editing** (change from half-marathon to marathon) — not requested, would be a separate feature

</deferred>

---

*Phase: 05-missing-features*
*Context gathered: 2026-04-10*
