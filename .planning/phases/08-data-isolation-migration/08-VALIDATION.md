---
phase: "08"
slug: data-isolation-migration
status: compliant
nyquist_compliant: true
created: 2026-04-18
audited: 2026-04-18
---

# Phase 08 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | api/vitest.config.ts |
| **Quick run command** | `cd api && npm test` |
| **Full suite command** | `cd api && npm test` |
| **Estimated runtime** | ~8–10 seconds |

---

## Sampling Rate

- **After every task commit:** `cd api && npm test`
- **After every plan wave:** `cd api && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green (274/274)
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Test File | Status |
|---------|------|------|-------------|-----------|-----------|--------|
| 08-01-01 | 01 | 1 | DATA-01, DATA-03 | unit | api/src/shared/types.ts compile check (tsc --noEmit) | ✅ green |
| 08-01-02 | 01 | 1 | DATA-03 | unit | api/src/middleware/requireAdmin.test.ts | ✅ green |
| 08-01-03 | 01 | 1 | DATA-03 | unit | api/src/middleware/requireAdmin.test.ts | ✅ green |
| 08-02-01 | 02 | 2 | DATA-01 | integration | api/src/__tests__/plan.isolation.test.ts, api/src/__tests__/planDays.isolation.test.ts, api/src/__tests__/planPhases.isolation.test.ts | ✅ green |
| 08-02-02 | 02 | 2 | DATA-01 | integration | api/src/__tests__/runs.isolation.test.ts, api/src/__tests__/planArchive.isolation.test.ts, api/src/__tests__/messages.isolation.test.ts | ✅ green |
| 08-02-03 | 02 | 2 | DATA-01 | integration | api/src/__tests__/plan.isolation.test.ts, api/src/__tests__/runs.isolation.test.ts | ✅ green |
| 08-03-01 | 03 | 3 | DATA-02 | unit | api/src/shared/migration.test.ts | ✅ green |
| 08-03-02 | 03 | 3 | DATA-02 | unit | api/src/shared/migration.test.ts (index.ts wiring) | ✅ green |
| 08-03-03 | 03 | 3 | DATA-01, DATA-02 | integration | full suite 274/274 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirements Coverage

| Requirement | Description | Test Files | Tests | Status |
|-------------|-------------|-----------|-------|--------|
| DATA-01 | Per-user data isolation — all queries scoped to authenticated user | plan.isolation.test.ts (4), runs.isolation.test.ts (5), planDays.isolation.test.ts (6), planPhases.isolation.test.ts (8), planArchive.isolation.test.ts (6), messages.isolation.test.ts (5) | 34 integration | ✅ COVERED |
| DATA-02 | Startup migration backfills orphaned documents to admin user | migration.test.ts | 4 unit | ✅ COVERED |
| DATA-03 | requireAdmin middleware for admin-only routes | requireAdmin.test.ts | 4 unit | ✅ COVERED |

---

## Isolation Test Coverage (DATA-01)

All 7 handler files now have cross-user isolation tests:

| Handler | Test File | Cross-User Tests | Pattern |
|---------|-----------|-----------------|---------|
| plan.ts | plan.isolation.test.ts | 4 tests | User B can't see/create user A plans |
| runs.ts | runs.isolation.test.ts | 5 tests | User B can't see/delete user A runs |
| planDays.ts | planDays.isolation.test.ts | 6 tests | User B can't PATCH/DELETE/add days to user A plan |
| planPhases.ts | planPhases.isolation.test.ts | 8 tests | User B can't PATCH/DELETE/add phases to user A plan |
| planArchive.ts | planArchive.isolation.test.ts | 6 tests | User B can't list/get user A archived plans |
| messages.ts | messages.isolation.test.ts | 5 tests | User B can't read user A messages |
| chat.ts | — | — | Manual-only (see below) |

All isolation tests use **MongoMemoryServer** with two real users (USER_A, USER_B) and assert 404 for cross-user access (per D-06: never 403).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| chat.ts sets userId on ChatMessage inserts | DATA-01 | Requires mocking Anthropic SDK streaming — functional path involves real SSE stream and cannot be isolated without substantial test infrastructure that would duplicate the E2E test setup | Deploy to staging. Send a chat message. Inspect the `messages` MongoDB collection and verify the inserted document has a `userId` field set to the ObjectId of the authenticated user. |
| First-deployment backfill against real v1.1 data | DATA-02 | Cannot replicate real v1.1 MongoDB dataset in unit tests — MongoMemoryServer tests cover logic path but not real pre-migration data shape | Deploy to staging with a v1.1 MongoDB containing plans/runs/messages without userId. Restart API. Observe logs: expect `[migration] Found N orphaned documents...` then `[migration] Backfill complete.` Second restart should show `[migration] No orphaned documents found — skipping backfill.` |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual-only justification
- [x] All 7 DATA-01 handler files have isolation tests (except chat.ts — manual-only with justification)
- [x] DATA-02 migration fully covered by 4 unit tests
- [x] DATA-03 requireAdmin fully covered by 4 unit tests
- [x] 274/274 API tests pass (26 test files)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-18

---

## Validation Audit 2026-04-18

| Metric | Count |
|--------|-------|
| Gaps found | 5 |
| Resolved (automated) | 4 |
| Escalated (manual-only) | 1 |

**Resolved gaps:**
- planDays.ts cross-user isolation → planDays.isolation.test.ts (6 tests)
- planPhases.ts cross-user isolation → planPhases.isolation.test.ts (8 tests)
- planArchive.ts cross-user isolation → planArchive.isolation.test.ts (6 tests)
- messages.ts cross-user isolation → messages.isolation.test.ts (5 tests)

**Manual-only:**
- chat.ts userId on ChatMessage inserts — Anthropic streaming mock complexity
