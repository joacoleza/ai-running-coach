---
status: complete
phase: 04-dashboard
source: [04-06-SUMMARY.md, 04-07-SUMMARY.md]
started: 2026-04-10T00:00:00Z
updated: 2026-04-10T12:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Adherence card hidden on date-based filters
expected: On the Dashboard, switch to any filter other than "Current Plan" (e.g. "Last 4 weeks", "Last 8 weeks", "This year", "All time"). Only 3 stat cards should be visible: Total Distance, Total Runs, Total Time. The Adherence card should NOT appear for any date-based filter.
result: pass

### 2. Adherence card visible on Current Plan filter
expected: On the Dashboard, select the "Current Plan" filter. The Adherence card should appear as a 4th stat card. Clicking it navigates to /plan (Training Plan page). The card shows a percentage value.
result: pass

### 3. Pace vs Heart Rate chart (with HR data)
expected: If you have any runs logged with a heart rate (avgHR) value, a "Pace vs Heart Rate" chart should appear below the Weekly Volume and Pace Trend charts. It has two Y-axes: pace (min/km) on the left and Avg BPM on the right. If no runs have HR data, the chart is simply absent — that's fine.
result: pass

### 4. Archived plan — live chat suppressed on desktop
expected: Open Archive from the sidebar, click on an archived plan. On a wide (desktop) viewport, you should see ONLY the readonly "Plan History" panel on the right — NOT the live blue Coach Chat column. The Plan History panel title is in gray and shows old messages with no input field.
result: pass

### 5. Archived plan — gray FAB visible on mobile
expected: On the archived plan page, resize the browser to a narrow (mobile) viewport. A gray clock-icon FAB labeled "View plan history" should appear at the bottom-right. The regular blue coach chat FAB should NOT be visible — it should be fully suppressed on this route.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
