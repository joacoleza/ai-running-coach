import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../shared/prompts.js';
import type { PlanPhase } from '../shared/types.js';

describe('buildSystemPrompt — basic structure', () => {
  it('includes running coach identity', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('AI running coach');
  });

  it('includes stay on topic instruction', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Stay on topic');
  });

  it('does not include calendar or date computation instructions', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain('Week 0 (this week)');
    expect(prompt).not.toContain('never compute');
    expect(prompt).not.toContain('DD/MM/YYYY');
    expect(prompt).not.toContain('<- today');
  });

  it('does not require currentDate parameter', () => {
    // Should work fine with no arguments
    const prompt = buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });
});

describe('buildSystemPrompt — plan:update tag format', () => {
  it('uses week/day attributes instead of date', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('week="3" day="B"');
    expect(prompt).not.toContain('date="YYYY-MM-DD"');
  });

  it('documents completed="true" for marking a day done', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('completed="true"');
  });

  it('documents skipped="true" for skipping a day', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('skipped="true"');
  });

  it('tells Claude it cannot delete training days', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('You cannot delete training days.');
  });

  it('instructs Claude to use week/day to mark removed days as skipped', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('mark it as skipped with `<plan:update week="N" day="X" skipped="true" />`');
  });

  it('tells Claude to count only active run days when summarising', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('count only non-skipped, non-completed run days');
  });
});

describe('buildSystemPrompt — plan:add tag format', () => {
  it('documents plan:add with week and day attributes', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('<plan:add week=');
    expect(prompt).toContain('day=');
  });

  it('does not contain date-based plan:add format', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain('<plan:add date=');
  });
});

describe('buildSystemPrompt — training plan JSON format', () => {
  it('includes label field in example JSON', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"label":"A"');
  });

  it('does not include date or startDate in example JSON', () => {
    const prompt = buildSystemPrompt();
    // The example JSON in the prompt should not have date fields
    expect(prompt).not.toContain('"startDate"');
    // No date field in days (only in goal targetDate)
    const trainingPlanMatch = prompt.match(/<training_plan>(.*?)<\/training_plan>/);
    if (trainingPlanMatch) {
      const exampleJson = trainingPlanMatch[1];
      // Parse and check days don't have date field
      const parsed = JSON.parse(exampleJson);
      const day = parsed.phases[0].weeks[0].days[0];
      expect(day.date).toBeUndefined();
      expect(day.label).toBeDefined();
    }
  });

  it('uses globally sequential weekNumber in example JSON', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('"weekNumber":1');
  });
});

describe('buildSystemPrompt — current training schedule', () => {
  it('does not show "authoritative" schedule section when phases is empty', () => {
    const prompt = buildSystemPrompt(undefined, undefined, []);
    // The prompt mentions "Current Training Schedule" in the rules text,
    // but should not have the "## Current Training Schedule (authoritative)" section
    expect(prompt).not.toContain('## Current Training Schedule');
  });

  it('shows schedule with Week/Day format when phases present', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: 'Base phase',
        weeks: [
          {
            weekNumber: 1,
            days: [
              { label: 'A', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy run', completed: false, skipped: false },
              { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
            ],
          },
        ],
      },
    ];

    const prompt = buildSystemPrompt(undefined, undefined, phases);
    expect(prompt).toContain('## Current Training Schedule');
    expect(prompt).toContain('Week 1 Day A');
    expect(prompt).toContain('Easy run');
    // Rest day (label '') should NOT appear in the schedule
    const scheduleMatch = prompt.match(/## Current Training Schedule[\s\S]*/);
    if (scheduleMatch) {
      // Only one "Week 1 Day" entry (the run), not an entry for the rest day
      const entries = scheduleMatch[0].match(/\*\*Week \d+ Day [A-G]\*\*/g) ?? [];
      expect(entries).toHaveLength(1);
    }
  });

  it('shows COMPLETED status for completed days', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: '',
        weeks: [
          {
            weekNumber: 2,
            days: [
              { label: 'A', type: 'run', guidelines: 'Long run', completed: true, skipped: false },
            ],
          },
        ],
      },
    ];

    const prompt = buildSystemPrompt(undefined, undefined, phases);
    expect(prompt).toContain('Week 2 Day A');
    expect(prompt).toContain('[COMPLETED]');
  });

  it('shows SKIPPED status for skipped days', () => {
    const phases: PlanPhase[] = [
      {
        name: 'Base',
        description: '',
        weeks: [
          {
            weekNumber: 1,
            days: [
              { label: 'B', type: 'run', guidelines: 'Tempo', completed: false, skipped: true },
            ],
          },
        ],
      },
    ];

    const prompt = buildSystemPrompt(undefined, undefined, phases);
    expect(prompt).toContain('Week 1 Day B');
    expect(prompt).toContain('[SKIPPED]');
  });
});

describe('buildSystemPrompt — onboarding step', () => {
  it('includes onboarding section when onboardingStep is provided', () => {
    const prompt = buildSystemPrompt(undefined, 2, []);
    expect(prompt).toContain('Onboarding');
    expect(prompt).toContain('question **3 of 6**');
  });

  it('asks about recent training in question 3', () => {
    const prompt = buildSystemPrompt(undefined, 2, []);
    expect(prompt).toContain('whether they have been training recently (this determines if past days should be included in the plan)');
  });

  it('does not include onboarding section when onboardingStep is undefined', () => {
    const prompt = buildSystemPrompt(undefined, undefined, []);
    expect(prompt).not.toContain('You are on question');
  });
});

describe('buildSystemPrompt — summary', () => {
  it('includes summary when provided', () => {
    const prompt = buildSystemPrompt('User ran 5K last week', undefined, []);
    expect(prompt).toContain('Conversation Summary');
    expect(prompt).toContain('User ran 5K last week');
  });
});
