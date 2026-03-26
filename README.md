# AI Running Coach

![Deploy](https://github.com/joacoleza/ai-running-coach/actions/workflows/azure-static-web-apps.yml/badge.svg)


![CI](https://github.com/joacoleza/ai-running-coach/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-81.5%25-brightgreen)
![API Tests](https://img.shields.io/badge/api_tests-90%2F90-brightgreen)
![Web Tests](https://img.shields.io/badge/web_tests-187%2F187-brightgreen)
![E2E Tests](https://img.shields.io/badge/e2e_tests-37%2F37-brightgreen)

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Azure Static Web Apps](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![Powered by Claude](https://img.shields.io/badge/Powered_by-Claude_API-D97757?logo=anthropic&logoColor=white)

A personal web app that acts as an AI running coach. Set a goal, get a training plan, log runs from Apple Watch, and receive coaching feedback that adapts the plan over time.

## What it does

- **Goal setting** — Tell the coach your target race (5K, 10K, half marathon, marathon) and when
- **Onboarding chat** — The coach asks about your current fitness, availability, and history, then generates a personalized training plan
- **Training plan view** — View your plan as phases → weeks → days with dates shown as "Monday 2025-04-28"
- **Inline day editing** — Click any day's objective or guidelines to edit in place; click the date label to reschedule; add new days to any week
- **Day tracking** — Mark days complete or skipped; undo either action; delete days; convert rest days to runs
- **Chat app control** — Tell the coach to update a day and it applies `<plan:update>` patches live — no page refresh needed
- **Plan archive** — Close a finished plan and browse all archived plans in a read-only view
- **Run logging** — Upload an Apple Health export after each run; the coach parses your data and provides feedback
- **Adaptive coaching** — The coach adjusts the plan based on how your runs actually go
- **Dashboard** — Track progress toward your goal, browse run history, and review past coaching conversations
- **Mobile-friendly** — Coach panel opens as a full-screen overlay on mobile via a floating action button

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Hosting | Azure Static Web Apps (free tier) |
| Backend | Azure Functions v4, Node.js 22 (Windows Consumption plan) |
| Database | Azure Cosmos DB for MongoDB (free tier) |
| File storage | Azure Blob Storage |
| AI | Claude API (Anthropic) |
| Auth | Pre-shared password (stored in Azure config) |

## Personal use only

This app is designed for a single owner. Access is protected by a pre-shared password — set once in Azure configuration.

After 30 consecutive wrong password attempts the app locks itself and shows "Service locked. Contact administrator." — this protects against brute force. To unlock, reset the failure counter in MongoDB (see [Useful commands](#useful-commands)).

## Cost

- Azure infrastructure: **$0/month** (all free tier)
- Claude API: **~$1–3/month** for typical personal usage

## Getting started

**Prerequisites:** Node.js 20+ (22 or 24 work), Docker Desktop

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
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
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

## Useful commands

**Check lockout state:**
```bash
docker exec ai-running-coach-mongodb-1 mongosh running-coach --quiet --eval "db.getCollection('auth').find().toArray()"
```

**Unlock the app (PowerShell):**
```powershell
docker exec ai-running-coach-mongodb-1 mongosh running-coach --quiet --eval "db.getCollection('auth').updateOne({_id:'lockout'},{`$set:{failureCount:0,blocked:false}})"
```

**Unlock the app (bash):**
```bash
docker exec ai-running-coach-mongodb-1 mongosh running-coach --quiet --eval "db.getCollection('auth').updateOne({_id:'lockout'},{\$set:{failureCount:0,blocked:false}})"
```

## Deploying

Merges to `master` are automatically deployed via the [Azure Static Web Apps CI/CD](.github/workflows/azure-static-web-apps.yml) workflow.

**One-time setup** (prerequisites: Azure CLI logged in via `az login`, GitHub CLI authenticated):

1. **Create Azure SWA resource** — Free plan, link to this repo, branch `master`, app location `./web`, API location `api`, output location `dist`

2. **Deployment secret** — Azure automatically creates a repo secret named `AZURE_STATIC_WEB_APPS_API_TOKEN_<resource-name>` when linking the GitHub repo. Ensure the [workflow file](.github/workflows/azure-static-web-apps.yml) references the correct secret name.

3. **Set environment variables** — Azure Portal → SWA resource → **Settings → Environment variables** (may appear as "Configuration → Application settings" in older portal versions). Add:
   - `APP_PASSWORD` — the password used to access the app
   - `MONGODB_CONNECTION_STRING` — from Cosmos DB account → **Connection strings** → Primary Connection String
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com) → API Keys

4. **Create Cosmos DB database** (requires an existing free-tier Cosmos DB for MongoDB account):
   ```bash
   COSMOS_ACCOUNT_NAME=your-account RESOURCE_GROUP=your-rg ./scripts/setup-cosmos-db.sh
   ```

## Built with

Planned and built using [Get Your Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) and [Claude Code](https://claude.ai/code) by Anthropic.

## Roadmap

- ~~**Phase 1** — Infrastructure & Auth (Azure setup, local dev)~~ ✓
- ~~**Phase 1.1** — Replace Auth with Simple Password (pre-shared secret, no OAuth)~~ ✓
- ~~**Phase 1.2** — Testing Strategy & CI (unit tests, E2E, coverage badges, GitHub Actions)~~ ✓
- ~~**Phase 2** — Coach Chat & Plan Generation (onboarding, Claude streaming, calendar, file import, bug fixes + tests)~~ ✓
- ~~**Phase 2.1** — Training Plan Redesign (hierarchical phases/weeks/days, inline editing, archive, plan:update protocol)~~ ✓
- ~~**Phase 2.1 UAT fixes** — Undo skip/complete, delete day, add run to rest day, day-name dates, chat scroll, plan:update live refresh, XML stripped from history, sidebar fixed height~~ ✓
- **Phase 3** — Run Logging & Feedback (Apple Health parsing, post-run coaching)
- **Phase 4** — Dashboard & Plan Import (progress tracking, LLM plan import)
