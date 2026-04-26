# Phase 7: Frontend Auth — Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers the frontend authentication flow for v2.0:

1. **LoginPage** — Email + password form (replaces `PasswordPage.tsx`); stores JWT access token + refresh token in `localStorage`
2. **ChangePasswordPage** — Force-redirect for `tempPassword: true` users; shows before the app mounts; sets `tempPassword: false` on success
3. **AuthContext** — App-wide auth state (`{ token, email, isAdmin, tempPassword, login, logout }`); all hooks consume via `useAuth()` instead of reading `localStorage` directly
4. **Silent token refresh** — 401 interceptor in `App.tsx` calls `POST /api/auth/refresh`, retries the failed request transparently; redirects to login only if refresh itself fails
5. **Logout** — Sidebar logout button calls `POST /api/auth/logout` (sends refreshToken to revoke server-side) then clears AuthContext state
6. **Header migration** — Replace all `x-app-password` / `X-App-Password` references in hooks with `Authorization: Bearer <token>` via `useAuth()`

**Small backend change in this phase:**
- `POST /api/auth/login` response adds `tempPassword: boolean` to the JSON body → `{ token, refreshToken, expiresIn: 900, tempPassword }`

This phase does NOT include:
- Admin panel or `isAdmin`-gated UI (Phase 9)
- Data isolation / userId scoping (Phase 8)
- Any new API endpoints beyond the `tempPassword` field addition

</domain>

<decisions>
## Implementation Decisions

### tempPassword Detection

- **D-01:** Backend adds `tempPassword: boolean` to the `POST /api/auth/login` response JSON: `{ token, refreshToken, expiresIn: 900, tempPassword }`. Freshly read from DB on each login — always accurate. `tempPassword` is NOT added to the JWT payload (stale-value risk once user changes password).

### Token Refresh Strategy

- **D-02:** Silent refresh on 401. The `App.tsx` fetch interceptor catches 401 responses, calls `POST /api/auth/refresh` to get a new access token, and retries the original request transparently. The user never sees an interruption during active coaching sessions. If the refresh call itself returns 401 (refresh token expired or revoked), clear auth state and redirect to login. Concurrent 401s during an active refresh are queued — only one refresh call is made.

### Route Architecture

- **D-03:** App-level gate (same pattern as current `PasswordPage`). `BrowserRouter` only mounts when the user is fully authenticated AND has no pending password change. Auth check order in `App.tsx`:
  1. Not authenticated → render `<LoginPage />`
  2. Authenticated + `tempPassword: true` → render `<ChangePasswordPage />`
  3. Authenticated + `tempPassword: false` → render `<BrowserRouter>...<AppShell>...</BrowserRouter>`
  No `/login` or `/change-password` URL routes — no need for this app.

### AuthContext

- **D-04:** Introduce `AuthContext` (`web/src/contexts/AuthContext.tsx`) wrapping the app above `BrowserRouter`. Exposes `{ token, email, isAdmin, tempPassword, login(token, refreshToken, email, isAdmin, tempPassword), logout() }` via `useAuth()` hook. All three hooks (`useChat`, `usePlan`, `useRuns`) get the token from `useAuth()` instead of reading `localStorage` directly. Auth state is also read from `localStorage` on mount (same as current App.tsx pattern) so page refreshes restore the session.

### Logout

- **D-05:** Sidebar logout calls `POST /api/auth/logout` with the `refreshToken` (to revoke server-side) before clearing auth state. If the logout API call fails, still clear client state — user is logged out locally regardless.

### Claude's Discretion

