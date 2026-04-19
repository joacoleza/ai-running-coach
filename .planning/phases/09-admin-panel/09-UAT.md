---
status: complete
phase: 09-admin-panel
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md]
started: 2026-04-19T15:00:00Z
updated: 2026-04-19T16:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running API/web servers. Start from scratch (cd api && npm start, then start web). API boots without errors, MongoDB connects, and a basic request (e.g. GET /api/plan) returns a live response (not a 503 or connection error). No startup crashes in the console.
result: pass

### 2. Admin sidebar link hidden for non-admins
expected: Log in as a regular (non-admin) user. The sidebar should NOT show an "Admin" link — only Dashboard, Training Plan, Runs, Archive.
result: pass

### 3. Admin sidebar link visible for admins
expected: Log in as admin@example.com (or any admin user). The sidebar shows an "Admin" link below the other nav items. Clicking it navigates to /admin.
result: pass

### 4. Non-admin /admin route guard
expected: While logged in as a non-admin user, navigate directly to /admin. You should be immediately redirected to /dashboard — the admin page never loads.
result: pass

### 5. Admin user table
expected: On the /admin page, a table lists all registered users. Each row shows the user's email, a colored status badge (Active / Pending / Deactivated), and action buttons (Reset Password, Deactivate or Activate).
result: issue
reported: "Yes. But it looks bad in mobile — table overflows horizontally, action buttons cut off / not visible"
severity: major

### 6. Status badge colors
expected: In the user table, active users show a green "Active" badge; users with a temp password show a yellow/orange "Pending" badge; deactivated users show a gray "Deactivated" badge.
result: pass

### 7. Create user
expected: Click "Add User" (or similar button). Fill in an email address and submit. The new user appears in the table with "Pending" status. A modal displays the temporary password — note it down. Clicking the backdrop or pressing Escape does NOT close this modal; only the explicit close button dismisses it.
result: pass

### 8. Reset password
expected: Click "Reset Password" on an existing user row. A confirmation dialog appears. After confirming, a modal shows a new temporary password. The same non-dismissible behavior applies — backdrop/Escape don't close it.
result: pass

### 9. Deactivate user
expected: Click "Deactivate" on a user row (not your own admin account). A window.confirm dialog appears. After confirming, the row's status badge changes to "Deactivated" and the button switches to "Activate". No full page reload.
result: pass

### 10. Activate user
expected: Click "Activate" on a deactivated user row. A window.confirm dialog appears. After confirming, the status badge changes back to "Active" and the button switches to "Deactivate".
result: pass

### 11. Self-deactivation blocked
expected: On the admin page, your own account row should have the Deactivate button disabled (or absent) — admins cannot deactivate themselves. Other action buttons (Reset Password) remain functional.
result: pass

### 12. Deactivated user login rejected
expected: Try to log in with an account that has been deactivated. The login form returns an error ("Invalid credentials" or similar). The user is NOT logged in — no dashboard is shown.
result: pass

## Summary

total: 12
passed: 11
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Admin user table is fully usable on mobile — all columns and action buttons accessible"
  status: failed
  reason: "User reported: table overflows horizontally on mobile, action buttons cut off / not visible"
  severity: major
  test: 5
  artifacts: []
  missing: []

- truth: "Last Login column shows full datetime (date + hours, minutes, seconds) so admins can see precise activity timestamps"
  status: failed
  reason: "User reported: last login cell should show full date with hour, minutes and seconds — truncated date alone is not useful"
  severity: minor
  test: 5
  artifacts: []
  missing: []

- truth: "lastLoginAt is updated on every token refresh so it reflects when the user was last active, not just when they entered their password — a user active for 30 days via silent refresh should not show a 30-day-old last login"
  status: failed
  reason: "User identified: lastLoginAt only updated on password login (auth.ts:62), not on token refresh — an active user silently refreshing tokens for 30 days would show a stale login date"
  severity: major
  test: 5
  artifacts: [api/src/functions/auth.ts]
  missing: ["lastLoginAt update in getRefreshHandler"]
