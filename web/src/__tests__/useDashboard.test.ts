import { describe, it, expect } from 'vitest';
import {
  parseDurationToMinutes,
  formatTotalTime,
  computeDateRange,
  groupRunsByWeek,
  fillWeekGaps,
  formatPaceToMMSS,
} from '../hooks/useDashboard';

// Minimal Run stub for groupRunsByWeek tests
function makeRun(overrides: {
  date: string
  distance: number
  duration: string
  pace?: number
  avgHR?: number
}): Parameters<typeof groupRunsByWeek>[0][0] {
  return {
    _id: 'test-id',
    date: overrides.date,
    distance: overrides.distance,
    duration: overrides.duration,
    pace: overrides.pace ?? (overrides.distance > 0 ? parseDurationToMinutes(overrides.duration) / overrides.distance : 0),
    avgHR: overrides.avgHR,
    notes: '',
  } as Parameters<typeof groupRunsByWeek>[0][0]
}

describe('parseDurationToMinutes', () => {
  it('parses MM:SS format', () => {
    expect(parseDurationToMinutes('25:00')).toBe(25);
  });

  it('parses HH:MM:SS format', () => {
    expect(parseDurationToMinutes('1:05:30')).toBe(65.5);
  });

  it('parses short MM:SS correctly', () => {
    expect(parseDurationToMinutes('0:30')).toBe(0.5);
  });

  it('returns 0 for empty string', () => {
    expect(parseDurationToMinutes('')).toBe(0);
  });

  it('returns 0 for invalid string', () => {
    expect(parseDurationToMinutes('invalid')).toBe(0);
  });
});

describe('formatTotalTime', () => {
  it('returns "0m" for 0 minutes', () => {
    expect(formatTotalTime(0)).toBe('0m');
  });

  it('returns minutes only when < 60', () => {
    expect(formatTotalTime(45)).toBe('45m');
  });

  it('returns hours and minutes for exactly 60', () => {
    expect(formatTotalTime(60)).toBe('1h0m');
  });

  it('returns hours and minutes for 90', () => {
    expect(formatTotalTime(90)).toBe('1h30m');
  });

  it('returns hours and minutes for 125', () => {
    expect(formatTotalTime(125)).toBe('2h5m');
  });
});

