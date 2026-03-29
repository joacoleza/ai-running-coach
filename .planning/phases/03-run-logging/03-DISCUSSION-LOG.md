# Phase 3: Run Logging & Feedback — Discussion Log

**Date:** 2026-03-28
**Format:** Interactive (AskUserQuestion)

---

## Areas Discussed

All four original gray areas were discussed, plus the user provided significant upfront context covering run-to-plan linking rules, completion flow, runs list UI, plan creation with past runs, undo behavior, coach feedback visibility, and plan protection.

---

## Q&A Log

### Gray Area Selection

**Q:** Which areas do you want to discuss for Phase 3 — Run Logging & Feedback?

**A:** All areas plus significant upfront context:
- Upload mechanism unclear (can't find Apple Health XML export)
- Detailed run-to-plan linking rules provided
- Completion flow: prompt for run data, agent-created dates can have data added later
- Runs section: list all runs (including archived plans), date order, infinite scroll, filters (date range, distance, time), link to associated plan
- Plan creation with past run data: coach must ask for time + distance before creating past completed days
- Undo completed + linked run: unlink only (keep run), ability to delete unlinked runs
- Coach insights field + estimated goal time on plan page
- Clicking complete should prompt for run data
- Agent cannot discard plan with run data

---

### Run Input Method

**Q:** How should you log a run into the app?

**A:** Manual entry form should be possible. Also wants Apple Health ZIP export — asked to be guided through the export process.

**Clarification provided:** Apple Health export = Health app → profile icon → Export All Health Data → ZIP with export.xml.

**Decision:** Support BOTH manual entry AND Apple Health ZIP upload.

---

### Completion Flow

**Q:** When you tap 'Complete' on a training plan day, what should happen?

**A:** Option 1 (prompt for run data). Note: agent-created completed dates should also be able to have data added later.

**Decision:** Prompt for time + distance (required), bpm (optional). Agent-created completed dates without data get a retroactive "Add run data" affordance.

---

### Post-Run Coach Output

**Q:** After a run is logged, what should the coach produce?

**A:** All three options: chat feedback, insights field on run record, estimated goal time on plan. Plus: a training plan field showing the latest coaching note — always visible, not just in chat.

**Decision:** Four outputs — (1) chat streaming feedback, (2) insights on run record, (3) estimated finish time on plan page, (4) "Latest coach insight" always-visible field on Training Plan page.

---

### Upload Options

**Q:** Should Phase 3 support both manual entry AND Apple Health ZIP upload, or start with just one?

**A:** Both (Recommended).

**Decision:** Both methods in Phase 3.

---

### Coach Summary Field

**Q:** For the 'coach feedback' field always visible on the Training Plan page — what is it?

**A:** Latest insight from coach (Recommended) — single field showing most recent post-run note, replaced after each run.

---

### Past Runs During Plan Creation

**Q:** When creating a new plan via chat, if past completed runs are mentioned, how much run data is required?

**A:** Time + distance required, bpm optional (Recommended).

---

### Conflict Rule (Duplicate Run for Same Date)

**Q:** If you try to log a run for a date that's already completed and has run data linked — what happens?

**A:** Reject the upload with an error (Recommended).

---

### Undo With Linked Run

**Q:** If a training plan day is completed AND has run data linked, and you tap Undo — what should happen?

**A:** Option 2 (Unlink only, keep run). Note: there should be a way to delete runs that are not linked to any day.

**Decision:** Undo unlinks run, run stays in Runs list. Runs with no plan link are deletable from Runs page.

---

### Plan Protection

**Q:** If the coach tries to archive or replace the active plan and it has logged run data — what happens?

**A:** Option 1 (Block the action). Note: user CAN archive plans — archiving is completing them.

**Decision:** Archiving allowed (run data preserved). Agent cannot regenerate/replace from scratch if run data exists. Archiving ≠ discarding.

---

## Scope Notes

Items noted but deferred:
- GPS route display (v2 ENCO-03)
- HR zone charts/visualization (v2 ANLX-01)
- Strava/Garmin integrations (out of scope PROJECT.md)
- Screenshot OCR (out of scope PROJECT.md)
- Weekly volume trends (Phase 4 / v2)
