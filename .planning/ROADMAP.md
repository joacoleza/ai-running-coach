# Roadmap: AI Running Coach

**Milestone:** v1 — Personal AI Running Coach
**Goal:** A working coaching loop: set goal → get a plan → log runs → receive feedback → track progress

---

## Phase 1 — Infrastructure & Auth

**Goal:** Working Azure deployment with owner-only access. Nothing runs in production until this is done.

**Requirements covered:** AUTH-01, AUTH-02, AUTH-03

**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Project scaffold (Vite+React+Tailwind, API, shared types, Docker Compose, test infra)
- [x] 01-02-PLAN.md — SWA auth config (owner-only lockdown) + React sidebar shell with placeholder pages
- [x] 01-03-PLAN.md — API health function, GitHub Actions CI/CD, post-deploy scripts

**Deliverables:**
- Azure resource group with Static Web Apps, Functions (Windows Consumption), Cosmos DB free tier, Blob Storage
- Local dev environment: Vite + Functions Core Tools + Azurite (Cosmos DB Emulator) via `npm run dev`
- `staticwebapp.config.json` with all routes locked to `owner` role
- GitHub OAuth configured, owner role assigned post-deploy via `az staticwebapp users update`
- CI/CD via GitHub Actions (SWA built-in workflow)
- React + TypeScript + Vite scaffold deployed and accessible only to owner
- Basic layout shell (nav, routing) — no features yet

**UAT:**
- Visiting the app URL redirects to GitHub login when not authenticated
- After GitHub login with owner account, app loads
- After GitHub login with a different account, access is denied (403)
- `npm run dev:web` runs locally with hot reload (auth tested against deployed Azure)

---

## Phase 1.1 — Replace Auth with Simple Password (INSERTED)

**Goal:** Replace Azure SWA GitHub OAuth + owner role with a simple pre-shared secret. Password prompt on frontend, stored in localStorage, sent as header on every API call. Clean logout clears only local state.

**Requirements:** AUTH1.1-API-MIDDLEWARE, AUTH1.1-LOCKOUT, AUTH1.1-HEALTH-BLOCKED, AUTH1.1-PASSWORD-PAGE, AUTH1.1-AUTH-GATE, AUTH1.1-LOGOUT, AUTH1.1-SWA-CLEANUP

**Plans:** 2 plans

Plans:
- [x] 01.1-01-PLAN.md — API auth middleware with MongoDB lockout + health endpoint update
- [x] 01.1-02-PLAN.md — Frontend password page, auth gate, logout, SWA config cleanup

**Deliverables:**
- Remove `staticwebapp.config.json` owner role lockdown and GitHub OAuth config
- `APP_PASSWORD` env var checked by API middleware on every protected request
- Frontend password prompt page (no GitHub login redirect)
- Password stored in localStorage; sent as custom header on every API call
- Logout clears localStorage only — no redirects to GitHub or Azure
- All existing routes protected behind password check

**UAT:**
- Visiting the app URL shows a password prompt (not GitHub OAuth)
- Correct password → app loads
- Wrong password → rejected, stays on prompt
- Logout clears local state, returns to password prompt — no GitHub/Azure redirects
- After page refresh with valid stored password → app loads without re-entering

---

## Phase 1.2 — Testing Strategy & CI (INSERTED) ✓

**Goal:** Establish a comprehensive testing foundation: unit tests (API + web), E2E tests, code coverage tracking, and GitHub Actions CI running on every PR.

**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06

**Plans:** 4/4 plans complete

Plans:
- [x] 01.2-01-PLAN.md — API test infra + unit tests (mocked MongoDB) + lockout integration tests (mongodb-memory-server)
- [x] 01.2-02-PLAN.md — Web unit tests (PasswordPage + App auth gate) + coverage config
- [x] 01.2-03-PLAN.md — Playwright E2E tests + GitHub Actions CI workflow + README badges

**Deliverables:**
- Unit tests for API (Azure Functions) and web (React components)
- E2E tests covering auth flow and lockout algorithm
- GitHub Actions CI workflow: run unit + E2E tests on every PR; block merge on failure
- Code coverage tracking with badge in README (updated by CI)
- Database assertions in tests (MongoDB integration tests)
- Test badges (CI status, coverage) in README

**UAT:**
- PR triggers CI workflow; failing test blocks merge
- Coverage badge in README reflects current test coverage
- Auth flow tests: correct password passes, wrong password rejected, lockout triggers after N failures
- E2E tests pass against local stack (MongoDB + API + web)

---

