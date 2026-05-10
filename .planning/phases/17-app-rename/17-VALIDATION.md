---
phase: 17
slug: app-rename
status: validated
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-10
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (web)** | Vitest + @testing-library/react |
| **Framework (api)** | Vitest |
| **Web config** | `web/vite.config.ts` |
| **API config** | `api/vitest.config.ts` |
| **Quick run (web)** | `cd web && npx vitest run` |
| **Quick run (api)** | `cd api && npx vitest run` |
| **E2E** | Playwright — `npx playwright test` |
| **Estimated runtime** | ~35s web, ~15s api |

---

## Sampling Rate

- **After every task commit:** Run `cd web && npx vitest run` or `cd api && npx vitest run` (whichever matches the changed files)
- **After every plan wave:** Run both full suites
- **Before `/gsd:verify-work`:** Both suites + E2E must be green
- **Max feedback latency:** ~50 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-T1 | 01 | 1 | RENAME-01 | unit | `cd web && npx vitest run src/__tests__/AppRename.strings.test.tsx` | ✅ | ✅ green |
| 17-01-T2 | 01 | 1 | RENAME-01 | unit + e2e | `cd web && npx vitest run src/__tests__/App.auth.test.tsx` | ✅ | ✅ green |
| 17-02-T1 | 02 | 1 | RENAME-01 | unit | `cd api && npx vitest run src/__tests__/rename.package.test.ts` | ✅ | ✅ green |
| 17-02-T2 | 02 | 1 | RENAME-01 | unit | `cd api && npx vitest run src/__tests__/db.fallback.test.ts` | ✅ | ✅ green |
| 17-02-T3 | 02 | 1 | RENAME-01 | integration | `cd api && npx vitest run` (all 396 tests) | ✅ | ✅ green |
| 17-03-T1 | 03 | 1 | RENAME-01 | manual | — | — | ⬜ manual |
| 17-03-T2 | 03 | 1 | RENAME-01 | manual | — | — | ⬜ manual |
| 17-03-T3 | 03 | 1 | RENAME-01 | manual | — | — | ⬜ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new framework setup needed.

**New test files added during Nyquist audit:**

| File | Coverage |
|------|----------|
| `web/src/__tests__/AppRename.strings.test.tsx` | ChangePasswordPage and PasswordPage h1 headings render "AI Training Coach" |
| `api/src/__tests__/rename.package.test.ts` | All three package.json name fields contain ai-training-coach prefix |
| `api/src/__tests__/db.fallback.test.ts` | db.ts regex fallback returns 'ai-training-coach' when no path in connection string |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README.md title, badges, prose, and GitHub rename section updated | RENAME-01 | Documentation content — not automatable | Grep: `grep "AI Training Coach" README.md` and `grep "GitHub Repository Rename" README.md` |
| CLAUDE.md heading and DB name architecture notes updated | RENAME-01 | Documentation content — not automatable | Grep: `grep "AI Training Coach" CLAUDE.md` |
| .docs/useful-commands.md container name and DB updated | RENAME-01 | Documentation content — not automatable | Grep: `grep "ai-training-coach" .docs/useful-commands.md` |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual-only classification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-10

---

## Validation Audit 2026-05-10

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated to manual-only | 0 |
| Total tests added | 10 (2 web + 8 api) |
