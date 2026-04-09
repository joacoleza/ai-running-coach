---
status: diagnosed
phase: 04-dashboard
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md]
started: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Dashboard is the app home
expected: Open the app (or navigate to /) in the browser. The URL should automatically redirect to /dashboard and the Dashboard page should be visible — not the Training Plan. The sidebar should show Dashboard as the first nav item (before Training Plan, Runs, Archive).
result: pass

### 2. Filter presets row
expected: The Dashboard shows a row of 7 filter pills at the top: "Current Plan", "Last 4 weeks", "Last 8 weeks", "Last 3 months", "Last 12 months", "This year", "All time". The active filter has a gray-200 background highlight. Clicking a different preset switches the highlight to the new selection.
result: pass

### 3. Stat cards show live data
expected: With at least one run logged, the 4 stat cards (Total Distance, Total Runs, Total Time, Adherence) all show real values — not dashes. Total Distance shows a number with "km", Total Runs shows a count, Total Time shows "Xh Ym" or "Ym", Adherence shows a percentage.
result: issue
reported: "Adherence shows a meaningless value on date-based filters. Revised: show Adherence card only when Current Plan filter is active (where it is meaningful). Hide it for all other filters."
severity: major

### 4. Adherence card navigates to Training Plan
expected: Click the Adherence stat card. The app navigates to /plan (Training Plan page). The card should visually indicate it's clickable (cursor changes to pointer on hover).
result: pass
note: Card navigation works. Per test 3 issue, card will be conditional — visible only on Current Plan filter.

### 5. Charts render with data
expected: With runs in the selected filter period, the Dashboard shows two charts below the stat cards: "Weekly Volume" (bar chart with green bars) and "Pace Trend" (line chart with blue line). Hovering over bars/points shows a tooltip with values.
result: issue
reported: "Charts work. Want an additional chart that combines pace and BPM — low BPM naturally produces lower pace so the two need to be read together. Keep the Pace Trend chart, add a new combined Pace + BPM chart."
severity: minor

