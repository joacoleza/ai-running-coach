---
phase: quick-260416-jkp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/contexts/AuthContext.tsx
  - web/src/pages/ChangePasswordPage.tsx
  - web/src/__tests__/App.auth.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Change password succeeds in production even if the access token was silently refreshed mid-request"
    - "A 401 on change-password redirects the user to LoginPage rather than showing a dead-end error"
    - "The 401 interceptor does not reinstall on every auth state change"
  artifacts:
    - path: "web/src/contexts/AuthContext.tsx"
      provides: "Stable login/logout references via useCallback"
      exports: ["login", "logout"]
    - path: "web/src/pages/ChangePasswordPage.tsx"
      provides: "Reads fresh token from localStorage on success, handles 401 with logout"
  key_links:
    - from: "web/src/App.tsx"
      to: "AuthContext.login / AuthContext.logout"
      via: "useEffect([login, logout]) — stable refs prevent reinstall gap"
    - from: "web/src/pages/ChangePasswordPage.tsx"
      to: "localStorage.getItem('access_token')"
      via: "read after response.ok to avoid stale closure overwrite"
---

<objective>
Fix three bugs that cause change-password to return 401 in production.

Purpose: Users with temp passwords are blocked from changing them in production because the access token handed to the change-password fetch can be stale or overwritten by a racing interceptor reinstall.
Output: Stable interceptor lifecycle, correct token read-back on success, 401 handled with logout redirect.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@web/src/contexts/AuthContext.tsx
@web/src/pages/ChangePasswordPage.tsx
@web/src/App.tsx
@web/src/__tests__/App.auth.test.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Stabilize login/logout with useCallback in AuthContext</name>
  <files>web/src/contexts/AuthContext.tsx</files>
  <behavior>
    - login and logout refs are stable across renders (same reference identity)
    - AppInner useEffect([login, logout]) does NOT reinstall the interceptor when auth state changes (token refresh)
  </behavior>
  <action>
    In AuthContext.tsx, add `useCallback` to the import list alongside `createContext, useContext, useState`.

    Wrap `login` in `useCallback` with an empty dependency array `[]` — the function body only calls `localStorage.setItem` and `setAuth`, both of which are stable.

    Wrap `logout` in `useCallback` with an empty dependency array `[]` — same reason.

    No other changes. The Provider JSX, readAuthFromStorage, and exported hook are unchanged.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm test -- --run --reporter=verbose src/__tests__/App.auth.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>All App.auth tests pass. login and logout are wrapped in useCallback with [] deps.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix stale token closure and add 401 handling in ChangePasswordPage</name>
  <files>web/src/pages/ChangePasswordPage.tsx, web/src/__tests__/App.auth.test.tsx</files>
  <behavior>
    - On response.ok: calls login() with token read from localStorage (not closure value) so any token refreshed by the interceptor is preserved
    - On response.status === 401: calls logout() which clears auth state and causes App.tsx to render LoginPage
    - On other non-ok responses: unchanged ("Network error — please try again")
  </behavior>
  <action>
    In ChangePasswordPage.tsx:

    1. Destructure `logout` from `useAuth()` in addition to the existing `{ token, login, email, isAdmin }`.

    2. In the `response.ok` branch, replace:
       ```ts
       login(token!, refreshToken, email ?? '', isAdmin, false);
       ```
       with:
       ```ts
       const freshToken = localStorage.getItem('access_token') ?? token ?? '';
       login(freshToken, refreshToken, email ?? '', isAdmin, false);
       ```
       This reads the token that is actually in localStorage at the moment the response arrives, which may have been updated by the 401 interceptor during the flight, rather than the potentially-stale closure value.

    3. Add a new `else if` branch between the `400` branch and the final `else`:
       ```ts
       } else if (response.status === 401) {
         logout();
       ```
       No `setError` call — logout() clears auth state and App.tsx renders LoginPage immediately, which is the correct recovery UX.

    In web/src/__tests__/App.auth.test.tsx, add two tests inside the existing `describe('App auth gate', ...)` block:

    Test A — "ChangePasswordPage calls logout on 401 response":
    - Set localStorage: access_token='fake-jwt', auth_temp_password='true', auth_email='test@example.com'
    - Mock global.fetch to return { ok: false, status: 401 } for /api/auth/change-password
    - render(<App />), confirm "Change Your Password" heading visible
    - fireEvent on the new-password and confirm-password inputs (value='newpass123'), submit the form
    - waitFor: LoginPage is shown (button with name /log in/i) and access_token is null

    Test B — "ChangePasswordPage reads fresh token from localStorage on success":
    - Set localStorage: access_token='old-token', refresh_token='r', auth_temp_password='true', auth_email='test@example.com', auth_is_admin='false'
    - Before fetch resolves, manually set localStorage.setItem('access_token', 'new-token') to simulate interceptor refresh
    - Mock global.fetch to return { ok: true, status: 200 } for change-password
    - render(<App />), submit form
    - waitFor: auth_temp_password is 'false' AND access_token is 'new-token' (not 'old-token')
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm test -- --run --reporter=verbose src/__tests__/App.auth.test.tsx 2>&1 | tail -30</automated>
  </verify>
  <done>All App.auth tests pass including the two new ones. ChangePasswordPage uses freshToken and handles 401 with logout.</done>
</task>

<task type="auto">
  <name>Task 3: Build verification and full test run</name>
  <files></files>
  <action>
    Run the TypeScript build to confirm no type errors introduced by the useCallback wrapping or the new logout destructure.

    Then run the full web test suite to confirm no regressions.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -10 && npm test -- --run 2>&1 | tail -20</automated>
  </verify>
  <done>TypeScript build exits 0. All web unit tests pass with no regressions.</done>
</task>

</tasks>

<verification>
- `web/src/contexts/AuthContext.tsx`: login and logout wrapped in useCallback([])
- `web/src/pages/ChangePasswordPage.tsx`: reads freshToken from localStorage on success; calls logout() on 401
- All existing App.auth tests still pass
- Two new tests cover the 401-logout and fresh-token paths
- TypeScript build clean
</verification>

<success_criteria>
- `npm run build` in web/ exits 0
- `npm test -- --run` in web/ exits 0 with all App.auth tests green
- No stale closure or interceptor reinstall gap can cause a production 401 to silently fail
</success_criteria>

<output>
No SUMMARY file needed for quick fixes. Return results directly.
</output>
