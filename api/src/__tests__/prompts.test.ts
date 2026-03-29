import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../shared/prompts.js';

// Fixed date: Saturday 2026-03-28
const SATURDAY = '2026-03-28';

describe('buildSystemPrompt — date calendar instruction', () => {
  it('includes today date and day-of-week', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('Saturday, 2026-03-28');
  });

  it('instructs Claude to use the calendar, not compute dates', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('use the calendar below, never compute');
  });

  it('tells Claude never to compute day-of-week itself', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('Never compute day-of-week yourself');
  });

  it('explains DD/MM/YYYY parsing', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('DD/MM/YYYY format');
  });

  it('includes a pre-computed 26-week calendar with past and future weeks', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    // Should contain both past (-13) and future (+12) week markers
    expect(prompt).toContain('Week -13:');
    expect(prompt).toContain('Week +12:');
    expect(prompt).toContain('Week 0 (this week):');
  });

  it('marks today with <- today in the calendar', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('2026-03-28 <- today');
  });
});

describe('buildSystemPrompt — skip-vs-delete instructions', () => {
  it('tells Claude it cannot delete training days', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('You cannot delete training days.');
  });

  it('instructs Claude to mark removed days as skipped using plan:update', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
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

  it('tells Claude to use weekday names from the calendar', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
    expect(prompt).toContain('use the exact weekday shown in the calendar above');
  });
});

describe('buildSystemPrompt — past dates allowed in initial training plan', () => {
  it('allows past dates in the training_plan block with the correct today-anchored phrasing', () => {
    const prompt = buildSystemPrompt(undefined, undefined, [], SATURDAY);
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
    expect(prompt).toContain('Past completed/skipped days** can also be added with `<plan:add>`');
    expect(prompt).toContain('completed="true"` or `skipped="true"`');
  });

  it('onboarding question 3 asks about recent training to help populate past sessions', () => {
    const prompt = buildSystemPrompt(undefined, 2, [], SATURDAY);
    expect(prompt).toContain('whether they have been training recently (this determines if past days should be included in the plan)');
  });
});
