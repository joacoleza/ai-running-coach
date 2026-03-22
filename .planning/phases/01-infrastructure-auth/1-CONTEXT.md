# Phase 1: Infrastructure & Auth - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Working Azure deployment with owner-only access. A React+Vite scaffold is deployed and accessible only to the owner (GitHub account: `joacoleza`). A basic layout shell with sidebar nav and placeholder pages for all four app sections is in place. Nothing feature-functional yet — this phase is the foundation every other phase builds into.

Deliverables per roadmap:
- Azure resource group with Static Web Apps, Functions (Windows Consumption), reused Cosmos DB free-tier account (new database inside it), Blob Storage
- Local dev environment: single `npm run dev` command starts everything (Docker for Cosmos DB + Azurite, Functions Core Tools, SWA CLI via `concurrently`)
- `staticwebapp.config.json` with all routes locked to `owner` role
- GitHub OAuth + role-assignment function validating `OWNER_GITHUB_USERNAME` env var
- CI/CD via GitHub Actions (SWA built-in workflow)
- React + TypeScript + Vite scaffold with sidebar shell deployed and owner-accessible

</domain>

<decisions>
## Implementation Decisions

### Project layout
- **D-01:** Frontend at repo root (`src/`, `vite.config.ts`, `staticwebapp.config.json`)
- **D-02:** Azure Functions in `api/` subfolder (SWA managed functions convention)
- **D-03:** Shared TypeScript types in `shared/` folder — imported by both `src/` and `api/src/` via tsconfig path aliases (`@shared/*`)
- **D-04:** Repo structure:
  ```
  / (root)
  ├── src/              ← React frontend
  ├── api/              ← Azure Functions (Node.js v4)
  ├── shared/           ← Shared TypeScript types
  ├── staticwebapp.config.json
  ├── vite.config.ts
  └── docker-compose.yml
  ```

### Shell layout
- **D-05:** Sidebar navigation, always expanded on desktop, collapsed (icon-only) on mobile
- **D-06:** Four sidebar sections, all present as placeholder pages from Phase 1:
  - `/` → Dashboard (default route after login)
  - `/plan` → Training Plan
  - `/coach` → Coach Chat
  - `/runs` → Runs
- **D-07:** Default route is `/` (Dashboard) — landing page after login

### Authentication
- **D-08:** SWA built-in GitHub OAuth + custom role-assignment function at `/.auth/roles`
- **D-09:** Role: `owner` (not generic `authenticated`) — only `joacoleza` GitHub account gets access
- **D-10:** `OWNER_GITHUB_USERNAME=joacoleza` set as environment variable (not hardcoded)
- **D-11:** `staticwebapp.config.json` routes: all `/*` restricted to `owner` role; 401 redirects to `/.auth/login/github`

### Azure resources
- **D-12:** Resource group: `rg-ai-running-coach`
- **D-13:** Static Web App: `swa-ai-running-coach`
- **D-14:** Cosmos DB: reuse existing free-tier account — create new database `running-coach` inside it (do NOT provision a new account)
- **D-15:** Blob Storage: use the Storage Account already created by Functions (same account, add `health-uploads` container)
- **D-16:** Azure Functions: Windows Consumption plan (managed via SWA Free) — accepted cold starts (~1–3s Node.js), no free alternative avoids them

### Local dev
- **D-17:** `npm run dev` (single command) starts everything via `concurrently`:
  1. `docker compose up` — Cosmos DB Emulator + Azurite (Blob Storage)
  2. `func start` in `api/` — Azure Functions Core Tools
  3. `swa start` — SWA CLI unified proxy (port 4280)
- **D-18:** Docker for local emulators — Cosmos DB: `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator` (official Linux image, most performant on Docker)
- **D-19:** Azurite via Docker (same `docker-compose.yml`)
- **D-20:** SWA CLI handles auth emulation locally (`/.auth/login/github` → mock identity form)

### Claude's Discretion
- Exact sidebar component implementation (icon choices, active state styling)
- Placeholder page content ("coming soon" copy)
- `docker-compose.yml` health check and port configuration details
- `concurrently` command formatting and color coding
- tsconfig path alias configuration specifics

</decisions>

<specifics>
## Specific Ideas

- Cold starts on Functions Consumption are acceptable — personal tool, single user, visited occasionally. Not worth $13/month (App Service B1) to eliminate them.
- Cosmos DB free tier is already claimed in the subscription — planner must NOT provision a new account, only create a new database inside the existing one.
- `shared/` folder avoids type drift between frontend API calls and backend handlers — worth the small tsconfig setup cost.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack and architecture
- `.planning/research/STACK.md` — Full stack decisions: React+Vite, Node.js 22 v4 Functions, Tailwind 4, package versions
- `.planning/research/ARCHITECTURE.md` — Azure service limits, SWA routing, auth implementation pattern, local dev port map, cost estimates

### Requirements
- `.planning/REQUIREMENTS.md` §Authentication — AUTH-01, AUTH-02, AUTH-03 are the only requirements in scope for this phase
- `.planning/ROADMAP.md` §Phase 1 — UAT criteria that must pass before phase is complete

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns all future phases follow

### Integration Points
- `shared/` types defined here will be imported by every future phase
- Sidebar routes defined here become the navigation contract for Phases 2–4 (each phase fills in a placeholder page)
- `staticwebapp.config.json` auth rules defined here are the security boundary for the entire app

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure-auth*
*Context gathered: 2026-03-21*
