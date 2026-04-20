# Roadmap: AI Running Coach

## Milestones

- ✅ **v1.1 Personal AI Running Coach** — Phases 1–5 (shipped 2026-04-14) — [archive](milestones/v1.1-ROADMAP.md)
- 🚧 **v2.0 Multi-User Support** — Phases 6–9 (in progress)

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

### v2.0 Multi-User Support (Phases 6–9)

- [x] **Phase 6: Backend Auth Foundation** — User model, login/logout endpoints, JWT middleware, retire APP_PASSWORD (completed 2026-04-15)
- [x] **Phase 7: Frontend Auth** — Login page, force-change-password page, auto-logout on 401, logout button (completed 2026-04-16)
- [ ] **Phase 8: Data Isolation & Migration** — userId on all collections, scoped queries, migration script
- [x] **Phase 9: Admin Panel** — Admin page, list/create/reset/deactivate users, isAdmin guard (completed 2026-04-19)

## Phase Details

### Phase 6: Backend Auth Foundation
**Goal**: The API can authenticate users with email+password and enforce JWT on every route
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. A user can POST to a login endpoint with valid email+password and receive a signed JWT in return
  2. An expired or missing JWT on any protected API route returns 401 (not 403, not 500)
  3. A valid logout request clears the token and subsequent requests with that token are rejected
  4. The old APP_PASSWORD gate is gone — sending the old password header no longer grants access
**Plans**: 4/4 complete (06-01 User model+DB, 06-02 Auth endpoints, 06-03 JWT middleware, 06-04 Tests+cleanup)

### Phase 7: Frontend Auth
**Goal**: Users experience a complete login/logout flow and are redirected when their password needs changing
**Depends on**: Phase 6
**Requirements**: AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. A user who visits any app route while unauthenticated is redirected to the login page
  2. A user can enter email and password on the login page and reach the dashboard on success
  3. A user with a temp-password flag is immediately redirected to a change-password page and cannot navigate elsewhere until the password is changed
  4. After changing their password, the user lands on the dashboard and the force-redirect no longer triggers
  5. Clicking logout clears the session and returns the user to the login page
**Plans**: 3 plans
Plans:
- [x] 07-01-PLAN.md — Backend change-password endpoint + AuthContext + LoginPage + ChangePasswordPage
- [x] 07-02-PLAN.md — App.tsx auth gate + 401 interceptor + migrate hooks and Sidebar to Bearer auth
- [x] 07-03-PLAN.md — Unit tests (auth gate, sidebar logout) + E2E auth spec + update existing E2E specs

### Phase 8: Data Isolation & Migration
**Goal**: Every user sees only their own data, and existing v1.1 data is preserved under a seed admin account
**Depends on**: Phase 6
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. A logged-in user's plans, runs, and chat history are invisible to any other logged-in user
  2. API queries for plans/runs/messages automatically filter by the authenticated user's ID — no cross-user leakage possible
  3. After running the migration on a fresh v2.0 deployment, all pre-existing v1.1 documents are accessible under the seed admin account and no data is lost
  4. The seed admin account has `isAdmin: true` and can reach admin-only routes; a regular user cannot
**Plans**: 3 plans
Plans:
- [ ] 08-01-PLAN.md — Types (userId: ObjectId on Plan/Run/ChatMessage), DB indexes, requireAdmin middleware
- [ ] 08-02-PLAN.md — userId query scoping across all 7 handler files (DATA-01)
- [ ] 08-03-PLAN.md — Startup migration script + index.ts wiring + full test suite (DATA-02)

### Phase 9: Admin Panel
**Goal**: An admin can manage all user accounts from a dedicated page in the app
**Depends on**: Phase 8
**Requirements**: USER-01, USER-02, USER-03, USER-04, DATA-03
**Success Criteria** (what must be TRUE):
  1. An admin user sees an "Admin" link in the sidebar; a non-admin user does not see it and cannot reach the admin URL
  2. The admin page lists all user accounts with email, status, and last login date
  3. An admin can create a new user and see the auto-generated temp password exactly once (it cannot be retrieved again)
  4. An admin can trigger a password reset for any user; a new temp password is shown once and the user must change it on next login
  5. An admin can deactivate a user account; that user's subsequent requests are rejected; admin can reactivate
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md — User.active type, requireAuth deactivation check, login deactivation guard, all 4 admin API handlers, unit tests
- [x] 09-02-PLAN.md — Admin.tsx page (table + modals), Sidebar link, App.tsx route, web unit tests
- [x] 09-03-PLAN.md — E2E admin panel spec + global-setup admin user seed

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 6. Backend Auth Foundation | 4/4 | Complete   | 2026-04-15 |
| 7. Frontend Auth | 3/3 | Complete   | 2026-04-16 |
| 8. Data Isolation & Migration | 0/3 | Not started | - |
| 9. Admin Panel | 4/4 | Complete   | 2026-04-19 |
| 10. Login Rate Limiting | 2/2 | Complete    | 2026-04-20 |

### Phase 10: Login Rate Limiting

**Goal:** Protect the login endpoint against brute-force attacks — track failed attempts per user, lock the account after 5 consecutive failures with progressive duration (15 min doubling to 24h cap), return 429 with Retry-After header and a clear message, warn users of remaining attempts before lockout, mitigate timing attacks on email enumeration. API only, no UI needed.
**Requirements**: AUTH-07
**Depends on:** Phase 7
**Plans:** 2/2 plans complete

Plans:
- [x] 10-01-PLAN.md — Extend User type + implement rate limiting in getLoginHandler() (lockout check, timing mitigation, attempt tracking, warnings, counter reset)
- [x] 10-02-PLAN.md — Unit tests (12 scenarios) + E2E lockout smoke test + global-setup lockout user seed
