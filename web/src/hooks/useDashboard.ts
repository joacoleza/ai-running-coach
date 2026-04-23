import { useState, useEffect } from 'react'
import { format, startOfWeek, addDays, addWeeks, startOfYear, parseISO } from 'date-fns'
import { fetchRuns, type Run } from './useRuns'
import { usePlan, type PlanData } from './usePlan'

export interface DashboardStats {
  totalDistance: string   // e.g. "42.5km"
  totalRuns: number
  totalTime: string       // e.g. "3h25m"
  adherence: string       // completed / (completed + skipped), or "N/A"
  progress: string        // (completed + skipped) / total, or "N/A"
}

export interface WeeklyDataPoint {
  weekLabel: string       // e.g. "Apr 7"
  distance: number        // km, rounded to 1 decimal
}

export interface PaceDataPoint {
  weekLabel: string
  pace: number | null     // min/km decimal; null for weeks with no runs
}

export interface PaceBpmDataPoint {
  weekLabel: string
  pace: number | null
  avgBPM: number | null
}

export type FilterPreset =
  | 'current-plan'
  | 'last-4-weeks'
  | 'last-8-weeks'
  | 'last-3-months'
  | 'last-12-months'
  | 'this-year'
  | 'all-time'

/**
 * Parse a duration string ("MM:SS" or "HH:MM:SS") into total minutes.
 * Returns 0 for invalid input.
 */
export function parseDurationToMinutes(duration: string): number {
  if (!duration) return 0
  const parts = duration.split(':').map(Number)
  if (parts.some(isNaN)) return 0
  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return minutes + seconds / 60
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours * 60 + minutes + seconds / 60
  }
  return 0
}

/**
 * Format total minutes into a human-readable string like "1h30m" or "45m".
 */
export function formatTotalTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const remaining = Math.round(minutes % 60)
  return `${hours}h${remaining}m`
}

/**
 * Convert a decimal pace (min/km) to MM:SS string.
 * e.g. 7.118 → "7:07", 8.533 → "8:32"
 */
export function formatPaceToMMSS(pace: number): string {
  const minutes = Math.floor(pace)
  const seconds = Math.round((pace - minutes) * 60)
  // Handle rounding that could push seconds to 60
  if (seconds === 60) return `${minutes + 1}:00`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Compute the date range for a given filter preset.
 * Returns null for 'current-plan' (special case handled by caller).
 * Returns object with optional dateFrom/dateTo for all other presets.
 */
export function computeDateRange(
  preset: FilterPreset,
  today: Date
): { dateFrom?: string; dateTo?: string } | null {
  if (preset === 'current-plan') return null

  const dateTo = today.toISOString().slice(0, 10)

  if (preset === 'all-time') {
    return { dateFrom: undefined, dateTo: undefined }
  }

  if (preset === 'last-4-weeks') {
    return { dateFrom: addDays(today, -28).toISOString().slice(0, 10), dateTo }
  }

  if (preset === 'last-8-weeks') {
    return { dateFrom: addDays(today, -56).toISOString().slice(0, 10), dateTo }
  }

  if (preset === 'last-3-months') {
    return { dateFrom: addDays(today, -91).toISOString().slice(0, 10), dateTo }
  }

  if (preset === 'last-12-months') {
    return { dateFrom: addDays(today, -365).toISOString().slice(0, 10), dateTo }
  }

  if (preset === 'this-year') {
    const yearStart = startOfYear(today)
    const dateFrom = `${yearStart.getFullYear()}-01-01`
    return { dateFrom, dateTo }
  }

  return { dateFrom: undefined, dateTo: undefined }
}

export interface WeekBucket {
  weekKey: string         // ISO date of the Monday (used for gap-filling)
  weekLabel: string
  distance: number
  avgPace: number | null
  totalDurationMinutes: number
  hrValues: number[]
}

export function groupRunsByWeek(runs: Run[]): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>()

  for (const run of runs) {
    const date = parseISO(run.date)
    const monday = startOfWeek(date, { weekStartsOn: 1 })
    const key = monday.toISOString().slice(0, 10)
    const weekLabel = format(monday, 'MMM d')

    if (!buckets.has(key)) {
      buckets.set(key, { weekKey: key, weekLabel, distance: 0, avgPace: null, totalDurationMinutes: 0, hrValues: [] })
    }

    const bucket = buckets.get(key)!
    bucket.distance += run.distance
    bucket.totalDurationMinutes += parseDurationToMinutes(run.duration)
    if (run.avgHR && run.avgHR > 0) {
      bucket.hrValues.push(run.avgHR)
    }
  }

  // Compute avgPace as total_duration_minutes / total_distance (distance-weighted)
  // and sort by weekStart ascending
  const sorted = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => {
      const avgPace =
        bucket.totalDurationMinutes > 0 && bucket.distance > 0
          ? bucket.totalDurationMinutes / bucket.distance
          : null
      return { ...bucket, distance: Math.round(bucket.distance * 10) / 10, avgPace }
    })

  return sorted
}

/**
 * Fill in empty week buckets between the first and last week of the sorted list.
 * Weeks with no runs get distance=0 and avgPace=null, so charts show gaps.
 */
