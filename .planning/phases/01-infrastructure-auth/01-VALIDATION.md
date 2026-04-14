---
phase: 1
slug: infrastructure-auth
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
updated: 2026-04-14
note: "Phase predates Nyquist adoption. VERIFICATION.md passed 11/11. Auth tests in Phase 1.2 provide automated coverage for AUTH-01/02/03."
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (co-located with Vite) |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test confirms owner login and non-owner block
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| AUTH-01-config | 01 | 1 | AUTH-01 | Config validation | Manual — verify JSON schema | ❌ W0 | ⬜ pending |
| AUTH-01-role | 01 | 1 | AUTH-01 | Manual smoke | Manual — sign in and verify access | Manual only | ⬜ pending |
| AUTH-02-config | 01 | 1 | AUTH-02 | Config validation | Manual — verify JSON schema | ❌ W0 | ⬜ pending |
| AUTH-02-e2e | 01 | 1 | AUTH-02 | E2E smoke | Manual — open incognito, hit app URL | Manual only | ⬜ pending |
| AUTH-03-grep | 01 | 1 | AUTH-03 | Code review + grep | `grep -r "joacoleza" api/ src/` returns 0 matches | Manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — configure Vitest with React Testing Library
- [ ] `package.json` test script: `"test": "vitest run"`
- [ ] Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] `src/test/setup.ts` — shared test setup importing `@testing-library/jest-dom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Routes `/*` require `owner` role | AUTH-01 | Static config, no runtime testability | Verify `staticwebapp.config.json` requires `owner` role and 401 redirects to GitHub OAuth |
| Non-owner GitHub login is blocked (403) | AUTH-01 | Requires deployed SWA + OAuth flow | Log in with a non-`joacoleza` GitHub account, confirm access denied |
| Unauthenticated browser redirects to GitHub | AUTH-02 | Requires deployed SWA + browser | Open incognito, visit app URL, confirm GitHub OAuth page |
| Owner login grants access | AUTH-02 | Requires deployed SWA + real GitHub OAuth | Log in as `joacoleza`, confirm app loads |
| No hardcoded username in source | AUTH-03 | Policy check | `grep -r "joacoleza" api/ src/` must return 0 matches |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
