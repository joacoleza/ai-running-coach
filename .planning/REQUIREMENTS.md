# v3.0 Requirements — Multi-Discipline Training Coach

**Status:** Active
**Milestone:** v3.0 — Multi-Discipline Training Coach
**Created:** 2026-04-29

---

## Milestone v3.0 Requirements

### RENAME — App Rename

- [x] **RENAME-01**: App title, package names (package.json), HTML `<title>`, README, and all UI strings updated from "Running Coach" / "ai-running-coach" to "Training Coach" / "ai-training-coach" (GitHub repo renamed accordingly)

### DISC — Discipline Infrastructure

- [x] **DISC-01**: Every session has a `discipline` field ('run' | 'gym' | 'cycle'); existing run sessions migrated to `discipline: 'run'`
- [x] **DISC-02**: Every training plan day has a `discipline` field ('run' | 'gym' | 'cycle'); existing plan days migrated to `discipline: 'run'`
- [x] **DISC-03**: Session log entry form adapts displayed fields based on selected discipline (gym: no distance; cycle: distance+speed; run: distance+pace)
- [x] **DISC-04**: Runs list shows a discipline badge/icon per session
- [x] **DISC-05**: User can filter the Runs list by discipline

### GYM — Gym Workouts

- [x] **GYM-01**: User can log a gym session with date, type (upper body / lower body / full body / other), duration, and optional notes

- [x] **GYM-02**: Logged gym session includes an exercise log: a list of exercises performed with name, sets, reps, and weight
- [x] **GYM-03**: Training plan gym days display a structured exercise target list (exercise name, target sets, reps, optional weight)
- [x] **GYM-04**: User can mark individual exercises on a gym plan day as done or skipped from the plan view
- [x] **GYM-05**: Coach can generate gym plan days with exercise target lists via plan XML tags (`<plan:add>` / `<plan:update>`)
- [x] **GYM-06**: Coach receives gym session history (including exercise log) in chat context and provides coaching feedback
- [ ] **GYM-07**: When generating or updating plan gym days, the coach reuses exercise names that the user has already logged (pulled from session history), so dashboard grouping (e.g. weight progression chart) works consistently across plan and log data
- [ ] **GYM-08**: The manual exercise entry form shows a live suggestion dropdown as the user types an exercise name — filtered from their previously logged exercise names containing the typed string — to encourage consistent naming without enforcing a fixed library

### CYCLE — Cycling

- [x] **CYCLE-01**: User can log a cycling session with date, distance, duration, optional HR, and optional notes
- [x] **CYCLE-02**: Cycling sessions display speed (km/h) instead of pace (min/km) throughout the UI (log form, runs list, run detail, dashboard)
- [x] **CYCLE-03**: Coach can generate cycling plan days with distance and duration targets via plan XML tags
- [x] **CYCLE-04**: Coach receives cycling session history in chat context and provides coaching feedback

### DASH — Dashboard Multi-Discipline

- [x] **DASH-01**: Dashboard has a discipline filter (All / Run / Gym / Cycle) that scopes all displayed data
- [x] **DASH-02**: Stat cards adapt to selected discipline — gym shows sessions count + total duration (not distance); run/cycle show distance + pace or speed
- [x] **DASH-03**: Weekly volume chart shows all disciplines in the same view, color-coded by sport (e.g., run=blue, gym=orange, cycle=green)
- [x] **DASH-04**: Weight progression chart shows max weight lifted per session for a user-selected exercise over time

### DASH2 — Dashboard Discipline Sections

- [x] **DASH2-01**: Dashboard reorganized into three stacked per-discipline sections (Run, Cycling, Gym), each with its own stat cards and charts, when the discipline filter is set to "All"
- [x] **DASH2-02**: The combined `WeeklyVolumeChart` (all disciplines in one bar chart) is removed; each discipline section has its own dedicated charts instead
- [x] **DASH2-03**: A discipline section is hidden when the active time filter returns no data for that discipline; shown with an empty-state message when the single-discipline filter explicitly selects it
- [x] **DASH2-04**: When a single discipline is selected (Run / Gym / Cycle), only that discipline's section is shown; other sections are not rendered
- [x] **DASH2-05**: Each discipline section has discipline-specific stat cards and charts: Run (Total Distance, Total Runs, Total Time + pace/HR charts), Cycling (Total Distance, Avg Speed, Total Time + speed/distance charts), Gym (Total Sessions, Total Duration + duration/weight-progression charts)

---

## Future Requirements (deferred)

- Apple Health export upload and parsing — separate milestone (already tracked in PROJECT.md)
- Power (watts) tracking for cycling — not needed for current user base
- Swimming discipline — possible v3.x addition
- Swim / triathlon training plans

## Out of Scope

- Exercise library / catalog with predefined movements — free-text exercise names are sufficient
- Social/sharing features for workout data
- Real-time sync with fitness devices
- Calorie tracking

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| RENAME-01 | Phase 17 | Complete |
| DISC-01 | Phase 13 | Complete |
| DISC-02 | Phase 13 | Complete |
| DISC-03 | Phase 14 | Complete |
| DISC-04 | Phase 14 | Complete |
| DISC-05 | Phase 14 | Complete |
| GYM-01 | Phase 14 | Complete |
| GYM-02 | Phase 14 | Complete |
| GYM-03 | Phase 14 | Complete |
| GYM-04 | Phase 14 | Complete |
| GYM-05 | Phase 14 | Complete |
| GYM-06 | Phase 14 | Complete |
| GYM-07 | Phase 18 | Not started |
| GYM-08 | Phase 18 | Not started |
| CYCLE-01 | Phase 15 | Complete |
| CYCLE-02 | Phase 15 | Complete |
| CYCLE-03 | Phase 15 | Complete |
| CYCLE-04 | Phase 15 | Complete |
| DASH-01 | Phase 16 | Complete |
| DASH-02 | Phase 16 | Complete |
| DASH-03 | Phase 16 | Complete |
| DASH-04 | Phase 16 | Complete |
| DASH2-01 | Phase 21 | Complete |
| DASH2-02 | Phase 21 | Complete |
| DASH2-03 | Phase 21 | Complete |
| DASH2-04 | Phase 21 | Complete |
| DASH2-05 | Phase 21 | Complete |
