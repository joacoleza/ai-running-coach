---
status: diagnosed
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

### 6. No email enumeration via attempt-count response
expected: A wrong password for a NON-EXISTENT email and a wrong password for a REAL email should return identical 401 response bodies — both just "Invalid credentials", with no attempt count or lockout warning that would distinguish the two. (Attempt counting is internal only.)
result: issue
reported: "The attempt-count warning in 401 responses leaks whether an email is registered: real email gets '4 attempts remaining' message, unknown email gets plain 'Invalid credentials'"
severity: major

### 7. E2E auth test suite passes
expected: Running `npx playwright test e2e/auth.spec.ts --reporter=line` from the project root shows 8 tests pass (7 existing + 1 new "returns 429 after 5 consecutive failed login attempts" test). No failures.
result: pass

## Summary

total: 7
passed: 5
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "After 5 wrong passwords, UI shows the lockout message (e.g. 'Account locked. Try again in 15 minutes.')"
  status: failed
  reason: "User reported: The UI said: Network error — please try again"
  severity: major
  test: 3
  root_cause: "LoginPage.tsx:52-59 only handles status 401 and 503 explicitly. 429 falls into the else branch which hardcodes 'Network error — please try again' without reading the response JSON body."
  artifacts:
    - path: "web/src/pages/LoginPage.tsx"
      issue: "else branch at line 57-59 catches all non-401/503 statuses including 429 and shows a generic message"
  missing:
    - "Add status 429 handler: read response.json().error and display it (e.g. 'Account locked. Try again later.'). Clear password field."
    - "Add/update LoginPage unit tests for 429 response"
  debug_session: ""

- truth: "401 responses for unknown email and wrong password are identical — no attempt count or enumeration signal in the response body"
  status: failed
  reason: "User reported: attempt-count warning in 401 body leaks whether the email is registered — real email gets '4 attempts remaining', unknown email gets plain 'Invalid credentials'"
  severity: major
  test: 6
  root_cause: "auth.ts appends 'N attempt(s) remaining before account lockout.' to the 401 error message when the email exists and failedLoginAttempts is incremented. Emails that don't exist get plain 'Invalid credentials'. This asymmetry enables email enumeration."
  artifacts:
    - path: "api/src/functions/auth.ts"
      issue: "401 response includes attempt count for existing emails but not for unknown emails"
    - path: "api/src/__tests__/loginRateLimit.test.ts"
      issue: "Tests assert on 'N attempts remaining' strings — must be updated to expect plain 'Invalid credentials'"
    - path: "api/src/__tests__/loginRateLimiting.test.ts"
      issue: "Tests assert on 'N attempts remaining' strings — must be updated to expect plain 'Invalid credentials'"
  missing:
    - "Remove attempt-count suffix from all 401 responses in auth.ts — return only 'Invalid credentials' for every failed login (whether email exists or not)"
    - "Update loginRateLimit.test.ts and loginRateLimiting.test.ts to assert on plain 'Invalid credentials' instead of attempt-count strings"
    - "Update authEndpoints.test.ts if any assertions rely on the attempt-count message format"
  debug_session: ""
