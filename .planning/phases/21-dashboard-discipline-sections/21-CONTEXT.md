# Phase 21: Dashboard Discipline Sections - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the dashboard into named, per-discipline sections (Run, Cycling, Gym). Each section has its own stat cards and dedicated charts. Sections auto-hide when the active time filter returns no data for that discipline.

This phase does NOT add new data sources or API endpoints — it is a frontend reorganization of existing dashboard components and data already computed in `useDashboard.ts`.

</domain>

<decisions>
## Implementation Decisions

### All-Discipline ("All") Mode Layout
- **D-01:** When the discipline filter is "All", render all three sections stacked vertically: Run → Cycling → Gym.
- **D-02:** The existing combined `WeeklyVolumeChart` (all 3 disciplines in one bar chart) is **removed**. Each section has its own charts instead.
- **D-03:** Sections are hidden when the active time filter returns no data for that discipline (i.e. no runs of that type in the selected range).

### Single-Discipline Mode
- **D-04:** When a specific discipline is selected (Run / Gym / Cycle), only that discipline's section is shown. Behavior is consistent — same section components, just one visible.

### Stat Cards
- **D-05:** Stat cards move **inside each section** — no top-level global stat card row remains.
- **D-06:** Run section stats: Total Distance, Total Runs, Total Time (+ Adherence if `current-plan` filter active).
- **D-07:** Cycling section stats: Total Distance, Avg Speed, Total Time (+ Adherence if `current-plan` filter).
- **D-08:** Gym section stats: Total Sessions, Total Duration (+ Adherence if `current-plan` filter).

### Section Headers
- **D-09:** Each section header shows the discipline name **with a count inline**: e.g. "Run (14 sessions)" or "Cycling (8 sessions)" or "Gym (6 sessions)". Use the word "sessions" universally across all disciplines.
- **D-10:** Section headers use the established discipline colors: run=blue (#3b82f6), gym=orange (#f97316), cycle=green (#22c55e).

### Cycling Speed Chart
- **D-11:** Create a new `WeeklySpeedChart.tsx` component for the cycling section — mirrors the existing pace line chart in structure but shows km/h on the Y-axis. Same patterns: `connectNulls={false}`, `domain={['auto', 'auto']}`, weekly buckets.
- **D-12:** Cycling section charts: Weekly Distance bar chart + Weekly Avg Speed line chart (`WeeklySpeedChart`).

### Run Section Charts
- **D-13:** Run section charts: Weekly Distance bar chart + Weekly Avg Pace line chart (existing). Pace vs HR chart included if HR data exists.

### Gym Section Charts
- **D-14:** Gym section charts: Weekly Duration bar chart (new — duration in minutes per week) + Weight Progression chart (existing `WeightProgressionChart`).

### WeightProgressionChart Default Exercise
- **D-15:** Auto-select the exercise with the most data points (entries across all gym sessions). Computed **client-side** from the gym runs already loaded by `useDashboard` — no new API call. Count exercise occurrences across all loaded gym session `exercises` arrays, pick the name with the highest count, and pass it as the `defaultExercise` prop to `WeightProgressionChart`.

### Claude's Discretion
- Chart component file structure: whether to add a shared `DisciplineSection` wrapper component or inline section HTML per discipline in `Dashboard.tsx` — Claude decides.
- Whether to keep the gym weekly duration chart as a `WeeklyDurationChart.tsx` component or inline the Recharts code in the Gym section — Claude decides.
- Exact visual styling of section dividers/headers (subtle `border-t`, colored left border, pill badge, etc.) — Claude decides, consistent with the app's existing `border border-gray-200 rounded-lg` card style.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing dashboard code to read before planning
- `web/src/pages/Dashboard.tsx` — current layout, `renderStatCards()`, chart grid structure
- `web/src/hooks/useDashboard.ts` — `filterRunsByDiscipline`, `groupRunsByWeek`, `groupRunsByDiscipline`, `computeStats`, data pipeline
- `web/src/components/dashboard/WeeklyVolumeChart.tsx` — existing multi-discipline bar chart (to be removed)
- `web/src/components/dashboard/WeightProgressionChart.tsx` — existing gym weight chart (to be adapted with `defaultExercise` prop)
- `web/src/components/dashboard/DisciplineSelector.tsx` — existing filter component (no changes expected)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WeightProgressionChart` — receives `exerciseOptions: string[]`; needs a new `defaultExercise?: string` prop added so it auto-selects on mount.
- `DisciplineSelector` — no changes; still controls `activeDiscipline` at page level.
- `filterRunsByDiscipline(runs, discipline)` in `useDashboard.ts` — use to get per-discipline run arrays for each section.
- `groupRunsByWeek(runs)` + `fillWeekGaps(sorted)` — use per-discipline to compute weekly buckets for each section's distance/duration charts.
- `computeStats(runs, plan, filter, linkedRuns, activeDiscipline)` — call once per section with the discipline-filtered run array and matching `activeDiscipline` value.
- `parseDurationToMinutes` and `formatTotalTime` — use in gym weekly duration aggregation.

### Established Patterns
- All chart containers: `bg-white border border-gray-200 rounded-lg p-4` with `h2` heading.
- Grid layout: `grid grid-cols-1 md:grid-cols-2 gap-6` for chart pairs within a section.
- Stat card grid: `grid grid-cols-2 md:grid-cols-4 gap-4 mb-6`.
- Empty state: `<p className="text-gray-500 text-sm text-center py-12">` inside a `minHeight: 300` div.
- Discipline colors exported as `DISCIPLINE_COLORS` from `Dashboard.tsx`.

### Integration Points
- `useDashboard` currently computes `weeklyData` and `paceData` from ALL runs (not discipline-filtered). These will need to be replaced by per-discipline computed datasets, or `useDashboard` needs to expose per-discipline run arrays.
- `multiWeeklyData` (from `groupRunsByDiscipline`) was used by the combined `WeeklyVolumeChart` — this becomes unused after removing the combined chart.
- The `activeDiscipline` state and `DisciplineSelector` remain at the page level; each section receives the discipline-filtered run array as a prop (or computed inline).

</code_context>

<specifics>
## Specific Ideas

- Section header format confirmed: `"Run (14 sessions)"` — use the word "sessions" universally across all three disciplines (not "runs" for run).
- The three section order is fixed: Run first, Cycling second, Gym third.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-dashboard-discipline-sections*
*Context gathered: 2026-05-10*
