# Phase 5: Missing Features — Discussion Log

*Generated: 2026-04-10*
*For human reference only — not consumed by downstream agents*

---

## Areas Selected

User selected all 4 gray areas: Add phase/week, Target date editing, Agent run creation, Chat-triggered run insights.

---

## Area 1: Add phase/week

**Q: What should the manual UI look like?**
Options: Add phase button at bottom / Add week inside each phase / Both
→ **Selected: Add phase button at bottom of plan**

**Q: When user adds a new phase manually, what defaults?**
Options: Empty phase with 1 empty week / Agent fills automatically / Modal with name + week count
→ **Selected: Empty phase with 1 empty week** (default name "Phase N", user edits inline)

**Q: Should the agent be able to add a phase via chat?**
Options: Yes — `<plan:add-phase>` XML / No — manual only
→ **Selected: Yes — `<plan:add-phase name="..." description="..."/>`**

---

## Area 2: Target date editing

**Q: How should target date be edited?**
Options: Inline click-to-edit in header / Goal edit page / Agent only
→ **Selected: Inline click-to-edit, also by chat with agent. Make target date optional.**
*(User note: "Make target date an optional field")*

**Q: Should agent update target date via tag?**
Options: Yes — `<plan:update-goal targetDate="..."/>` / No — manual only
→ **Selected: Yes — `<plan:update-goal targetDate="..."/>`**

---

## Area 3: Agent run creation

**Q: What should the agent emit to create a run?**
Options: `<run:create>` tag / Agent suggests only / `<run:create>` without plan link
→ **Selected: `<run:create>` with run data** (POSTs to `/api/runs`, can include weekNumber+dayLabel for linking)

**Q: Required fields for `<run:create>`?**
Options: date + distance + duration / date + distance only / All fields required
→ **Selected: date + distance + duration** (avgHR, notes, weekNumber, dayLabel optional)

---

## Area 4: Chat-triggered run insights

**Q: Should agent save insight to run record from natural chat?**
Options: Yes — `<run:update-insight runId="..." insight="..."/>` / No — button only / Yes — most recent run only
→ **Selected: Yes — `<run:update-insight runId="..." insight="..."/>`**

**Q: Should user see a notification when insight is saved?**
Options: Silent save / Toast notification
→ **Selected: Silent save** — insight appears next time user opens the run detail modal

---

## Summary

| Area | Key Decision |
|------|-------------|
| Add phase | `+ Add phase` button in PlanView + `<plan:add-phase>` agent command |
| Target date | Inline click-to-edit; optional field; `<plan:update-goal>` agent command |
| Agent run creation | `<run:create>` tag; required: date+distance+duration; optional: plan link |
| Run insights | `<run:update-insight runId="...">` tag; silent save |