### 6. Empty state — no active plan
expected: With no training plan (or with "Current Plan" filter selected when there's no active plan), the Dashboard shows "No active training plan" message and a "Start Planning" button. The charts section should not appear.
result: pass

### 7. Empty state — no runs
expected: With an active plan but no runs logged yet, the stat cards show "—" values and the chart area is hidden (no "Weekly Volume" or "Pace Trend" sections).
result: pass

### 8. Archived plan — Plan History panel (desktop)
expected: Navigate to an archived plan (Archive page → click a plan). On desktop (wide viewport), the page shows the archived plan details on the left and a "Plan History" coach panel on the right. The panel shows previous chat messages but has NO text input, NO Send button, and NO Start Over button. The title reads "Plan History" in gray (not blue).
result: issue
reported: "The Plan History panel shows correctly, but the active Coach chat is also visible. On the archived plan page only the readonly Plan History panel should be shown — not the live coach chat."
severity: major

### 9. Archived plan — mobile FAB opens readonly panel
expected: On a mobile-sized viewport (or narrow browser window), the archived plan page shows a gray clock-icon FAB button ("View plan history"). Tapping it opens the readonly Plan History panel as an overlay. The panel has no input area.
result: issue
reported: "The regular blue coach chat FAB is showing instead of the gray 'View plan history' button. The 'View plan history' FAB is not visible at all. The AppShell coach FAB is overriding/covering the archive-specific one."
severity: major

## Summary

total: 9
passed: 5
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Adherence stat card is visible on Dashboard only when activeFilter === 'current-plan' (where it is meaningful and navigates to /plan on click). It is hidden for all other filter presets."
  status: failed
  reason: "User reported: Adherence shows a meaningless value on date-based filters. Clarified: keep the card on Dashboard for Current Plan filter only (with click-to-plan nav). Hide it when any other filter is active."
  severity: major
  test: 3
  root_cause: "Adherence card (Dashboard.tsx lines 92-99) is always rendered regardless of activeFilter. The adherence value in computeStats() (useDashboard.ts lines 184-199) uses linkedRuns.size / totalNonRest — neither is date-windowed, so it is meaningless on any filter other than current-plan."
  artifacts:
    - path: "web/src/pages/Dashboard.tsx"
      issue: "Adherence card rendered unconditionally (lines 92-99) — needs activeFilter === 'current-plan' guard"
    - path: "web/src/hooks/useDashboard.ts"
      issue: "adherence computed in computeStats() always (lines 184-199) — no filter-awareness"
  missing:
    - "Wrap Adherence card in Dashboard.tsx with {activeFilter === 'current-plan' && ...}"
    - "No change needed to useDashboard.ts — computation is fine for current-plan, just hidden otherwise"
  debug_session: ".planning/debug/adherence-placement-wrong.md"

- truth: "Archived plan page shows only the readonly Plan History panel — the live coach chat (AppShell CoachPanel) must be hidden when on the ArchivePlan route"
  status: failed
  reason: "User reported: The Plan History panel shows correctly, but the active Coach chat is also visible. On the archived plan page only the readonly Plan History panel should be shown — not the live coach chat."
  severity: major
  test: 8
  root_cause: "AppShell.tsx (line 52) always mounts CoachPanel. When isOpen=false, CoachPanel applies 'hidden md:flex md:flex-col md:w-80' — making it always visible as a right column on desktop. AppShell has no useLocation() route-awareness so it renders on every page including /archive/:id."
  artifacts:
    - path: "web/src/components/layout/AppShell.tsx"
      issue: "No route-awareness — CoachPanel rendered on all routes including /archive/:id (line 52)"
    - path: "web/src/components/coach/CoachPanel.tsx"
      issue: "isOpen=false branch uses 'hidden md:flex' (line 85) — always visible as desktop column"
  missing:
    - "Add useLocation() to AppShell.tsx, derive isArchivePlanRoute = /^\\/archive\\/.+/.test(pathname)"
    - "Skip rendering AppShell's CoachPanel when isArchivePlanRoute"
  debug_session: ".planning/debug/appshell-coachpanel-archive-overlap.md"

- truth: "On mobile, the archived plan page shows a gray 'View plan history' FAB (not the regular blue coach FAB). Tapping it opens the readonly Plan History overlay. The AppShell coach FAB must be suppressed on the /archive/:id route."
  status: failed
  reason: "User reported: The regular blue coach chat FAB is showing instead of the gray 'View plan history' button. The 'View plan history' FAB is not visible at all. The AppShell coach FAB is overriding/covering the archive-specific one."
  severity: major
  test: 9
  root_cause: "AppShell FAB (lines 55-70, fixed bottom-6 right-4 z-40 md:hidden) and ArchivePlan FAB (lines 114-125, same fixed position and z-index) occupy identical screen coordinates. AppShell's FAB renders after {children} in DOM order, so it paints on top and completely covers the gray ArchivePlan FAB."
  artifacts:
    - path: "web/src/components/layout/AppShell.tsx"
      issue: "FAB rendered on all routes at fixed bottom-6 right-4 z-40 (lines 55-70) — same position as ArchivePlan FAB"
    - path: "web/src/pages/ArchivePlan.tsx"
      issue: "Gray FAB at same coordinates (lines 114-125) — completely covered by AppShell FAB"
  missing:
    - "Gate AppShell FAB with && !isArchivePlanRoute (same flag as CoachPanel suppression)"
  debug_session: ".planning/debug/appshell-coachpanel-archive-overlap.md"

- truth: "Dashboard has a combined Pace + BPM chart showing both metrics together per run/week, so the relationship between effort (BPM) and speed (pace) is visible"
  status: failed
  reason: "User reported: pace alone is misleading — low BPM naturally produces lower pace (easy runs). Want a chart combining pace and BPM so they can be read together. Keep the existing Pace Trend chart, add the new combined one."
  severity: minor
  test: 5
  root_cause: "groupRunsByWeek() in useDashboard.ts reads pace into paceValues[] but never reads run.avgHR. PaceDataPoint type has no avgBPM field. No ComposedChart exists in Dashboard.tsx. avgHR is fully stored on run documents (available in Run interface)."
  artifacts:
    - path: "web/src/hooks/useDashboard.ts"
      issue: "WeekBucket has no hrValues[]; groupRunsByWeek() ignores run.avgHR; PaceDataPoint has no avgBPM; no paceBpmData export"
    - path: "web/src/pages/Dashboard.tsx"
      issue: "No ComposedChart import or rendering; recharts imports missing ComposedChart"
  missing:
    - "Add hrValues: number[] to WeekBucket; accumulate run.avgHR in groupRunsByWeek()"
    - "Add PaceBpmDataPoint type { weekLabel, pace: number|null, avgBPM: number|null }"
    - "Derive and export paceBpmData from hook"
    - "Add ComposedChart to Dashboard.tsx with dual Y-axes (pace left, BPM right)"
  debug_session: ""
