---
phase: 04-dashboard
verified: 2026-04-10T11:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 14/14
  gaps_closed:
    - "Adherence card shown only when activeFilter === 'current-plan' (UAT test 3)"
    - "Pace vs Heart Rate ComposedChart with dual Y-axes added (UAT test 5)"
    - "AppShell suppresses live CoachPanel on /archive/:id routes (UAT test 8)"
    - "AppShell suppresses mobile FAB on /archive/:id routes (UAT test 9)"
    - "Full E2E suite passes — 59/59 tests green (UAT test 10)"
  gaps_remaining: []
  regressions: []
---

# Phase 4: Dashboard Verification Report

**Phase Goal:** Real dashboard home page with date-filtered training stats, volume and pace charts, and readonly archived plan chat history.
**Verified:** 2026-04-10T11:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure plans 04-06 and 04-07 (UAT issues 3, 5, 8, 9, 10)

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                          | Status     | Evidence                                                                                          |
|----|----------------------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| 1  | / redirects to /dashboard                                                                                      | VERIFIED   | App.tsx line 39: `<Navigate to="/dashboard" replace />` for `/` route                            |
| 2  | * fallback route redirects to /dashboard                                                                       | VERIFIED   | App.tsx line 45: `<Navigate to="/dashboard" replace />` for `*` route                            |
| 3  | Dashboard is first nav item in Sidebar                                                                         | VERIFIED   | navItems[0].path === "/dashboard" in Sidebar.tsx                                                  |
| 4  | Recharts installed; BarChart, LineChart, ComposedChart all render with real data                               | VERIFIED   | package.json recharts ^3.8.1; Dashboard.tsx imports and renders all three chart types             |
| 5  | useDashboard returns stats, chart data (weeklyData, paceData, paceBpmData) for all 7 filter presets           | VERIFIED   | useDashboard.ts: exports DashboardStats, WeeklyDataPoint, PaceDataPoint, PaceBpmDataPoint, useDashboard, computeDateRange |
| 6  | Current Plan filter fetches runs linked to active plan only                                                    | VERIFIED   | useDashboard.ts lines 234-236: fetches limit:1000, filters `r.planId === plan._id`               |
| 7  | Date-based filters compute correct dateFrom/dateTo and fetch all runs in range                                 | VERIFIED   | computeDateRange() handles all 6 date presets with correct arithmetic                             |
| 8  | Adherence stat card shows ONLY when activeFilter === 'current-plan'; hidden for all other filters              | VERIFIED   | Dashboard.tsx line 95: `{activeFilter === 'current-plan' && (<div ...>Adherence</div>)}`         |
| 9  | Adherence card is clickable and navigates to /plan                                                             | VERIFIED   | Dashboard.tsx lines 98-103: `role="button"`, `onClick={() => navigate('/plan')}`                 |
| 10 | Weekly Volume bar chart and Pace Trend line chart render with real data when weeklyData.length > 0             | VERIFIED   | Dashboard.tsx lines 126-170: BarChart + LineChart conditional on weeklyData.length > 0            |
| 11 | Pace vs Heart Rate ComposedChart with dual Y-axes renders when paceBpmData.length > 0                         | VERIFIED   | Dashboard.tsx lines 173-225: ComposedChart with yAxisId="pace" left + yAxisId="bpm" right       |
| 12 | useDashboard accumulates avgHR per week bucket and computes avgBPM for paceBpmData                            | VERIFIED   | useDashboard.ts: hrValues[] in WeekBucket; lines 265-267: avgBPM computed; paceBpmData returned  |
| 13 | Empty states render for no-plan and no-runs scenarios                                                          | VERIFIED   | Dashboard.tsx lines 65-76 ("No active training plan"), 118-123 ("No runs yet")                   |
| 14 | AppShell suppresses live CoachPanel on /archive/:id routes (desktop column not mounted)                        | VERIFIED   | AppShell.tsx line 16: isArchivePlanRoute regex; line 55: `{!isArchivePlanRoute && <CoachPanel/>}` |
| 15 | AppShell suppresses mobile FAB on /archive/:id routes (blue FAB does not cover gray archive FAB)              | VERIFIED   | AppShell.tsx line 60: `{showFab && !isArchivePlanRoute && <button ...FAB...>}`                   |
| 16 | CoachPanel accepts readonly prop; removes input/send; shows "Plan History" title in gray                       | VERIFIED   | CoachPanel.tsx: readonly prop; headerTitle conditional; input/send gated on !readonly            |
| 17 | ArchivePlan fetches /api/messages?planId=X and renders readonly CoachPanel with gray clock FAB                 | VERIFIED   | ArchivePlan.tsx lines 47: fetch; line 109: readonly={true}; lines 114-125: gray bg-gray-500 FAB  |
| 18 | Full E2E suite (59 tests) passes — home route fix, plan.phases ?? [] guard, spec assertions updated           | VERIFIED   | Commit 5d056a2: 59/59 E2E tests passing; 411 web unit tests passing; build exits 0               |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact                                          | Expected                                                               | Status     | Details                                                                           |
|---------------------------------------------------|------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------|
| `web/src/App.tsx`                                 | / → /dashboard redirect; * → /dashboard fallback                       | VERIFIED   | Both Navigate routes confirmed at lines 39, 45                                    |
| `web/src/components/layout/Sidebar.tsx`           | Dashboard first in navItems array                                      | VERIFIED   | navItems[0].path === "/dashboard"                                                 |
| `web/src/pages/Dashboard.tsx`                     | Filter row, stat cards with adherence guard, 3 charts, empty states    | VERIFIED   | 232 lines; adherence gated; ComposedChart implemented; all chart types rendering  |
| `web/src/hooks/useDashboard.ts`                   | useDashboard with filter, fetch, stats, weeklyData, paceData, paceBpmData | VERIFIED | 282 lines; hrValues bucketing; PaceBpmDataPoint; paceBpmData returned             |
| `web/src/components/layout/AppShell.tsx`          | Route-aware: suppress CoachPanel + FAB on /archive/:id                 | VERIFIED   | useLocation + isArchivePlanRoute regex; CoachPanel and FAB both gated             |
| `web/src/components/coach/CoachPanel.tsx`         | readonly prop support (no input, gray title, renders initialMessages)  | VERIFIED   | Props interface; readonly-gated sections confirmed                                |
| `web/src/pages/ArchivePlan.tsx`                   | Chat history fetch, readonly CoachPanel, gray clock FAB                | VERIFIED   | 128 lines; fetch /api/messages?planId=; CoachPanel readonly; gray FAB bg-gray-500 |
| `e2e/dashboard.spec.ts`                           | E2E tests for routing, filters, stat cards, Adherence nav, archive FAB | VERIFIED   | 153 lines; 6 Dashboard tests + 1 ArchivePlan test                                 |
| `web/package.json`                                | recharts dependency                                                    | VERIFIED   | "recharts": "^3.8.1" in dependencies                                              |

