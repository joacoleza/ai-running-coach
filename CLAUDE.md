# Claude Code Guidelines — AI Running Coach

## Git Workflow

- **Never commit directly to `master`** — it is branch-protected
- Always create a feature branch before starting work: `git checkout -b feature/phase-N-name`
- When a phase is complete, open a PR against `master` using `gh pr create`
- Stop after opening the PR — the user reviews and merges manually via GitHub UI

## Architecture Decisions

- **MongoDB must be running for the app to work** — if MongoDB is down, all API requests return 503. This is intentional for security. Do NOT add graceful degradation or fallback behavior when MongoDB is unavailable.
- **Azure Functions Core Tools** — the system-installed `func` binary may be outdated. The project pins `azure-functions-core-tools@4` as a devDependency in `api/package.json`. Always use `npx func start` (already set in the `start` script) — never rely on the global `func` in PATH.

## GSD Workflow

- This project uses [Get Your Shit Done (GSD)](https://github.com/gsd-build/get-shit-done)
- Planning docs live in `.planning/`
- Phase sequence: plan → execute → PR → (user merges) → next phase
- Run `/gsd:plan-phase N` to plan a phase, `/gsd:execute-phase N` to build it
