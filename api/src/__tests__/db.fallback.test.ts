import { describe, it, expect } from 'vitest';

/**
 * Phase 17 — db.ts fallback DB name.
 * Tests the regex pattern from db.ts in isolation without connecting to MongoDB.
 * The pattern is: connectionString.match(/\/\/[^/]+\/([^/?]+)/)?.[1] || 'ai-training-coach'
 */
function extractDbName(connectionString: string): string {
  return connectionString.match(/\/\/[^/]+\/([^/?]+)/)?.[1] || 'ai-training-coach';
}

describe('Phase 17 — db.ts MongoDB DB name extraction', () => {
  it('falls back to "ai-training-coach" when connection string has no path segment', () => {
    const result = extractDbName('mongodb://localhost:27017');
    expect(result).toBe('ai-training-coach');
  });

  it('extracts DB name from a connection string with a path segment', () => {
    const result = extractDbName('mongodb://localhost:27017/mydb');
    expect(result).toBe('mydb');
  });

  it('extracts "ai-training-coach-e2e" from the E2E connection string', () => {
    const result = extractDbName('mongodb://localhost:27017/ai-training-coach-e2e');
    expect(result).toBe('ai-training-coach-e2e');
  });

  it('falls back to "ai-training-coach" when connection string ends with a bare slash', () => {
    // mongodb://localhost:27017/ — path segment is empty, no capture group match
    const result = extractDbName('mongodb://localhost:27017/');
    // The regex requires at least one character in the path segment: [^/?]+
    // An empty segment produces no match → fallback
    expect(result).toBe('ai-training-coach');
  });

  it('does not fall back to old "running-coach" name', () => {
    const fallback = extractDbName('mongodb://localhost:27017');
    expect(fallback).not.toBe('running-coach');
  });
});
