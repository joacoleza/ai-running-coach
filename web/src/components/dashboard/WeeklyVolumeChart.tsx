import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DisciplineFilter, MultiDisciplineWeekBucket } from '../../hooks/useDashboard'

interface WeeklyVolumeChartProps {
  data: MultiDisciplineWeekBucket[]
  activeDiscipline: DisciplineFilter
}

function tooltipFormatter(v: unknown, name: unknown): [string, string] {
  const nameStr = String(name ?? '')
  if (nameStr === 'Runs') return [`${Number(v).toFixed(1)}km (Runs)`, nameStr]
  if (nameStr === 'Gym') return [`${Number(v)} sessions (Gym)`, nameStr]
  if (nameStr === 'Cycling') return [`${Number(v).toFixed(1)}km (Cycling)`, nameStr]
  return [String(v), nameStr]
}

export function WeeklyVolumeChart({ data, activeDiscipline }: WeeklyVolumeChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ minHeight: 300 }} className="flex items-center justify-center">
        <p className="text-gray-500 text-sm text-center py-12">No sessions yet</p>
      </div>
    )
  }

  const yAxisLabel = activeDiscipline === 'gym' ? 'Sessions' : 'Distance (km)'

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis
          label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
          tick={{ fontSize: 12, fill: '#6b7280' }}
        />
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
        {(activeDiscipline === 'all' || activeDiscipline === 'run') && (
          <Bar dataKey="runDistance" fill="#3b82f6" name="Runs" radius={[4, 4, 0, 0]} />
        )}
        {(activeDiscipline === 'all' || activeDiscipline === 'gym') && (
          <Bar dataKey="gymSessions" fill="#f97316" name="Gym" radius={[4, 4, 0, 0]} />
        )}
        {(activeDiscipline === 'all' || activeDiscipline === 'cycle') && (
          <Bar dataKey="cycleDistance" fill="#22c55e" name="Cycling" radius={[4, 4, 0, 0]} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
