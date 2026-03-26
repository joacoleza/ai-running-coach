---
phase: 02-coach-chat
plan: 08
subsystem: api
tags: [azure-functions, mongodb, react, typescript]

# Dependency graph
requires:
  - phase: 02-coach-chat-03
    provides: Chat messages persisted to MongoDB messages collection
provides:
  - GET /api/messages?planId={id} endpoint returning messages sorted by timestamp ascending
  - useChat hook fetches message history on mount after plan loads
affects: [02-coach-chat, testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [Non-fatal fetch with try/catch for history restore, cancelled flag pattern for async cleanup in useEffect]

key-files:
  created:
    - api/src/functions/messages.ts
  modified:
    - api/src/index.ts
    - web/src/hooks/useChat.ts

key-decisions:
  - "GET /api/messages uses same requirePassword auth middleware pattern as all other endpoints"
  - "useChat history fetch is non-fatal — failure silently leaves messages empty (same as before)"

patterns-established:
  - "Message history endpoint: GET /api/messages?planId={id} -> messages sorted by timestamp asc"

requirements-completed: [COACH-05]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 02 Plan 08: Chat History Loading Summary

**GET /api/messages Azure Function + useChat init() fetch to restore MongoDB chat history after page refresh**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-23T21:34:29Z
- **Completed:** 2026-03-23T21:36:54Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added auth-protected GET /api/messages endpoint querying MongoDB messages collection by planId sorted by timestamp ascending
- Updated useChat init() to fetch message history after plan loads so History view is populated after page refresh
- All existing tests pass — no regressions introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GET /api/messages endpoint** - `b8b5098` (feat)
2. **Task 2: Wire useChat to fetch messages on mount** - `103dbcb` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `api/src/functions/messages.ts` - New Azure Function: GET /api/messages?planId={id} with auth, returns messages sorted by timestamp
- `api/src/index.ts` - Added `import './functions/messages.js'` registration
- `web/src/hooks/useChat.ts` - init() now fetches message history after plan load, sets messages state

## Decisions Made

- History fetch in useChat is wrapped in try/catch so any API error is silently swallowed — messages start empty as before (non-fatal)
- Timestamp normalized with ternary (`typeof === 'string' ? m.timestamp : new Date(m.timestamp).toISOString()`) to handle MongoDB Date serialization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- COACH-05 gap closed: chat history visible in History view after page refresh
- Phase 02 coach-chat all 8 plans complete — ready for phase transition and PR

---
*Phase: 02-coach-chat*
*Completed: 2026-03-23*

## Self-Check: PASSED

- FOUND: api/src/functions/messages.ts
- FOUND: web/src/hooks/useChat.ts
- FOUND: .planning/phases/02-coach-chat/02-08-SUMMARY.md
- FOUND commit: b8b5098 feat(02-08): add GET /api/messages endpoint
- FOUND commit: 103dbcb feat(02-08): wire useChat to fetch messages on mount
