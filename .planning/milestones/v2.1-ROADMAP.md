# Roadmap: AI Running Coach

## Milestones

- ✅ **v1.1 Personal AI Running Coach** — Phases 1–5 (shipped 2026-04-14) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Multi-User Support** — Phases 6–10 (shipped 2026-04-26) — [archive](milestones/v2.0-ROADMAP.md)

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

## Backlog

### Phase 999.1: Disabled "Delete run" button tooltip on linked runs

**Goal:** Show a hover tooltip on the disabled "Delete run" button in RunDetailModal when the run is linked to a plan day.
**Plans:** 0 plans

- [ ] TBD (promote with `/gsd:review-backlog` when ready)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Backend Auth Foundation | 4/4 | ✅ Complete | 2026-04-15 |
| 7. Frontend Auth | 3/3 | ✅ Complete | 2026-04-16 |
| 8. Data Isolation & Migration | 3/3 | ✅ Complete | 2026-04-18 |
| 9. Admin Panel | 4/4 | ✅ Complete | 2026-04-19 |
| 10. Login Rate Limiting | 3/3 | ✅ Complete | 2026-04-22 |

### Phase 11: Usage Tracking

**Goal:** Track Claude API token usage per user; compute USD cost from model pricing; show total and monthly breakdown in admin panel; let each user view their own usage via the side menu top-row dropdown.
**Requirements**: USAGE-01 through USAGE-11
**Depends on:** Phase 10
**Plans:** 3/3 plans complete

Plans:
- [x] 11-01-PLAN.md — Backend foundation: pricing.ts, UsageEvent type, usage_events indexes, usage capture in chat.ts
- [x] 11-02-PLAN.md — API endpoints: GET /api/usage/me and GET /api/users/usage-summary
- [x] 11-03-PLAN.md — Frontend: UsagePage, sidebar My Usage item, /usage route, Admin columns, E2E tests

### Phase 12: Delete last empty week of a phase (UI button + chat tag)

**Goal:** Allow users and the AI coach to remove trailing empty weeks from a training phase — symmetric inverse of the existing "+ Add week" / `<plan:add-week>` functionality. Guards prevent deleting weeks that contain any workout days.
**Requirements**: WEEK-DELETE-01 through WEEK-DELETE-05
**Depends on:** Phase 11
**Plans:** 2/2 plans complete

Plans:
- [x] 12-01-PLAN.md — Backend: DELETE /api/plan/phases/:phaseIndex/weeks/last endpoint + unit tests
- [x] 12-02-PLAN.md — Frontend: usePlan.deleteLastWeek, PlanView "− week" button, useChat plan:delete-week tag, E2E test
