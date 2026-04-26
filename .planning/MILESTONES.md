# Milestones

## v2.0 Multi-User Support (Shipped: 2026-04-26)

**Phases completed:** 6 phases, 17 plans, 27 tasks

**Key accomplishments:**

- User and RefreshToken TypeScript interfaces plus MongoDB collection indexes installed as the data foundation for JWT auth
- Three JWT auth endpoints (login/refresh/logout) with SHA-256 hashed refresh tokens, 15-min JWT access tokens, and 30-day refresh token TTL stored in MongoDB
- 1. [Rule 1 - Bug] Updated 10 test files to use requireAuth mock
- JWT middleware and auth endpoints fully covered: 10 requireAuth tests + 15 login/refresh/logout tests, all requirePassword references eliminated across 8 test files
- tempPassword in login response (D-01):
- JWT auth unit tests rewritten and E2E auth flow fully covered: 427 web unit tests + 66 E2E tests all green after migrating from app_password to access_token auth pattern
- One-liner:
- All 7 protected handler files now filter every MongoDB query by `userId: new ObjectId(userId)`, preventing any cross-user data access at the database level.
- Admin-only REST API (4 endpoints) with active-flag enforcement in every authenticated request and login
- React Admin page with user table, create/reset password modals, sidebar link, /admin route guard, and 7 unit tests
- 8 Playwright E2E tests covering admin panel flows with 4 bug fixes discovered and auto-fixed during implementation
- 1. Responsive admin table (Admin.tsx)
- One-liner:
- One-liner:
- One-liner:

---

## v1.1 Personal AI Running Coach (Shipped: 2026-04-14)

**Phases:** 11 | **Plans:** 50 | **Timeline:** 2026-03-21 → 2026-04-14 (24 days)

**Key accomplishments:**

1. Password-based auth with MongoDB brute-force lockout (replaces GitHub OAuth)
2. Full testing pyramid: unit tests (API + web), E2E with Playwright, GitHub Actions CI with coverage badges
3. Claude-powered coach chat with SSE streaming and persistent message history
4. Training plan generation: hierarchical phases → weeks → days with inline editing and agent-driven updates
5. Run logging with post-run coaching feedback, plan-run linking, and cross-navigation
6. Dashboard with date filters, stat cards (distance, runs, time, adherence), weekly volume + pace trend charts
7. Agent command protocol: add phase/week, update target date, log runs, save coaching insights — all via chat

**Archived:**

- `.planning/milestones/v1.1-ROADMAP.md`
- `.planning/milestones/v1.1-REQUIREMENTS.md`
- `.planning/milestones/v1.1-MILESTONE-AUDIT.md`

---
