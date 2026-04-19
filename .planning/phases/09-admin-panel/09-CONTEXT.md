# Phase 9: Admin Panel — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 delivers an admin-only page for managing user accounts:

1. **Admin link in sidebar** — visible only when `isAdmin` is true; non-admins cannot see it or reach `/admin`
2. **User list** — table showing all users with email, status (Active / Pending / Deactivated), and last login date
3. **Create user** — admin enters email; server generates temp password, shown once in a modal; user must change on first login
4. **Reset password** — admin triggers reset for any user; new temp password shown once in modal; user must change on next login
5. **Deactivate / Activate** — toggle user active state; deactivated users cannot log in (401); admin cannot deactivate themselves

This phase does NOT include:
- User deletion (deactivate-only approach; data is never destroyed from the admin panel)
- Email notifications for new accounts or resets (out-of-band delivery, as established)
- Per-user data views from the admin panel (each user sees only their own data)
- Login rate limiting (Phase 10)
- Apple Health integration

</domain>

<decisions>
## Implementation Decisions

### Delete vs Deactivate (USER-04)

- **D-01:** Deactivate only — no delete action in the admin panel. Data (plans, runs, messages) is never permanently destroyed via the UI.
- **D-02:** Deactivation is a toggle — admin can reactivate a deactivated user. The button label flips: "Deactivate" when active, "Activate" when deactivated. Single endpoint: `PATCH /api/admin/users/:id` with `{ active: boolean }`.
- **D-03:** `requireAuth` must reject users with `active: false` with 401. Login endpoint must also reject deactivated users (401 on login attempt).

### User Data Model

- **D-04:** Add `active: boolean` field to the `User` document (default `true`). This field drives the deactivation toggle and the status column. Existing users (no `active` field) are treated as active — migration or default logic at read time.
- **D-05:** Status derivation: `!active` → "Deactivated"; `active && tempPassword` → "Pending"; `active && !tempPassword` → "Active".

### Temp Password UX (USER-02, USER-03)

- **D-06:** After creating or resetting a user, display the temp password in a modal with a "Copy" button. The modal must be manually dismissed by the admin. Once closed, the password is gone — there is no way to retrieve it. The modal includes a clear warning: "Save this password — it won't be shown again."
- **D-07:** Temp password is generated server-side (not client-side). Random secure string. Server returns it in the API response plaintext once — never stored in plaintext, only as bcrypt hash.

### User List (USER-01)

- **D-08:** Table columns: Email | Status | Last Login | Actions. Status uses color-coded badges (e.g. green = Active, yellow = Pending, gray = Deactivated). Last Login shows "Never" if `lastLoginAt` is null.
- **D-09:** Actions column: "Reset Password" button for all users; "Deactivate" / "Activate" toggle for all users except the currently logged-in admin (self-deactivation blocked).

### Admin Self-Protection

- **D-10:** API returns 400 if admin attempts to deactivate themselves (`userId === authCtx.userId` check on the deactivate endpoint). Error message: "You cannot deactivate your own account."
- **D-11:** Password reset on self is allowed — admin can reset their own password via the admin panel (same as resetting any other user). No restriction needed here.

### Claude's Discretion

- Temp password generation: length and character set (suggest: 12-char alphanumeric, server-side `crypto.randomBytes`)
- Whether to add a `createdAt` column to the user table (data is available; may or may not be useful)
- API route structure for admin endpoints (suggest: `/api/admin/users`, `/api/admin/users/:id/reset-password`, `/api/admin/users/:id`)
- Exact badge colors and styling — consistent with existing Tailwind patterns in the app
- Whether "Create User" is a form inline in the page or a modal/drawer

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth & Middleware
- `api/src/middleware/auth.ts` — `requireAdmin()` already implemented; `requireAuth()` must be updated to check `active: false` and return 401
- `api/src/shared/types.ts` — `User` interface needs `active: boolean` field added

### Existing Pages (follow same patterns)
- `web/src/pages/Runs.tsx` — table with pagination, filter, action buttons; follow this pattern for user list
- `web/src/pages/Dashboard.tsx` — page layout and data fetching pattern
- `web/src/components/layout/Sidebar.tsx` — add conditional admin nav item using `isAdmin` from `useAuth()`
- `web/src/App.tsx` — add `/admin` route (inside the authenticated BrowserRouter block)

