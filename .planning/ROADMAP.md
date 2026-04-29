# Roadmap: AI Running Coach → AI Training Coach

## Milestones

- ✅ **v1.1 Personal AI Running Coach** — Phases 1–5 (shipped 2026-04-14) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Multi-User Support** — Phases 6–10 (shipped 2026-04-26) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v2.1 Usage & Plan Controls** — Phases 11–12 (shipped 2026-04-28) — [archive](milestones/v2.1-ROADMAP.md)
- 🚧 **v3.0 Multi-Discipline Training Coach** — Phases 13–17 (in progress)

## Phases

<details>
<summary>✅ v1.1 Personal AI Running Coach (Phases 1–5) — SHIPPED 2026-04-14</summary>

- [x] Phase 1: Infrastructure & Auth (3/3 plans) — Azure deployment, local dev, CI/CD
- [x] Phase 1.1: Replace Auth with Simple Password (2/2 plans) — pre-shared secret, lockout
- [x] Phase 1.2: Testing Strategy & CI (4/4 plans) — unit, E2E, coverage badges
- [x] Phase 2: Coach Chat & Plan Generation (11/11 plans) — onboarding, SSE streaming, plan gen
- [x] Phase 2.1: Training Plan Redesign (5/5 plans) — hierarchical phases/weeks/days, inline edit
- [x] Phase 3: Run Logging & Feedback (7/7 plans) — manual run entry, post-run coaching
- [x] Phase 3.1: Fix Coach Feedback Quality (1/1 plan) — stale closure, raw XML in feedback
- [x] Phase 3.2: Tech Debt Cleanup (4/4 plans) — dead endpoints, SSE deduplication, docs
- [x] Phase 3.3: UI Polish & Mobile Fixes (4/4 plans) — scroll, favicon, run/plan cross-linking
- [x] Phase 4: Dashboard (7/7 plans) — filter presets, stat cards, volume + pace charts
- [x] Phase 5: Missing Features (5/5 plans) — agent commands, plan extension UI, target date editor

</details>

<details>
<summary>✅ v2.0 Multi-User Support (Phases 6–10) — SHIPPED 2026-04-26</summary>

- [x] Phase 6: Backend Auth Foundation (4/4 plans) — JWT login/refresh/logout, requireAuth middleware, APP_PASSWORD retired
- [x] Phase 7: Frontend Auth (3/3 plans) — LoginPage, ChangePasswordPage, App.tsx auth gate, 401 interceptor
- [x] Phase 8: Data Isolation & Migration (3/3 plans) — userId scoping across 7 handlers, startup migration for v1.1 data
- [x] Phase 9: Admin Panel (4/4 plans) — list/create/reset/deactivate users, responsive UI, active flag enforcement
- [x] Phase 10: Login Rate Limiting (3/3 plans) — IP-based lockout, email enumeration prevention, LoginPage 429 handler

</details>

<details>
<summary>✅ v2.1 Usage & Plan Controls (Phases 11–12) — SHIPPED 2026-04-28</summary>

- [x] Phase 11: Usage Tracking (3/3 plans) — usage_events collection, pricing.ts, /api/usage/me, usage-summary, UsagePage, sidebar My Usage, admin columns
- [x] Phase 12: Delete Last Empty Week (2/2 plans) — DELETE endpoint with guards, "− week" UI button, plan:delete-week chat tag

</details>

### v3.0 Multi-Discipline Training Coach

- [ ] **Phase 13: Discipline Foundation** — Data model, migrations, API + coach updates for multi-discipline
- [ ] **Phase 14: Gym Support** — Gym session logging, exercise checklist, gym plan days, coach gym integration
- [ ] **Phase 15: Cycling Support** — Cycling session logging, speed display, cycling plan days, coach cycling integration
- [ ] **Phase 16: Multi-Discipline Dashboard** — Discipline filter, adapted stat cards, multi-discipline volume chart, weight progression chart
- [ ] **Phase 17: App Rename** — Rename ai-running-coach to ai-training-coach across all files and UI

## Backlog

### Phase 999.1: Disabled "Delete run" button tooltip on linked runs

**Goal:** Show a hover tooltip on the disabled "Delete run" button in RunDetailModal when the run is linked to a plan day.
**Plans:** 0 plans

- [ ] TBD (promote with `/gsd:review-backlog` when ready)

## Phase Details

