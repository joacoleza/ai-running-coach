import { describe, it, expect } from 'vitest';
import { getWeekDates, normalizeWeekDays, normalizePlanPhases } from '../shared/planUtils.js';
import type { PlanWeek, PlanPhase } from '../shared/types.js';

describe('getWeekDates', () => {
  it('returns 7 dates starting on Monday for a Wednesday input', () => {
    const dates = getWeekDates('2026-03-25'); // Wednesday
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-03-23'); // Monday
    expect(dates[6]).toBe('2026-03-29'); // Sunday
  });

  it('returns 7 dates starting on Monday for a Monday input', () => {
    const dates = getWeekDates('2026-03-23'); // Monday
    expect(dates[0]).toBe('2026-03-23');
    expect(dates[6]).toBe('2026-03-29');
  });

  it('returns 7 dates starting on Monday for a Sunday input', () => {
    const dates = getWeekDates('2026-03-29'); // Sunday
    expect(dates[0]).toBe('2026-03-23');
    expect(dates[6]).toBe('2026-03-29');
  });

  it('returns 7 dates starting on Monday for a Saturday input', () => {
    const dates = getWeekDates('2026-03-28'); // Saturday
    expect(dates[0]).toBe('2026-03-23');
    expect(dates[6]).toBe('2026-03-29');
  });

  it('returns consecutive dates in ISO format', () => {
    // Use a non-DST week (June) to avoid DST clock-change edge cases
    const dates = getWeekDates('2026-06-10');
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1] + 'T12:00:00');
      const curr = new Date(dates[i] + 'T12:00:00');
      expect(curr.getTime() - prev.getTime()).toBe(86400000);
    }
  });

  it('handles month/year boundaries correctly', () => {
    const dates = getWeekDates('2026-01-01'); // Thursday
    expect(dates[0]).toBe('2025-12-29'); // Monday in prev year
    expect(dates[6]).toBe('2026-01-04');
  });
});

describe('normalizeWeekDays', () => {
  const baseWeek: PlanWeek = {
    weekNumber: 1,
    startDate: '2026-03-23', // Monday
    days: [],
  };

  it('fills an empty week with 7 rest days', () => {
    const result = normalizeWeekDays({ ...baseWeek, days: [] });
    expect(result.days).toHaveLength(7);
    expect(result.days.every(d => d.type === 'rest')).toBe(true);
  });

  it('preserves existing days and fills the rest with rest days', () => {
    const week: PlanWeek = {
      ...baseWeek,
      days: [
        { date: '2026-03-25', type: 'run', guidelines: 'Easy 5km', completed: false, skipped: false },
        { date: '2026-03-27', type: 'run', guidelines: 'Long run', completed: false, skipped: false },
      ],
    };
    const result = normalizeWeekDays(week);
    expect(result.days).toHaveLength(7);
    const runDays = result.days.filter(d => d.type === 'run');
    expect(runDays).toHaveLength(2);
    const restDays = result.days.filter(d => d.type === 'rest');
    expect(restDays).toHaveLength(5);
  });

  it('days are ordered Mon–Sun', () => {
    const week: PlanWeek = {
      ...baseWeek,
      days: [
        { date: '2026-03-29', type: 'run', guidelines: 'Sunday run', completed: false, skipped: false },
        { date: '2026-03-23', type: 'run', guidelines: 'Monday run', completed: false, skipped: false },
      ],
    };
    const result = normalizeWeekDays(week);
    expect(result.days[0].date).toBe('2026-03-23');
    expect(result.days[6].date).toBe('2026-03-29');
  });

  it('drops days outside the Mon–Sun range', () => {
    const week: PlanWeek = {
      ...baseWeek,
      days: [
        // '2026-03-22' is Sunday of the previous week — outside this Mon-Sun range
        { date: '2026-03-22', type: 'run', guidelines: 'Out of range', completed: false, skipped: false },
        { date: '2026-03-24', type: 'run', guidelines: 'In range', completed: false, skipped: false },
      ],
    };
    const result = normalizeWeekDays(week);
    expect(result.days).toHaveLength(7);
    expect(result.days.find(d => d.date === '2026-03-22')).toBeUndefined();
    expect(result.days.find(d => d.date === '2026-03-24')?.type).toBe('run');
  });

  it('rest days have correct default fields', () => {
    const result = normalizeWeekDays({ ...baseWeek, days: [] });
    const rest = result.days[0];
    expect(rest.type).toBe('rest');
    expect(rest.guidelines).toBe('Rest day');
    expect(rest.completed).toBe(false);
    expect(rest.skipped).toBe(false);
  });

  it('preserves non-day week properties', () => {
    const result = normalizeWeekDays({ ...baseWeek, days: [] });
    expect(result.weekNumber).toBe(1);
    expect(result.startDate).toBe('2026-03-23');
  });

  it('corrects a wrong startDate (e.g. Tuesday) to the Monday of the same week', () => {
    // Claude sometimes provides Tuesday as startDate when Monday is correct
    const weekWithWrongStart: PlanWeek = {
      weekNumber: 2,
      startDate: '2026-01-13', // Tuesday — wrong (should be Monday 2026-01-12)
      days: [
        { date: '2026-01-14', type: 'run', guidelines: 'Easy run', completed: false, skipped: false },
      ],
    };
    const result = normalizeWeekDays(weekWithWrongStart);
    expect(result.startDate).toBe('2026-01-12'); // corrected to Monday
    expect(result.days).toHaveLength(7);
    expect(result.days[0].date).toBe('2026-01-12'); // Mon
    expect(result.days[2].date).toBe('2026-01-14'); // Wed run preserved
    expect(result.days[2].type).toBe('run');
  });
});

