---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: "Quick task 260407-vyb shipped — PR #52"
last_updated: "2026-04-07T21:30:00.000Z"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 38
  completed_plans: 38
  percent: 92
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened.
**Current focus:** Phase 03.3 complete — ready for Phase 4

## Current Phase

**Phase:** 03.3
**Status:** Phase 3.3 shipped - PR #48
**Plans:** 5/5
**Progress:** [█████████░] 92%

## Milestone

**Milestone:** v1 — Personal AI Running Coach
**Phases:** 6 total (1, 1.1, 1.2, 2, 2.1 + UAT fixes)
**Overall progress:** 100% — all feature phases done; Phase 3 (Run Logging) is next

| Phase | Name                              | Status        | Plans     |
| ----- | --------------------------------- | ------------- | --------- |
| 1     | Infrastructure & Auth             | ✓ Complete    | 3/3 done  |
| 1.1   | Replace Auth with Simple Password | ✓ Complete    | 2/2 done  |
| 1.2   | Testing Strategy & CI             | ✓ Complete    | 4/4 done  |
| 2     | Coach Chat & Plan Generation      | ✓ Complete    | 8/8 done  |
| 2.1   | Training Plan Redesign            | ✓ Complete    | 5/5 done  |
| 2.1†  | UAT Fixes (post-phase)            | ✓ Complete    | —         |
| 3     | Run Logging & Feedback            | ○ Pending     | —         |
| 4     | Dashboard & Plan Import           | ○ Pending     | —         |

## Decisions