## Phase 2 — Coach Chat & Plan Generation

**Goal:** Owner can complete the coaching onboarding, get a training plan generated, and view/manage it through the coach panel. Includes all test coverage for Phase 2 features.

**Requirements covered:** GOAL-01, GOAL-02, GOAL-03, PLAN-01, PLAN-02, PLAN-03, PLAN-04, COACH-01, COACH-02, COACH-05, COACH-06

**Plans:** 8/8 plans complete

Plans:
- [x] 02-00-PLAN.md — Wave 0 test stubs for all Phase 2 test requirements
- [x] 02-01-PLAN.md — Shared types, DB module, dependency installation, HTTP streaming setup
- [x] 02-02-PLAN.md — Three-column layout with persistent coach panel, remove /coach route
- [x] 02-03-PLAN.md — Chat API endpoint with SSE streaming, message persistence, rolling context window
- [x] 02-04-PLAN.md — Plan CRUD API endpoints (create, get, generate) + session PATCH
- [x] 02-05-PLAN.md — Coach panel UI: chat interface, onboarding flow, history toggle, plan generation trigger
- [x] 02-06-PLAN.md — Training plan calendar (react-big-calendar) + session modal with inline editing
- [x] 02-08-PLAN.md — Chat history loading (GET /api/messages, useChat init hydration)
- [x] 02-09-PLAN.md — Bug fixes: Start Over resets to welcome screen, file upload for plan import, improved error display and Application Insights logging
- [x] 02-10-PLAN.md — Mobile-responsive coach panel (FAB + full-screen overlay on mobile); test isolation (Anthropic mocked in all test layers)
- [x] 02-11-PLAN.md — System prompt hardening (role boundary, persona) + app command protocol (navigate, mark session complete via chat)

**Deliverables:**
- Profile setup: goal type, target date, current fitness, available days, display units (km/miles)
- Onboarding chat: Claude asks 4–6 questions sequentially, collects context
- Claude API integration with SSE streaming (Functions → frontend via `ReadableStream`)
- Training plan generation: Claude outputs structured JSON plan stored in MongoDB
- Plan stored with session schema: date, distance, duration, avgPace, avgBpm, notes
- Training calendar view (`react-big-calendar`): weekly view showing planned sessions (replaced in Phase 2.1)
- Chat persistence: messages stored in MongoDB, rolling 20-message window + summary
- Persistent coach panel: right-column on desktop; full-screen overlay (FAB toggle) on mobile
- Chat history accessible from within coach panel
- Start Over returns to welcome screen (mode choice reset)
- Claude errors shown to user with meaningful messages + logged to Application Insights
- System prompt: running-only role boundary, persona, training plan format instructions
- App commands: Claude can navigate pages and mark sessions complete via `<app:*/>` tags in chat
- Test isolation: `@anthropic-ai/sdk` mocked in all unit/integration tests; `ANTHROPIC_API_KEY=''` in E2E

