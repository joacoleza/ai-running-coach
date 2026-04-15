import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

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
  requireAuth: vi.fn().mockResolvedValue(null),
}));

import '../functions/messages.js';
import { HttpRequest } from '@azure/functions';
import { requireAuth } from '../middleware/auth.js';

const ctx = { log: vi.fn() } as any;

function makeReq(planId?: string): HttpRequest {
  const url = planId
    ? `http://localhost/api/messages?planId=${planId}`
    : 'http://localhost/api/messages';
  return new HttpRequest({
    method: 'GET',
    url,
    headers: { 'x-app-password': 'test-pw' },
  });
}

let mongod: MongoMemoryServer;
let mongoClient: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_CONNECTION_STRING = mongod.getUri();
  process.env.APP_PASSWORD = 'test-pw';
  mongoClient = new MongoClient(mongod.getUri());
  await mongoClient.connect();
});

afterAll(async () => {
  await mongoClient.close();
  await mongod.stop();
  _resetDbForTest();
});

beforeEach(async () => {
  await mongoClient.db('running-coach').collection('messages').deleteMany({});
  _resetDbForTest();
  vi.mocked(requireAuth).mockResolvedValue(null);
});

describe('getMessages handler', () => {
  it('returns 401 when auth fails', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } });
    const res = await handlers.get('getMessages')!(makeReq('p1'), ctx);
    expect(res.status).toBe(401);
  });

  it('returns 400 when planId is missing', async () => {
    const res = await handlers.get('getMessages')!(makeReq(), ctx);
    expect(res.status).toBe(400);
    expect((res.jsonBody as any).error).toContain('planId');
  });

  it('returns empty array when no messages exist for planId', async () => {
    const res = await handlers.get('getMessages')!(makeReq('nonexistent'), ctx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as any).messages).toEqual([]);
  });

  it('returns messages sorted by timestamp for matching planId', async () => {
    const db = mongoClient.db('running-coach');
    await db.collection('messages').insertMany([
      { planId: 'p1', role: 'user', content: 'first', timestamp: new Date('2026-04-07T10:00:00Z') },
      { planId: 'p1', role: 'assistant', content: 'second', timestamp: new Date('2026-04-07T10:01:00Z') },
      { planId: 'other', role: 'user', content: 'other plan', timestamp: new Date('2026-04-07T09:00:00Z') },
    ]);

    const res = await handlers.get('getMessages')!(makeReq('p1'), ctx);
    expect(res.status).toBe(200);
    const messages = (res.jsonBody as any).messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('first');
    expect(messages[1].content).toBe('second');
  });
});
