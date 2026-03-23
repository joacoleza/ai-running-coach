# Claude Code Guidelines — AI Running Coach

## Git Workflow

- **Never commit directly to `master`** — it is branch-protected
- Always create a feature branch before starting work: `git checkout -b feature/phase-N-name`
- When a phase is complete, open a PR against `master` using `gh pr create`
- Stop after opening the PR — the user reviews and merges manually via GitHub UI
- **Always ask for confirmation before pushing** — do not push on every small change; batch commits and push only when the user says so

## Architecture Decisions

- **MongoDB must be running for the app to work** — if MongoDB is down, all API requests return 503. This is intentional for security. Do NOT add graceful degradation or fallback behavior when MongoDB is unavailable.
- **Azure Functions Core Tools** — `func start` must be run from the `api/` directory. CI installs `azure-functions-core-tools-4` via apt. Locally, use the system `func` or `npx func start` (set in the `start` script).
- **`func start` requires `FUNCTIONS_WORKER_RUNTIME=node`** — `local.settings.json` is gitignored, so this env var must be set explicitly in any environment that doesn't have it (CI, Playwright webServer). Without it, `func start` hangs on an interactive runtime selection prompt.
- **E2E tests use `APP_PASSWORD=e2e-test-password`** — when starting the API manually to run E2E tests, set this: `APP_PASSWORD=e2e-test-password npm start` from `api/`. The Playwright webServer config sets it automatically when Playwright manages the server.

## Testing & Documentation

- **Always run tests after making changes** — `npm test` in `api/` and `web/` to validate work before committing
- **Review and update README.md** after changes — keep setup instructions, feature list, and any relevant sections accurate
- **Review and update CLAUDE.md** after changes — keep architecture decisions and guidelines current

## GSD Workflow

- This project uses [Get Your Shit Done (GSD)](https://github.com/gsd-build/get-shit-done)
- Planning docs live in `.planning/`
- Phase sequence: plan → execute → PR → (user merges) → next phase
- Run `/gsd:plan-phase N` to plan a phase, `/gsd:execute-phase N` to build it
