import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before runs.ts is imported
const handlers = vi.hoisted(() => new Map<string, (req: any, ctx: any) => Promise<any>>());

// Two distinct test user IDs — hoisted so they're available in vi.mock factory
const USER_A_ID = vi.hoisted(() => 'aaaaaaaaaaaaaaaaaaaaaaaa');
const USER_B_ID = vi.hoisted(() => 'bbbbbbbbbbbbbbbbbbbbbbbb');

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

// Default: authenticated as user A
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthContext: vi.fn().mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false }),
}));

// Side-effect import registers run handlers
import '../functions/runs.js';
import { HttpRequest } from '@azure/functions';
import { getAuthContext } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makePostReq(url: string, body: unknown): HttpRequest {
  const req = new HttpRequest({ method: 'POST', url, headers: { 'x-authorization': 'Bearer test-token' } });
  vi.spyOn(req, 'json').mockResolvedValue(body);
  return req;
}

function makeGetReq(url: string): HttpRequest {
  return new HttpRequest({ method: 'GET', url, headers: { 'x-authorization': 'Bearer test-token' } });
}

function makeGetReqWithQuery(url: string, params: Record<string, string>): HttpRequest {
  const qs = new URLSearchParams(params).toString();
  return new HttpRequest({ method: 'GET', url: `${url}?${qs}`, headers: { 'x-authorization': 'Bearer test-token' } });
}

function makeDeleteReq(url: string, params: Record<string, string>): HttpRequest {
  return new HttpRequest({ method: 'DELETE', url, headers: { 'x-authorization': 'Bearer test-token' }, params });
}

let mongod: MongoMemoryServer;
let mongoClient: MongoClient;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_CONNECTION_STRING = mongod.getUri();
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
  await mongoClient.db('running-coach').collection('runs').deleteMany({});
  // Reset auth context to user A for each test
  vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
});

describe('POST /api/runs — data isolation', () => {
  it('sets userId on new run document from auth context', async () => {
    const db = mongoClient.db('running-coach');
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });

    const req = makePostReq('http://localhost/api/runs', {
      date: '2026-04-18',
      distance: 5,
      duration: '25:00',
    });
    const result = await handlers.get('createRun')!(req, ctx);

    expect(result.status).toBe(201);

    // Verify userId was stored in DB as ObjectId
    const stored = await db.collection('runs').findOne({ _id: new ObjectId(result.jsonBody._id) });
    expect(stored).not.toBeNull();
    expect(stored!.userId.toString()).toBe(USER_A_ID);
  });

  it('run from user A does not appear when user B creates a run — separate userId', async () => {
    const db = mongoClient.db('running-coach');

    // Create run as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const reqA = makePostReq('http://localhost/api/runs', {
      date: '2026-04-17',
      distance: 5,
      duration: '25:00',
    });
    await handlers.get('createRun')!(reqA, ctx);

    // Create run as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const reqB = makePostReq('http://localhost/api/runs', {
      date: '2026-04-18',
      distance: 10,
      duration: '50:00',
    });
    await handlers.get('createRun')!(reqB, ctx);

    // DB should have 2 runs with different userIds
    const allRuns = await db.collection('runs').find({}).toArray();
    expect(allRuns).toHaveLength(2);
    const userIds = allRuns.map(r => r.userId.toString());
    expect(userIds).toContain(USER_A_ID);
    expect(userIds).toContain(USER_B_ID);
  });
});

describe('GET /api/runs — data isolation', () => {
  it('includes userId filter in find query — only returns the authenticated user runs', async () => {
    const db = mongoClient.db('running-coach');
    const userAId = new ObjectId(USER_A_ID);
    const userBId = new ObjectId(USER_B_ID);

    // Insert runs for both users directly
    await db.collection('runs').insertMany([
      {
        date: '2026-04-17',
        distance: 5,
        duration: '25:00',
        pace: 5.0,
        userId: userAId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        date: '2026-04-18',
        distance: 10,
        duration: '50:00',
        pace: 5.0,
        userId: userBId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        date: '2026-04-16',
        distance: 8,
        duration: '40:00',
        pace: 5.0,
        userId: userAId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Request as user A — should only get user A's 2 runs
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeGetReq('http://localhost/api/runs');
    const result = await handlers.get('listRuns')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.runs).toHaveLength(2);
    expect(result.jsonBody.total).toBe(2);
    // All returned runs should belong to user A
    for (const run of result.jsonBody.runs) {
      expect(run.userId.toString()).toBe(USER_A_ID);
    }
  });

  it('user B cannot see user A runs even when requesting all runs', async () => {
    const db = mongoClient.db('running-coach');
    const userAId = new ObjectId(USER_A_ID);

    // Insert a run for user A
    await db.collection('runs').insertOne({
      date: '2026-04-17',
      distance: 5,
      duration: '25:00',
      pace: 5.0,
      userId: userAId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Request as user B — should get no runs
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeGetReq('http://localhost/api/runs');
    const result = await handlers.get('listRuns')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.runs).toHaveLength(0);
    expect(result.jsonBody.total).toBe(0);
  });
});

describe('DELETE /api/runs/{id} — data isolation', () => {
  it('returns 404 when user B tries to delete user A run', async () => {
    const db = mongoClient.db('running-coach');
    const userAId = new ObjectId(USER_A_ID);

    // Insert a run belonging to user A
    const { insertedId } = await db.collection('runs').insertOne({
      date: '2026-04-17',
      distance: 5,
      duration: '25:00',
      pace: 5.0,
      userId: userAId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Attempt to delete as user B — should get 404
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeDeleteReq('http://localhost/api/runs/' + insertedId.toString(), { id: insertedId.toString() });
    const result = await handlers.get('deleteRun')!(req, ctx);

    expect(result.status).toBe(404);

    // Run should still exist
    const stillExists = await db.collection('runs').findOne({ _id: insertedId });
    expect(stillExists).not.toBeNull();
  });
});
