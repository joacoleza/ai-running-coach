# Requirements: AI Running Coach

**Defined:** 2026-03-21
**Core Value:** A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: App is accessible only to the owner (single-user gate via GitHub OAuth + SWA custom role)
- [x] **AUTH-02**: Unauthenticated requests are redirected to GitHub login
- [x] **AUTH-03**: Owner GitHub username is configurable via environment variable (no hardcoding)

### Testing Infrastructure

- [x] **TEST-01**: Unit tests for API functions (Azure Functions) with mocked MongoDB
- [x] **TEST-02**: Unit tests for web components (React) covering auth flow and UI behavior
- [x] **TEST-03**: E2E tests covering the full auth flow and lockout behavior in a real browser
- [x] **TEST-04**: GitHub Actions CI workflow runs all tests on every PR to master and blocks merge on failure
- [x] **TEST-05**: Code coverage tracking with badge in README updated automatically by CI
- [x] **TEST-06**: Database assertions in integration tests verify MongoDB document state directly

### Goal & Profile

- [x] **GOAL-01**: User can set a running goal (event type: 5K/10K/half marathon/marathon, target date)
- [x] **GOAL-02**: User can set profile preferences (current weekly mileage, available days per week, display units: km/miles)
- [x] **GOAL-03**: Coach conducts an onboarding chat session to gather context before generating the first plan

### Training Plan

- [x] **PLAN-01**: Coach generates a structured training plan from goal and onboarding context
- [x] **PLAN-02**: Training plan is stored with sessions: week, day, type (EASY/LONG/TEMPO/INTERVAL/RECOVERY/REST/XT), distance, pace target, HR zone
- [x] **PLAN-03**: User can view the training plan as a weekly calendar
- [x] **PLAN-04**: Plan sessions can be marked complete (automatically when a matched run is logged)

### Run Logging

- [ ] **RUN-01**: User can log a run manually (date, distance, duration, avg HR optional, notes optional) from the Training Plan page or the Runs page
- [ ] **RUN-02**: Logged run stored with: date, distance, duration, avg HR (optional), notes (optional), computed pace
- [ ] **RUN-04**: Run linked to the matching active plan day; linked run marks the day completed

### AI Coaching Chat

- [x] **COACH-01**: Chat interface for back-and-forth conversation with the AI coach
- [x] **COACH-02**: Coach responses stream to the UI in real-time (no waiting for full response)
- [x] **COACH-03**: Post-run: coach provides feedback (run summary vs plan, one insight, any plan adjustment)
- [x] **COACH-04**: Coach can adjust the training plan based on run history and conversation
- [x] **COACH-05**: Chat history persists across sessions (user can review past coaching conversations)
- [x] **COACH-06**: Claude context uses rolling 20-message window + condensed memory summary

### Dashboard

- [ ] **DASH-01**: Dashboard shows the current week's training schedule with session status (planned/complete/missed)
- [ ] **DASH-02**: Run history list with key stats per run (date, distance, pace, HR)
- [ ] **DASH-03**: Progress indicator toward the goal event (weeks elapsed, total volume, adherence %)
- [ ] **DASH-04**: Coach chat history is accessible as a dedicated section (separate from active coaching)

### Plan Import

- [ ] **IMP-01**: User can paste raw LLM conversation text containing a training plan
- [ ] **IMP-02**: Claude extracts and normalizes the plan into the standard session schema
- [ ] **IMP-03**: User sees a preview of the parsed plan before it is saved (to catch unit errors or ambiguities)

## v2 Requirements

### Analytics

- **ANLX-01**: HR zone breakdown chart per run
- **ANLX-02**: Weekly volume trend chart (planned vs actual)
- **ANLX-03**: Pace progression over time
- **ANLX-04**: Cadence and stride length trends

### Enhanced Coaching

- **ENCO-01**: Coach proactively surfaces weekly summaries without user prompting
- **ENCO-02**: User can ask coach to re-generate the entire plan mid-cycle
- **ENCO-03**: GPS route display from Apple Health .gpx files

### Quality of Life

- **QOL-01**: Push notifications for upcoming scheduled runs
- **QOL-02**: Export current training plan to PDF or calendar format

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user support | Personal tool — adding users adds auth complexity with no benefit |
| Real-time Apple Watch sync | Export upload covers the use case without API complexity |
| Native mobile app | Web app is sufficient; PWA could be added later |
| Strava / Garmin integrations | Apple Health export is the source of truth |
| Screenshot-based run entry | Structured XML is more reliable; OCR adds complexity |
| Social features | Not relevant to a personal coaching tool |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| TEST-01 | Phase 1.2 | Complete |
| TEST-02 | Phase 1.2 | Complete |
| TEST-03 | Phase 1.2 | Complete |
| TEST-04 | Phase 1.2 | Complete |
| TEST-05 | Phase 1.2 | Complete |
| TEST-06 | Phase 1.2 | Complete |
| GOAL-01 | Phase 2 | Complete |
| GOAL-02 | Phase 2 | Complete |
| GOAL-03 | Phase 2 | Complete |
| PLAN-01 | Phase 2 | Complete |
| PLAN-02 | Phase 2 | Complete |
| PLAN-03 | Phase 2 | Complete |
| PLAN-04 | Phase 2 | Complete |
| RUN-01 | Phase 3 | Pending |
| RUN-02 | Phase 3 | Pending |
| RUN-04 | Phase 3 | Pending |
| COACH-01 | Phase 2 | Complete |
| COACH-02 | Phase 2 | Complete |
| COACH-03 | Phase 3 | Complete |
| COACH-04 | Phase 3 | Complete |
| COACH-05 | Phase 2 | Complete |
| COACH-06 | Phase 2 | Complete |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| IMP-01 | Phase 4 | Pending |
| IMP-02 | Phase 4 | Pending |
| IMP-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 31 total (RUN-03 and RUN-05 removed — ZIP upload approach dropped in Phase 3 rethink 2026-03-29)
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-22 after adding TEST-01 through TEST-06 (Phase 1.2 testing infrastructure)*
