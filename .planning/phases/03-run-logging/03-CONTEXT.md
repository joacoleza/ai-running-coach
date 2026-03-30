# Phase 3: Run Logging & Feedback — Context

**Gathered:** 2026-03-31 (revised — date management, manual feedback, manual linking)
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the run data loop: user logs a run manually (via a form on the Training Plan page or the Runs page), the data is stored and optionally linked to the training plan, and the user can request post-run coaching feedback. The Runs page becomes a functional run history list with detail view and filters.

This phase does NOT include:
- Apple Health ZIP upload (removed — manual entry is sufficient)
- Dashboard/progress views (Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Date on Runs — Required, User-Set

- **D-01:** Run logging is **manual entry only**. No file upload, no ZIP, no async parsing.
- **D-02:** Run entry is available from **two places**:
  1. **Training Plan page** — click "Complete" on a plan day → run entry form opens (no pre-filled date since days have no scheduled date — label only). Datepicker defaults to today. On save: run created + linked to the day + day marked complete.
  2. **Runs page** — standalone "Log a run" button → same form, **no plan link**. Runs created this way are always unlinked until the user links them manually from the training plan.
- **D-03:** Form fields:
  - Date (required, defaults to today — user must confirm or change)
  - Distance (required, respects user's km/miles preference)
  - Duration / time (required, e.g. "45:30")
  - Avg HR / BPM (optional)
  - Notes (optional, free text)
  - Pace is **computed** from distance + duration — not entered manually
- **D-04:** Date display format: **"Monday 03/04/2026"** (day-of-week + DD/MM/YYYY). This applies everywhere a run date is shown.
- **D-05:** HR zones are **not computed** in Phase 3. Avg HR stored as-is. Zone charts deferred to v2 (ANLX-01).

### Days Have No Scheduled Dates (Label-Based Model)

- **D-06:** Training plan days are labeled A–G within each week (no calendar dates). `PlanDay.label` is "A"–"G" for non-rest days, "" for rest days. `PlanWeek.weekNumber` is globally sequential. Routes use `plan/days/{week}/{day}`.
- **D-07:** Completed days show the **actual run date** (from the linked run record, formatted per D-04). This is visible on the training plan view, not editable from there (edit via the run detail modal on the Runs page).

### Run-to-Plan Linking Rules

- **D-08:** Runs logged from the **Runs page** are created **unlinked** (no plan association). There is no automatic date-based linking.
- **D-09:** Runs logged via **"Complete" on a plan day** are linked immediately on save. Day is marked complete automatically.
- **D-10:** Linking an existing unlinked run to a plan day (from the Training Plan page) → day is automatically marked as complete.
- **D-11:** A plan day shows a **"Link run"** affordance (button) when not completed and not skipped. Clicking it shows a modal/list of **unlinked runs** (date, distance, pace) for the user to choose from.
- **D-12:** Each plan day can have at most **one linked run**. Already-completed days cannot be re-linked (must undo first).
- **D-13:** Archived plan days can still have runs linked (same rules apply — for recording training history).

### Completing a Training Plan Day

- **D-14:** Clicking "Complete" on an active plan day opens the run entry form. On submit:
  - Run record created
  - Run linked to the day (weekNumber + label)
  - Day marked completed via `PATCH /api/plan/days/{week}/{day}` with `completed: 'true'`
  - No automatic coaching feedback — user triggers it manually.
- **D-15:** Undo on a completed day that has a linked run → **unlink only**: day reverts to not-completed, run record stays in the Runs list (unlinked). The run is not deleted. This requires extending the existing undo logic in `planDays.ts`.

### Plan Protection Against Replacement

- **D-16:** The coach cannot regenerate a plan from scratch if any days have linked run data. Informs the user and suggests alternatives.
- **D-17:** Archiving a plan IS allowed even if it has linked run data.

### Post-Run Coaching — Manual Trigger Only

- **D-18:** Post-run coaching is **NOT triggered automatically** after a run is saved. No auto-open of CoachPanel, no auto-sent message.
- **D-19:** The user can trigger feedback in two ways:
  1. **Chat** — ask the coach naturally ("give me feedback on my last run", "how am I doing?")
  2. **"Add feedback to run" button** in the run detail modal on the Runs page
- **D-20:** "Add feedback to run" flow:
  - Opens the CoachPanel (setCoachOpen(true) via AppShell state, exposed via context or prop)
  - Auto-sends a pre-composed message with the run data: date, distance, pace, avg HR, notes, plus linked plan day target (if linked)
  - Claude streams the response
  - Once the response is complete (done event), the insight text is **saved to the run record** (`run.insight`) via `PATCH /api/runs/:id`
- **D-21:** If the run is linked to a training plan day, feedback covers: run vs plan comparison, one coaching insight, optional plan adjustment via `<plan:update>`.
- **D-22:** If the run is standalone (no plan link), feedback covers: run summary, one insight, using the last 5 completed runs as context.

### Training Plan Progress Feedback

- **D-23:** The training plan has a `progressFeedback` field (string) stored on the plan document.
- **D-24:** Shown in a **collapsible section on the Training Plan page** (below the plan goal/target date area). Label: "Coach Feedback". Hidden/collapsed when empty.
- **D-25:** Triggered two ways:
  1. **Chat** — user asks the coach ("how is my training going?", "am I on track?")
  2. **"Get feedback" button** near the plan goal area on the Training Plan page
- **D-26:** "Get feedback" button flow: opens CoachPanel, auto-sends a plan assessment prompt. Once Claude responds, the response text is saved to `plan.progressFeedback` via `PATCH /api/plan`. The collapsible section shows it.

### Agent Context — Run Insights Injected

- **D-27:** The synthetic plan-state context injection in `chat.ts` is extended to include, for each completed day:
  - The actual run date (DD/MM/YYYY)
  - Logged distance and pace
  - Coaching insight text (if any, truncated to ~150 chars)
- **D-28:** The `plan.progressFeedback` text (if set) is also injected near the top of the synthetic context so the agent is aware of previous feedback.

### Runs Page — List + Detail + Filters

- **D-29:** Runs page lists ALL runs in reverse date order (newest first), including runs from archived plans.
- **D-30:** Infinite scroll (load 20 at a time, fetch more on scroll).
- **D-31:** Filters: date range, distance range, time/duration range (toggled via a "Filter" button).
- **D-32:** Each run row shows: date (DD/MM/YYYY), distance, duration, pace, avg HR (if set). Linked plan day shown as a badge (e.g., "Week 3 · Day B").
- **D-33:** Clicking a run opens a **detail modal** showing:
  - Date (editable — date picker), distance, duration, pace (computed read-only), avg HR, notes (all editable)
  - Coaching insight (if available) — read-only
  - Plan link badge (if linked: "Week X · Day Y")
  - "Add feedback to run" button
  - Delete button — only if run has no `planId`
- **D-34:** Linked runs: delete button disabled with tooltip "Undo the training plan day first to delete this run."
- **D-35:** Unlinked runs: delete button active → `DELETE /api/runs/:id` → close modal + refresh list.

### Claude's Discretion

- Whether filters are always visible or behind a toggle button — planner decides.
- Exact wording of the pre-composed coaching prompts for "Add feedback" and "Get feedback" buttons.
- How to save insight after chat completes — use the existing `done` event in `sendMessage` or a follow-up PATCH.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Run Logging (RUN-01 through RUN-04)
- `.planning/REQUIREMENTS.md` §AI Coaching Chat (COACH-03, COACH-04)

### Architecture
- `CLAUDE.md` §Architecture Decisions — key patterns:
  - Day labels A–G, week numbers globally sequential (label-based model — NO calendar dates on plan days)
  - Routes: `plan/days/{week}/{day}` where week is integer, day is A–G
  - `<plan:update>` tag protocol, plan replace guard
  - Synthetic plan-state context injection (to be extended in this phase)
  - `plan-updated` window event dispatch
  - `useChatContext()` not `useChat()` in components
  - `npm run build` in web/ mandatory before committing
- `.planning/ROADMAP.md` §Phase 3

### Existing Types & Data Model
- `api/src/shared/types.ts` — Plan (has `progressFeedback?: string` to add), PlanDay (`label: string`, no `date`), PlanWeek (`weekNumber: number`), Run type needs to be added
- `api/src/functions/planDays.ts` — route `plan/days/{week}/{day}`, arrayFilters by `weekNumber` and `label`, undo logic to extend
- `api/src/functions/plan.ts` — plan queries, plan PATCH to add
- `api/src/middleware/auth.ts` — requirePassword pattern
- `api/src/shared/db.ts` — getDb pattern
- `api/src/shared/prompts.ts` — buildSystemPrompt, synthetic injection
- `api/src/functions/chat.ts` — synthetic plan-state injection point to extend

### Frontend Patterns
- `web/src/hooks/usePlan.ts` — `updateDay(weekNumber, label, updates)`, `deleteDay(weekNumber, label)`, `plan-updated` event
- `web/src/contexts/ChatContext.tsx` — `sendMessage(text)` to trigger coaching programmatically
- `web/src/pages/Runs.tsx` — placeholder to implement
- `web/src/components/plan/DayRow.tsx` — has `weekNumber` prop + `onUpdate(weekNumber, label, updates)` + `onDelete(weekNumber, label)`; extend "Complete" toggle into run entry form flow; add "Link run" button
- `web/src/components/plan/PlanView.tsx` — add progress feedback section; pass link-run handlers down
- `web/src/components/AppShell.tsx` — CoachPanel open/close state

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useChat.ts` / `ChatContext` — `sendMessage(text)` triggers coaching programmatically; existing streaming infrastructure
- `<plan:update>` tag protocol — already wired in useChat.ts
- `requirePassword` middleware — use for all new run endpoints
- `DayRow` — has `weekNumber` prop; "Complete" is currently a toggle; extend to open run entry form
- `usePlan.ts` — `updateDay(weekNumber, label, updates)` / `deleteDay(weekNumber, label)` / `refreshPlan()` / `plan-updated` event

### Established Patterns
- Azure Functions HTTP handlers in `api/src/functions/` — new `runs.ts` follows same shape as planDays.ts
- MongoDB via `getDb().collection(name)` — runs stored in new `runs` collection
- Error surfacing in chat — useChat.ts appends `⚠️ <errors>` on API failure

### Integration Points
- Training Plan (`DayRow`): "Complete" → run entry form → save → no auto-coaching
- Training Plan (`PlanView`): "Link run" per active day → unlinked runs list → link → day auto-completed
- Training Plan: progress feedback collapsible + "Get feedback" button → `sendMessage`
- Runs page: list + filters + detail modal + "Log a run" + "Add feedback" → `sendMessage`
- `POST /api/chat`: extended synthetic injection includes run data

</code_context>

<specifics>
## Specific Requirements

- **Manual entry only** — no ZIP, no Blob Storage, no async parsing.
- **Label-based days** — days are A–G within each week. No scheduled dates. Completed days show actual run date.
- **Date format**: "Monday 03/04/2026" (day-of-week + DD/MM/YYYY). Used everywhere.
- **Two entry points** — DayRow "Complete" (linked) AND Runs page "Log a run" (unlinked).
- **No auto-feedback** — coaching is always user-triggered.
- **"Add feedback to run"** in run detail → opens CoachPanel → auto-sends → insight saved to run record.
- **"Get feedback" button** on Training Plan → opens CoachPanel → auto-sends → saved to `plan.progressFeedback`.
- **Insight collapsible section** on Training Plan page (below goal area).
- **Agent sees insights** — synthetic context extended with run data + progressFeedback.
- **Link run from training plan** — "Link run" per active day → modal with unlinked runs → select → day auto-completed.
- **Undo completed day** with linked run → unlinks run only; run stays in Runs list.

</specifics>

<deferred>
## Deferred Ideas

- **Apple Health ZIP upload** — removed from this phase.
- **HR zone computation** — deferred to v2 (ANLX-01).
- **GPS route display** — v2 (ENCO-03).
- **Weekly volume trends** — Phase 4 / v2 (ANLX-02).
- **Estimated goal time on plan page** — deferred.

</deferred>

---

*Phase: 03-run-logging*
*Context gathered: 2026-03-31 (revised — label-based model, date management overhaul, manual feedback, manual linking)*
