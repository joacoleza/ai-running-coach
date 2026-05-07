## Summary

**Phase 15: Cycling Support**
**Goal:** Users can log cycling sessions, view speed (km/h) instead of pace throughout the UI, and the coach generates cycling plan days and receives cycling session history in chat context.
**Status:** Verified

Cycling sessions are now first-class across the full stack. Speed replaces pace in all four UI components (RunEntryForm, RunRow, RunDetailModal, LinkRunModal). The coach receives cycling sessions as `| Cycled: DD/MM/YYYY, Xkm @ Y.Y km/h` in synthetic plan-state context.

## Changes

### Plan 01: Cycling Speed Display (UI)
Speed display for cycling sessions replacing pace across all four UI components.

**Key files modified:**
- `web/src/components/runs/RunEntryForm.tsx` — isCycle flag, computeSpeedDisplay helper, Speed/Pace conditional label
- `web/src/pages/Runs.tsx` — formatSpeed helper, three-way subtitle ternary (gym/cycle/run)
- `web/src/components/runs/RunDetailModal.tsx` — computeSpeed helper, editSpeed, Speed (km/h) label, discipline-aware coach feedback message
- `web/src/components/runs/LinkRunModal.tsx` — formatSpeed helper, discipline ternary in run list items

### Plan 02: Cycling Coach Context (API)
chat.ts emits cycling context with speed; formatSpeed helper added and tested.

**Key files modified:**
- `api/src/functions/chat.ts` — formatSpeed() helper, three-branch discipline context block (gym/cycle/run)
- `api/src/__tests__/chat.test.ts` — 5 formatSpeed unit tests + 4 cycling context line tests

## Requirements Addressed

| Requirement | Description | Status |
|-------------|-------------|--------|
| CYCLE-01 | User can log a cycling session with date, distance, duration, optional HR, and notes | Complete |
| CYCLE-02 | Cycling sessions display speed (km/h) instead of pace throughout the UI | Complete |
| CYCLE-03 | Coach can generate cycling plan days via plan XML tags | Complete |
| CYCLE-04 | Coach receives cycling session history in chat context | Complete |

## Verification

- [x] Automated verification: PASSED (7/7 observable truths)
- [x] TypeScript build: exits 0
- [x] API tests: 382/382 passed
- [x] Web tests: 549/549 passed
- [x] E2E tests: 94/94 passed (3 new cycling E2E tests added)
- [x] Nyquist validation: all 4 CYCLE requirements have automated coverage
- [ ] Human: Log a cycling session and confirm Speed field shows computed km/h value
- [ ] Human: Verify RunDetailModal shows Speed (km/h) label with live recomputation on edit
- [ ] Human: Confirm LinkRunModal shows speed for cycling runs in unlinked list

## Key Decisions

- Speed formula: (distance_km / totalMinutes) * 60, formatted to 1 decimal + km/h
- isCycle flag pattern mirrors existing isGym pattern for consistency across all components
- computeSpeed returns string or null (vs number for computePace) since formatted string is always the display value
- Speed computed at context-emission time in chat.ts, not stored in DB
- prompts.ts cycling plan day example was already present from Phase 13 — no changes needed

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
