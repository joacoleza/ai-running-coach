---
phase: quick-260423-wnm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/components/layout/Sidebar.tsx
  - web/src/pages/LoginPage.tsx
  - web/src/pages/ChangePasswordPage.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "Sidebar header shows logo + user email on one row with a chevron; clicking it opens a dropdown with Logout"
    - "Standalone logout button at sidebar bottom is removed"
    - "Password fields on LoginPage and ChangePasswordPage have a show/hide toggle eye icon"
  artifacts:
    - path: "web/src/components/layout/Sidebar.tsx"
      provides: "Logo+email header row with logout dropdown, no bottom logout button"
    - path: "web/src/pages/LoginPage.tsx"
      provides: "Password field with show/hide toggle"
    - path: "web/src/pages/ChangePasswordPage.tsx"
      provides: "Both password fields (new + confirm) with show/hide toggle"
  key_links:
    - from: "Sidebar.tsx"
      to: "useAuth()"
      via: "email + token + logout from useAuth()"
      pattern: "useAuth"
---

<objective>
Three UI polish changes to Sidebar and auth pages.

1. Sidebar header: replace the standalone logo block + bottom logout button with a single header row showing logo + user email + chevron. Clicking the row opens a small dropdown menu with a "Logout" item. Works identically on mobile (icon-only sidebar) and desktop.

2. Password visibility toggle: add an eye icon button inside the password input(s) on LoginPage and ChangePasswordPage, toggling between type="password" and type="text".

Purpose: Better UX — email visible at a glance, logout accessible from the top rather than buried at the bottom, password fields less frustrating on mobile.
Output: Updated Sidebar.tsx, LoginPage.tsx, ChangePasswordPage.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@web/src/components/layout/Sidebar.tsx
@web/src/pages/LoginPage.tsx
@web/src/pages/ChangePasswordPage.tsx
@web/src/contexts/AuthContext.tsx

<interfaces>
From web/src/contexts/AuthContext.tsx (useAuth() hook):
```typescript
// Relevant fields returned by useAuth():
token: string | null
email: string | null
isAdmin: boolean
logout: () => void
```

Current Sidebar structure:
- Mobile header: centered logo in a small white circle (py-3, md:hidden)
- Desktop header: centered logo in large white circle (p-4, hidden md:flex)
- nav flex-1: NavLinks + optional Admin link
- Bottom div: standalone logout button with `pb-[max(0.5rem,env(safe-area-inset-bottom))]`

The logout logic in the bottom button calls POST /api/auth/logout then logout(). This logic must be preserved in the new dropdown item.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Sidebar — replace logo+logout with email header dropdown</name>
  <files>web/src/components/layout/Sidebar.tsx</files>
  <action>
Rewrite Sidebar.tsx to:

1. Add `useState` for `dropdownOpen` (boolean, default false).
2. Add a `useRef<HTMLDivElement>(null)` for the dropdown container to close on outside click via a `useEffect` that listens for `mousedown` events and calls `setDropdownOpen(false)` when click is outside the ref element.
3. Replace both logo header blocks (mobile `md:hidden` and desktop `hidden md:flex`) with a SINGLE header row that works on both breakpoints:

```tsx
<div ref={dropdownRef} className="relative">
  <button
    type="button"
    onClick={() => setDropdownOpen(prev => !prev)}
    className="flex items-center w-full px-3 py-3 hover:bg-gray-800 transition-colors cursor-pointer"
    aria-haspopup="true"
    aria-expanded={dropdownOpen}
  >
    {/* Logo — small on mobile, slightly larger on desktop */}
    <div className="bg-white rounded-full p-1 flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-9 md:h-9">
      <img src="/logo.png" alt="AI Running Coach" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
    </div>
    {/* Email — hidden on mobile (icon-only sidebar), visible on desktop */}
    <span className="ml-2 flex-1 text-xs text-gray-300 truncate hidden md:block">
      {email ?? ''}
    </span>
    {/* Chevron — hidden on mobile */}
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 flex-shrink-0 hidden md:block transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {/* Dropdown menu */}
  {dropdownOpen && (
    <div className="absolute left-0 right-0 top-full bg-gray-800 border border-gray-700 rounded shadow-lg z-50">
      <button
        type="button"
        onClick={async () => {
          setDropdownOpen(false);
          const refreshToken = localStorage.getItem('refresh_token');
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Authorization': `Bearer ${token ?? ''}`,
              },
              body: JSON.stringify({ refreshToken }),
            });
          } catch {
            // ignore — clear client state regardless
          }
          logout();
        }}
        className="flex items-center w-full px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </div>
  )}
</div>
```

4. Remove the entire bottom `<div className="p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">` block (the old standalone logout button). The safe-area padding hack is no longer needed since the logout button is gone from the bottom.

