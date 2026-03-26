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
  requirePassword: vi.fn().mockResolvedValue(null),
}));

// Side-effect import registers updateSession handler
import '../functions/sessions.js';
import { HttpRequest } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makeReq(sessionId: string, body?: unknown): HttpRequest {
  const req = new HttpRequest({
    method: 'PATCH',
    url: `http://localhost/api/sessions/${sessionId}`,
    headers: { 'x-app-password': 'test-pw' },
    params: { sessionId } as any,
  });
  if (body !== undefined) {
    vi.spyOn(req, 'json').mockResolvedValue(body);
  }
  return req;
}

let mongod: MongoMemoryServer;
let mongoClient: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_CONNECTION_STRING = mongod.getUri();
  process.env.APP_PASSWORD = 'test-pw';
  mongoClient = new MongoClient(mongod.getUri());
  await mongoClient.connect();
}, 30_000);

afterAll(async () => {
  await mongoClient.close();
  _resetDbForTest();
  await mongod.stop();
}, 30_000);

beforeEach(async () => {
  _resetDbForTest();
  await mongoClient.db('running-coach').collection('plans').deleteMany({});
});

async function insertPlanWithSession(sessionId: string, sessionOverrides = {}) {
  await mongoClient.db('running-coach').collection('plans').insertOne({
    status: 'active',
    sessions: [{
      id: sessionId,
      date: '2026-04-01',
      distance: 5,
      duration: 30,
      notes: 'Easy run',
      completed: false,
      ...sessionOverrides,
    }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('Session PATCH (PLAN-04)', () => {
  it('PATCH /api/sessions/:id updates session fields', async () => {
    const sid = 'session-update-test';
    await insertPlanWithSession(sid);

    const result = await handlers.get('updateSession')!(makeReq(sid, { notes: 'Updated notes', distance: 8 }), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.ok).toBe(true);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ 'sessions.id': sid });
    const session = (plan?.sessions as Array<{ id: string; notes: string; distance: number }>).find(s => s.id === sid);
    expect(session?.notes).toBe('Updated notes');
    expect(session?.distance).toBe(8);
  });

  it('PATCH /api/sessions/:id marks session completed', async () => {
    const sid = 'session-complete-test';
    await insertPlanWithSession(sid, { completed: false });

    const result = await handlers.get('updateSession')!(makeReq(sid, { completed: true }), ctx);

    expect(result.status).toBe(200);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ 'sessions.id': sid });
    const session = (plan?.sessions as Array<{ id: string; completed: boolean }>).find(s => s.id === sid);
    expect(session?.completed).toBe(true);
  });

  it('PATCH /api/sessions/:id returns 404 for unknown session', async () => {
    const result = await handlers.get('updateSession')!(makeReq('non-existent-session', { completed: true }), ctx);

    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('not found');
  });

  it('PATCH /api/sessions/:id does not overwrite session id', async () => {
    const sid = 'session-immutable-id';
    await insertPlanWithSession(sid);

    // Try to change the session's id — should be stripped before update
    await handlers.get('updateSession')!(makeReq(sid, { id: 'hacked-id', notes: 'New notes' }), ctx);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ 'sessions.id': sid });
    const session = (plan?.sessions as Array<{ id: string; notes: string }>).find(s => s.id === sid);
    expect(session?.id).toBe(sid);
    expect(session?.notes).toBe('New notes');
  });

  it('PATCH /api/sessions/:id returns 401 without password', async () => {
    vi.mocked(requirePassword).mockResolvedValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } } as any);

    const result = await handlers.get('updateSession')!(makeReq('any-session', { completed: true }), ctx);

    expect(result.status).toBe(401);
  });
});