### Key Link Verification

| From                                       | To                                        | Via                                         | Status  | Details                                                                          |
|--------------------------------------------|-------------------------------------------|---------------------------------------------|---------|----------------------------------------------------------------------------------|
| `web/src/App.tsx`                          | `web/src/pages/Dashboard.tsx`             | Route path="/dashboard"                     | WIRED   | App.tsx line 41: `<Route path="/dashboard" element={<Dashboard />}/>`            |
| `web/src/pages/Dashboard.tsx`              | `web/src/hooks/useDashboard.ts`           | useDashboard() hook call                    | WIRED   | Dashboard.tsx: import useDashboard + destructured in component body              |
| `web/src/pages/Dashboard.tsx`              | recharts                                  | BarChart, LineChart, ComposedChart imports  | WIRED   | Dashboard.tsx lines 3-8: all recharts components imported and used in JSX        |
| `web/src/hooks/useDashboard.ts`            | `web/src/hooks/useRuns.ts`                | fetchRuns() calls                           | WIRED   | useDashboard.ts: imports fetchRuns; called in useEffect                          |
| `web/src/hooks/useDashboard.ts`            | `web/src/hooks/usePlan.ts`                | usePlan() for plan + adherence              | WIRED   | useDashboard.ts line 220: `const { plan, linkedRuns } = usePlan()`               |
| `web/src/components/layout/AppShell.tsx`   | `react-router-dom`                        | useLocation + pathname regex                | WIRED   | AppShell.tsx line 15: `const { pathname } = useLocation()`; line 16: regex test  |
| `web/src/pages/ArchivePlan.tsx`            | `GET /api/messages?planId=X`              | fetch on mount after plan load              | WIRED   | ArchivePlan.tsx line 47: `fetch('/api/messages?planId=${planId}')`               |
| `web/src/pages/ArchivePlan.tsx`            | `web/src/components/coach/CoachPanel.tsx` | readonly={true} + initialMessages prop      | WIRED   | ArchivePlan.tsx lines 106-111: CoachPanel readonly={true} initialMessages={...}  |

