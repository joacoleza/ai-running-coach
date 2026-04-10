---
status: resolved
trigger: "Archived plan page shows both the readonly Plan History panel AND the active coach chat (desktop). On mobile, the regular blue coach FAB overrides the gray history FAB from ArchivePlan."
created: 2026-04-09T00:00:00Z
updated: 2026-04-10T00:00:00Z
---

## Current Focus

hypothesis: AppShell unconditionally renders CoachPanel and its FAB on every route, including /archive/:id. ArchivePlan renders a second readonly CoachPanel inside the layout column. There is no route-awareness suppression in AppShell.
test: N/A — confirmed by reading source files
expecting: N/A
next_action: return diagnosis to caller

## Symptoms

expected: /archive/:id shows ONLY the readonly Plan History panel. AppShell's live CoachPanel and its FAB are hidden on this route.
actual: Both AppShell's live CoachPanel (right column, desktop) and ArchivePlan's readonly CoachPanel are visible simultaneously. On mobile the AppShell blue FAB renders at z-40 in the same position as ArchivePlan's gray FAB (also z-40), so the AppShell FAB covers/replaces the gray one.
errors: none — visual/layout issue only
reproduction: Navigate to /archive/:id on any viewport
started: Discovered during Phase 4 UAT

## Eliminated

- hypothesis: CoachPanel itself conditionally hides based on route
  evidence: CoachPanel has no routing logic — it renders purely based on isOpen/readonly props
  timestamp: 2026-04-09T00:00:00Z

- hypothesis: ArchivePlan renders inside a layout that suppresses AppShell's panel
  evidence: App.tsx wraps ALL routes (including /archive/:id) in a single <AppShell>; ArchivePlan is a child passed via {children}
  timestamp: 2026-04-09T00:00:00Z

## Evidence

- timestamp: 2026-04-09T00:00:00Z
  checked: web/src/App.tsx lines 37-48
  found: ALL routes — including /archive/:id — are wrapped in a single <AppShell>. There is no per-route AppShell exclusion or route-conditional rendering.
  implication: AppShell.CoachPanel renders on every page, including /archive/:id.

- timestamp: 2026-04-09T00:00:00Z
  checked: web/src/components/layout/AppShell.tsx lines 42-70
  found: AppShell renders CoachPanel unconditionally (line 52) and its FAB based only on coachOpen state + plan status (lines 42-44). No useLocation() or route-awareness of any kind.
  implication: The AppShell CoachPanel is always mounted and visible as a right column on desktop (md:flex is always applied when isOpen is false — line 85 of CoachPanel.tsx). The FAB renders whenever showFab is true, regardless of route.

- timestamp: 2026-04-09T00:00:00Z
  checked: web/src/components/coach/CoachPanel.tsx lines 83-85
  found: When isOpen=false, asideClass = 'hidden md:flex md:flex-col md:w-80 lg:w-96 md:border-l md:border-gray-200 md:bg-white md:h-screen md:sticky md:top-0'. The panel is hidden on mobile but ALWAYS VISIBLE on desktop (md:flex).
  implication: On desktop, AppShell's CoachPanel is a visible right column on every page, including /archive/:id. This is why both panels appear side by side.

- timestamp: 2026-04-09T00:00:00Z
  checked: web/src/pages/ArchivePlan.tsx lines 96-127
  found: ArchivePlan renders its own CoachPanel (readonly) plus its own gray FAB at z-40. The FAB has md:hidden so it only shows on mobile. AppShell's FAB (AppShell.tsx line 59) is also fixed bottom-6 right-4 z-40 md:hidden.
  implication: On mobile both FABs are fixed at the same position (bottom-6 right-4) with the same z-index (z-40). AppShell's FAB renders in the DOM after ArchivePlan's FAB (AppShell is the parent, but its FAB is a sibling portal-like fixed element). With equal z-index the paint order determines which is on top — the AppShell FAB appears later in DOM order so it paints on top, covering the gray one.

## Resolution

root_cause: |
  Two independent root causes, one per symptom:

  1. DESKTOP — AppShell always renders CoachPanel as a visible right column (md:flex in the closed state CSS at CoachPanel.tsx:85). There is no route-awareness in AppShell. On the /archive/:id route, ArchivePlan also renders a readonly CoachPanel inside the flex row returned by ArchivePlan. Result: two CoachPanel columns appear side by side on desktop.

  2. MOBILE — AppShell renders a blue FAB (fixed bottom-6 right-4 z-40 md:hidden) on every route when showFab is true. ArchivePlan renders a gray FAB at the same fixed position and same z-index (z-40 md:hidden). The AppShell FAB is later in DOM paint order (it is mounted in AppShell's return, which renders after {children}), so it paints on top and covers the ArchivePlan gray FAB entirely.

fix: |
  AppShell needs route-awareness to suppress its own CoachPanel and FAB when on /archive/:id.

  Approach: Use useLocation() in AppShell. Derive a boolean — e.g. const isArchivePlanRoute = /^\/archive\/.+/.test(location.pathname). Then:
    - Pass isArchivePlanRoute to CoachPanel or conditionally render it: only render AppShell's CoachPanel when NOT on that route.
    - Gate the FAB behind the same flag: the existing showFab condition becomes showFab && !isArchivePlanRoute.

  Alternative (lower coupling): Accept a prop on AppShell (e.g. hideCoach?: boolean) and pass it from the route level. This is more invasive — requires App.tsx to know which routes suppress the panel.

  The useLocation approach is simpler and self-contained within AppShell.

verification: ""
files_changed: []
