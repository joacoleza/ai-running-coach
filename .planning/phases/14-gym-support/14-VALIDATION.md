---
phase: 14
slug: gym-support
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-03
audited: 2026-05-04
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x + @testing-library/react |
| **Config file** | `api/vitest.config.ts`, `web/vite.config.ts` (vitest plugin) |
| **Quick run command** | `cd api && npm test` + `cd web && npm test` |
| **Full suite command** | `cd api && npm test && cd ../web && npm test && npx playwright test` |
| **Estimated runtime** | ~60 seconds (unit) + ~90 seconds (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd api && npm test` + `cd web && npm test`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | GYM-01, DISC-03 | unit | `cd api && npm test -- runs.test.ts` | ✅ extend existing | ✅ green |
| 14-01-02 | 01 | 1 | GYM-01, DISC-03 | unit | `cd web && npm test -- RunEntryForm.test.tsx` | ✅ extend existing | ✅ green |
| 14-01-03 | 01 | 1 | GYM-02 | unit | `cd api && npm test -- runs.test.ts` | ✅ extend existing | ✅ green |
| 14-02-01 | 02 | 1 | DISC-04 | unit | `cd web && npm test -- RunBadge.test.tsx` | ✅ Wave 1 new file | ✅ green |
| 14-02-02 | 02 | 1 | DISC-05 | unit | `cd web && npm test -- Runs.test.tsx` | ✅ extend existing | ✅ green |
| 14-03-01 | 03 | 2 | GYM-02 | unit | `cd web && npm test -- ExerciseForm.test.tsx` | ✅ Wave 2 new file | ✅ green |
| 14-03-02 | 03 | 2 | GYM-02 | unit | `cd web && npm test -- RunDetailModal.test.tsx` | ✅ extend existing | ✅ green |
| 14-04-01 | 04 | 2 | GYM-03, GYM-04 | unit | `cd web && npm test -- ExerciseChecklistItem.test.tsx` | ✅ Wave 2 new file | ✅ green |
| 14-04-02 | 04 | 2 | GYM-04 | unit | `cd api && npm test -- planDays.test.ts` | ✅ extend existing | ✅ green |
| 14-05-01 | 05 | 3 | GYM-06 | unit | `cd api && npm test -- chat.test.ts` | ✅ extend existing | ✅ green |
| 14-05-02 | 05 | 3 | GYM-05 | unit | `cd api && npm test -- prompts.test.ts` | ✅ extend existing | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 1 Prerequisites

Files created in Wave 1 (Plans 01 and 02) that Wave 2 plans depend on:

- [x] `web/src/components/runs/RunBadge.tsx` — Discipline badge component (created by Plan 02)
- [x] `web/src/__tests__/RunBadge.test.tsx` — Unit tests for discipline badge (created by Plan 02)

Wave 2 files (`ExerciseForm.tsx`, `ExerciseList.tsx`, `ExerciseChecklistItem.tsx`) are outputs of Wave 2 plans (03 and 04), not prerequisites. They do not need to exist before Wave 1 executes.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coach generates gym workout with exercises via chat | GYM-05 | Requires live ANTHROPIC_API_KEY; mocked in unit tests | Log in, open coach, ask "Generate a gym workout for tomorrow", verify <plan:add> includes exercises array |
| Exercise checklist UI expand/collapse on plan view | GYM-03 | Visual interaction; unit tests cover rendering but not expand animation | Open plan, find gym day, click expand, verify list shows, click again to collapse |
| Discipline filter persists via URL query param | DISC-05 | URL behavior; unit tests cover state logic | On Runs page, select "Gym" filter, navigate away, press Back, verify ?discipline=gym in URL |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 1 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 1 prerequisites cover all MISSING references in Wave 2 plans
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-05-04

---

## Validation Audit 2026-05-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 11 tasks confirmed green. API suite: 373 tests passing. Web suite: 540 tests passing. No new test files required — all coverage was implemented during phase execution.