describe('normalizePlanPhases', () => {
  it('returns empty array for empty input', () => {
    expect(normalizePlanPhases([])).toEqual([]);
  });

  it('returns phases unchanged when they have no days', () => {
    const phases: PlanPhase[] = [
      { name: 'Base Building', description: 'Build base', weeks: [] },
    ];
    const result = normalizePlanPhases(phases);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Base Building');
    expect(result[0].weeks).toHaveLength(0);
  });

  it('redistributes a day in the wrong week to its correct calendar week', () => {
    // Week 1 startDate says 2026-03-23 (Mon) but contains a day from 2026-03-30 (next week)
    const phases: PlanPhase[] = [
      {
        name: 'Base Building',
        description: 'Build base',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              // This day is in week 2 (2026-03-30 is a Monday), not week 1
              { date: '2026-03-30', type: 'run', guidelines: 'Easy run', completed: false, skipped: false },
              // This day is correctly in week 1
              { date: '2026-03-25', type: 'run', guidelines: 'Wednesday run', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = normalizePlanPhases(phases);
    // Should now have 2 weeks
    expect(result[0].weeks).toHaveLength(2);
    // The 2026-03-25 day should be in the first week
    const week1 = result[0].weeks.find(w => w.startDate === '2026-03-23');
    expect(week1).toBeDefined();
    expect(week1!.days.find(d => d.date === '2026-03-25' && d.type === 'run')).toBeDefined();
    // The 2026-03-30 day should be in the second week
    const week2 = result[0].weeks.find(w => w.startDate === '2026-03-30');
    expect(week2).toBeDefined();
    expect(week2!.days.find(d => d.date === '2026-03-30' && d.type === 'run')).toBeDefined();
  });

  it('does not drop any training days — all input days appear in output', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Phase 1',
        description: 'Build',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              { date: '2026-03-24', type: 'run', guidelines: 'Tue run', completed: false, skipped: false },
              { date: '2026-03-26', type: 'run', guidelines: 'Thu run', completed: false, skipped: false },
              { date: '2026-04-01', type: 'run', guidelines: 'Next Wed run (wrong week!)', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = normalizePlanPhases(phases);
    const allOutputDays = result.flatMap(p => p.weeks.flatMap(w => w.days)).filter(d => d.type !== 'rest');
    // All 3 training days must appear in output
    expect(allOutputDays.find(d => d.date === '2026-03-24')).toBeDefined();
    expect(allOutputDays.find(d => d.date === '2026-03-26')).toBeDefined();
    expect(allOutputDays.find(d => d.date === '2026-04-01')).toBeDefined();
  });

  it('is idempotent — already-correct plans produce identical output', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: 'Base phase',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              { date: '2026-03-23', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
              { date: '2026-03-24', type: 'run', guidelines: 'Easy run', completed: false, skipped: false },
              { date: '2026-03-25', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
              { date: '2026-03-26', type: 'run', guidelines: 'Tempo run', completed: false, skipped: false },
              { date: '2026-03-27', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
              { date: '2026-03-28', type: 'run', guidelines: 'Long run', completed: false, skipped: false },
              { date: '2026-03-29', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result1 = normalizePlanPhases(phases);
    const result2 = normalizePlanPhases(result1);
    // Weeknumber and startDate should match
    expect(result2[0].weeks[0].startDate).toBe(result1[0].weeks[0].startDate);
    expect(result2[0].weeks[0].weekNumber).toBe(result1[0].weeks[0].weekNumber);
    // Training days preserved
    const trainingDays1 = result1.flatMap(p => p.weeks.flatMap(w => w.days)).filter(d => d.type !== 'rest');
    const trainingDays2 = result2.flatMap(p => p.weeks.flatMap(w => w.days)).filter(d => d.type !== 'rest');
    expect(trainingDays2.map(d => d.date)).toEqual(trainingDays1.map(d => d.date));
  });

  it('preserves phase names and descriptions', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base Building',
        description: 'Build aerobic base',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              { date: '2026-03-25', type: 'run', guidelines: 'Easy run', completed: false, skipped: false },
            ],
          },
        ],
      },
      {
        name: 'Peak',
        description: 'Peak training',
        weeks: [
          {
            weekNumber: 2,
            startDate: '2026-03-30',
            days: [
              { date: '2026-04-01', type: 'run', guidelines: 'Tempo run', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = normalizePlanPhases(phases);
    expect(result[0].name).toBe('Base Building');
    expect(result[0].description).toBe('Build aerobic base');
    expect(result[1].name).toBe('Peak');
    expect(result[1].description).toBe('Peak training');
  });

  it('handles multi-phase plan with days spanning many weeks', () => {
    // Phase 1: weeks 1-2, Phase 2: weeks 3-4
    const phases: PlanPhase[] = [
      {
        name: 'Phase 1',
        description: 'Phase 1',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              { date: '2026-03-24', type: 'run', guidelines: 'Run 1', completed: false, skipped: false },
            ],
          },
          {
            weekNumber: 2,
            startDate: '2026-03-30',
            days: [
              { date: '2026-03-31', type: 'run', guidelines: 'Run 2', completed: false, skipped: false },
            ],
          },
        ],
      },
      {
        name: 'Phase 2',
        description: 'Phase 2',
        weeks: [
          {
            weekNumber: 3,
            startDate: '2026-04-06',
            days: [
              { date: '2026-04-07', type: 'run', guidelines: 'Run 3', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = normalizePlanPhases(phases);
    expect(result).toHaveLength(2);
    const allDays = result.flatMap(p => p.weeks.flatMap(w => w.days)).filter(d => d.type !== 'rest');
    expect(allDays.find(d => d.date === '2026-03-24')).toBeDefined();
    expect(allDays.find(d => d.date === '2026-03-31')).toBeDefined();
    expect(allDays.find(d => d.date === '2026-04-07')).toBeDefined();
  });

  it('fills all weeks to 7 days with rest days for empty slots', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: 'Base',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              { date: '2026-03-25', type: 'run', guidelines: 'Run', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = normalizePlanPhases(phases);
    for (const phase of result) {
      for (const week of phase.weeks) {
        expect(week.days).toHaveLength(7);
      }
    }
  });

  it('week numbers are sequential starting from 1 per phase', () => {
    // Days in wrong weeks across 3 weeks — weekNumbers should be 1,2,3
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: 'Base',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              { date: '2026-03-24', type: 'run', guidelines: 'Run week 1', completed: false, skipped: false },
              // This day belongs to week 2
              { date: '2026-03-31', type: 'run', guidelines: 'Run week 2', completed: false, skipped: false },
              // This day belongs to week 3
              { date: '2026-04-07', type: 'run', guidelines: 'Run week 3', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = normalizePlanPhases(phases);
    const weeks = result[0].weeks;
    expect(weeks).toHaveLength(3);
    expect(weeks[0].weekNumber).toBe(1);
    expect(weeks[1].weekNumber).toBe(2);
    expect(weeks[2].weekNumber).toBe(3);
  });

  it('handles a single day with no rest days by building one week', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: 'Base',
        weeks: [
          {
            weekNumber: 1,
            startDate: '2026-03-23',
            days: [
              { date: '2026-03-24', type: 'run', guidelines: 'Single run', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = normalizePlanPhases(phases);
    expect(result[0].weeks).toHaveLength(1);
    expect(result[0].weeks[0].days).toHaveLength(7);
    expect(result[0].weeks[0].days.find(d => d.date === '2026-03-24')?.type).toBe('run');
  });
});
