---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Multi-User Support
status: executing
last_updated: "2026-04-16T08:30:00.000Z"
last_activity: 2026-04-16
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-15)

**Core value:** A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened.
**Current focus:** Phase 07 — frontend-auth

## Current Position

Phase: 8
Plan: Not started
Status: Ready to execute
Last activity: 2026-04-16

Progress: [██████████] 100% (4/4 plans complete)

## Milestone

**Milestone:** v2.0 — Multi-User Support 🚧 IN PROGRESS
**Previous:** v1.1 — Personal AI Running Coach ✅ SHIPPED 2026-04-14

**Phase sequence:**

- Phase 6: Backend Auth Foundation (AUTH-01, AUTH-02, AUTH-05, AUTH-06)
- Phase 7: Frontend Auth (AUTH-03, AUTH-04)
- Phase 8: Data Isolation & Migration (DATA-01, DATA-02, DATA-03)
- Phase 9: Admin Panel (USER-01, USER-02, USER-03, USER-04, DATA-03)

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

## Decisions

- [06-01] Used jsonwebtoken and bcrypt per D-15 as the auth libraries for JWT signing and password hashing
- [06-01] TTL index with expireAfterSeconds: 0 on refresh_tokens.expiresAt — MongoDB auto-purges expired tokens at exact timestamp

---

_Initialized: 2026-03-21_
_Last updated: 2026-04-15 — Plan 06-01 complete_

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

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260416-jkp | fix change-password 401 in production - token not accepted | 2026-04-16 | 73b97da | [260416-jkp-fix-change-password-401-in-production-to](.planning/quick/260416-jkp-fix-change-password-401-in-production-to/) | PR #70 |
