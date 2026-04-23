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
import { useDashboard, formatPaceToMMSS, type FilterPreset } from '../hooks/useDashboard'

export const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
  { id: 'current-plan', label: 'Current Plan' },
  { id: 'last-4-weeks', label: 'Last 4 weeks' },
  { id: 'last-8-weeks', label: 'Last 8 weeks' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-12-months', label: 'Last 12 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'all-time', label: 'All time' },
]

export function Dashboard() {
  const navigate = useNavigate()
  const {
    activeFilter,
    setActiveFilter,
    stats,
    weeklyData,
    paceData,
    paceBpmData,
    isLoading,
    isPlanLoading,
    hasPlan,
  } = useDashboard()

  const showNoPlanEmpty = activeFilter === 'current-plan' && !hasPlan && !isLoading && !isPlanLoading
  const showNoRunsEmpty = !isLoading && !isPlanLoading && !showNoPlanEmpty && weeklyData.length === 0

  // Whether any week has actual pace or HR data (to decide whether to render charts)
  const hasPaceData = paceData.some(p => p.pace !== null)
  const hasPaceBpmData = paceBpmData.some(p => p.pace !== null || p.avgBPM !== null)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page heading */}
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>

      {/* Filter row */}
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

      {/* Stats cards — always shown when not showing no-plan empty state */}
      {!showNoPlanEmpty && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-600 mb-1">Total Distance</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : stats.totalDistance}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-600 mb-1">Total Runs</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : stats.totalRuns}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-600 mb-1">Total Time</p>
              <p className="text-2xl font-bold text-gray-900">{isLoading ? '—' : stats.totalTime}</p>
            </div>
            {/* Adherence + Progress — only shown for current-plan filter */}
            {activeFilter === 'current-plan' && (
              <div
                role="button"
                onClick={() => navigate('/plan')}
                className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all"
              >
                <p className="text-xs font-medium text-gray-600 mb-1">Adherence</p>
                <p className="text-2xl font-bold text-gray-900">{isLoading || isPlanLoading ? '—' : stats.adherence}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Progress: {isLoading || isPlanLoading ? '—' : stats.progress}
                </p>
              </div>
            )}
          </div>

          {/* Loading spinner */}
          {(isLoading || isPlanLoading) && (
            <div className="flex justify-center py-12">
              <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            </div>
          )}

          {/* Empty state — no runs in selected range */}
          {showNoRunsEmpty && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-xl font-semibold text-gray-900 mb-2">No runs yet</p>
              <p className="text-sm text-gray-600">Log your first run from the Training Plan or Runs page.</p>
            </div>
          )}

          {/* Charts — only when data exists */}
          {weeklyData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Weekly Volume bar chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Volume</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis
                      label={{ value: 'Distance (km)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(1)}km`, 'Distance']} />
                    <Bar dataKey="distance" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Weekly Avg Pace line chart — only if any week has pace data */}
              {hasPaceData && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Avg Pace</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={paceData}>
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

              {/* Weekly Avg Pace vs Heart Rate composed chart — only if BPM data exists */}
              {hasPaceBpmData && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 md:col-span-2">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Avg Pace vs Heart Rate</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={paceBpmData}>
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
          )}
        </>
      )}
    </div>
  )
}
