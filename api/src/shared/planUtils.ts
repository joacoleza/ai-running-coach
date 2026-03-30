import type { PlanPhase } from './types.js';

/**
 * Assigns globally sequential week numbers and day labels (A-G) to all phases.
 *
 * Algorithm:
 * 1. Walk phases in order. Week numbers are globally sequential: phase 1 gets 1,2,3;
 *    phase 2 continues from where phase 1 left off (4,5,6); etc.
 * 2. Within each week, assign labels "A","B","C",... to non-rest days in array order.
 *    Rest days get label: "" (empty string — they are hidden in the UI).
 * 3. Returns a new phases array with weekNumber and label fields populated.
 */
export function assignPlanStructure(phases: PlanPhase[]): PlanPhase[] {
  if (phases.length === 0) return phases;

  let globalWeekCounter = 0;

  return phases.map(phase => {
    const newWeeks = phase.weeks.map(week => {
      globalWeekCounter++;
      const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      let labelIndex = 0;

      const newDays = week.days.map(day => {
        if (day.type === 'rest') {
          return { ...day, label: '' };
        }
        const label = LABELS[labelIndex] ?? String.fromCharCode(65 + labelIndex);
        labelIndex++;
        return { ...day, label };
      });

      return {
        ...week,
        weekNumber: globalWeekCounter,
        days: newDays,
      };
    });

    return { ...phase, weeks: newWeeks };
  });
}
