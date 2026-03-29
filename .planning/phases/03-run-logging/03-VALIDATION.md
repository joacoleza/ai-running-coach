---
phase: 3
slug: run-logging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | RUN-01 | unit | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | RUN-01 | unit | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | RUN-02 | unit | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | RUN-02 | unit | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | RUN-03 | unit | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 3 | RUN-04 | integration | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 3 | RUN-05 | unit | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-06-01 | 06 | 4 | COACH-03 | unit | `cd api && npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-07-01 | 07 | 4 | COACH-04 | e2e | `npx playwright test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/src/functions/__tests__/parseBlobTrigger.test.ts` — stubs for RUN-01 (blob trigger + XML parsing)
- [ ] `api/src/functions/__tests__/uploadSas.test.ts` — stubs for RUN-01 (SAS token endpoint)
- [ ] `api/src/__tests__/runMatching.test.ts` — stubs for RUN-03 (plan matching logic)
- [ ] `api/src/__tests__/hrZones.test.ts` — stubs for RUN-02 (HR zone computation)
- [ ] `api/src/__tests__/uploadStatus.test.ts` — stubs for RUN-04 (status polling endpoint)
- [ ] `api/src/__tests__/coachFeedback.test.ts` — stubs for COACH-03/COACH-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Apple Health ZIP upload via real iOS device | RUN-01 | Requires real Apple Watch data; iOS simulator can't export ZIP | Upload actual export.xml ZIP, verify run appears in UI |
| HR zone display accuracy | RUN-02 | Requires user-specific max HR configuration | Set max HR, upload run with known HR data, verify zone breakdown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
