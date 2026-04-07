import { describe, it, expect } from 'vitest';
import { parseXmlAttrs } from '../hooks/useChat';

// Regexes used in useChat.ts for plan tag matching
const planUpdateRegex = /<plan:update\s+([^/]+)\/>/g;
const planAddRegex = /<plan:add\s+([^/]+)\/>/g;

describe('parseXmlAttrs', () => {
  it('extracts single attribute', () => {
    const result = parseXmlAttrs('week="3"');
    expect(result).toEqual({ week: '3' });
  });

  it('extracts multiple attributes', () => {
    const result = parseXmlAttrs('week="3" day="B" guidelines="Easy run" completed="true"');
    expect(result).toEqual({
      week: '3',
      day: 'B',
      guidelines: 'Easy run',
      completed: 'true',
    });
  });

  it('returns empty object for empty string', () => {
    const result = parseXmlAttrs('');
    expect(result).toEqual({});
  });

  it('handles attributes with special characters in values', () => {
    const result = parseXmlAttrs('week="1" day="A" objective_value="10"');
    expect(result).toEqual({ week: '1', day: 'A', objective_value: '10' });
  });
});

describe('plan:update tag stripping', () => {
  it('strips plan:update tags from a message', () => {
    const message = 'Your plan has been updated.\n<plan:update week="3" day="B" completed="true"/>';
    const result = message.replace(planUpdateRegex, '').trim();
    expect(result).toBe('Your plan has been updated.');
    expect(result).not.toContain('<plan:update');
  });

  it('plan:update regex captures attribute string', () => {
    const message = '<plan:update week="3" day="B" guidelines="Easy run" />';
    const matches = [...message.matchAll(planUpdateRegex)];
    expect(matches).toHaveLength(1);
    const attrs = parseXmlAttrs(matches[0][1]);
    expect(attrs.week).toBe('3');
    expect(attrs.day).toBe('B');
    expect(attrs.guidelines).toBe('Easy run');
  });

  it('strips multiple plan:update tags from message', () => {
    const message =
      'Updated two days.\n' +
      '<plan:update week="3" day="A" completed="true"/>\n' +
      '<plan:update week="3" day="C" skipped="true"/>';
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
    const message = 'Added a run to Week 1.\n<plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy pace run" />';
    const result = message.replace(planAddRegex, '').trim();
    expect(result).toBe('Added a run to Week 1.');
    expect(result).not.toContain('<plan:add');
  });

  it('plan:add regex captures all attributes', () => {
    const message = '<plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy pace run" />';
    const matches = [...message.matchAll(planAddRegex)];
    expect(matches).toHaveLength(1);
    const attrs = parseXmlAttrs(matches[0][1]);
    expect(attrs.week).toBe('1');
    expect(attrs.day).toBe('D');
    expect(attrs.objective_kind).toBe('distance');
    expect(attrs.objective_value).toBe('5');
    expect(attrs.objective_unit).toBe('km');
    expect(attrs.guidelines).toBe('Easy pace run');
  });

  it('strips mixed plan:update and plan:add tags from one message', () => {
    const message =
      'Done! Updated Thursday and added Friday.\n' +
      '<plan:update week="1" day="C" guidelines="Tempo run" />\n' +
      '<plan:add week="1" day="D" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy run" />';
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

describe('plan:unlink tag stripping', () => {
  const planUnlinkRegex = /<plan:unlink\s+([^/>]*)\s*\/>/g;

  it('strips plan:unlink tag from a message', () => {
    const message = 'Unlinked the run from Week 2 Day C.\n<plan:unlink week="2" day="C"/>';
    const result = message.replace(planUnlinkRegex, '').trim();
    expect(result).toBe('Unlinked the run from Week 2 Day C.');
    expect(result).not.toContain('<plan:unlink');
  });

  it('plan:unlink regex captures week and day attributes', () => {
    const message = '<plan:unlink week="2" day="C"/>';
    const matches = [...message.matchAll(planUnlinkRegex)];
    expect(matches).toHaveLength(1);
    const attrs = parseXmlAttrs(matches[0][1]);
    expect(attrs.week).toBe('2');
    expect(attrs.day).toBe('C');
  });

  it('strips multiple plan:unlink tags from message', () => {
    const message =
      'Unlinked two runs.\n' +
      '<plan:unlink week="1" day="A"/>\n' +
      '<plan:unlink week="2" day="B"/>';
    const result = message.replace(planUnlinkRegex, '').trim();
    expect(result).toBe('Unlinked two runs.');
    expect(result).not.toContain('<plan:unlink');
  });

  it('strips plan:unlink along with plan:update and plan:add tags', () => {
    const message =
      'Updated and unlinked.\n' +
      '<plan:update week="1" day="A" guidelines="Easy run"/>\n' +
      '<plan:unlink week="2" day="B"/>\n' +
      '<plan:add week="3" day="C" type="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Tempo"/>';
    const result = message
      .replace(planUpdateRegex, '')
      .replace(planUnlinkRegex, '')
      .replace(planAddRegex, '')
      .trim();
    expect(result).toBe('Updated and unlinked.');
    expect(result).not.toContain('<plan:update');
    expect(result).not.toContain('<plan:unlink');
    expect(result).not.toContain('<plan:add');
  });

  it('returns message unchanged when no plan:unlink tags present', () => {
    const message = 'Great progress this week!';
    const result = message.replace(planUnlinkRegex, '').trim();
    expect(result).toBe(message);
  });
});
