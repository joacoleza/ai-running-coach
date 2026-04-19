## Summary

**Phase 9: Admin Panel**
**Goal:** An admin can manage all user accounts from a dedicated page in the app
**Status:** Verified — 27/27 must-haves passed (including 3 gap-closure items from plan 09-04)

Delivers a full user management UI accessible only to admin accounts. Admins see an Admin link in the sidebar leading to a user table with status badges, last-login timestamps, and per-user action buttons. The backend enforces deactivation at two checkpoints: the login handler (immediate block) and `requireAuth` middleware (live revocation even for users with a valid JWT). A gap-closure sub-plan (09-04) added a responsive mobile card layout, full HH:MM:SS last-login display, and `lastLoginAt` tracking on token refresh.

## Changes

### Plan 09-01: Admin API (Backend)
Added `active: boolean` to the `User` type, enforced in `requireAuth` middleware (DB lookup per request) and the login handler. Created `api/src/functions/admin.ts` with four handler factories: list users, create user, reset password, and toggle active. All routes use the `/api/users` prefix (not `/api/admin/users`) to avoid the Azure Functions reserved `/admin` path conflict.

**Key files created:** `api/src/functions/admin.ts`, `api/src/__tests__/admin.test.ts`, `api/src/__tests__/adminAuth.test.ts`
**Key files modified:** `api/src/middleware/auth.ts`, `api/src/functions/auth.ts`, `api/src/shared/types.ts`

### Plan 09-02: Admin UI (Frontend)
Created `web/src/pages/Admin.tsx` with a user table, status badges (Active/Pending/Deactivated), Create User modal (shows temp password once), Reset Password flow, and Deactivate/Activate buttons with a self-deactivation guard. Sidebar conditionally renders the Admin link based on `isAdmin`. The `/admin` route redirects non-admins to `/dashboard`. Fixed `LoginPage` to decode the JWT payload and extract `isAdmin` (was hardcoded `false`).

**Key files created:** `web/src/pages/Admin.tsx`, `web/src/__tests__/Admin.test.tsx`
**Key files modified:** `web/src/components/layout/Sidebar.tsx`, `web/src/pages/LoginPage.tsx`, `web/src/App.tsx`

### Plan 09-03: E2E Tests
Added `e2e/admin.spec.ts` with 8 tests covering: sidebar guard, route guard, user list, create user, reset password, deactivate user, and deactivated-user login rejection. Seeded `admin@example.com` and `deactivate@example.com` in `global-setup.ts`.

**Key files created:** `e2e/admin.spec.ts`
**Key files modified:** `e2e/global-setup.ts`

### Plan 09-04: Gap Closure (Mobile Layout + lastLoginAt)
Three UAT gaps closed: (1) responsive card layout on mobile vs table on desktop, (2) full `HH:MM:SS` last-login timestamp using `sv-SE` locale, (3) `lastLoginAt` updated fire-and-forget on every token refresh, not just password login.

**Key files modified:** `web/src/pages/Admin.tsx`, `api/src/functions/auth.ts`

### Additional: E2E DB Isolation + Test Coverage
- `api/src/shared/db.ts` derives DB name from the connection string path segment, enabling an isolated `running-coach-e2e` DB for Playwright without touching dev data
- `playwright.config.ts` sets `MONGODB_CONNECTION_STRING` at module level before `globalSetup` runs
- Two missing unit tests added: `requireAuth` with user not found in DB after token issued, and login handler with `active === false`

## Requirements Addressed

- **USER-01** — Admin can view a list of all user accounts (email, status, last login date)
- **USER-02** — Admin can create a new user account; system auto-generates a temp password shown once
- **USER-03** — Admin can reset any user's password; new temp password generated and shown once; user must change on next login
- **USER-04** — Admin can deactivate a user account; deactivated users cannot log in or use the API
- **DATA-03** — Admin users have an `isAdmin` flag enabling access to the admin panel

## Verification

- [x] Automated verification: PASSED — 27/27 must-haves verified
- [x] Unit tests: 299 API tests + 466 web tests passing
- [x] E2E tests: 8 admin-specific scenarios passing
- [x] Gap closure: mobile layout, full datetime, lastLoginAt on refresh — all verified
- [x] No regressions in existing test suites

## Key Decisions

- **`/api/users` not `/api/admin/users`** — Azure Functions Core Tools reserves `/admin` for the host management API; any handler with `route: 'admin/...'` returns 404
- **DB lookup in `requireAuth`** — Every authenticated request fetches the user document to enforce deactivation instantly, before the JWT expires; one DB read per call is the accepted trade-off
- **Uniform 401 on deactivated login** — Returns "Invalid credentials" (not "Account deactivated") to avoid user enumeration
- **Dual-layout for mobile** — Card list (`md:hidden`) + table (`hidden md:block`) keeps the desktop UI unchanged without JS media query checks
- **`sv-SE` locale for datetime** — Produces `YYYY-MM-DD HH:MM:SS` format without manual string concatenation

Generated with [Claude Code](https://claude.ai/code)
