---
phase: 17-app-rename
plan: 02
subsystem: testing
tags: [mongodb, package-json, e2e, vitest, playwright, rename]

# Dependency graph
requires:
  - phase: 17-app-rename
    provides: Phase 17 plan 01 - HTML title, README, LoginPage heading rename

provides:
  - All three package.json name fields renamed to ai-training-coach
  - MongoDB DB fallback name updated to ai-training-coach in db.ts
  - E2E infrastructure (playwright.config.ts, global-setup.ts, auth.spec.ts) updated to ai-training-coach-e2e
  - All 15 API integration test files updated to use ai-training-coach DB name

affects: [17-app-rename, e2e-tests, api-tests, ci]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - package.json
    - api/package.json
    - web/package.json
    - api/src/shared/prompts.ts
    - api/src/shared/db.ts
    - playwright.config.ts
    - e2e/global-setup.ts
    - e2e/auth.spec.ts
    - api/src/__tests__/chat.integration.test.ts
    - api/src/__tests__/exerciseWeights.test.ts
    - api/src/__tests__/messages.isolation.test.ts
    - api/src/__tests__/messages.test.ts
    - api/src/__tests__/plan.isolation.test.ts
    - api/src/__tests__/plan.test.ts
    - api/src/__tests__/planArchive.isolation.test.ts
    - api/src/__tests__/planArchive.test.ts
    - api/src/__tests__/planDays.isolation.test.ts
    - api/src/__tests__/planDays.test.ts
    - api/src/__tests__/planPhases.isolation.test.ts
    - api/src/__tests__/planPhases.test.ts
    - api/src/__tests__/runs.isolation.test.ts
    - api/src/__tests__/runs.test.ts
    - api/src/__tests__/usageCapture.test.ts
    - package-lock.json
    - api/package-lock.json
    - web/package-lock.json

key-decisions:
  - "Bulk replacement handled two patterns: mongoClient.db('running-coach') and multiline .db('running-coach') - both required updating"

patterns-established:
  - "DB name fallback is always 'ai-training-coach'; E2E isolation uses 'ai-training-coach-e2e'"

requirements-completed: [RENAME-01]

# Metrics
duration: 20min
completed: 2026-05-09
---

# Phase 17 Plan 02: Package names, DB fallbacks, and test file rename Summary

**24 files updated: package.json names renamed to ai-training-coach, MongoDB DB fallback and all E2E/test infrastructure updated, all 396 API tests passing**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-09T21:15:00Z
- **Completed:** 2026-05-09T21:35:00Z
- **Tasks:** 3
- **Files modified:** 27 (24 source + 3 lock files)

## Accomplishments
- Renamed package.json name fields in all three packages (root, api, web) to ai-training-coach
- Updated prompts.ts JSDoc comment from 'AI running coach' to 'AI training coach'
- Updated MongoDB DB fallback in db.ts and all E2E config/test files from running-coach to ai-training-coach
- Bulk-replaced all 225 occurrences of `mongoClient.db('running-coach')` across 15 API integration test files
- All 396 API tests pass with no regressions after the rename

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename package.json name fields, update prompts.ts JSDoc, and regenerate lock files** - `d1173b7` (chore)
2. **Task 2: Update MongoDB DB name fallbacks in db.ts, playwright.config.ts, global-setup.ts, and auth.spec.ts** - `479a9a3` (chore)
3. **Task 3: Bulk-replace 'running-coach' DB references in all 15 API integration test files** - `3e51475` (chore)

## Files Created/Modified
- `package.json` - name: ai-running-coach -> ai-training-coach
- `api/package.json` - name: ai-running-coach-api -> ai-training-coach-api
- `web/package.json` - name: ai-running-coach-web -> ai-training-coach-web
- `api/src/shared/prompts.ts` - JSDoc: 'AI running coach' -> 'AI training coach'
- `api/src/shared/db.ts` - fallback DB name: 'running-coach' -> 'ai-training-coach'
- `playwright.config.ts` - E2E DB connection string and comments updated to ai-training-coach-e2e
- `e2e/global-setup.ts` - URI default and dbName fallback updated; comments updated
- `e2e/auth.spec.ts` - heading assertion 'AI Running Coach' -> 'AI Training Coach'; DB fallbacks updated
- `api/src/__tests__/*.ts` (15 files) - all `mongoClient.db('running-coach')` -> `mongoClient.db('ai-training-coach')`
- `package-lock.json`, `api/package-lock.json`, `web/package-lock.json` - regenerated after name changes

## Decisions Made
- Bulk replacement needed to handle two distinct patterns: the single-line `mongoClient.db('running-coach')` and multi-line `.db('running-coach')` on a continuation line. PowerShell `-replace` with the shorter pattern caught all instances.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The initial bulk replacement only matched the single-line `mongoClient.db('running-coach')` pattern. Three files (chat.integration.test.ts, plan.test.ts, usageCapture.test.ts) had the pattern split across lines as `.db('running-coach')` on a new line. A second pass with the shorter pattern resolved all remaining occurrences.

## User Setup Required
None - no external service configuration required. Production MongoDB connection strings are not affected (they use explicit connection strings that override the fallback).

## Next Phase Readiness
- Package metadata, dev/E2E infrastructure, and all test files now consistently use ai-training-coach
- Phase 17 plan 03 (remaining rename targets: HTML title, Azure config, any remaining references) can proceed

---
*Phase: 17-app-rename*
*Completed: 2026-05-09*
