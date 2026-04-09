---
status: complete
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
reported: "Adherence shows a random/meaningless value on date-based filters (it only counts runs on the current active plan, ignoring previous plans). Should be removed from Dashboard. Move it to the Training Plan view near the target date, and also show it on archived plan detail pages."
severity: major

### 4. Adherence card navigates to Training Plan
expected: Click the Adherence stat card. The app navigates to /plan (Training Plan page). The card should visually indicate it's clickable (cursor changes to pointer on hover).
result: pass
note: Card works but being removed from Dashboard per test 3 issue — Adherence moving to Training Plan view.

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

- truth: "Adherence is a meaningful, plan-scoped metric shown on the Training Plan view (near target date) and on archived plan detail pages — not a Dashboard stat card"
  status: failed
  reason: "User reported: Adherence shows a random/meaningless value on date-based filters (only counts runs on the current active plan, ignoring previous plans). Remove from Dashboard. Move to Training Plan view near target date, and show on archived plan detail pages."
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Archived plan page shows only the readonly Plan History panel — the live coach chat (AppShell CoachPanel) must be hidden when on the ArchivePlan route"
  status: failed
  reason: "User reported: The Plan History panel shows correctly, but the active Coach chat is also visible. On the archived plan page only the readonly Plan History panel should be shown — not the live coach chat."
  severity: major
  test: 8
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "On mobile, the archived plan page shows a gray 'View plan history' FAB (not the regular blue coach FAB). Tapping it opens the readonly Plan History overlay. The AppShell coach FAB must be suppressed on the /archive/:id route."
  status: failed
  reason: "User reported: The regular blue coach chat FAB is showing instead of the gray 'View plan history' button. The 'View plan history' FAB is not visible at all. The AppShell coach FAB is overriding/covering the archive-specific one."
  severity: major
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Dashboard has a combined Pace + BPM chart showing both metrics together per run/week, so the relationship between effort (BPM) and speed (pace) is visible"
  status: failed
  reason: "User reported: pace alone is misleading — low BPM naturally produces lower pace (easy runs). Want a chart combining pace and BPM so they can be read together. Keep the existing Pace Trend chart, add the new combined one."
  severity: minor
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
