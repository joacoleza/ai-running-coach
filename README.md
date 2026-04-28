# AI Running Coach

<p align="center">
  <img src="web/public/logo-bg.png" alt="AI Running Coach Logo" width="180" />
</p>

![Deploy](https://github.com/joacoleza/ai-running-coach/actions/workflows/azure-static-web-apps.yml/badge.svg)

![CI](https://github.com/joacoleza/ai-running-coach/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-88.6%25-brightgreen)
![API Tests](https://img.shields.io/badge/api_tests-344%2F344-brightgreen)
![Web Tests](https://img.shields.io/badge/web_tests-507%2F507-brightgreen)
![E2E Tests](https://img.shields.io/badge/e2e_tests-88%2F88-brightgreen)

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Azure Static Web Apps](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoftazure&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![Powered by Claude](https://img.shields.io/badge/Powered_by-Claude_API-D97757?logo=anthropic&logoColor=white)

A personal web app that acts as an AI running coach. Set a goal, get a training plan, log your runs, and receive coaching feedback that adapts the plan over time.

## What it does

- **AI coaching chat** — Onboarding conversation generates a personalized training plan; ongoing chat adapts it as your runs progress
- **Training plan** — Phases → weeks → days; mark days complete/skipped, edit objectives inline, add or remove phases and weeks, set a target race date
- **Run logging** — Log runs manually or via chat; each run links to its plan day and stores coaching feedback
- **Dashboard** — Stats (distance, time, adherence), weekly volume and pace charts, with filters by plan or date range
- **Plan archive** — Close finished plans and browse their history with read-only coaching chat replay
- **Admin** — Create accounts, reset passwords, deactivate users; IP-based login rate limiting with progressive lockout

## Built with

Planned and built using [<img src="https://avatars.githubusercontent.com/u/260490621?s=20&v=4" height="16" style="vertical-align:middle"/> Get Shit Done (GSD)](https://github.com/gsd-build/get-shit-done) and [<img src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg" height="16" style="vertical-align:middle"/> Claude Code](https://claude.ai/code) by Anthropic.

## Stack

| Layer    | Technology                                                |
| -------- | --------------------------------------------------------- |
| Frontend | React + TypeScript + Vite                                 |
| Hosting  | Azure Static Web Apps (free tier)                         |
| Backend  | Azure Functions v4, Node.js 22 (Windows Consumption plan) |
| Database | MongoDB Atlas (free tier M0)                              |
| AI       | Claude API (Anthropic)                                    |
| Auth     | JWT (bcrypt passwords, 15-min access tokens, 30-day refresh tokens) |

## Access model

This app is designed for a small, known user base. There is no public registration — accounts are provisioned by an admin via the built-in Admin panel (or directly in MongoDB). Each user has their own fully isolated coaching session, training plan, and run history — no data is shared or visible across accounts. The API enforces per-user scoping at the database query level on every endpoint.

## Cost

- Azure infrastructure: **$0/month** (all free tier)
- MongoDB Atlas: **$0/month** (free tier M0)
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
    "JWT_SECRET": "local-dev-jwt-secret-change-in-production",
    "ANTHROPIC_API_KEY": "sk-ant-..."
  },
  "Host": {
    "CORS": "*"
  }
}
```

**Seed your first user** — start MongoDB (`docker compose up -d mongodb`), then insert this document into the `running-coach.users` collection (via Compass or mongosh). Note: E2E tests use a separate `running-coach-e2e` database so they never touch your dev data.

```js
{
  email: "you@example.com",
  passwordHash: "<bcrypt hash of your chosen password>",
  isAdmin: true,
  tempPassword: true,
  createdAt: new Date(),
  updatedAt: new Date()
}
```

To generate the bcrypt hash: `node -e "require('bcrypt').hash('yourpassword', 10).then(console.log)"` from the `api/` directory.

`tempPassword: true` means the app will prompt you to set a new password on first login.

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
# Stop the dev API server first (port 7071) — if it's already running, Playwright
# reuses it (running-coach DB) while global-setup seeds into running-coach-e2e, causing login failures.
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

3. **Create MongoDB Atlas database** — Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas), create a free M0 cluster, add a database user with read/write access, and allow connections from `0.0.0.0/0` (Network Access).

4. **Set environment variables** — Azure Portal → SWA resource → **Settings → Environment variables** (may appear as "Configuration → Application settings" in older portal versions). Add:
   - `MONGODB_CONNECTION_STRING` — from Atlas cluster → **Connect** → **Drivers** → copy the `mongodb+srv://` connection string
   - `JWT_SECRET` — a long random secret (e.g. `openssl rand -hex 32`)
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com) → API Keys

5. **Seed your first user** — insert the document from the **Seed your first user** step above into your Atlas `running-coach.users` collection. Keep `tempPassword: true` so the user is prompted to set a new password on first login.

## Roadmap

See [.planning/ROADMAP.md](.planning/ROADMAP.md).
