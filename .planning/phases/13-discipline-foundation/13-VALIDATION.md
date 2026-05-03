---
phase: 13
slug: discipline-foundation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
audited: 2026-04-30
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `api/vitest.config.ts` |
| **Quick run command** | `cd api && npm test` |
| **Full suite command** | `cd api && npm test && cd ../web && npm test && npx playwright test` |
| **Estimated runtime** | ~30 seconds (API unit tests only) |

---

## Sampling Rate

- **After every task commit:** Run `cd api && npm test`
- **After every plan wave:** Run `cd api && npm test` + TypeScript build check (`cd web && npm run build`)
- **Before `/gsd:verify-work`:** Full suite must be green (`api` + `web` + Playwright)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-types | 01 | 1 | DISC-01, DISC-02 | unit | `cd api && npm test -- runs.test.ts` | ✅ extend existing | ✅ green |
| 13-migration-runs | 01 | 1 | DISC-01 | unit | `cd api && npm test -- migration.test.ts` | ✅ `src/shared/migration.test.ts` | ✅ green |
| 13-migration-plans | 01 | 1 | DISC-02 | unit | `cd api && npm test -- migration.test.ts` | ✅ `src/shared/migration.test.ts` | ✅ green |
| 13-api-runs | 02 | 1 | DISC-01 | unit | `cd api && npm test -- runs.test.ts` | ✅ extend existing | ✅ green |
| 13-api-plandays | 02 | 1 | DISC-02 | unit | `cd api && npm test -- planDays.test.ts` | ✅ extend existing | ✅ green |
| 13-prompts | 03 | 2 | DISC-02 | unit | `cd api && npm test -- prompts.test.ts` | ✅ extend existing | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Tests are added to existing files (`runs.test.ts`, `planDays.test.ts`, `migration.test.ts`). No Wave 0 test scaffolding needed.

*No new test files required — extend existing test suites.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Migration runs on cold start and logs output | DISC-01, DISC-02 | Startup sequence can't be unit-tested end-to-end | Start API with pre-migration data; check console for `[migration] Discipline backfill` log lines |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (N/A — all tests in existing files)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ approved — 357/357 tests green (2026-04-30)

---

## Audit Notes (2026-04-30)

All 6 tasks confirmed green against the live codebase:

- `runs.test.ts` — 3 new discipline describes: POST stores, POST absent→undefined, PATCH updates
- `src/shared/migration.test.ts` — 3 tests: runs backfill, plan days arrayFilters, idempotency
- `planDays.test.ts` — 3 new discipline tests: PATCH updates, POST stores, POST absent→undefined
- `prompts.test.ts` — 4 new tests: AI training coach identity, discipline in plan:add, Disciplines section, type=cross-train guidance

Full suite ran: `357/357 passed` in ~39s. No gaps found. No new test files needed.