### Data-Flow Trace (Level 4)

| Artifact                        | Data Variable | Source                           | Produces Real Data           | Status      |
|---------------------------------|---------------|----------------------------------|------------------------------|-------------|
| `web/src/pages/Dashboard.tsx`   | stats         | useDashboard → fetchRuns         | Yes — GET /api/runs          | FLOWING     |
| `web/src/pages/Dashboard.tsx`   | weeklyData    | useDashboard → groupRunsByWeek   | Yes — derived from real runs | FLOWING     |
| `web/src/pages/Dashboard.tsx`   | paceData      | useDashboard → groupRunsByWeek   | Yes — derived from real runs | FLOWING     |
| `web/src/pages/Dashboard.tsx`   | paceBpmData   | useDashboard → groupRunsByWeek   | Yes — hrValues from run.avgHR; no static fallback bypasses fetch | FLOWING |
| `web/src/pages/ArchivePlan.tsx` | chatMessages  | fetchChatHistory → /api/messages | Yes — GET /api/messages?planId= | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                   | Command                              | Result           | Status |
|--------------------------------------------|--------------------------------------|------------------|--------|
| TypeScript build                           | npm run build (web/)                 | Exit 0, 747ms    | PASS   |
| Web unit tests                             | npm test -- --run (web/)             | 411/411 passed   | PASS   |
| E2E suite (last confirmed)                 | commit 5d056a2 log                   | 59/59 passing    | PASS   |
| useDashboard exports (types + hook)        | TypeScript build passes with imports | Verified         | PASS   |

### Requirements Coverage

| Requirement | Source Plan  | Description                                                         | Status    | Evidence                                                                              |
|-------------|-------------|----------------------------------------------------------------------|-----------|---------------------------------------------------------------------------------------|
| DASH-01     | 04-01 to 04-05 | Dashboard shows training schedule with session status            | SATISFIED | Filter presets, stat cards, adherence % all functional                                |
| DASH-02     | 04-01 to 04-06 | Run history list with key stats per run                          | SATISFIED | Dashboard aggregates run distance, count, time; Runs page shows individual runs       |
| DASH-03     | 04-01 to 04-06 | Progress indicator (adherence %, volume)                         | SATISFIED | Adherence card (current-plan filter only) + totalDistance + totalTime stat cards      |
| DASH-04     | 04-04, 04-07   | Coach chat history accessible as dedicated section               | SATISFIED | Readonly CoachPanel on ArchivePlan; AppShell suppressed on /archive/:id               |
| IMP-01      | Descoped       | Paste raw LLM conversation text                                  | DESCOPED  | Explicitly dropped per user decision (04-CONTEXT.md line 12)                          |
| IMP-02      | Descoped       | Claude extracts/normalizes pasted plan                           | DESCOPED  | Same as IMP-01                                                                        |
| IMP-03      | Descoped       | Preview of parsed plan before save                               | DESCOPED  | Same as IMP-01                                                                        |

