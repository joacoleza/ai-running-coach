# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v2.0 — Multi-User Support

**Shipped:** 2026-04-26
**Phases:** 5 | **Plans:** 17 | **Timeline:** 11 days (2026-04-15 → 2026-04-26)

### What Was Built

- Full JWT authentication stack: login/refresh/logout endpoints, bcrypt password hashing, SHA-256 hashed refresh tokens, 15-min access tokens, 30-day refresh tokens
- Frontend auth flow: LoginPage, ChangePasswordPage, App.tsx auth gate (unauthenticated → LoginPage, tempPassword → ChangePasswordPage, else AppShell), global 401 interceptor with silent refresh + retry
- Per-user data isolation: userId scoping across 7 API handlers (48 queries); startup migration backfills v1.1 orphaned data to seed admin
- Admin panel: list/create/reset/deactivate users; `active` flag enforced on every API request (not just login); responsive mobile card + desktop table layout; `lastLoginAt` updated on every token refresh
- IP-based login rate limiting: 5 failures from same IP → 429 lockout with progressive duration (15→1440 min); email enumeration prevention; timing-safe DUMMY_HASH; 7-day TTL auto-expiry

### What Worked

- **Gap closure pattern (09-04, 10-03):** Running E2E tests after each phase routinely surfaced gaps (mobile overflow, lastLoginAt stale, account-based enumeration vector) that were caught before shipping. The verify → gap-closure → re-verify loop is reliable.
- **Verifier reports are dense but trustworthy:** Phase verifications at 14/14 and 27/27 truths gave high confidence before moving to the next phase. Worth the context cost.
- **IP-based rate limiting was the right call:** The switch from account-based (10-01/02) to IP-based (10-03) prevented an email enumeration vulnerability that account-based locking would have introduced. Catching this during Phase 10 rather than in production was the right outcome.
- **Azure Functions /admin path discovery:** Caught early (Phase 9) that Azure Functions Core Tools reserves the /admin prefix at the host level — routing to /api/users avoided the shadowing issue with no real cost.

### What Was Inefficient

- **Phase 8 ROADMAP.md stale status:** Phase 8 was completed but the ROADMAP.md progress table was never updated to reflect it (stayed "0/3 Not started"). Caused confusion during the milestone audit. Better to update ROADMAP.md as part of the phase completion commit.
- **SUMMARY.md frontmatter gaps:** Many phase summaries (07, 09, 10) had empty or stub `requirements_completed` fields. Not caught until the audit's 3-source cross-reference. Worth adding a check in the verifier or executor.
- **ChangePasswordPage 401 production bug:** Required two hotfix iterations (PRs #70, #72) before finding that the issue was the Azure SWA proxy overwriting the Authorization header — required switching to X-Authorization temporarily, then another fix once the real cause was identified. More staging-like testing before shipping auth flows would have caught this earlier.
- **Initial rate limiting direction:** Plans 10-01 and 10-02 built account-based lockout, which was then replaced entirely by plan 10-03 with IP-based lockout. The email enumeration risk should have been identified before writing account-based tests.

### Patterns Established

- **`requireAdmin()` chains from `requireAuth()`:** Pattern established in Phase 8/9 — admin routes call `requireAdmin()` not `requireAuth()` directly. `requireAdmin()` calls `requireAuth()` internally, ensuring both auth + admin checks happen in one call.
- **DB lookup on every requireAuth:** Established as the correct pattern for instant deactivation — costs one MongoDB read per API call but allows revoking any user's access without waiting for JWT expiry.
- **Fire-and-forget for non-critical updates:** `lastLoginAt` update in `getRefreshHandler()` uses `.catch(() => {})` pattern so it doesn't block refresh latency. Applied when updates are desirable but not critical-path.
- **E2E global-setup clears sensitive test state:** `login_attempts.deleteMany({})` in global-setup prevents rate limit state from bleeding between E2E test runs. Pattern to apply to any stateful collection that could interfere across tests.

### Key Lessons

1. **Update ROADMAP.md status atomically with phase completion commits.** Stale progress tables create confusion in audits and mislead future readers. The progress table should be updated in the same PR that ships the phase.
2. **Security design (enumeration, timing) should be resolved before implementation, not after.** The account-based → IP-based rewrite was avoidable if the enumeration threat model had been analyzed up front.
3. **ChangePasswordPage has a unique auth flow** — it can't rely on the 401 interceptor because the interceptor itself may be in a broken state. Always refresh the token proactively before making the password change request.

### Cost Observations

- Sessions: Multiple across 11 days
- Model mix: Primarily Sonnet 4.6 (executor/verifier), Haiku for integration checker
- Notable: Integration checker ran on Haiku and produced a thorough 42-export wiring analysis — appropriate use of a lighter model for structured verification work

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.1 | 11 | 41 | Established plan → execute → verify loop; hierarchical plan model; agent XML protocol |
| v2.0 | 5 | 17 | Added gap-closure sub-phases (09-04, 10-03); first multi-user security milestone; audit-milestone workflow used |

### Cumulative Quality

| Milestone | API Tests | Web Tests | E2E Tests |
|-----------|-----------|-----------|-----------|
| v1.1 | ~223 | ~427 | ~66 |
| v2.0 | 309 | 469 | 77+ |

### Top Lessons (Verified Across Milestones)

1. **E2E tests catch what unit tests miss.** Both milestones used E2E as the final gate and both caught real issues (mobile layout, auth flow edge cases, plan linking bugs) that unit tests passed through.
2. **Gap-closure phases are better than shipping with known gaps.** The 09-04 and 10-03 plans produced substantially better end-state than stopping at 09-03 / 10-02 would have.
