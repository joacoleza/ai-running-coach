import { describe, it, expect } from 'vitest';
import {
  parseDurationToMinutes,
  formatTotalTime,
  computeDateRange,
  groupRunsByWeek,
  fillWeekGaps,
  formatPaceToMMSS,
  computePlanAdherence,
  filterRunsByDiscipline,
  groupRunsByDiscipline,
  computeAvgSpeed,
} from '../hooks/useDashboard';
import type { PlanData } from '../hooks/usePlan';
import type { Run } from '../hooks/useRuns';

// Minimal Run stub for discipline tests
function makeDisciplineRun(date: string, distance: number, duration: string, discipline?: string): Run {
  return {
    _id: 'test-id',
    date,
    distance,
    duration,
    pace: 0,
    discipline,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  } as Run
}

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

describe('computePlanAdherence', () => {
  function makePlan(days: Array<{ type: 'run' | 'rest'; completed: boolean; skipped: boolean }>): PlanData {
    return {
      _id: 'test-plan',
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: { eventType: '10k', targetDate: '', weeklyMileage: 0, availableDays: 0, units: 'km' },
      phases: [{
        name: 'Phase 1',
        description: '',
        weeks: [{
          weekNumber: 1,
          days: days.map((d, i) => ({
            label: d.type === 'rest' ? '' : String.fromCharCode(65 + i), // A, B, C…
            type: d.type,
            guidelines: '',
            completed: d.completed,
            skipped: d.skipped,
          })),
        }],
      }],
    }
  }

  it('returns N/A for both when plan has only rest days', () => {
    const plan = makePlan([{ type: 'rest', completed: false, skipped: false }])
    expect(computePlanAdherence(plan)).toEqual({ adherence: 'N/A', progress: 'N/A' })
  })

  it('returns N/A adherence and 0% progress when nothing attempted', () => {
    const plan = makePlan([
      { type: 'run', completed: false, skipped: false },
      { type: 'run', completed: false, skipped: false },
    ])
    expect(computePlanAdherence(plan)).toEqual({ adherence: 'N/A', progress: '0%' })
  })

  it('returns 100% adherence and 100% progress when all days completed', () => {
    const plan = makePlan([
      { type: 'run', completed: true, skipped: false },
      { type: 'run', completed: true, skipped: false },
    ])
    expect(computePlanAdherence(plan)).toEqual({ adherence: '100%', progress: '100%' })
  })

  it('calculates adherence as completed / (completed + skipped), not completed / total', () => {
    // 2 completed, 1 skipped, 1 not started — 4 total
    // adherence = 2 / (2+1) = 67%, progress = (2+1) / 4 = 75%
    const plan = makePlan([
      { type: 'run', completed: true, skipped: false },
      { type: 'run', completed: true, skipped: false },
      { type: 'run', completed: false, skipped: true },
      { type: 'run', completed: false, skipped: false },
    ])
    expect(computePlanAdherence(plan)).toEqual({ adherence: '67%', progress: '75%' })
  })

  it('returns 0% adherence and some progress when all attempted days were skipped', () => {
    // 0 completed, 2 skipped, 1 not started — 3 total
    // adherence = 0 / (0+2) = 0%, progress = (0+2) / 3 = 67%
    const plan = makePlan([
      { type: 'run', completed: false, skipped: true },
      { type: 'run', completed: false, skipped: true },
      { type: 'run', completed: false, skipped: false },
    ])
    expect(computePlanAdherence(plan)).toEqual({ adherence: '0%', progress: '67%' })
  })

  it('ignores rest days in all counts', () => {
    // 1 run (completed) + 2 rest days — only the run counts
    const plan = makePlan([
      { type: 'run', completed: true, skipped: false },
      { type: 'rest', completed: false, skipped: false },
      { type: 'rest', completed: false, skipped: false },
    ])
    expect(computePlanAdherence(plan)).toEqual({ adherence: '100%', progress: '100%' })
  })

  it('works across multiple phases and weeks', () => {
    // Phase 1 week 1: A completed, B skipped
    // Phase 2 week 2: A not started
    // adherence = 1/(1+1) = 50%, progress = (1+1)/3 = 67%
    const plan: PlanData = {
      _id: 'multi-phase',
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: { eventType: '10k', targetDate: '', weeklyMileage: 0, availableDays: 0, units: 'km' },
      phases: [
        {
          name: 'Phase 1', description: '',
          weeks: [{ weekNumber: 1, days: [
            { label: 'A', type: 'run', guidelines: '', completed: true, skipped: false },
            { label: 'B', type: 'run', guidelines: '', completed: false, skipped: true },
          ]}],
        },
        {
          name: 'Phase 2', description: '',
          weeks: [{ weekNumber: 2, days: [
            { label: 'A', type: 'run', guidelines: '', completed: false, skipped: false },
          ]}],
        },
      ],
    }
    expect(computePlanAdherence(plan)).toEqual({ adherence: '50%', progress: '67%' })
  })
});