5. Add `email` to the destructured `useAuth()` call: `const { token, logout, isAdmin, email } = useAuth();`

6. Add `useRef` to the React import.

Keep all existing nav items and Admin link unchanged.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>Sidebar renders logo + email header with chevron dropdown containing Logout. Bottom logout button is gone. TypeScript build passes.</done>
</task>

<task type="auto">
  <name>Task 2: Show/hide password toggle on LoginPage and ChangePasswordPage</name>
  <files>web/src/pages/LoginPage.tsx, web/src/pages/ChangePasswordPage.tsx</files>
  <action>
Pattern for both files: add a `useState<boolean>` per password field (e.g. `showPassword`), wrap the `<input>` in a `relative` div, add a toggle button inside the div positioned at the right.

**LoginPage.tsx:**

Add `const [showPassword, setShowPassword] = useState(false);` near the top (after existing state).

Replace the password field's `<div className="mb-4">` block:

```tsx
<div className="mb-4">
  <label htmlFor="login-password" className="block text-xs font-medium text-gray-700 mb-1">
    Password
  </label>
  <div className="relative">
    <input
      id="login-password"
      type={showPassword ? 'text' : 'password'}
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="w-full border border-gray-300 rounded px-2 py-1.5 pr-9 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={loading}
      autoComplete="current-password"
    />
    <button
      type="button"
      onClick={() => setShowPassword(prev => !prev)}
      className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
      tabIndex={-1}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  </div>
</div>
```

Note the `pr-9` added to the input class so text doesn't overlap the toggle button.

**ChangePasswordPage.tsx:**

Add two state variables: `const [showNew, setShowNew] = useState(false);` and `const [showConfirm, setShowConfirm] = useState(false);`

Apply the same pattern to both the "New Password" and "Confirm Password" inputs. Use `showNew`/`setShowNew` for the first field and `showConfirm`/`setShowConfirm` for the second. Keep the existing helper text "Minimum 8 characters" and validation messages (`tooShort`, `mismatch`) in place — they go outside the relative wrapper, directly after the `</div>` of the input wrapper.

Layout for ChangePasswordPage New Password field:
```tsx
<div className="mb-4">
  <label htmlFor="new-password" className="block text-xs font-medium text-gray-700 mb-1">
    New Password
  </label>
  <div className="relative">
    <input
      id="new-password"
      type={showNew ? 'text' : 'password'}
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      className="w-full border border-gray-300 rounded px-2 py-1.5 pr-9 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={loading}
      autoFocus
      autoComplete="new-password"
    />
    {/* eye toggle button same as LoginPage */}
  </div>
  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
  {tooShort && <p className="text-red-600 text-sm mt-1">Password must be at least 8 characters</p>}
</div>
```

Same pattern for Confirm Password with `showConfirm`/`setShowConfirm`.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>Password fields on both pages show an eye icon button that toggles visibility. TypeScript build passes with no errors.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    1. Sidebar header row: logo + email + chevron, opens dropdown with Logout. Old bottom logout button removed.
    2. Show/hide password toggle on LoginPage and ChangePasswordPage.
  </what-built>
  <how-to-verify>
    1. Open the app. Sidebar should show logo + your email address on one row with a down-chevron.
    2. Click the header row — a dropdown should appear with a "Logout" option.
    3. Click "Logout" — should log you out and show the login page.
    4. On the login page, type something in the Password field — eye icon should appear on the right. Clicking it should reveal/hide the password.
    5. Log back in, go to Change Password (if accessible) — both New Password and Confirm Password fields should have eye toggles.
    6. On mobile (or narrow viewport): sidebar should be icon-only (just the logo in the header, no email text), but clicking the logo area should still open the dropdown with Logout.
    7. Confirm no logout button exists at the bottom of the sidebar.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues found.</resume-signal>
</task>

</tasks>

<verification>
- `cd web && npm run build` passes with no TypeScript errors
- Sidebar.tsx has no bottom logout div
- Sidebar.tsx imports `useRef` and uses `dropdownRef` for outside-click handling
- LoginPage.tsx password input has `type={showPassword ? 'text' : 'password'}`
- ChangePasswordPage.tsx both inputs have dynamic type
</verification>

<success_criteria>
- Sidebar header row shows logo + email + chevron on desktop; logo only on mobile
- Clicking the header opens a dropdown with Logout
- Old bottom logout button is completely removed (no pb-safe-area hack either)
- Password inputs on login and change-password pages have show/hide toggles
- TypeScript build passes
</success_criteria>

<output>
After completion, create `.planning/quick/260423-wnm-sidebar-user-email-display-with-logout-d/260423-wnm-SUMMARY.md` with what was built and any notable implementation decisions.
</output>
