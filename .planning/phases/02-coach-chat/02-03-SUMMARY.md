---
phase: 02-coach-chat
plan: 03
subsystem: api
tags: [typescript, mongodb, anthropic, azure-functions, sse, streaming, chat]

# Dependency graph
requires:
  - phase: 02-coach-chat
    plan: 01
    provides: "Shared types (ChatMessage, Plan), getDb() singleton, @anthropic-ai/sdk, HTTP streaming enabled"
provides:
  - POST /api/chat SSE streaming endpoint relaying Claude responses
  - buildContextMessages: rolling 20-message context window builder
  - maybeSummarize: summarization trigger at 25+ messages using claude-3-5-haiku
  - buildSystemPrompt: coaching system prompt with onboarding mode and summary support
  - User and assistant message persistence to MongoDB messages collection
affects: [02-04, 02-05, 02-06, web chat UI plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SSE streaming via ReadableStream with TextEncoder + Azure Functions body: readableStream pattern"
    - "Anthropic messages.stream() high-level streaming with .on('text') and .on('message') event handlers"
    - "Fire-and-forget summarization via .catch() to avoid blocking the SSE stream close"

key-files:
  created:
    - api/src/shared/context.ts
    - api/src/shared/prompts.ts
    - api/src/functions/chat.ts
  modified:
    - api/src/index.ts

key-decisions:
  - "maybeSummarize is fire-and-forget (not awaited) — runs after SSE stream closes to avoid blocking the response"
  - "onboardingStep incremented inside stream.on('message') handler after assistant message persisted"
  - "ANTHROPIC_API_KEY validated at handler start with 500 error to give clear diagnostic feedback"

patterns-established:
  - "SSE chunks formatted as: data: {\"text\":\"...\"}\n\n — done event as: data: {\"done\":true}\n\n"
  - "context.ts and prompts.ts are pure utility modules — no Azure Functions app registration"

requirements-completed: [COACH-02, COACH-05, COACH-06]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 2 Plan 03: Chat API Endpoint Summary

**SSE-streaming POST /api/chat endpoint with Claude claude-sonnet-4-20250514, MongoDB message persistence, rolling 20-message context window, and onboarding step tracking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T15:42:34Z
- **Completed:** 2026-03-23T15:44:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `api/src/shared/context.ts` with `buildContextMessages` (last 20 messages) and `maybeSummarize` (claude-3-5-haiku at 25+ messages)
- Created `api/src/shared/prompts.ts` with `buildSystemPrompt` handling both onboarding (6 questions, one at a time) and general coaching mode
- Created `api/src/functions/chat.ts` — POST /api/chat streams Claude responses via SSE, persists user and assistant messages, increments onboardingStep, and triggers summarization
- Added `import './functions/chat.js'` to `api/src/index.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create context builder and system prompt modules** - `dcda5e7` (feat)
2. **Task 2: Create POST /api/chat SSE streaming endpoint** - `6a1291f` (feat)

**Plan metadata:** (docs commit — this SUMMARY + state updates)

## Files Created/Modified
- `api/src/shared/context.ts` - buildContextMessages (20-msg window) + maybeSummarize (haiku at 25+ msgs)
- `api/src/shared/prompts.ts` - buildSystemPrompt with onboarding mode and summary support
- `api/src/functions/chat.ts` - POST /api/chat SSE endpoint with Claude streaming and message persistence
- `api/src/index.ts` - Added import for chat function

## Decisions Made
- `maybeSummarize` is fire-and-forget after stream closes — avoids delaying the SSE done event
- `onboardingStep` is incremented inside the `stream.on('message')` event (after full assistant response) rather than at request start
- `ANTHROPIC_API_KEY` checked at handler start to surface missing config with a clear 500 error rather than a cryptic Anthropic SDK error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**External services require manual configuration.**
- `ANTHROPIC_API_KEY` must be set in the Azure Function app settings (and `api/local.settings.json` locally)
- Source: console.anthropic.com -> API Keys -> Create Key
- Without this key, POST /api/chat returns `{ error: 'ANTHROPIC_API_KEY not configured' }` with status 500

## Next Phase Readiness
- POST /api/chat is fully functional and ready to be consumed by the web UI (Plan 02-04)
- Rolling context window and summarization are backend-only as required by D-14
- All three chat requirements (COACH-02 streaming, COACH-05 persistence, COACH-06 rolling window) are complete

---
*Phase: 02-coach-chat*
*Completed: 2026-03-23*
