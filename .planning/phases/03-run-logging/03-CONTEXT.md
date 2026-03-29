# Phase 3: Run Logging & Feedback — Context

**Gathered:** 2026-03-29 (revised — removed Apple Health ZIP upload; manual entry only)
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the run data loop: user logs a run manually (via a form on the Training Plan page or the Runs page), the data is stored and linked to the training plan, and the coach automatically generates post-run feedback visible in chat. The Runs page becomes a functional run history list with detail view and filters.

This phase does NOT include:
- Apple Health ZIP upload (removed — too complex, manual entry is sufficient)
- Dashboard/progress views (Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Run Entry — Manual Form Only

- **D-01:** Run logging is **manual entry only**. No file upload, no ZIP, no async parsing.
- **D-02:** Run entry is available from **two places**:
  1. **Training Plan page** — click "Complete" on a plan day → form appears (pre-fills date from the day)
  2. **Runs page** — standalone "Log a run" button → same form without a pre-filled plan day
- **D-03:** Form fields:
  - Date (required, pre-filled when entering from a plan day)
  - Distance (required, respects user's km/miles preference)
  - Duration / time (required, e.g. "45:30")
  - Avg HR / BPM (optional)
  - Notes (optional, free text)
  - Pace is **computed** from distance + duration — not entered manually
- **D-04:** HR zones are **not computed** in Phase 3. No time-series HR data available with manual entry. Avg HR stored as-is. Zone charts deferred to v2 (ANLX-01).

### Run-to-Plan Linking Rules

- **D-05:** When a run is logged for a date matching the **active plan**:
  1. Day exists and is not completed/skipped → link run, mark day completed
  2. No day entry for that date → store run unlinked (no auto-create of a plan day)
  3. Day was skipped → unskip it, mark completed, link run
  4. Day is already completed → **reject with 409** (duplicate completion)

- **D-06:** When a run is logged for a date matching an **archived plan**:
  1. Day not completed → accept run, store it, link to archived day
  2. Day already has a run linked → reject with 409

- **D-07:** When a run has no matching plan date → store unlinked. No error.

### Completing a Training Plan Day

- **D-08:** Clicking "Complete" on an active plan day opens the run entry form (pre-filled date). On submit:
  - Run record created and linked to the day
  - Day marked completed
  - Post-run coaching fires automatically

- **D-09:** Completed days that have no linked run show an "Add run data" affordance — retroactive data entry. Submitting this form links a run to the already-completed day but does NOT retrigger coaching feedback (user can ask the coach manually if needed).

### Undo a Completed Day (When Run is Linked)

- **D-10:** Undo on a completed day that has a linked run → **unlink only**: day reverts to not-completed, run record stays in the Runs list. The run is not deleted.
- **D-11:** Runs without any plan link are **deletable** from the Runs page. Runs linked to a plan day are protected from deletion (user must undo the day first, which unlinks the run, then delete from Runs).

### Plan Protection Against Replacement

- **D-12:** The coach cannot regenerate a plan from scratch if any days have linked run data. Informs the user and suggests alternatives (adjust specific days).
- **D-13:** Archiving a plan IS allowed even if it has linked run data. Archiving = finishing the plan cycle.

### Post-Run Coaching — Automatic Trigger

- **D-14:** Post-run coaching fires **automatically** after a run is saved (both from plan day and standalone). The coach panel opens (or highlights) and streaming feedback begins.

- **D-15:** If run is **linked to an active plan day** → coach receives:
  - The logged run (distance, time, pace, avg HR, notes)
  - The plan day target (type, distance target, guidelines)
  - The full current plan state (already injected as synthetic context per CLAUDE.md)
  - Feedback covers: run vs plan comparison, one insight, any plan adjustment via `<plan:update>` tags

- **D-16:** If run is **standalone (no plan link)** → coach receives:
  - The logged run
  - The last **5** completed runs as context (enough for trend/pattern recognition)
  - Feedback covers: run summary, one insight (pacing, effort, consistency)
  - No plan adjustments (no day to link to)

- **D-17:** Coaching feedback is streamed to the existing chat interface (CoachPanel). Uses the existing `POST /api/chat` endpoint — no new streaming infrastructure needed. The run data is injected as a user message that triggers the feedback.

- **D-18:** The coaching insight text is also **stored on the run record** so it's visible on the run detail without needing to scroll chat history.

### Runs Page — List + Detail + Filters

- **D-19:** Runs page lists ALL runs in reverse date order (newest first), including runs from archived plans.
- **D-20:** Infinite scroll (no pagination).
- **D-21:** Filters at the top: date range, distance range, time/duration range. Applied client-side or via query params.
- **D-22:** Each run row shows: date, distance, time, pace, optional avg HR. Linked plan day shown as a badge (e.g., "Week 3 · Tempo").
- **D-23:** Clicking a run opens a **detail modal** (not a separate page) showing:
  - Date, distance, time, pace, avg HR (if set), notes
  - Coaching insight (if available)
  - Link to associated plan day/phase (if linked)
  - Delete button — visible only if the run has no linked plan day
- **D-24:** Linked runs show a disabled/hidden delete button with tooltip: "Undo the training plan day first to delete this run."

### Claude's Discretion

- Whether to show the run detail as a modal or slide-over panel — planner decides based on existing UI patterns.
- Whether filters are always visible or toggled via a "Filter" button — planner decides.
- Exact wording of the coaching prompt injected when a run is logged — planner/researcher can craft this.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Run Logging (RUN-01 through RUN-04) — updated to reflect manual entry only
- `.planning/REQUIREMENTS.md` §AI Coaching Chat (COACH-03, COACH-04) — post-run feedback and plan adjustment

### Architecture
- `CLAUDE.md` §Architecture Decisions — `<plan:update>` and `<plan:add>` tag protocol, plan replace guard, synthetic plan-state context injection, MongoDB patterns, Azure Functions streaming
- `.planning/ROADMAP.md` §Phase 3 — updated deliverables list

### Existing Types & Data Model
- `api/src/shared/types.ts` — Plan, PlanDay, PlanGoal types; Run type needs to be added
- `api/src/functions/plan.ts`, `planDays.ts` — existing day management patterns (PATCH, plan replace guard)
- `api/src/middleware/auth.ts` — requirePassword middleware pattern for new endpoints
- `api/src/shared/db.ts` — shared DB connection pattern
- `api/src/shared/prompts.ts` — buildSystemPrompt signature; synthetic plan-state context injection pattern

### Frontend Patterns
- `web/src/hooks/usePlan.ts` — plan fetching/mutation hook pattern; `plan-updated` window event
- `web/src/contexts/ChatContext.tsx` — shared chat state; how to trigger coach from non-chat UI
- `web/src/pages/Runs.tsx` — placeholder page to implement
- `web/src/components/plan/DayRow.tsx` — extend "Complete" toggle into run entry form flow
- `web/src/components/plan/PlanView.tsx` — where to add run entry form integration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useChat.ts` / `ChatContext` — post-run coaching flows through existing streaming chat; no new streaming infrastructure needed
- `<plan:update>` tag protocol — already wired in `useChat.ts`; coach auto-applies plan adjustments as part of post-run feedback
- `requirePassword` middleware — use for all new run endpoints
- `DayRow` — extend "Complete" button into a run-data prompt flow; currently just a toggle
- `usePlan.ts` — fetches active plan; needs to trigger re-fetch after run logged + plan day linked
- `plan-updated` window event — dispatch after run logging to refresh Training Plan page

### Established Patterns
- Azure Functions HTTP handlers in `api/src/functions/` — new `runs.ts` follows same shape
- MongoDB collection pattern via `getDb()` — runs stored in new `runs` collection
- Error surfacing in chat — `useChat.ts` appends `⚠️ <errors>` on API failure

### Integration Points
- Training Plan page (`DayRow`): "Complete" → run entry form → save → trigger post-run coaching
- New `Runs` page: list + filters + detail modal + "Log a run" button
- `POST /api/chat`: injecting run data as a synthetic user message to trigger post-run coaching
- `POST /api/plan/generate` and `POST /api/plan`: plan replace guard must also block when run data exists

</code_context>

<specifics>
## Specific Requirements

- **Manual entry only** — no ZIP upload, no Blob Storage, no async parsing pipeline.
- **Two entry points** — from DayRow "Complete" AND from Runs page "Log a run" button. Same form, same API.
- **Form fields**: date, distance, duration, avg HR (optional), notes (optional). Pace computed server-side or client-side from distance + duration.
- **Coaching fires automatically** — right after run saved. Coach panel opens. No manual trigger needed.
- **Linked run coaching context**: run + plan day target + full plan state (via existing synthetic context injection).
- **Standalone run coaching context**: run + last 5 completed runs.
- **Coaching insight stored on run record** — visible in run detail modal without scrolling chat.
- **Runs list = all time** — includes runs from archived plans.
- **Detail modal** (not a separate page) — date, distance, time, pace, avg HR, notes, coaching insight, plan link.
- **Delete only if unlinked** — linked runs require undo on the plan day first.
- **Filters** on Runs page: date range, distance range, duration range.

</specifics>

<deferred>
## Deferred Ideas

- **Apple Health ZIP upload** — removed from this phase. Could be added as a separate phase if manual entry proves insufficient. SAS token + Blob trigger approach still valid if revisited.
- **HR zone computation** — deferred to v2 (ANLX-01). Requires time-series HR data not available with manual entry.
- **GPS route display** — v2 (ENCO-03).
- **Weekly volume trends** — Phase 4 / v2 (ANLX-02).
- **Max HR profile field** — no longer needed in Phase 3 without HR zone computation. Defer to v2.
- **Estimated goal time on plan page** — was in prior context (D-14 old). Deferred; can be added when coach has enough run history to estimate.
- **Retroactive coaching on "Add run data"** — D-09 explicitly excludes auto-trigger on retroactive data entry. User can ask coach manually.

</deferred>

---

*Phase: 03-run-logging*
*Context gathered: 2026-03-29 (revised from 2026-03-28)*
