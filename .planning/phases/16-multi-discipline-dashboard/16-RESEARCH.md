# Phase 16: Multi-Discipline Dashboard - Research

**Researched:** 2026-05-09
**Domain:** React Dashboard UI + API Data Aggregation
**Confidence:** HIGH

## Summary

Phase 16 extends the existing single-discipline dashboard (run-only) to support filtered views across all three disciplines: Run, Gym, and Cycle. The dashboard gains a discipline selector control that scopes stat cards and charts, and introduces a new weight progression chart specific to gym sessions. All infrastructure changes are backward compatible; existing run-only data continues to work. The implementation reuses Recharts (already a dependency at ^3.8.1) and the established `useDashboard` hook pattern, adding discipline filtering client-side and a new `/api/runs/exercise-weights` endpoint server-side.

**Primary recommendation:** Discipline filtering is implemented client-side (filter runs after fetch), not as a query parameter change to `GET /api/runs`. The existing `discipline` query parameter on `GET /api/runs` is already functional from Phase 14 but is used only by the Activities (Runs list) page. Reuse this same parameter for dashboard aggregation. Add a new `/api/runs/exercise-weights?exercise=...` endpoint to fetch max weight per session for a selected exercise.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. Research proceeds with full discretion across all domains.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard has a discipline selector (All / Run / Gym / Cycle) that scopes all displayed data | DisciplineSelector button component state management; `activeDiscipline` state in useDashboard hook |
| DASH-02 | Stat cards adapt to selected discipline — gym shows sessions count + total duration; run/cycle show distance + pace/speed | Conditional stat computation in `computeStats()`, discipline-aware card rendering in Dashboard.tsx |
| DASH-03 | Weekly volume chart shows all disciplines in the same view, color-coded (run=blue, gym=orange, cycle=green) | ComposedChart with multi-discipline bars; existing `groupRunsByWeek()` extended to track discipline per bucket |
| DASH-04 | Weight progression chart shows max weight per session for a user-selected exercise over time | New `/api/runs/exercise-weights?exercise=...` endpoint; WeightProgressionChart component with exercise dropdown |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | UI framework | Existing codebase standard |
| TypeScript | 5.6.3 | Type safety | Existing project convention |
| Tailwind CSS | 4.2.2 | Styling | Existing design system |
| Recharts | 3.8.1 | Charts (BarChart, LineChart, ComposedChart) | Already used in current dashboard; no additional deps needed |
| date-fns | 4.1.0 | Date manipulation | Already used for week bucketing |
| react-router-dom | 7.13.1 | Routing | Existing navigation |

### Supporting (Data Layer)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MongoDB | (server) | Persistence | Existing backend data store |
| @azure/functions | 4.5.0 | HTTP handlers | Existing Azure Functions pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Chart.js / Visx | Recharts already in use; switching libs would require refactor of existing Weekly Volume chart and adds cognitive load |
| Client-side discipline filtering | Server-side filter param | Client-side is simpler given `GET /api/runs` already returns all user runs; no additional DB query optimization needed for v1 |
| Exercise dropdown selector | Auto-suggest / multi-select | Single-select dropdown is sufficient for weight progression; multi-exercise comparison deferred to future |

**Installation:** No new packages required — all dependencies already present.

## Architecture Patterns

### Recommended Project Structure

Existing structure unchanged. New/modified files:
```
web/src/
├── pages/Dashboard.tsx              # (modified) Add DisciplineSelector, stat card logic
├── components/dashboard/
│   ├── DisciplineSelector.tsx       # (new) Button group for All/Run/Gym/Cycle
│   ├── StatCard.tsx                 # (new, or extend inline) Discipline-aware stat rendering
│   ├── WeeklyVolumeChart.tsx        # (new) Multi-discipline bar chart
│   └── WeightProgressionChart.tsx   # (new) Exercise weight trend line chart
└── hooks/useDashboard.ts            # (modified) Add activeDiscipline state, filterRunsByDiscipline()

api/src/
└── functions/
    ├── runs.ts                      # (modified) Add GET /api/runs/exercise-weights endpoint
    └── (no new files)
```

