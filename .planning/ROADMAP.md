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

- [x] **Phase 13: Discipline Foundation** — Data model, migrations, API + coach updates for multi-discipline (completed 2026-04-29)
- [x] **Phase 14: Gym Support** — Gym session logging, exercise checklist, gym plan days, coach gym integration (completed 2026-05-04)
- [x] **Phase 15: Cycling Support** — Cycling session logging, speed display, cycling plan days, coach cycling integration (completed 2026-05-07)
- [x] **Phase 15.1: Multi-Discipline UI Polish** — Discipline-aware labels, RunDetailModal gym/cycle fixes, Sidebar rename, plan day discipline indicators, link-session filtering (completed 2026-05-08)
- [x] **Phase 15.2: Week Number Desync Bug Fix** — Bulk-update runs.weekNumber when assignPlanStructure renumbers the plan after week deletion/addition (completed 2026-05-09)
- [x] **Phase 16: Multi-Discipline Dashboard** — Discipline filter, adapted stat cards, multi-discipline volume chart, weight progression chart (completed 2026-05-09)
- [x] **Phase 17: App Rename** — Rename ai-running-coach to ai-training-coach across all files and UI (completed 2026-05-09)
- [ ] **Phase 18: Gym Session Exercises in Plan** — Coach-created exercise checklists on planned gym days, user can check off exercises during the session
- [ ] **Phase 19: Unit Standardization** — Lock the app to meters/km (distance) and kg (weight) only; remove lbs from Exercise type and all UI; instruct coach to never use imperial units; API rejects lbs payloads
- [ ] **Phase 20: Plan Week Date Anchoring** — Anchor plan weeks to real calendar dates; plan view shows date ranges per week, coach reasons in calendar terms, adding/removing weeks shifts dates automatically
- [ ] **Phase 21: Dashboard Discipline Sections** — Separate dashboard sections per discipline (Run/Cycling/Gym) with dedicated charts; sections hidden when no data for that discipline in the selected time range

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
**Plans:** 3/3 plans complete

Plans:
- [x] 13-01-PLAN.md — TypeScript Discipline type + startup migration backfill (runs + plan days)
- [x] 13-02-PLAN.md — API handler discipline field acceptance (POST/PATCH runs, POST/PATCH plan days)
- [x] 13-03-PLAN.md — System prompt: training coach identity + discipline coaching instructions

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
**Plans:** 5/5 plans complete

Plans:
- [x] 14-01-PLAN.md — Exercise interface, gym-aware API (POST/PATCH/GET runs), discipline-gated RunEntryForm
- [x] 14-02-PLAN.md — RunBadge component + discipline filter tabs on Runs page
- [x] 14-03-PLAN.md — ExerciseForm + ExerciseList + RunDetailModal gym exercises section
- [x] 14-04-PLAN.md — ExerciseChecklistItem + DayRow gym rendering + patchDay exercises support
- [x] 14-05-PLAN.md — Coach system prompt gym exercises instructions + chat.ts exercise log context

### Phase 15: Cycling Support
**Goal**: Users can log cycling sessions, view cycling plan days, and the coach can generate and discuss cycling workouts
**Depends on**: Phase 14
**Requirements**: CYCLE-01, CYCLE-02, CYCLE-03, CYCLE-04
**Success Criteria** (what must be TRUE):
  1. User can log a cycling session by selecting "Cycle" discipline; fields shown are date, distance, duration, optional HR, optional notes
  2. Cycling sessions display speed (km/h) wherever pace (min/km) appears for run sessions — in the session log form, runs list, session detail, and dashboard
  3. Coach can generate cycling plan days with distance and duration targets via `<plan:add>` / `<plan:update>` XML tags
  4. The coach receives cycling session history in chat context and provides discipline-appropriate feedback
**Plans:** 2/2 plans complete

Plans:
- [x] 15-01-PLAN.md — Speed display across RunEntryForm, RunRow, RunDetailModal, LinkRunModal
- [x] 15-02-PLAN.md — chat.ts cycling context format (Cycled:) + formatSpeed helper + prompts.ts verification