describe('filterRunsByDiscipline', () => {
  const runRun = makeDisciplineRun('2026-04-07', 5, '40:00', 'run')
  const gymRun = makeDisciplineRun('2026-04-07', 0, '45:00', 'gym')
  const cycleRun = makeDisciplineRun('2026-04-07', 20, '60:00', 'cycle')
  const undisciplinedRun = makeDisciplineRun('2026-04-07', 5, '40:00', undefined)

  it('returns all runs when discipline is "all"', () => {
    const result = filterRunsByDiscipline([runRun, gymRun, cycleRun, undisciplinedRun], 'all')
    expect(result).toHaveLength(4)
  })

  it('returns run and undefined-discipline runs when discipline is "run"', () => {
    const result = filterRunsByDiscipline([runRun, gymRun, cycleRun, undisciplinedRun], 'run')
    expect(result).toHaveLength(2)
    expect(result).toContain(runRun)
    expect(result).toContain(undisciplinedRun)
  })

  it('returns only gym runs when discipline is "gym"', () => {
    const result = filterRunsByDiscipline([runRun, gymRun, cycleRun], 'gym')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(gymRun)
  })

  it('returns only cycle runs when discipline is "cycle"', () => {
    const result = filterRunsByDiscipline([runRun, gymRun, cycleRun], 'cycle')
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(cycleRun)
  })

  it('returns empty array for empty input regardless of discipline', () => {
    expect(filterRunsByDiscipline([], 'gym')).toHaveLength(0)
    expect(filterRunsByDiscipline([], 'all')).toHaveLength(0)
  })
})

describe('groupRunsByDiscipline', () => {
  it('single run session creates bucket with runDistance only', () => {
    const runs = [makeDisciplineRun('2026-04-07', 5, '40:00', 'run')]
    const buckets = groupRunsByDiscipline(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].runDistance).toBe(5)
    expect(buckets[0].gymSessions).toBe(0)
    expect(buckets[0].cycleDistance).toBe(0)
  })

  it('single gym session creates bucket with gymSessions count', () => {
    const runs = [makeDisciplineRun('2026-04-07', 0, '45:00', 'gym')]
    const buckets = groupRunsByDiscipline(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].gymSessions).toBe(1)
    expect(buckets[0].runDistance).toBe(0)
    expect(buckets[0].cycleDistance).toBe(0)
  })

  it('single cycle session creates bucket with cycleDistance', () => {
    const runs = [makeDisciplineRun('2026-04-07', 20, '60:00', 'cycle')]
    const buckets = groupRunsByDiscipline(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].cycleDistance).toBe(20)
    expect(buckets[0].gymSessions).toBe(0)
    expect(buckets[0].runDistance).toBe(0)
  })

  it('three disciplines in same week produce one bucket with all values', () => {
    const runs = [
      makeDisciplineRun('2026-04-07', 5, '40:00', 'run'),
      makeDisciplineRun('2026-04-08', 0, '45:00', 'gym'),
      makeDisciplineRun('2026-04-09', 20, '60:00', 'cycle'),
    ]
    const buckets = groupRunsByDiscipline(runs)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].runDistance).toBe(5)
    expect(buckets[0].gymSessions).toBe(1)
    expect(buckets[0].cycleDistance).toBe(20)
  })

  it('two runs in different weeks produce two buckets sorted ascending', () => {
    const runs = [
      makeDisciplineRun('2026-04-14', 5, '40:00', 'run'),
      makeDisciplineRun('2026-04-07', 8, '64:00', 'run'),
    ]
    const buckets = groupRunsByDiscipline(runs)
    expect(buckets).toHaveLength(2)
    // Earlier week comes first
    expect(buckets[0].weekKey < buckets[1].weekKey).toBe(true)
  })

  it('run with no discipline field is counted as runDistance', () => {
    const runs = [makeDisciplineRun('2026-04-07', 5, '40:00', undefined)]
    const buckets = groupRunsByDiscipline(runs)
    expect(buckets[0].runDistance).toBe(5)
    expect(buckets[0].gymSessions).toBe(0)
  })
})

describe('computeAvgSpeed', () => {
  it('20km in 60:00 returns "20.0 km/h"', () => {
    const runs = [makeDisciplineRun('2026-04-07', 20, '60:00', 'cycle')]
    expect(computeAvgSpeed(runs)).toBe('20.0 km/h')
  })

  it('returns "0.0 km/h" for empty runs array', () => {
    expect(computeAvgSpeed([])).toBe('0.0 km/h')
  })

  it('two sessions: 10km in 30:00 and 20km in 60:00 → 30km/90min * 60 = 20.0 km/h', () => {
    const runs = [
      makeDisciplineRun('2026-04-07', 10, '30:00', 'cycle'),
      makeDisciplineRun('2026-04-09', 20, '60:00', 'cycle'),
    ]
    expect(computeAvgSpeed(runs)).toBe('20.0 km/h')
  })
})

describe('useDashboard per-discipline exports', () => {
  // These are pure functions already tested above via groupRunsByWeek/filterRunsByDiscipline.
  // Here we verify the filterRunsByDiscipline combinations used in the hook.

  it('filterRunsByDiscipline with run returns runs with discipline run or undefined', () => {
    const runs = [
      makeDisciplineRun('2026-04-07', 5, '40:00', 'run'),
      makeDisciplineRun('2026-04-08', 0, '45:00', 'gym'),
      makeDisciplineRun('2026-04-09', 20, '60:00', 'cycle'),
      makeDisciplineRun('2026-04-10', 5, '40:00', undefined),
    ]
    const runRuns = filterRunsByDiscipline(runs, 'run')
    const cycleRuns = filterRunsByDiscipline(runs, 'cycle')
    const gymRuns = filterRunsByDiscipline(runs, 'gym')
    expect(runRuns).toHaveLength(2)   // run + undefined
    expect(cycleRuns).toHaveLength(1)
    expect(gymRuns).toHaveLength(1)
  })
})
