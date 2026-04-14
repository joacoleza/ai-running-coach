---
type: hotfix-log
phase: post-05
dated: 2026-04-14
prs: [60, 61, 62]
---

# Post-Phase 5 Hot Fixes

Three fixes merged after Phase 5 PR (#59) outside the formal phase structure.

## PR #60 — fix(dashboard): correct pace trend weekly aggregation

**Commit:** 6ca55af  
**Change:** Dashboard pace trend line now uses distance-weighted average (not simple mean) when aggregating multiple runs in a week.  
**Requirements:** Improvement to DASH-01/DASH-03 accuracy — not a new requirement.

## PR #61 — feat: keep-alive timer trigger to prevent cold starts

**Commit:** 22d2687  
**Change:** Added a timer-triggered Azure Function that pings the API on a schedule to keep it warm, preventing the first-request cold-start delay.  
**Requirements:** Infrastructure improvement, no requirement coverage.

## PR #62 — fix(archive): show linked run dates and open RunDetailModal from archived plan view

**Commit:** 442aedb  
**Change:** `ArchivePlan` now shows linked run dates on completed plan days (using `linkedRuns` from `GET /api/plans/archived/:id`). Clicking a run date dispatches `open-run-detail` event and opens `RunDetailModal`.  
**Requirements:** Enhancement to DASH-04 (archived plan view completeness).