### Phase 13: Discipline Foundation
**Goal**: Every session and plan day carries a discipline tag, the API accepts and returns it, existing data is migrated, and the coach understands multi-discipline training
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: DISC-01, DISC-02
**Success Criteria** (what must be TRUE):
  1. All existing run sessions in the database have `discipline: 'run'` after migration
  2. All existing plan days in the database have `discipline: 'run'` after migration
  3. `POST /api/runs` and `GET /api/runs` accept and return the `discipline` field without errors
  4. Plan day create and update endpoints accept `discipline` on the day payload
  5. The coach system prompt instructs Claude to tag plan days with their discipline and understand gym/cycle day types
**Plans**: TBD

### Phase 14: Gym Support
**Goal**: Users can log gym sessions with exercises, view gym plan days with an interactive exercise checklist, and the coach can generate and discuss gym workouts
**Depends on**: Phase 13
**Requirements**: GYM-01, GYM-02, GYM-03, GYM-04, GYM-05, GYM-06, DISC-03, DISC-04, DISC-05
**Success Criteria** (what must be TRUE):
  1. User can log a gym session by selecting "Gym" discipline on the session entry form; fields shown are date, type, duration, notes (no distance field)
  2. User can add exercises (name, sets, reps, weight) to a gym session log and save them
  3. Gym plan days in the Training Plan show a structured exercise target list the user can expand
  4. User can tap a checkbox next to each exercise target to mark it done or skip it
  5. Each session in the Runs list shows a discipline badge (Run / Gym / Cycle)
  6. User can filter the Runs list to show only Gym sessions
  7. The coach receives gym session history (including exercise log) and can reference it in feedback
**Plans**: TBD
**UI hint**: yes

### Phase 15: Cycling Support
**Goal**: Users can log cycling sessions, view cycling plan days, and the coach can generate and discuss cycling workouts
**Depends on**: Phase 14
**Requirements**: CYCLE-01, CYCLE-02, CYCLE-03, CYCLE-04
**Success Criteria** (what must be TRUE):
  1. User can log a cycling session by selecting "Cycle" discipline; fields shown are date, distance, duration, optional HR, optional notes
  2. Cycling sessions display speed (km/h) wherever pace (min/km) appears for run sessions — in the session log form, runs list, session detail, and dashboard
  3. Coach can generate cycling plan days with distance and duration targets via `<plan:add>` / `<plan:update>` XML tags
  4. The coach receives cycling session history in chat context and provides discipline-appropriate feedback
**Plans**: TBD
**UI hint**: yes

### Phase 16: Multi-Discipline Dashboard
**Goal**: The dashboard shows training data across all disciplines with a filter and adapted stats, including a weight progression chart for gym exercises
**Depends on**: Phase 15
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Dashboard has a discipline selector (All / Run / Gym / Cycle) that scopes all cards and charts on the page
  2. When "Gym" is selected, stat cards show sessions count and total duration (not distance or pace)
  3. When "Run" or "Cycle" is selected, stat cards show distance and the appropriate speed metric (pace or km/h)
  4. The weekly volume chart renders all disciplines in the same view with distinct colors (run=blue, gym=orange, cycle=green)
  5. A weight progression chart is visible; user can select an exercise name and see max weight lifted per session over time
**Plans**: TBD
**UI hint**: yes

### Phase 17: App Rename
**Goal**: Every reference to "running coach" / "ai-running-coach" is replaced with "training coach" / "ai-training-coach" across the entire codebase, UI, and repository
**Depends on**: Phase 16
**Requirements**: RENAME-01
**Success Criteria** (what must be TRUE):
  1. Browser tab title shows "AI Training Coach" (not "AI Running Coach")
  2. All UI visible strings say "Training Coach" where they previously said "Running Coach"
  3. `package.json` name fields in both `web/` and `api/` reflect ai-training-coach
  4. README, system prompt, and HTML `<title>` contain no references to "running coach"
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Backend Auth Foundation | 4/4 | ✅ Complete | 2026-04-15 |
| 7. Frontend Auth | 3/3 | ✅ Complete | 2026-04-16 |
| 8. Data Isolation & Migration | 3/3 | ✅ Complete | 2026-04-18 |
| 9. Admin Panel | 4/4 | ✅ Complete | 2026-04-19 |
| 10. Login Rate Limiting | 3/3 | ✅ Complete | 2026-04-22 |
| 11. Usage Tracking | 3/3 | ✅ Complete | 2026-04-27 |
| 12. Delete Last Empty Week | 2/2 | ✅ Complete | 2026-04-27 |
| 13. Discipline Foundation | 0/? | Not started | — |
| 14. Gym Support | 0/? | Not started | — |
| 15. Cycling Support | 0/? | Not started | — |
| 16. Multi-Discipline Dashboard | 0/? | Not started | — |
| 17. App Rename | 0/? | Not started | — |
