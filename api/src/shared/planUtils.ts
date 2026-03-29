import type { PlanWeek, PlanDay, PlanPhase } from './types.js';

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
 * Redistributes training days from all phases to their calendar-correct weeks.
 * Claude sometimes places days in the wrong week object; this corrects that globally.
 *
 * Algorithm:
 * 1. Collect all non-rest days across all phases, tagging each with its phase index.
 * 2. Find the earliest day date → anchorMonday = Monday of that week.
 * 3. Compute weekNumber for each day: floor((dayDate - anchorMonday) / 7) + 1.
 * 4. Group by (phaseIndex, weekNumber) → rebuild weeks with correct startDates.
 * 5. Fill each rebuilt week to 7 days Mon-Sun with rest days for empty slots.
 * 6. Phases with no days keep their original (empty) weeks array.
 */
export function normalizePlanPhases(phases: PlanPhase[]): PlanPhase[] {
  if (phases.length === 0) return phases;

  // Helper: Monday of the week containing a given date string
  const getMondayOf = (dateStr: string): Date => {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay(); // 0=Sun … 6=Sat
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysFromMon);
    return monday;
  };

  const isoDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const addDays = (d: Date, n: number): Date => {
    const result = new Date(d);
    result.setDate(d.getDate() + n);
    return result;
  };

  // Collect all non-rest days with their phase index
  const taggedDays: Array<{ phaseIndex: number; day: PlanDay }> = [];
  for (let pi = 0; pi < phases.length; pi++) {
    for (const week of phases[pi].weeks) {
      for (const day of week.days) {
        if (day.type !== 'rest') {
          taggedDays.push({ phaseIndex: pi, day });
        }
      }
    }
  }

  // If no training days exist, return phases unchanged
  if (taggedDays.length === 0) return phases;

  // Find anchor Monday (Monday of the week containing the earliest day)
  const earliest = taggedDays.reduce((min, { day }) =>
    day.date < min ? day.date : min, taggedDays[0].day.date);
  const anchorMonday = getMondayOf(earliest);
  const anchorMs = anchorMonday.getTime();

  // Compute weekNumber per day using date-string arithmetic to avoid DST issues.
  // Parse YYYY-MM-DD as UTC midnight to get pure day-count arithmetic.
  const parseDateUTC = (dateStr: string): number => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };

  const anchorUTC = parseDateUTC(isoDate(anchorMonday));
  const MS_PER_DAY = 86400000;
  const MS_PER_WEEK = 7 * MS_PER_DAY;

  // Group by phaseIndex and weekNumber
  const grouped = new Map<number, Map<number, PlanDay[]>>();
  for (const { phaseIndex, day } of taggedDays) {
    const dayMs = parseDateUTC(day.date);
    const weekNumber = Math.floor((dayMs - anchorUTC) / MS_PER_WEEK) + 1;
    if (!grouped.has(phaseIndex)) grouped.set(phaseIndex, new Map());
    const phaseMap = grouped.get(phaseIndex)!;
    if (!phaseMap.has(weekNumber)) phaseMap.set(weekNumber, []);
    phaseMap.get(weekNumber)!.push(day);
  }

  // Rebuild each phase's weeks
  return phases.map((phase, pi) => {
    const phaseMap = grouped.get(pi);
    if (!phaseMap || phaseMap.size === 0) {
      // No training days — keep original weeks
      return phase;
    }

    // Sort week numbers for this phase
    const sortedWeekNumbers = Array.from(phaseMap.keys()).sort((a, b) => a - b);

    // Re-index week numbers to start from 1 sequentially within this phase
    const weekNumberMap = new Map<number, number>();
    sortedWeekNumbers.forEach((wn, idx) => weekNumberMap.set(wn, idx + 1));

    const newWeeks = sortedWeekNumbers.map(origWeekNumber => {
      const seqWeekNumber = weekNumberMap.get(origWeekNumber)!;
      // Compute startDate = anchorMonday + (origWeekNumber - 1) * 7 days
      const monday = addDays(anchorMonday, (origWeekNumber - 1) * 7);
      const startDate = isoDate(monday);
      const daysInWeek = phaseMap.get(origWeekNumber)!;

      // Build a map of date → day for this week
      const byDate = new Map<string, PlanDay>(daysInWeek.map(d => [d.date, d]));

      // Fill Mon–Sun slots
      const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
        const slotDate = isoDate(addDays(monday, i));
        return byDate.get(slotDate) ?? {
          date: slotDate,
          type: 'rest' as const,
          guidelines: 'Rest day',
          completed: false,
          skipped: false,
        };
      });

      return {
        weekNumber: seqWeekNumber,
        startDate,
        days,
      };
    });

    return {
      ...phase,
      weeks: newWeeks,
    };
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
