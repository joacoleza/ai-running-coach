import { describe, it, expect } from 'vitest';
import { planToMarkdown } from '../utils/planToMarkdown';
import type { PlanData } from '../hooks/usePlan';


function makePlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    _id: 'plan-1',
    status: 'active',
    onboardingMode: 'conversational',
    onboardingStep: 6,
    goal: {
      eventType: '10K',
      targetDate: '2026-06-01',
      weeklyMileage: 30,
      availableDays: 4,
      units: 'km',
    },
    phases: [
      {
        name: 'Base Building',
        description: 'Build aerobic base',
        weeks: [
          {
            weekNumber: 1,
            days: [
              {
                label: 'A',
                type: 'run',
                objective: { kind: 'distance', value: 5, unit: 'km' },
                guidelines: 'Easy run',
                completed: false,
                skipped: false,
              },
              {
                label: '',
                type: 'rest',
                guidelines: 'Rest day',
                completed: false,
                skipped: false,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('planToMarkdown', () => {
  it('renders plan objective as title (capitalized)', () => {
    const plan = makePlan({ objective: 'marathon' });
    const result = planToMarkdown(plan);
    expect(result).toMatch(/^# Marathon/);
  });

  it('renders phase name as h2 heading', () => {
    const result = planToMarkdown(makePlan());
    expect(result).toContain('## Base Building');
  });

  it('renders week number as h3 heading', () => {
    const result = planToMarkdown(makePlan());
    expect(result).toContain('### Week 1');
  });

  it('renders run day with Day label, objective and guidelines', () => {
    const result = planToMarkdown(makePlan());
    expect(result).toContain('Day A');
    expect(result).toContain('5 km');
    expect(result).toContain('Easy run');
  });

  it('renders rest day with Rest label (no Day label)', () => {
    const result = planToMarkdown(makePlan());
    expect(result).toContain('- Rest');
  });

  it('renders completed day with strikethrough and checkmark', () => {
    const plan = makePlan();
    plan.phases[0].weeks[0].days[0] = {
      ...plan.phases[0].weeks[0].days[0],
      completed: true,
    };
    const result = planToMarkdown(plan);
    expect(result).toContain('~~');
    expect(result).toContain('✓');
  });

  it('renders skipped day with strikethrough and skipped label', () => {
    const plan = makePlan();
    plan.phases[0].weeks[0].days[0] = {
      ...plan.phases[0].weeks[0].days[0],
      skipped: true,
    };
    const result = planToMarkdown(plan);
    expect(result).toContain('~~');
    expect(result).toContain('skipped');
  });

  it('uses Training Plan as title when no objective set', () => {
    const result = planToMarkdown(makePlan({ objective: undefined }));
    expect(result).toMatch(/^# Training Plan/);
  });
});
