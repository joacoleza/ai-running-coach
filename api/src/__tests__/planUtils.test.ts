import { describe, it, expect } from 'vitest';
import { assignPlanStructure } from '../shared/planUtils.js';
import type { PlanPhase } from '../shared/types.js';

describe('assignPlanStructure', () => {
  it('returns empty array for empty input', () => {
    expect(assignPlanStructure([])).toEqual([]);
  });

  it('assigns globally sequential week numbers across multiple phases', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Phase 1',
        description: 'Phase 1',
        weeks: [
          { weekNumber: 0, days: [] },
          { weekNumber: 0, days: [] },
        ],
      },
      {
        name: 'Phase 2',
        description: 'Phase 2',
        weeks: [
          { weekNumber: 0, days: [] },
          { weekNumber: 0, days: [] },
        ],
      },
    ];

    const result = assignPlanStructure(phases);
    expect(result[0].weeks[0].weekNumber).toBe(1);
    expect(result[0].weeks[1].weekNumber).toBe(2);
    expect(result[1].weeks[0].weekNumber).toBe(3);
    expect(result[1].weeks[1].weekNumber).toBe(4);
  });

  it('assigns labels A,B,C to non-rest days and empty string to rest days', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: 'Base',
        weeks: [
          {
            weekNumber: 1,
            days: [
              { label: '', type: 'run', guidelines: 'Run 1', completed: false, skipped: false },
              { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
              { label: '', type: 'run', guidelines: 'Run 2', completed: false, skipped: false },
              { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
              { label: '', type: 'run', guidelines: 'Run 3', completed: false, skipped: false },
              { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
              { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = assignPlanStructure(phases);
    const days = result[0].weeks[0].days;
    expect(days[0].label).toBe('A'); // run
    expect(days[1].label).toBe('');  // rest
    expect(days[2].label).toBe('B'); // run
    expect(days[3].label).toBe('');  // rest
    expect(days[4].label).toBe('C'); // run
    expect(days[5].label).toBe('');  // rest
    expect(days[6].label).toBe('');  // rest
  });

  it('preserves phase names and descriptions', () => {
    const phases: PlanPhase[] = [
      { name: 'Base Building', description: 'Build aerobic base', weeks: [] },
      { name: 'Peak', description: 'Peak training', weeks: [] },
    ];

    const result = assignPlanStructure(phases);
    expect(result[0].name).toBe('Base Building');
    expect(result[0].description).toBe('Build aerobic base');
    expect(result[1].name).toBe('Peak');
    expect(result[1].description).toBe('Peak training');
  });

  it('handles phase with no weeks', () => {
    const phases: PlanPhase[] = [
      { name: 'Empty Phase', description: '', weeks: [] },
    ];
    const result = assignPlanStructure(phases);
    expect(result[0].weeks).toHaveLength(0);
  });

  it('labels reset per week — each week starts with A', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Phase 1',
        description: '',
        weeks: [
          {
            weekNumber: 1,
            days: [
              { label: '', type: 'run', guidelines: 'Run A', completed: false, skipped: false },
            ],
          },
          {
            weekNumber: 2,
            days: [
              { label: '', type: 'run', guidelines: 'Run A2', completed: false, skipped: false },
              { label: '', type: 'run', guidelines: 'Run B2', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const result = assignPlanStructure(phases);
    expect(result[0].weeks[0].days[0].label).toBe('A');
    expect(result[0].weeks[1].days[0].label).toBe('A');
    expect(result[0].weeks[1].days[1].label).toBe('B');
  });

  it('preserves day properties (type, guidelines, objective, completed, skipped)', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: '',
        weeks: [
          {
            weekNumber: 1,
            days: [
              {
                label: '',
                type: 'run',
                objective: { kind: 'distance', value: 5, unit: 'km' },
                guidelines: 'Easy run',
                completed: true,
                skipped: false,
              },
            ],
          },
        ],
      },
    ];

    const result = assignPlanStructure(phases);
    const day = result[0].weeks[0].days[0];
    expect(day.label).toBe('A');
    expect(day.type).toBe('run');
    expect(day.objective).toEqual({ kind: 'distance', value: 5, unit: 'km' });
    expect(day.guidelines).toBe('Easy run');
    expect(day.completed).toBe(true);
    expect(day.skipped).toBe(false);
  });
});
