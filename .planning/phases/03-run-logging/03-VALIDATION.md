---
phase: 3
slug: run-logging
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
updated: 2026-03-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (api/ and web/) + Playwright (e2e/) |
| **Config file** | `api/vitest.config.ts`, `web/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `cd api && npm test -- --run` |
| **Full suite command** | `cd api && npm test -- --run && cd ../web && npm test -- --run && npx playwright test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && npm test -- --run`
- **After every plan wave:** Run full suite (api + web + playwright)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Test File | Status |
|---------|------|------|-------------|-----------|-----------|--------|
| 03-01-01 | 01 | 1 | RUN-01 (create run) | unit | `api/src/__tests__/runs.test.ts` | ✅ green |
| 03-01-02 | 01 | 1 | RUN-01 (list/delete runs) | unit | `api/src/__tests__/runs.test.ts` | ✅ green |
| 03-02-01 | 01 | 1 | RUN-02 (storage + pace) | unit | `api/src/__tests__/runs.test.ts` | ✅ green |
| 03-02-02 | 01 | 1 | RUN-02 (HR optional, pace computed) | unit | `api/src/__tests__/runs.test.ts` | ✅ green |
| 03-03-01 | 01 | 1 | RUN-04 (link run → day complete) | unit | `api/src/__tests__/runs.test.ts` | ✅ green |
| 03-04-01 | 01 | 2 | RUN-04 (undo unlinks run) | integration | `api/src/__tests__/runs.test.ts` | ✅ green |
| 03-05-01 | 03 | 2 | RUN-01 frontend (RunEntryForm) | unit | `web/src/__tests__/RunEntryForm.test.tsx` | ✅ green |
| 03-05-02 | 03 | 2 | RUN-01 frontend (complete → form) | unit | `web/src/__tests__/DayRow.test.tsx` | ✅ green |
| 03-06-01 | 02 | 2 | COACH-03 (run data in chat context) | integration | `api/src/__tests__/chat.integration.test.ts` | ✅ green |
| 03-07-01 | 06 | 4 | COACH-03/COACH-04 (E2E run flows) | e2e | `e2e/runs.spec.ts` | ✅ green |

*Note: RUN-03 and RUN-05 removed — ZIP/Apple Health upload approach dropped (2026-03-29 rethink).*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apple Health ZIP upload via real iOS device | RUN-01 | Requires real Apple Watch data; iOS simulator can't export ZIP | Upload actual export.xml ZIP, verify run appears in UI |
| HR zone display accuracy | RUN-02 | Requires user-specific max HR configuration | Set max HR, upload run with known HR data, verify zone breakdown |

---

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete — all required test files exist
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-03-31

---

## Validation Audit 2026-03-31

| Metric | Count |
|--------|-------|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

**Gap resolved:** COACH-03 — added 3 integration tests to `chat.integration.test.ts` verifying run data injection (distance, pace in M:SS), progressFeedback preamble, and graceful no-run fallback.
