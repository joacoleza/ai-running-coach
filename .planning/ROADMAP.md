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

**Requirements:** TBD
**Plans:** TBD

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

## Phase 2 — Coach Chat & Plan Generation

**Goal:** Owner can complete the coaching onboarding, get a training plan generated, and view it on a calendar.

**Requirements covered:** GOAL-01, GOAL-02, GOAL-03, PLAN-01, PLAN-02, PLAN-03, PLAN-04, COACH-01, COACH-02, COACH-05, COACH-06

**Deliverables:**
- Profile setup: goal type, target date, current fitness, available days, display units (km/miles)
- Onboarding chat: Claude asks 4–6 questions sequentially, collects context
- Claude API integration with SSE streaming (Functions → frontend via `ReadableStream`)
- Training plan generation: Claude outputs structured JSON plan stored in Cosmos DB
- Plan stored with full session schema (week, day, type, distance, pace target, HR zone, notes)
- Training calendar view (`react-big-calendar`): weekly view showing planned sessions
- Chat persistence: messages stored in Cosmos DB, rolling 20-message window + summary
- Chat history UI: dedicated section to browse past coaching conversations

**UAT:**
- Can complete onboarding chat and see a full training plan generated
- Calendar shows the plan week-by-week with correct session types and distances
- Coach chat streams responses in real-time (text appears as it's generated)
- Refresh the page — chat history is preserved
- Sessions show as "planned" (no completed sessions yet)

---

## Phase 3 — Run Logging & Feedback

**Goal:** Owner can upload a run from Apple Watch, see parsed data, and get coaching feedback that optionally adjusts the plan.

**Requirements covered:** RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, COACH-03, COACH-04

**Deliverables:**
- Apple Health ZIP upload flow: SAS token request → direct upload to Blob Storage (bypasses 30 MB SWA proxy limit)
- Background Azure Function (Blob trigger) that SAX-parses `export.xml`, extracts workouts from last upload
- Run data stored: date, distance, duration, avg/max HR, pace, cadence, elevation gain
- HR zone computation from HR time-series records vs. user's configured max HR
- Run-to-plan matching: link parsed run to the closest planned session by date and distance
- Automatic session completion when a matching run is logged
- Post-run coaching trigger: coach generates feedback (run vs plan, insight, adjustment)
- Streaming feedback delivered to chat interface
- Plan adjustments by coach update the stored plan sessions
- Upload status polling: frontend shows "Parsing..." → "Done" (async background processing)

**UAT:**
- Upload an Apple Health ZIP — receives "upload received, parsing..." immediately
- After processing, run appears with correct distance, pace, and HR data
- The matching planned session is marked complete
- Coach chat shows post-run feedback with comparison to plan
- If coach adjusts the plan, calendar updates reflect the change

---

## Phase 4 — Dashboard & Plan Import

**Goal:** Full dashboard showing progress, run history, and plan import from an existing LLM conversation.

**Requirements covered:** DASH-01, DASH-02, DASH-03, DASH-04, IMP-01, IMP-02, IMP-03

**Deliverables:**
- Dashboard home page:
  - Current week: training schedule with session status (planned/complete/missed)
  - Progress card: weeks elapsed, total distance logged, plan adherence %
  - Recent runs list: last 5 runs with distance, pace, date
- Run history page: full list of logged runs with per-run detail view (distance, pace, HR, comparison to plan, coach feedback)
- Plan import flow:
  - Text area to paste raw LLM conversation
  - Claude extracts and normalizes to session schema
  - Preview table showing parsed weeks/sessions before saving
  - Confirm → replaces active plan (with warning)
- Chat history section: paginated list of past coaching conversations, readable but not interactive

**UAT:**
- Dashboard shows correct week view with session statuses
- Progress card shows accurate adherence % based on logged runs
- Run detail view shows all metrics and the coach's post-run feedback
- Paste a ChatGPT/Claude training plan conversation → see parsed plan in preview → confirm → calendar updates
- Chat history shows all past conversations chronologically

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