- **01-01:** Tailwind v4 via `@tailwindcss/vite` plugin + `@import "tailwindcss"` in CSS — no tailwind.config.js needed
- **01-01:** `vitest passWithNoTests: true` so CI passes before first test files exist
- **01-01:** `api/src/functions/placeholder.ts` needed to satisfy tsconfig include before real functions exist
- **01-01:** `api/local.settings.json` gitignored — contains `OWNER_GITHUB_USERNAME` only in local secrets (AUTH-03)
- **01-02:** `owner` role (not `authenticated`) on /_ and /api/_ — prevents any random GitHub user from logging in
- **01-02:** Sidebar collapses to icon-only on mobile (w-16) via Tailwind responsive prefix md:w-56 — no JS state needed
- **01-02:** NavLink `end={true}` on / prevents Dashboard from being active-highlighted on all sub-routes
- **01-03:** `authLevel: 'anonymous'` on health function — SWA route rules enforce owner role at proxy level
- **01-03:** assign-owner-role.sh uses `${OWNER_GITHUB_USERNAME}` env var (AUTH-03 — no hardcoded username)
- **01-03:** setup-cosmos-db.sh requires `COSMOS_ACCOUNT_NAME` env var — creates 'running-coach' DB in existing free-tier account (D-14)
- # **01-03:** Switched from Cosmos DB SQL API to MongoDB API — reusing existing free-tier account. Replaced `@azure/cosmos` with `mongodb` driver.
- [Phase 01.1-02]: Global fetch interceptor in App.tsx handles 401 from any API call
- [Phase 01.1-01]: requirePassword returns HttpResponseInit or null where null means auth passed
- [Phase 01.2-02]: Use getAllByText for Dashboard since it appears in both sidebar nav and page heading
- [Phase 01.2-02]: Use input.closest('form') for form submit since form has no accessible role name
- [Phase 01.2-01]: vi.hoisted() required for mock fn references in vi.mock factory
- [Phase 01.2-01]: _resetConnectionForTest exported from auth.ts to reset MongoClient singleton between integration tests
- [Phase 01.2-03]: Playwright webServer uses npm run start (not npx func start directly) to ensure TypeScript prestart build runs first
- [Phase 01.2-03]: Coverage badges use no-commit: true + manual orphan branch push to unprotected badges branch (avoids master branch protection)
- [Phase 01.2-03]: Single CI test job runs all three test layers sequentially to share one MongoDB instance
- [Phase 01.2-04]: TEST-01 through TEST-06 registered in REQUIREMENTS.md under Testing Infrastructure section with traceability to Phase 1.2 Complete
- [Phase 02-00]: Use it.todo() for all Phase 2 stub tests
- [Phase 02-02]: CoachPanel uses fixed width (w-80/w-96) in three-column flex layout; flex-1 main fills remaining space without explicit percentages
- [Phase 02-02]: /coach route removed; coach embedded as persistent panel in AppShell per D-10/D-13
- [Phase 02-01]: auth.ts keeps its own getDb() to avoid breaking existing tests; new functions import from shared/db.ts
- [Phase 02-01]: app.setup({ enableHttpStream: true }) placed before all function imports in index.ts per Azure Functions streaming requirement
- [Phase 02-03]: maybeSummarize is fire-and-forget after stream closes to avoid delaying SSE done event
- [Phase 02-03]: ANTHROPIC_API_KEY validated at handler start with 500 error for clear diagnostic feedback
- [Phase 02-04]: updateMany used to discard existing onboarding plans to handle edge case of multiple stale onboarding docs
- [Phase 02-04]: delete (updates as Record<string, unknown>).id pattern prevents session id overwrite in PATCH handler
- [Phase 02-05]: type-only import required for Message in ChatHistory.tsx due to verbatimModuleSyntax tsconfig
- [Phase 02-05]: extractGoalFromText parses <goal> XML block or returns sensible defaults for plan generation
- [Phase 02-05]: startPlan('conversational') auto-sends initial message to kick off onboarding immediately
- [Phase 02-06]: verbatimModuleSyntax requires import type for View and PlanSession
- [Phase 02-08]: GET /api/messages uses same requirePassword auth middleware pattern as all other endpoints
- [Phase 02-08]: useChat history fetch non-fatal: failure leaves messages empty same as before
- [Phase 02-09]: startOver() resets to null plan state (no API call) — orphaned onboarding plan discarded next POST /api/plan
- [Phase 02-09]: Import conversation changed from textarea paste to file upload (.txt/.md/.json); FileReader reads content client-side
- [Phase 02-09]: Claude stream errors now log full message+stack+planId to Application Insights via context.error()
- [Phase 02-10]: CoachPanel receives isOpen/onClose props from AppShell; mobile=fixed inset-0 z-50 overlay, desktop=static flex column
- [Phase 02-10]: @anthropic-ai/sdk mocked via vi.mock() in chat.test.ts and chat.integration.test.ts to prevent real API calls in unit tests
- [Phase 02-10]: playwright.config.ts sets ANTHROPIC_API_KEY='' in webServer env to prevent real API calls in E2E tests
- [Phase 02-11]: buildSystemPrompt receives optional sessions[] parameter; includes next 14 upcoming sessions with session_id for app:complete commands
- [Phase 02-11]: App commands use <app:navigate page="X"/> and <app:complete session_id="Y"/> XML tags; frontend strips from display and executes after stream done
- [Phase 02-11]: navigate commands execute after plan refetch so target page has fresh data; training_plan generation takes priority over navigate commands
- [Phase 02.1]: PlanSession kept as deprecated export for session.ts and prompts.ts transition
- [Phase 02.1]: getPlan returns null for stale sessions-based plans to prevent UI breakage
- [Phase 02.1-03]: PlanView renders React components directly (not ReactMarkdown) for active plan so inline editing works; planToMarkdown kept for archive/export
- [Phase 02.1-03]: open-coach custom window event decouples TrainingPlan from AppShell state without prop drilling
- [Phase 02.1-03]: DayRow isReadOnly guard: readonly || day.completed || day.skipped collapses three non-editable states
- [Phase 02.1-02]: arrayFilters with day.date and day.completed false enforces completed-day edit guard at DB level
- [Phase 02.1-02]: buildSystemPrompt signature changed from PlanSession[] to PlanPhase[] - session-based context replaced by phases-based upcoming days
- [Phase 02.1-04]: Archive list shows objective label and Archived badge for D-24 completion status; planToMarkdown reused from Plan 03 for readonly view (D-25)
- [Phase 02.1-05]: parseXmlAttrs exported at module level (outside hook) for direct unit testability
- [Phase 02.1-05]: planDays completed-day guard verified via DB assertion not 404 (MongoDB findOneAndUpdate returns doc even when arrayFilters match nothing)
- [Phase 02.1-05]: planImport test uses vi.unstubAllGlobals() not vi.restoreAllMocks() to preserve requirePassword mock while clearing global.fetch stubs
- [UAT-fixes-02.1]: arrayFilters no longer include `completed: false` — removed so undo (completed/skipped → false) can update already-completed days
- [UAT-fixes-02.1]: DELETE /api/plan/days/:date uses `$pull` with `$[]` all-positional operator to remove from triply-nested phases→weeks→days array
- [UAT-fixes-02.1]: `<plan:update>` stripped live during streaming (same pattern as `<training_plan>`); `plan-updated` window event dispatched after patches so TrainingPlan page refreshes without manual reload
- [UAT-fixes-02.1]: XML tags (`<training_plan>`, `<plan:update>`, `<app:*/>`) stripped from assistant messages when loaded from MongoDB history on mount
- [UAT-fixes-02.1]: CoachPanel scroll uses container `scrollTop = scrollHeight` instead of `scrollIntoView` to avoid scrolling the whole page
- [UAT-fixes-02.1]: Sidebar changed from `min-h-screen` to `h-screen sticky top-0 overflow-y-auto` — stays fixed while main content scrolls
- [UAT-fixes-02.1]: DayRow date formatted as "Monday 2025-04-28" using `new Date(date + 'T12:00:00')` with noon offset to avoid timezone-shift on date-only strings
- [UAT-fixes-02.1]: Import from Existing Plan (file upload onboarding) and Import from ChatGPT URL removed entirely — frontend buttons and backend planImport.ts deleted, dead import removed from index.ts
- [plan-day-management]: `<plan:add>` tag added — coach emits `<plan:add date="..." .../>` to create new training days; `useChat.ts` parses and POSTs to `/api/plan/days`; tag stripped from display like `<plan:update>`
- [plan-day-management]: Plan replace guard — `generatePlan` returns 409 if the target plan OR any other active plan has completed days (second check prevents stale-client planId exploit); `createPlan` returns 409 if any active plan has completed days
- [plan-day-management]: `DELETE /api/plan/days/:date` returns 409 for completed days — training history is locked and cannot be removed via UI or API
- [plan-day-management]: `POST /api/plan/days` (addDay) returns 400 for past dates — enforced at API level; UI also disables past days in AddDayForm picker
- [UAT-fixes-02.1-r2]: AppShell uses `h-[100dvh]` instead of `h-screen` — Safari bottom browser chrome was clipping sidebar logout button; dvh is the visible viewport height
- [UAT-fixes-02.1-r2]: System prompt injects next 5 upcoming weeks (Mon–Sun, exact ISO dates) so Claude never computes day-of-week independently — was producing Tue/Thu/Sat when user asked for Mon/Wed/Fri
- [UAT-fixes-02.1-r2]: Claude instructed to use `<plan:update skipped="true">` when asked to remove a day, be transparent that it's a skip not a delete, and count only non-skipped runs when summarising
- [UAT-fixes-02.1-r2]: `generatePlan` no longer strips past-dated run days to rest — preserves them with `completed`/`skipped` flags so training history from before the plan start can be included; `<plan:add>` still rejects past dates
- [plan-day-management]: `currentDate` sent from client as local ISO date string in chat API request body — avoids UTC-offset causing the wrong date in system prompt (e.g. late-night sessions rolling to tomorrow)
- [plan-day-management]: System prompt includes full Mon–Sun week calendar with day-of-week labels and a `← today` marker so Claude doesn't recompute day-of-week incorrectly
- [plan-day-management]: All training days (not just upcoming) shown in system prompt with `[COMPLETED]`/`[SKIPPED]` status labels — gives Claude full plan state for targeted `<plan:add>`/`<plan:update>` decisions
- [plan-day-management]: DayRow `isSaving` state — spinner shown, action buttons hidden while update/delete is in-flight; prevents double-clicks and gives visual feedback
- [plan-day-management]: AddDayForm day picker uses local date (not `new Date().toISOString()`) to determine "today" — same UTC-offset fix as chat currentDate
- [CI-badges]: vitest runs with `--reporter=verbose --reporter=json --outputFile.json=coverage/test-results.json` to produce JSON counts alongside coverage. playwright.config.ts emits `playwright-results.json` when CI=true. coverage-badge job uses `if: always()` so badges update even on test failure.
- [260329-ws0]: normalizePlanPhases() uses Date.UTC() for week-number arithmetic — avoids DST mismatch where 7 local days != 7 * 86400000ms across spring/autumn clock changes
- [260329-ws0]: get_week_dates tool removed from chat.ts entirely — 26-week pre-computed calendar in system prompt (offsets -13 to +12) eliminates tool-call latency and tool misuse errors
- [260329-ws0]: normalizePlanPhases replaces per-week normalizeWeekDays for plan saves in chat.ts and plan.ts — global pass redistributes days placed in wrong week objects by Claude
- [260330-07e]: Training plan model now uses globally sequential week numbers + A-G day labels instead of calendar dates; plan:update/plan:add XML tags use week="N" day="X"; system prompt calendar block removed entirely; assignPlanStructure() replaces normalizePlanPhases()
- [Phase 03-01]: Run unlinked filter uses planId exists-false for TypeScript type compatibility
- [Phase 03-02]: Run lookup uses Map<weekNumber-dayLabel, Run> for O(1) access during synthetic context line building
- [Phase 03-02]: Run fetch in chat.ts is non-fatal (try/catch) to avoid blocking chat flow if runs collection unavailable
- [Phase 03-02]: Insight text truncated at 150 chars to keep context compact
- [Phase 03-06]: API tests import runs.js + planDays.js + plan.js together so undo-unlink and patchPlan tests reuse same handler map
- [Phase 03-06]: E2E tests use route mocking (not real DB) consistent with training-plan.spec.ts pattern
- [Phase 03-06]: linkRun test uses plain fakeReq object (params + json body spy can't coexist in HttpRequest constructor params option)
- [Phase 03-run-logging]: offsetRef + totalRef eliminate stale closure in Runs page IntersectionObserver
- [Phase 03-run-logging]: linkRun 409 guard now checks existing linked run not just completed flag
- [Phase 03.1]: COACH-03: sendMessage return value used directly for run insight, removes stale messages closure
- [Phase 03.1]: COACH-04: self-closing XML tags stripped from progressFeedback via replace before PATCH save
- [Phase 03.2-01]: generatePlan handler deleted - superseded by server-side plan saving in chat.ts
- [Phase 03.2-02]: streamChatResponse extracted as module-level helper; applyPlanOperations as useCallback for plan ops sharing
- [Phase 03.2-03]: AUTH-01/02/03 requirements updated to describe APP_PASSWORD auth replacing GitHub OAuth
- [Phase 03.2-03]: App.auth.test.tsx uses waitFor + json() mock to drain useChat async mount effects inside act() to eliminate act() warning
- [Phase 03.2-04]: formatPace and formatRunDate exported at module level to enable direct unit testing
- [Phase 03.3-01]: dayRefsMap uses Map<string,HTMLDivElement> keyed by weekNumber-label for O(1) day lookup during navigate-to-day scroll
- [Phase 03.3-01]: navigate-to-day dispatched with 150ms delay so TrainingPlan has time to mount after navigate('/plan')
- [Phase 03.3-01]: hasActivePlan moved before useEffects to avoid React hooks order violation (reference before declaration)

## Accumulated Context

### Roadmap Evolution

- Phase 2.1 inserted between Phase 2 and Phase 3 — replaced calendar/sessions model with hierarchical phases/weeks/days
- Phase 2 extended with UAT fixes, mobile UI, test isolation, system prompt hardening, app commands
- Import from Existing Plan and Import from ChatGPT URL removed from frontend during UAT — API endpoint preserved
- Phase 3 (Run Logging) is the active next phase
- Phase 3.3 inserted after Phase 3.2 (URGENT): UI Polish & Mobile Fixes — post-Phase-3 UX feedback covering scroll position, favicon, run/plan cross-linking, modal consistency, mobile Safari layout, and coaching feedback panel improvements

## Performance Metrics

| Phase                  | Plan | Duration | Tasks | Files |
| ---------------------- | ---- | -------- | ----- | ----- |
| 01-infrastructure-auth | 01   | 6 min    | 2     | 20    |
| 01-infrastructure-auth | 02   | 5 min    | 2     | 9     |
| 01-infrastructure-auth | 03   | 5 min    | 3     | 4     |

---

_Initialized: 2026-03-21_
_Last updated: 2026-04-07 — quick task 260407-iqp shipped — PR #49_
| Phase 03-run-logging P01 | 10 min | 2 tasks | 5 files |
| Phase 03-run-logging P02 | 8 min | 1 tasks | 2 files |
| Phase 03-run-logging P06 | 5min | 4 tasks | 3 files |
| Phase 03-run-logging P07 | 20 min | 3 tasks | 11 files |
| Phase 03.1-fix-coach-feedback-quality P01 | 7 min | 3 tasks | 4 files |
| Phase 03.2-tech-debt-cleanup P01 | 6 min | 2 tasks | 5 files |
| Phase 03.2-tech-debt-cleanup P02 | 5 min | 1 tasks | 1 files |
| Phase 03.2-tech-debt-cleanup P03 | 9 min | 2 tasks | 3 files |
| Phase 03.2-tech-debt-cleanup P04 | 8 min | 3 tasks | 4 files |
| Phase 03.3-ui-polish-mobile-fixes P01 | 5 min | 2 tasks | 5 files |

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260330-07e | remove dates from training plan, use A-G labels and global sequential week numbers | 2026-03-29 | e843ea5 | [260330-07e-refactor-training-plan-remove-dates-use-](./quick/260330-07e-refactor-training-plan-remove-dates-use-/) |
| 260329-ws0 | normalizePlanPhases global redistribution, 26-week pre-computed calendar, remove get_week_dates tool | 2026-03-29 | 684f3b4 | [260329-ws0-fix-calendar-date-accuracy-server-side-p](./quick/260329-ws0-fix-calendar-date-accuracy-server-side-p/) |
| 260329-cal | fix calendar date accuracy: add 13 past weeks + extend to 24 future weeks + DD/MM/YYYY parsing rule | 2026-03-29 | — | [260329-cal-fix-calendar-date-accuracy](./quick/260329-cal-fix-calendar-date-accuracy/) |
| 260329-n0p | fix plan:add past dates + strip plan:add streaming tags + 12-week calendar + isGeneratingPlan indicator | 2026-03-29 | 5f3638c | [260329-n0p-fix-plan-add-past-dates-strip-plan-tags-](./quick/260329-n0p-fix-plan-add-past-dates-strip-plan-tags-/) |
| 260329-lc2 | fix TS2769 build errors in useChat.trainingPlan.test.ts, CLAUDE.md npm run build doc | 2026-03-29 | 8a7a1bd | [260329-lc2-fix-typescript-build-errors-in-usechat-t](./quick/260329-lc2-fix-typescript-build-errors-in-usechat-t/) |
| 260329-ep5 | disable Add Day for past weeks, planState to agent, fix startDate, server-side plan saving | 2026-03-29 | 929ee6b | [260329-ep5-fix-4-issues-disable-add-day-when-all-da](./quick/260329-ep5-fix-4-issues-disable-add-day-when-all-da/) |
| 260331-0vx | Edit phase title/description and delete last phase with confirmation | 2026-03-31 | 8e7e159 | [260331-0vx-edit-phase-title-description-and-delete-](./quick/260331-0vx-edit-phase-title-description-and-delete-/) |
| 260328-uuj | fix plan adjustment 409 conflict completed dates and silent errors | 2026-03-28 | 808bd73 | [260328-uuj-fix-plan-adjustment-409-conflict-complet](./quick/260328-uuj-fix-plan-adjustment-409-conflict-complet/) |
| 260407-iqp | Add logo to app UI, change favicon, update README | 2026-04-07 | 5d5c94b | [260407-iqp-add-logo-to-app-ui-change-favicon-update](./quick/260407-iqp-add-logo-to-app-ui-change-favicon-update/) |
| 260407-khd | fix Safari date inputs showing locale format and bottom safe area white rectangle | 2026-04-07 | 27264ca | [260407-khd-fix-safari-date-inputs-showing-locale-fo](./quick/260407-khd-fix-safari-date-inputs-showing-locale-fo/) |
| 260407-vyb | Freeze training plan header on scroll | 2026-04-07 | c15da69 | [260407-vyb-freeze-training-plan-header-on-scroll](./quick/260407-vyb-freeze-training-plan-header-on-scroll/) |
| Phase 01.1-replace-auth P02 | 2 min | 2 tasks | 4 files |
| Phase 01.1-replace-auth P01 | 2 | 2 tasks | 2 files |
| Phase 01.2-testing-strategy P02 | 2 min | 2 tasks | 4 files |
| Phase 01.2-testing-strategy P01 | 4 min | 2 tasks | 6 files |
| Phase 01.2-testing-strategy P03 | 3 min | 2 tasks | 6 files |
| Phase 01.2-testing-strategy P04 | 3min | 1 tasks | 1 files |
| Phase 02-coach-chat P00 | 3 min | 2 tasks | 6 files |
| Phase 02-coach-chat P02 | 2min | 2 tasks | 5 files |
| Phase 02-coach-chat P01 | 3min | 2 tasks | 5 files |
| Phase 02-coach-chat P03 | 2min | 2 tasks | 4 files |
| Phase 02-coach-chat P04 | 2min | 2 tasks | 3 files |
| Phase 02-coach-chat P05 | 4min | 2 tasks | 4 files |
| Phase 02 P06 | 8min | 2 tasks | 4 files |
| Phase 02-coach-chat P08 | 3min | 2 tasks | 3 files |
| Phase 02.1 P01 | 8 min | 2 tasks | 10 files |
| Phase 02.1-training-plan-redesign P03 | 8min | 2 tasks | 8 files |
| Phase 02.1-training-plan-redesign P02 | 3 min | 2 tasks | 6 files |
| Phase 02.1-training-plan-redesign P04 | 2min | 2 tasks | 4 files |
| Phase 02.1-training-plan-redesign P05 | 6 min | 2 tasks | 7 files |
