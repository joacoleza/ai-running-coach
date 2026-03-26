---
phase: 02-coach-chat
verified: 2026-03-23T21:40:00Z
status: human_needed
score: 11/11 must-haves verified (static); additional UAT items pending from post-verification improvements
re_verification: true
re_verification_meta:
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "Chat history persists across sessions (COACH-05): GET /api/messages endpoint added; useChat now loads messages from MongoDB on mount"
  post_verification_additions:
    - "Start Over resets to welcome screen (02-09)"
    - "Import via file upload instead of textarea (02-09)"
    - "Claude error messages surfaced to user + logged to Application Insights (02-09)"
    - "Mobile-responsive coach panel with FAB (02-10)"
    - "Anthropic mocked in all test layers — no real API calls in tests (02-10)"
    - "System prompt hardened: running-only role boundary, persona (02-11)"
    - "App command protocol: navigate + mark session complete via chat (02-11)"
human_verification:
  - test: "Complete a full onboarding conversation"
    expected: "Coach asks questions one at a time, onboardingStep increments, after step 6 offers to generate the plan"
    why_human: "Requires live Anthropic API key and real Claude interaction"
  - test: "Receive a training plan from the coach (<training_plan> in response), then navigate to /plan"
    expected: "After plan is generated, main content navigates to the Training Plan calendar view automatically"
    why_human: "SSE stream + navigation behavior requires browser integration test"
  - test: "View the Training Plan page with a generated plan"
    expected: "Weekly calendar shows color-coded session events; clicking a session opens the SessionModal"
    why_human: "react-big-calendar rendering requires a browser"
  - test: "Mark a session complete in the SessionModal"
    expected: "PATCH /api/sessions/:id is called, session turns green on calendar after refresh"
    why_human: "Requires live MongoDB and browser interaction"
  - test: "Refresh the page after chatting — History view shows past messages"
    expected: "Clock icon shows all previously sent messages loaded from MongoDB"
    why_human: "Requires browser, live MongoDB, and a prior chat session"
  - test: "Click Start Over from paste (import) mode"
    expected: "Returns to welcome screen showing both Start New Plan and Import from Existing Plan buttons"
    why_human: "Regression check for 02-09 fix"
  - test: "Upload a .txt file via Import from Existing Plan"
    expected: "File picker opens, filename shown after selection, Send to Coach button appears, file content sent to coach"
    why_human: "FileReader API requires a browser"
  - test: "On mobile viewport: FAB visible, tap opens full-screen coach panel, X closes it"
    expected: "Main content visible when coach closed; coach takes full screen when open"
    why_human: "Responsive layout requires browser at mobile viewport"
  - test: "Ask coach an off-topic question (e.g. 'write me a poem')"
    expected: "Coach declines and redirects to running topics"
    why_human: "Requires live Claude API"
  - test: "Say 'show me my plan' in chat after a plan is generated"
    expected: "Coach responds and navigates app to /plan"
    why_human: "Requires live Claude API and app command parsing"
  - test: "Say 'I completed my run today' referencing a session"
    expected: "Coach marks the session complete; calendar updates to green"
    why_human: "Requires live Claude API, session IDs in system prompt, and browser"
---

# Phase 2: Coach Chat Verification Report

**Phase Goal:** Owner can complete the coaching onboarding, get a training plan generated, and view it on a calendar.
**Verified:** 2026-03-23T21:40:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (02-08: COACH-05 chat history fix)

## Re-verification Summary

Previous status: `gaps_found` (10/11, COACH-05 partial).

Gap closure plan 02-08 added two artifacts:

1. `api/src/functions/messages.ts` — new `GET /api/messages?planId={id}` Azure Function
2. `api/src/index.ts` — registered `import './functions/messages.js'` (line 8)
3. `web/src/hooks/useChat.ts` — `init()` now fetches message history after plan loads

Both commits verified in git history: `b8b5098` (endpoint) and `103dbcb` (hook wiring).

