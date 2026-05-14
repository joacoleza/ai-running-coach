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

## Milestone: v2.1 — Usage & Plan Controls

**Shipped:** 2026-04-28
**Phases:** 2 | **Plans:** 5 | **Timeline:** 2 days (2026-04-26 → 2026-04-27)

### What Was Built

- `usage_events` MongoDB collection capturing raw Anthropic token counts per chat call; `pricing.ts` (`MODEL_PRICING` map + `computeCost()`); compound indexes for per-user and admin aggregation
- `GET /api/usage/me` (per-user allTime + thisMonth + monthly breakdown) and `GET /api/users/usage-summary` (admin userId → cost map) via single-pass aggregation
- `UsagePage` with all-time/this-month stat cards and monthly breakdown table; "My Usage" sidebar dropdown; `/usage` route; Admin panel Month/All-time cost columns; 5 E2E tests
- `DELETE /api/plan/phases/:phaseIndex/weeks/last` endpoint with guard conditions; `assignPlanStructure` recomputation after deletion
- "− week" UI button in `PlanView` (disabled not hidden when last week has workout days); `<plan:delete-week>` chat tag support in `useChat.ts` (4 strip locations, `applyPlanOperations` processing, 2 E2E tests)

### What Worked

- **Nyquist validation retroactively applied and passed:** Both phases had VALIDATION.md files created post-execution; the retroactive Nyquist audit caught no gaps because the executor had already built thorough tests. Indicates the testing discipline is now internalized, not just checklist-driven.
- **Symmetric design with existing patterns:** Phase 12's "− week" button was explicitly designed as the inverse of "+ Add week" — same 4 strip locations, same `applyPlanOperations` loop, same disabled-vs-hidden UX convention. Symmetry made implementation fast and correctness obvious.
- **Non-fatal pattern for usage capture:** The try/catch around `usage_events.insertOne` with an empty catch block is clean and safe — a write failure never blocks the SSE response. Simple, testable, correct.

### What Was Inefficient

- **MILESTONES.md extraction artifacts:** The `gsd-tools milestone complete` CLI extracted some malformed lines ("One-liner:", "1. [Rule 1 - Bug]...") from SUMMARY.md files into the MILESTONES.md accomplishments list. Required manual cleanup post-archival. The CLI extracts the `one_liner` frontmatter field but falls back to body content that can include deviation notes.

### Patterns Established

- **Raw token storage + compute-at-query-time:** Store `inputTokens`, `outputTokens`, `cacheWriteTokens`, `cacheReadTokens` raw; compute USD cost from `MODEL_PRICING` at read time. Allows repricing historical data without re-running writes.
- **Plan mutation tag symmetry (4-location strip):** Every new plan-mutation chat tag must be stripped in 4 places in `useChat.ts`: mount stripping, `sendMessage` onText, `startPlan` onText, and `applyPlanOperations`. Template for future tags.

### Key Lessons

1. **Small milestones (2 phases) are clean and fast.** The 2-day timeline with 16 requirements and 45 E2E tests shows that focused scoping keeps momentum high and audit overhead low.
2. **Retroactive Nyquist audit works as a safety net but not as a substitute.** Building tests alongside the implementation (as the executor did) is why the retroactive audit found nothing to add.

### Cost Observations

- Sessions: 2 days of execution
- Model mix: Primarily Sonnet 4.6 (executor), Haiku for Nyquist audit agents
- Notable: Phase 11 execution in 7 min (11-01) and 12 min (11-03) — tight scoping and clear plans enable fast execution even for multi-file changes

---

## Milestone: v3.0 — Multi-Discipline Training Coach

**Shipped:** 2026-05-15
**Phases:** 8 (13, 14, 15, 15.1, 15.2, 16, 17, 21) | **Plans:** 24 | **Timeline:** 16 days (2026-04-29 to 2026-05-15)

### What Was Built

- Multi-discipline data layer: Discipline type on all Run/PlanDay interfaces, startup migration backfilling existing docs, API endpoints accepting the field
- Gym sessions: exercise log (sets x reps x weight), interactive plan day checklist, coach gym context with exercise history
- Cycling sessions: speed (km/h) display everywhere pace appeared, coach cycling context format
- Discipline-aware UI: Sidebar "Activities", RunDetailModal badge + gym field hiding, DayRow "Log/Link session", LinkRunModal discipline filtering, plan day discipline badges
- Multi-discipline dashboard: per-discipline sections (Run/Cycling/Gym), WeeklySpeedChart, WeeklyDurationChart, WeightProgressionChart; sections auto-hide when no data
- App renamed: all "AI Running Coach" / "ai-running-coach" replaced with "AI Training Coach" / "ai-training-coach"
- Bug fix: runs.weekNumber bulk-updated after plan restructuring (phase 15.2)

### What Worked

- **Decimal phases for inserted work:** 15.1 (polish) and 15.2 (bug fix) inserted cleanly without renumbering the main sequence. 15.2 was an urgent bug fix that shipped in one plan with full test coverage.
- **Nyquist validation caught real gaps:** Retroactive validation of Phase 15.1 found 8 coverage gaps (ExerciseList, RunDetailModal gym fields, DayRow discipline badge, LinkRunModal dayDiscipline). 30 tests added.
- **Audit-first before complete-milestone:** The milestone audit clearly separated in-scope requirements (25/27 satisfied) from deferred Phase 18 work, preventing scope creep.

### What Was Inefficient

- **Phase 21 was late:** Dashboard Discipline Sections was added after Phase 17 complete, requiring a return to dashboard work. Better upfront roadmap scope would have included it earlier.
- **MILESTONES.md raw one-liners:** CLI-generated accomplishments required manual cleanup — SUMMARY.md one-liner fields were often raw implementation notes, not human-readable.

### Key Lessons

1. **Decimal phases are the right pattern for urgent inserts.** 15.1 and 15.2 shipped without disrupting the numbered sequence.
2. **Retroactive Nyquist is valuable but expensive.** Building validation into execute-phase would avoid the separate cleanup PR.
3. **Know "foundational" vs "complete round-trip" scope.** Deferring GYM-05 full exercises round-trip to Phase 18 was correct — Phase 14 delivered enough to ship.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.1 | 11 | 41 | Established plan to execute to verify loop; hierarchical plan model; agent XML protocol |
| v2.0 | 5 | 17 | Added gap-closure sub-phases (09-04, 10-03); first multi-user security milestone; audit-milestone workflow used |
| v2.1 | 2 | 5 | Focused micro-milestone; Nyquist retroactively applied; symmetric tag pattern established |
| v3.0 | 8 | 24 | Largest feature scope; decimal phases established; retroactive Nyquist closed 30 test gaps |

### Cumulative Quality

| Milestone | API Tests | Web Tests | E2E Tests |
|-----------|-----------|-----------|-----------|
| v1.1 | ~223 | ~427 | ~66 |
| v2.0 | 309 | 469 | 77+ |
| v2.1 | 344 | 507 | 45 |
| v3.0 | ~41 | ~675 | ~100 |

### Top Lessons (Verified Across Milestones)

1. **E2E tests catch what unit tests miss.** Every milestone used E2E as the final gate and caught real issues (mobile layout, auth flow edge cases, plan linking bugs, discipline filter contamination) that unit tests passed through.
2. **Gap-closure phases are better than shipping with known gaps.** The 09-04, 10-03, 15.1, and 15.2 plans produced substantially better end-state than stopping early would have.
3. **Audit before archiving.** Running audit-milestone before complete-milestone consistently surfaces deferred items and prevents premature closure.
