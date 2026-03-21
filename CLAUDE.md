# Claude Code Guidelines — AI Running Coach

## Git Workflow

- **Never commit directly to `master`** — it is branch-protected
- Always create a feature branch before starting work: `git checkout -b feature/phase-N-name`
- When a phase is complete, open a PR against `master` using `gh pr create`
- Stop after opening the PR — the user reviews and merges manually via GitHub UI

## GSD Workflow

- This project uses [Get Your Shit Done (GSD)](https://github.com/gsd-build/get-shit-done)
- Planning docs live in `.planning/`
- Phase sequence: plan → execute → PR → (user merges) → next phase
- Run `/gsd:plan-phase N` to plan a phase, `/gsd:execute-phase N` to build it
