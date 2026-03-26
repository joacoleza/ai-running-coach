import { describe, it, expect, vi } from 'vitest';
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

import '../functions/ping.js';

const ctx = { log: vi.fn() } as any;

describe('ping handler', () => {
  it('returns 200 with status ok (no auth required)', async () => {
    const handler = handlers.get('ping')!;
    const req = new HttpRequest({ method: 'GET', url: 'http://localhost/api/ping' });
    const res = await handler(req, ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as any).status).toBe('ok');
  });
});
