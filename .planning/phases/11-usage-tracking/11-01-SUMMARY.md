---
phase: 11-usage-tracking
plan: 01
subsystem: api
tags: [mongodb, anthropic, usage-tracking, pricing, tokens]

# Dependency graph
requires:
  - phase: 10-login-rate-limiting
    provides: login_attempts collection patterns for non-fatal MongoDB collection usage
provides:
  - pricing.ts with MODEL_PRICING map and computeCost() function
  - UsageEvent interface in types.ts
  - usage_events indexes registered at startup in db.ts
  - usage insert in chat.ts after every successful Claude API call
affects: [11-02-PLAN, 11-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-fatal usage capture: try/catch around usage_events insertOne so failures never block SSE response"
    - "Raw token storage: store raw token counts, compute cost at query time from MODEL_PRICING"
    - "fm = await stream.finalMessage() to capture usage from Anthropic Message object"

key-files:
  created:
    - api/src/shared/pricing.ts
    - api/src/__tests__/pricing.test.ts
    - api/src/__tests__/usageCapture.test.ts
  modified:
    - api/src/shared/types.ts
    - api/src/shared/db.ts
    - api/src/functions/chat.ts

key-decisions:
  - "Tokens stored raw (not cost) — cost computed at query time from MODEL_PRICING; allows repricing without re-running aggregations"
  - "Model hardcoded as 'claude-sonnet-4-20250514' matching stream() call on line 205; both must change together if model changes"
  - "Usage capture uses let fm declaration before try block to allow usage after the try/catch scope"

patterns-established:
  - "Non-fatal DB writes: try/catch with empty catch block around usage_events insertOne"
  - "Cache token extraction: (usage as any).cache_creation_input_tokens ?? 0 handles absent fields from older API versions"

requirements-completed: [USAGE-01, USAGE-02, USAGE-03, USAGE-04]

# Metrics
duration: 7min
completed: 2026-04-26
---

# Phase 11 Plan 01: Usage Capture Foundation Summary

**MongoDB usage_events collection capturing raw Anthropic token counts (input/output/cacheWrite/cacheRead) after every successful Claude API call, with pricing utility for cost computation and compound index for per-user queries**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-26T21:06:48Z
- **Completed:** 2026-04-26T21:13:46Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `api/src/shared/pricing.ts` with MODEL_PRICING map and computeCost() for claude-sonnet-4-20250514 (3.00/15.00/3.75/0.30 per million tokens)
- Added `UsageEvent` interface to types.ts with 8 fields (userId, timestamp, model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
- Registered two indexes on usage_events in db.ts: compound `{ userId, timestamp }` for per-user queries and `{ timestamp }` for admin aggregation
- Modified chat.ts to capture `fm = await stream.finalMessage()` return value and insert usage event non-fatally (inside try/catch) before done SSE event

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pricing.ts and add UsageEvent to types.ts** - `abcc731` (feat)
2. **Task 2: Register usage_events indexes and capture usage in chat.ts** - `8921e59` (feat)

**Plan metadata:** (docs commit follows)

_Note: Task 1 used TDD flow (RED: pricing.test.ts fails → GREEN: pricing.ts created → tests pass)_

## Files Created/Modified
- `api/src/shared/pricing.ts` - MODEL_PRICING rate map and computeCost() function
- `api/src/shared/types.ts` - Added UsageEvent interface (8 fields)
- `api/src/shared/db.ts` - Two new createIndex calls for usage_events collection
- `api/src/functions/chat.ts` - UsageEvent import, fm capture, non-fatal insertOne before done SSE
- `api/src/__tests__/pricing.test.ts` - 8 unit tests for MODEL_PRICING and computeCost()
- `api/src/__tests__/usageCapture.test.ts` - 3 integration tests verifying usage insert and non-fatal behavior

## Decisions Made
- Tokens stored raw (inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens) — cost computed at query time from MODEL_PRICING; allows repricing historical data without re-running writes
- Model hardcoded as string `'claude-sonnet-4-20250514'` matching the stream() call — both must change together if model changes; comment in code notes this
- Used `let fm` before the try block (vs inline capture) so `fm` is accessible after the catch in the usage insert block

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The worktree had no node_modules; ran `npm install` in the worktree's `api/` directory before tests could run (standard worktree setup, not a bug)
- Initial `usageCapture.test.ts` used `require()` in beforeEach which doesn't work in ESM vitest context; fixed by importing `requireAuth` at module level (same pattern as chat.integration.test.ts)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- usage_events collection is being written on every chat call; ready for aggregation queries in 11-02 (usage API) and 11-03 (admin UI)
- MODEL_PRICING and computeCost() available for cost computation in API response
- No blockers

---
*Phase: 11-usage-tracking*
*Completed: 2026-04-26*