### Phase 15.1: Multi-Discipline UI Polish
**Goal**: All UI labels, form fields, action buttons, and modal copy are discipline-aware — gym and cycling sessions no longer show run-only labels, distance/pace fields are hidden for gym, plan days show which discipline they target, and the link-session modal filters by matching discipline
**Depends on**: Phase 15
**Requirements**: DISC-UX-01
**Success Criteria** (what must be TRUE):
  1. Sidebar "Runs" nav item and route label reads "Activities"
  2. RunDetailModal for a gym session: no Distance field, no Pace field, shows discipline badge in header, "Get coaching feedback" button (not "Add feedback to run"), "Delete session" (not "Delete run")
  3. DayRow "Log run" / "Link run" buttons read "Log session" / "Link session" for all disciplines; the log modal title is "Log session"
  4. Opening "Log session" from a gym plan day pre-selects Gym discipline in the RunEntryForm
  5. LinkRunModal when opened from a gym plan day shows only unlinked gym sessions (not all sessions)
  6. ExerciseList "Done" button is visually separated from "+ Add Exercise"; ExerciseForm save button is labelled "Add" (not "Save Exercise") to clarify it adds to local list; ExerciseList "Done" button is labelled "Save exercises" to clarify it persists to server
  7. Plan day DayRow shows a discipline indicator (Run / Gym / Cycle) when discipline is set on the day
**Plans:** 4/4 plans complete

Plans:
- [x] 15.1-01-PLAN.md — Sidebar rename + ExerciseList/ExerciseForm label fixes + useRuns discipline param + RunEntryForm defaultDiscipline prop
- [x] 15.1-02-PLAN.md — RunDetailModal: RunBadge in header, hide gym fields, fix labels, fix gym feedback message
- [x] 15.1-03-PLAN.md — DayRow discipline badge + session labels + PlanView linkingDay discipline + LinkRunModal discipline filtering
- [x] 15.1-04-PLAN.md — Test updates (Sidebar/LinkRunModal/DayRow) + build verification + E2E smoke

### Phase 15.2: Week Number Desync Bug Fix (INSERTED)
**Goal**: When a week is deleted from or added to a phase, `assignPlanStructure` renumbers plan week numbers but the `runs` collection is not updated — causing ghost-completed plan weeks with no linked runs and duplicate run links on the wrong week. Fix both `deleteLastWeekOfPhase` and `addWeekToPhase` to bulk-update `runs.weekNumber` after renumbering.
**Depends on**: Phase 15.1
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Deleting an empty week from a phase decrements `weekNumber` on all runs whose `weekNumber` is greater than the deleted week's number
  2. Adding a week to a phase increments `weekNumber` on all runs whose `weekNumber` is greater than or equal to the newly inserted week's number
  3. After either operation the plan's completed-day state matches the linked runs exactly — no ghost-completed weeks and no orphaned run links
  4. A unit test covers both operations: run weekNumbers shift correctly and plan integrity is preserved
**Plans:** 1/1 plans complete

Plans:
- [x] 15.2-01-PLAN.md — Fix addWeekToPhase + deleteLastWeekOfPhase to bulk-update runs.weekNumber + unit tests

### Phase 16: Multi-Discipline Dashboard
**Goal**: The dashboard shows training data across all disciplines with a filter and adapted stats, including a weight progression chart for gym exercises
**Depends on**: Phase 15.2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. Dashboard has a discipline selector (All / Run / Gym / Cycle) that scopes all cards and charts on the page
  2. When "Gym" is selected, stat cards show sessions count and total duration (not distance or pace)
  3. When "Run" or "Cycle" is selected, stat cards show distance and the appropriate speed metric (pace or km/h)
  4. The weekly volume chart renders all disciplines in the same view with distinct colors (run=blue, gym=orange, cycle=green)
  5. A weight progression chart is visible; user can select an exercise name and see max weight lifted per session over time
**Plans:** 3/3 plans complete

Plans:
- [x] 16-01-PLAN.md — GET /api/runs/exercise-weights endpoint + unit tests
- [x] 16-02-PLAN.md — useDashboard.ts: DisciplineFilter, MultiDisciplineWeekBucket, filterRunsByDiscipline, groupRunsByDiscipline, computeAvgSpeed, activeDiscipline state
- [x] 16-03-PLAN.md — Dashboard UI: DisciplineSelector, WeeklyVolumeChart, WeightProgressionChart components + Dashboard.tsx wiring

### Phase 17: App Rename
**Goal**: Every reference to "running coach" / "ai-running-coach" is replaced with "training coach" / "ai-training-coach" across the entire codebase, UI, and repository
**Depends on**: Phase 16
**Requirements**: RENAME-01
**Success Criteria** (what must be TRUE):
  1. Browser tab title shows "AI Training Coach" (not "AI Running Coach")
  2. All UI visible strings say "Training Coach" where they previously said "Running Coach"
  3. `package.json` name fields in both `web/` and `api/` reflect ai-training-coach
  4. README, system prompt, and HTML `<title>` contain no references to "running coach"
**Plans**: 3 plans

Plans:
- [x] 17-01-PLAN.md — UI display strings: LoginPage, ChangePasswordPage, PasswordPage, Sidebar, Coach, index.html, unauthorized.html
- [ ] 17-02-PLAN.md — Package names + MongoDB DB fallbacks (db.ts, playwright.config.ts, global-setup.ts) + prompts.ts JSDoc
- [x] 17-03-PLAN.md — README.md + CLAUDE.md docs + GitHub rename instructions

