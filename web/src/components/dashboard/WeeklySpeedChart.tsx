import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface SpeedDataPoint {
  weekLabel: string
  speed: number | null  // km/h decimal; null for weeks with no cycling sessions
}

interface WeeklySpeedChartProps {
  data: SpeedDataPoint[]
}

export function WeeklySpeedChart({ data }: WeeklySpeedChartProps) {
  const hasSpeedData = data.some(p => p.speed !== null)

  if (data.length === 0 || !hasSpeedData) {
    return (
      <div style={{ minHeight: 300 }} className="flex items-center justify-center">
        <p className="text-gray-500 text-sm text-center py-12">No cycling sessions yet</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="weekLabel" tick={{ fontSize: 12, fill: '#6b7280' }} />
        <YAxis
          label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickFormatter={(v) => `${Number(v).toFixed(1)}`}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={(v) =>
            v == null
              ? ['—', 'Avg Speed']
              : [`${Number(v).toFixed(1)} km/h`, 'Avg Speed']
          }
        />
        <Line
          type="monotone"
          dataKey="speed"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 4, fill: '#22c55e' }}
          activeDot={{ r: 6 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
