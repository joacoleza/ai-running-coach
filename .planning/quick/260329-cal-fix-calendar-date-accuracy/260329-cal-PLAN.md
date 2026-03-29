# Quick Task: Fix Calendar Date Accuracy in System Prompt

**ID:** 260329-cal
**Branch:** feature/fix-calendar-date-accuracy
**Status:** In Progress

## Goal
Fix multiple date/day-of-week accuracy issues in the AI running coach system prompt calendar so Claude never computes dates independently.

## Root Causes Identified

1. **No past weeks in calendar** — When users give past dates (e.g. "Sunday 08/02/2026"), those dates are NOT in the calendar. Claude computes them and gets +1 day errors.
2. **Only 12 future weeks** — Plans longer than 12 weeks (marathon plans) will have missing dates in the calendar.
3. **Insufficient instructions** — Claude still computes dates despite the instruction; need stronger guidance and explicit DD/MM/YYYY parsing rule.

## Tasks

- [ ] Add 13 past weeks to calendar (covers 3+ months of training history)
- [ ] Extend upcoming weeks from 12 to 24 (covers 6-month marathon plans)
- [ ] Add explicit DD/MM/YYYY date format parsing instruction
- [ ] Update prompts.test.ts to match new calendar range
- [ ] Add tests for past week inclusion
- [ ] Run `cd api && npm test` + `cd web && npm test` + `cd web && npm run build`
