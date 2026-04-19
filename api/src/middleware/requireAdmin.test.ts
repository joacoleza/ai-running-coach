import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

const VALID_USER_ID = new ObjectId();

// Hoist mock before vi.mock
const { mockUsersCollection } = vi.hoisted(() => {
  const mockUsersCollection = { findOne: vi.fn() };
  return { mockUsersCollection };
});

// Mock getDb so requireAdmin does not attempt a real MongoDB connection
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn(() => mockUsersCollection),
  }),
}));

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
    vi.clearAllMocks();
    // Default: active admin user
    mockUsersCollection.findOne.mockResolvedValue({
      _id: VALID_USER_ID,
      email: 'a@b.com',
      isAdmin: true,
      active: true,
    });
  });

  it('returns null for a valid admin token', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: VALID_USER_ID.toString(), email: 'a@b.com', isAdmin: true } as any);
    const result = await requireAdmin(makeReq('valid-token'));
    expect(result).toBeNull();
  });

  it('returns 403 for a valid non-admin token', async () => {
    vi.mocked(jwt.verify).mockReturnValue({ sub: VALID_USER_ID.toString(), email: 'a@b.com', isAdmin: false } as any);
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
