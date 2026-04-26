---
phase: 07-frontend-auth
plan: "01"
subsystem: auth
tags: [auth, frontend, react, context, jwt, bcrypt]
dependency_graph:
  requires: [06-04]
  provides: [AuthContext, LoginPage, ChangePasswordPage, change-password-endpoint]
  affects: [web/src/App.tsx, web/src/contexts/AuthContext.tsx]
tech_stack:
  added: []
  patterns: [React Context API, localStorage auth persistence, Azure Functions handler factory]
key_files:
  created:
    - web/src/contexts/AuthContext.tsx
    - web/src/pages/LoginPage.tsx
    - web/src/pages/ChangePasswordPage.tsx
  modified:
    - api/src/functions/auth.ts
decisions:
  - Used type-only ReactNode import (verbatimModuleSyntax tsconfig requires it)
  - getChangePasswordHandler extracts userId from JWT directly (requireAuth already validated)
  - ChangePasswordPage calls login() with existing token to clear tempPassword flag (no re-login needed)
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-16"
  tasks_completed: 3
  files_changed: 4
---

# Phase 7 Plan 01: Auth Foundation — Summary

Auth foundation built: AuthContext for app-wide JWT state, LoginPage and ChangePasswordPage UI components matching UI-SPEC, plus two backend changes (tempPassword in login response, change-password endpoint).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add tempPassword to login response + change-password endpoint | 1aef1c0 |
| 2 | Create AuthContext with login/logout state management | f7deb99 |
| 3 | Create LoginPage and ChangePasswordPage components | 8dd1fd2 |

## What Was Built

### Backend (api/src/functions/auth.ts)

**tempPassword in login response (D-01):** The login handler now returns `tempPassword: user.tempPassword` in its JSON body alongside `token`, `refreshToken`, and `expiresIn`. This allows the client to detect first-login users.

**change-password endpoint:** New `getChangePasswordHandler()` exported factory function. Validates JWT via `requireAuth`, validates `newPassword` (required, min 8 chars), bcrypt-hashes the new password, and updates the user document with `passwordHash`, `tempPassword: false`, and `updatedAt`. Registered as `POST /api/auth/change-password` with Azure Functions `app.http()`.

### Frontend

**AuthContext (web/src/contexts/AuthContext.tsx):** React context that persists auth state across page refreshes. `readAuthFromStorage()` initializes state from localStorage on mount. `login()` writes all five keys (`access_token`, `refresh_token`, `auth_email`, `auth_is_admin`, `auth_temp_password`) to localStorage and updates React state atomically. `logout()` clears all keys. `useAuth()` throws if called outside `AuthProvider`.

**LoginPage (web/src/pages/LoginPage.tsx):** Centered card form with email + password fields. Autofocuses email on mount. Submit button disabled until both fields have content. Error messages per UI-SPEC: "Invalid email or password" on 401, "Service locked. Contact administrator." on 503, "Network error — please try again" on other failures. Calls `onTempPassword()` callback when login response includes `tempPassword: true`.

**ChangePasswordPage (web/src/pages/ChangePasswordPage.tsx):** Two password fields with real-time validation. Shows "Password must be at least 8 characters" when newPassword is non-empty and shorter than 8 chars. Shows "Passwords do not match" only when both fields have content and differ. Submit button disabled until both fields are filled, passwords match, and minimum length is met. On success, calls `login()` with the existing token but `tempPassword: false` — no re-login required, App.tsx gate re-evaluates automatically.

## Test Results

- API tests: 223 passed (no regressions)
- Web unit tests: 425 passed (no regressions)
- TypeScript build (`npm run build`): passes — build artifact produced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ReactNode type-only import in AuthContext**
- **Found during:** Post-task 3 web build (`npm run build`)
- **Issue:** `verbatimModuleSyntax` in tsconfig requires type-only imports for type-only identifiers. `ReactNode` was imported as a value (`import { ..., ReactNode } from 'react'`) which fails the build.
- **Fix:** Changed to `import { ..., type ReactNode } from 'react'`
- **Files modified:** `web/src/contexts/AuthContext.tsx`
- **Commit:** b1fe62f

## Known Stubs

None — all three files have their logic fully wired. AuthContext reads from/writes to localStorage. LoginPage calls `POST /api/auth/login`. ChangePasswordPage calls `POST /api/auth/change-password`. No placeholder data flows to UI rendering.

## Self-Check: PASSED
