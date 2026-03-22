# AI Running Coach

## What This Is

A personal web app — accessible only to the owner — that acts as an AI running coach. The user sets a goal (e.g. a half marathon), the coach asks questions and generates a training plan, and after each run the user uploads Apple Health data so the coach can give feedback and adjust the plan. A dashboard shows the training calendar, run history, and progress toward the goal.

## Core Value

A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened — not generic training templates.

## Requirements

### Validated

- [x] App is deployed to Azure using free-tier services (Azure Functions + free DB) — Validated in Phase 1: Infrastructure & Auth
- [x] Access is restricted to a single authorized user — Validated in Phase 1: Infrastructure & Auth

### Active

- [ ] User can set a running goal (event type, target date, current fitness level)
- [ ] Coach asks onboarding questions via chat and generates a training plan
- [ ] User can view the training plan as a weekly calendar
- [ ] User can upload Apple Health export (ZIP/XML) after each run
- [ ] Coach parses run data and provides feedback via chat
- [ ] Coach adjusts the training plan based on run history
- [ ] Dashboard shows plan calendar, run history/stats, and progress toward goal
- [ ] Coach chat history is accessible as a dedicated section
- [ ] User can import a training plan from raw LLM conversation text (Claude parses and structures it)

### Out of Scope

- Multi-user support — this is a personal tool, no auth system needed beyond a simple gate
- Real-time Apple Watch sync — export upload is sufficient and simpler
- Mobile native app — web app only for v1
- Strava/Garmin integrations — Apple Health export covers the use case
- Screenshot-based run data entry — structured XML export is more reliable

## Context

- Solo user — authentication can be minimal (e.g. a shared secret or Azure Static Web Apps built-in auth)
- Apple Health export format: a ZIP file containing `export.xml` with structured workout data (distance, pace, heart rate, splits, duration)
- Azure free tier targets: Azure Functions (consumption plan, 1M free executions/month), Cosmos DB free tier (1000 RU/s, 25 GB), or Azure Static Web Apps (free hosting)
- AI coaching powered by the Claude API (Anthropic) — conversational chat interface
- Plan import: user pastes raw LLM conversation text, the app extracts and structures the training plan

## Constraints

- **Deployment**: Azure — use free-tier services wherever possible (Functions, Cosmos DB or Azure SQL free tier, Static Web Apps)
- **Single user**: No need for multi-user auth, user management, or signup flows
- **API cost**: Claude API usage should be minimal — just one user, occasional sessions
- **Stack**: Keep it simple — avoid over-engineering for a personal tool

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Apple Health XML export (not screenshot OCR) | Structured data is more reliable; user comfortable with export flow | — Pending |
| Chat interface for coaching | Natural for open-ended coaching questions and feedback | — Pending |
| Azure free tier deployment | User wants minimal cost; usage will be low (solo) | — Pending |
| Plan import via raw text paste | Simple, no special format required; Claude parses it | — Pending |
| Frontend in `web/` (not repo root) | Keeps root clean; symmetric with `api/` and `shared/` | Confirmed Phase 1 |
| No SWA CLI in local dev | Auth emulation added friction with no real benefit; auth tested against deployed Azure | Confirmed Phase 1 |
| SWA Free plan uses `az staticwebapp users update` for role assignment (not a runtime function) | Runtime role-assignment functions require Standard plan ($9/mo) | Confirmed Phase 1 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current State

Phase 1 complete — Azure SWA infrastructure, GitHub OAuth with owner-only access, React+Vite scaffold, and local dev environment are all in place. Ready for Phase 2 (Coach Chat & Plan Generation).

---
*Last updated: 2026-03-22 after Phase 1: Infrastructure & Auth*
