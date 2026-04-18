import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdmin } from './auth.js';
import jwt from 'jsonwebtoken';

vi.mock('jsonwebtoken');

function makeReq(token?: string): any {
  return {
    headers: {
      get: (key: string) => (key === 'x-authorization' && token ? `Bearer ${token}` : null),
    },
  };
}

describe('requireAdmin', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    vi.resetAllMocks();
  });

  it('returns null for a valid admin token', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: 'uid1', email: 'a@b.com', isAdmin: true } as any);
    const result = await requireAdmin(makeReq('valid-token'));
    expect(result).toBeNull();
  });

  it('returns 403 for a valid non-admin token', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: 'uid1', email: 'a@b.com', isAdmin: false } as any);
    const result = await requireAdmin(makeReq('valid-token'));
    expect(result).toMatchObject({ status: 403 });
  });

  it('returns 401 when no Authorization header', async () => {
    const result = await requireAdmin(makeReq());
    expect(result).toMatchObject({ status: 401 });
  });

  it('returns 401 for malformed token', async () => {
    vi.mocked(jwt.verify).mockImplementation(() => { throw new Error('invalid'); });
    const result = await requireAdmin(makeReq('bad-token'));
    expect(result).toMatchObject({ status: 401 });
  });
});
