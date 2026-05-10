import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar,
  LineChart, Line,
  ComposedChart,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  useDashboard,
  formatPaceToMMSS,
  parseDurationToMinutes,
  formatTotalTime,
  computeAvgSpeed,
  type FilterPreset,
} from '../hooks/useDashboard'
import { DisciplineSelector } from '../components/dashboard/DisciplineSelector'
import { WeeklySpeedChart, type SpeedDataPoint } from '../components/dashboard/WeeklySpeedChart'
import { WeeklyDurationChart, type DurationDataPoint } from '../components/dashboard/WeeklyDurationChart'
import { WeightProgressionChart } from '../components/dashboard/WeightProgressionChart'

export const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
  { id: 'current-plan', label: 'Current Plan' },
  { id: 'last-4-weeks', label: 'Last 4 weeks' },
  { id: 'last-8-weeks', label: 'Last 8 weeks' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-12-months', label: 'Last 12 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'all-time', label: 'All time' },
]

export const DISCIPLINE_COLORS = {
  run: '#3b82f6',   // blue-600
  gym: '#f97316',   // orange-500
  cycle: '#22c55e', // green-500
} as const

export function Dashboard() {
  const navigate = useNavigate()
  const {
    activeFilter,
    setActiveFilter,
    activeDiscipline,
    setActiveDiscipline,
    stats,
    runRuns,
    cycleRuns,
    gymRuns,
    runWeeklyBuckets,
    cycleWeeklyBuckets,
    gymWeeklyBuckets,
    isLoading,
    isPlanLoading,
    hasPlan,
  } = useDashboard()

  // Section visibility logic (D-03, D-04)
  const showRunSection = activeDiscipline === 'all' || activeDiscipline === 'run'
  const showCycleSection = activeDiscipline === 'all' || activeDiscipline === 'cycle'
  const showGymSection = activeDiscipline === 'all' || activeDiscipline === 'gym'

  const runHasData = runRuns.length > 0
  const cycleHasData = cycleRuns.length > 0
  const gymHasData = gymRuns.length > 0

  const showNoPlanEmpty = activeFilter === 'current-plan' && !hasPlan && !isLoading && !isPlanLoading

  // Run section data
  const runTotalDistance = (Math.round(runRuns.reduce((s, r) => s + r.distance, 0) * 10) / 10) + 'km'
  const runTotalTime = formatTotalTime(runRuns.reduce((s, r) => s + parseDurationToMinutes(r.duration), 0))
  const runDistanceData = runWeeklyBuckets.map(b => ({ weekLabel: b.weekLabel, distance: b.distance }))
  const runPaceData = runWeeklyBuckets.map(b => ({ weekLabel: b.weekLabel, pace: b.avgPace }))
  const runHasPaceData = runPaceData.some(p => p.pace !== null)
  const runPaceBpmData = runWeeklyBuckets.map(b => ({
    weekLabel: b.weekLabel,
    pace: b.avgPace,
    avgBPM: b.hrValues.length > 0
      ? Math.round(b.hrValues.reduce((s, v) => s + v, 0) / b.hrValues.length * 10) / 10
      : null,
  }))
  const runHasPaceBpmData = runPaceBpmData.some(p => p.pace !== null || p.avgBPM !== null)

  // Cycling section data
  const cycleTotalDistance = (Math.round(cycleRuns.reduce((s, r) => s + r.distance, 0) * 10) / 10) + 'km'
  const cycleAvgSpeed = computeAvgSpeed(cycleRuns)
  const cycleTotalTime = formatTotalTime(cycleRuns.reduce((s, r) => s + parseDurationToMinutes(r.duration), 0))
  const cycleDistanceData = cycleWeeklyBuckets.map(b => ({ weekLabel: b.weekLabel, distance: b.distance }))
  const cycleSpeedData: SpeedDataPoint[] = cycleWeeklyBuckets.map(b => ({
    weekLabel: b.weekLabel,
    speed: b.totalDurationMinutes > 0 && b.distance > 0
      ? Math.round((b.distance / b.totalDurationMinutes) * 60 * 10) / 10
      : null,
  }))

  // Gym section data
  const gymTotalTime = formatTotalTime(gymRuns.reduce((s, r) => s + parseDurationToMinutes(r.duration), 0))
  const gymDurationData: DurationDataPoint[] = gymWeeklyBuckets.map(b => ({
    weekLabel: b.weekLabel,
    durationMinutes: Math.round(b.totalDurationMinutes),
  }))

  // Default exercise: most common exercise across all gym sessions (D-15)
  const gymExerciseOptions = Array.from(new Set(
    gymRuns.flatMap(r => r.exercises ?? [])
      .filter(e => e.weight !== undefined)
      .map(e => e.name)
  )).sort()

  const exerciseCounts = new Map<string, number>()
  for (const run of gymRuns) {
    for (const ex of (run.exercises ?? [])) {
      exerciseCounts.set(ex.name, (exerciseCounts.get(ex.name) ?? 0) + 1)
    }
  }
  const defaultGymExercise = exerciseCounts.size > 0
    ? Array.from(exerciseCounts.entries())
        .sort(([a, ca], [b, cb]) => cb - ca || a.localeCompare(b))[0][0]
    : undefined

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page heading */}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>

      {/* Filter row */}
      <div className="mb-4">
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

      {/* Discipline selector */}
      <div className="mb-6">
        <span className="text-xs font-medium text-gray-600 mr-3">Discipline:</span>
        <DisciplineSelector activeDiscipline={activeDiscipline} onChange={setActiveDiscipline} />
      </div>

      {/* Empty state — no active plan */}
      {showNoPlanEmpty && (
        <div className="text-center py-16">
          <p className="text-xl font-semibold text-gray-900 mb-2">No active training plan</p>
          <p className="text-sm text-gray-600 mb-4">Create a new plan with your coach to get started.</p>
          <button
            onClick={() => { window.dispatchEvent(new Event('open-coach-panel')); navigate('/plan'); }}
            className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Start Planning
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {!showNoPlanEmpty && (isLoading || isPlanLoading) && (
        <div className="flex justify-center py-12">
          <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>
      )}

      {/* Discipline sections */}
      {!showNoPlanEmpty && !isLoading && !isPlanLoading && (
        <>
          {/* RUN SECTION */}
          {showRunSection && (runHasData || activeDiscipline === 'run') && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#3b82f6' }}>
                Run ({runRuns.length} sessions)
              </h2>
              {runHasData ? (
                <>
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Total Distance</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : runTotalDistance}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Total Runs</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : runRuns.length}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Total Time</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : runTotalTime}</p>
                    </div>
                    {activeFilter === 'current-plan' && (
                      <div
                        role="button"
                        onClick={() => navigate('/plan')}
                        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all"
                      >
                        <p className="text-xs font-medium text-gray-600 mb-1">Adherence</p>
                        <p className="text-2xl font-bold text-gray-900">{isLoading || isPlanLoading ? '—' : stats.adherence}</p>
                        <p className="text-xs text-gray-500 mt-1">Progress: {isLoading || isPlanLoading ? '—' : stats.progress}</p>
                      </div>
                    )}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Weekly Distance bar chart */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Weekly Distance</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={runDistanceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <YAxis
                            label={{ value: 'Distance (km)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                          />
                          <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}km`, 'Distance']} />
                          <Bar dataKey="distance" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Distance" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Weekly Avg Pace line chart */}
                    {runHasPaceData && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Weekly Avg Pace</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={runPaceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
                            <YAxis
                              label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                              tickFormatter={(v) => formatPaceToMMSS(Number(v))}
                              domain={['auto', 'auto']}
                            />
                            <Tooltip
                              formatter={(v) =>
                                v == null
                                  ? ['—', 'Avg Pace']
                                  : [`${formatPaceToMMSS(Number(v))} /km`, 'Avg Pace']
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="pace"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 4, fill: '#3b82f6' }}
                              activeDot={{ r: 6 }}
                              connectNulls={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Weekly Avg Pace vs Heart Rate composed chart */}
                    {runHasPaceBpmData && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4 md:col-span-2">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Weekly Avg Pace vs Heart Rate</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <ComposedChart data={runPaceBpmData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
                            <YAxis
                              yAxisId="pace"
                              orientation="left"
                              label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                              tickFormatter={(v) => formatPaceToMMSS(Number(v))}
                              domain={['auto', 'auto']}
                            />
                            <YAxis
                              yAxisId="bpm"
                              orientation="right"
                              label={{ value: 'BPM', angle: 90, position: 'insideRight', style: { fontSize: 12, fill: '#6b7280' } }}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                              domain={['auto', 'auto']}
                            />
                            <Tooltip
                              formatter={(v, name) =>
                                name === 'pace'
                                  ? v == null
                                    ? ['—', 'Avg Pace']
                                    : [`${formatPaceToMMSS(Number(v))} /km`, 'Avg Pace']
                                  : v == null
                                    ? ['—', 'Avg HR']
                                    : [`${Number(v).toFixed(0)} bpm`, 'Avg HR']
                              }
                            />
                            <Legend />
                            <Line
                              yAxisId="pace"
                              type="monotone"
                              dataKey="pace"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 4, fill: '#3b82f6' }}
                              activeDot={{ r: 6 }}
                              connectNulls={false}
                            />
                            <Line
                              yAxisId="bpm"
                              type="monotone"
                              dataKey="avgBPM"
                              stroke="#ef4444"
                              strokeWidth={2}
                              dot={{ r: 4, fill: '#ef4444' }}
                              activeDot={{ r: 6 }}
                              connectNulls={false}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center py-12">No runs in selected period</p>
              )}
            </div>
          )}

          {/* CYCLING SECTION */}
          {showCycleSection && (cycleHasData || activeDiscipline === 'cycle') && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#22c55e' }}>
                Cycling ({cycleRuns.length} sessions)
              </h2>
              {cycleHasData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Total Distance</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : cycleTotalDistance}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Avg Speed</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : cycleAvgSpeed}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Total Time</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : cycleTotalTime}</p>
                    </div>
                    {activeFilter === 'current-plan' && (
                      <div
                        role="button"
                        onClick={() => navigate('/plan')}
                        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all"
                      >
                        <p className="text-xs font-medium text-gray-600 mb-1">Adherence</p>
                        <p className="text-2xl font-bold text-gray-900">{isLoading || isPlanLoading ? '—' : stats.adherence}</p>
                        <p className="text-xs text-gray-500 mt-1">Progress: {isLoading || isPlanLoading ? '—' : stats.progress}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Weekly Distance bar (cycle color) */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Weekly Distance</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={cycleDistanceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <YAxis
                            label={{ value: 'Distance (km)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                          />
                          <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}km`, 'Distance']} />
                          <Bar dataKey="distance" fill="#22c55e" radius={[4, 4, 0, 0]} name="Distance" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Weekly Avg Speed */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Weekly Avg Speed</h3>
                      <WeeklySpeedChart data={cycleSpeedData} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center py-12">No cycling sessions in selected period</p>
              )}
            </div>
          )}

          {/* GYM SECTION */}
          {showGymSection && (gymHasData || activeDiscipline === 'gym') && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#f97316' }}>
                Gym ({gymRuns.length} sessions)
              </h2>
              {gymHasData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Total Sessions</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : gymRuns.length}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-600 mb-1">Total Duration</p>
                      <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : gymTotalTime}</p>
                    </div>
                    {activeFilter === 'current-plan' && (
                      <div
                        role="button"
                        onClick={() => navigate('/plan')}
                        className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all"
                      >
                        <p className="text-xs font-medium text-gray-600 mb-1">Adherence</p>
                        <p className="text-2xl font-bold text-gray-900">{isLoading || isPlanLoading ? '—' : stats.adherence}</p>
                        <p className="text-xs text-gray-500 mt-1">Progress: {isLoading || isPlanLoading ? '—' : stats.progress}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Weekly Duration bar chart */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Weekly Duration</h3>
                      <WeeklyDurationChart data={gymDurationData} />
                    </div>

                    {/* Weight Progression chart */}
                    <WeightProgressionChart exerciseOptions={gymExerciseOptions} defaultExercise={defaultGymExercise} />
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-sm text-center py-12">No gym sessions in selected period</p>
              )}
            </div>
          )}

          {/* All sections hidden = nothing to show */}
          {!runHasData && !cycleHasData && !gymHasData && activeDiscipline === 'all' && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl font-semibold text-gray-900 mb-2">No sessions yet</p>
              <p className="text-sm text-gray-600">Log your first session from the Training Plan or Activities page.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
