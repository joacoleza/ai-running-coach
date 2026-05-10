# Phase 17: App Rename - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 17-app-rename
**Areas discussed:** MongoDB DB name, GitHub repo rename

---

## MongoDB DB Name

| Option | Description | Selected |
|--------|-------------|----------|
| Rename fallback + update local connection string | Change default to `ai-training-coach`, pin local.settings.json to `running-coach` path | |
| Rename fallback only | Change default, accept manual DB rename needed | |
| Keep fallback as `running-coach` | Don't touch db.ts; DB name is internal only | |
| Env-var driven (user's choice) | Keep existing env var values unchanged; only update repo examples | ✓ |

**User's choice:** Env vars (local and production) stay unchanged since they already point at the correct DBs. The fallback in `db.ts` changes for new instances. Repo-committed examples (README, playwright.config.ts, global-setup.ts) update to the new naming. Any new dev setup gets `ai-training-coach` by default; existing setups are unaffected.

**Notes:** User explicitly said "I would have them as env variables. Locally and in prd the env variables values should be the same as before (contain the running word), but the example in the repo should not. Any new instances will not contain it, but existing ones will."

---

## GitHub Repo Rename

| Option | Description | Selected |
|--------|-------------|----------|
| Include in this phase | Update README badge URLs to new repo name; user renames in GitHub Settings | ✓ |
| Skip / later | Leave GitHub repo as-is; rename code only | |

**User's choice:** Include in this phase. User will rename the repo in GitHub Settings (Settings → General → Repository name → `ai-training-coach`). README badge URLs updated in this PR. After merge, user runs: `git remote set-url origin https://github.com/joacoleza/ai-training-coach.git`.

**Notes:** User confirmed they want to rename and requested guidance on how to do it.

---

## Claude's Discretion

- Worktree directories under `.claude/worktrees/` — stale agent copies, do not touch
- Build artifacts (`api/dist/`, `web/dist/`) — gitignored, do not touch
- `local.settings.json` — gitignored, do not touch

## Deferred Ideas

None.
