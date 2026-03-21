---
phase: 01-infrastructure-auth
plan: 03
subsystem: api-cicd
tags: [azure-functions, github-actions, cicd, health-check, scripts]
dependency_graph:
  requires: [01-01]
  provides: [health-endpoint, cicd-pipeline, owner-role-script, cosmos-db-script]
  affects: [deployment, azure-swa]
tech_stack:
  added: []
  patterns: [azure-functions-v4-http, github-actions-swa-deploy, bash-env-var-scripts]
key_files:
  created:
    - api/src/functions/health.ts
    - .github/workflows/azure-static-web-apps.yml
    - scripts/assign-owner-role.sh
    - scripts/setup-cosmos-db.sh
  modified: []
decisions:
  - "authLevel: 'anonymous' on health function — SWA route rules enforce owner role at proxy level (research anti-pattern: never use 'function' authLevel on managed functions)"
  - "Pre-build step in CI runs 'cd api && npm ci && npm run build' before SWA deploy to compile TypeScript functions"
  - "assign-owner-role.sh uses ${OWNER_GITHUB_USERNAME} env var — satisfies AUTH-03, no hardcoded username"
  - "setup-cosmos-db.sh requires COSMOS_ACCOUNT_NAME env var — existing free-tier account, creates 'running-coach' DB inside it (D-14)"
metrics:
  duration: 5 min
  completed: "2026-03-22"
  tasks_completed: 3
  files_created: 4
---

# Phase 01 Plan 03: API Health Check, CI/CD Workflow, and Post-Deploy Scripts Summary

**One-liner:** Azure Functions v4 health endpoint, GitHub Actions SWA deploy workflow, and env-var-driven post-deploy scripts for owner role assignment and Cosmos DB setup.

## What Was Built

This plan completes the deployment pipeline for Phase 1:

1. **Health check API function** (`api/src/functions/health.ts`) — Azure Functions v4 `app.http()` model, anonymous authLevel (SWA proxy enforces auth), returns `{ status, timestamp, version }` JSON at `/api/health`.

2. **GitHub Actions CI/CD workflow** (`.github/workflows/azure-static-web-apps.yml`) — triggers on push to master and PRs; pre-builds the API TypeScript (`cd api && npm ci && npm run build`) then deploys via `Azure/static-web-apps-deploy@v1` with `app_location: "/"`, `api_location: "api"`, `output_location: "dist"`.

3. **Owner role assignment script** (`scripts/assign-owner-role.sh`) — one-time post-deploy script; reads `OWNER_GITHUB_USERNAME` from env (satisfies AUTH-03), calls `az staticwebapp users update` to assign `owner` role. Validates env var and fails fast with usage message.

4. **Cosmos DB setup script** (`scripts/setup-cosmos-db.sh`) — creates the `running-coach` database inside an existing free-tier Cosmos DB account (D-14, avoids provisioning a new account). Requires `COSMOS_ACCOUNT_NAME` env var.

## Verification Results

- `cd api && npx tsc --noEmit` — PASS (health function compiles with v4 model)
- `npx vitest run` — PASS (3 tests, Sidebar tests still passing)
- `npx tsc --noEmit` (frontend) — PASS
- `bash -n scripts/assign-owner-role.sh` — PASS
- `bash -n scripts/setup-cosmos-db.sh` — PASS
- `grep -r "joacoleza" scripts/ .github/ api/src/ src/ shared/` — 0 matches (AUTH-03 satisfied)
- Workflow contains `static-web-apps-deploy`, `app_location`, `output_location: "dist"` — PASS

## Checkpoint: Task 3 (human-verify)

Auto-approved (auto_advance=true). Automated verification confirms:
- API compiles with TypeScript strict mode
- All Sidebar tests pass
- No hardcoded usernames in any source files

Manual steps for user when deploying:
1. Create SWA resource in Azure Portal (Free plan, link GitHub repo)
2. Add `AZURE_STATIC_WEB_APPS_API_TOKEN` as a GitHub repo secret
3. Run `OWNER_GITHUB_USERNAME=yourusername ./scripts/assign-owner-role.sh` after first deploy
4. Run `COSMOS_ACCOUNT_NAME=your-account ./scripts/setup-cosmos-db.sh` to create the database

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates infrastructure files only. No UI stubs or placeholder data flows.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create API health check function | 00404f3 | api/src/functions/health.ts |
| 2 | Create GitHub Actions workflow and post-deploy scripts | 49012b5 | .github/workflows/azure-static-web-apps.yml, scripts/assign-owner-role.sh, scripts/setup-cosmos-db.sh |
| 3 | Verify local dev environment (auto-approved) | — | N/A |

## Self-Check: PASSED

- api/src/functions/health.ts: FOUND
- .github/workflows/azure-static-web-apps.yml: FOUND
- scripts/assign-owner-role.sh: FOUND
- scripts/setup-cosmos-db.sh: FOUND
- Commit 00404f3: FOUND
- Commit 49012b5: FOUND
