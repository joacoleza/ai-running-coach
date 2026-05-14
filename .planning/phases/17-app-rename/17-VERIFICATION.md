---
phase: 17-app-rename
verified: 2026-05-09T21:25:00Z
status: passed
score: 30/30 must-haves verified
gaps: []
human_verification:
  - test: "Visually inspect the browser tab title in a running dev instance"
    expected: "Browser tab reads 'AI Training Coach'"
    why_human: "Tab title from index.html is verified in source but not visually confirmed without a browser"
  - test: "Visit the login page in a browser and confirm the h1 heading"
    expected: "Heading reads 'AI Training Coach'"
    why_human: "React rendering of the h1 cannot be confirmed without a running instance"
---

# Phase 17: App Rename Verification Report

**Phase Goal:** Rename the app from "AI Running Coach" to "AI Training Coach" — update all user-visible strings, package metadata, DB name defaults, test fixtures, and documentation files to reflect the new name consistently.
**Verified:** 2026-05-09T21:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

#### Plan 01 — Frontend UI Strings

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Browser tab title shows 'AI Training Coach' | VERIFIED | `web/index.html` line 13: `<title>AI Training Coach</title>` |
| 2 | Login screen h1 reads 'AI Training Coach' | VERIFIED | `LoginPage.tsx` line 79: heading text confirmed |
| 3 | Change-password screen h1 reads 'AI Training Coach' | VERIFIED | `ChangePasswordPage.tsx` line 79: heading text confirmed |
| 4 | Password screen h1 reads 'AI Training Coach' | VERIFIED | `PasswordPage.tsx` line 44: heading text confirmed |
| 5 | Sidebar logo img alt text reads 'AI Training Coach' | VERIFIED | `Sidebar.tsx` line 45: `alt="AI Training Coach"` |
| 6 | Coach page subtitle no longer contains 'running coach' | VERIFIED | `Coach.tsx` line 5: "Chat with your AI training coach here." |
| 7 | unauthorized.html page title reads 'AI Training Coach' | VERIFIED | `web/public/unauthorized.html` line 6: `<title>Access Denied — AI Training Coach</title>` |
| 8 | Web unit test assertion matches new heading | VERIFIED | `App.auth.test.tsx` lines 14+16: `'AI Training Coach'` |

#### Plan 02 — Package Metadata, DB Defaults, Test Infrastructure

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | Root package.json name field is 'ai-training-coach' | VERIFIED | `package.json` line 2: `"name": "ai-training-coach"` |
| 10 | api/package.json name field is 'ai-training-coach-api' | VERIFIED | `api/package.json` line 2: `"name": "ai-training-coach-api"` |
| 11 | web/package.json name field is 'ai-training-coach-web' | VERIFIED | `web/package.json` line 2: `"name": "ai-training-coach-web"` |
| 12 | db.ts fallback DB name is 'ai-training-coach' | VERIFIED | `api/src/shared/db.ts` line 14: `\|\| 'ai-training-coach'` |
| 13 | prompts.ts JSDoc says 'AI training coach' | VERIFIED | `api/src/shared/prompts.ts` line 4: `Build the system prompt for the AI training coach.` |
| 14 | playwright.config.ts E2E DB uses 'ai-training-coach-e2e' | VERIFIED | `playwright.config.ts` line 9: `mongodb://localhost:27017/ai-training-coach-e2e` |
| 15 | global-setup.ts DB name fallback is 'ai-training-coach' | VERIFIED | `e2e/global-setup.ts` line 5+38: URI default and dbName fallback both updated |
| 16 | auth.spec.ts heading assertion matches 'AI Training Coach' | VERIFIED | `e2e/auth.spec.ts` line 18: `getByRole('heading', { name: 'AI Training Coach' })` |
| 17 | auth.spec.ts DB fallbacks use 'ai-training-coach-e2e' and 'ai-training-coach' | VERIFIED | `e2e/auth.spec.ts` lines 154+158 confirmed |
| 18 | All 15 API integration test files use 'ai-training-coach' | VERIFIED | grep found 0 'running-coach' refs; 15 files confirmed with 'ai-training-coach' |
| 19 | API unit tests pass with no regressions | VERIFIED | `cd api && npx vitest run`: 34 test files, 396 tests — all passed |

