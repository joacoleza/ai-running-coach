# AI Running Coach

## What This Is

A multi-user web app that acts as a personal AI running coach. Each user sets a goal (e.g. a half marathon), the coach asks questions and generates a structured training plan, and after each run the user logs the data so the coach can give feedback and adjust the plan. A dashboard shows training stats, volume charts, and pace trends. User accounts are admin-provisioned — no public registration.

## Core Value

A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened — not generic training templates.

## Current Milestone: v2.0 Multi-User Support

**Goal:** Replace the single-user password gate with per-user JWT authentication and an admin panel for managing users — so multiple people can each have their own independent coaching session, plan, and run history.

**Target features:**
- Email + password login with JWT sessions (JWT_SECRET env var; passwords bcrypt-hashed)
- First-login force-change-password flow
- Admin UI page: list users, add user with auto-generated temp password (shown once), trigger password reset
- Per-user data isolation: plans, runs, and chat history scoped to authenticated user
- Logout / session management
- No public registration — admin provisions all accounts

## Requirements

### Validated

- ✓ App deployed to Azure using free-tier services — v1.1
- ✓ Access restricted to a single authorized user via pre-shared password — v1.1
- ✓ Testing pyramid established (unit → integration → E2E) with CI on every PR — v1.1
- ✓ User can set a running goal (event type, target date, current fitness level) — v1.1
- ✓ Coach asks onboarding questions via chat and generates a training plan — v1.1
- ✓ User can view the training plan as a hierarchical view (phases/weeks/days) — v1.1
- ✓ User can manually log a run (distance, duration, date, notes) — v1.1
- ✓ User can view logged runs in a filterable, paginated Runs list — v1.1
- ✓ Coach receives run history in context and can provide feedback via chat — v1.1
- ✓ Coach can adjust the training plan based on run history — v1.1
- ✓ Dashboard shows run history stats, weekly volume chart, pace trend chart, date-filtered views — v1.1
- ✓ Archived plan chat history is viewable in readonly mode on the Archive page — v1.1
- ✓ Agent can add a new phase/week to the plan via chat — v1.1
- ✓ Agent can update the plan's target race date via chat — v1.1
- ✓ Agent can log a run on the user's behalf via chat — v1.1
- ✓ Agent can save a coaching insight to a run record — v1.1
- ✓ User can add a new phase to the training plan via UI button — v1.1
- ✓ User can edit the target race date inline in the Training Plan header — v1.1

### Active

- [ ] User can upload Apple Health export (ZIP/XML) after each run
- [ ] Coach parses Apple Health data and provides feedback via chat

### Out of Scope

- Multi-user support — personal tool, no auth system beyond a simple gate [moved to v2.0]
- Real-time Apple Watch sync — export upload is sufficient and simpler
- Mobile native app — web app only
- Strava/Garmin integrations — Apple Health export covers the use case
- Screenshot-based run data entry — structured XML export is more reliable
- Plan import from LLM conversation — dropped by user decision (IMP-01/02/03)

## Context

- **Stack:** React + TypeScript + Vite (web), Azure Functions v4 + Node.js 22 (API), MongoDB (Azure Cosmos DB for MongoDB free tier), Claude API (Anthropic), Azure Static Web Apps (hosting)
- **Auth:** Full auth stack complete (Phase 6+7); `AuthContext` + `AuthProvider` + `useAuth()` in frontend; `LoginPage` + `ChangePasswordPage` UI; `App.tsx` auth gate (unauthenticated→LoginPage, tempPassword→ChangePasswordPage, else AppShell); global 401 interceptor with refresh+retry; all hooks (`useChat`, `usePlan`, `useRuns`) use `Authorization: Bearer` headers; Sidebar logout calls `POST /api/auth/logout`. Validated in Phase 7.
- **Test coverage:** 223 API tests, 427 web tests, 66 E2E tests — all green as of Phase 7
- **Agent protocol:** 10 XML tags (`<plan:update>`, `<plan:add>`, `<plan:add-phase>`, `<plan:add-week>`, `<plan:update-goal>`, `<plan:update-feedback>`, `<plan:unlink>`, `<run:create>`, `<run:update-insight>`, `<app:navigate>`) stripped during streaming and applied live
- **Users:** Admin-provisioned accounts only; no signup flows; small closed user base keeps Claude API costs low

## Constraints

- **Deployment:** Azure — use free-tier services wherever possible
- **Multi-user:** Admin-provisioned accounts only; no public registration
- **API cost:** Claude API usage should stay minimal — small number of known users
- **Stack:** Keep it simple — avoid over-engineering for a personal tool

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Apple Health XML export (not screenshot OCR) | Structured data is more reliable; user comfortable with export flow | Pending (not yet implemented) |
| Chat interface for coaching | Natural for open-ended coaching questions and feedback | ✓ Good — used daily |
| Azure free tier deployment | User wants minimal cost; usage will be low (solo) | ✓ Good — $0/month infra |
| Replace GitHub OAuth with pre-shared password (Phase 1.1) | OAuth added friction with no benefit for solo use | ✓ Good — simpler, just as secure |
| Hierarchical plan model: phases → weeks → days (Phase 2.1) | Flat sessions were too rigid for real coaching plans | ✓ Good — flexible and agent-friendly |
| Server-side plan saving in chat.ts (not POST /api/plan/generate) | Eliminates race between stream close and client-fetch | ✓ Good — no race conditions |
| Agent XML tag protocol for plan mutations | Clean separation of display and operations; strippable during streaming | ✓ Good — scales well as new tags added |
| Dashboard as home page (Phase 4) | More useful landing view than the plan itself | ✓ Good — immediate training context |
| Drop plan import from LLM (IMP-01/02/03) | User decided not needed — manual logging + agent is sufficient | ✓ Correct call |
| Global sequential week numbers + A–G day labels (no calendar dates in plan) | Removes timezone complexity; labels are stable across plan edits | ✓ Good — consistent behavior |

## Evolution

This document evolves at phase transitions and milestone boundaries.

Last updated: 2026-04-15 — v2.0 milestone started.

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

---
*Last updated: 2026-04-15 — Phase 6 (Backend Auth Foundation) complete*
