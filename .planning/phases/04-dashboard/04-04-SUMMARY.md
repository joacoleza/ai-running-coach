---
phase: 04-dashboard
plan: 04
subsystem: ui
tags: [react, typescript, coaching, archive, readonly]

# Dependency graph
requires:
  - phase: 04-01
    provides: routing and ArchivePlan page scaffold
provides:
  - CoachPanel readonly prop — no input, no send, title 'Plan History', muted header
  - ArchivePlan with readonly CoachPanel, chat history fetch, and mobile FAB
affects: [archive, coaching, mobile-ux]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - readonly CoachPanel pattern — same component handles both interactive and readonly modes via props
    - chat history fetch in ArchivePlan on mount after plan loads

key-files:
  created: []
  modified:
    - web/src/components/coach/CoachPanel.tsx
    - web/src/pages/ArchivePlan.tsx
    - web/src/__tests__/CoachPanel.test.tsx
    - web/src/__tests__/ArchivePlan.test.tsx

key-decisions:
  - "CoachPanel: useChatContext() still called unconditionally (React hooks rule), but readonly mode overrides messages with initialMessages"
  - "ArchivePlan: chat history fetched using plan._id from the archive endpoint response (same as planId)"
  - "ArchivePlan: CoachPanel is always visible on desktop (right column), overlay on mobile — same layout as active coach"
  - "ArchivePlan: FAB starts closed (panelOpen=false) per D-19 — user taps to open"
  - "XML tag stripping applied to initialMessages in CoachPanel before rendering (same pattern as useChat mount)"

patterns-established:
  - "Readonly panel pattern: pass readonly={true} + initialMessages to CoachPanel to display history without interaction"
  - "ArchivePlan layout: flex row with scrollable left column and sticky CoachPanel right column on desktop"

requirements-completed: [DASH-04]

# Metrics
duration: 8min
completed: 2026-04-08
---

# Phase 04 Plan 04: Readonly CoachPanel + ArchivePlan Chat History Summary

**Readonly CoachPanel with 'Plan History' title, muted header, no input/send buttons, wired into ArchivePlan with GET /api/messages?planId=X chat history fetch and gray-500 mobile FAB**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-08T20:40:00Z
- **Completed:** 2026-04-08T20:48:16Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- CoachPanel supports readonly mode: hides textarea, Send button, Start Over, error banner, and streaming indicators; shows 'Plan History' title in text-gray-500; renders initialMessages (XML-stripped) instead of context messages
- ArchivePlan fetches chat history from GET /api/messages?planId=X after plan loads; renders CoachPanel with readonly=true in a flex desktop layout (scrollable plan left, coach right); gray-500 FAB with clock icon on mobile
- 390 web tests all passing (6 new CoachPanel readonly tests + 4 new ArchivePlan tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add readonly prop to CoachPanel** - `f77259f` (feat)
2. **Task 2: Wire ArchivePlan page with readonly CoachPanel** - `f85f2b4` (feat)
3. **Task 3: Tests for readonly CoachPanel + ArchivePlan chat history** - `2e0fb69` (test)

## Files Created/Modified
- `web/src/components/coach/CoachPanel.tsx` - Added readonly/initialMessages props, Plan History title, gray-500 header, hidden input/send in readonly mode, XML stripping for initialMessages
- `web/src/pages/ArchivePlan.tsx` - Added panelOpen/chatMessages/chatLoading state, fetchChatHistory, flex desktop layout, readonly CoachPanel, gray-500 mobile FAB with clock icon
- `web/src/__tests__/CoachPanel.test.tsx` - Added 6 readonly mode tests (title, no textarea, no send, messages rendered, gray-500 header, no Start Over)
- `web/src/__tests__/ArchivePlan.test.tsx` - Added CoachPanel mock, mockFetchWithMessages helper, 4 new tests (chat history fetch, readonly panel, FAB label, FAB color); updated existing tests to handle messages endpoint

## Decisions Made
- CoachPanel readonly mode overrides `contextMessages` with `initialMessages` — `useChatContext()` still called unconditionally per React hooks rules
- XML stripping (`<training_plan>` blocks and self-closing tags) applied to initialMessages before rendering — same pattern as useChat mount stripping
- ArchivePlan fetches chat history using `plan._id` from the archive endpoint response (the URL param `id` is the plan's MongoDB _id)
- panelOpen starts false (D-19: FAB not auto-opened on mobile)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Pre-existing build error: `useDashboard.test.ts` referenced `../hooks/useDashboard` before the hook existed (from parallel plan 04-02 TDD RED phase). The parallel agent had already created the hook by the time this plan ran, so the build passed without any intervention needed.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Readonly chat history on archived plan pages is complete (D-17 through D-23)
- ArchivePlan layout mirrors active plan layout (right panel desktop, mobile FAB) as specified in D-18
- No blockers for remaining Phase 04 plans
