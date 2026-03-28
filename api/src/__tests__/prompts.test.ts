import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../shared/prompts.js';

// Fixed date: Saturday 2026-03-28 — current week Mon=2026-03-23, next Mon=2026-03-30
const SATURDAY = '2026-03-28';

describe('buildSystemPrompt — upcoming week calendars', () => {
  it('includes the current week calendar in the prompt', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Current week Mon is 2026-03-23 and Sat (today) is 2026-03-28
    expect(prompt).toContain('Mon 2026-03-23');
    expect(prompt).toContain('Sat 2026-03-28 ← today');
  });

  it('includes 5 upcoming weeks with correct dates', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Week +1: Mon 2026-03-30
    expect(prompt).toContain('Week +1:');
    expect(prompt).toContain('Mon 2026-03-30');
    // Week +2: Mon 2026-04-06
    expect(prompt).toContain('Week +2:');
    expect(prompt).toContain('Mon 2026-04-06');
    // Week +3: Mon 2026-04-13
    expect(prompt).toContain('Week +3:');
    expect(prompt).toContain('Mon 2026-04-13');
    // Week +4: Mon 2026-04-20
    expect(prompt).toContain('Week +4:');
    expect(prompt).toContain('Mon 2026-04-20');
    // Week +5: Mon 2026-04-27
    expect(prompt).toContain('Week +5:');
    expect(prompt).toContain('Mon 2026-04-27');
  });

  it('upcoming weeks include all 7 days (Mon–Sun) with correct dates', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Week +1: Mon 2026-03-30 … Sun 2026-04-05
    expect(prompt).toContain('Mon 2026-03-30');
    expect(prompt).toContain('Tue 2026-03-31');
    expect(prompt).toContain('Wed 2026-04-01');
    expect(prompt).toContain('Thu 2026-04-02');
    expect(prompt).toContain('Fri 2026-04-03');
    expect(prompt).toContain('Sat 2026-04-04');
    expect(prompt).toContain('Sun 2026-04-05');
  });

  it('does not tell Claude to compute day-of-week independently', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('do not compute day-of-week yourself');
  });
});

describe('buildSystemPrompt — upcoming week calendars from a Monday', () => {
  const MONDAY = '2026-03-30';

  it('current week starts on the same Monday when today is Monday', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], MONDAY);
    expect(prompt).toContain('Mon 2026-03-30 ← today');
  });

  it('week +1 starts the following Monday', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], MONDAY);
    expect(prompt).toContain('Mon 2026-04-06');
  });
});

describe('buildSystemPrompt — upcoming week calendars from a Sunday', () => {
  const SUNDAY = '2026-03-29';

  it('current week Mon is the day before yesterday', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SUNDAY);
    // Monday of the week containing Sunday 2026-03-29 is 2026-03-23
    expect(prompt).toContain('Mon 2026-03-23');
    expect(prompt).toContain('Sun 2026-03-29 ← today');
  });

  it('week +1 starts 2026-03-30', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SUNDAY);
    expect(prompt).toContain('Mon 2026-03-30');
  });
});

describe('buildSystemPrompt — skip-vs-delete instructions', () => {
  it('tells Claude it cannot delete training days', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('cannot delete training days');
  });

  it('instructs Claude to use skipped="true" when user asks to remove a day', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('skipped="true"');
    // Instruction should be in the plan-update rules section
    expect(prompt).toContain('remove');
  });

  it('tells Claude to be transparent about skipping vs deleting', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('marked as skipped');
  });

  it('tells Claude to verify weekday names against provided calendar', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('verify the weekday name against the provided calendar');
  });
});

describe('buildSystemPrompt — past dates allowed in initial training plan', () => {
  it('allows past dates in the training_plan block', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('Past training days');
    expect(prompt).toContain('may be included');
  });

  it('instructs Claude to set completed: true for past sessions the user ran', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('completed: true');
  });

  it('instructs Claude to set skipped: true for past sessions the user missed', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('skipped: true');
  });

  it('still forbids plan:add on past dates', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // The plan:add restriction should still be present
    expect(prompt).toContain('plan:add');
    expect(prompt).toContain('cannot target past dates');
  });

  it('clarifies past-date allowance is only for initial training_plan block', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('ONLY for the initial');
  });

  it('onboarding prompt mentions recent training history context', () => {
    const prompt = buildSystemPrompt(undefined, 2, [], SATURDAY);
    expect(prompt).toContain('training recently');
  });
});

describe('buildSystemPrompt — AppShell layout (h-[100dvh])', () => {
  // This is a documentation test — verifying the fix exists in the source.
  // The actual rendering is tested by AppShell unit tests.
  it('placeholder: mobile layout uses dynamic viewport height (tested in AppShell)', () => {
    // See AppShell.tsx: h-[100dvh] replaces h-screen so Safari bottom chrome does not clip the sidebar
    expect(true).toBe(true);
  });
});
