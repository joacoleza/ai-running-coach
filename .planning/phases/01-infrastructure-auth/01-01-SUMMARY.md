---
phase: 01-infrastructure-auth
plan: 01
subsystem: infra
tags: [react, vite, tailwindcss, typescript, azure-functions, cosmos-db, azurite, docker, vitest, concurrently]

# Dependency graph
requires: []
provides:
  - React 19 + Vite 8 + TypeScript frontend scaffold at repo root
  - Tailwind v4 via @tailwindcss/vite plugin (no config file)
  - Azure Functions v4 project in api/ with @azure/functions, cosmos, storage-blob SDKs
  - shared/types/index.ts with UserProfile, ClientPrincipal, ApiError, NavRoute interfaces
  - @shared/* path alias wired in both tsconfig.app.json and api/tsconfig.json
  - Vitest + jsdom + @testing-library/react test infrastructure (passWithNoTests)
  - docker-compose.yml for Cosmos DB vnext-preview emulator + Azurite
  - swa-cli.config.json for SWA CLI dev proxy
  - Single npm run dev via concurrently
affects: [01-02, 01-03, all future phases]

# Tech tracking
tech-stack:
  added:
    - react@19.2.4
    - react-dom@19.2.4
    - react-router-dom@7.13.1
    - vite@8.0.1
    - @vitejs/plugin-react@6.0.1
    - tailwindcss@4.2.2
    - "@tailwindcss/vite@4.2.2"
    - typescript@5.9.3
    - "@azure/functions@4.11.2"
    - "@azure/cosmos@4.9.2"
    - "@azure/storage-blob@12.31.0"
    - concurrently@9.2.1
    - vitest@3.2.4
    - "@testing-library/react@16.3.0"
    - "@testing-library/jest-dom@6.6.3"
    - jsdom@26.1.0
  patterns:
    - Tailwind v4 imported via @import "tailwindcss" in index.css (no tailwind.config.js)
    - @shared/* path alias for cross-boundary type sharing
    - API uses Node16 module resolution (required for Azure Functions v4)
    - passWithNoTests in vitest.config so CI passes before first test is written

key-files:
  created:
    - package.json
    - tsconfig.json
    - tsconfig.app.json
    - tsconfig.node.json
    - vite.config.ts
    - vitest.config.ts
    - src/main.tsx
    - src/App.tsx
    - src/index.css
    - src/vite-env.d.ts
    - src/test/setup.ts
    - index.html
    - api/package.json
    - api/tsconfig.json
    - api/host.json
    - api/src/functions/placeholder.ts
    - shared/types/index.ts
    - docker-compose.yml
    - swa-cli.config.json
  modified:
    - .gitignore

key-decisions:
  - "Tailwind v4 with @tailwindcss/vite plugin — no postcss/tailwind.config.js needed"
  - "vitest passWithNoTests: true so CI passes before first test written"
  - "api/src/functions/placeholder.ts required to satisfy tsconfig include with no real functions yet"
  - "api/local.settings.json gitignored per plan; contains OWNER_GITHUB_USERNAME only in this secrets file"

patterns-established:
  - "Pattern: @shared/* alias for shared types between frontend and API"
  - "Pattern: Tailwind v4 import via CSS @import directive, not config file"
  - "Pattern: Azure Functions uses Node16 module + moduleResolution for ESM compatibility"

requirements-completed: [AUTH-03]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 1 Plan 1: Project Scaffold Summary

**React 19 + Vite 8 + Tailwind v4 frontend and Azure Functions v4 API scaffolded with shared TypeScript types, Docker Compose emulators, and Vitest test infrastructure**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-21T23:09:57Z
- **Completed:** 2026-03-21T23:15:34Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Full frontend scaffold: React 19, Vite 8, Tailwind v4 (plugin-based, no config file), TypeScript, react-router-dom
- Azure Functions v4 API project in `api/` with Cosmos DB, Blob Storage, and Azure Functions SDKs
- Shared TypeScript types (`shared/types/index.ts`) importable from both `src/` and `api/src/` via `@shared/*` path alias
- Docker Compose with Cosmos DB vnext-preview emulator and Azurite for local development
- Vitest + jsdom + @testing-library/react test infrastructure passing (exit 0 with no tests yet)
- Single `npm run dev` command via `concurrently` orchestrating docker, Functions, and SWA CLI

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold frontend with Vite + React + Tailwind v4 + Vitest** - `9e57662` (feat)
2. **Task 2: Scaffold API, shared types, Docker Compose, and dev scripts** - `ec0ecb0` (feat)

## Files Created/Modified

- `package.json` - Root package with all frontend/test/tooling deps and dev scripts
- `tsconfig.json` - Project references + @shared/* base paths
- `tsconfig.app.json` - Frontend TypeScript config with @shared/* alias
- `tsconfig.node.json` - Vite config TypeScript settings
- `vite.config.ts` - Vite config with React + Tailwind v4 plugins
- `vitest.config.ts` - Vitest with jsdom + setup file + passWithNoTests
- `src/main.tsx` - React entry point
- `src/App.tsx` - Minimal placeholder component
- `src/index.css` - Tailwind v4 @import directive
- `src/vite-env.d.ts` - Vite client types
- `src/test/setup.ts` - @testing-library/jest-dom import
- `index.html` - HTML entry point
- `api/package.json` - API package with Azure SDKs
- `api/tsconfig.json` - Node16 module resolution + @shared/* alias
- `api/host.json` - Azure Functions host config v2 + extension bundle
- `api/src/functions/placeholder.ts` - Placeholder to satisfy tsconfig include
- `shared/types/index.ts` - UserProfile, ClientPrincipal, ApiError, NavRoute interfaces
- `docker-compose.yml` - Cosmos DB emulator + Azurite containers
- `swa-cli.config.json` - SWA CLI configuration
- `.gitignore` - Added api/node_modules/, api/dist/, api/local.settings.json, .azurite/

## Decisions Made

- **Tailwind v4 plugin approach:** Used `@tailwindcss/vite` plugin and `@import "tailwindcss"` in CSS — no `tailwind.config.js` needed (v4 breaking change from v3).
- **passWithNoTests:** Added to vitest.config.ts so `npx vitest run` exits 0 before any test files exist, satisfying the acceptance criteria.
- **placeholder.ts in api/src/functions/:** TypeScript requires at least one file matching `include: ["src/**/*.ts"]`. Added a minimal placeholder so `npx tsc --noEmit` passes before any real functions are written.
- **api/local.settings.json gitignored:** The file contains `OWNER_GITHUB_USERNAME=joacoleza` but is gitignored — satisfying AUTH-03 (no hardcoded username in source code).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added passWithNoTests to vitest.config.ts**
- **Found during:** Task 1 verification
- **Issue:** `npx vitest run` exits with code 1 when no test files exist. Acceptance criteria required exit 0.
- **Fix:** Added `passWithNoTests: true` to the test config object.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run` now exits 0 with "No test files found, exiting with code 0"
- **Committed in:** `9e57662` (Task 1 commit)

**2. [Rule 3 - Blocking] Created api/src/functions/placeholder.ts**
- **Found during:** Task 2 verification
- **Issue:** `npx tsc --noEmit` in api/ failed with TS18003 "No inputs were found" because `src/**/*.ts` glob matched zero files.
- **Fix:** Created a minimal placeholder TypeScript file with `export {}` so the include glob matches.
- **Files modified:** `api/src/functions/placeholder.ts`
- **Verification:** `cd api && npx tsc --noEmit` now exits 0
- **Committed in:** `ec0ecb0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for verification commands to pass. No scope creep.

## Issues Encountered

- Vite's interactive CLI (`npm create vite@latest . -- --template react-ts`) cancelled when run in repo root because it detected existing files and prompted for confirmation. Resolution: scaffolded to a temp directory to inspect the template, then created all files manually — resulting in identical output plus project-specific customizations.

## User Setup Required

None — no external service configuration required for this scaffold plan. Docker and emulators are configured via docker-compose.yml and will be used in local dev.

## Known Stubs

- `src/App.tsx` — renders only `<div className="p-4">AI Running Coach</div>`. Intentional placeholder; full app layout with sidebar navigation is built in plan 01-02.
- `api/src/functions/placeholder.ts` — empty module to satisfy TypeScript compilation. Will be replaced by real Azure Functions in subsequent plans.

## Next Phase Readiness

- Frontend scaffold builds and type-checks cleanly
- API scaffold type-checks cleanly with Node16 module resolution
- Shared types established and importable from both sides via @shared/*
- Test infrastructure ready for first tests in plan 01-02
- Docker Compose validated for local emulator use
- Ready for plan 01-02: Auth implementation (staticwebapp.config.json + SWA GitHub OAuth)

---
*Phase: 01-infrastructure-auth*
*Completed: 2026-03-21*