**Note on IMP-01/02/03:** User explicitly confirmed these are not needed (04-CONTEXT.md line 11-13). They appear in REQUIREMENTS.md as Phase 4 entries for traceability bookkeeping only — they were never implemented nor intended to be.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| —    | —    | None    | —        | —      |

No TODO, FIXME, placeholder comments, empty handlers, or stub return values found in any phase 4 implementation file. The `ComposedChart` that was temporarily stubbed in plan 04-06 was completed in plan 04-07 before any commit landed with the build-failing stub state.

### Human Verification Required

#### 1. Dashboard Chart Rendering — All Three Charts

**Test:** Navigate to `/dashboard` with runs in the database (some with avgHR data). Select "Current Plan" filter, then switch to "Last 4 weeks". Observe all three chart sections.
**Expected:** (a) Weekly Volume shows green bars with week labels. (b) Pace Trend shows a blue line with dots. (c) Pace vs Heart Rate shows two overlapping lines with dual Y-axes (pace left, BPM right) and a legend. Tooltips show correct formatted values on hover.
**Why human:** Recharts SVG rendering and ResponsiveContainer width calculations require a real browser. The ComposedChart dual-axis layout can only be validated visually.

#### 2. Filter Switching Hides/Shows Adherence Card

**Test:** With an active plan and at least one run, load the Dashboard on "Current Plan" filter. Confirm the Adherence card is visible. Switch to "Last 4 weeks". Confirm the Adherence card disappears. Switch back to "Current Plan". Confirm it reappears.
**Expected:** Adherence card appears only on Current Plan filter; absent on all date-based filters.
**Why human:** Conditional rendering correctness is unit-tested, but the live toggle experience and absence of layout shift need visual confirmation.

#### 3. AppShell CoachPanel Suppressed on Archive Route (Desktop)

**Test:** On desktop (1280px viewport), open an archived plan at `/archive/:id`. Inspect the right side of the layout.
**Expected:** Only the plan content and the readonly "Plan History" panel are visible. The live active coaching panel (blue header, chat input) is completely absent. No gap or empty right column from where the AppShell CoachPanel would have been.
**Why human:** CSS flex layout behavior and visual absence of the AppShell CoachPanel require browser inspection.

#### 4. Archive Mobile FAB — Gray Clock, Not Blue Chat

**Test:** On mobile (375px), open an archived plan. Confirm only the gray clock FAB is visible (no blue chat FAB). Tap it.
**Expected:** Gray clock icon FAB visible at bottom-right. Tapping opens the readonly Plan History overlay with no text input.
**Why human:** Mobile FAB z-order and touch interaction require a real device or devtools.

### Gaps Summary

No gaps. All 18 observable truths verified. This re-verification confirms all 5 UAT issues from 04-UAT.md have been closed:

- **UAT test 3 (Adherence card):** Dashboard.tsx wraps Adherence card in `activeFilter === 'current-plan'` guard. Confirmed at line 95.
- **UAT test 5 (Pace + BPM chart):** useDashboard.ts accumulates `hrValues[]` per week bucket, exports `paceBpmData`. Dashboard.tsx renders a `ComposedChart` with dual Y-axes at lines 173-225. Confirmed.
- **UAT test 8 (AppShell live chat on archive desktop):** AppShell.tsx uses `useLocation` + `/^\/archive\/.+/` regex; CoachPanel not mounted when `isArchivePlanRoute`. Confirmed at lines 16, 55.
- **UAT test 9 (FAB z-conflict on archive mobile):** AppShell.tsx gates its FAB with `&& !isArchivePlanRoute`. Confirmed at line 60.
- **UAT test 10 (E2E failures):** commit 5d056a2 fixed home-route assertions in coach.spec.ts and training-plan.spec.ts, and added `plan.phases ?? []` guard in useDashboard.ts. 59/59 E2E tests confirmed passing.

IMP-01/02/03 remain descoped by explicit user decision — not implementation gaps.

---

_Verified: 2026-04-10T11:00:00Z_
_Verifier: Claude (gsd-verifier)_
