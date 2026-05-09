---
phase: 16
slug: multi-discipline-dashboard
status: compliant
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for the multi-discipline dashboard.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | web/vite.config.ts (inline vitest config) |
| **Quick run command** | `cd /c/dev/ai-running-coach/web && npx vitest run {testfile} --reporter=verbose` |
| **Full suite command** | `cd /c/dev/ai-running-coach/web && npm run test` |
| **API suite command** | `cd /c/dev/ai-running-coach/api && npm run test` |
| **Estimated runtime** | ~25s (web), ~10s (api) |

---

## Sampling Rate

- **After every task commit:** Run quick command for the affected test file
- **After every plan wave:** Run full web + api suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | DASH-04 | unit (TDD) | `npx vitest run exerciseWeights.test.ts` | ✅ | ✅ green |
| 16-01-02 | 01 | 1 | DASH-04 | unit (TDD) | `npx vitest run exerciseWeights.test.ts` | ✅ | ✅ green |
| 16-02-01 | 02 | 1 | DASH-01,02,03 | unit | `npx vitest run useDashboard.test.ts` | ✅ | ✅ green |
| 16-02-02 | 02 | 1 | DASH-01,02,03 | unit | `npx vitest run useDashboard.test.ts` | ✅ | ✅ green |
| 16-03-01 | 03 | 2 | DASH-01,02,03,04 | component | `npx vitest run Dashboard.test.tsx` | ✅ | ✅ green |
| 16-03-02 | 03 | 2 | DASH-01,02,03,04 | component | `npx vitest run Dashboard.test.tsx` | ✅ | ✅ green |
| 16-03-03 | 03 | 2 | DASH-01,02,03,04 | build | `npm run build` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Nyquist Gap Closure (2026-05-09)

5 coverage gaps found post-execution and filled by `gsd-nyquist-auditor`.

| Gap | Requirement | Gap Type | Test File | Tests | Status |
|-----|-------------|----------|-----------|-------|--------|
| computeStats discipline branches | DASH-01 | MISSING | useDashboard.computeStats.test.ts | 4 | ✅ resolved |
| DisciplineSelector component behavior | DASH-01 | MISSING | DisciplineSelector.test.tsx | 8 | ✅ resolved |
| WeightProgressionChart fetch/states | DASH-03, DASH-04 | MISSING | WeightProgressionChart.test.tsx | 12 | ✅ resolved |
| WeeklyVolumeChart conditional bars | DASH-02 | MISSING | WeeklyVolumeChart.test.tsx | 9 | ✅ resolved |
| localStorage persistence (activeDiscipline) | DASH-01 | MISSING | useDashboard.localStorage.test.ts | 10 | ✅ resolved |

**New tests added:** 43 | **Total web tests after gap closure:** 635

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Audit 2026-05-09

| Metric | Count |
|--------|-------|
| Gaps found | 5 |
| Resolved | 5 |
| Escalated | 0 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-09
