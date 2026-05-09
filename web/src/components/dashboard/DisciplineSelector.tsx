import type { DisciplineFilter } from '../../hooks/useDashboard'

interface DisciplineSelectorProps {
  activeDiscipline: DisciplineFilter
  onChange: (d: DisciplineFilter) => void
}

const DISCIPLINES: { id: DisciplineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'run', label: 'Run' },
  { id: 'gym', label: 'Gym' },
  { id: 'cycle', label: 'Cycle' },
]

export function DisciplineSelector({ activeDiscipline, onChange }: DisciplineSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {DISCIPLINES.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={activeDiscipline === id}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            activeDiscipline === id
              ? 'bg-gray-200 text-gray-900 font-semibold'
              : 'text-gray-600 border border-gray-300 hover:bg-gray-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
