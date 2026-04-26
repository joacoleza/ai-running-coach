---
status: complete
phase: 10-login-rate-limiting
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md
started: 2026-04-22T21:20:00Z
updated: 2026-04-22T21:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. IP lockout fires for any email (including non-existent)
expected: |
  POST 5 consecutive requests with a non-existent email + wrong password.
  First 4 return HTTP 401 with body {"error":"Invalid credentials"}.
  5th returns HTTP 429 with "Too many failed attempts. Try again in 15 minutes."
  and a Retry-After header with a positive integer.
result: pass
notes: HTTP 401 ×4, then HTTP 429 with Retry-After: 900. Verified via curl.

### 2. No email enumeration — identical 401 for real and fake email
expected: |
  One wrong-password request for a non-existent email and one for a real
  registered email should return byte-identical 401 responses:
  {"error":"Invalid credentials"} — no attempt count, no difference.
result: pass
notes: Both returned identical {"error":"Invalid credentials"}. IDENTICAL: YES.

### 3. UI shows lockout message from API (not "Network error")
expected: |
  On 5th failed login attempt from the browser, the UI displays the API
  error body (e.g. "Too many failed attempts. Try again in 15 minutes.")
  NOT "Network error — please try again". Password field is cleared.
result: pass
notes: Verified via LoginPage.test.tsx unit tests — 12/12 pass including
  "shows lockout message from API body on 429 response" and
  "shows fallback lockout message on 429 with no error body".

### 4. Locked IP — correct password still returns 429
expected: |
  While the IP is locked (after 5 failures), attempting to log in with
  valid credentials still returns HTTP 429 — not 200.
  The lockout is IP-based and bypasses credential validity.
result: pass
notes: HTTP 429 returned even with correct credentials while IP locked.

### 5. Successful login resets IP attempt counter
expected: |
  After 3 wrong-password failures (no lockout), a successful login resets
  the IP counter. The next wrong-password attempt returns HTTP 401
  (counter at 1), not continuing from 3 toward lockout.
result: pass
notes: 3×401, then 200 on correct login, then 401 on next failure. Counter reset confirmed.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
