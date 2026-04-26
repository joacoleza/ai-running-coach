# Phase 8: Data Isolation & Migration — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 08-data-isolation-migration
**Areas discussed:** Migration delivery, Seed admin setup, Message isolation strategy, requireAdmin scope

---

## Migration Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| npm run migrate script | One-shot Node.js script run manually before API start | |
| API startup check | On cold start, check for orphaned docs and backfill if needed | ✓ |
| Admin HTTP endpoint | POST /api/admin/migrate triggered once after deploy | |

**User's choice:** API startup check — runs in all environments; fast no-op after first run.

**Notes:** Idempotent check. If orphaned documents exist, find the admin user and backfill userId. Single indexed MongoDB query on subsequent cold starts (<5ms).

---

## Seed Admin Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars | SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD env vars | |
| Hardcoded defaults | Fixed email + generated temp password logged to console | |
| Auto-generate, log once | Random temp password in cloud logs | |
| Manual (already done) | Admin user inserted via Compass/mongosh; documented in README | ✓ |

**User's choice:** Manual — already done. README already documents the process. Migration startup check finds the existing admin by `{ isAdmin: true }` and assigns orphaned docs to them.

---

## Message Isolation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| userId directly on messages | Add userId field; filter by planId AND userId | ✓ |
| Rely on plan ownership | No userId on messages; verify planId ownership via plan lookup | |

**User's choice:** userId directly on messages.

**Notes:** Backfill: since all orphaned plans are assigned to the admin user, all orphaned messages get the same admin userId directly (no per-message plan lookup needed during migration).

---

## requireAdmin Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Add middleware, no routes yet | requireAdmin in auth.ts; Phase 9 uses it; tested via unit test | ✓ |
| Full admin guard + test route | Add requireAdmin + GET /api/admin/health for verification | |
| Defer entirely to Phase 9 | isAdmin flag only; Phase 9 adds both middleware and routes | |

**User's choice:** Add middleware, no routes yet.

**Notes:** Success criterion #4 satisfied via unit/integration test of requireAdmin directly — null for isAdmin: true, 403 for isAdmin: false. No test route left in the codebase.

---

## Claude's Discretion

- MongoDB index strategy for userId on each collection
- Whether startup migration runs before or after route registration
- Error message wording for 403 responses
- Consistent application of userId scoping across planArchive.ts and planPhases.ts

## Deferred Ideas

- Per-user settings (units, display name) — future profile phase
- Admin audit log — future admin phase
- Cascade delete on user deletion — Phase 9 (USER-04) or beyond
- httpOnly cookie for JWT — previously noted in Phase 6 context
