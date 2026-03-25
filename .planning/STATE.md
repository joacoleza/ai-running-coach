---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: executing
last_updated: "2026-03-25T11:13:14.166Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 22
  completed_plans: 21
  percent: 95
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened.
**Current focus:** Phase 02.1 — training-plan-redesign

## Current Phase

**Phase:** 01.2
**Status:** Ready to execute
**Plans:** 0/TBD
**Progress:** [██████████] 95%

## Current Position

Phase: 02.1 (training-plan-redesign) — EXECUTING
Plan: 5 of 5

## Milestone

**Milestone:** v1 — Personal AI Running Coach
**Phases:** 5 total
**Overall progress:** 20%

| Phase | Name                              | Status        | Plans    |
| ----- | --------------------------------- | ------------- | -------- |
| 1     | Infrastructure & Auth             | ✓ Complete    | 3/3 done |
| 1.1   | Replace Auth with Simple Password | ◎ In Progress | TBD      |
| 2     | Coach Chat & Plan Generation      | ○ Pending     | —        |
| 3     | Run Logging & Feedback            | ○ Pending     | —        |
| 4     | Dashboard & Plan Import           | ○ Pending     | —        |

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

## Accumulated Context

### Roadmap Evolution

- Phase 2.1 merged into Phase 2 (not a separate phase)
- Phase 2 extended with UAT fixes, mobile UI, test isolation, system prompt hardening, app commands
- Phase 2 status: code complete, awaiting human UAT in live environment

## Performance Metrics

| Phase                  | Plan | Duration | Tasks | Files |
| ---------------------- | ---- | -------- | ----- | ----- |
| 01-infrastructure-auth | 01   | 6 min    | 2     | 20    |
| 01-infrastructure-auth | 02   | 5 min    | 2     | 9     |
| 01-infrastructure-auth | 03   | 5 min    | 3     | 4     |

---

_Initialized: 2026-03-21_
_Last updated: 2026-03-22 — completed plan 01-03 (Phase 01 complete)_
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
