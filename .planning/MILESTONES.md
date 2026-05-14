# Milestones

## v3.0 Multi-Discipline Training Coach (Shipped: 2026-05-15)

**Phases completed:** 8 phases (13, 14, 15, 15.1, 15.2, 16, 17, 21) | 24 plans | 2026-04-29 → 2026-05-15

**Key accomplishments:**

1. **Multi-discipline data layer** — `Discipline` type (`'run'|'gym'|'cycle'`) added to TypeScript interfaces; startup migration backfills all pre-v3.0 run and plan day documents; all API create/patch endpoints accept and return the field; coach system prompt updated to "AI Training Coach" identity with discipline-aware coaching instructions
2. **Gym sessions with exercise logs** — Users log gym sessions (type, duration) with an interactive exercise log (sets × reps × weight); plan days show a collapsible exercise checklist users can tick off; coach generates gym plan days with exercise targets and receives exercise history in context
3. **Cycling sessions with speed display** — Users log cycling sessions with distance/duration; speed (km/h) shown everywhere pace (min/km) appeared; coach generates cycling plan days and receives session history as "Cycled: DD/MM/YYYY, Xkm @ Y.Y km/h"
4. **Discipline-aware UI** — All labels, fields, and navigation updated: Sidebar "Activities", RunDetailModal discipline badge + gym field hiding, DayRow "Log/Link session" labels, RunEntryForm pre-selection from plan day, LinkRunModal discipline filtering; week number desync bug fixed (bulk-updates runs.weekNumber after plan restructuring)
5. **Multi-discipline dashboard** — Discipline selector (All/Run/Gym/Cycle) with per-discipline sections: Run (pace/HR charts), Cycling (WeeklySpeedChart), Gym (WeeklyDurationChart + WeightProgressionChart); sections auto-hide when no data in range; WeeklyVolumeChart replaced by per-discipline charts
6. **App renamed** — All "AI Running Coach" / "ai-running-coach" references replaced with "AI Training Coach" / "ai-training-coach" across UI strings, package.json, HTML title, README, system prompt, and test fixtures

**Known gaps (carried to next milestone):**
- GYM-07: Coach does not yet reuse user's exercise history when generating gym plan days (Phase 18)
- GYM-08: Exercise entry form does not yet show name suggestions from prior sessions (Phase 18)

**Archived:**

- `.planning/milestones/v3.0-ROADMAP.md`
- `.planning/milestones/v3.0-REQUIREMENTS.md`
- `.planning/milestones/v3.0-MILESTONE-AUDIT.md`

---

## v2.1 Usage & Plan Controls (Shipped: 2026-04-28)

**Phases completed:** 2 phases (11–12), 5 plans

**Key accomplishments:**

1. MongoDB `usage_events` collection capturing raw Anthropic token counts (input/output/cacheWrite/cacheRead) after every Claude API call, with `pricing.ts` (MODEL_PRICING map + `computeCost()`) and compound indexes for per-user queries
2. Two API endpoints: `GET /api/usage/me` (per-user allTime + thisMonth + monthly breakdown) and `GET /api/users/usage-summary` (admin aggregation), both backed by single-pass MongoDB aggregation
3. UsagePage with all-time/this-month stat cards and monthly breakdown table; My Usage sidebar dropdown item; Admin panel Month/All-time cost columns with parallel fetch — 5 E2E tests
4. `DELETE /api/plan/phases/:phaseIndex/weeks/last` endpoint with guards (400 if only 1 week, 400 if last week has workout days) and `assignPlanStructure` recomputation
5. "− week" UI button in PlanView (disabled when last week has workout days) and `<plan:delete-week>` chat tag support symmetric with `<plan:add-week>` — 2 E2E tests

**Archived:**

- `.planning/milestones/v2.1-ROADMAP.md`
- `.planning/milestones/v2.1-REQUIREMENTS.md`
- `.planning/milestones/post-v2.0-MILESTONE-AUDIT.md` (as `v2.1` audit)

---

## v2.0 Multi-User Support (Shipped: 2026-04-26)

**Phases completed:** 6 phases, 17 plans, 27 tasks

**Key accomplishments:**

- User and RefreshToken TypeScript interfaces plus MongoDB collection indexes installed as the data foundation for JWT auth
- Three JWT auth endpoints (login/refresh/logout) with SHA-256 hashed refresh tokens, 15-min JWT access tokens, and 30-day refresh token TTL stored in MongoDB
- 1. [Rule 1 - Bug] Updated 10 test files to use requireAuth mock
- JWT middleware and auth endpoints fully covered: 10 requireAuth tests + 15 login/refresh/logout tests, all requirePassword references eliminated across 8 test files
- tempPassword in login response (D-01):
- JWT auth unit tests rewritten and E2E auth flow fully covered: 427 web unit tests + 66 E2E tests all green after migrating from app_password to access_token auth pattern
- One-liner:
- All 7 protected handler files now filter every MongoDB query by `userId: new ObjectId(userId)`, preventing any cross-user data access at the database level.
- Admin-only REST API (4 endpoints) with active-flag enforcement in every authenticated request and login
- React Admin page with user table, create/reset password modals, sidebar link, /admin route guard, and 7 unit tests
- 8 Playwright E2E tests covering admin panel flows with 4 bug fixes discovered and auto-fixed during implementation
- 1. Responsive admin table (Admin.tsx)
- One-liner:
- One-liner:
- One-liner:

---

## v1.1 Personal AI Running Coach (Shipped: 2026-04-14)

**Phases:** 11 | **Plans:** 50 | **Timeline:** 2026-03-21 → 2026-04-14 (24 days)

**Key accomplishments:**

1. Password-based auth with MongoDB brute-force lockout (replaces GitHub OAuth)
2. Full testing pyramid: unit tests (API + web), E2E with Playwright, GitHub Actions CI with coverage badges
3. Claude-powered coach chat with SSE streaming and persistent message history
4. Training plan generation: hierarchical phases → weeks → days with inline editing and agent-driven updates
5. Run logging with post-run coaching feedback, plan-run linking, and cross-navigation
6. Dashboard with date filters, stat cards (distance, runs, time, adherence), weekly volume + pace trend charts
7. Agent command protocol: add phase/week, update target date, log runs, save coaching insights — all via chat

**Archived:**

- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---
