import { describe, it, expect } from 'vitest';
import {
  parseDurationToMinutes,
  formatTotalTime,
  computeDateRange,
} from '../hooks/useDashboard';

describe('parseDurationToMinutes', () => {
  it('parses MM:SS format', () => {
    expect(parseDurationToMinutes('25:00')).toBe(25);
  });

  it('parses HH:MM:SS format', () => {
    expect(parseDurationToMinutes('1:05:30')).toBe(65.5);
  });

  it('parses short MM:SS correctly', () => {
    expect(parseDurationToMinutes('0:30')).toBe(0.5);
  });

  it('returns 0 for empty string', () => {
    expect(parseDurationToMinutes('')).toBe(0);
  });

  it('returns 0 for invalid string', () => {
    expect(parseDurationToMinutes('invalid')).toBe(0);
  });
});

describe('formatTotalTime', () => {
  it('returns "0m" for 0 minutes', () => {
    expect(formatTotalTime(0)).toBe('0m');
  });

  it('returns minutes only when < 60', () => {
    expect(formatTotalTime(45)).toBe('45m');
  });

  it('returns hours and minutes for exactly 60', () => {
    expect(formatTotalTime(60)).toBe('1h0m');
  });

  it('returns hours and minutes for 90', () => {
    expect(formatTotalTime(90)).toBe('1h30m');
  });

  it('returns hours and minutes for 125', () => {
    expect(formatTotalTime(125)).toBe('2h5m');
  });
});

describe('computeDateRange', () => {
  const today = new Date('2026-04-08');

  it('returns null for current-plan', () => {
    expect(computeDateRange('current-plan', today)).toBeNull();
  });

  it('returns empty date range for all-time', () => {
    const range = computeDateRange('all-time', today);
    expect(range).not.toBeNull();
    expect(range!.dateFrom).toBeUndefined();
    expect(range!.dateTo).toBeUndefined();
  });

  it('returns 28-day range for last-4-weeks', () => {
    const range = computeDateRange('last-4-weeks', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    expect(range!.dateFrom).toBe('2026-03-11');
  });

  it('returns Jan 1 as dateFrom for this-year', () => {
    const range = computeDateRange('this-year', today);
    expect(range).not.toBeNull();
    expect(range!.dateFrom).toBe('2026-01-01');
    expect(range!.dateTo).toBe('2026-04-08');
  });

  it('returns 365-day range for last-12-months', () => {
    const range = computeDateRange('last-12-months', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    // 365 days before 2026-04-08 is 2025-04-08
    expect(range!.dateFrom).toBe('2025-04-08');
  });

  it('returns 56-day range for last-8-weeks', () => {
    const range = computeDateRange('last-8-weeks', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    expect(range!.dateFrom).toBe('2026-02-11');
  });

  it('returns 91-day range for last-3-months', () => {
    const range = computeDateRange('last-3-months', today);
    expect(range).not.toBeNull();
    expect(range!.dateTo).toBe('2026-04-08');
    expect(range!.dateFrom).toBe('2026-01-07');
  });
});
