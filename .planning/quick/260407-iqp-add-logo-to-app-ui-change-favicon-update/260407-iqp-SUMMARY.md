---
phase: quick
plan: 260407-iqp
subsystem: web/ui
tags: [branding, logo, favicon, sidebar]
tech-stack:
  added: []
  patterns: [static-asset-in-public, img-in-sidebar]
key-files:
  created:
    - web/public/logo.png
    - web/public/logo-bg.png
    - web/public/favicon.png
    - .planning/quick/260407-iqp-add-logo-to-app-ui-change-favicon-update/260407-iqp-SUMMARY.md
  modified:
    - web/index.html
    - web/src/components/layout/Sidebar.tsx
    - README.md
decisions:
  - "Mobile and desktop logos wrapped in bg-white rounded-full container — transparent PNG requires white background against dark sidebar"
  - "favicon.svg removed in favour of user-supplied favicon.png (transparent background)"
  - "logo-bg.png (white background) used in README for better GitHub rendering"
  - "Replaced 'AI Coach' h2 text entirely with img tag — cleaner branding without redundant text"
metrics:
  duration: "5 min"
  completed: "2026-04-07"
  tasks: 2
  files: 5
---

# Quick Task 260407-iqp: Add Logo to App UI, Update Favicon and README — Summary

**One-liner:** Added AI Running Coach logo PNG to desktop sidebar header and mobile collapsed sidebar, replaced SVG favicon with simplified PNG icon, and added centered logo to README.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 2 | Update favicon and add logo to Sidebar | 5d5c94b | web/index.html, web/src/components/layout/Sidebar.tsx, web/public/logo.png, web/public/favicon.png |
| 3 | Update README.md with logo | 5d5c94b | README.md |

Note: Task 1 (copy image files) was already completed before execution began.

## Changes Made

### web/index.html
- Replaced `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` with `<link rel="icon" type="image/png" href="/favicon.png">`
- Added `<link rel="apple-touch-icon" href="/logo.png">` for iOS home screen

### web/src/components/layout/Sidebar.tsx
- Removed `<h2 className="text-lg font-bold">AI Coach</h2>` from desktop header
- Added `<img src="/logo.png" alt="AI Running Coach" className="w-full max-w-[140px] rounded-lg">` in desktop header (hidden md:block)
- Added `<img src="/logo.png" alt="AI Running Coach" className="w-10 h-10 rounded-full object-cover">` for mobile collapsed sidebar (md:hidden)

### README.md
- Added `<p align="center"><img src="web/public/logo.png" ...></p>` between h1 title and first badge line

## Verification

- `npm run build` in web/: exit 0, no TypeScript errors
- Both PNG files exist in web/public/
- favicon.png linked in index.html
- logo.png rendered in Sidebar for both desktop and mobile viewports
- README.md displays logo centered above badges

## Deviations from Plan

None — plan executed exactly as written. The plan referenced `AppShell.tsx` in context notes but identified `Sidebar.tsx` as the correct target file, which matches the actual component structure.

## Known Stubs

None.

## Self-Check: PASSED

- web/public/logo.png: FOUND
- web/public/favicon.png: FOUND
- web/index.html favicon.png reference: FOUND
- web/src/components/layout/Sidebar.tsx logo img tags: FOUND (x2)
- README.md logo img tag: FOUND
- Commit 5d5c94b: FOUND
