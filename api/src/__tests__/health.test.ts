import { describe, it, expect, vi, beforeAll } from 'vitest';
import { HttpRequest } from '@azure/functions';

const handlers = vi.hoisted(() => new Map<string, (req: any, ctx: any) => Promise<any>>());

vi.mock('@azure/functions', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    app: {
      http: (name: string, opts: any) => handlers.set(name, opts.handler),
      setup: vi.fn(),
    },
  };
});

vi.mock('../middleware/auth.js', () => ({
  requirePassword: vi.fn().mockResolvedValue(null),
}));

import '../functions/health.js';
import { requirePassword } from '../middleware/auth.js';

const ctx = { log: vi.fn() } as any;

function makeReq(): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: 'http://localhost/api/health',
    headers: { 'x-app-password': 'test-pw' },
  });
}

describe('health handler', () => {
  it('returns 200 with status ok', async () => {
    const handler = handlers.get('health')!;
    const res = await handler(makeReq(), ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as any).status).toBe('ok');
    expect((res.jsonBody as any).timestamp).toBeDefined();
    expect((res.jsonBody as any).version).toBe('1.0.0');
  });

  it('returns auth error when password check fails', async () => {
    vi.mocked(requirePassword).mockResolvedValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });
    const handler = handlers.get('health')!;
    const res = await handler(makeReq(), ctx);
    expect(res.status).toBe(401);
  });
});
