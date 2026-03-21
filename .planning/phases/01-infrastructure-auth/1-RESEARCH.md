# Phase 1: Infrastructure & Auth - Research

**Researched:** 2026-03-21
**Domain:** Azure Static Web Apps, GitHub OAuth, Azure Functions v4, local dev toolchain
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Frontend at repo root (`src/`, `vite.config.ts`, `staticwebapp.config.json`)
**D-02:** Azure Functions in `api/` subfolder (SWA managed functions convention)
**D-03:** Shared TypeScript types in `shared/` folder — imported by both `src/` and `api/src/` via tsconfig path aliases (`@shared/*`)
**D-04:** Repo structure:
```
/ (root)
├── src/              ← React frontend
├── api/              ← Azure Functions (Node.js v4)
├── shared/           ← Shared TypeScript types
├── staticwebapp.config.json
├── vite.config.ts
└── docker-compose.yml
```
**D-05:** Sidebar navigation, always expanded on desktop, collapsed (icon-only) on mobile
**D-06:** Four sidebar sections, all present as placeholder pages from Phase 1:
  - `/` → Dashboard (default route after login)
  - `/plan` → Training Plan
  - `/coach` → Coach Chat
  - `/runs` → Runs
**D-07:** Default route is `/` (Dashboard) — landing page after login
**D-08:** SWA built-in GitHub OAuth + custom role-assignment function at `/.auth/roles`
**D-09:** Role: `owner` (not generic `authenticated`) — only `joacoleza` GitHub account gets access
**D-10:** `OWNER_GITHUB_USERNAME=joacoleza` set as environment variable (not hardcoded)
**D-11:** `staticwebapp.config.json` routes: all `/*` restricted to `owner` role; 401 redirects to `/.auth/login/github`
**D-12:** Resource group: `rg-ai-running-coach`
**D-13:** Static Web App: `swa-ai-running-coach`
**D-14:** Cosmos DB: reuse existing free-tier account — create new database `running-coach` inside it
**D-15:** Blob Storage: use the Storage Account already created by Functions (add `health-uploads` container)
**D-16:** Azure Functions: Windows Consumption plan (managed via SWA Free)
**D-17:** `npm run dev` (single command) starts everything via `concurrently`
**D-18:** Docker for local emulators — Cosmos DB: `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview`
**D-19:** Azurite via Docker (same `docker-compose.yml`)
**D-20:** SWA CLI handles auth emulation locally

### Claude's Discretion
- Exact sidebar component implementation (icon choices, active state styling)
- Placeholder page content ("coming soon" copy)
- `docker-compose.yml` health check and port configuration details
- `concurrently` command formatting and color coding
- tsconfig path alias configuration specifics

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | App is accessible only to the owner (single-user gate via GitHub OAuth + SWA custom role) | SWA invitation system + `owner` role route rules in `staticwebapp.config.json`; role assigned via Azure CLI after SWA is deployed |
| AUTH-02 | Unauthenticated requests are redirected to GitHub login | `responseOverrides.401` redirect in `staticwebapp.config.json` |
| AUTH-03 | Owner GitHub username is configurable via environment variable (no hardcoding) | `OWNER_GITHUB_USERNAME` env var in SWA application settings; used only in post-deploy CLI script |
</phase_requirements>

---

## Summary

Phase 1 builds the entire Azure infrastructure and auth foundation. The stack is React + Vite (SPA) deployed to Azure Static Web Apps (Free plan), with managed Azure Functions (Node.js v4) in the `api/` folder, Cosmos DB (free tier), and Blob Storage.

**Critical finding on auth architecture:** The CONTEXT.md decision D-08 references a `/.auth/roles` role-assignment function. Official SWA plans documentation (verified 2026-01-23) explicitly marks "Assign custom roles with a function" as unavailable on the Free plan — it requires the Standard plan ($9/month). The correct approach on Free plan is the **invitation system**: use `az staticwebapp users update` via CLI to assign the `owner` role to the `joacoleza` GitHub account after the SWA resource is created. The `OWNER_GITHUB_USERNAME` env var is consumed by this post-deploy script, not by a runtime function. The `staticwebapp.config.json` enforces the `owner` role requirement regardless of how the role is assigned.

