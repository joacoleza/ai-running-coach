---
phase: quick
plan: 260407-khd
subsystem: web/ui
tags: [ios-safari, mobile, date-input, safe-area]
dependency_graph:
  requires: []
  provides: [ios-date-input-fix, ios-safe-area-fix]
  affects: [web/src/components/runs/RunEntryForm.tsx, web/src/components/runs/RunDetailModal.tsx, web/src/pages/Runs.tsx, web/src/index.css]
tech_stack:
  added: []
  patterns: [text-input-date-pattern, safe-area-body-background]
key_files:
  created: []
  modified:
    - web/src/components/runs/RunEntryForm.tsx
    - web/src/components/runs/RunDetailModal.tsx
    - web/src/pages/Runs.tsx
    - web/src/index.css
    - web/src/__tests__/Runs.test.tsx
decisions:
  - Use type=text with inputMode=numeric and pattern instead of type=date to ensure YYYY-MM-DD format on all platforms
  - Set body background-color to gray-900 (#111827) so iOS safe area zone matches sidebar color
  - #root gets gray-50 (#f9fafb) to match AppShell, keeping visible content area correct
metrics:
  duration: 8 min
  completed: 2026-04-07
  tasks_completed: 2
  files_modified: 5
---

# Quick Task 260407-khd: Fix Safari Date Inputs and Safe Area White Rectangle

## One-liner

Replaced `type="date"` inputs with `type="text"` + YYYY-MM-DD pattern/placeholder on all four date fields, and set `body` background to gray-900 so iOS safe area zone shows dark sidebar color instead of white.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Replace type=date inputs with type=text + YYYY-MM-DD pattern | aff678a | RunEntryForm.tsx, RunDetailModal.tsx, Runs.tsx |
| 2 | Fill bottom safe area with sidebar background color | c67ff97 | index.css |

## What Was Done

**Task 1 — Date input fix:**
All four `type="date"` inputs across the runs UI were replaced with `type="text"` inputs. Each now has:
- `inputMode="numeric"` — opens numeric keyboard on mobile
- `placeholder="YYYY-MM-DD"` — communicates expected format clearly
- `pattern="\d{4}-\d{2}-\d{2}"` — native validation hint
- Removed `max={todayLocal}` from RunEntryForm (not applicable to text inputs; existing `!date` guard handles empty input)

The value bindings and YYYY-MM-DD string state were already correct — only the `type` attribute changed.

**Task 2 — Safe area background:**
Added two new CSS rules to `index.css`:
- `body { background-color: #111827 }` — gray-900 matches the sidebar background; bleeds into the iOS safe area zone (below home indicator)
- `#root { background-color: #f9fafb }` — gray-50 matches AppShell; sits on top of body and covers the main content area

With `viewport-fit=cover` already set in `index.html`, this immediately takes effect on iOS Safari.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Runs.test.tsx to fix broken test selectors**
- **Found during:** Task 1 (post-task test run)
- **Issue:** Three test locations in `Runs.test.tsx` used `input[type="date"]` selector which no longer matched after the type change to `text`
- **Fix:** Updated all three selectors to `input[placeholder="YYYY-MM-DD"]` — unambiguous since only date inputs carry that placeholder
- **Files modified:** `web/src/__tests__/Runs.test.tsx`
- **Commit:** 6eb0c7f

## Known Stubs

None.

## Self-Check: PASSED

- web/src/components/runs/RunEntryForm.tsx — FOUND
- web/src/components/runs/RunDetailModal.tsx — FOUND
- web/src/pages/Runs.tsx — FOUND
- web/src/index.css — FOUND
- web/src/__tests__/Runs.test.tsx — FOUND
- Commit aff678a — FOUND
- Commit c67ff97 — FOUND
- Commit 6eb0c7f — FOUND
- Build: green (✓ built in 316ms)
- Tests: 349/349 passed
