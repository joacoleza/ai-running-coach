---
phase: 21
slug: dashboard-discipline-sections
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for Phase 21: Dashboard Discipline Sections.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react |
| **Config file** | `web/vitest.config.ts` |
| **Quick run command** | `cd web && npm test -- --reporter=verbose` |
| **Full suite command** | `cd web && npm test && npx playwright test` |
| **Estimated runtime** | ~40s unit · ~2min E2E |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npm test`
- **After every plan wave:** Run `cd web && npm test && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~40 seconds (unit), ~120 seconds (E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Test File | Status |
|---------|------|------|-------------|-----------|-----------|--------|
| 21-01-T1 | 01 | 1 | DASH2-01, DASH2-02 | unit | `WeeklySpeedChart.test.tsx` (5 tests) | ✅ green |
| 21-01-T2 | 01 | 1 | DASH2-01, DASH2-02 | unit | `WeeklyDurationChart.test.tsx` (4 tests) + `WeightProgressionChart.test.tsx` (defaultExercise — 2 tests) | ✅ green |
| 21-02-T1 | 02 | 2 | DASH2-01, DASH2-05 | unit | `useDashboard.test.ts` (per-discipline exports — 1 test) | ✅ green |
| 21-02-T2 | 02 | 2 | DASH2-01, DASH2-02, DASH2-03, DASH2-04, DASH2-05 | unit + E2E | `Dashboard.test.tsx` (full rewrite) + `e2e/dashboard.spec.ts` | ✅ green |
| 21-03-T1 | 03 | 3 | DASH2-03, DASH2-04, DASH2-05 | unit | `Dashboard.test.tsx` + `WeightProgressionChart.test.tsx` + `useDashboard.test.ts` | ✅ green |
| 21-03-T2 | 03 | 3 | DASH2-01, DASH2-02, DASH2-05 | unit | `WeeklySpeedChart.test.tsx` + `WeeklyDurationChart.test.tsx` | ✅ green |
| 21-03-T3 | 03 | 3 | DASH2-01–05 | E2E | `e2e/dashboard.spec.ts` (2 regressions fixed) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covered all phase requirements — no Wave 0 setup needed.

*vitest + @testing-library/react + Playwright already established from prior phases.*

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Audit 2026-05-14

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved | 2 |
| Escalated | 0 |

**Gaps filled by auditor:**
1. DASH2-04 — Added `'shows only Cycling section when activeDiscipline is "cycle"'` to `Dashboard.test.tsx`
2. DASH2-05 — Added `'renders Avg Speed stat card in cycling section'` to `Dashboard.test.tsx`

Final test count: **645 unit tests** (0 failing) · **100 E2E tests** (0 failing)

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: every task has test coverage
- [x] No Wave 0 gaps (infrastructure pre-existing)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (unit suite ~40s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-14
