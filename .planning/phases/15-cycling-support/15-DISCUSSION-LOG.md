# Phase 15: Cycling Support - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 15-cycling-support
**Areas discussed:** Speed storage approach, Coach context format, Dashboard scope, Cycling session type

---

## Speed Storage Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Compute at display time | No new DB field; speed calculated on the fly in UI from distance+duration | ✓ |
| Add a `speed` field to MongoDB | API computes and stores speed (km/h) alongside pace; Phase 16 aggregations easier | |
| Reuse `pace` field for km/h | Store km/h in `pace` for cycling sessions; makes `pace` discipline-dependent | |

**User's choice:** Compute at display time — no schema changes, no migration needed
**Notes:** User asked for clarification on the difference vs run storage. Explained that running stores `pace` (min/km) computed from distance+duration; cycling sessions currently also store this meaningless value. Agreed to compute speed on the fly and ignore `pace` for cycling in the UI.

---

## Coach Context Format

| Option | Description | Selected |
|--------|-------------|----------|
| 'Cycled: date, distance @ speed' | Discipline-aware label; coach says 'you cycled' not 'you ran' | ✓ |
| Keep 'Ran:', change metric only | Same label, different metric — coach might refer to bike rides as runs | |

**User's choice:** "Cycled: date, Xkm @ Y km/h" — discipline-appropriate label
**Notes:** Coach context becomes `| Cycled: DD/MM/YYYY, 30km @ 25.0 km/h` for cycling sessions.

---

## Dashboard Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing — defer all to Phase 16 | Phase 15 touches only Runs page, form, and detail modal | ✓ |
| Update speed display inline | Partial dashboard work now; full redesign in Phase 16 | |

**User's choice:** No dashboard changes in Phase 15
**Notes:** CYCLE-02 mentions "dashboard" but Phase 16 is specifically the multi-discipline dashboard redesign (DASH-01 through DASH-04). All dashboard changes deferred cleanly to Phase 16.

---

## Cycling Session Type

| Option | Description | Selected |
|--------|-------------|----------|
| No subtypes — keep simple | CYCLE-01 doesn't mention type; no scope creep | ✓ |
| Add road / indoor / MTB | Consistent with gym type field; meaningful cycling subtypes | |

**User's choice:** No session type for cycling
**Notes:** Requirements don't mention it. Keeping the entry form simple.

---

## Claude's Discretion

- Speed computation helper design: shared utility vs inline per component
- Whether to extract `formatSpeed` as a shared function or inline the small computation
- Speed decimal places and format (e.g., "25.0 km/h" vs "25 km/h")

## Deferred Ideas

- Cycling session types (road/indoor/MTB) — noted for potential later phase
- Dashboard speed adaptations — cleanly deferred to Phase 16