**No role-assignment function is needed.** The owner-only lockdown is a two-step one-time operation: (1) define route rules requiring `owner` role in `staticwebapp.config.json`; (2) run `az staticwebapp users update` once post-deploy to grant `owner` role to `joacoleza`.

Local dev is a single `npm run dev` that starts Docker (Cosmos DB emulator + Azurite) and Functions Core Tools via `concurrently`, with SWA CLI as the unified entry point on port 4280. SWA CLI emulates auth locally via a mock identity form.

**Primary recommendation:** Use the SWA invitation/update system (Free plan compatible) rather than a role-assignment function (Standard plan only). Keep `staticwebapp.config.json` requiring `owner` role on all routes. Assign the role via CLI post-deploy.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.2.4 | UI framework | Chosen in STACK.md |
| `react-dom` | 19.2.4 | React DOM renderer | Pairs with react |
| `react-router-dom` | 7.13.1 | Client-side routing | Standard SPA routing |
| `typescript` | 5.9.3 | Type safety | Shared types across frontend/api |
| `vite` | 8.0.1 | Build tool + dev server | Replaces dead CRA, official Azure docs reference it |
| `@vitejs/plugin-react` | latest | React Fast Refresh in Vite | Standard Vite+React setup |
| `tailwindcss` | 4.2.2 | Utility CSS | Chosen in STACK.md |
| `@tailwindcss/vite` | 4.2.2 | Vite plugin for Tailwind v4 | First-party plugin, replaces PostCSS in v4 |
| `@azure/functions` | 4.11.2 | Azure Functions v4 SDK | Required for v4 programming model |
| `@azure/cosmos` | 4.9.2 | Cosmos DB client | Official Azure SDK |
| `@azure/storage-blob` | 12.31.0 | Blob Storage client | Official Azure SDK |
| `concurrently` | 9.2.1 | Run multiple npm scripts | Single `npm run dev` command |

### Supporting (local dev toolchain, not in `package.json`)

| Tool | Version | Purpose | How to Install |
|------|---------|---------|----------------|
| `@azure/static-web-apps-cli` | 2.0.8 | Local SWA proxy + auth emulation | `npm install -g @azure/static-web-apps-cli` |
| `azure-functions-core-tools` | 4.8.0 | Run Functions locally | `npm install -g azure-functions-core-tools@4` |
| Docker Desktop | latest | Run Cosmos emulator + Azurite | https://www.docker.com/ |
| Azure CLI | latest | `az staticwebapp users update` | https://aka.ms/installazurecli |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SWA invitation system | `/.auth/roles` function | Function approach requires Standard plan ($9/mo); invitation approach is Free and sufficient for 1 user |
| `@tailwindcss/vite` plugin | PostCSS + `tailwind.config.js` | v4 plugin is zero-config, auto-detects content; PostCSS is the v3 pattern |
| `concurrently` | `npm-run-all`, shell `&` | `concurrently` gives colored output and clean process management; widely used |
| `mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview` | Windows Cosmos DB Emulator app | Docker image works cross-platform and in Docker Compose; Windows app has no compose integration |

**Installation (frontend):**
```bash
npm create vite@latest . -- --template react-ts
npm install react-router-dom tailwindcss @tailwindcss/vite
npm install -D concurrently
```

**Installation (api):**
```bash
mkdir api && cd api
npm init -y
npm install @azure/functions @azure/cosmos @azure/storage-blob
npm install -D typescript @types/node
```

**Version verification:** Verified 2026-03-21 via `npm view`:
- `@azure/static-web-apps-cli`: 2.0.8
- `azure-functions-core-tools`: 4.8.0
- `@azure/functions`: 4.11.2
- `vite`: 8.0.1
- `react`: 19.2.4
- `tailwindcss`: 4.2.2
- `typescript`: 5.9.3
- `concurrently`: 9.2.1
- `@azure/cosmos`: 4.9.2
- `@azure/storage-blob`: 12.31.0
- `react-router-dom`: 7.13.1

---

## Architecture Patterns

### Recommended Project Structure

