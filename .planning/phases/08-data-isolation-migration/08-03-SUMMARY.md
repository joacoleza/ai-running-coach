---
phase: "08"
plan: "03"
subsystem: api
tags: [data-isolation, migration, startup, backfill, idempotent]
dependency_graph:
  requires:
    - phase: 08-01
      provides: userId-on-Plan/Run/ChatMessage types, compound indexes
  provides:
    - runStartupMigration() backfills orphaned v1.1 documents to seed admin
    - migration wired into index.ts before route registration
    - DATA-02 zero data loss on first v2.0 deployment
  affects:
    - api/src/shared/migration.ts
    - api/src/shared/migration.test.ts
    - api/src/index.ts
tech_stack:
  added: []
  patterns: [startup-migration, idempotent-backfill, TDD-red-green]
key_files:
  created:
    - api/src/shared/migration.ts
    - api/src/shared/migration.test.ts
  modified:
    - api/src/index.ts
decisions:
  - id: D-01
    choice: "runStartupMigration called without await via .catch() in index.ts"
    rationale: "Top-level await requires module type configuration; .catch() pattern is safe and non-blocking for cold start"
  - id: D-02
    choice: "Migration checks total orphan count across all 3 collections before finding admin user"
    rationale: "Single idempotency gate avoids unnecessary DB lookup after first successful migration"
self_check: PASSED
---

## Summary

Implemented `runStartupMigration()` in `api/src/shared/migration.ts` — backfills all orphaned documents (no userId field) to the seed admin user's ObjectId on API cold start. Wired into `api/src/index.ts` before any route registrations via `.catch()` for non-blocking startup.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Implement runStartupMigration() with 4 unit tests | ✓ | f5d3a26 |
| 2 | Wire migration into index.ts | ✓ | f5d3a26 |
| 3 | Full test suite + web build verification | ✓ | inline |

## Outcomes

- `api/src/shared/migration.ts` exports `runStartupMigration()` — idempotent, checks orphan count first, finds admin user, runs `updateMany` on plans/runs/messages with `{ userId: { $exists: false } }` filter
- 4 unit tests pass: no-op when no orphans, backfill with admin, no admin → warning + no crash, idempotent second call
- `api/src/index.ts` imports and calls `runStartupMigration()` before all route imports
- 249/249 API unit tests pass
- Web build: clean (`npm run build` exits 0)

## Verification

- `migration.ts` contains `{ userId: { $exists: false } }` orphan filter ✓
- `migration.ts` contains `isAdmin: true` admin query ✓
- `index.ts` calls `runStartupMigration` before route imports ✓
- All tests pass ✓
