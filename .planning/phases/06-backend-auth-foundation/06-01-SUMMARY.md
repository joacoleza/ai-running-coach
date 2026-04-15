---
phase: 06-backend-auth-foundation
plan: "01"
subsystem: auth
tags: [jsonwebtoken, bcrypt, mongodb, typescript, jwt]

# Dependency graph
requires: []
provides:
  - "User TypeScript interface with email, passwordHash, isAdmin, tempPassword fields"
  - "RefreshToken TypeScript interface with userId, tokenHash, expiresAt fields"
  - "MongoDB unique index on users.email"
  - "MongoDB TTL index on refresh_tokens.expiresAt"
  - "jsonwebtoken and bcrypt npm packages installed"
affects: [06-backend-auth-foundation/06-02, 06-backend-auth-foundation/06-03, 07-frontend-auth, 08-data-isolation, 09-admin-panel]

# Tech tracking
tech-stack:
  added: [jsonwebtoken@9.0.3, bcrypt, @types/jsonwebtoken, @types/bcrypt]
  patterns:
    - "User model with bcrypt password hash, isAdmin and tempPassword flags"
    - "Refresh token stored as SHA-256 hash with TTL index for auto-purge"

key-files:
  created:
    - api/src/__tests__/types-auth.test.ts
  modified:
    - api/src/shared/types.ts
    - api/src/shared/db.ts
    - api/package.json
    - api/package-lock.json

key-decisions:
  - "Used jsonwebtoken (not jose) per D-15 — well-tested, Azure Functions v4 compatible"
  - "bcrypt (not bcryptjs) per D-15 — native Node.js bindings, compatible with Node 22"
  - "TTL index with expireAfterSeconds: 0 means MongoDB purges documents exactly at expiresAt timestamp"
  - "Unique index on users.email enforced at DB layer — prevents duplicate accounts even under concurrent inserts"

patterns-established:
  - "User model: email (unique), passwordHash (bcrypt), isAdmin (bool), tempPassword (bool) — follow this schema in all auth handlers"
  - "RefreshToken stored as SHA-256 hash of raw token — never store the raw token value in DB"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 10min
completed: 2026-04-15
---

# Phase 6 Plan 01: Backend Auth Foundation — Data Layer Summary

**User and RefreshToken TypeScript interfaces plus MongoDB collection indexes installed as the data foundation for JWT auth**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-15T10:50:00Z
- **Completed:** 2026-04-15T11:00:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Installed `jsonwebtoken` and `bcrypt` (with `@types` packages) in `api/package.json`
- Added `User` interface to `api/src/shared/types.ts` with all D-08 fields: `email`, `passwordHash`, `isAdmin`, `tempPassword`, `lastLoginAt`, `createdAt`, `updatedAt`
- Added `RefreshToken` interface with D-06 fields: `userId`, `tokenHash`, `expiresAt`
- Extended `getDb()` in `api/src/shared/db.ts` with unique index on `users.email` and TTL index on `refresh_tokens.expiresAt`
- All 209 API tests pass with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install jsonwebtoken and bcrypt dependencies** - `b24b6a0` (chore)
2. **Task 2: Add User and RefreshToken interfaces + DB indexes** - `8e720b3` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified

- `api/package.json` — Added jsonwebtoken, bcrypt dependencies; @types packages in devDependencies
- `api/package-lock.json` — Updated with 19 new packages
- `api/src/shared/types.ts` — Appended User and RefreshToken interfaces after existing Run interface
- `api/src/shared/db.ts` — Added two createIndex calls for users and refresh_tokens collections
- `api/src/__tests__/types-auth.test.ts` — Structural tests for User and RefreshToken interfaces (4 tests)

## Decisions Made

- Used `jsonwebtoken` (not `jose`) per D-15 — plan explicitly required this library
- Used `bcrypt` (not `bcryptjs`) per D-15 — native Node.js module, Node 22 compatible
- TTL index `expireAfterSeconds: 0` — MongoDB purges documents at exactly the `expiresAt` timestamp (not after an additional delay)
- Test file uses `type` imports so it validates structural compatibility at compile-time rather than runtime

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The TDD `tdd="true"` flag on Task 2 presented a challenge: TypeScript interfaces are compile-time only, so vitest/esbuild strips type imports without failing at runtime. The tests were written to be structurally correct TypeScript (they would catch type errors at compilation if types were missing from tsconfig scope). The primary verification `npx tsc --noEmit` exit code 0 confirms correctness. All 209 tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `User` and `RefreshToken` types are ready for import by `06-02` (auth endpoints) and `06-03` (JWT middleware)
- `getDb()` will create the `users` unique index and `refresh_tokens` TTL index on first connection
- `jsonwebtoken` and `bcrypt` packages available for auth handler implementation
- No blockers for Plan 02

---
*Phase: 06-backend-auth-foundation*
*Completed: 2026-04-15*