```
/ (repo root)
├── src/                        ← React frontend
│   ├── components/
│   │   ├── layout/             ← AppShell, Sidebar, NavItem
│   │   └── ui/                 ← shared presentational components
│   ├── pages/                  ← Dashboard, Plan, Coach, Runs placeholder pages
│   ├── App.tsx                 ← Router setup
│   ├── main.tsx                ← Entry point
│   └── index.css               ← @import "tailwindcss";
├── api/                        ← Azure Functions
│   ├── src/
│   │   └── functions/          ← one file per function
│   ├── package.json
│   ├── tsconfig.json
│   ├── host.json
│   └── local.settings.json     ← gitignored
├── shared/                     ← Shared TypeScript types
│   └── types/
│       └── index.ts
├── staticwebapp.config.json
├── vite.config.ts
├── tsconfig.json               ← frontend tsconfig (references api tsconfig)
├── swa-cli.config.json
├── docker-compose.yml
└── package.json
```

### Pattern 1: Tailwind v4 with Vite Plugin

**What:** No `tailwind.config.js`, no PostCSS config. Import `tailwindcss` directly as a Vite plugin. Content detection is automatic.
**When to use:** Always for v4 — this is the official setup.
**Example:**
```typescript
// vite.config.ts
// Source: https://tailwindcss.com/docs/installation/vite
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

```css
/* src/index.css */
@import "tailwindcss";
```

### Pattern 2: SWA Route-Based Owner Lockdown

**What:** Lock all routes to `owner` role in `staticwebapp.config.json`. Any GitHub user that authenticates and does NOT have the `owner` role gets a 403, never reaching the app.
**When to use:** The complete auth config for this app.
**Example:**
```json
// staticwebapp.config.json
// Source: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration
{
  "routes": [
    {
      "route": "/.auth/login/github",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/.auth/logout",
      "allowedRoles": ["anonymous", "authenticated"]
    },
    {
      "route": "/api/*",
      "allowedRoles": ["owner"]
    },
    {
      "route": "/*",
      "allowedRoles": ["owner"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/github?post_login_redirect_uri=.referrer",
      "statusCode": 302
    }
  },
  "platform": {
    "apiRuntime": "node:22"
  }
}
```

### Pattern 3: Post-Deploy Role Assignment via Azure CLI

**What:** After SWA is created, run a one-time CLI command to grant the owner GitHub username the `owner` role. This is how owner-only access is achieved on the Free plan (no function required).
**When to use:** Once, after the SWA resource is created and before first access.
**Example:**
```bash
# Source: https://learn.microsoft.com/en-us/cli/azure/staticwebapp/users
# Uses OWNER_GITHUB_USERNAME env var — not hardcoded
az staticwebapp users update \
  --name swa-ai-running-coach \
  --resource-group rg-ai-running-coach \
  --authentication-provider GitHub \
  --user-details "${OWNER_GITHUB_USERNAME}" \
  --roles "owner"
```

Note: `az staticwebapp users update` can assign roles directly without an invitation link. The `--user-details` value is the GitHub username (handle). This command is idempotent — safe to re-run.

### Pattern 4: Azure Functions v4 Structure

**What:** Node.js v4 programming model — function defined with `app.http()`, no `function.json` files needed.
**When to use:** All functions in this project use v4.
**Example:**
```typescript
// api/src/functions/get-role.ts — NOT needed for Free plan auth
// This placeholder shows the v4 pattern for future functions
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

app.http('healthCheck', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    return { status: 200, jsonBody: { status: 'ok' } };
  }
});
```

**host.json for v4:**
```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    }
  }
}
```

### Pattern 5: Local Dev via concurrently

**What:** Single `npm run dev` command starts all local services in parallel.
**When to use:** Every local dev session.
**Example:**
```json
// package.json (root)
{
  "scripts": {
    "dev": "concurrently --names \"docker,func,swa\" --prefix-colors \"cyan,yellow,green\" \"docker compose up\" \"npm run dev:func\" \"npm run dev:swa\"",
    "dev:func": "cd api && func start",
    "dev:swa": "swa start http://localhost:3000 --api-location http://localhost:7071",
    "build": "vite build"
  }
}
```

**swa-cli.config.json:**
```json
{
  "configurations": {
    "ai-running-coach": {
      "appLocation": ".",
      "apiLocation": "api",
      "outputLocation": "dist",
      "appDevserverUrl": "http://localhost:3000",
      "apiDevserverUrl": "http://localhost:7071"
    }
  }
}
```

### Pattern 6: Docker Compose for Local Emulators

**What:** Cosmos DB emulator + Azurite run in Docker. Both started by `docker compose up`.
**When to use:** Local dev only — not deployed to Azure.
**Example:**
```yaml
# docker-compose.yml
services:
  cosmos:
    image: mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview
    ports:
      - "8081:8081"
      - "1234:1234"    # data explorer
    environment:
      ENABLE_EXPLORER: "true"

  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    ports:
      - "10000:10000"  # blob
      - "10001:10001"  # queue
      - "10002:10002"  # table
    command: azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0
