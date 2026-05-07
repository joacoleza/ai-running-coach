# Phase 15: Cycling Support - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15 delivers four capabilities:

1. **Cycling session logging** — User can log a cycling session (date, distance, duration, optional HR, optional notes). No session type subtypes.
2. **Speed display** — Wherever pace (min/km) appears for run sessions, speed (km/h) appears for cycling sessions — in the entry form, runs list, session detail modal, and link run modal.
3. **Cycling plan days** — Coach can generate cycling plan days with distance and duration targets via `<plan:add>` / `<plan:update>` XML tags.
4. **Cycling coach context** — Coach receives cycling session history formatted as "Cycled: date, Xkm @ Y km/h" in the synthetic plan-state context.

This phase does NOT include:
- Dashboard changes — all dashboard work deferred to Phase 16 (multi-discipline dashboard redesign)
- Cycling session types/subtypes (road / indoor / MTB) — not in CYCLE-01 requirements
- Any new DB schema fields for speed — computed at display time only

</domain>

<decisions>
## Implementation Decisions

### Speed Storage and Computation

- **D-01:** Speed is NOT stored in the database. It is computed at display time from `distance` and `duration` wherever needed. Formula: `speed_kmh = (distance_km / totalMinutes) * 60`. The existing `pace` field on cycling run documents is irrelevant and should be ignored in the UI for cycling sessions.
- **D-02:** No new fields added to the `Run` interface or MongoDB schema. No migration required.
- **D-03:** Speed display format: one decimal place, e.g. "25.0 km/h". Implementation detail is Claude's discretion but must include the unit label.

### UI — Speed Replaces Pace for Cycling

- **D-04:** In `RunEntryForm`: the "Pace" label/display field (currently shown for non-gym sessions) becomes "Speed" for cycling sessions and shows computed km/h. Still read-only (computed, not entered).
- **D-05:** In `Runs.tsx` (inline run row): the `formatPace(run.pace)` shown in the summary line is replaced with speed for cycling sessions.
- **D-06:** In `RunDetailModal`: the "Pace" label and value switches to "Speed (km/h)" for cycling sessions. Editing distance/duration recomputes and shows speed.
- **D-07:** In `LinkRunModal`: the run list item `distance · duration · pace` switches pace to speed for cycling sessions.

### Coach Context Format

- **D-08:** `chat.ts` synthetic context line for cycling sessions: `| Cycled: DD/MM/YYYY, Xkm @ Y.Y km/h`. This is discipline-aware — "Cycled:" replaces "Ran:" for `discipline === 'cycle'`.
- **D-09:** Notes, insight, and RunId lines remain identical for all disciplines (already in place).

### Coach Plan Generation (CYCLE-03)

- **D-10:** System prompt already covers cycling plan days as of Phase 13. Verify no changes needed. If anything is missing, the plan day example in `prompts.ts` should already handle: `<plan:add week="N" day="X" type="cross-train" discipline="cycle" objective_kind="distance" objective_value="30" objective_unit="km" guidelines="Easy bike ride" />`.

### Dashboard Scope

- **D-11:** Phase 15 makes NO changes to the dashboard. All dashboard speed/discipline adaptations are Phase 16's responsibility (DASH-01 through DASH-04).

### Cycling Session Type

- **D-12:** No session type field for cycling. CYCLE-01 does not mention it. Keep the entry form simple.

### Claude's Discretion

- Speed computation helper: whether to extract into a shared utility (e.g. `computeSpeed(distance, duration): string`) or inline per component — keep it simple and consistent.
- Whether to extract `formatSpeed` as a shared utility alongside the existing `formatPace` helpers in each component, or duplicate the small computation — consistency preferred.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §CYCLE — CYCLE-01 through CYCLE-04 are the requirements for this phase

### Key Implementation Files (Integration Points)
- `web/src/components/runs/RunEntryForm.tsx` — Entry form; "Pace" display (line ~196) needs to switch to speed for cycling
- `web/src/pages/Runs.tsx` — Inline run summary (line ~36): `formatPace(run.pace)` → speed for cycle
- `web/src/components/runs/RunDetailModal.tsx` — "Pace" label and value (line ~270) → "Speed" for cycle; `formatPace` at lines 32–35 and 110, 119, 270
- `web/src/components/runs/LinkRunModal.tsx` — Run list item (line ~126): `formatPace(run.pace)` → speed for cycle
- `api/src/functions/chat.ts` — Cycling context line (line ~164–166): `| Ran: ...` → `| Cycled: ... @ Y km/h`
- `api/src/shared/prompts.ts` — Verify cycling plan day instructions are sufficient (already added in Phase 13)

### Architecture Decisions (CLAUDE.md)
- Run data model: `distance` (number), `duration` (MM:SS or HH:MM:SS string), `pace` (computed decimal min/km — 0 for gym sessions), `discipline?` ('run'|'gym'|'cycle')
- Multi-discipline sessions: for gym `distance` defaults to 0; for run/cycle `distance` is required
- CLAUDE.md: "Discipline filter tabs in Runs page" and "RunBadge component" patterns already established in Phase 14

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RunEntryForm.tsx`: Already has `isGym` check pattern — use parallel `isCycle = discipline === 'cycle'` for speed display
- `RunBadge.tsx`: Already renders green badge for 'cycle' — no changes needed
- Filter tabs in `Runs.tsx`: Already include 'cycle' option — no changes needed
- `api/src/shared/prompts.ts`: Cycling plan day examples already exist from Phase 13 — verify only

### Established Patterns
- `isGym = discipline === 'gym'` check in `RunEntryForm` — use same pattern for cycling
- `formatPace(pace)` helper exists in 4 files (RunDetailModal, Runs.tsx, LinkRunModal, chat.ts) — add `formatSpeed(distance, duration)` or compute inline
- Pace is read-only/computed, not user-entered — speed follows same pattern (computed, displayed)

### Integration Points
- `RunEntryForm.tsx` line ~54: `const pace = isGym ? '' : computePaceDisplay(...)` — add cycling branch
- `RunEntryForm.tsx` line ~196: "Pace" label row — conditionally show "Speed" for cycling
- `Runs.tsx` line ~36: inline summary string — replace `formatPace(run.pace)` with speed for cycle
- `RunDetailModal.tsx` line ~110: `const paceStr = formatPace(run.pace)` used in chat copy
- `RunDetailModal.tsx` line ~270: pace display in detail stats — swap label and value for cycling
- `chat.ts` line ~164–166: `| Ran:` and `@ ${formatPace}/km` lines — discipline-gate for cycling

</code_context>

<specifics>
## Specific Ideas

- Speed label in all UI locations: "Speed" (not "Pace") — with unit "km/h" shown inline
- Format: "25.0 km/h" (1 decimal, space before unit) — consistent with how pace shows "/km" suffix
- Coach context: "| Cycled: DD/MM/YYYY, Xkm @ 25.0 km/h" — parallel to "| Ran: DD/MM/YYYY, Xkm @ 5:30/km"

</specifics>

<deferred>
## Deferred Ideas

- Cycling session types (road / indoor / mountain bike) — not in requirements, could be a later phase
- Dashboard speed display for cycling — fully deferred to Phase 16 (DASH-01 through DASH-04)
- Average speed aggregation in dashboard — Phase 16 concern
- Storing `speed` as a DB field — not needed; compute at display time is sufficient

</deferred>

---

*Phase: 15-cycling-support*
*Context gathered: 2026-05-05*
