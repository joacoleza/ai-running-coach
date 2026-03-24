# Claude Code Guidelines — AI Running Coach

## Git Workflow

- **Never commit directly to `master`** — it is branch-protected
- Always create a feature branch before starting work: `git checkout -b feature/phase-N-name`
- When a phase is complete, open a PR against `master` using `gh pr create`
- Stop after opening the PR — the user reviews and merges manually via GitHub UI
- **Always ask for confirmation before pushing** — do not push on every small change; batch commits and push only when the user says so
- **ALWAYS rebase onto master before pushing — NO EXCEPTIONS** — run `git fetch origin && git rebase origin/master` immediately before every `git push`. This prevents merge conflicts in PRs. Skipping this causes code conflicts in the PR diff. Do it even if you think the branch is up to date.

## Architecture Decisions

- **MongoDB must be running for the app to work** — if MongoDB is down, all API requests return 503. This is intentional for security. Do NOT add graceful degradation or fallback behavior when MongoDB is unavailable.
- **Azure Functions Core Tools** — `func start` must be run from the `api/` directory. `azure-functions-core-tools@4` is installed as a local dev dependency in `api/` so `npm run start` always uses the correct version from `node_modules/.bin/func` regardless of system PATH. CI installs `azure-functions-core-tools-4` via apt. Do NOT use `npx func start` — it resolves a different unrelated npm package named `func`.
- **`func start` requires `FUNCTIONS_WORKER_RUNTIME=node`** — `local.settings.json` is gitignored, so this env var must be set explicitly in any environment that doesn't have it (CI, Playwright webServer). Without it, `func start` hangs on an interactive runtime selection prompt.
- **E2E tests use `APP_PASSWORD=e2e-test-password`** — when starting the API manually to run E2E tests, set this: `APP_PASSWORD=e2e-test-password npm start` from `api/`. The Playwright webServer config sets it automatically when Playwright manages the server.
- **`ANTHROPIC_API_KEY` must never be set in test environments** — `playwright.config.ts` explicitly sets `ANTHROPIC_API_KEY: ''` in the webServer env. Unit/integration tests mock `@anthropic-ai/sdk` via `vi.mock()`. Never add real API keys to test configs.
- **App commands use `<app:*/>` XML tags** — Claude can emit `<app:navigate page="X"/>` and `<app:complete session_id="Y"/>` at the end of responses. `useChat.ts` strips them from the displayed message and executes them client-side after the stream closes. System prompt (`api/src/shared/prompts.ts`) defines the full protocol and includes upcoming session IDs so Claude can reference them.
- **CoachPanel mobile layout** — `AppShell` owns `coachOpen` state and passes `isOpen`/`onClose` to `CoachPanel`. Mobile: `fixed inset-0 z-50` overlay. Desktop (`md+`): static right column. FAB (`fixed bottom-6 right-6 md:hidden`) in AppShell opens the panel.

## Testing & Documentation

- **Tests are part of execution, not UAT** — creating AND running all test layers (unit, integration, E2E) is part of every phase execution, not optional cleanup. Run `npm test` in `api/` and `web/`, and `npx playwright test` for E2E. Write real test implementations that cover the phase requirements — stubs are placeholders only. Do not ask the user to run tests or treat test results as human UAT items.
- **Review and update README.md** after changes — keep setup instructions, feature list, and any relevant sections accurate
- **Review and update CLAUDE.md** after changes — keep architecture decisions and guidelines current

## GSD Workflow

- This project uses [Get Your Shit Done (GSD)](https://github.com/gsd-build/get-shit-done)
- Planning docs live in `.planning/`
- Phase sequence: plan → execute → PR → (user merges) → next phase
- Run `/gsd:plan-phase N` to plan a phase, `/gsd:execute-phase N` to build it
