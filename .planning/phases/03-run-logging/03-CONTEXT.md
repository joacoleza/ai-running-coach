# Phase 3: Run Logging & Feedback — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the run data loop: user logs a run (via manual entry or Apple Health ZIP upload), the data is stored and linked to the training plan, and the coach generates post-run feedback visible in chat and as a persistent field on the plan page. The Runs page becomes a functional run history list.

This phase does NOT include the dashboard/progress views (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Run Data Entry — Dual Input Method

- **D-01:** Support BOTH manual entry AND Apple Health ZIP upload. User chooses per run.
  - **Manual entry:** time (required), distance (required), bpm/avg HR (optional). Quick, no file needed.
  - **ZIP upload:** Apple Health `export.xml` parsed for full workout data — distance, duration, avg/max HR, pace, cadence, elevation. Background async processing.
- **D-02:** The Apple Health ZIP upload path uses the existing ROADMAP architecture: SAS token → direct Blob Storage upload (bypasses 30 MB SWA proxy limit) → Blob trigger Azure Function SAX-parses `export.xml`, extracts workouts.
- **D-03:** Max HR is required for HR zone computation. Must be added to the user's plan goal/profile. If not set, HR zones are skipped (no blocking error).

### Run-to-Plan Linking Rules

- **D-04:** When a run is logged for a date matching the **active plan**:
  1. Date exists and is not completed/skipped → link run, mark day completed
  2. No day entry for that date → create a new day entry, link run, mark completed
  3. Date was skipped → unskip it, mark completed, link run
  4. Date is already completed (regardless of whether run data exists) → **reject with error** (409)

- **D-05:** When a run is logged for a date matching an **archived plan**:
  1. Date not run or skipped → accept run, store it, but do NOT link to the archived day
  2. Date was completed without run data linked → link the run to that archived day
  3. Date already has a run linked → reject with error

- **D-06:** When a run has no matching plan date (no active or archived plan covers that date) → store the run unlinked. No error.

### Completing a Training Plan Day

- **D-07:** When user taps "Complete" on an active training plan day, show a form prompting for:
  - Time (required)
  - Distance (required)
  - Average BPM (optional)
  - Confirms → day marked complete, run record created and linked
- **D-08:** Agent-created completed days (e.g., during plan creation with historical data) may have no run data initially. A "Add run data" affordance should appear on completed days that have no linked run — so the user can fill in data retroactively.
- **D-09:** When the coach creates a plan via chat and mentions past completed runs, the coach MUST ask for time and distance for each mentioned run before proceeding. BPM is optional. Without time + distance, the past run cannot be logged in the registry.

### Undo a Completed Day (When Run is Linked)

- **D-10:** Undo on a completed day that has a linked run → **unlink only**: day reverts to not-completed, run record stays in the Runs list. The run is not deleted.
- **D-11:** Runs without any plan link are **deletable** from the Runs page. Runs linked to a plan day are protected from deletion (user must undo the day first, which unlinks the run, then delete from Runs).

### Plan Protection Against Replacement

- **D-12:** The coach (in chat) cannot discard or regenerate a plan from scratch if any days have linked run data. The coach informs the user why and suggests alternatives (e.g., adjust specific days).
- **D-13:** Archiving a plan IS allowed even if it has linked run data. Archiving = completing the plan cycle. The linked runs remain associated with the archived plan's days.

### Post-Run Coaching Output

- **D-14:** After a run is logged (either method), the coach generates post-run feedback:
  1. **Chat feedback** — streamed to the coach panel (existing infrastructure). Run vs plan comparison, one insight, any plan adjustment using `<plan:update>` tags.
  2. **Insights field on run record** — the same or condensed coaching note stored on the run document. Viewable on the run detail page.
  3. **Coach feedback field on Training Plan page** — a "Latest coach insight" section always visible at the top of the active plan. Shows the most recent post-run coaching note. Replaced after each run upload. User doesn't need to scroll through chat history to find it.
  4. **Estimated goal time** — a field next to the goal/target date on the Training Plan page (e.g., "Estimated finish: ~2h05m"). Updated by the coach after each run upload based on current fitness trajectory.

### Async Upload UX (ZIP path)

- **D-15:** ZIP upload flow: immediate "Uploading..." → "Parsing..." (while Blob trigger runs) → "Done — run logged". Frontend polls for parse completion status.
- **D-16:** After successful processing (either entry method), navigate user to the Runs page or open the Coach panel to show feedback.

### Runs Page — List View

- **D-17:** Runs page lists ALL runs in reverse date order (newest first), including runs from archived plans.
- **D-18:** Infinite scroll (no pagination).
- **D-19:** Filters at the top: date range, distance range, time range.
- **D-20:** Each run row shows: date, distance, time, pace, optional bpm. Click → run detail page.
- **D-21:** Run detail page includes: all run fields + insights text + link to associated training plan (active or archived). If no plan association, no link shown.
- **D-22:** Run detail page includes a Delete button — visible only if the run has no linked plan day. If linked, the button is disabled/hidden (user must undo the day first).

### Max HR Configuration

- **D-23:** Max HR is added to the user's profile/plan goal. Can be set during onboarding or edited on the plan page. Defaults to empty (HR zones not computed until set). Used by ZIP upload parser for zone computation; not needed for manual entry.

### Claude's Discretion

- HR zone display on run detail: whether to show a zone breakdown bar/chart or just the zone label (e.g., "Zone 3 — Aerobic") is left to planner discretion.
- ZIP parse scope: whether to extract all workouts since last upload or a configurable lookback window (e.g., 30 days) — planner decides based on performance and usability.
- Whether coach feedback fires immediately after parse or after a brief "view your run?" prompt is planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Run Logging (RUN-01 through RUN-05) — acceptance criteria for upload, parse, HR zones, plan matching, async UX
- `.planning/REQUIREMENTS.md` §AI Coaching Chat (COACH-03, COACH-04) — post-run feedback and plan adjustment requirements

### Architecture
- `CLAUDE.md` §Architecture Decisions — `<plan:update>` and `<plan:add>` tag protocol, plan replace guard, plan archive guard, MongoDB patterns, Azure Functions streaming setup
- `.planning/ROADMAP.md` §Phase 3 — original deliverables list (SAS token flow, Blob trigger, SAX parse, HR zones, run-to-plan matching, polling UX)

### Existing Types & Data Model
- `api/src/shared/types.ts` — Plan, PlanDay, PlanGoal types to extend (Run type needs to be added)
- `api/src/functions/plan.ts`, `planDays.ts` — existing day management patterns to follow
- `api/src/middleware/auth.ts` — requirePassword middleware pattern for new endpoints
- `api/src/shared/db.ts` — shared DB connection pattern

### Frontend Patterns
- `web/src/hooks/usePlan.ts` — plan fetching/mutation hook pattern
- `web/src/contexts/` — ChatContext shared state pattern
- `web/src/pages/Runs.tsx` — placeholder page to implement
- `web/src/components/plan/` — DayRow and PlanView components to extend for completion flow

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useChat.ts` / `ChatContext` — post-run coaching feedback flows through existing streaming chat infrastructure; no new streaming needed
- `<plan:update>` tag protocol — already wired in `useChat.ts`; coach can auto-apply plan adjustments as part of post-run feedback
- `requirePassword` middleware — use for all new run endpoints
- `DayRow` — needs a "Complete" flow extension (currently just a toggle); becomes a prompt-for-run-data flow
- `usePlan.ts` — fetches active plan; will need to trigger re-fetch after run logged + plan day linked

### Established Patterns
- Azure Functions HTTP handlers in `api/src/functions/` — new `runs.ts` and `runUpload.ts` follow same shape
- MongoDB collection pattern via `getDb()` — runs stored in new `runs` collection
- `plan-updated` window event — `useChat` dispatches it after `plan:update`; run logging should dispatch same event to refresh Training Plan page
- Error surfacing in chat — `useChat.ts` appends `⚠️ <errors>` to assistant message on API failure; run parse errors should use same pattern

### Integration Points
- Training Plan page: add "Latest coach insight" section + "Estimated finish time" field — connects to active plan document
- `DayRow`: extend "Complete" button to open run data prompt form
- New `Runs` page: full implementation replacing placeholder
- Sidebar nav: Runs already has a nav entry — just needs the page to work
- `POST /api/plan/generate` and `POST /api/plan`: the plan replace guard must also check for linked run data (extend existing guard)

</code_context>

<specifics>
## Specific Requirements

- **Both input methods in Phase 3**: manual entry form AND Apple Health ZIP upload. Not one-or-the-other.
- **"Latest coach insight" on plan page**: a distinct, always-visible field — not inside the chat panel. User should not need to scroll through chat history to find last coaching note.
- **Estimated finish time**: displayed next to goal and target date on Training Plan page. e.g., "Goal: Half Marathon · Target: 2026-09-15 · Est. finish: ~2h05m". Updated by coach on every run upload.
- **Runs list = all time**: includes runs from archived plans. Not filtered to active plan only.
- **Delete runs**: only deletable if unlinked (no plan day association). Linked runs require undo on the plan day first.
- **Max HR**: new profile field — needed for HR zone computation from ZIP data. Optional, not blocking.
- **Plan protection**: archiving with run data is OK (archiving = finishing the plan). Regenerating from scratch is blocked.
- **Apple Health ZIP**: the ZIP is produced from iPhone Health app → profile icon → Export All Health Data. The parser should handle large files gracefully (100–500 MB typical).

</specifics>

<deferred>
## Deferred Ideas

- **GPS route display** — from Apple Health `.gpx` files. Mentioned in v2 REQUIREMENTS (ENCO-03). Out of scope for Phase 3.
- **HR zone charts** — visual zone breakdown per run (v2: ANLX-01). Phase 3 stores zone data; visualization deferred.
- **Strava/Garmin integrations** — explicitly out of scope per PROJECT.md.
- **Screenshot OCR** — considered as upload alternative. Out of scope per PROJECT.md ("Screenshot-based run data entry — structured XML export is more reliable"). Manual entry covers the lightweight case.
- **Weekly volume trends** (ANLX-02) — deferred to Phase 4 / v2.

</deferred>

---

*Phase: 03-run-logging*
*Context gathered: 2026-03-28*