### Phase 18: Gym Session Exercises in Plan
**Goal**: Planned gym days can include a list of exercises (created by the coach), rendered as a checklist in the plan view so the user can mark each exercise done during the session
**Depends on**: Phase 17
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Coach can generate gym plan days that include an exercises list (sets, reps, optional weight)
  2. Gym plan days in PlanView show an expandable exercises checklist
  3. User can check/uncheck individual exercises; state is persisted to the plan day
  4. Completing the session (marking the day done) is still possible regardless of exercise completion state
**Plans**: TBD

### Phase 19: Unit Standardization
**Goal**: The app and coach exclusively use meters and km for distance, and kg for weight — no miles or lbs anywhere. The Exercise interface drops 'lbs', the system prompt instructs the coach to never use imperial units, and any UI that previously offered a unit choice is simplified to a single fixed unit.
**Depends on**: Phase 18
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Exercise weight unit is `'kg'` only — `'lbs'` is removed from the TypeScript type and all UI dropdowns
  2. Coach system prompt explicitly instructs Claude to always use km for distance and kg for weight — never miles or lbs
  3. No UI element offers a miles or lbs option
  4. Existing runs stored with `unit: 'lbs'` are migrated or treated as kg (decision: document chosen approach)
  5. API rejects `unit: 'lbs'` on exercise payloads with a 400 error
**Plans**: TBD

### Phase 20: Plan Week Date Anchoring
**Goal**: Each plan week is anchored to a real calendar start date (Monday), so the plan view shows actual dates alongside week numbers and the coach can reason about the schedule in calendar terms. The user sets the start date of Week 1 (or any week); all other weeks derive their dates automatically. This eliminates the manual tracking the user currently does to keep plan weeks aligned with real-world dates.
**Depends on**: Phase 19
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. A "Week start date" field is stored per week (or derived from a single plan anchor date + week offset)
  2. The plan view displays the date range for each week (e.g. "Week 12 — Apr 6–12")
  3. Adding or deleting a week correctly shifts the date ranges of all subsequent weeks
  4. The coach system prompt includes the current week's date range so the coach can reference real dates when giving guidance
  5. Existing plans without a date anchor continue to work — date display is shown only when an anchor has been set
  6. The user can update the anchor date (e.g. if they slip a week) and all derived week dates update accordingly
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
| 13. Discipline Foundation | 3/3 | ✅ Complete | 2026-04-29 |
| 14. Gym Support | 5/5 | Complete    | 2026-05-04 |
| 15. Cycling Support | 2/2 | ✅ Complete | 2026-05-07 |
| 15.1. Multi-Discipline UI Polish | 4/4 | Complete    | 2026-05-08 |
| 15.2. Week Number Desync Bug Fix | 0/1 | Complete    | 2026-05-09 |
| 16. Multi-Discipline Dashboard | 3/3 | Complete    | 2026-05-09 |
| 17. App Rename | 2/3 | Complete    | 2026-05-09 |
| 18. Gym Session Exercises in Plan | 0/? | Not started | — |
| 19. Unit Standardization | 0/? | Not started | — |
| 20. Plan Week Date Anchoring | 0/? | Not started | — |
| 21. Dashboard Discipline Sections | 0/3 | Not started | — |

### Phase 21: Dashboard Discipline Sections

**Goal:** Reorganize the dashboard into separate sections per discipline (Run, Cycling, Gym). Run section: distance/pace charts same as before. Cycling section: same charts as run but using km/h. Gym section: weight progression chart (defaulting to the exercise with the most data points) plus a weekly duration totals chart. When a specific discipline is selected in the filter, only that discipline's section is shown. Sections are hidden when the active time filter contains no entries for that discipline.
**Requirements**: DASH2-01, DASH2-02, DASH2-03, DASH2-04, DASH2-05
**Depends on:** Phase 17
**Plans:** 3 plans

Plans:
- [ ] 21-01-PLAN.md — New chart components: WeeklySpeedChart (cycling), WeeklyDurationChart (gym) + WeightProgressionChart defaultExercise prop
- [ ] 21-02-PLAN.md — useDashboard.ts per-discipline data exports + Dashboard.tsx per-discipline section restructure (remove WeeklyVolumeChart)
- [ ] 21-03-PLAN.md — Test updates: Dashboard.test.tsx rewrite, new WeeklySpeedChart/WeeklyDurationChart tests, WeightProgressionChart defaultExercise tests, delete WeeklyVolumeChart.test.tsx + build verification
