# Phase 17: App Rename - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Mechanical rename pass — replace every "running coach" / "ai-running-coach" string with "training coach" / "ai-training-coach" across UI, package metadata, HTML titles, docs, and code examples. No logic changes. Existing env var values (local and production) are NOT touched — they override the code fallback anyway.

</domain>

<decisions>
## Implementation Decisions

### UI Display Strings
- **D-01:** All visible "AI Running Coach" labels → "AI Training Coach" in `LoginPage.tsx`, `ChangePasswordPage.tsx`, `PasswordPage.tsx`, `Sidebar.tsx` (alt text), `Coach.tsx`
- **D-02:** `web/index.html` `<title>` → "AI Training Coach"
- **D-03:** `web/public/unauthorized.html` `<title>` → "AI Training Coach"

### Package Names
- **D-04:** Root `package.json` name → `ai-training-coach`
- **D-05:** `api/package.json` name → `ai-training-coach-api`
- **D-06:** `web/package.json` name → `ai-training-coach-web`

### MongoDB DB Name
- **D-07:** `db.ts` default fallback changes from `'running-coach'` → `'ai-training-coach'`. Existing local and production `MONGODB_CONNECTION_STRING` env vars are NOT changed — they already point at the `running-coach` DB and override the fallback, so no data disruption. New dev setups will pick up the new name by default.
- **D-08:** Repo-committed examples (README instructions, `playwright.config.ts` hardcoded connection string, `global-setup.ts` fallback) update to reflect `ai-training-coach-e2e` / `ai-training-coach` naming. E2E DB names: `running-coach-e2e` → `ai-training-coach-e2e`, `running-coach` (CI fallback comment) → `ai-training-coach`.

### GitHub Repo Rename
- **D-09:** GitHub repo renamed from `joacoleza/ai-running-coach` → `joacoleza/ai-training-coach`. This is a manual step (GitHub Settings → General → Repository name). README badge URLs updated to `joacoleza/ai-training-coach` in this PR. User performs the rename in GitHub UI before or just after merging.
- **D-10:** After rename, update local remote: `git remote set-url origin https://github.com/joacoleza/ai-training-coach.git`

### Code Comments / Docs
- **D-11:** `api/src/shared/prompts.ts` JSDoc comment on line 4 ("AI running coach") → "AI training coach". The system prompt content itself already says "You are an AI training coach" (updated in Phase 13).
- **D-12:** README.md: title, logo alt text, badge URLs, and all prose references updated. DB name examples (`running-coach.users`) → `ai-training-coach.users`.
- **D-13:** `CLAUDE.md` references updated where they mention `running-coach` DB name or the repo name.

### Claude's Discretion
- Worktree directories under `.claude/worktrees/` contain stale copies of these files — do NOT touch them. They are agent isolation artifacts and are gitignored.
- `api/dist/` build artifacts — do NOT touch. They are gitignored and rebuilt on deploy.
- `api/coverage/` and `web/coverage/` — do NOT touch. Gitignored.
- `web/dist/` — do NOT touch. Gitignored.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §RENAME — RENAME-01 is the sole requirement for this phase

### Architecture
- `CLAUDE.md` §Architecture Decisions — "MongoDB DB name is derived from the connection string, not hardcoded" — critical: the fallback in `db.ts` only fires when no path segment is present in `MONGODB_CONNECTION_STRING`

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No new components needed — pure text replacement pass

### Established Patterns
- `db.ts:14` — `connectionString.match(/\/\/[^/]+\/([^/?]+)/)?.[1] || 'running-coach'` — the fallback to change
- `playwright.config.ts:9` — `process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017/running-coach-e2e'` — repo-committed value to update
- `e2e/global-setup.ts:38` — `const dbName = MONGO_URI.match(...)?.[1] || 'running-coach'` — fallback to update

### Integration Points
- `api/package.json` `name` field is used in Azure Functions host configuration — rename is safe, Azure deployment uses the function app name from Azure config, not package.json `name`
- GitHub Actions badge URLs in README reference the repo name — must match post-rename GitHub repo path

</code_context>

<specifics>
## Specific Ideas

- User confirmed: existing `local.settings.json` and production env vars keep their current values (which include "running-coach" DB name) — they are NOT committed to the repo and are not touched by this phase
- GitHub rename: user will perform the rename in GitHub Settings; this PR updates the README URLs to the new repo name so they're correct after the rename
- Guidance for user after merge: `git remote set-url origin https://github.com/joacoleza/ai-training-coach.git`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 17-app-rename*
*Context gathered: 2026-05-09*
