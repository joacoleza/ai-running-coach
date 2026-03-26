import { describe, it, expect } from 'vitest';
import { parseXmlAttrs } from '../hooks/useChat';

// Regex used in useChat.ts for plan:update tag matching
const planUpdateRegex = /<plan:update\s+([^/]+)\/>/g;

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
