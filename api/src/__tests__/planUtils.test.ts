import { describe, it, expect } from 'vitest';
import { getWeekDates, normalizeWeekDays } from '../shared/planUtils.js';
import type { PlanWeek } from '../shared/types.js';

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
