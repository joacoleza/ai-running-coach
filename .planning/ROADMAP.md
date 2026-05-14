# Roadmap: AI Training Coach

## Milestones

- ✅ **v1.1 Personal AI Running Coach** — Phases 1–5 (shipped 2026-04-14) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Multi-User Support** — Phases 6–10 (shipped 2026-04-26) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v2.1 Usage & Plan Controls** — Phases 11–12 (shipped 2026-04-28) — [archive](milestones/v2.1-ROADMAP.md)
- ✅ **v3.0 Multi-Discipline Training Coach** — Phases 13–21 (shipped 2026-05-15) — [archive](milestones/v3.0-ROADMAP.md)
- 📋 **v3.x / Next** — Phases 18–20+ (planned)

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

<details>
<summary>✅ v3.0 Multi-Discipline Training Coach (Phases 13–21) — SHIPPED 2026-05-15</summary>

- [x] Phase 13: Discipline Foundation (3/3 plans) — Data model, migrations, API + coach updates for multi-discipline (completed 2026-04-29)
- [x] Phase 14: Gym Support (5/5 plans) — Gym session logging, exercise checklist, gym plan days, coach gym integration (completed 2026-05-04)
- [x] Phase 15: Cycling Support (2/2 plans) — Cycling session logging, speed display, cycling plan days, coach cycling integration (completed 2026-05-07)
- [x] Phase 15.1: Multi-Discipline UI Polish (4/4 plans) — Discipline-aware labels, RunDetailModal gym/cycle fixes, Sidebar rename, plan day discipline indicators, link-session filtering (completed 2026-05-08)
- [x] Phase 15.2: Week Number Desync Bug Fix (1/1 plan) — Bulk-update runs.weekNumber when assignPlanStructure renumbers the plan after week deletion/addition (completed 2026-05-09)
- [x] Phase 16: Multi-Discipline Dashboard (3/3 plans) — Discipline filter, adapted stat cards, multi-discipline volume chart, weight progression chart (completed 2026-05-09)
- [x] Phase 17: App Rename (3/3 plans) — Rename ai-running-coach to ai-training-coach across all files and UI (completed 2026-05-09)
- [x] Phase 21: Dashboard Discipline Sections (3/3 plans) — Separate dashboard sections per discipline with dedicated charts; sections hidden when no data (completed 2026-05-10)

Known gaps carried forward: GYM-07 (exercise name reuse), GYM-08 (exercise name autocomplete) → Phase 18

</details>

### 📋 Next Milestone (TBD)

- [ ] **Phase 18: Gym Session Exercises in Plan** — Exercise name consistency: coach reuses previously-logged exercise names in plans, exercise entry form suggests matching names as the user types
- [ ] **Phase 19: Unit Standardization** — Lock the app to km and kg only; remove lbs from Exercise type and all UI; coach instructed to never use imperial units; API rejects lbs payloads
- [ ] **Phase 20: Plan Week Date Anchoring** — Anchor plan weeks to real calendar dates; plan view shows date ranges per week; coach reasons in calendar terms

## Backlog

### Phase 999.1: Disabled "Delete run" button tooltip on linked runs

**Goal:** Show a hover tooltip on the disabled "Delete run" button in RunDetailModal when the run is linked to a plan day.
**Plans:** 0 plans

- [ ] TBD (promote with `/gsd:review-backlog` when ready)

## Phase Details

### Phase 18: Gym Session Exercises in Plan
**Goal**: Exercise names are consistent across plan days and session logs so the dashboard can group them correctly. The coach reuses exercise names the user has already logged when writing gym plan days. The manual exercise entry form suggests matching names as the user types, making it easy to reuse the same name without a rigid exercise library.
**Note**: The original Phase 18 scope (exercise checklists on plan days, GYM-03/04/05) was delivered early in Phase 14. This phase focuses on the consistency layer built on top of that foundation.
**Depends on**: Phase 17
**Requirements**: GYM-07, GYM-08
**Success Criteria** (what must be TRUE):
  1. The coach system prompt instructs Claude to fetch and reuse the user's previously logged exercise names when generating or updating gym plan days
  2. `GET /api/runs/exercise-names` (or equivalent) returns distinct exercise names the user has logged, so the system prompt can inject them
  3. When a user types in the exercise name field in the manual entry form, a dropdown appears showing previously-logged exercise names that contain the typed string (case-insensitive)
  4. The suggestion dropdown dismisses on selection (populating the field) or on blur/Escape
  5. The weight progression chart in the dashboard correctly groups sessions that used the suggestions (same name = same chart line)
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
