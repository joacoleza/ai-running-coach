import { describe, it, expect } from 'vitest';
import { MODEL_PRICING, computeCost } from '../shared/pricing.js';

describe('MODEL_PRICING', () => {
  it('has an entry for claude-sonnet-4-20250514', () => {
    expect(MODEL_PRICING['claude-sonnet-4-20250514']).toBeDefined();
  });

  it('has all four rate fields for claude-sonnet-4-20250514', () => {
    const rates = MODEL_PRICING['claude-sonnet-4-20250514'];
    expect(rates).toHaveProperty('input');
    expect(rates).toHaveProperty('output');
    expect(rates).toHaveProperty('cacheWrite');
    expect(rates).toHaveProperty('cacheRead');
  });

  it('all four rate values are positive numbers less than 0.001 (per-token rates, not per-million)', () => {
    const rates = MODEL_PRICING['claude-sonnet-4-20250514'];
    expect(rates.input).toBeGreaterThan(0);
    expect(rates.input).toBeLessThan(0.001);
    expect(rates.output).toBeGreaterThan(0);
    expect(rates.output).toBeLessThan(0.001);
    expect(rates.cacheWrite).toBeGreaterThan(0);
    expect(rates.cacheWrite).toBeLessThan(0.001);
    expect(rates.cacheRead).toBeGreaterThan(0);
    expect(rates.cacheRead).toBeLessThan(0.001);
  });
});

describe('computeCost', () => {
  it('returns a positive number for claude-sonnet-4-20250514 with non-zero tokens', () => {
    const result = computeCost('claude-sonnet-4-20250514', 1000, 500, 200, 100);
    expect(result).toBeGreaterThan(0);
  });

  it('returns 0 for unknown model', () => {
    const result = computeCost('unknown-model', 1000, 500, 0, 0);
    expect(result).toBe(0);
  });

  it('returns 0 for known model with all zero tokens', () => {
    const result = computeCost('claude-sonnet-4-20250514', 0, 0, 0, 0);
    expect(result).toBe(0);
  });

  it('computes cost correctly for known model', () => {
    const rates = MODEL_PRICING['claude-sonnet-4-20250514'];
    const inputTokens = 1000;
    const outputTokens = 500;
    const cacheWriteTokens = 200;
    const cacheReadTokens = 100;
    const expected =
      inputTokens * rates.input +
      outputTokens * rates.output +
      cacheWriteTokens * rates.cacheWrite +
      cacheReadTokens * rates.cacheRead;
    const result = computeCost('claude-sonnet-4-20250514', inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens);
    expect(result).toBeCloseTo(expected, 10);
  });

  it('returns 0 for empty string model', () => {
    const result = computeCost('', 1000, 500, 0, 0);
    expect(result).toBe(0);
  });
});
