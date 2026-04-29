---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Multi-Discipline Training Coach
status: in_progress
last_updated: "2026-04-29T00:00:00.000Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-29)

**Core value:** A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened.
**Current focus:** v3.0 — Multi-Discipline Training Coach

## Current Position

Phase: Phase 13 — Discipline Foundation (not started)
Plan: —
Status: Roadmap defined, ready to plan Phase 13
Last activity: 2026-04-29 — v3.0 roadmap created (Phases 13–17)

Progress: [░░░░░░░░░░] 0% (0/5 phases complete)

## Milestone

**Milestone:** v3.0 — Multi-Discipline Training Coach (in progress)
**Previous:** v2.1 — Usage & Plan Controls ✅ SHIPPED 2026-04-28

**Phase sequence:**

- Phase 13: Discipline Foundation — data model, migrations, API + coach updates
- Phase 14: Gym Support — gym logging UI, exercise checklist, gym plan days, coach gym integration
- Phase 15: Cycling Support — cycling logging, speed display, cycling plan days, coach cycling integration
- Phase 16: Multi-Discipline Dashboard — discipline filter, adapted stats, multi-discipline volume chart, weight progression chart
- Phase 17: App Rename — rename ai-running-coach → ai-training-coach throughout

## Backlog

- Phase 999.1: Disabled "Delete run" button tooltip on linked runs — promote with `/gsd:review-backlog`

## Accumulated Context

### Roadmap Evolution

- Phase 10 added: Login rate limiting (brute-force protection — failedLoginAttempts + lockedUntil on User doc, 5 attempts → 15 min lockout, 429 response). Replaces lockout system deleted in Phase 6.

- Existing v1.1 data in MongoDB (plans, runs, messages) must be associated with a first/seed user record during migration
- APP_PASSWORD env var will be retired; replaced by JWT_SECRET
- Admin page is part of the web app (React), not a separate tool
- Password reset = admin-triggered temp password (no email flow — admin delivers out of band)
- bcrypt for password hashing (no encryption key needed); JWT_SECRET env var for token signing
- DATA-03 (isAdmin flag) spans both Phase 8 (model/migration) and Phase 9 (UI guard) — assigned to Phase 8 as the foundational requirement; Phase 9 consumes it
- jsonwebtoken@9.0.3 and bcrypt installed in api/ — ready for auth handler and middleware implementation
- User and RefreshToken interfaces exported from api/src/shared/types.ts — all auth plans import from here
- DB indexes created in getDb(): users.email (unique), refresh_tokens.expiresAt (TTL)

### v3.0 Roadmap Notes

- Phase 13 is purely backend + data layer: adds `discipline` field to `runs` and plan day documents, runs migrations for existing data, updates API endpoints, and updates the system prompt so Claude understands multi-discipline coaching. No UI changes in this phase.
- Phase 14 introduces the first discipline-specific UI: the session entry form adapts fields based on selected discipline (first fully realized in gym context). The discipline badge and filter on the Runs list ship here because gym is the first new discipline being logged.
- Phase 15 reuses the Phase 13+14 infrastructure with cycling-specific field mappings (speed instead of pace). Most changes are field-level adaptations of existing components.
- Phase 16 touches dashboard.ts API and all dashboard React components. The weight progression chart is a new chart type — needs a new `/api/runs/exercise-weights?exercise=...` or similar endpoint.
- Phase 17 is a mechanical rename pass — no logic changes. Kept last to avoid merge conflicts during active development.
- DISC-03 (form field adaptation), DISC-04 (discipline badge), DISC-05 (discipline filter) are assigned to Phase 14 because gym is the first discipline that triggers the need for them. They will be implemented to support all three disciplines (run/gym/cycle) but are delivered in Phase 14.

## Decisions

- [06-01] Used jsonwebtoken and bcrypt per D-15 as the auth libraries for JWT signing and password hashing
- [06-01] TTL index with expireAfterSeconds: 0 on refresh_tokens.expiresAt — MongoDB auto-purges expired tokens at exact timestamp

---

_Initialized: 2026-03-21_
_Last updated: 2026-04-29 — v3.0 roadmap defined (Phases 13–17)_