No regressions found in previously verified artifacts.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Shared TypeScript types define ChatMessage, Plan, PlanSession interfaces | VERIFIED | `api/src/shared/types.ts` exports all four interfaces with correct fields |
| 2  | Azure Functions HTTP streaming enabled via app.setup() before imports | VERIFIED | `api/src/index.ts` line 3: `app.setup({ enableHttpStream: true })` before all function imports |
| 3  | POST /api/chat accepts messages and returns SSE-streamed Claude response | VERIFIED | `api/src/functions/chat.ts` uses `anthropic.messages.stream()`, emits `text/event-stream`, registered in index.ts |
| 4  | Each message is persisted to MongoDB messages collection | VERIFIED | `chat.ts` calls `insertOne(userMsg)` before streaming and `insertOne(assistantMsg)` in stream callback |
| 5  | Only last 20 messages sent to Claude; summary prepended if it exists | VERIFIED | `api/src/shared/context.ts`: `.limit(20)` in `buildContextMessages`; `maybeSummarize` triggers at 25; summary appended in `buildSystemPrompt` |
| 6  | App layout is three-column: sidebar / main / coach panel on every page | VERIFIED | `AppShell.tsx` renders `<Sidebar />`, `<main>{children}</main>`, `<CoachPanel />`; no /coach route |
| 7  | POST /api/plan creates onboarding plan; GET returns active/onboarding plan; POST /generate extracts sessions from XML | VERIFIED | `plan.ts` has all three handlers; filters by `$in: ['onboarding','active']`; regex extracts from `<training_plan>` tags |
| 8  | PATCH /api/sessions/:id updates session fields via positional operator | VERIFIED | `sessions.ts` uses `sessions.$.${key}` positional update; 404 on not found |
| 9  | User can type a message and see a streaming response; onboarding flow; plan generation trigger | VERIFIED | `useChat.ts` fetches `/api/chat`, reads SSE with `getReader()`/`TextDecoder`, detects `<training_plan>`, calls `/api/plan/generate`, navigates to `/plan` |
| 10 | Training Plan page shows weekly calendar with color-coded sessions, session modal with inline editing and mark complete | VERIFIED | `PlanCalendar.tsx` uses react-big-calendar with `defaultView="week"`, `getSessionColor()`; `SessionModal.tsx` has all fields and mark complete toggle |
| 11 | Chat history persists across sessions (user can review past coaching conversations after page refresh) | VERIFIED | `GET /api/messages?planId={id}` endpoint in `messages.ts` queries `messages` collection sorted by `timestamp: 1`; `useChat.ts` init() fetches this endpoint after plan loads and calls `setMessages()`; registered in `api/src/index.ts` line 8 |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/shared/types.ts` | ChatMessage, Plan, PlanSession, PlanGoal interfaces | VERIFIED | All four interfaces present |
| `api/src/shared/db.ts` | Shared getDb() singleton for MongoDB | VERIFIED | MongoClient singleton, `_resetDbForTest` exported |
| `api/src/index.ts` | `enableHttpStream: true` + all function imports including messages.js | VERIFIED | Line 3 setup; line 8 `import './functions/messages.js'` |
| `api/src/shared/context.ts` | `buildContextMessages`, `maybeSummarize` | VERIFIED | Both exported; `.limit(20)`; 25-message threshold |
| `api/src/shared/prompts.ts` | `buildSystemPrompt` with onboarding + summary support | VERIFIED | 6 onboarding questions, `<training_plan>` instruction |
| `api/src/functions/chat.ts` | POST /api/chat SSE streaming endpoint | VERIFIED | `anthropic.messages.stream()`, SSE headers, persistence |
| `api/src/functions/messages.ts` | GET /api/messages?planId={id} endpoint | VERIFIED | Auth-protected; queries `messages` collection with `{ planId }` filter; sorted by `timestamp: 1`; returns `{ messages: results }` |
| `api/src/functions/plan.ts` | getPlan, createPlan, generatePlan endpoints | VERIFIED | All three registered; XML extraction regex |
| `api/src/functions/sessions.ts` | PATCH /api/sessions/{sessionId} | VERIFIED | Positional update, 404 handling |
| `web/src/components/layout/AppShell.tsx` | Three-column layout with CoachPanel | VERIFIED | Imports and renders `<CoachPanel />` |
| `web/src/components/coach/CoachPanel.tsx` | Full chat panel with all states | VERIFIED | No plan / onboarding / active states; history toggle |
| `web/src/components/coach/ChatMessage.tsx` | User/assistant message bubbles | VERIFIED | Distinct styles for user and assistant |
| `web/src/components/coach/ChatHistory.tsx` | History view with Back to Chat | VERIFIED | Renders messages list |
| `web/src/hooks/useChat.ts` | SSE stream, plan operations, /api/plan/generate trigger, message history load on mount | VERIFIED | All wiring present; init() fetches `/api/messages?planId=` on mount when plan exists |
| `web/src/hooks/usePlan.ts` | Plan fetch and session update | VERIFIED | GET /api/plan on mount; PATCH /api/sessions/ |
| `web/src/components/plan/PlanCalendar.tsx` | react-big-calendar weekly view | VERIFIED | `dateFnsLocalizer`, `defaultView="week"`, `getSessionColor` |
| `web/src/components/plan/SessionModal.tsx` | Session detail modal with inline editing | VERIFIED | All fields, Mark Complete/Incomplete, calls `onSave` |
| `web/src/pages/TrainingPlan.tsx` | Training Plan page with goal + calendar | VERIFIED | Goal display, PlanCalendar, SessionModal wired |
| `api/src/__tests__/chat.test.ts` | Test stubs for COACH-06 | VERIFIED | 6 todo tests in 2 describe blocks |
| `api/src/__tests__/chat.integration.test.ts` | Test stubs for COACH-01 | VERIFIED | 4 todo tests |
| `api/src/__tests__/plan.test.ts` | Test stubs for PLAN-01/02/CRUD | VERIFIED | 11 todo tests |
| `api/src/__tests__/sessions.test.ts` | Test stubs for PLAN-04 | VERIFIED | 5 todo tests |
| `api/src/__tests__/onboarding.test.ts` | Test stubs for onboarding resume | VERIFIED | 4 todo tests |
| `web/src/__tests__/PlanCalendar.test.tsx` | Test stubs for PLAN-03 | VERIFIED | 5 todo tests |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/src/shared/db.ts` | mongodb | `new MongoClient` singleton | WIRED | `client = new MongoClient(connectionString)` |
| `api/src/functions/chat.ts` | `@anthropic-ai/sdk` | `anthropic.messages.stream()` | WIRED | `anthropic.messages.stream({...})` |
| `api/src/functions/chat.ts` | `api/src/shared/context.ts` | import buildContextMessages | WIRED | Import + call in handler |
| `api/src/functions/chat.ts` | mongodb messages collection | `getDb() -> messages.insertOne` | WIRED | `insertOne` for user and assistant messages |
| `api/src/functions/messages.ts` | mongodb messages collection | `getDb() -> messages.find({ planId })` | WIRED | `db.collection<ChatMessage>('messages').find({ planId }).sort({ timestamp: 1 }).toArray()` |
| `api/src/functions/plan.ts` | mongodb plans collection | `getDb() -> plans collection` | WIRED | Multiple `db.collection<Plan>('plans')` calls |
| `api/src/functions/sessions.ts` | mongodb plans collection | `sessions.$.field` positional update | WIRED | `db.collection('plans').updateOne(...)` with positional |
| `web/src/components/layout/AppShell.tsx` | `web/src/components/coach/CoachPanel.tsx` | import and render | WIRED | Import + `<CoachPanel />` |
| `web/src/hooks/useChat.ts` | `/api/chat` | fetch POST with SSE reader | WIRED | `fetch('/api/chat', ...)`, `getReader()` |
| `web/src/hooks/useChat.ts` | `/api/messages` | fetch GET in init() after plan loads | WIRED | Line 110: `` fetch(`/api/messages?planId=${existingPlan._id}`, ...) `` inside init() after `setPlan()` |
| `web/src/hooks/useChat.ts` | `/api/plan` | fetch GET/POST | WIRED | fetchPlan() and startPlan() |
| `web/src/hooks/useChat.ts` | `/api/plan/generate` | fetch POST after `<training_plan>` detected | WIRED | `fetch('/api/plan/generate', ...)` after `includes('<training_plan>')` |
| `web/src/components/coach/CoachPanel.tsx` | `web/src/hooks/useChat.ts` | `useChat()` hook call | WIRED | `const { ... } = useChat()` |
| `web/src/hooks/usePlan.ts` | `/api/plan` | fetch GET | WIRED | `fetch('/api/plan', ...)` |
| `web/src/hooks/usePlan.ts` | `/api/sessions` | fetch PATCH for session updates | WIRED | `` fetch(`/api/sessions/${sessionId}`, ...) `` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| GOAL-01 | Plan 04, 05, 06 | User can set a running goal (event type, target date) | SATISFIED | `generatePlan` stores goal; TrainingPlan displays `plan.goal.eventType` and `plan.goal.targetDate` |
| GOAL-02 | Plan 04, 05, 06 | User can set profile preferences (weekly mileage, available days, units) | SATISFIED | PlanGoal interface includes `weeklyMileage`, `availableDays`, `units`; stored and displayed |
| GOAL-03 | Plan 05 | Coach conducts onboarding chat session | SATISFIED | `buildSystemPrompt` generates 6 onboarding questions; onboardingStep incremented in chat.ts |
| PLAN-01 | Plan 04 | Coach generates structured training plan from goal and onboarding context | SATISFIED | `generatePlan` in `plan.ts` extracts JSON from `<training_plan>` XML tags; saves sessions |
| PLAN-02 | Plan 01, 04 | Training plan stored with sessions: week, day, type, distance, pace target, HR zone | SATISFIED | `PlanSession` interface has `date`, `distance`, `duration`, `avgPace`, `avgBpm`, `notes`, `completed` |
| PLAN-03 | Plan 06 | User can view training plan as weekly calendar | SATISFIED | `PlanCalendar.tsx` uses react-big-calendar with `defaultView="week"`, color-coded by session type |
| PLAN-04 | Plan 04, 06 | Plan sessions can be marked complete | SATISFIED | `PATCH /api/sessions/:id` with `completed: true`; SessionModal has "Mark Complete/Incomplete" button |
| COACH-01 | Plan 02, 05 | Chat interface for back-and-forth conversation | SATISFIED | CoachPanel renders message bubbles via ChatMessage; user input + send button; streaming response display |
| COACH-02 | Plan 03, 05 | Coach responses stream to UI in real-time | SATISFIED | SSE via `anthropic.messages.stream()`; frontend reads with `getReader()` + TextDecoder |
| COACH-05 | Plan 03, 05, 08 | Chat history persists across sessions | SATISFIED | `GET /api/messages?planId={id}` returns MongoDB messages sorted by timestamp; useChat init() fetches and restores them; both commits verified: b8b5098, 103dbcb |
| COACH-06 | Plan 03 | Rolling 20-message window + condensed memory summary | SATISFIED | `buildContextMessages` uses `.limit(20)`, `maybeSummarize` triggers at 25 messages |

