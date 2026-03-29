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

  it('includes 24 upcoming weeks with correct dates', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Week +1: Mon 2026-03-30
    expect(prompt).toContain('Week +1:');
    expect(prompt).toContain('Mon 2026-03-30');
    // Week +5: Mon 2026-04-27
    expect(prompt).toContain('Week +5:');
    expect(prompt).toContain('Mon 2026-04-27');
    // Week +8: Mon 2026-05-18
    expect(prompt).toContain('Week +8:');
    expect(prompt).toContain('Mon 2026-05-18');
    // Week +12: Mon 2026-06-15
    expect(prompt).toContain('Week +12:');
    expect(prompt).toContain('Mon 2026-06-15');
    // Week +24: Mon 2026-09-07 — last week of 24-week lookahead
    expect(prompt).toContain('Week +24:');
    expect(prompt).toContain('Mon 2026-09-07');
    // Must NOT include Week +25 (beyond 24-week limit)
    expect(prompt).not.toContain('Week +25:');
  });

  it('includes 13 past weeks for historical training data', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Week -1: Mon 2026-03-16 (the week before current)
    expect(prompt).toContain('Week -1:');
    expect(prompt).toContain('Mon 2026-03-16');
    // Week -4: Mon 2026-02-23
    expect(prompt).toContain('Week -4:');
    expect(prompt).toContain('Mon 2026-02-23');
    // Week -8: Mon 2026-01-26 — covers typical plan history
    expect(prompt).toContain('Week -8:');
    expect(prompt).toContain('Mon 2026-01-26');
    // Week -13: Mon 2025-12-22 — 13 weeks back (start of lookahead)
    expect(prompt).toContain('Week -13:');
    expect(prompt).toContain('Mon 2025-12-22');
    // Must NOT include Week -14 (beyond 13-week past limit)
    expect(prompt).not.toContain('Week -14:');
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
    expect(prompt).toContain('Never compute day-of-week yourself');
  });

  it('includes DD/MM/YYYY date format parsing instruction', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('DD/MM/YYYY format');
    expect(prompt).toContain('08/02/2026');
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
    expect(prompt).toContain('You cannot delete training days.');
  });

  it('instructs Claude to mark removed days as skipped using plan:update', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Must link the "remove/delete" request to the skipped=true action in one sentence
    expect(prompt).toContain('asks to "remove" or "delete" a day, mark it as skipped with `<plan:update date="..." skipped="true" />`');
  });

  it('tells Claude to be transparent that the day is still visible as skipped, not deleted', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('tell the user the day has been marked as skipped (it will appear crossed out in the plan)');
  });

  it('tells Claude to count only active (non-skipped, non-completed) run days when summarising', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('count only non-skipped, non-completed run days');
  });

  it('tells Claude to verify weekday names against the provided calendar', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('verify the weekday name against the provided calendar');
  });
});

describe('buildSystemPrompt — past dates allowed in initial training plan', () => {
  it('allows past dates in the training_plan block with the correct today-anchored phrasing', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Must be a single coherent statement, not two stray fragments
    expect(prompt).toContain('Past training days (before today 2026-03-28) may be included');
  });

  it('links completed: true to sessions the user ran in the same sentence', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('set `completed: true` if the user ran it');
  });

  it('links skipped: true to sessions the user missed in the same sentence', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('`skipped: true` if they missed it');
  });

  it('plan:add allows past dates with completed/skipped flags', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Past-date adds are allowed with completed/skipped flags — same as training_plan block
    expect(prompt).toContain('Past completed/skipped days** can also be added with `<plan:add>`');
    expect(prompt).toContain('completed="true"` or `skipped="true"`');
  });

  it('onboarding question 3 asks about recent training to help populate past sessions', () => {
    const prompt = buildSystemPrompt(undefined, 2, [], SATURDAY);
    expect(prompt).toContain('whether they have been training recently (this determines if past days should be included in the plan)');
  });
});
