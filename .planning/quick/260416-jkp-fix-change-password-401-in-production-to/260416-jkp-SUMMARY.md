---
phase: quick-260416-jkp
plan: "01"
subsystem: web/auth
tags: [bug-fix, auth, change-password, useCallback]
key-files:
  modified:
    - web/src/contexts/AuthContext.tsx
    - web/src/pages/ChangePasswordPage.tsx
    - web/src/__tests__/App.auth.test.tsx
decisions:
  - useCallback([]) on login/logout ensures stable refs — AppInner interceptor does not reinstall on token refresh
  - Read access_token from localStorage after response.ok rather than from closure — interceptor may have refreshed it mid-flight
  - 401 on change-password calls logout() with no error message — redirects to LoginPage immediately, which is the correct recovery UX
metrics:
  duration: "~2.5 minutes"
  completed: "2026-04-16"
  tasks_completed: 3
  files_modified: 3
---

# Quick Fix 260416-jkp: Fix Change-Password 401 in Production — Summary

**One-liner:** Stable useCallback refs prevent interceptor reinstall gap; fresh localStorage token read and 401-to-logout path fix the stale-closure and dead-end error bugs.

## What Was Done

Three bugs caused change-password to return 401 in production:

1. **Interceptor reinstall gap (Task 1):** `login` and `logout` in `AuthContext` were plain functions, recreated on every render. `AppInner`'s `useEffect([login, logout])` reinstalled the 401 interceptor on every auth state change (including token refresh), creating a gap where no interceptor was active. Fixed by wrapping both in `useCallback([])`.

2. **Stale closure token (Task 2):** `ChangePasswordPage` captured `token` from `useAuth()` at render time. If the 401 interceptor refreshed the token during the flight, `login(token!)` overwrote localStorage with the stale value, immediately invalidating the new token. Fixed by reading `localStorage.getItem('access_token')` after `response.ok` and using that `freshToken`.

3. **Missing 401 handler (Task 2):** A 401 on `/api/auth/change-password` fell through to the generic "Network error" else branch with no recovery path. Fixed by adding an explicit `else if (response.status === 401) { logout(); }` branch — clears auth state, redirects to LoginPage automatically.

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- 6/6 App.auth tests pass (4 existing + 2 new)
- 450/450 total web unit tests pass (33 test files)
- TypeScript build: exit 0

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 5cc27b4 | refactor: stabilize login/logout with useCallback in AuthContext |
| 2 | a5b4d0f | fix: stale token closure and 401 handling in ChangePasswordPage |

## Self-Check: PASSED
