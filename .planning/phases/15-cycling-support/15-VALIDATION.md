---
phase: 15
slug: cycling-support
status: complete
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-07
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (API) + vitest + @testing-library/react (Web) |
| **API config** | `api/vitest.config.ts` |
| **Web config** | `web/vitest.config.ts` |
| **Quick run command** | `cd api && npm test` / `cd web && npm test` |
| **Full suite command** | `cd api && npm test && cd ../web && npm test` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick suite for the changed subsystem
- **After every plan wave:** Run both API and web suites
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | CYCLE-01 | unit | `cd web && npm test -- RunEntryForm.test.tsx` | ✅ | ✅ green |
| 15-01-02 | 01 | 1 | CYCLE-02 | unit | `cd web && npm test -- Runs.test.tsx RunDetailModal.test.tsx LinkRunModal.test.tsx` | ✅ | ✅ green |
| 15-02-01 | 02 | 1 | CYCLE-03 | unit | `cd api && npm test -- chat.test.ts` | ✅ | ✅ green |
| 15-02-02 | 02 | 1 | CYCLE-04 | unit | `cd api && npm test -- prompts.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cycling entry form visual flow | CYCLE-01 | Visual rendering + live state computation requires browser | Open "Add Session", select "Cycling", enter distance 30 + duration 60:00 — verify Speed field shows "30.0 km/h" and no Session Type picker |
| Cycling RunRow subtitle rendering | CYCLE-02 | Conditional JSX rendering requires browser runtime | Log cycling session, view Runs list — subtitle should show "30.0km · 60:00 · 30.0 km/h" |
| RunDetailModal cycling label | CYCLE-02 | Live state re-computation on input change requires browser | Click cycling run row — label reads "Speed (km/h)" with computed value; editing fields recomputes live |
| LinkRunModal speed in list items | CYCLE-02 | Conditional ternary rendering in list items requires browser | Open plan day "Link a run" with cycling runs in unlinked list — verify speed format not pace |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-07

---

## Validation Audit 2026-05-07

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

### Tests Added by Auditor

| File | New Tests | Requirement |
|------|-----------|-------------|
| `web/src/__tests__/RunEntryForm.test.tsx` | 5 (cycling discipline describe block) | CYCLE-01 |
| `web/src/__tests__/Runs.test.tsx` | 1 (cycling subtitle) | CYCLE-02 |
| `web/src/__tests__/RunDetailModal.test.tsx` | 2 (Speed (km/h) label + value) | CYCLE-02 |
| `web/src/__tests__/LinkRunModal.test.tsx` | 1 (speed in list items) | CYCLE-02 |
| `api/src/__tests__/chat.test.ts` | 4 (cycle context line describe block) | CYCLE-03 |

### Final Test Counts

| Suite | Before | After |
|-------|--------|-------|
| API tests | 378 | 382 |
| Web tests | 540 | 549 |
