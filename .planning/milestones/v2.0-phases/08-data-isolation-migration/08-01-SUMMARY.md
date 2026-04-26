---
phase: "08"
plan: "01"
subsystem: api
tags: [data-isolation, types, mongodb, middleware, auth]
dependency_graph:
  requires: []
  provides: [userId-on-Plan, userId-on-Run, userId-on-ChatMessage, userId-compound-indexes, requireAdmin-middleware]
  affects: [api/src/shared/types.ts, api/src/shared/db.ts, api/src/middleware/auth.ts]
tech_stack:
  added: []
  patterns: [compound-index, middleware-guard, TDD-red-green]
key_files:
  created:
    - api/src/middleware/requireAdmin.test.ts
  modified:
    - api/src/shared/types.ts
    - api/src/shared/db.ts
    - api/src/middleware/auth.ts
decisions:
  - userId field typed as ObjectId (not string) on all document interfaces — string was a placeholder; ObjectId is the correct MongoDB native type
  - requireAdmin delegates to requireAuth first — avoids duplicating JWT verification logic, ensures 401 before 403
  - Existing single-field indexes retained alongside new compound indexes — migration query (08-03) needs them for orphaned documents without userId
metrics:
  duration: "~10 minutes"
  completed: "2026-04-18"
  tasks: 3
  files_changed: 4
---

# Phase 08 Plan 01: Type Interfaces, DB Indexes, and requireAdmin Summary

**One-liner:** Added `userId: ObjectId` to Plan/Run/ChatMessage interfaces, compound MongoDB indexes for user scoping, and `requireAdmin` middleware with 4 unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add userId to type interfaces and update db indexes | 551adf2 | api/src/shared/types.ts, api/src/shared/db.ts |
| 2 | Implement requireAdmin middleware | 313542e | api/src/middleware/auth.ts |
| 3 | Unit tests for requireAdmin | 890a531 | api/src/middleware/requireAdmin.test.ts |

## What Was Built

### Type Changes (types.ts)

- `ChatMessage.userId?: ObjectId` added after `threadId`
- `Plan.userId?: ObjectId` added after `updatedAt`
- `Run.userId` changed from `string` to `ObjectId`; stale placeholder comment removed

### DB Indexes (db.ts)

Three compound indexes added for per-user query efficiency:
- `plans`: `{ userId: 1, status: 1, createdAt: -1 }`
- `runs`: `{ userId: 1, date: -1 }`
- `messages`: `{ userId: 1, planId: 1, timestamp: 1 }`

Existing single-field indexes retained (needed by 08-03 migration query on orphaned documents).

### requireAdmin Middleware (auth.ts)

`requireAdmin(req)` exported alongside `requireAuth` and `getAuthContext`. Delegates to `requireAuth` first (returns 401 for missing/invalid tokens), then checks `ctx.isAdmin` (returns 403 for non-admin), returns null for authorized admins.

### Tests

4 unit tests in `api/src/middleware/requireAdmin.test.ts` using `vi.mock('jsonwebtoken')`:
1. Returns null for valid admin token
2. Returns 403 for valid non-admin token
3. Returns 401 when no Authorization header
4. Returns 401 for malformed/expired token

All 236 API tests pass (232 existing + 4 new).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] api/src/shared/types.ts — userId on all 3 interfaces
- [x] api/src/shared/db.ts — 3 compound userId indexes
- [x] api/src/middleware/auth.ts — requireAdmin exported
- [x] api/src/middleware/requireAdmin.test.ts — 4 tests
- [x] Commits 551adf2, 313542e, 890a531 exist
- [x] npx tsc --noEmit exits 0
- [x] npm test: 236/236 pass
