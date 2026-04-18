import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before plan.ts is imported
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

// Side-effect import registers getPlan, createPlan, patchPlan handlers
import '../functions/plan.js';
import { HttpRequest } from '@azure/functions';
import { getAuthContext } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makeReq(method: string, body?: unknown): HttpRequest {
  const req = new HttpRequest({
    method,
    url: 'http://localhost/api/plan',
    headers: { authorization: 'Bearer test-token' },
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
  // Reset auth context to user A for each test
  vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
});

describe('GET /api/plan — data isolation', () => {
  it('queries plans with userId filter — only returns the authenticated user plan', async () => {
    const db = mongoClient.db('running-coach');
    const userAId = new ObjectId(USER_A_ID);
    const userBId = new ObjectId(USER_B_ID);

    // Insert a plan for user B
    await db.collection('plans').insertOne({
      status: 'active',
      userId: userBId,
      phases: [],
      goal: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert a plan for user A
    await db.collection('plans').insertOne({
      status: 'active',
      userId: userAId,
      phases: [{ name: 'Phase 1', description: '', weeks: [] }],
      goal: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Request as user A — should only get user A's plan
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq('GET');
    const result = await handlers.get('getPlan')!(req, ctx);

    expect(result.status).toBe(200);
    // User A's plan has 1 phase; user B's plan has 0 phases
    expect(result.jsonBody.plan.phases).toHaveLength(1);
    expect(result.jsonBody.plan.phases[0].name).toBe('Phase 1');
  });

  it('returns plan: null when another user has a plan but authenticated user does not', async () => {
    const db = mongoClient.db('running-coach');
    const userBId = new ObjectId(USER_B_ID);

    // Insert a plan for user B only
    await db.collection('plans').insertOne({
      status: 'active',
      userId: userBId,
      phases: [],
      goal: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Request as user A — should see no plan
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq('GET');
    const result = await handlers.get('getPlan')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeNull();
  });
});

describe('POST /api/plan — data isolation', () => {
  it('sets userId on newly created plan document', async () => {
    const db = mongoClient.db('running-coach');
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });

    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);

    expect(result.status).toBe(201);
    expect(result.jsonBody.plan).toBeDefined();

    // Verify userId was stored in DB
    const stored = await db.collection('plans').findOne({ _id: new ObjectId(result.jsonBody.plan._id) });
    expect(stored).not.toBeNull();
    expect(stored!.userId.toString()).toBe(USER_A_ID);
  });

  it('only deletes onboarding plans belonging to the authenticated user', async () => {
    const db = mongoClient.db('running-coach');
    const userAId = new ObjectId(USER_A_ID);
    const userBId = new ObjectId(USER_B_ID);

    // Insert an onboarding plan for user B
    const { insertedId: bPlanId } = await db.collection('plans').insertOne({
      status: 'onboarding',
      userId: userBId,
      phases: [],
      goal: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create plan as user A — should NOT delete user B's onboarding plan
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq('POST', { mode: 'conversational' });
    await handlers.get('createPlan')!(req, ctx);

    // User B's plan should still be there
    const bPlan = await db.collection('plans').findOne({ _id: bPlanId });
    expect(bPlan).not.toBeNull();

    // User A should have their new plan
    const aPlan = await db.collection('plans').findOne({ userId: userAId });
    expect(aPlan).not.toBeNull();
  });
});