**UAT (outstanding — requires live environment):**
- Can complete onboarding chat and see a full training plan generated
- Calendar shows the plan week-by-week with correct session types and distances
- Coach chat streams responses in real-time (text appears as it's generated)
- Refresh the page — chat history is preserved
- Sessions show as "planned" (no completed sessions yet)
- Click "Start Over" from onboarding → returns to welcome screen
- When Claude returns an error → meaningful message shown; full error in Application Insights
- On mobile: FAB opens coach panel full-screen; X closes it; main content visible underneath
- Chat "show me my plan" → navigates to /plan; "I did my run" → session marked complete on calendar
- Off-topic question to coach → politely redirected to running topics

---

## Phase 2.1 — Training Plan Redesign (INSERTED)

**Goal:** Replace the calendar-based plan view with a structured, interactive training plan. Upgrade the data model from flat sessions to hierarchical phases/weeks/days. Add inline day editing, plan:update protocol, and an Archive section.

**Requirements covered:** D-01 through D-26 (see 02.1-CONTEXT.md)

**Plans:** 5/5 plans complete

Plans:
- [x] 02.1-01-PLAN.md — Replace types (PlanDay/PlanWeek/PlanPhase), update generatePlan, remove react-big-calendar
- [x] 02.1-02-PLAN.md — New API endpoints (PATCH day, archive, import) + system prompt update
- [x] 02.1-03-PLAN.md — Frontend plan view (PlanView, DayRow inline editing, PlanActions, ImportUrlForm)
- [x] 02.1-04-PLAN.md — Archive pages + sidebar nav + routing
- [x] 02.1-05-PLAN.md — useChat plan:update wiring + chat.ts phases + unit tests

**Deliverables:**
- Hierarchical plan data model: phases[] → weeks[] → days[] (replaces flat sessions[])
- Plan displayed as interactive structured view: phases → weeks → days, sorted by date
- Inline click-to-edit on objective and guidelines; click date label to reschedule within the week
- Mark days complete or skipped; undo either; delete days; convert rest days to runs; add new days per week
- Completed/skipped days shown with visual indicators, read-only
- Two plan actions: Update via coach, Close & archive
- Empty-plan archive guard: plans with no non-rest days are deleted rather than archived
- Archive section: sidebar nav entry, list page, readonly archived plan view
- `<plan:update>` XML tag protocol for agent-driven day updates — stripped from display, applied via PATCH, page refreshes automatically
- Shared chat state via ChatContext — single useChat instance shared across CoachPanel and TrainingPlan
- Training Plan as home: / → /plan; Dashboard moved to /dashboard; sidebar order: Plan → Runs → Archive → Dashboard
- XML tags stripped from chat history on mount (training_plan, plan:update, app:*)
- System prompt updated for hierarchical plan format
- Full unit + integration + E2E test coverage for all day operations, plan view, coach panel, archive, and plan:update flow
- _Note: Import from Existing Plan (file upload) and Import from ChatGPT URL removed entirely — frontend and backend deleted_

**UAT (resolved post-phase):**
- ✓ Plan page shows phases/weeks/days in structured view (no calendar)
- ✓ Click a day's guidelines → inline edit → save on blur
- ✓ Click a day's objective → inline edit with value + unit selector
- ✓ Click date label → week day-picker → select new date → day rescheduled
- ✓ + Add day button per week → select date and type → day added
- ✓ Mark day as completed → checkmark appears, day becomes read-only
- ✓ Mark day as skipped; undo completed or skipped day → reverts to active
- ✓ Delete a day via the × button with inline Yes/No confirmation
- ✓ Dates shown as "Monday 2025-04-28"
- ✓ Archive active plan → appears in Archive list → click to view readonly
- ✓ Empty plan (rest-days only) archived → plan deleted rather than archived
- ✓ Coach says "update May 12th to 30 min" → `<plan:update>` tag hidden during stream, plan page refreshes automatically (no manual reload)
- ✓ Refresh page → chat history loads without raw XML tags visible
- ✓ Coach chat scrolling no longer pulls the whole page
- ✓ Sidebar stays fixed while plan page scrolls

---

## Phase 3 — Run Logging & Feedback

**Goal:** Owner can log a run manually, see it in the Runs list, and get coaching feedback that optionally adjusts the plan.

**Requirements covered:** RUN-01, RUN-02, RUN-04, COACH-03, COACH-04

**Deliverables:**
- Manual run entry form: date, distance, duration, avg HR (optional), notes (optional), pace computed
- Two entry points: "Complete" button on Training Plan day, and "Log a run" button on Runs page
- Run-to-plan matching: link logged run to the matching active plan day by date; auto-complete the day
- Runs stored in `runs` MongoDB collection; linked to plan day document
- Undo completed day with linked run → unlinks run but keeps it in Runs list
- Post-run coaching: fires automatically after run saved; streams feedback to CoachPanel
  - Linked run: run vs plan comparison + optional plan adjustment via `<plan:update>`
  - Standalone run: run summary + one insight using last 5 completed runs as context
- Coaching insight stored on run record (visible in run detail without scrolling chat)
- Runs page: list of all runs (all-time, reverse date, infinite scroll) with filters (date/distance/duration)
- Run detail modal: date, distance, time, pace, avg HR, notes, coaching insight, plan link
- Delete run: only if unlinked (linked runs require undo on plan day first)

**UAT:**
- Click "Complete" on a plan day → run entry form → fill in data → save → day marked complete, run in Runs list
- CoachPanel auto-opens after save, streams post-run feedback comparing run to plan target
- If coach adjusts the plan, Training Plan page updates automatically
- Log a standalone run from Runs page → coaching feedback fires using recent run history
- Runs page lists all runs; click a run → detail modal with coaching insight
- Undo a completed day → day reverts to active, run stays in Runs list
- Linked run has no delete button; unlinked run has a delete button

---

## Phase 3.1 — Fix Coach Feedback Quality (GAP CLOSURE)

**Goal:** Fix two warning-severity integration issues identified in the v1.1 audit — stale closure in run insight save and raw XML in progressFeedback storage.

**Requirements:** COACH-03, COACH-04
**Gap Closure:** Closes integration warnings from v1.1 audit

**Plans:** 7/7 plans complete

Plans:
- [x] 03.1-01-PLAN.md — Fix stale closure in RunDetailModal + strip XML from TrainingPlan progressFeedback

**Deliverables:**
- `RunDetailModal.handleAddFeedback`: use `sendMessage()` return value directly instead of reading stale `messages` closure — ensures the saved insight is always the just-received response
- `TrainingPlan.handleGetFeedback`: strip XML tags from `accumulatedText` before storing as `progressFeedback` — prevents raw `<plan:update>` or `<app:navigate>` tags from rendering in the feedback section
- Unit tests updated to cover both fix paths

**UAT:**
- Add feedback to a run → insight saved matches the assistant response just received (no stale message captured)
- Coach responds to plan feedback with a plan adjustment → `progressFeedback` displays clean text, no raw XML visible

---

## Phase 3.2 — Tech Debt Cleanup (GAP CLOSURE)

**Goal:** Remove dead code endpoints, deduplicate the SSE streaming loop, and fix stale documentation inconsistencies found in the v1.1 audit.

**Gap Closure:** Closes tech debt items from v1.1 audit

**Plans:** 4/4 plans executed

Plans:
- [x] 03.2-01-PLAN.md — Remove dead endpoints (sessions PATCH, plan/generate POST) and update tests
- [x] 03.2-02-PLAN.md — Deduplicate SSE streaming loop in useChat.ts (extract shared helper)
- [x] 03.2-03-PLAN.md — Fix docs: AUTH descriptions, planImport VERIFICATION refs, act() warning
- [x] 03.2-04-PLAN.md — Increase API test coverage to 80%+ (formatPace, formatRunDate, run context injection)

**Deliverables:**
- Remove `PATCH /api/sessions/:sessionId` — dead code, superseded by `PATCH /api/plan/days/:week/:day`, no frontend callers
- Remove `POST /api/plan/generate` — superseded by server-side plan saving in `chat.ts`; client no longer calls it
- Deduplicate `startPlan()` SSE streaming loop: extract shared streaming logic used by both `startPlan()` and `sendMessage()` in `useChat.ts`
- Fix AUTH-01/02/03 descriptions in REQUIREMENTS.md — update from "GitHub OAuth + SWA custom role" to password auth (Phase 1.1 superseded this)
- Fix planImport.ts docs inconsistency — remove planImport.ts references from VERIFICATION.md since it was subsequently deleted
- Fix `act()` warning in `App.auth.test.tsx` from CoachPanel async state update
- Update tests for removed endpoints
- Increase API test coverage back above 80% — Phase 3 added `runs.ts` (412 lines) and `chat.ts` run-enrichment code that dropped overall coverage from 84.3% to 68.9%; target the uncovered paths in `chat.ts` (run context injection, `formatPace`, `formatRunDate`) and any untested branches in `runs.ts`

**UAT:**
- `PATCH /api/sessions/:sessionId` returns 404 (route removed)
- `POST /api/plan/generate` returns 404 (route removed)
- `npm test` in `api/` passes with no `act()` warnings; all existing tests green

---

## Phase 3.3 — UI Polish & Mobile Fixes (INSERTED)

**Goal:** Address UX friction points and mobile layout issues discovered during post-Phase-3 usage: scroll position, favicon, cross-linking between runs and training plan, modal consistency, and coaching feedback panel improvements.

**Depends on:** Phase 3

**Plans:** 4/4 plans complete

Plans:
- [x] 03.3-01-PLAN.md — Scroll & navigation: plan auto-scroll to last completed day, mobile coach panel scroll, cross-linking (run date → detail modal, Week/Day badge → plan scroll)
- [x] 03.3-02-PLAN.md — Modal unification: unlink run feature (API + UI + agent command), notes height, mobile Safari fixes
- [x] 03.3-03-PLAN.md — Visual polish: favicon, theme-color meta tag, remove Update Plan button, compact Archive button inline with title
- [x] 03.3-04-PLAN.md — Coaching feedback panel: move Get/Refresh feedback to panel header, conditional collapse, paragraph spacing; DayRow Log run on completed days

**Deliverables:**
- Training plan auto-scrolls to last completed run on open
- Mobile coach panel opens scrolled to last message
- Safari address-bar area blends with app theme (theme-color meta tag / safe-area background)
- Favicon added
- Run detail modal: Week X · Day Y badge navigates to training plan scrolled to that day (green = active plan, gray = archived)
- Training plan: completed linked run date is clickable and opens run detail modal
- Undo button repositioned next to guidelines for linked completed runs (consistent with unlinked completed runs)
- Completed plan days show "Log run" option to create a new run from scratch
- Log run modal and view run modal unified into a single consistent modal (view modal adds: insights, delete, save changes)
- Notes field height increased in both log and view modals
- "Update plan" button removed from training plan view
- Close and Archive buttons made smaller and placed next to the training plan title
- "Get plan feedback" action moved into Coach Feedback panel header; panel non-expandable when no feedback exists; link text changes to "Refresh feedback" when feedback already exists
- Paragraph spacing in feedback panel increased to match chat spacing
- Mobile Safari: log run modal layout fixed
- Mobile Safari: filters layout fixed
- Allow unlinking a linked run (both manually in run modal and via agent `<plan:unlink/>` command)

**UAT:**
- Training plan opens and viewport scrolls to last completed run
- On mobile, opening coach panel shows most recent message
- Safari bottom bar area has app-matching background color (no plain white strip)
- Favicon visible in browser tab
- Clicking Week X · Day Y badge in run detail navigates to plan and highlights that day
- Clicking run date on a completed plan day opens run detail modal
- Undo button appears next to guidelines on linked completed runs
- Completed day has a "Log run" button that opens the log run form
- Log run modal and view run modal share the same layout
- Notes textarea is taller in both modals
- No "Update plan" button visible in training plan
- Close/Archive buttons are compact and positioned near the plan title
- "Get plan feedback" button is in the feedback panel header; panel collapses when no feedback; button says "Refresh feedback" when feedback exists
- Feedback panel text has visible paragraph spacing
- Log run modal renders correctly on mobile Safari
- Filters panel renders correctly on mobile Safari
- Unlink action available in run modal; unlinking removes plan association from run

---

## Phase 4 — Dashboard & Plan Import

**Goal:** Real dashboard home page with date-filtered training stats, volume and pace charts, and readonly archived plan chat history.

**Requirements covered:** DASH-01, DASH-02, DASH-03, DASH-04, IMP-01, IMP-02, IMP-03

**Note:** IMP-01/02/03 (plan import from LLM) dropped by user — not needed. DASH-04 (generic chat history section) replaced by archived plan readonly chat (D-17 through D-23).

**Plans:** 5/5 plans complete

Plans:
- [x] 04-01-PLAN.md — Routing changes (/ → /dashboard), Sidebar reorder (Dashboard first), Recharts install, Dashboard scaffold
- [x] 04-02-PLAN.md — useDashboard hook (filter state machine, run fetching, stats + chart data calculation)
- [x] 04-03-PLAN.md — Dashboard UI (stat cards wired to useDashboard, Recharts bar + line charts, empty states)
- [x] 04-04-PLAN.md — CoachPanel readonly mode + ArchivePlan wiring (chat history fetch, right panel, mobile FAB)
- [x] 04-05-PLAN.md — E2E tests (dashboard routing, filters, stats, Adherence navigation, archived plan FAB)

**Deliverables:**
- Dashboard becomes home page (/ → /dashboard); Dashboard first in sidebar
- 7 date filter presets with "Current Plan" as default
- 4 stat cards: Total Distance, Total Runs, Total Time, Adherence % (clickable → /plan)
- Weekly Volume bar chart (Recharts, green-500 bars)
- Pace Trend line chart (Recharts, blue-500 line)
- Empty states: no active plan + Current Plan filter; no runs in range
- Archived plan pages show readonly CoachPanel with "Plan History" label, no input, gray FAB on mobile
- Full unit + E2E test coverage for all dashboard and archived plan panel features

**UAT:**
- / redirects to /dashboard
- Dashboard shows correct stats for the selected filter
- Adherence % card click navigates to /plan
- Switching filter preset re-fetches data and updates all cards and charts
- Empty state shown when no active plan and "Current Plan" filter selected
- Archived plan page shows "Plan History" panel on desktop; gray clock FAB on mobile
- Panel shows historical coaching messages (readonly — no input field)

---

## Milestone Complete: v1

When all phases are verified, the full coaching loop is functional:
1. Set goal → onboarding chat → training plan generated
2. Upload run → parsed data → coaching feedback → plan adjusted
3. Dashboard shows progress, history, and coach conversations
4. Old plans can be imported from LLM conversations

**Next milestone ideas:**
- v1.1: HR zone charts, weekly volume trends (ANLX requirements)
- v1.2: Plan export to calendar format
- v2: GPS route display, proactive weekly coach summaries
