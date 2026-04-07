---
phase: quick
plan: 260407-khd
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/components/runs/RunEntryForm.tsx
  - web/src/components/runs/RunDetailModal.tsx
  - web/src/pages/Runs.tsx
  - web/src/index.css
autonomous: true
requirements: []

must_haves:
  truths:
    - "Date inputs display as YYYY-MM-DD on iOS Safari (not locale-formatted)"
    - "Bottom safe area on iOS Safari shows dark gray matching sidebar, no white rectangle"
    - "Logout button stays above the safe area zone, not obscured by home indicator"
  artifacts:
    - path: "web/src/components/runs/RunEntryForm.tsx"
      provides: "text date input with YYYY-MM-DD pattern"
    - path: "web/src/components/runs/RunDetailModal.tsx"
      provides: "text date input with YYYY-MM-DD pattern"
    - path: "web/src/pages/Runs.tsx"
      provides: "text date inputs for filter panel with YYYY-MM-DD pattern"
    - path: "web/src/index.css"
      provides: "safe area background color fill on body/html"
  key_links:
    - from: "web/index.html"
      to: "web/src/index.css"
      via: "viewport-fit=cover already set; index.css adds background color safe area fill"
---

<objective>
Fix two iOS Safari mobile rendering bugs: date inputs showing locale format instead of YYYY-MM-DD, and a white rectangle appearing in the bottom safe area zone.

Purpose: Both bugs degrade the iOS mobile experience. Locale date format confuses users and breaks date filter UX. White rectangle is a visual glitch that breaks the dark sidebar aesthetic on iPhone.
Output: All date inputs use text type with YYYY-MM-DD placeholder/pattern (no locale rendering). Safe area bottom shows dark gray background matching the sidebar.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace type="date" inputs with type="text" + YYYY-MM-DD pattern</name>
  <files>
    web/src/components/runs/RunEntryForm.tsx,
    web/src/components/runs/RunDetailModal.tsx,
    web/src/pages/Runs.tsx
  </files>
  <action>
Replace all `type="date"` inputs with `type="text"` inputs that enforce YYYY-MM-DD format. Three files affected:

**RunEntryForm.tsx** (line 85):
- Change `type="date"` to `type="text"`
- Add `inputMode="numeric"` for mobile numeric keyboard
- Add `placeholder="YYYY-MM-DD"` 
- Add `pattern="\d{4}-\d{2}-\d{2}"` for native validation hint
- Remove `max={todayLocal}` (not applicable to text inputs; date-in-future validation is not currently enforced beyond the max attribute so removing is acceptable)

**RunDetailModal.tsx** (line 212):
- Change `type="date"` to `type="text"`
- Add `inputMode="numeric"`, `placeholder="YYYY-MM-DD"`, `pattern="\d{4}-\d{2}-\d{2}"`

**Runs.tsx** (lines 81 and 90 — the FilterPanel date inputs):
- Change both `type="date"` to `type="text"`
- Add `inputMode="numeric"`, `placeholder="YYYY-MM-DD"`, `pattern="\d{4}-\d{2}-\d{2}"` on both

The value/onChange bindings and YYYY-MM-DD string format in state are already correct — only the input type attribute changes. The existing validation in RunEntryForm already checks `!date` so an empty text input is handled. No state or API changes needed.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>TypeScript build passes. All four date inputs render as text fields with YYYY-MM-DD placeholder on all platforms.</done>
</task>

<task type="auto">
  <name>Task 2: Fill bottom safe area with sidebar background color</name>
  <files>web/src/index.css</files>
  <action>
Add safe area background color to prevent the white rectangle at the bottom of iOS Safari.

In `web/src/index.css`, update the existing `html, body, #root` block to add padding-bottom matching the safe area inset, and set the background color on `body` to match the sidebar (`#111827` which is Tailwind's `gray-900`) so the safe area zone fills dark instead of white.

The approach: set `background-color: #111827` on `body` (dark, matches sidebar) and `background-color: #f9fafb` on `#root` (Tailwind gray-50, matches AppShell). This way:
- The body background bleeds into the safe area zone → dark gray (matching sidebar)
- The `#root` div sits on top and covers the visible content area
- `viewport-fit=cover` is already set in index.html so this takes effect immediately

Updated CSS block:

```css
html,
body,
#root {
  height: 100%;
  overflow: hidden;
}

body {
  background-color: #111827; /* gray-900 — fills iOS safe area bottom with sidebar color */
}

#root {
  background-color: #f9fafb; /* gray-50 — matches AppShell bg */
}
```

The Sidebar's `pb-[max(0.5rem,env(safe-area-inset-bottom))]` already keeps the logout button above the home indicator — no change needed there. The body background color simply ensures whatever shows behind `#root` in the safe zone is dark gray, not white.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>Build passes. On iOS Safari the bottom safe area zone shows dark gray matching the sidebar rather than white. Logout button remains above safe area (existing pb-[max(0.5rem,env(safe-area-inset-bottom))] unchanged).</done>
</task>

</tasks>

<verification>
1. `cd web && npm run build` passes with no TypeScript errors
2. `npm test` in web/ passes — date input tests reference `type="date"` in Runs.test.tsx; update those assertions to `type="text"` if they fail
3. Manual iOS Safari check: date fields show "YYYY-MM-DD" placeholder, bottom of app is dark gray
</verification>

<success_criteria>
- TypeScript build green
- All existing web tests pass (or date-type assertions updated to text)
- No white rectangle at bottom of app on iOS Safari
- Date inputs show YYYY-MM-DD format consistently across platforms
</success_criteria>

<output>
After completion, create `.planning/quick/260407-khd-fix-safari-date-inputs-showing-locale-fo/260407-khd-SUMMARY.md`
</output>
