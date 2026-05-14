import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface DurationDataPoint {
  weekLabel: string
  durationMinutes: number  // total minutes that week (sum of parseDurationToMinutes across gym sessions)
}

interface WeeklyDurationChartProps {
  data: DurationDataPoint[]
}

export function WeeklyDurationChart({ data }: WeeklyDurationChartProps) {
  if (data.length === 0) {
    return (
      <div style={{ minHeight: 300 }} className="flex items-center justify-center">
        <p className="text-gray-500 text-sm text-center py-12">No gym sessions yet</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis
          label={{ value: 'Duration (min)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
          tick={{ fontSize: 12, fill: '#6b7280' }}
        />
        <Tooltip formatter={(v) => [`${Number(v).toFixed(0)} min`, 'Duration']} />
        <Bar
          dataKey="durationMinutes"
          fill="#f97316"
          radius={[4, 4, 0, 0]}
          name="Duration"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