export function fillWeekGaps(sorted: WeekBucket[]): WeekBucket[] {
  if (sorted.length < 2) return sorted

  const bucketMap = new Map(sorted.map(b => [b.weekKey, b]))
  const result: WeekBucket[] = []
  let current = parseISO(sorted[0].weekKey)
  const endDate = parseISO(sorted[sorted.length - 1].weekKey)

  while (current <= endDate) {
    const key = format(current, 'yyyy-MM-dd')
    if (bucketMap.has(key)) {
      result.push(bucketMap.get(key)!)
    } else {
      result.push({
        weekKey: key,
        weekLabel: format(current, 'MMM d'),
        distance: 0,
        avgPace: null,
        totalDurationMinutes: 0,
        hrValues: [],
      })
    }
    current = addWeeks(current, 1)
  }

  return result
}

function countNonRestDays(plan: PlanData): number {
  let count = 0
  for (const phase of (plan.phases ?? [])) {
    for (const week of phase.weeks) {
      for (const day of week.days) {
        if (day.type !== 'rest' && day.label !== '') {
          count++
        }
      }
    }
  }
  return count
}

function countCompletedNonRestDays(plan: PlanData): number {
  let count = 0
  for (const phase of (plan.phases ?? [])) {
    for (const week of phase.weeks) {
      for (const day of week.days) {
        if (day.type !== 'rest' && day.label !== '' && day.completed) {
          count++
        }
      }
    }
  }
  return count
}

function countSkippedNonRestDays(plan: PlanData): number {
  let count = 0
  for (const phase of (plan.phases ?? [])) {
    for (const week of phase.weeks) {
      for (const day of week.days) {
        if (day.type !== 'rest' && day.label !== '' && day.skipped) {
          count++
        }
      }
    }
  }
  return count
}

/**
 * Compute adherence and progress stats for a plan.
 * adherence = completed / (completed + skipped) — how consistent when attempting
 * progress  = (completed + skipped) / total    — how far into the plan
 */
export function computePlanAdherence(plan: PlanData): { adherence: string; progress: string } {
  const total = countNonRestDays(plan)
  const completed = countCompletedNonRestDays(plan)
  const skipped = countSkippedNonRestDays(plan)
  const attempted = completed + skipped

  const adherence = attempted > 0
    ? `${Math.round((completed / attempted) * 100)}%`
    : 'N/A'

  const progress = total > 0
    ? `${Math.round((attempted / total) * 100)}%`
    : 'N/A'

  return { adherence, progress }
}

function computeStats(
  runs: Run[],
  plan: PlanData | null,
  filter: FilterPreset,
  linkedRuns: Map<string, Run>
): DashboardStats {
  const totalDistance =
    Math.round(runs.reduce((sum, r) => sum + r.distance, 0) * 10) / 10
  const totalRuns = runs.length
  const totalMinutes = runs.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0)
  const totalTime = formatTotalTime(totalMinutes)

  let adherence = 'N/A'
  let progress = 'N/A'

  if (filter === 'current-plan' && plan) {
    const stats = computePlanAdherence(plan)
    adherence = stats.adherence
    progress = stats.progress
  } else if (filter !== 'current-plan' && plan) {
    const totalNonRest = countNonRestDays(plan)
    if (totalNonRest > 0) {
      adherence = `${Math.round((linkedRuns.size / totalNonRest) * 100)}%`
    }
  }

  return {
    totalDistance: `${totalDistance}km`,
    totalRuns,
    totalTime,
    adherence,
    progress,
  }
}

export function useDashboard() {
  const { plan, linkedRuns, isLoading: isPlanLoading } = usePlan()
  const [activeFilter, setActiveFilter] = useState<FilterPreset>('current-plan')
  const [runs, setRuns] = useState<Run[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const range = computeDateRange(activeFilter, new Date())
        let fetched: Run[]
        if (range === null) {
          // current-plan: fetch all runs, filter client-side to plan._id
          const result = await fetchRuns({ limit: 1000 })
          fetched = plan ? result.runs.filter(r => r.planId === plan._id) : []
        } else {
          const result = await fetchRuns({ limit: 1000, ...range })
          fetched = result.runs
        }
        if (!cancelled) setRuns(fetched)
      } catch {
        if (!cancelled) setRuns([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [activeFilter, plan?._id])

  const weekBuckets = fillWeekGaps(groupRunsByWeek(runs))

  const weeklyData: WeeklyDataPoint[] = weekBuckets.map(w => ({
    weekLabel: w.weekLabel,
    distance: w.distance,
  }))

  // Include all weeks (including null-pace gaps) so the chart X-axis is continuous
  const paceData: PaceDataPoint[] = weekBuckets.map(w => ({
    weekLabel: w.weekLabel,
    pace: w.avgPace,
  }))

  const paceBpmData: PaceBpmDataPoint[] = weekBuckets.map(w => ({
    weekLabel: w.weekLabel,
    pace: w.avgPace,
    avgBPM: w.hrValues.length > 0
      ? Math.round(w.hrValues.reduce((s, v) => s + v, 0) / w.hrValues.length * 10) / 10
      : null,
  }))

  const stats = computeStats(runs, plan, activeFilter, linkedRuns)

  return {
    activeFilter,
    setActiveFilter,
    stats,
    weeklyData,
    paceData,
    paceBpmData,
    isLoading,
    isPlanLoading,
    hasPlan: plan !== null && plan.status === 'active',
  }
}