```

**local.settings.json (api/) — gitignored:**
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_ENDPOINT": "http://localhost:8081",
    "COSMOS_DB_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b58Oeouq+U3+GqxvM/oIJlcFByXGvA==",
    "COSMOS_DB_DATABASE": "running-coach",
    "BLOB_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "OWNER_GITHUB_USERNAME": "joacoleza"
  }
}
```

The Cosmos DB emulator key shown is the well-known public emulator key — safe to commit. The emulator uses HTTP by default (no certificate setup needed for Node.js SDK).

### Pattern 7: tsconfig Path Aliases for Shared Types

**What:** Both `src/` and `api/src/` can import from `shared/` using `@shared/*` alias.
**When to use:** Any time a type needs to cross the frontend/backend boundary.
**Example:**
```json
// tsconfig.json (root, used by frontend)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"]
    }
  }
}
```
```json
// api/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```
```typescript
// Usage in src/
import type { RunDocument } from '@shared/types';
```

### Pattern 8: GitHub Actions CI/CD (SWA Built-In)

**What:** Azure creates the workflow file automatically when the SWA resource is linked to the GitHub repo. Push to `master` triggers build and deploy.
**When to use:** Created once via Azure Portal or `az staticwebapp create`.
**Key configuration values:**
```yaml
# .github/workflows/azure-static-web-apps-<random>.yml
# Key fields (Azure fills these in):
with:
  app_location: "/"           # root (where package.json is)
  api_location: "api"         # Azure Functions folder
  output_location: "dist"     # Vite build output
  azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
```

### Anti-Patterns to Avoid

- **Using `allowedRoles: ["authenticated"]` for the owner-only gate:** Any GitHub user who signs in gets the `authenticated` role. This locks the app to "GitHub users only" but NOT "specific GitHub user only." Always use a custom role name like `owner`.
- **Trying to implement `rolesSource` function on Free plan:** The `rolesSource` property in `staticwebapp.config.json` under `auth.rolesSource` requires Standard plan. On Free plan it silently fails or is ignored. Use `az staticwebapp users update` instead.
- **Using `func` v3 programming model:** No `function.json` files needed with v4. The v4 model uses `app.http()` directly in TypeScript. Mixing v3 patterns (function.json + module exports) with v4 SDK causes silent failures.
- **Setting `authLevel: 'function'` on SWA managed functions:** SWA managed functions should use `authLevel: 'anonymous'` — route-level auth is enforced by `staticwebapp.config.json`, not function keys.
- **Running Vite dev server directly in browser for auth testing:** Always use `http://localhost:4280` (SWA CLI port), not `http://localhost:3000` (Vite port). Auth routes (`/.auth/*`) only exist on the SWA CLI proxy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub OAuth flow | Custom OAuth exchange | SWA built-in auth | OAuth PKCE, token storage, refresh — all handled; custom OAuth is a security minefield |
| Role assignment | Runtime function checking GitHub username | `az staticwebapp users update` CLI | Function approach requires paid plan; CLI assignment is free, idempotent, and persistent |
| CSS utility framework | Custom CSS | Tailwind v4 | Zero-runtime, auto-purged, v4 is zero-config with Vite |
| SPA routing | Custom history API wrapper | React Router v7 | Handles loaders, layouts, nested routes with mature browser history integration |
| Multi-process dev startup | Shell scripts with `&` | `concurrently` | Process lifecycle management, colored output, cross-platform |
| Blob emulation locally | Mock blob client | Azurite (official MS emulator) | Full API compatibility, runs in Docker |
| Cosmos DB emulation locally | Mock Cosmos client | Cosmos DB Linux emulator (`vnext-preview`) | Official Microsoft image, HTTP mode (no TLS), Docker Compose compatible |

