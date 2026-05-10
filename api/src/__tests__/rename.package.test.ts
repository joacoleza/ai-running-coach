import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Phase 17 — Package name field assertions.
 * Reads each package.json from disk and verifies the name field was updated.
 */
describe('Phase 17 — package.json name fields', () => {
  const root = resolve(__dirname, '../../../');

  it('root package.json name is "ai-training-coach"', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8')) as { name: string };
    expect(pkg.name).toBe('ai-training-coach');
  });

  it('api/package.json name is "ai-training-coach-api"', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'api', 'package.json'), 'utf-8')) as { name: string };
    expect(pkg.name).toBe('ai-training-coach-api');
  });

  it('web/package.json name is "ai-training-coach-web"', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'web', 'package.json'), 'utf-8')) as { name: string };
    expect(pkg.name).toBe('ai-training-coach-web');
  });
});
