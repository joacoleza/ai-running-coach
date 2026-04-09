# AI Running Coach

<p align="center">
  <img src="web/public/logo-bg.png" alt="AI Running Coach Logo" width="180" />
</p>

![Deploy](https://github.com/joacoleza/ai-running-coach/actions/workflows/azure-static-web-apps.yml/badge.svg)

![CI](https://github.com/joacoleza/ai-running-coach/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-89.2%25-brightgreen)
![API Tests](https://img.shields.io/badge/api_tests-181%2F181-brightgreen)
![Web Tests](https://img.shields.io/badge/web_tests-403%2F403-brightgreen)
![E2E Tests](https://img.shields.io/badge/e2e_tests-55%2F59-red)

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Azure Static Web Apps](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![Powered by Claude](https://img.shields.io/badge/Powered_by-Claude_API-D97757?logo=anthropic&logoColor=white)

A personal web app that acts as an AI running coach. Set a goal, get a training plan, log your runs, and receive coaching feedback that adapts the plan over time.

## What it does

- **Goal setting** — Tell the coach your target race (5K, 10K, half marathon, marathon) and when
- **Onboarding chat** — The coach asks about your current fitness, availability, and history, then generates a personalized training plan
- **Training plan view** — View your plan as phases → weeks → days labeled Day A, Day B, Day C
- **Inline day editing** — Click any day's objective or guidelines to edit in place; add new days to any week
- **Day tracking** — Mark days complete or skipped; undo either action; delete days; convert rest days to runs
- **Chat app control** — Tell the coach to update a day (`<plan:update>`) or add a new session (`<plan:add>`) and changes apply live — no page refresh needed
- **Plan archive** — Close a finished plan and browse all archived plans in a read-only view
- **Run logging** — Log a run manually after each session (date, distance, duration, heart rate, notes); the coach provides feedback and can adjust the plan
- **Run/plan cross-navigation** — Click a completed day's run date to open the run detail; click the Week/Day badge in a run to jump back to that training day
- **Unlink runs** — Detach a logged run from a plan day without losing the run history; the coach can also unlink via `<plan:unlink>` XML commands
- **Adaptive coaching** — The coach adjusts the plan based on how your runs actually go
- **Coach Feedback panel** — Request a written progress assessment directly from the Training Plan page; refreshable at any time
- **Dashboard** — Home page with filter presets (current plan, last 4–12 weeks, this year, all time), stat cards (total distance, runs, time, adherence), weekly volume bar chart, and pace trend line chart; archived plan pages show readonly coaching chat history
- **Mobile-friendly** — Coach panel opens as a full-screen overlay on mobile via a floating action button; inputs use 16px font to prevent iOS auto-zoom

## Built with

Planned and built using [<img src="https://avatars.githubusercontent.com/u/260490621?s=20&v=4" height="16" style="vertical-align:middle"/> Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) and [<img src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg" height="16" style="vertical-align:middle"/> Claude Code](https://claude.ai/code) by Anthropic.

## Stack

| Layer    | Technology                                                |
| -------- | --------------------------------------------------------- |
| Frontend | React + TypeScript + Vite                                 |
| Hosting  | Azure Static Web Apps (free tier)                         |
| Backend  | Azure Functions v4, Node.js 22 (Windows Consumption plan) |
| Database | Azure Cosmos DB for MongoDB (free tier)                   |
| AI       | Claude API (Anthropic)                                    |
| Auth     | Pre-shared password (stored in Azure config)              |

## Personal use only

This app is designed for a single owner. Access is protected by a pre-shared password — set once in Azure configuration.

After 30 consecutive wrong password attempts the app locks itself and shows "Service locked. Contact administrator." — this protects against brute force. To unlock, reset the failure counter in MongoDB (see [docs/useful-commands.md](docs/useful-commands.md)).

## Cost

- Azure infrastructure: **$0/month** (all free tier)
- Claude API: **~$1–3/month** for typical personal usage

## Getting started

**Prerequisites:** Node.js 20+ (22 or 24 work), Docker Desktop, and an [Anthropic Console](https://console.anthropic.com) account (for the `ANTHROPIC_API_KEY` used in local settings and Azure config)

```bash
npm install
cd web && npm install && cd ..
cd api && npm install && cd ..
```

**Configure local settings** — create `api/local.settings.json` (gitignored):

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017",
    "APP_PASSWORD": "localdev123",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  },
  "Host": {
    "CORS": "*"
  }
}
```

**Check everything compiles:**

```bash
cd web && npx tsc --noEmit && cd ..
cd api && npx tsc --noEmit && cd ..
```

**Run tests:**

```bash
# Unit tests (API)
cd api && npx vitest run

# Unit tests (web)
cd web && npx vitest run

# E2E tests — Playwright starts the stack automatically
# If you pre-start the API manually, use: APP_PASSWORD=e2e-test-password npm start (from api/)
npx playwright test
```

**Start local dev server** (Vite + Functions + Docker emulators):

```bash
npm run dev
```

Open the local URL shown in the terminal (typically `http://localhost:5173`).

## Deploying

Merges to `master` are automatically deployed via the [Azure Static Web Apps CI/CD](.github/workflows/azure-static-web-apps.yml) workflow.

**One-time setup** (prerequisites: Azure CLI logged in via `az login`, GitHub CLI authenticated):

1. **Create Azure SWA resource** — Free plan, link to this repo, branch `master`, app location `./web`, API location `api`, output location `dist`

2. **Deployment secret** — Azure automatically creates a repo secret named `AZURE_STATIC_WEB_APPS_API_TOKEN_<resource-name>` when linking the GitHub repo. Ensure the [workflow file](.github/workflows/azure-static-web-apps.yml) references the correct secret name.

3. **Create Cosmos DB database** (requires an existing free-tier Cosmos DB for MongoDB account):

   ```bash
   COSMOS_ACCOUNT_NAME=your-account RESOURCE_GROUP=your-rg ./scripts/setup-cosmos-db.sh
   ```

4. **Set environment variables** — Azure Portal → SWA resource → **Settings → Environment variables** (may appear as "Configuration → Application settings" in older portal versions). Add:
   - `APP_PASSWORD` — the password used to access the app
   - `MONGODB_CONNECTION_STRING` — from Cosmos DB account → **Connection strings** → Primary Connection String
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com) → API Keys

## Roadmap

See [.planning/ROADMAP.md](.planning/ROADMAP.md) for full details.

- ~~**Phase 1** — Infrastructure & Auth (Azure setup, local dev)~~ ✓
- ~~**Phase 1.1** — Replace Auth with Simple Password (pre-shared secret, no OAuth)~~ ✓
- ~~**Phase 1.2** — Testing Strategy & CI (unit, E2E, coverage badges, GitHub Actions)~~ ✓
- ~~**Phase 2** — Coach Chat & Plan Generation (onboarding, Claude streaming, plan gen)~~ ✓
- ~~**Phase 2.1** — Training Plan Redesign (phases/weeks/days, inline editing, archive)~~ ✓
- ~~**Phase 3** — Run Logging & Feedback (manual entry, post-run coaching, plan feedback)~~ ✓
- ~~**Phase 3.1** — Fix Coach Feedback Quality (stale closure, raw XML in feedback)~~ ✓
- ~~**Phase 3.2** — Tech Debt Cleanup (remove dead endpoints, deduplicate SSE loop, fix docs)~~ ✓
- ~~**Phase 3.3** — UI Polish & Mobile Fixes (scroll position, favicon, run/plan linking, mobile Safari)~~ ✓
- ~~**Phase 4** — Dashboard (progress tracking: filter presets, stat cards, Weekly Volume + Pace Trend charts, readonly archived chat history)~~ ✓
