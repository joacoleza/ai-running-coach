# v3.0 Requirements — Multi-Discipline Training Coach

**Status:** Active
**Milestone:** v3.0 — Multi-Discipline Training Coach
**Created:** 2026-04-29

---

## Milestone v3.0 Requirements

### RENAME — App Rename

- [ ] **RENAME-01**: App title, package names (package.json), HTML `<title>`, README, and all UI strings updated from "Running Coach" / "ai-running-coach" to "Training Coach" / "ai-training-coach" (GitHub repo renamed accordingly)

### DISC — Discipline Infrastructure

- [ ] **DISC-01**: Every session has a `discipline` field ('run' | 'gym' | 'cycle'); existing run sessions migrated to `discipline: 'run'`
- [ ] **DISC-02**: Every training plan day has a `discipline` field ('run' | 'gym' | 'cycle'); existing plan days migrated to `discipline: 'run'`
- [ ] **DISC-03**: Session log entry form adapts displayed fields based on selected discipline (gym: no distance; cycle: distance+speed; run: distance+pace)
- [ ] **DISC-04**: Runs list shows a discipline badge/icon per session
- [ ] **DISC-05**: User can filter the Runs list by discipline

### GYM — Gym Workouts

- [ ] **GYM-01**: User can log a gym session with date, type (upper body / lower body / full body / other), duration, and optional notes
- [ ] **GYM-02**: Logged gym session includes an exercise log: a list of exercises performed with name, sets, reps, and weight
- [ ] **GYM-03**: Training plan gym days display a structured exercise target list (exercise name, target sets, reps, optional weight)
- [ ] **GYM-04**: User can mark individual exercises on a gym plan day as done or skipped from the plan view
- [ ] **GYM-05**: Coach can generate gym plan days with exercise target lists via plan XML tags (`<plan:add>` / `<plan:update>`)
- [ ] **GYM-06**: Coach receives gym session history (including exercise log) in chat context and provides coaching feedback

### CYCLE — Cycling

- [ ] **CYCLE-01**: User can log a cycling session with date, distance, duration, optional HR, and optional notes
- [ ] **CYCLE-02**: Cycling sessions display speed (km/h) instead of pace (min/km) throughout the UI (log form, runs list, run detail, dashboard)
- [ ] **CYCLE-03**: Coach can generate cycling plan days with distance and duration targets via plan XML tags
- [ ] **CYCLE-04**: Coach receives cycling session history in chat context and provides coaching feedback

### DASH — Dashboard Multi-Discipline

- [ ] **DASH-01**: Dashboard has a discipline filter (All / Run / Gym / Cycle) that scopes all displayed data
- [ ] **DASH-02**: Stat cards adapt to selected discipline — gym shows sessions count + total duration (not distance); run/cycle show distance + pace or speed
- [ ] **DASH-03**: Weekly volume chart shows all disciplines in the same view, color-coded by sport (e.g., run=blue, gym=orange, cycle=green)
- [ ] **DASH-04**: Weight progression chart shows max weight lifted per session for a user-selected exercise over time

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
| RENAME-01 | Phase 17 | Pending |
| DISC-01 | Phase 13 | Pending |
| DISC-02 | Phase 13 | Pending |
| DISC-03 | Phase 14 | Pending |
| DISC-04 | Phase 14 | Pending |
| DISC-05 | Phase 14 | Pending |
| GYM-01 | Phase 14 | Pending |
| GYM-02 | Phase 14 | Pending |
| GYM-03 | Phase 14 | Pending |
| GYM-04 | Phase 14 | Pending |
| GYM-05 | Phase 14 | Pending |
| GYM-06 | Phase 14 | Pending |
| CYCLE-01 | Phase 15 | Pending |
| CYCLE-02 | Phase 15 | Pending |
| CYCLE-03 | Phase 15 | Pending |
| CYCLE-04 | Phase 15 | Pending |
| DASH-01 | Phase 16 | Pending |
| DASH-02 | Phase 16 | Pending |
| DASH-03 | Phase 16 | Pending |
| DASH-04 | Phase 16 | Pending |
