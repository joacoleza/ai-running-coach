---
phase: 04
slug: dashboard
status: audited
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-09
---

# Phase 4 — Validation Strategy

> Per-phase validation contract. Reconstructed from artifacts (State B) during `/gsd:validate-phase 4`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/component) + Playwright (E2E) |
| **Unit config** | `web/vitest.config.ts` |
| **E2E config** | `playwright.config.ts` |
| **Quick run command** | `npm test` (from `web/`) |
| **Full suite command** | `npm test && npx playwright test` |
| **Estimated runtime** | ~15s unit · ~45s E2E |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (from `web/`)
- **After every plan wave:** Run `npm test && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds (unit), ~60 seconds (E2E)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 | DASH-01, DASH-02 | unit | `npm test -- Sidebar` | ✅ `Sidebar.test.tsx` | ✅ green |
| 04-01-T2 | 01 | 1 | DASH-01, DASH-03 | build | `npm run build` | ✅ scaffold | ✅ green |
| 04-01-T3 | 01 | 1 | DASH-01, DASH-02 | unit | `npm test -- pages Sidebar` | ✅ `pages.test.tsx`, `Sidebar.test.tsx` | ✅ green |
| 04-02-T1 | 02 | 2 | DASH-01, DASH-02, DASH-03 | unit | `npm test -- useDashboard` | ✅ `useDashboard.test.ts` | ✅ green |
| 04-02-T2 | 02 | 2 | DASH-01, DASH-02, DASH-03 | unit | `npm test -- useDashboard` | ✅ `useDashboard.test.ts` | ✅ green |
| 04-03-T1 | 03 | 3 | DASH-01, DASH-02, DASH-03 | build | `npm run build` | ✅ `Dashboard.tsx` | ✅ green |
| 04-03-T2 | 03 | 3 | DASH-01, DASH-02, DASH-03 | unit | `npm test -- Dashboard` | ✅ `Dashboard.test.tsx` | ✅ green |
| 04-04-T1 | 04 | 2 | DASH-04 | unit | `npm test -- CoachPanel` | ✅ `CoachPanel.test.tsx` | ✅ green |
| 04-04-T2 | 04 | 2 | DASH-04 | unit | `npm test -- ArchivePlan` | ✅ `ArchivePlan.test.tsx` | ✅ green |
| 04-04-T3 | 04 | 2 | DASH-04 | unit | `npm test -- CoachPanel ArchivePlan` | ✅ both | ✅ green |
| 04-05-T1 | 05 | 4 | DASH-01..04 | E2E | `npx playwright test e2e/dashboard.spec.ts` | ✅ `dashboard.spec.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No Wave 0 test stubs were needed — vitest and Playwright were already installed from Phase 1.2.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard chart rendering (bar/line charts with SVG) | DASH-03 | Recharts SVG rendering cannot be fully validated in jsdom; ResponsiveContainer requires real browser | Navigate to `/dashboard` with runs; verify green BarChart bars + blue LineChart line with tooltips |
| Filter switching updates stats and charts visually | DASH-01, DASH-03 | Requires live data to see meaningful changes between filter states | Switch filter presets; observe loading spinner + updated values |
| ArchivePlan readonly panel desktop layout | DASH-04 | CSS flexbox side-by-side layout requires real browser | Open archived plan at md+ viewport; verify plan + panel side-by-side |
| ArchivePlan mobile FAB opens bottom sheet | DASH-04 | Mobile touch interaction and bottom sheet animation require real device | Open archived plan at 375px viewport; tap gray clock FAB; verify readonly CoachPanel slides up |

---

## Test Coverage by Requirement

| Requirement | Description | Automated Tests | Manual Tests | Status |
|-------------|-------------|-----------------|--------------|--------|
| DASH-01 | Dashboard shows training schedule with session status | Sidebar.test.tsx (nav order), Dashboard.test.tsx (stat cards), e2e/dashboard.spec.ts (routing, filters) | — | COVERED |
| DASH-02 | Run history aggregated stats | useDashboard.test.ts (parseDuration, computeDateRange), Dashboard.test.tsx (stats render) | — | COVERED |
| DASH-03 | Progress indicator (adherence %, volume) | Dashboard.test.tsx (Adherence value + navigation), e2e (stat labels, adherence nav) | Chart rendering | COVERED |
| DASH-04 | Coach chat history as dedicated section | CoachPanel.test.tsx (readonly mode, 6 tests), ArchivePlan.test.tsx (chat history fetch, FAB, 9 tests) | Desktop layout, mobile FAB | COVERED |
| IMP-01 | Paste raw LLM conversation text | N/A — DESCOPED | N/A | DESCOPED |
| IMP-02 | Claude extracts/normalizes pasted plan | N/A — DESCOPED | N/A | DESCOPED |
| IMP-03 | Preview of parsed plan before save | N/A — DESCOPED | N/A | DESCOPED |

> **IMP-01/02/03 descoped:** User decision recorded in `04-CONTEXT.md` and `ROADMAP.md`. Not implementation gaps.

---

## Test File Inventory

| File | Tests | Covers |
|------|-------|--------|
| `web/src/__tests__/useDashboard.test.ts` | 17 | parseDurationToMinutes (5), formatTotalTime (5), computeDateRange (7) |
| `web/src/__tests__/Dashboard.test.tsx` | 16 | Stat values, empty state (no-runs), loading state, Adherence click nav |
| `web/src/components/layout/Sidebar.test.tsx` | 4 | Dashboard nav presence, Dashboard before Training Plan order |
| `web/src/__tests__/pages.test.tsx` | 4 | Dashboard heading render, filter presets, stat card labels |
| `web/src/__tests__/CoachPanel.test.tsx` | 21 | Mobile overlay, no-plan state, cursor-pointer, readonly mode (6) |
| `web/src/__tests__/ArchivePlan.test.tsx` | 9 | Loading/error/not-found states, chat history fetch, readonly panel, FAB |
| `e2e/dashboard.spec.ts` | 7 | / redirect, sidebar order, filter active state, stat labels, Adherence nav, empty state, archive FAB |

**Total automated: 406 tests (32 test files) — all passing**

---

## Validation Sign-Off

- [x] All tasks have automated verify or build verification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 needed — existing infrastructure sufficient
- [x] No watch-mode flags
- [x] Feedback latency < 60s (unit ~15s, E2E ~45s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-09

---

## Validation Audit 2026-04-09

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated to manual-only | 4 (chart rendering, filter data visibility, desktop layout, mobile FAB animation) |
| Total requirements | 4 active (DASH-01..04) + 3 descoped (IMP-01..03) |
| Nyquist compliance | ✅ |

## Validation Audit 2026-04-09 (re-audit)

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Test count delta | +3 (Dashboard.test.tsx: 13→16, no-runs empty state) |
| Total suite | 406 tests (32 test files) — all green |
| Nyquist compliance | ✅ |
