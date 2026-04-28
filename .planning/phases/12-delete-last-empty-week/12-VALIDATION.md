---
phase: 12
slug: delete-last-empty-week
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-28
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (API + web), Playwright (E2E) |
| **Config file** | `api/vitest.config.ts`, `web/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `npm test` (in `api/` or `web/`) |
| **Full suite command** | `npm test` in both `api/` and `web/`, then `npx playwright test` |
| **Estimated runtime** | ~30 seconds (unit), ~3 minutes (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` in the relevant directory (`api/` or `web/`)
- **After every plan wave:** Run full suite (both directories + E2E)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds (unit), ~180 seconds (E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | WEEK-DELETE-01 | unit | `cd api && npm test -- planPhases` | ✅ | ✅ green |
| 12-01-02 | 01 | 1 | WEEK-DELETE-02 | unit | `cd api && npm test -- planPhases` | ✅ | ✅ green |
| 12-02-01 | 02 | 2 | WEEK-DELETE-03 | unit | `cd web && npm test -- usePlan` | ✅ | ✅ green |
| 12-02-02 | 02 | 2 | WEEK-DELETE-04 | unit | `cd web && npm test -- PlanView` | ✅ | ✅ green |
| 12-02-03 | 02 | 2 | WEEK-DELETE-05 | unit + E2E | `cd web && npm test -- planUpdate && npx playwright test e2e/training-plan.spec.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test scaffolding was needed — phase 12 extended existing `planPhases.test.ts`, `usePlan.test.ts`, `PlanView.test.tsx`, `planUpdate.test.ts`, and `training-plan.spec.ts`.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Coverage Detail

### WEEK-DELETE-01 — DELETE endpoint with guard conditions

**File:** `api/src/__tests__/planPhases.test.ts:346-467`
**Tests (9):** 404 no-plan · 400 non-integer phaseIndex · 400 negative phaseIndex · 404 out-of-bounds · 400 single-week protection · 400 non-rest day present · 200 empty last week deleted · 200 global week recompute · 200 other phases unmodified

### WEEK-DELETE-02 — Unit test suite for all guards

**File:** `api/src/__tests__/planPhases.test.ts` (same 9 tests above)

### WEEK-DELETE-03 — usePlan.deleteLastWeek hook

**File:** `web/src/__tests__/usePlan.test.ts:231-263`
**Tests (2):** DELETEs correct URL and refreshes plan · throws on non-2xx response

### WEEK-DELETE-04 — PlanView "− week" button with disabled state

**File:** `web/src/__tests__/PlanView.test.tsx:329-417`
**Tests (5+):** Hidden without prop · shown only when >1 week · disabled when last week has workout days · enabled when last week empty · calls onDeleteLastWeek on confirm · no-op when confirm cancelled

### WEEK-DELETE-05 — plan:delete-week chat tag + E2E tests

**Files:**
- `web/src/__tests__/planUpdate.test.ts:165-193` (unit — 4 regex/strip tests)
- `e2e/training-plan.spec.ts:1290-1396` (E2E — 2 browser tests)

**E2E tests:** "shows minus-week button and deletes last empty week on confirm" · "minus-week button is disabled when last week has workout days"

---

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none were missing)
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-28

---

## Validation Audit 2026-04-28

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 5 requirements (WEEK-DELETE-01 through WEEK-DELETE-05) fully covered by existing automated tests.
Phase is Nyquist-compliant with no manual-only items.