All 11 requirement IDs declared across plans for this phase are accounted for. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `web/src/__tests__/App.auth.test.tsx` | test run output | `act()` warning from CoachPanel async state update | Info | Tests pass; warning is a test hygiene issue, not a production concern |

No production stubs found. No regressions introduced by plan 02-08.

---

### Human Verification Required

#### 1. Full Onboarding Flow

**Test:** With a valid `ANTHROPIC_API_KEY` set, open the app, click "Start New Plan" in the coach panel, and complete the 6-question onboarding.
**Expected:** Coach asks one question at a time; after question 6, it summarizes and offers to generate the plan; `onboardingStep` increments with each exchange.
**Why human:** Requires live Claude API and real HTTP streaming to verify the onboarding question progression.

#### 2. Plan Generation and Calendar Navigation

**Test:** After the onboarding conversation, trigger the coach to generate a training plan. Confirm the coach response contains `<training_plan>` JSON.
**Expected:** `POST /api/plan/generate` is called automatically; main content navigates to `/plan`; the calendar shows color-coded weekly sessions.
**Why human:** Requires live Claude API response with valid JSON inside XML tags and browser navigation to verify.

#### 3. Session Modal Inline Editing

**Test:** On the Training Plan page with sessions, click any calendar event.
**Expected:** SessionModal opens with all session fields editable (date, distance, duration, pace, BPM, notes). Saving calls `PATCH /api/sessions/:id` and the calendar reflects the update.
**Why human:** Requires real MongoDB and browser interaction to verify PATCH round-trip and calendar refresh.