describe('computeDateRange', () => {
  const today = new Date('2026-04-08');

  it('returns null for current-plan', () => {
    expect(computeDateRange('current-plan', today)).toBeNull();
  });

  it('returns empty date range for all-time', () => {
    const range = computeDateRange('all-time', today);
    expect(range).not.toBeNull();
    expect(range!.dateFrom).toBeUndefined();
    expect(range!.dateTo).toBeUndefined();
  });

  it('returns 28-day range for last-4-weeks', () => {
    const range = computeDateRange('last-4-weeks', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    expect(range!.dateFrom).toBe('2026-03-11');
  });

  it('returns Jan 1 as dateFrom for this-year', () => {
    const range = computeDateRange('this-year', today);
    expect(range).not.toBeNull();
    expect(range!.dateFrom).toBe('2026-01-01');
    expect(range!.dateTo).toBe('2026-04-08');
  });

  it('returns 365-day range for last-12-months', () => {
    const range = computeDateRange('last-12-months', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    // 365 days before 2026-04-08 is 2025-04-08
    expect(range!.dateFrom).toBe('2025-04-08');
  });

  it('returns 56-day range for last-8-weeks', () => {
    const range = computeDateRange('last-8-weeks', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    expect(range!.dateFrom).toBe('2026-02-11');
  });

  it('returns 91-day range for last-3-months', () => {
    const range = computeDateRange('last-3-months', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    expect(range!.dateFrom).toBe('2026-01-07');
  });
});

describe('groupRunsByWeek', () => {
  it('single run in a week: avgPace equals total_duration / total_distance', () => {
    // 5km in 40 minutes → pace = 40/5 = 8.0 min/km
    const runs = [makeRun({ date: '2026-04-07', distance: 5, duration: '40:00' })]
    const buckets = groupRunsByWeek(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].avgPace).toBeCloseTo(8.0, 4)
  })

  it('two runs same week with equal distance/pace: avgPace equals that pace', () => {
    // Both 5km @ 8:00/km (40 min each). Weighted = (40+40)/(5+5) = 80/10 = 8.0
    const runs = [
      makeRun({ date: '2026-04-07', distance: 5, duration: '40:00' }),
      makeRun({ date: '2026-04-08', distance: 5, duration: '40:00' }),
    ]
    const buckets = groupRunsByWeek(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].avgPace).toBeCloseTo(8.0, 4)
  })

  it('two runs same week with different distances: avgPace is distance-weighted (NOT arithmetic mean)', () => {
    // 5km @ 8:00/km (40 min) + 10km @ 7:00/km (70 min)
    // Arithmetic mean of paces: (8.0 + 7.0) / 2 = 7.5 (WRONG)
    // Correct: (40 + 70) / (5 + 10) = 110 / 15 ≈ 7.333
    const runs = [
      makeRun({ date: '2026-04-07', distance: 5, duration: '40:00', pace: 8.0 }),
      makeRun({ date: '2026-04-08', distance: 10, duration: '1:10:00', pace: 7.0 }),
    ]
    const buckets = groupRunsByWeek(runs)
    expect(buckets).toHaveLength(1)
    // Must be close to 7.333, NOT 7.5
    expect(buckets[0].avgPace).toBeCloseTo(110 / 15, 4)
    expect(buckets[0].avgPace).not.toBeCloseTo(7.5, 2)
  })

  it('run with zero distance: bucket avgPace is null if all runs have zero distance', () => {
    const runs = [makeRun({ date: '2026-04-07', distance: 0, duration: '0:00' })]
    const buckets = groupRunsByWeek(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].avgPace).toBeNull()
  })

  it('run with "0:00" duration and valid distance: avgPace is 0 (no movement time)', () => {
    // totalDurationMinutes = 0, distance = 5 → avgPace = 0/5 = 0, but our guard requires totalDurationMinutes > 0
    const runs = [makeRun({ date: '2026-04-07', distance: 5, duration: '0:00' })]
    const buckets = groupRunsByWeek(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].avgPace).toBeNull()
  })

  it('single run with fractional distance (e.g. 6.03km): pace uses exact distance, not rounded', () => {
    // 6.03km in 45:01 → 45.0167 min / 6.03 ≈ 7.465, NOT 45.0167 / 6.0 = 7.503
    // Regression: bucket.distance was being rounded after each run, causing inflated pace
    const runs = [makeRun({ date: '2026-04-14', distance: 6.03, duration: '45:01' })]
    const buckets = groupRunsByWeek(runs)
    expect(buckets).toHaveLength(1)
    const expectedPace = (45 + 1 / 60) / 6.03
    expect(buckets[0].avgPace).toBeCloseTo(expectedPace, 3)
    // Must NOT equal the rounded-distance version
    expect(buckets[0].avgPace).not.toBeCloseTo((45 + 1 / 60) / 6.0, 2)
    // Displayed distance is still rounded to 1 decimal
    expect(buckets[0].distance).toBe(6.0)
  })

  it('each bucket includes a weekKey ISO date string', () => {
    const runs = [makeRun({ date: '2026-04-07', distance: 5, duration: '40:00' })]
    const buckets = groupRunsByWeek(runs)
    // weekKey is an ISO date string (YYYY-MM-DD); exact date depends on timezone
    expect(buckets[0].weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
});

describe('formatPaceToMMSS', () => {
  it('converts 7.0 to "7:00"', () => {
    expect(formatPaceToMMSS(7.0)).toBe('7:00')
  })

  it('converts 7.118 to "7:07"', () => {
    expect(formatPaceToMMSS(7.118)).toBe('7:07')
  })

  it('converts 7.92 to "7:55"', () => {
    expect(formatPaceToMMSS(7.92)).toBe('7:55')
  })

  it('converts 8.533 to "8:32"', () => {
    expect(formatPaceToMMSS(8.533)).toBe('8:32')
  })

  it('pads seconds < 10 with leading zero', () => {
    expect(formatPaceToMMSS(8.083)).toBe('8:05')
  })

  it('handles rounding that pushes seconds to 60', () => {
    // 7 + 59.5/60 rounds to 60 seconds → should be 8:00
    expect(formatPaceToMMSS(7 + 59.5 / 60)).toBe('8:00')
  })
});

describe('fillWeekGaps', () => {
  it('returns the same list when fewer than 2 buckets', () => {
    const single = groupRunsByWeek([makeRun({ date: '2026-04-07', distance: 5, duration: '40:00' })])
    expect(fillWeekGaps(single)).toHaveLength(1)
    expect(fillWeekGaps([])).toHaveLength(0)
  })

  it('inserts empty bucket between two non-consecutive weeks', () => {
    // Week of Apr 7 and week of Apr 21 are two weeks apart — one gap week in between
    const runs = [
      makeRun({ date: '2026-04-07', distance: 5, duration: '40:00' }),
      makeRun({ date: '2026-04-21', distance: 6, duration: '48:00' }),
    ]
    const buckets = groupRunsByWeek(runs)
    expect(buckets).toHaveLength(2)
    const filled = fillWeekGaps(buckets)
    expect(filled).toHaveLength(3)
    // Middle bucket should have no data (weekKey is timezone-dependent)
    expect(filled[1].weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(filled[1].distance).toBe(0)
    expect(filled[1].avgPace).toBeNull()
  })

  it('does not insert gaps for consecutive weeks', () => {
    const runs = [
      makeRun({ date: '2026-04-07', distance: 5, duration: '40:00' }),  // week Apr 6
      makeRun({ date: '2026-04-14', distance: 6, duration: '48:00' }), // week Apr 13
    ]
    const buckets = groupRunsByWeek(runs)
    const filled = fillWeekGaps(buckets)
    expect(filled).toHaveLength(2)
  })
});
