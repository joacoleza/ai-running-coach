# AI Running Coach

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Azure Static Web Apps](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![Powered by Claude](https://img.shields.io/badge/Powered_by-Claude_API-D97757?logo=anthropic&logoColor=white)

A personal web app that acts as an AI running coach. Set a goal, get a training plan, log runs from Apple Watch, and receive coaching feedback that adapts the plan over time.

**Live:** https://mango-hill-0974dda10.6.azurestaticapps.net

## What it does

- **Goal setting** — Tell the coach your target race (5K, 10K, half marathon, marathon) and when
- **Onboarding chat** — The coach asks about your current fitness, availability, and history, then generates a personalized training plan
- **Training calendar** — View your plan week by week with session types, distances, and pace targets
- **Run logging** — Upload an Apple Health export after each run; the coach parses your data and provides feedback
- **Adaptive coaching** — The coach adjusts the plan based on how your runs actually go
- **Dashboard** — Track progress toward your goal, browse run history, and review past coaching conversations
- **Plan import** — Paste a training plan from any LLM conversation and the app will parse and load it

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Hosting | Azure Static Web Apps (free tier) |
| Backend | Azure Functions v4, Node.js 22 (Windows Consumption plan) |
| Database | Azure Cosmos DB (free tier) |
| File storage | Azure Blob Storage |
| AI | Claude API (Anthropic) |
| Auth | SWA built-in GitHub OAuth |

## Personal use only

This app is designed for a single owner. Access is restricted via GitHub OAuth — only the configured GitHub account can log in.

## Cost

- Azure infrastructure: **$0/month** (all free tier)
- Claude API: **~$1–3/month** for typical personal usage

## Getting started

**Prerequisites:** Node.js 22, Docker Desktop, Azure Functions Core Tools v4

> Auth is not emulated locally. Use `http://localhost:5173` (Vite) directly — auth is tested against the deployed Azure environment.

```bash
npm install
cd web && npm install && cd ..
cd api && npm install && cd ..
```

**Check everything compiles:**
```bash
cd web && npx tsc --noEmit && cd ..
cd api && npx tsc --noEmit && cd ..
```

**Run tests:**
```bash
cd web && npx vitest run
```

**Start local dev server** (Vite + Functions + Docker emulators):
```bash
npm run dev
```

Open `http://localhost:5173`.

## Deploying

Merges to `master` are automatically deployed via the [Azure Static Web Apps CI/CD](.github/workflows/azure-static-web-apps.yml) workflow.

**One-time setup** (prerequisites: Azure CLI logged in via `az login`, GitHub CLI authenticated):

1. **Create Azure SWA resource** — Free plan, link to this repo, branch `master`, app location `./web`, API location `api`, output location `dist`

2. **Deployment secret** — Azure automatically creates a repo secret named `AZURE_STATIC_WEB_APPS_API_TOKEN_<resource-name>` when linking the GitHub repo. Ensure the workflow file references the correct secret name.

3. **Assign owner role** — Azure Portal → your SWA resource → Role management → Invite user. Set provider to GitHub, enter your GitHub username, role `owner`. Open the generated invite link to complete the flow.

4. **Create Cosmos DB database** (requires an existing free-tier Cosmos DB account):
   ```bash
   COSMOS_ACCOUNT_NAME=your-account ./scripts/setup-cosmos-db.sh
   ```

## Built with

Planned and built using [Get Your Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) and [Claude Code](https://claude.ai/code) by Anthropic.

## Roadmap

- **Phase 1** — Infrastructure & Auth (Azure setup, GitHub OAuth, local dev)
- **Phase 2** — Coach Chat & Plan Generation (onboarding, Claude streaming, calendar)
- **Phase 3** — Run Logging & Feedback (Apple Health parsing, post-run coaching)
- **Phase 4** — Dashboard & Plan Import (progress tracking, LLM plan import)