#### Plan 03 — Documentation

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 20 | README.md title reads '# AI Training Coach' | VERIFIED | `README.md` line 1 confirmed |
| 21 | README.md logo alt text reads 'AI Training Coach Logo' | VERIFIED | `README.md` line 4 confirmed |
| 22 | README.md badge URLs reference 'joacoleza/ai-training-coach' | VERIFIED | `README.md` lines 7+9: both badge URLs updated |
| 23 | README.md prose contains no references to 'running coach' | VERIFIED | grep for "running coach\|Running Coach" in README.md returned no output |
| 24 | README.md DB name examples use 'ai-training-coach' | VERIFIED | Lines 84, 119, 148: all DB references updated |
| 25 | README.md includes GitHub repo rename instructions | VERIFIED | `README.md` line 150: "## GitHub Repository Rename" section present |
| 26 | CLAUDE.md architecture notes use 'ai-training-coach' | VERIFIED | `CLAUDE.md` line 15: all DB name references updated |
| 27 | CLAUDE.md heading is 'AI Training Coach' | VERIFIED | `CLAUDE.md` line 1: `# Claude Code Guidelines — AI Training Coach` |
| 28 | .docs/useful-commands.md uses 'ai-training-coach' | VERIFIED | Lines 6+14: docker container name and `use ai-training-coach` updated |
| 29 | .docs/security/2026-04-28.md title and prose updated | VERIFIED | Line 1: `# Security Review — AI Training Coach`; line 32+40 confirmed |

#### Test Suite Results

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 30 | Web tests (635) and API tests (396) all pass | VERIFIED | Web: 44 files, 635 tests — all passed. API: 34 files, 396 tests — all passed |

