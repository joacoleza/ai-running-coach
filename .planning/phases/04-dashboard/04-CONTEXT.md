# Phase 4: Dashboard — Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a real dashboard home page replacing the current placeholder. Dashboard becomes the app home (`/` → `/dashboard`) and the first item in the sidebar. Includes date-filtered training stats, volume and pace charts, and readonly archived plan chat history.

**Explicitly dropped from original Phase 4 scope:**
- Plan import from LLM conversation (IMP-01, IMP-02, IMP-03) — not needed
- Chat history as a dedicated section (DASH-04) — replaced by archived plan chat history below

</domain>

<decisions>
## Implementation Decisions

### Navigation & Home

- **D-01:** Dashboard becomes the home page — `"/"` redirects to `"/dashboard"` (replacing current `"/plan"` redirect)
- **D-02:** Sidebar order changes to: Dashboard → Training Plan → Runs → Archive
- **D-03:** Adherence % stat card is clickable and navigates to `/plan`

### Date Range Filter

- **D-04:** Filter presets: **Current Plan (default) / Last 4 weeks / Last 8 weeks / Last 3 months / Last 12 months / This year / All time**
- **D-05:** Default filter on load: **Current Plan**
- **D-06:** When "Current Plan" is active, only runs with `planId` matching the active plan are used as data input for all charts and stats. When no active plan exists, fall back gracefully (empty state or prompt to create a plan).
- **D-07:** All other filters (Last 4 weeks, etc.) use all runs regardless of plan linkage, filtered by date

### Stats Cards

- **D-08:** Four stat cards: **Total Distance · Total Runs · Total Time · Adherence %**
- **D-09:** Stats are scoped to the currently selected date range / filter
- **D-10:** Adherence % = completed plan days / total non-rest plan days in the filtered window (only meaningful for "Current Plan" filter; for date-based filters, show completed linked runs vs total planned days in that range)
- **D-11:** Adherence % card is clickable → navigates to `/plan`

### Charts

- **D-12:** Two charts: **Weekly Volume (bar chart)** and **Pace Trend (line chart)**
- **D-13:** Layout order: Stats cards → Volume chart → Pace chart
- **D-14:** No recent runs section — user uses the Runs page for that
- **D-15:** Mobile chart layout: Claude's discretion (stack vertically recommended)
- **D-16:** No charting library currently installed — Claude picks an appropriate library (Recharts recommended for React/Tailwind stacks)

### Archived Plan Chat History

- **D-17:** When viewing an archived plan (`/archive/:id`), the coach panel on the right shows the **readonly** chat history from when that plan was active
- **D-18:** Same panel position as the active coach panel (right column on desktop `md+`, FAB-triggered overlay on mobile)
- **D-19:** Panel is NOT auto-opened on mobile — user taps the FAB to open it
- **D-20:** Desktop: panel is always visible (consistent with active plan behavior)
- **D-21:** The FAB and/or panel should have a visual indicator that it is readonly — different color or label (e.g. "History" instead of the chat bubble icon, or a muted/gray color scheme)
- **D-22:** Empty state is not needed — plans are always created from a chat, so history always exists
- **D-23:** Readonly mode: no input box, no send button — messages display only

### Claude's Discretion

- Mobile chart layout (stack vertically is the obvious choice)
- Charting library selection (Recharts is the standard choice for this stack)
- Exact visual treatment for readonly panel indicator (color, label, icon variant)
- Empty state copy when no active plan exists and "Current Plan" filter is selected

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing hooks and data model
- `web/src/hooks/useRuns.ts` — Run type definition and fetch functions; `planId` field identifies linked runs
- `web/src/hooks/usePlan.ts` — Plan type, active plan fetch, `linkedRuns` map
- `web/src/pages/ArchivePlan.tsx` — Existing archived plan view (readonly); needs CoachPanel wired in
- `web/src/components/layout/Sidebar.tsx` — Nav order to update
- `web/src/App.tsx` — Route redirects to update (`/` → `/dashboard`)
- `web/src/components/coach/CoachPanel.tsx` — Needs readonly mode for archived plan view

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRuns.ts` — `fetchRuns()` supports `dateFrom`/`dateTo`/`planId`/`unlinked` filters — can drive all dashboard data fetching
- `usePlan.ts` — exposes `plan`, `linkedRuns` map, `activePlanId` — adherence calculation can be derived here
- `CoachPanel` — currently supports `isOpen`/`onClose` props; needs a `readonly` + `messages` prop for archive mode
- `AppShell` — owns `coachOpen` state and passes it to CoachPanel; `ArchivePlan` page will need its own panel wiring outside AppShell

### Established Patterns
- Tailwind CSS throughout — no new CSS frameworks
- `window.confirm` for destructive actions (not applicable here but worth noting)
- `cursor-pointer` global rule covers buttons/links automatically
- Stats/data pages fetch on mount, show loading skeleton or spinner

### Integration Points
- `App.tsx` — change `"/"` redirect from `/plan` to `/dashboard`
- `Sidebar.tsx` — reorder nav items: Dashboard first
- `ArchivePlan.tsx` — wire readonly CoachPanel alongside the plan view
- New `useDashboard` hook or inline fetching in `Dashboard.tsx` — fetches runs + plan for the selected filter

</code_context>

<specifics>
## Specific Ideas

- "Current Plan" filter makes the dashboard plan-centric by default — the whole view is about how you're tracking against your active plan
- Adherence % as the clickable card that links to `/plan` is intentional — it's the most plan-relevant stat
- Readonly chat on archived plans fills the gap left by dropping the generic chat history section — it's contextually relevant (you see the plan AND the coaching conversation that built it)
- FAB visual differentiation for readonly mode: user suggested different color or "History" label

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Dropped requirements (not deferred — intentionally removed)
- IMP-01/02/03 (Plan import from LLM conversation) — user confirmed not needed
- DASH-04 (Chat history dedicated section) — replaced by archived plan readonly chat (D-17 through D-23)

</deferred>

---

*Phase: 04-dashboard*
*Context gathered: 2026-04-08*