**Key insight:** Every piece of infra boilerplate in this phase has an official Microsoft tool. There is no need to write auth code, OAuth handlers, or custom emulation layers.

---

## Common Pitfalls

### Pitfall 1: Using `rolesSource` function on Free Plan
**What goes wrong:** Developer adds `auth.rolesSource` to `staticwebapp.config.json`, creates a `/.auth/roles` function, deploys — but the role is never assigned because `rolesSource` is a Standard-plan-only feature.
**Why it happens:** Documentation for `rolesSource` doesn't prominently warn about the plan requirement; it appears in general auth docs alongside free-plan content.
**How to avoid:** Use `az staticwebapp users update` to assign `owner` role after deployment. No function needed.
**Warning signs:** User can authenticate with GitHub but gets a 403/redirect loop even after signing in as the correct user.

### Pitfall 2: `allowedRoles: ["authenticated"]` Lets Everyone In
**What goes wrong:** App appears owner-locked because it requires sign-in, but any GitHub account that authenticates gets full access.
**Why it happens:** `authenticated` is the default role given to any signed-in user — it is not owner-specific.
**How to avoid:** Routes must require `"owner"` (or another custom role). Never use `"authenticated"` as the access gate for a personal app.
**Warning signs:** Logging in with a different GitHub account gives full access.

### Pitfall 3: Cosmos DB Emulator TLS in Node.js
**What goes wrong:** Node.js SDK fails to connect to the Cosmos emulator with TLS errors (`SELF_SIGNED_CERT_IN_CHAIN`).
**Why it happens:** The Linux Cosmos emulator defaults to HTTP mode. If `--protocol https` is passed, the self-signed cert is untrusted by Node.js.
**How to avoid:** Do not pass `--protocol https` in the Docker Compose command for local dev. Connect with `http://localhost:8081`. Node.js SDK connects without TLS by default when the endpoint starts with `http://`.
**Warning signs:** `ECONNREFUSED` or TLS certificate errors when running `func start`.

### Pitfall 4: SWA CLI Version Mismatch with Auth Emulation
**What goes wrong:** Mock auth form at `/.auth/login/github` returns errors or doesn't inject the `x-ms-client-principal` header correctly.
**Why it happens:** Known issue in SWA CLI 2.0.2–2.0.4 broke AAD auth emulation. Verify you are on the current release.
**How to avoid:** Use the current installed version (2.0.8 as of 2026-03-21). If auth emulation breaks after an update, check the SWA CLI issues on GitHub.
**Warning signs:** `/.auth/me` returns null clientPrincipal despite going through the mock login form.

### Pitfall 5: Vite `output_location` Mismatch in GitHub Actions Workflow
**What goes wrong:** GitHub Actions builds succeed but the SWA shows a blank page or 404.
**Why it happens:** Vite outputs to `dist/` by default. The workflow's `output_location` must match exactly.
**How to avoid:** Confirm `vite.config.ts` doesn't override `build.outDir`. Set `output_location: "dist"` in the workflow.
**Warning signs:** Deploy succeeds in CI but `https://swa-ai-running-coach.azurestaticapps.net` shows no content.

### Pitfall 6: Functions `authLevel` and SWA Routing
**What goes wrong:** Function returns 401 with "This endpoint requires the function host key" even though the user is authenticated.
**Why it happens:** Developer sets `authLevel: 'function'` on managed functions, expecting SWA auth to be sufficient. SWA auth and function auth are separate layers.
**How to avoid:** Always set `authLevel: 'anonymous'` on all managed functions. The `staticwebapp.config.json` route rule `"/api/*": ["owner"]` handles access control at the SWA proxy level before the request reaches the function.
**Warning signs:** API calls from authenticated browser return 401 with a JSON body about function keys.

### Pitfall 7: `npm run dev` Ordering — Cosmos Emulator Startup Time
**What goes wrong:** `func start` begins before the Cosmos DB emulator is ready, causing connection errors on first startup.
**Why it happens:** `docker compose up` and `func start` run in parallel via `concurrently`. The emulator takes ~10–15 seconds to be ready.
**How to avoid:** Add a Docker Compose health check on the Cosmos container so `docker compose up --wait` blocks until healthy. Alternatively, Functions auto-retry on connection errors.
**Warning signs:** First `npm run dev` session shows Cosmos connection errors that resolve after a few seconds.