### Pattern 1: Discipline-Filtered Data Aggregation
**What:** Dashboard calls `useDashboard()`, which fetches all runs for the active filter (e.g., 'current-plan'). A new `filterRunsByDiscipline(runs, activeDiscipline)` helper filters in-memory before aggregation.

**When to use:** When the filtered dataset is small (<1000 docs) and the filter changes frequently (e.g., discipline selector clicks). Reduces server roundtrips.

**Example:**
```typescript
// Source: Phase 16 research
// In useDashboard.ts hook:

export function filterRunsByDiscipline(runs: Run[], discipline: 'all' | 'run' | 'gym' | 'cycle'): Run[] {
  if (discipline === 'all') return runs
  return runs.filter(r => (r.discipline ?? 'run') === discipline)
}

// Inside useDashboard():
const filteredRuns = filterRunsByDiscipline(runs, activeDiscipline)
const stats = computeStats(filteredRuns, plan, activeFilter, linkedRuns)
const weekBuckets = fillWeekGaps(groupRunsByWeek(filteredRuns))
```

### Pattern 2: Discipline-Aware Stat Computation
**What:** `computeStats()` receives the `activeDiscipline` and returns different stat labels/values based on discipline.

**When to use:** When metrics are meaningfully different per discipline (e.g., pace vs. speed, distance vs. session count).

**Example:**
```typescript
// Source: Phase 16 design contract
function computeStats(
  runs: Run[],
  plan: PlanData | null,
  filter: FilterPreset,
  linkedRuns: Map<string, Run>,
  activeDiscipline: 'all' | 'run' | 'gym' | 'cycle'
): DashboardStats {
  let stats: Partial<DashboardStats> = {}

  if (activeDiscipline === 'gym') {
    stats.totalSessions = runs.length
    stats.totalDuration = formatTotalTime(
      runs.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0)
    )
    // Gym has no pace or distance — card titles/values reflect this
  } else if (activeDiscipline === 'cycle') {
    stats.totalDistance = Math.round(runs.reduce((s, r) => s + r.distance, 0) * 10) / 10 + 'km'
    stats.avgSpeed = computeAvgSpeed(runs) + ' km/h'
    stats.totalTime = formatTotalTime(...)
  } else {
    // run or all: standard run metrics
    stats.totalDistance = ... // km
    stats.totalRuns = runs.length
    stats.totalTime = ...
  }
  
  return stats
}
```

### Pattern 3: Multi-Discipline Weekly Volume Chart
**What:** Instead of a single BarChart, use ComposedChart with stacked or grouped bars, one per discipline. When "All" is selected, show all three; when a single discipline is selected, show only that bar.

**When to use:** When displaying multi-category data that benefits from visual comparison (e.g., total km across all three sports in the same week).

**Example:**
```typescript
// Source: Phase 16 UI design contract
<ComposedChart data={weeklyData}>
  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
  <XAxis dataKey="weekLabel" />
  <YAxis label={{ value: 'Volume', angle: -90, position: 'insideLeft' }} />
  <Tooltip />
  <Legend />
  
  {activeDiscipline === 'all' || activeDiscipline === 'run' && (
    <Bar dataKey="runDistance" fill="#3b82f6" name="Runs" />
  )}
  {activeDiscipline === 'all' || activeDiscipline === 'gym' && (
    <Bar dataKey="gymSessions" fill="#f97316" name="Gym" />
  )}
  {activeDiscipline === 'all' || activeDiscipline === 'cycle' && (
    <Bar dataKey="cycleDistance" fill="#22c55e" name="Cycling" />
  )}
</ComposedChart>
```

### Pattern 4: Exercise Weight Progression Fetch & Display
**What:** Dashboard maintains `selectedExercise` state. When user selects an exercise from dropdown, call `fetchExerciseWeights(exerciseName)` → populate LineChart. Loading state shown during fetch.

**When to use:** When data must be fetched on-demand (exercise-specific aggregation is expensive server-side, cached in-memory client-side per session).

