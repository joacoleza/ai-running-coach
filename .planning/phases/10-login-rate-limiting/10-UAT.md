---
status: complete
phase: 10-login-rate-limiting
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md
started: 2026-04-22T00:00:00Z
updated: 2026-04-22T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Wrong password warning message
expected: POST /api/auth/login with valid email + wrong password → HTTP 401, error message contains "4 attempts remaining before account lockout."
result: pass

### 2. Singular grammar on final warning
expected: On the 4th wrong password (1 attempt left), the message says "1 attempt remaining before account lockout" (singular, not "1 attempts remaining").
result: pass

### 3. Account lockout after 5 failures
expected: After 5 consecutive wrong passwords for the same account → HTTP 429, response body contains "Account locked. Try again in 15 minutes." (or similar), and the response includes a Retry-After header with a positive integer.
result: issue
reported: "The UI said: Network error — please try again"
severity: major

### 4. Locked account blocked immediately
expected: While the account is locked, attempting to log in with the CORRECT password still returns HTTP 429 instantly with the lockout message — not HTTP 200.
result: pass

### 5. Successful login resets failed attempt counter
expected: After 2-3 wrong passwords (not yet locked), log in successfully with the correct password. Then try a wrong password again — the error should say "4 attempts remaining" (counter reset), not continue from where it left off.
result: pass

### 6. E2E auth test suite passes
expected: Running `npx playwright test e2e/auth.spec.ts --reporter=line` from the project root shows 8 tests pass (7 existing + 1 new "returns 429 after 5 consecutive failed login attempts" test). No failures.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "After 5 wrong passwords, UI shows the lockout message (e.g. 'Account locked. Try again in 15 minutes.')"
  status: failed
  reason: "User reported: The UI said: Network error — please try again"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
