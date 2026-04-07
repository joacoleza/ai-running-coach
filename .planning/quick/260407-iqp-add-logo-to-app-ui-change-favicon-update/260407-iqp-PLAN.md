---
phase: quick
plan: 260407-iqp
type: execute
wave: 1
depends_on: []
files_modified:
  - web/public/logo.png
  - web/public/favicon.png
  - web/index.html
  - web/src/components/layout/Sidebar.tsx
  - README.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Logo image is visible in the sidebar header area on desktop (md+ screens)"
    - "Logo image is visible in the mobile top bar area (below md breakpoint)"
    - "Favicon in browser tab shows the simplified runner+arrow icon"
    - "README.md displays the logo image at the top"
  artifacts:
    - path: "web/public/logo.png"
      provides: "Full logo for app UI"
    - path: "web/public/favicon.png"
      provides: "Simplified favicon image"
    - path: "web/index.html"
      provides: "Updated favicon link tag pointing to favicon.png"
    - path: "web/src/components/layout/Sidebar.tsx"
      provides: "Logo rendered in sidebar header + mobile top bar"
  key_links:
    - from: "web/index.html"
      to: "web/public/favicon.png"
      via: "<link rel=\"icon\" href=\"/favicon.png\">"
    - from: "web/src/components/layout/Sidebar.tsx"
      to: "web/public/logo.png"
      via: "<img src=\"/logo.png\" alt=\"AI Running Coach\">"
---

<objective>
Add the AI Running Coach logo to the app UI (sidebar header on desktop, mobile top bar area) and update the favicon to use the simplified runner+arrow PNG. Update README.md to show the logo.

Purpose: Give the app a branded identity with a visible logo across all viewports.
Output: Logo in sidebar/mobile UI, new favicon, updated README.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

Architecture notes:
- Sidebar is `web/src/components/layout/Sidebar.tsx` — dark sidebar (`bg-gray-900`), collapsed to `w-16` on mobile, expands to `w-56` on `md+`
- Sidebar header div (`.p-4.hidden.md:block`) currently shows "AI Coach" text — logo replaces this
- On mobile (`< md`), sidebar is icon-only — no room for logo there. Add a small logo strip above the nav items visible only on mobile (`md:hidden`) OR add it as an img-only version in the collapsed state
- `web/public/` is the static assets root — files here are served at `/`
- `web/index.html` currently uses `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` — update to PNG
- AppShell does NOT have a top nav bar — mobile layout is sidebar (icon-only, `w-16`) + main content, no top bar exists
</context>

<tasks>

<task type="checkpoint:human-action">
  <name>Task 1: Copy image files to web/public/</name>
  <what-to-do>
    Copy both image files from Downloads to the web/public/ directory:

    - Copy `C:\Users\joaco\Downloads\logo.png` → `web/public/logo.png`
    - Copy `C:\Users\joaco\Downloads\for-favicon.png` → `web/public/favicon.png`

    Run these commands:
    ```
    cp "C:\Users\joaco\Downloads\logo.png" "C:\dev\ai-running-coach\web\public\logo.png"
    cp "C:\Users\joaco\Downloads\for-favicon.png" "C:\dev\ai-running-coach\web\public\favicon.png"
    ```

    Or use File Explorer to copy them manually. Confirm when done.
  </what-to-do>
  <resume-signal>Type "copied" when both files are in web/public/</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Update favicon and add logo to Sidebar</name>
  <files>web/index.html, web/src/components/layout/Sidebar.tsx</files>
  <action>
    **web/index.html** — Replace the favicon link:
    - Change `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` to `<link rel="icon" type="image/png" href="/favicon.png" />`
    - Also add `<link rel="apple-touch-icon" href="/logo.png" />` for iOS home screen

    **web/src/components/layout/Sidebar.tsx** — Add logo in two places:

    1. Desktop header (already has `hidden md:block` div): Replace the `<h2>AI Coach</h2>` text with an `<img>` tag:
    ```tsx
    <div className="p-4 hidden md:block">
      <img src="/logo.png" alt="AI Running Coach" className="w-full max-w-[140px] rounded-lg" />
    </div>
    ```

    2. Mobile collapsed sidebar (visible only on `< md`): Add a small logo above the nav, centered in the `w-16` column. Insert a new div BEFORE the `<nav>` element (or as a sibling at the top of the aside, before the hidden desktop header):
    ```tsx
    <div className="flex justify-center p-2 md:hidden">
      <img src="/logo.png" alt="AI Running Coach" className="w-10 h-10 rounded-full object-cover" />
    </div>
    ```

    The logo.png has a light blue-ish background — using `rounded-full` with `object-cover` gives it a clean circular appearance against the dark sidebar. Adjust to `rounded-lg` if preferred.

    Keep the existing logout button and nav items unchanged.
  </action>
  <verify>Run `cd /c/dev/ai-running-coach/web && npm run build` — must exit 0 with no TypeScript errors</verify>
  <done>Build passes. index.html points to /favicon.png. Sidebar renders logo img at desktop width and small circular icon on mobile.</done>
</task>

<task type="auto">
  <name>Task 3: Update README.md with logo</name>
  <files>README.md</files>
  <action>
    Add the logo image to the top of README.md, between the title line and the badges block.

    Insert after `# AI Running Coach` and before the first `![Deploy]` badge:

    ```markdown
    <p align="center">
      <img src="web/public/logo.png" alt="AI Running Coach Logo" width="180" />
    </p>
    ```

    This centers the logo in GitHub's Markdown renderer. Keep all existing badges and content below it unchanged.
  </action>
  <verify>File has `<img ... web/public/logo.png ...>` between the h1 and the badges. No other content removed.</verify>
  <done>README.md displays the logo centered above the badges when viewed on GitHub.</done>
</task>

</tasks>

<verification>
After all tasks complete:
1. `cd /c/dev/ai-running-coach/web && npm run build` exits 0
2. `ls web/public/logo.png web/public/favicon.png` — both files exist
3. `grep 'favicon.png' web/index.html` — returns the updated link tag
4. `grep 'logo.png' web/src/components/layout/Sidebar.tsx` — returns img tags for both viewports
5. `grep 'logo.png' README.md` — returns the centered img tag
</verification>

<success_criteria>
- Both PNG files exist in web/public/
- Browser favicon tab shows the simplified runner+arrow icon (favicon.png)
- Desktop sidebar (md+): logo image renders in the header area where "AI Coach" text was
- Mobile sidebar (< md): small circular logo visible in the collapsed w-16 sidebar top
- README.md shows the full logo centered below the h1 title on GitHub
- TypeScript build passes with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/260407-iqp-add-logo-to-app-ui-change-favicon-update/260407-iqp-SUMMARY.md`
</output>