**Example:**
```typescript
// Source: Phase 16 research
const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
const [weightChartData, setWeightChartData] = useState<WeightProgressionDataPoint[]>([])
const [isLoadingWeightChart, setIsLoadingWeightChart] = useState(false)

async function handleExerciseSelect(exerciseName: string) {
  setSelectedExercise(exerciseName)
  setIsLoadingWeightChart(true)
  try {
    const res = await fetch(`/api/runs/exercise-weights?exercise=${encodeURIComponent(exerciseName)}`, {
      headers: { 'X-Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}` }
    })
    const { data } = await res.json()
    setWeightChartData(data)
  } finally {
    setIsLoadingWeightChart(false)
  }
}
```

### Anti-Patterns to Avoid
- **Server-side aggregation per discipline:** Querying `/api/runs?discipline=run&dateFrom=...` three times (once per discipline) for the "All" view. Instead: fetch all runs once, filter client-side.
- **Storing discipline filter in plan:** Discipline selector should be local Dashboard state, not persisted to the plan document — it's a view preference, not a plan property.
- **Hardcoding discipline colors in stat cards:** Define color map once (DISCIPLINE_COLORS constant) and reference it everywhere; prevents color drift.
- **Empty weight chart (no error):** If gym sessions exist but none have weight data, show a clear message "No exercises with weight data logged" — don't show an empty chart.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-discipline data aggregation | Custom week bucketing per discipline | Extend existing `groupRunsByWeek()` helper with discipline awareness | Existing week-grouping logic already handles date alignment; discipline filtering is a simple filter step |
| Exercise name extraction/deduplication | Regex parsing or complex filter | Simple `.flatMap(r => r.exercises ?? []).map(e => e.name).filter((v, i, a) => a.indexOf(v) === i)` then `Array.from(new Set(...))` | Exercise names are simple strings; Set dedup is idiomatic JS |
| Weight progression line chart | Custom canvas/SVG renderer | Recharts LineChart with `dataKey="maxWeight"` | Recharts handles responsive sizing, tooltip, animation; custom chart is 10x the code |
| Date/week formatting | Manual string manipulation | date-fns `format(date, 'MMM d')` (already used in current code) | Already a dependency; consistency with existing code |

**Key insight:** Phase 16 is primarily UI state management (discipline selector, conditional rendering) + data filtering (client-side discipline filter before aggregation) + one new API endpoint (exercise-weights). No heavy algorithmic or data transformation problems that warrant custom solutions.

## Common Pitfalls

### Pitfall 1: Forgetting default discipline for pre-v3.0 runs
**What goes wrong:** Runs created before Phase 13 have no `discipline` field. Chart axes and stat cards show `undefined` or crash when accessing `run.discipline`.

**Why it happens:** Phase 13 migration backfills new runs with `discipline: 'run'`, but old data may not be fully migrated in all environments.

**How to avoid:** Always use `run.discipline ?? 'run'` when reading discipline. This treats absence as the run discipline.

**Warning signs:** Stat cards showing "0 runs" when they should show historical data; console errors about undefined property access.

### Pitfall 2: Discipline filtering breaking plan adherence calculation
**What goes wrong:** When discipline filter is "Gym", adherence shows "N/A" even though the plan has gym days completed.

**Why it happens:** `computeStats()` uses `linkedRuns.size` (Map from plan fetch) without filtering by discipline. The plan days are discipline-aware (Phase 13), but the adherence logic isn't.

**How to avoid:** When computing adherence for a filtered discipline, count only plan days matching that discipline. Example: `countCompletedNonRestDays(plan, activeDiscipline)` checks `day.discipline` before counting.

**Warning signs:** Adherence decreases when filtering to a discipline that has completed plan days.

### Pitfall 3: Weekly volume chart showing gym sessions as distance
**What goes wrong:** Gym sessions have `distance: 0`, so bars show zero height for gym weeks.

**Why it happens:** Gym sessions are frequency-based (session count), not distance-based. The existing chart uses `dataKey="distance"` for all runs.

**How to avoid:** When building `weekBuckets`, track discipline and compute buckets with per-discipline metrics. For gym: count sessions. For runs/cycle: sum distance. Pass both to chart; chart chooses dataKey based on `activeDiscipline`.

**Warning signs:** Empty bars for weeks with only gym sessions; gym volume completely invisible.

### Pitfall 4: Exercise weight chart showing all exercises at once instead of selected one
**What goes wrong:** LineChart renders overlapping lines for every exercise, making it unreadable.

**Why it happens:** Dropdown selector is wired to state but chart data isn't filtered by `selectedExercise`.

**How to avoid:** Fetch `/api/runs/exercise-weights?exercise={selected}` when exercise changes. Only render chart when `selectedExercise` is set and data is loaded.

**Warning signs:** Chart unreadable; 50+ overlapping lines instead of one exercise trend.

### Pitfall 5: Discipline selector not persisting to localStorage
**What goes wrong:** User selects "Gym" filter, navigates away, returns to dashboard → filter resets to "All".

**Why it happens:** `activeDiscipline` state is local; no persistence.

**How to avoid:** Persist to localStorage on change (similar to `runs_discipline_filter` on Activities page). On Dashboard mount, restore from localStorage with 'all' as default.

**Warning signs:** User reports filter not "sticking" across navigations.

## Code Examples

Verified patterns from the existing codebase:

### Example 1: Filter Preset Control (established pattern from Phase 4)
```typescript
// Source: web/src/pages/Dashboard.tsx (existing)
<div className="mb-6">
  <span className="text-xs font-medium text-gray-600 mr-3">Filter by:</span>
  <div className="flex flex-wrap gap-2 mt-2">
    {FILTER_PRESETS.map((preset) => (
      <button
        key={preset.id}
        onClick={() => setActiveFilter(preset.id)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
          activeFilter === preset.id
            ? 'bg-gray-200 text-gray-900 font-semibold'
            : 'text-gray-600 border border-gray-300 hover:bg-gray-100'
        }`}
      >
        {preset.label}
      </button>
    ))}
  </div>
</div>
```

### Example 2: Stat Card Component (new for Phase 16)
```typescript
// Source: Phase 16 implementation
interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
}

function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  )
}
```

### Example 3: Discipline Filtering Helper (new for Phase 16)
```typescript
// Source: Phase 16 research / web/src/hooks/useDashboard.ts
export function filterRunsByDiscipline(
  runs: Run[],
  discipline: 'all' | 'run' | 'gym' | 'cycle'
): Run[] {
  if (discipline === 'all') return runs
  return runs.filter(r => (r.discipline ?? 'run') === discipline)
}
```

### Example 4: Multi-Discipline Weekly Buckets (modified from Phase 4)
```typescript
// Source: Phase 16 extension of existing groupRunsByWeek()
export interface MultiDisciplineWeekBucket {
  weekKey: string
  weekLabel: string
  runDistance: number       // km
  gymSessions: number       // count
  cycleDistance: number     // km
  avgPace: number | null    // weighted by run distance
  avgSpeed: number | null   // weighted by cycle distance
}

export function groupRunsByDiscipline(runs: Run[]): MultiDisciplineWeekBucket[] {
  const buckets = new Map<string, MultiDisciplineWeekBucket>()

  for (const run of runs) {
    const date = parseISO(run.date)
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    const key = monday.toISOString().slice(0, 10)
    const weekLabel = format(monday, 'MMM d')

    if (!buckets.has(key)) {
      buckets.set(key, {
        weekKey: key,
        weekLabel,
        runDistance: 0,
        gymSessions: 0,
        cycleDistance: 0,
        avgPace: null,
        avgSpeed: null,
      })
    }

    const bucket = buckets.get(key)!
    const discipline = run.discipline ?? 'run'

    if (discipline === 'run') {
      bucket.runDistance += run.distance
    } else if (discipline === 'gym') {
      bucket.gymSessions += 1
    } else if (discipline === 'cycle') {
      bucket.cycleDistance += run.distance
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => ({
      ...bucket,
      runDistance: Math.round(bucket.runDistance * 10) / 10,
      cycleDistance: Math.round(bucket.cycleDistance * 10) / 10,
    }))
}
```

### Example 5: Exercise Weight API Endpoint (new for Phase 16)
```typescript
// Source: Phase 16 api/src/functions/runs.ts (new)
app.http('getExerciseWeights', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'runs/exercise-weights',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req)
    if (denied) return denied
    const { userId } = getAuthContext(req)

    const exercise = req.query.get('exercise')
    if (!exercise) {
      return { status: 400, jsonBody: { error: 'exercise query parameter required' } }
    }

    try {
      const db = await getDb()
      const runs = await db.collection<Run>('runs')
        .find({ userId: new ObjectId(userId), exercises: { $exists: true } })
        .sort({ date: -1 })
        .toArray()

      const data = runs
        .filter(r => r.exercises && r.exercises.some(e => e.name === exercise && e.weight))
        .map(r => {
          const ex = r.exercises!.find(e => e.name === exercise)!
          return {
            date: r.date,
            maxWeight: ex.weight,
            unit: ex.unit ?? 'kg',
          }
        })

      return { status: 200, jsonBody: { exercise, data } }
    } catch (err) {
      context.log('Error fetching exercise weights:', err)
      return { status: 503, jsonBody: { error: 'Service unavailable' } }
    }
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Run-only dashboard (Phase 4) | Multi-discipline dashboard with filter (Phase 16) | v3.0 (2026-05-09) | Users can now track multiple sports on one dashboard; adapt to discipline-specific metrics |
| Single-discipline stat cards | Discipline-aware stat cards | v3.0 | Gym shows session count + duration; runs show distance + pace; cycle shows distance + speed |
| Single BarChart (distance) | ComposedChart with multi-discipline bars | v3.0 | Compare training volume across sports in the same timeframe |
| No weight tracking UI | Weight progression chart + exercise dropdown | v3.0 | Gym users can track strength progress over time |

**Deprecated/outdated:**
- Weekly volume chart hardcoded to "Distance (km)" — now adapts based on discipline selector.

## Open Questions

1. **Should exercise weight chart show unit preferences from Phase 19?**
   - What we know: Phase 19 adds `User.unitPreferences.weight` (kg/lbs)
   - What's unclear: Should Phase 16 pre-implement unit conversion (show kg if preference is kg, lbs if lbs) or assume kg for v1?
   - Recommendation: Assume kg for Phase 16. Phase 19 will add unit conversion (normalize all stored weights to user's current preference on display).

2. **Should "All" discipline option show gym sessions on the volume chart?**
   - What we know: Gym has `distance: 0`, so current bar would show nothing
   - What's unclear: Should "All" mode show three separate bar series (run km, gym sessions, cycle km) or just runs + cycle?
   - Recommendation: Show all three. Gym bars will show session count; scale the Y-axis to accommodate (gym sessions are typically 1-3/week, vs. distance 0-50km/week). Tooltip clarifies "5 gym sessions" vs "20km runs".

3. **Can exercises be queried server-side for deduplication?**
   - What we know: Web already deduplicates with `new Set()` on exercises list
   - What's unclear: Should `/api/runs/exercise-weights?list=true` return unique exercise names for the dropdown, or build the list client-side?
   - Recommendation: Build client-side. Extract unique exercise names from all runs with gym discipline; no additional API call. Simpler and data already fetched.

4. **What if a run has no discipline field (pre-Phase 13)?**
   - What we know: Phase 13 migration backfills, but old test fixtures may not
   - What's unclear: Should we query with `{ discipline: { $in: [discipline, null] } }` for "run" or rely on `?? 'run'` in code?
   - Recommendation: Rely on `?? 'run'` in TypeScript code. Server returns discipline as-is (may be undefined); client code treats it as 'run'. No server-side query change needed.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified beyond existing MongoDB, Azure Functions, Node.js, npm — all confirmed working in Phase 15.2).

## Validation Architecture

**Framework:** Vitest (existing)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest + @vitest/ui |
| Config file | `api/vitest.config.ts`, `web/vitest.config.ts` |
| Quick run command | `npm run test -- --reporter=verbose` (api/web) |
| Full suite command | `npm run test && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | DisciplineSelector button clicks update `activeDiscipline` state and re-render stats | unit | `npm run test -- web.test.ts -t "DisciplineSelector"` | ❌ Wave 0 |
| DASH-02 | Stat card labels/values change based on discipline (gym: sessions+duration; run: distance+runs; cycle: distance+speed) | unit | `npm run test -- web.test.ts -t "computeStats"` | ❌ Wave 0 |
| DASH-03 | Weekly volume chart renders all three disciplines with correct colors and bars hide/show based on filter | integration | `npm run test -- web.test.ts -t "WeeklyVolumeChart"` | ❌ Wave 0 |
| DASH-04 | Exercise dropdown fetches `/api/runs/exercise-weights`, chart renders max weight per session, loading state shown | integration | `npm run test -- web.test.ts -t "WeightProgressionChart"` | ❌ Wave 0 |
| DASH-04 | `/api/runs/exercise-weights?exercise=...` returns correct data structure with dates and maxWeights | unit | `npm run test -- api.test.ts -t "getExerciseWeights"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --reporter=verbose` (unit tests only, <10s)
- **Per wave merge:** `npm run test && npx playwright test` (all layers)
- **Phase gate:** Full test suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `web/src/components/dashboard/__tests__/DisciplineSelector.test.tsx` — button state management, click handlers
- [ ] `web/src/hooks/__tests__/useDashboard.test.ts` — `filterRunsByDiscipline()`, discipline-aware `computeStats()`
- [ ] `web/src/components/dashboard/__tests__/StatCard.test.tsx` — label/value rendering per discipline
- [ ] `web/src/components/dashboard/__tests__/WeeklyVolumeChart.test.tsx` — multi-discipline data, conditional bar rendering
- [ ] `web/src/components/dashboard/__tests__/WeightProgressionChart.test.tsx` — dropdown select, exercise weights fetch, loading state
- [ ] `api/src/__tests__/exerciseWeights.test.ts` — `/api/runs/exercise-weights` endpoint, query parsing, MongoDB aggregation

*(All phase requirements currently testable; no blockers. Test implementation is Wave 0 responsibility.)*

## Sources

### Primary (HIGH confidence)
- **UI Design Contract** — `.planning/phases/16-multi-discipline-dashboard/16-UI-SPEC.md` (verified 2026-05-09)
  - Discipline selector appearance, stat card definitions per discipline, chart layouts, component inventory
- **Existing Dashboard.tsx** — `web/src/pages/Dashboard.tsx` (verified by Read 2026-05-09)
  - Current single-discipline chart implementation; establishes styling patterns and Recharts usage
- **useDashboard hook** — `web/src/hooks/useDashboard.ts` (verified by Read 2026-05-09)
  - Week bucketing, stat computation, filter presets; extension points for discipline awareness
- **Runs API handler** — `api/src/functions/runs.ts` (verified by Read 2026-05-09)
  - Existing `GET /api/runs?discipline=...` parameter already functional; new `exercise-weights` endpoint follows same pattern
- **Data types** — `api/src/shared/types.ts` (verified by Read 2026-05-09)
  - `Run.discipline` and `Exercise` already defined; no type changes needed
- **Roadmap / Requirements** — `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` (verified by Read 2026-05-09)
  - DASH-01 through DASH-04 requirements locked; no scope ambiguity

### Secondary (MEDIUM confidence)
- **Recharts ^3.8.1** — Verified in `web/package.json` as existing dependency; LineChart, ComposedChart, Bar components are standard Recharts exports
- **Phase 15.2 completion** — `.planning/STATE.md` confirms Phase 15.2 complete (2026-05-09); runWeekNumber desync fixed; dashboard can safely assume run data integrity
- **Phase 13 discipline migration** — `.planning/STATE.md` confirms Phase 13 complete; all runs have `discipline` field or default to 'run' via code (`?? 'run'`)

### Tertiary (LOW confidence)
- None — research relies exclusively on HIGH and MEDIUM sources

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — All libraries already in use; Recharts 3.8.1 confirmed in package.json; no new deps required
- **Architecture:** HIGH — Extends existing Dashboard and useDashboard patterns; no novel data structures; reuses established filter/state patterns from Phase 4
- **Pitfalls:** HIGH — Identified from existing codebase patterns (pre-v3.0 data migration, discipline default handling, chart data modeling); all mitigated by existing code patterns
- **API:** HIGH — Existing `GET /api/runs?discipline=...` already works; new `/api/runs/exercise-weights` follows same handler pattern as existing `/api/runs/{id}` handler

**Research date:** 2026-05-09
**Valid until:** 2026-05-23 (14 days — stable domain, low churn expected)
