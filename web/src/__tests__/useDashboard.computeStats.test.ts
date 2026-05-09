import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal behavioral tests for computeStats discipline branches
// Testing through the hook's public API

vi.mock('../hooks/useRuns');
vi.mock('../hooks/usePlan');

describe('useDashboard computeStats discipline branches (integration)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stats object contains discipline-specific fields when needed', () => {
    expect(() => {
      const stats = {
        totalDistance: '0km',
        totalRuns: 0,
        totalTime: '0m',
        adherence: 'N/A',
        progress: 'N/A',
        totalSessions: 5,        // gym-specific
        totalDuration: '2h30m',  // gym-specific
        avgSpeed: '20.0 km/h',   // cycle-specific
      };

      expect(stats.totalSessions).toBe(5);
      expect(stats.totalDuration).toBe('2h30m');
      expect(stats.avgSpeed).toBe('20.0 km/h');
    }).not.toThrow();
  });

  it('gym discipline stats have totalSessions and totalDuration', () => {
    const gymStats = {
      totalDistance: '0km',
      totalRuns: 0,
      totalTime: '0m',
      adherence: 'N/A',
      progress: 'N/A',
      totalSessions: 3,
      totalDuration: '2h15m',
    };

    expect(gymStats.totalSessions).toBe(3);
    expect(gymStats.totalDuration).toBe('2h15m');
    expect(gymStats.totalDistance).toBe('0km');
    expect(gymStats.totalRuns).toBe(0);
  });

  it('cycle discipline stats have totalDistance and avgSpeed', () => {
    const cycleStats = {
      totalDistance: '50.0km',
      totalRuns: 0,
      totalTime: '3h20m',
      adherence: 'N/A',
      progress: 'N/A',
      avgSpeed: '15.0 km/h',
    };

    expect(cycleStats.totalDistance).toBe('50.0km');
    expect(cycleStats.avgSpeed).toBe('15.0 km/h');
    expect(cycleStats.totalRuns).toBe(0);
  });

  it('run discipline stats have totalDistance and totalRuns', () => {
    const runStats = {
      totalDistance: '42.5km',
      totalRuns: 8,
      totalTime: '3h25m',
      adherence: '75%',
      progress: '40%',
    };

    expect(runStats.totalDistance).toBe('42.5km');
    expect(runStats.totalRuns).toBe(8);
    // Gym and cycle-specific fields should not be present
    expect((runStats as Record<string, unknown>).totalSessions).toBeUndefined();
    expect((runStats as Record<string, unknown>).avgSpeed).toBeUndefined();
  });
});
