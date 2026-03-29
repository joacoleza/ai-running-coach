# Quick Task 260329-lc2 Summary

**Task:** Fix TypeScript build errors in useChat.trainingPlan.test.ts and CLAUDE.md update for npm run build requirement
**Date:** 2026-03-29
**Status:** Complete

## What was done

1. Fixed TS2769 errors in `web/src/__tests__/useChat.trainingPlan.test.ts`:
   - Changed `([url]: [string])` to `([url]: string[])` in 3 `find`/`filter` callbacks (lines 77, 101×2, 136)
   - Root cause: TypeScript cannot assign `any[]` to the tuple type `[string]` since a tuple requires exactly 1 element

2. Updated `CLAUDE.md` Testing & Documentation section:
   - Added bullet documenting that `npm run build` in `web/` is mandatory before committing
   - Explained why: SWA Oryx uploads entire `web/` folder (including `node_modules`) when TS build fails, exceeding 262MB limit

## Verification

- `tsc -b --noEmit` in `web/` exits clean with no errors
- Commit: 8a7a1bd