### Auth Context
- `web/src/contexts/AuthContext.tsx` — `useAuth()` exposes `isAdmin`; use for sidebar guard and admin route guard

### Architecture References
- `CLAUDE.md` §Architecture Decisions — `window.confirm()` for destructive actions; cursor-pointer enforcement; auth middleware pattern; `requireAdmin` usage
- `REQUIREMENTS.md` — USER-01, USER-02, USER-03, USER-04, DATA-03
- `.planning/phases/08-data-isolation-migration/08-CONTEXT.md` — D-10/D-11: `requireAdmin` signature and usage pattern
- `.planning/phases/06-backend-auth-foundation/06-CONTEXT.md` — D-10: JWT payload; D-12: auth middleware chain

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireAdmin(req)` in `api/src/middleware/auth.ts` — ready to use on all admin API routes; returns 403 if not admin
- `useAuth()` from `web/src/contexts/AuthContext.tsx` — exposes `{ token, isAdmin }` for sidebar guard and fetch headers
- `Sidebar.tsx` `navItems` array — extend with conditional admin entry: `{ path: "/admin", label: "Admin", icon: "⚙️" }` rendered only when `isAdmin === true`
- `getDb()` in `api/src/shared/db.ts` — standard MongoDB connection for admin API handlers

### Established Patterns
- All destructive actions use `window.confirm()` — follow for deactivate toggle
- Pages fetch on mount via `useEffect` + `fetch` with `Authorization: Bearer ${token}` — replicate in AdminPage
- Azure Functions handlers export via factory pattern (see `getLoginHandler`) — follow for admin handlers
- Error responses: 404 for missing resource, 400 for bad request, 403 for forbidden, 409 for conflict

### Integration Points
- `api/src/index.ts` — register new admin route handlers here
- `web/src/App.tsx` — add `<Route path="/admin" element={<Admin />} />` inside authenticated block
- `api/src/middleware/auth.ts` — modify `requireAuth` to check `user.active` (requires a DB lookup on every request, OR encode `active` in the JWT — careful: stale if admin deactivates mid-session)
- `api/src/shared/types.ts` — add `active: boolean` to `User` interface

### Important: Active Flag + JWT Staleness
The `active` field is on the User document, not in the JWT payload. The JWT is verified stateless — if an admin deactivates a user mid-session, their existing JWT remains valid until it expires (~15 min). Downstream agents should decide whether to do a DB lookup on every request (expensive but immediate) or accept the ~15 min window (simpler, acceptable for this use case given the small user base).

</code_context>

<specifics>
## Specific Requirements

- **Temp password modal:** Must include a "Copy to clipboard" button and explicit warning text: "Save this password — it won't be shown again." Modal is dismissible only by the admin clicking a close/done button.
- **Self-deactivation block:** `PATCH /api/admin/users/:id` returns 400 with `{ error: "You cannot deactivate your own account." }` when `id` matches the authenticated admin's userId.
- **Deactivated user login:** `POST /api/auth/login` returns 401 with appropriate error when `user.active === false`. Same uniform error message pattern (don't reveal why — just "Invalid credentials" or similar — actually: per established pattern in Phase 6, uniform message prevents enumeration. Downstream agents: check Phase 6 approach for login error messages).
- **Status badges:** Three states — Active (green), Pending (yellow/amber — has tempPassword flag), Deactivated (gray). "Last Login" shows formatted date or "Never".
- **No public user creation route** — `POST /api/admin/users` is admin-only (requireAdmin guard). No self-registration endpoint.

</specifics>

<deferred>
## Deferred Ideas

- **Cascade delete** — permanently delete a user and all their data — future phase or explicit user request
- **Admin audit log** — track who created/deactivated/reset whom and when — noted in Phase 8 context; future admin enhancement
- **Email notifications** — notify user on account creation or password reset — REQUIREMENTS.md NOTF-01/NOTF-02 (future requirements)
- **Per-user data view from admin** — admin browses another user's plan/runs — out of scope for this phase
- **Display name / profile info** — PROF-01/PROF-02 from REQUIREMENTS.md future requirements

</deferred>

---

*Phase: 09-admin-panel*
*Context gathered: 2026-04-18*