- [Phase 06]: Exported handler factory pattern (getLoginHandler, etc.) for unit testability while still registering with Azure Functions app.http()
- [Phase 06]: Uniform 401 error message for wrong email and wrong password prevents user enumeration
- [06-03] WeakMap used to store per-request AuthContext — no JWT re-verification, no request mutation
- [06-03] lockout.integration.test.ts deleted — lockout feature (checkBlocked, MongoDB auth collection) fully removed with requirePassword

_Last updated: 2026-04-15 — Plan 06-04 complete (Phase 6 complete)_

- [Phase 06]: All 8 protected route test files mock requireAuth with unified pattern via vi.fn().mockResolvedValue(null)
- [Phase 07-01]: Used type-only ReactNode import (verbatimModuleSyntax tsconfig requires it)
- [Phase 07-01]: getChangePasswordHandler extracts userId from JWT directly after requireAuth validates it
- [Phase 07-01]: ChangePasswordPage calls login() with existing token to clear tempPassword flag without re-login
- [Phase 07-03]: vi.mock AuthContext per test file (not global) for explicit isolation
- [Phase 07-03]: client.db('running-coach') in global-setup to match API database name
- [Phase 07-03]: api/runs mock required in E2E helpers - fake JWT triggers 401 interceptor without it
- [Phase 09-01]: requireAuth performs DB lookup on every request to enforce active flag immediately without waiting for token expiry
- [Phase 09-01]: Deactivated login returns uniform 401 'Invalid credentials' to prevent user enumeration
- [Phase 09-01]: Legacy User documents without active field treated as active (user.active !== false pattern)
- [Phase 09]: Azure Functions reserves /admin route prefix; admin API routes use /api/users prefix instead, protected by requireAdmin()
- [Phase 09]: LoginPage decodes JWT payload to extract isAdmin flag
- [Phase 09]: sv-SE locale for ISO-like datetime in formatLastLogin without manual string building
- [Phase 09]: Fire-and-forget updateOne in getRefreshHandler keeps response latency unchanged while tracking active sessions
- [Phase 10-03]: IP-based rate limiting via login_attempts collection (not per-user fields) eliminates email enumeration; getClientIp() reads x-forwarded-for → client-ip → 127.0.0.1; DUMMY_HASH hardcoded to avoid bcrypt cost on module load; loginRateLimiting.test.ts deleted (account-based); loginRateLimit.test.ts rewritten with 10 IP-based scenarios
- [Phase 11]: Tokens stored raw in usage_events; cost computed at query time from MODEL_PRICING to allow repricing without re-running writes
- [Phase 11]: Model hardcoded as 'claude-sonnet-4-20250514' in usage capture; must change alongside stream() call if model is updated
- [Phase 11-02]: Single aggregation pass for admin usage summary (all users, all months) then reduced to map in JS — one DB round-trip; users absent from map show $0.00 in Admin.tsx
- [Phase 11-02]: Route 'users/usage-summary' (not 'admin/users/usage-summary') — Azure Functions reserves /admin prefix
- Phase 12 added: Delete last empty week of a phase (UI button + chat tag)
- [Phase 12]: deleteLastWeekOfPhase guard order mirrors addWeekToPhase: phaseIndex validation, plan lookup, bounds, single-week, non-rest day
- [Phase 12]: Used IIFE in JSX to compute lastWeekIsEmpty per phase; button disabled not hidden when last week has workout days; plan:delete-week tag symmetric with plan:add-week in 4 strip locations

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260416-jkp | fix change-password 401 in production - token not accepted | 2026-04-16 | 73b97da | [260416-jkp-fix-change-password-401-in-production-to](.planning/quick/260416-jkp-fix-change-password-401-in-production-to/) | PR #70 |
| 260423-u59 | Fix run:update-insight XML tag visible in chat and run detail modal | 2026-04-23 | 2c52f49 | [260423-u59-fix-run-update-insight-xml-tag-visible-i](.planning/quick/260423-u59-fix-run-update-insight-xml-tag-visible-i/) | PR #78 |
| 260423-wnm | Sidebar user email + logout dropdown, show-password toggle on login/reset | 2026-04-24 | 8bbb26f | [260423-wnm-sidebar-user-email-display-with-logout-d](.planning/quick/260423-wnm-sidebar-user-email-display-with-logout-d/) | PR #81 |
| 260428-drl | security review of the whole code - write security.md in .docs with findings | 2026-04-28 | a5dbdea | [260428-drl-security-review-of-the-whole-code-write-](.planning/quick/260428-drl-security-review-of-the-whole-code-write-/) | PR #87 |