**Score:** 30/30 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/src/pages/LoginPage.tsx` | Login page heading | VERIFIED | Contains "AI Training Coach" |
| `web/src/pages/ChangePasswordPage.tsx` | Change password heading | VERIFIED | Contains "AI Training Coach" |
| `web/src/pages/PasswordPage.tsx` | Password page heading | VERIFIED | Contains "AI Training Coach" |
| `web/src/components/layout/Sidebar.tsx` | Sidebar logo alt text | VERIFIED | Contains "AI Training Coach" |
| `web/src/pages/Coach.tsx` | Coach page subtitle | VERIFIED | Contains "training coach" |
| `web/index.html` | Browser tab title | VERIFIED | Contains "AI Training Coach" |
| `web/public/unauthorized.html` | Unauthorized page title | VERIFIED | Contains "AI Training Coach" |
| `web/src/__tests__/App.auth.test.tsx` | Test assertion | VERIFIED | Contains "AI Training Coach" |
| `package.json` | Root package name | VERIFIED | `"name": "ai-training-coach"` |
| `api/package.json` | API package name | VERIFIED | `"name": "ai-training-coach-api"` |
| `web/package.json` | Web package name | VERIFIED | `"name": "ai-training-coach-web"` |
| `api/src/shared/db.ts` | MongoDB fallback DB name | VERIFIED | `\|\| 'ai-training-coach'` |
| `api/src/shared/prompts.ts` | JSDoc comment | VERIFIED | "AI training coach" |
| `playwright.config.ts` | E2E database connection | VERIFIED | `ai-training-coach-e2e` |
| `e2e/global-setup.ts` | Global setup DB fallback | VERIFIED | `ai-training-coach` |
| `e2e/auth.spec.ts` | E2E heading assertion and DB fallbacks | VERIFIED | "AI Training Coach", `ai-training-coach-e2e`, `ai-training-coach` |
| `api/src/__tests__/plan.test.ts` | Representative API test (all 15 updated) | VERIFIED | `ai-training-coach` — all 15 files confirmed |
| `README.md` | Project documentation | VERIFIED | Contains "AI Training Coach" |
| `CLAUDE.md` | Architecture guidelines | VERIFIED | Contains "ai-training-coach" |
| `.docs/useful-commands.md` | Developer commands reference | VERIFIED | Contains "ai-training-coach" |
| `.docs/security/2026-04-28.md` | Security audit (historical) | VERIFIED | Contains "AI Training Coach" |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `web/index.html` | browser tab | `<title>` element | VERIFIED | `<title>AI Training Coach</title>` present |
| `web/src/__tests__/App.auth.test.tsx` | LoginPage.tsx h1 | getByText assertion | VERIFIED | `getByText('AI Training Coach')` |
| `playwright.config.ts` | `e2e/global-setup.ts` | MONGODB_CONNECTION_STRING env var | VERIFIED | `ai-training-coach-e2e` in both files |
| `api/src/shared/db.ts` | MongoDB connection | fallback DB name | VERIFIED | `\|\| 'ai-training-coach'` |
| `e2e/auth.spec.ts` | LoginPage h1 | getByRole('heading') assertion | VERIFIED | `{ name: 'AI Training Coach' }` |
| `README.md` | GitHub Actions badge URLs | badge image src | VERIFIED | Both badges use `joacoleza/ai-training-coach` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase contains no new dynamic data components. All changes are pure string substitutions to static text, configuration values, and test assertions. No new state or API connections were introduced.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Web unit test suite passes | `npx vitest run` (web/) | 44 files, 635 tests passed | PASS |
| API unit test suite passes | `npx vitest run` (api/) | 34 files, 396 tests passed | PASS |
| No old DB name in API tests | `grep -r "running-coach" api/src/__tests__/` | 0 matches | PASS |
| No old app name in source | `grep -r "AI Running Coach\|ai-running-coach" web/src/ api/src/ e2e/` | 0 matches | PASS |

**Note on TypeScript build errors:** `npm run build` in `web/` reports 6 TypeScript errors in `useDashboard.computeStats.test.ts` and `WeeklyVolumeChart.test.tsx`. These errors are **pre-existing on the `master` branch** (confirmed by checking out master and running the build — identical errors appear). They were not introduced by phase 17 and are therefore outside this phase's scope.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RENAME-01 | Plans 01, 02, 03 | App title, package names, HTML title, README, and all UI strings updated from "Running Coach"/"ai-running-coach" to "Training Coach"/"ai-training-coach" | SATISFIED | All 30 truths verified across UI, package metadata, DB defaults, test files, and documentation |

No orphaned requirements — RENAME-01 is the only requirement mapped to Phase 17 in REQUIREMENTS.md and all three plans claim it.

---

### Anti-Patterns Found

One intentional old-name reference exists in `README.md` line 152:

> `The GitHub repository has been renamed from \`joacoleza/ai-running-coach\` to \`joacoleza/ai-training-coach\`.`

This is **intentional historical context** in the "GitHub Repository Rename" section — it explains what the old name was so the user can update their git remote. The verification instructions explicitly note this is acceptable. Severity: Info (not a blocker).

No other old-name references found anywhere in the tracked source files.

---

### Human Verification Required

#### 1. Browser Tab Title

**Test:** Start the web dev server (`npm run dev:web`) and open the app in a browser. Check the browser tab.
**Expected:** Tab reads "AI Training Coach"
**Why human:** `index.html` is verified in source but the rendered tab requires a browser.

#### 2. Login Page Heading

**Test:** Navigate to the app login page in a browser (clear localStorage first if already logged in).
**Expected:** The h1 heading reads "AI Training Coach"
**Why human:** React rendering of the h1 requires a live browser instance.

These items are low-risk (source code confirmed correct) — human verification is a belt-and-suspenders check only.

---

### Gaps Summary

No gaps. All 30 observable truths are verified. The phase goal — renaming the app consistently across all user-visible strings, package metadata, DB name defaults, test fixtures, and documentation — is fully achieved.

The one edge item to note: the TypeScript build (`npm run build`) has 6 pre-existing errors that also appear on master and were not introduced by this phase. They do not affect the rename goal and should be tracked separately.

---

_Verified: 2026-05-09T21:25:00Z_
_Verifier: Claude (gsd-verifier)_

---

## Human Verification Confirmed

_Confirmed: 2026-05-14 by Joaquin_

| # | Test | Result |
|---|------|--------|
| 1 | Browser tab reads "AI Training Coach" | ✅ Confirmed |
| 2 | Login page h1 reads "AI Training Coach" | ✅ Confirmed |
