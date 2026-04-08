import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type FilterPreset =
  | 'current-plan'
  | 'last-4-weeks'
  | 'last-8-weeks'
  | 'last-3-months'
  | 'last-12-months'
  | 'this-year'
  | 'all-time'

const FILTER_PRESETS: { id: FilterPreset; label: string }[] = [
  { id: 'current-plan', label: 'Current Plan' },
  { id: 'last-4-weeks', label: 'Last 4 weeks' },
  { id: 'last-8-weeks', label: 'Last 8 weeks' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'last-12-months', label: 'Last 12 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'all-time', label: 'All time' },
]

export type { FilterPreset }
export { FILTER_PRESETS }

export function Dashboard() {
  const [activeFilter, setActiveFilter] = useState<FilterPreset>('current-plan')
  const navigate = useNavigate()

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

      {/* Stats cards — 4 grid, populated by useDashboard in next plan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total Distance */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 mb-1">Total Distance</p>
          <p className="text-2xl font-bold text-gray-900">—</p>
        </div>
        {/* Total Runs */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 mb-1">Total Runs</p>
          <p className="text-2xl font-bold text-gray-900">—</p>
        </div>
        {/* Total Time */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 mb-1">Total Time</p>
          <p className="text-2xl font-bold text-gray-900">—</p>
        </div>
        {/* Adherence — clickable, navigates to /plan per D-11 */}
        <div
          role="button"
          onClick={() => navigate('/plan')}
          className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:shadow-sm transition-all"
        >
          <p className="text-xs font-medium text-gray-600 mb-1">Adherence</p>
          <p className="text-2xl font-bold text-gray-900">—</p>
        </div>
      </div>

      {/* Charts section — populated by useDashboard + Recharts in plan 04-03 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Volume</h2>
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm">Chart coming soon</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pace Trend</h2>
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm">Chart coming soon</div>
        </div>
      </div>
    </div>
  )
}
