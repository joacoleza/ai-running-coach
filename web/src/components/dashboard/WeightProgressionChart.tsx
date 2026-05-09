import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface WeightProgressionChartProps {
  exerciseOptions: string[]
}

export function WeightProgressionChart({ exerciseOptions }: WeightProgressionChartProps) {
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [chartData, setChartData] = useState<Array<{ date: string; maxWeight: number; unit: string }>>([])
  const [isLoading, setIsLoading] = useState(false)

  if (exerciseOptions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-gray-500 text-sm text-center py-4">
          Log a gym session with exercises to see weight progression
        </p>
      </div>
    )
  }

  async function handleExerciseSelect(name: string) {
    if (!name) {
      setSelectedExercise('')
      setChartData([])
      return
    }
    setSelectedExercise(name)
    setIsLoading(true)
    try {
      const res = await fetch(
        '/api/runs/exercise-weights?exercise=' + encodeURIComponent(name),
        { headers: { 'X-Authorization': 'Bearer ' + (localStorage.getItem('access_token') ?? '') } }
      )
      if (res.ok) {
        const { data } = await res.json()
        setChartData(data)
      } else {
        setChartData([])
      }
    } catch {
      setChartData([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <select
        value={selectedExercise}
        onChange={(e) => handleExerciseSelect(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-700 cursor-pointer"
      >
        <option value="">Select exercise</option>
        {exerciseOptions.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      {isLoading && (
        <div style={{ minHeight: 300 }} className="flex items-center justify-center">
          <p className="text-gray-500 text-sm text-center py-12">Loading...</p>
        </div>
      )}

      {!isLoading && !selectedExercise && (
        <div style={{ minHeight: 300 }} className="flex items-center justify-center">
          <p className="text-gray-500 text-sm text-center py-12">Select an exercise to see weight progression</p>
        </div>
      )}

      {!isLoading && selectedExercise && chartData.length === 0 && (
        <div style={{ minHeight: 300 }} className="flex items-center justify-center">
          <p className="text-gray-500 text-sm text-center py-12">No weight data for {selectedExercise}</p>
        </div>
      )}

      {!isLoading && selectedExercise && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{ value: 'kg', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip formatter={(v) => [`${Number(v)}kg`, 'Max Weight']} />
            <Line
              type="monotone"
              dataKey="maxWeight"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: '#3b82f6' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
