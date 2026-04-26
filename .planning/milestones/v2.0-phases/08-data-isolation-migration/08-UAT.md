---
status: complete
phase: 08-data-isolation-migration
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md]
started: 2026-04-18T03:30:00Z
updated: 2026-04-18T03:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start the API from scratch (cd api && npm start). Server boots without errors, the migration runs (logs something like "runStartupMigration" or completes silently), and a basic API call (e.g. GET /api/plan with a valid token) returns a response without a 500 error.
result: pass

### 2. User data isolation — plans
expected: Log in as User A. Create or confirm there is a training plan under that account. Log in as User B (different account). Navigate to Training Plan. User B sees their own plan (or no plan) — NOT User A's plan.
result: pass

### 3. User data isolation — runs
expected: Log in as User A. Log a run. Log in as User B. Go to Runs page. User B does not see User A's run in the list.
result: pass

### 4. Cross-user access returns 404
expected: User A attempts to access a plan or run that belongs to User B (e.g. via direct API call or by manipulating a URL/ID). The server returns 404 — it does not reveal the resource exists or return a 403.
result: pass
note: Verified via API — GET /api/runs/{userA_run} and GET /api/plans/archived/{userA_plan} as userB both return 404

### 5. Each user's data is independent end-to-end
expected: Log in as User A. The coach chat, training plan, and runs all show only User A's data. Log in as User B. All three sections show only User B's data. No data leaks between accounts.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