---

## Code Examples

### staticwebapp.config.json (complete for Phase 1)
```json
// Source: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration
{
  "routes": [
    {
      "route": "/.auth/login/github",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/.auth/logout",
      "allowedRoles": ["anonymous", "authenticated"]
    },
    {
      "route": "/api/*",
      "allowedRoles": ["owner"]
    },
    {
      "route": "/*",
      "allowedRoles": ["owner"]
    }
  ],
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/github?post_login_redirect_uri=.referrer",
      "statusCode": 302
    }
  },
  "platform": {
    "apiRuntime": "node:22"
  }
}
```

### React Router v7 App Structure (sidebar shell)
```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { TrainingPlan } from './pages/TrainingPlan';
import { Coach } from './pages/Coach';
import { Runs } from './pages/Runs';

export function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/plan" element={<TrainingPlan />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
```

### Azure CLI role assignment (post-deploy script)
```bash
# scripts/assign-owner-role.sh
# Run once after SWA is deployed. OWNER_GITHUB_USERNAME must be set.
# Source: https://learn.microsoft.com/en-us/cli/azure/staticwebapp/users
az staticwebapp users update \
  --name swa-ai-running-coach \
  --resource-group rg-ai-running-coach \
  --authentication-provider GitHub \
  --user-details "${OWNER_GITHUB_USERNAME}" \
  --roles "owner"
```

