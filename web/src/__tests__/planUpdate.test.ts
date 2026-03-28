import { describe, it, expect } from 'vitest';
import { parseXmlAttrs } from '../hooks/useChat';

// Regexes used in useChat.ts for plan tag matching
const planUpdateRegex = /<plan:update\s+([^/]+)\/>/g;
const planAddRegex = /<plan:add\s+([^/]+)\/>/g;

describe('parseXmlAttrs', () => {
  it('extracts single attribute', () => {
    const result = parseXmlAttrs('date="2026-04-01"');
    expect(result).toEqual({ date: '2026-04-01' });
  });

  it('extracts multiple attributes', () => {
    const result = parseXmlAttrs('date="2026-04-01" guidelines="Easy run" completed="true"');
    expect(result).toEqual({
      date: '2026-04-01',
      guidelines: 'Easy run',
      completed: 'true',
    });
  });

  it('returns empty object for empty string', () => {
    const result = parseXmlAttrs('');
    expect(result).toEqual({});
  });

  it('handles attributes with special characters in values', () => {
    const result = parseXmlAttrs('date="2026-04-01" objective_value="10"');
    expect(result).toEqual({ date: '2026-04-01', objective_value: '10' });
  });
});

describe('plan:update tag stripping', () => {
  it('strips plan:update tags from a message', () => {
    const message = 'Your plan has been updated.\n<plan:update date="2026-04-01" completed="true"/>';
    const result = message.replace(planUpdateRegex, '').trim();
    expect(result).toBe('Your plan has been updated.');
    expect(result).not.toContain('<plan:update');
  });

  it('plan:update regex captures attribute string', () => {
    const message = '<plan:update date="2026-04-01" guidelines="Easy run" />';
    const matches = [...message.matchAll(planUpdateRegex)];
    expect(matches).toHaveLength(1);
    const attrs = parseXmlAttrs(matches[0][1]);
    expect(attrs.date).toBe('2026-04-01');
    expect(attrs.guidelines).toBe('Easy run');
  });

  it('strips multiple plan:update tags from message', () => {
    const message =
      'Updated two days.\n' +
      '<plan:update date="2026-04-01" completed="true"/>\n' +
      '<plan:update date="2026-04-03" skipped="true"/>';
    const result = message.replace(planUpdateRegex, '').trim();
    expect(result).toBe('Updated two days.');
    expect(result).not.toContain('<plan:update');
  });

  it('returns message unchanged when no plan:update tags present', () => {
    const message = 'Great run today! Keep it up.';
    const result = message.replace(planUpdateRegex, '').trim();
    expect(result).toBe(message);
  });
});

describe('plan:add tag stripping', () => {
  it('strips plan:add tag from a message', () => {
    const message = 'Added a Friday run to Week 1.\n<plan:add date="2026-03-27" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy pace run" />';
    const result = message.replace(planAddRegex, '').trim();
    expect(result).toBe('Added a Friday run to Week 1.');
    expect(result).not.toContain('<plan:add');
  });

  it('plan:add regex captures all attributes', () => {
    const message = '<plan:add date="2026-03-27" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy pace run" />';
    const matches = [...message.matchAll(planAddRegex)];
    expect(matches).toHaveLength(1);
    const attrs = parseXmlAttrs(matches[0][1]);
    expect(attrs.date).toBe('2026-03-27');
    expect(attrs.objective_kind).toBe('distance');
    expect(attrs.objective_value).toBe('5');
    expect(attrs.objective_unit).toBe('km');
    expect(attrs.guidelines).toBe('Easy pace run');
  });

  it('strips mixed plan:update and plan:add tags from one message', () => {
    const message =
      'Done! Updated Thursday and added Friday.\n' +
      '<plan:update date="2026-03-26" guidelines="Tempo run" />\n' +
      '<plan:add date="2026-03-27" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy run" />';
    const result = message
      .replace(planUpdateRegex, '')
      .replace(planAddRegex, '')
      .trim();
    expect(result).toBe('Done! Updated Thursday and added Friday.');
    expect(result).not.toContain('<plan:update');
    expect(result).not.toContain('<plan:add');
  });

  it('returns message unchanged when no plan:add tags present', () => {
    const message = 'Great run today! Keep it up.';
    const result = message.replace(planAddRegex, '').trim();
    expect(result).toBe(message);
  });
});
