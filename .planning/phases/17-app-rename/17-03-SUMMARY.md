---
phase: 17-app-rename
plan: "03"
subsystem: documentation
tags: [rename, docs, readme, claude-md]
dependency_graph:
  requires: []
  provides: [RENAME-01]
  affects: [README.md, CLAUDE.md, .docs/useful-commands.md, .docs/security/2026-04-28.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - README.md
    - CLAUDE.md
    - .docs/useful-commands.md
    - .docs/security/2026-04-28.md
decisions:
  - "Intentional historical reference preserved in README.md GitHub Repository Rename section showing old repo name in migration guide"
metrics:
  duration_seconds: 248
  completed_date: "2026-05-09"
  tasks_completed: 3
  files_modified: 4
requirements:
  - RENAME-01
---

# Phase 17 Plan 03: Documentation Rename Summary

**One-liner:** Updated README.md, CLAUDE.md, and .docs/ files replacing all "AI Running Coach" / "running-coach" / "ai-running-coach" references with "AI Training Coach" / "ai-training-coach" equivalents, and added GitHub repo rename instructions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update README.md | 82d6020 | README.md |
| 2 | Update CLAUDE.md | c53e03a | CLAUDE.md |
| 3 | Update .docs/ files | 963cf4b | .docs/useful-commands.md, .docs/security/2026-04-28.md |

## What Was Done

### Task 1: README.md
- Title changed from `# AI Running Coach` to `# AI Training Coach`
- Logo alt text updated to `AI Training Coach Logo`
- Deploy and CI badge URLs updated to `joacoleza/ai-training-coach`
- Prose updated: "AI running coach" → "AI training coach"; "log your runs" → "log your sessions"
- DB name examples updated: `running-coach.users` → `ai-training-coach.users`
- E2E DB note updated: `running-coach-e2e` → `ai-training-coach-e2e`
- E2E comment in Run tests block updated to reference `ai-training-coach` DB names
- Atlas deploy step updated to reference `ai-training-coach.users` collection
- New "GitHub Repository Rename" section added with `git remote set-url` instructions

### Task 2: CLAUDE.md
- Heading updated from `# Claude Code Guidelines — AI Running Coach` to `# Claude Code Guidelines — AI Training Coach`
- MongoDB DB name architecture note updated: all `running-coach` occurrences → `ai-training-coach`; all `running-coach-e2e` occurrences → `ai-training-coach-e2e`

### Task 3: .docs/ files
- `useful-commands.md`: Docker container name `ai-running-coach-mongodb-1` → `ai-training-coach-mongodb-1`; `use running-coach` → `use ai-training-coach`
- `security/2026-04-28.md`: Title, reviewer line, and executive summary prose updated from "AI Running Coach" to "AI Training Coach" (security findings and technical content unchanged)

## Deviations from Plan

None — plan executed exactly as written.

The only remaining `ai-running-coach` reference across all four files is the intentional migration guide sentence in README.md's "GitHub Repository Rename" section: "The GitHub repository has been renamed from `joacoleza/ai-running-coach` to `joacoleza/ai-training-coach`." This provides the historical context needed for users updating their git remote.

## Known Stubs

None.

## Self-Check: PASSED

Files verified present:
- README.md: FOUND
- CLAUDE.md: FOUND
- .docs/useful-commands.md: FOUND
- .docs/security/2026-04-28.md: FOUND

Commits verified:
- 82d6020: docs(17-03): update README.md to AI Training Coach — FOUND
- c53e03a: docs(17-03): update CLAUDE.md heading and DB name references — FOUND
- 963cf4b: docs(17-03): update .docs/ files to AI Training Coach — FOUND