### Cosmos DB Emulator health check (docker-compose.yml)
```yaml
services:
  cosmos:
    image: mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-preview
    ports:
      - "8081:8081"
      - "1234:1234"
    environment:
      ENABLE_EXPLORER: "true"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/_explorer/emulator.pem"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PostCSS + `tailwind.config.js` | `@tailwindcss/vite` plugin, `@import "tailwindcss"` | Tailwind v4.0 (Jan 2025) | No config file, no PostCSS |
| `function.json` + module.exports (v3 model) | `app.http()` in TypeScript (v4 model) | Azure Functions v4 SDK GA | Cleaner code, TypeScript native, no JSON config files |
| Linux Consumption plan | Windows Consumption plan (for Free tier) | Sep 2025 | Linux Consumption retired for new language versions; Windows remains free |
| Role assignment function (`rolesSource`) | Invitation system / `az staticwebapp users update` | Always been Standard-only | No runtime function needed for single-user owner lockdown |

**Deprecated/outdated:**
- `create-react-app`: Unmaintained since 2023. Use `npm create vite@latest`.
- Linux Consumption plan for new Azure Functions: Retired for new language versions after September 30, 2025. Use Windows Consumption.
- `function.json` in `api/` root: v3 pattern. v4 uses `app.http()` with TypeScript — no JSON files needed.

---

## Open Questions

1. **Cosmos DB emulator vnext-preview stability**
   - What we know: `vnext-preview` tag is the current Linux emulator image. It is in preview and may change.
   - What's unclear: Is there a stable non-preview tag available? The Windows emulator has a well-known stable key; the Linux emulator defaults to the same key.
   - Recommendation: Use `vnext-preview` as specified in D-18. If instability is observed, the team can fall back to the Windows Cosmos DB Emulator installed separately (the well-known key `C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b58Oeouq+U3+GqxvM/oIJlcFByXGvA==` is the same).

2. **`az staticwebapp users update` requires the user to have previously authenticated**
   - What we know: The `az staticwebapp users update` command updates an existing user record. The user must have signed in at least once for the record to exist.
   - What's unclear: Whether `az staticwebapp users invite` + accepting the invite is required first, OR whether `update` can create a record for a user who hasn't logged in yet.
   - Recommendation: The plan should include a step: (1) deploy SWA, (2) owner signs in once (gets `authenticated` role, which grants no access), (3) run `az staticwebapp users update` to add `owner` role. Alternatively, the invitation URL approach works without a prior login — generate invitation, accept it, role is assigned. Document both paths.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (co-located with Vite) |
| Config file | None yet — Wave 0 task |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Routes `/*` and `/api/*` require `owner` role in `staticwebapp.config.json` | Config validation (static check) | Manual — verify JSON schema | ❌ Wave 0 |
| AUTH-01 | `az staticwebapp users update` assigns `owner` role to correct username | Manual smoke test post-deploy | Manual — sign in and verify access | Manual only |
| AUTH-02 | 401 response redirects to `/.auth/login/github` | Config validation (static check) | Manual — verify JSON schema | ❌ Wave 0 |
| AUTH-02 | Unauthenticated browser request lands on GitHub OAuth page | E2E smoke test | Manual — open incognito, hit app URL | Manual only |
| AUTH-03 | Role assignment script uses `OWNER_GITHUB_USERNAME` env var, not a hardcoded string | Code review + grep | `grep -r "joacoleza" api/ src/` should return 0 matches | Manual only |

**Notes:**
- AUTH-01 and AUTH-02 are primarily verified by correct `staticwebapp.config.json` content. A unit test that validates the JSON schema is possible but low value — a review step suffices.
- AUTH-03 is a policy check: no hardcoded username in source code.
- Full automated E2E for auth (browser-based OAuth flow) is out of scope for this phase. Manual smoke tests against the deployed SWA are the gate.

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (TypeScript type check across all packages)
- **Per wave merge:** `npx vitest run` (unit tests, once scaffold exists)
- **Phase gate:** TypeScript compiles clean + manual smoke test confirms owner login works and non-owner is blocked

### Wave 0 Gaps
- [ ] `vitest.config.ts` — configure Vitest with React Testing Library
- [ ] `package.json` test script: `"test": "vitest run"`
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `src/test/setup.ts` — shared test setup importing `@testing-library/jest-dom`

---

## Sources

### Primary (HIGH confidence)
- [Azure Static Web Apps plans comparison](https://learn.microsoft.com/en-us/azure/static-web-apps/plans) — confirmed "Assign custom roles with function" is ✗ on Free plan (updated 2026-01-23)
- [SWA authentication and authorization](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization) — route lockdown patterns, GitHub OAuth setup (updated 2026-01-23)
- [SWA custom authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) — `rolesSource` requires Standard plan, invitation system details (updated 2026-02-25)
- [SWA configuration reference](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration) — `staticwebapp.config.json` schema
- [az staticwebapp users CLI reference](https://learn.microsoft.com/en-us/cli/azure/staticwebapp/users) — `az staticwebapp users update` and `invite` commands (updated 2026-03-03)
- [Azure Functions scale and hosting](https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale) — Windows Consumption plan still free, Linux retired (updated 2026-03-15)
- [Cosmos DB Linux emulator (vnext-preview)](https://learn.microsoft.com/en-us/azure/cosmos-db/emulator-linux) — Docker image, ports, HTTP default, feature support (updated 2025-12-19)
- [Tailwind CSS v4 with Vite installation](https://tailwindcss.com/docs/installation/vite) — `@tailwindcss/vite` plugin, zero-config setup

### Secondary (MEDIUM confidence)
- [Adding auth to Azure Free Tier SWA](https://mattcollinge.wordpress.com/2025/02/08/add-authentication-to-azure-free-tier-static-web-apps/) — confirms invitation approach for owner-only access on free plan (Feb 2025)
- [SWA CLI local development](https://learn.microsoft.com/en-us/azure/static-web-apps/local-development) — auth emulation at `/.auth/login/<provider>`
- npm registry verified versions for all packages listed above

### Tertiary (LOW confidence)
- GitHub issue [Azure/static-web-apps-cli #941](https://github.com/Azure/static-web-apps-cli/issues/941) — auth emulation bug in SWA CLI 2.0.2–2.0.4 (resolved in current 2.0.8)

---

## Metadata

**Confidence breakdown:**
- Auth architecture (invitation vs. rolesSource): HIGH — confirmed from official SWA plans docs, plan feature table is authoritative
- Standard stack versions: HIGH — all verified via `npm view` on 2026-03-21
- Docker Compose / Cosmos emulator: MEDIUM-HIGH — official Microsoft image, vnext-preview tag is the only Linux option
- CI/CD GitHub Actions workflow: HIGH — SWA auto-generates the workflow file on resource creation

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (30 days — stable Azure platform, but check `vnext-preview` emulator for changes)