#### 4. Mark Session Complete

**Test:** In the SessionModal, click "Mark Complete" on a session.
**Expected:** Session turns green on the calendar. Clicking again shows "Mark Incomplete" and reverts to the original color.
**Why human:** Requires browser + real data to verify `completed: true` is stored and reflected in `getSessionColor`.

#### 5. Chat History After Page Refresh (Gap Closure Verification)

**Test:** Send several chat messages, then refresh the page. Click the clock icon in the coach panel to open History view.
**Expected:** History view shows all previously sent messages loaded from MongoDB — the view is not empty after refresh.
**Why human:** Requires browser, live MongoDB, and a prior chat session to verify the full GET /api/messages round-trip through useChat into ChatHistory rendering.

---

### Gaps Summary

All 11/11 must-haves are verified. The single gap from the initial verification (COACH-05: no GET /api/messages endpoint, history not loaded on mount) has been closed by plan 02-08:

- `api/src/functions/messages.ts` — auth-protected GET endpoint that queries the `messages` collection by `planId`, sorted by `timestamp` ascending
- `api/src/index.ts` — endpoint registered at line 8
- `web/src/hooks/useChat.ts` — `init()` now fetches `/api/messages?planId=${existingPlan._id}` after the plan loads and hydrates the messages state

The planId field stored by `chat.ts` on each message matches exactly what the new `messages.ts` endpoint queries, so the full read/write round-trip is consistent.

No gaps remain. Phase 02 is ready for PR.

---

_Verified: 2026-03-23T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — gap closure 02-08_