- `authHeaders()` consolidation — extracted as a utility from `useAuth()` context value (or a thin wrapper), removing the 3 duplicate copies in `useChat.ts`, `usePlan.ts`, `useRuns.ts`
- ChangePasswordPage form fields: `newPassword` + `confirmPassword` (no `currentPassword` needed — user is forced here, hasn't set their own yet); minimum 8 characters
- 401 interceptor queuing strategy for concurrent requests during refresh (standard promise-based queue)
- `localStorage` keys: keep `access_token` and `refresh_token` as key names (replacing `app_password`)
- Error messages: "Invalid email or password" (no credential enumeration), "Network error — please try again"
- Loading states on Login and ChangePassword submit buttons

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend Files to Modify
- `web/src/App.tsx` — auth gate logic, 401 interceptor; major rewrite
- `web/src/pages/PasswordPage.tsx` — replace with `LoginPage.tsx` (email + password)
- `web/src/components/layout/Sidebar.tsx` — logout button → calls API + clears AuthContext
- `web/src/hooks/useChat.ts` — replace `authHeaders()` (x-app-password) with `useAuth()` token
- `web/src/hooks/usePlan.ts` — replace `authHeaders()` with `useAuth()` token
- `web/src/hooks/useRuns.ts` — replace `authHeaders()` with `useAuth()` token

### New Frontend Files
- `web/src/contexts/AuthContext.tsx` — AuthContext + `useAuth()` hook
- `web/src/pages/LoginPage.tsx` — email + password login form
- `web/src/pages/ChangePasswordPage.tsx` — force-change-password form

### Backend File to Modify (small change)
- `api/src/functions/auth.ts` — add `tempPassword` to login response JSON

### Existing Tests to Update
- `web/src/__tests__/App.auth.test.tsx` — rewrite for JWT-based auth gate (currently tests `app_password` in localStorage)
- `web/src/components/layout/Sidebar.test.tsx` — update logout test (API call instead of localStorage clear)

### Architecture References
- `CLAUDE.md` §Architecture Decisions — iOS Safari fixes, cursor-pointer, sidebar layout, AppShell coachOpen state
- `.planning/phases/06-backend-auth-foundation/06-CONTEXT.md` — Phase 6 backend decisions (token lifetime, JWT payload, API contracts)
- `REQUIREMENTS.md` — AUTH-03, AUTH-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns
- `PasswordPage.tsx` — existing card layout (`bg-white rounded-lg shadow-md p-8 w-full max-w-sm`) reusable for `LoginPage` and `ChangePasswordPage`
- `App.tsx` — existing 401 interceptor wraps `window.fetch`; extend it to attempt refresh before clearing auth
- `Sidebar.tsx` — logout button already exists with correct styling; just change the `onClick` to call `POST /api/auth/logout`

### Current Auth Pattern (being replaced)
- `localStorage.getItem('app_password')` → replace with `localStorage.getItem('access_token')`
- `x-app-password` header → replace with `Authorization: Bearer <token>`
- `authHeaders()` defined 3× (in `useChat.ts`, `usePlan.ts`, `useRuns.ts`) → consolidate via `useAuth()`

### Integration Points
- `App.tsx` wraps `ChatProvider` which wraps `AppShell` — `AuthContext` wraps above `ChatProvider`
- `Sidebar` is inside `AppShell` which is inside `BrowserRouter` — can safely call `useAuth()` since it's always under AuthProvider
- `useChat.ts` uses `window.fetch` directly for SSE (chat streaming) — 401 handling for SSE stream is separate from the fetch interceptor

### What Doesn't Change
- All routing inside `AppShell` (`/dashboard`, `/plan`, `/runs`, `/archive`, `/archive/:id`) — unchanged
- `ChatProvider` / `useChat` internal logic (plan XML tags, streaming) — only the auth header changes
- `CoachPanel` mobile/desktop layout — unchanged
- iOS Safari fixes — unchanged

</code_context>

<specifics>
## Specific Requirements

- **Login API call:** `POST /api/auth/login` body `{ email, password }` → `{ token, refreshToken, expiresIn: 900, tempPassword }`. Store `token` as `access_token` and `refreshToken` as `refresh_token` in `localStorage`.
- **Refresh API call:** `POST /api/auth/refresh` body `{ refreshToken }` → `{ token, expiresIn: 900 }`. Update `access_token` in `localStorage`.
- **Logout API call:** `POST /api/auth/logout` header `Authorization: Bearer <token>` body `{ refreshToken }` → 204. Then clear `localStorage` and reset auth state.
- **Change password API call:** `POST /api/auth/change-password` (or `PATCH /api/auth/password`) — define in Phase 7; body `{ newPassword }`; requires valid JWT; sets `tempPassword: false` on the user document.
- **`tempPassword` flag clearing:** After successful password change, update `localStorage` and AuthContext (`tempPassword: false`) so the user reaches the app without re-login.
- **401 interceptor:** Must not retry refresh on calls to `/api/auth/refresh` itself (prevents infinite loop). Must not fire on calls to `/api/auth/login` (obviously unauthenticated).
- **E2E tests:** `e2e/global-setup.ts` seeds a test user — update seed to set `passwordHash` (bcrypt) and appropriate `tempPassword` value. E2E must cover: login success, login failure, force-redirect for temp password, change password flow, logout.

</specifics>

<deferred>
## Deferred Ideas

- **httpOnly cookie for JWT** — noted in Phase 6 context as a future security improvement; not in scope
- **"Remember me" checkbox** — not needed for this closed app
- **Email-based forgot password** — admin-triggered reset only (Phase 9); no self-service email flow
- **Display name in sidebar** — showing logged-in user's email in the sidebar nav is a nice touch but not required; Phase 9 could add it alongside the Admin link

</deferred>

---

*Phase: 07-frontend-auth*
*Context gathered: 2026-04-15*
