---
plan: 07-02
phase: 07-frontend-auth
status: complete
completed: 2026-04-16
---

# Plan 07-02 Summary: App Auth Wiring

## What Was Built

Wired the auth foundation from Plan 01 into the running app end-to-end.

**App.tsx rewritten** — `AuthProvider` wraps the entire app. `AppInner` component holds a `useEffect`-based global 401 interceptor that calls `POST /api/auth/refresh`, retries the original request on success, and calls `logout()` on failure. Concurrent 401s during refresh are queued and resolved after a single refresh call. Auth gate: unauthenticated → `LoginPage`, `tempPassword: true` → `ChangePasswordPage`, authenticated → `BrowserRouter` + `AppShell`.

**Data hooks migrated** — `useChat.ts` and `usePlan.ts` already imported `useAuth` and used local `authHeaders()` helpers returning `Authorization: Bearer <token>`. `useRuns.ts` uses a module-level `authHeaders()` reading `localStorage.getItem('access_token')` directly (no hook, since the functions are standalone exports).

**Sidebar logout updated** — Calls `POST /api/auth/logout` with the refresh token before calling `logout()` from AuthContext. Client state cleared regardless of API response (catch block).

## Key Files

- `web/src/App.tsx` — Auth gate + 401 interceptor + AuthProvider wrapper
- `web/src/hooks/useChat.ts` — Bearer token via `useAuth()`
- `web/src/hooks/usePlan.ts` — Bearer token via `useAuth()`
- `web/src/hooks/useRuns.ts` — Bearer token via localStorage (module-level helper)
- `web/src/components/layout/Sidebar.tsx` — API logout + AuthContext logout

## Deviations

None. All tasks completed as planned. The subagent ran out of tokens after Task 1 but the remaining work (hooks + Sidebar) was completed by the prior session's App.tsx commit, which covered more than the task boundary described.

## Self-Check: PASSED

- `grep "AuthProvider" web/src/App.tsx` ✓
- `grep "useAuth" web/src/App.tsx` ✓
- `grep "auth/refresh" web/src/App.tsx` ✓
- No `x-app-password` or `app_password` in hooks ✓
- `grep "useAuth" web/src/hooks/useChat.ts` ✓
- `grep "useAuth" web/src/hooks/usePlan.ts` ✓
- `grep "auth/logout" web/src/components/layout/Sidebar.tsx` ✓
- `cd web && npm run build` exits 0 ✓
