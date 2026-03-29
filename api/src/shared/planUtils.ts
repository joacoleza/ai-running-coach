import type { PlanWeek, PlanDay } from './types.js';

/** Returns the 7 ISO date strings (Mon–Sun) for the calendar week containing startDate */
export function getWeekDates(startDate: string): string[] {
  const d = new Date(startDate + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMon);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  });
}

/**
 * Ensures a week has exactly 7 days (Mon–Sun based on startDate).
 * Missing dates are filled with rest days. Extra days outside the Mon–Sun range are dropped.
 */
export function normalizeWeekDays(week: PlanWeek): PlanWeek {
  const allDates = getWeekDates(week.startDate);
  const byDate = new Map<string, PlanDay>(week.days.map(d => [d.date, d]));
  const days: PlanDay[] = allDates.map(date => byDate.get(date) ?? {
    date,
    type: 'rest' as const,
    guidelines: 'Rest day',
    completed: false,
    skipped: false,
  });
  // Always normalise startDate to the actual Monday of the week, regardless of what Claude provided
  return { ...week, startDate: allDates[0], days };
}
