---
phase: quick-260423-wnm
plan: 01
subsystem: web-ui
tags: [sidebar, auth-pages, ux-polish]
tech-stack:
  added: []
  patterns: [useState-toggle, useRef-outside-click]
key-files:
  modified:
    - web/src/components/layout/Sidebar.tsx
    - web/src/pages/LoginPage.tsx
    - web/src/pages/ChangePasswordPage.tsx
decisions:
  - Extracted EyeIcon into a local helper component in ChangePasswordPage to avoid duplicating the two SVG paths twice
  - Outside-click handler uses mousedown (not click) so dropdown closes before any other click handler fires
metrics:
  duration: ~8 minutes
  completed: 2026-04-23
---

# Quick Task 260423-wnm: Sidebar email header dropdown + password visibility toggles

**One-liner:** Sidebar header row with logo + email + chevron dropdown (Logout), and eye-icon show/hide toggle on all password inputs.

## What Was Built

### Task 1: Sidebar header dropdown

`Sidebar.tsx` was rewritten to replace the two separate logo blocks (mobile `md:hidden` and desktop `hidden md:flex`) and the standalone bottom logout button with a single unified header row that adapts to both breakpoints:

- `useRef<HTMLDivElement>` + `useEffect` mousedown listener for outside-click dismissal
- `useState<boolean>` for `dropdownOpen`
- Header button: logo (w-8/md:w-9) + email span (hidden on mobile, truncated on desktop) + chevron (rotates 180deg when open, hidden on mobile)
- Dropdown: absolutely positioned below header, contains Logout button with the same POST `/api/auth/logout` + `logout()` logic from the old bottom button
- `email` added to `useAuth()` destructure

Bottom `<div className="p-2 pb-[max(...)]">` logout block fully removed.

### Task 2: Password visibility toggles

**LoginPage.tsx:** Added `showPassword` state. Password `<input>` wrapped in `<div className="relative">`, `pr-9` added to input class. Toggle button positioned `absolute inset-y-0 right-0` with eye/eye-slash SVG icons.

**ChangePasswordPage.tsx:** Added `showNew` and `showConfirm` states. Same pattern applied to both "New Password" and "Confirm Password" inputs. Extracted a local `EyeIcon` component to avoid repeating the two SVG paths four times. Validation messages (`tooShort`, `mismatch`) remain outside the relative wrapper, below the input div.

## Deviations from Plan

**[Rule 2 - Minor refactor] EyeIcon extracted to local component**
- Found during: Task 2
- Issue: ChangePasswordPage needed the same eye/eye-slash SVG pair on two fields — duplicating inline SVGs four times would be noisy
- Fix: Extracted `EyeIcon({ visible })` as a local helper component in the same file
- Files modified: web/src/pages/ChangePasswordPage.tsx
- No behavioral difference from the plan specification

## Known Stubs

None.

## Self-Check: PASSED

- web/src/components/layout/Sidebar.tsx: exists, useRef + dropdownRef present, no bottom logout div
- web/src/pages/LoginPage.tsx: exists, showPassword state, type={showPassword ? 'text' : 'password'}
- web/src/pages/ChangePasswordPage.tsx: exists, showNew + showConfirm states, both inputs have dynamic type
- Commit f7d3b34: exists
- TypeScript build: passes (tsc -b && vite build, no errors)
