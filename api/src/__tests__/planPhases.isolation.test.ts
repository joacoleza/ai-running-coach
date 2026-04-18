import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before planPhases.ts is imported
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

// Side-effect import registers patchPhase, addPhase, addWeekToPhase, deleteLastPhase handlers
import '../functions/planPhases.js';
import { HttpRequest } from '@azure/functions';
import { getAuthContext } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makePatchReq(phaseIndex: string, body?: unknown): HttpRequest {
  const url = `http://localhost/api/plan/phases/${phaseIndex}`;
  const req = new HttpRequest({
    method: 'PATCH',
    url,
    headers: { 'x-app-password': 'test-pw' },
    params: { phaseIndex },
  });
  if (body !== undefined) {
    vi.spyOn(req, 'json').mockResolvedValue(body);
  }
  return req;
}

function makePostReq(body?: unknown): HttpRequest {
  const url = 'http://localhost/api/plan/phases';
  const req = new HttpRequest({
    method: 'POST',
    url,
    headers: { 'x-app-password': 'test-pw' },
  });
  if (body !== undefined) {
    vi.spyOn(req, 'json').mockResolvedValue(body);
  }
  return req;
}

function makeDeleteReq(): HttpRequest {
  const url = 'http://localhost/api/plan/phases/last';
  const req = new HttpRequest({
    method: 'DELETE',
    url,
    headers: { 'x-app-password': 'test-pw' },
    params: { phaseIndex: 'last' },
  });
  return req;
}

function makeAddWeekReq(phaseIndex: string): HttpRequest {
  const url = `http://localhost/api/plan/phases/${phaseIndex}/weeks`;
  const req = new HttpRequest({
    method: 'POST',
    url,
    headers: { 'x-app-password': 'test-pw' },
    params: { phaseIndex },
  });
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

const USER_A_OID = new ObjectId(USER_A_ID);
const USER_B_OID = new ObjectId(USER_B_ID);

const makeWeekDays = (runOverrides: Partial<Record<string, unknown>> = {}) => [
  { label: 'A', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy run', completed: false, skipped: false, ...runOverrides },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
];

const makeValidPlan = (userId: ObjectId) => ({
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 6,
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
  phases: [
    {
      name: 'Base Building',
      description: 'Build aerobic base',
      weeks: [{ weekNumber: 1, days: makeWeekDays() }],
    },
    {
      name: 'Build Phase',
      description: 'Increase intensity',
      weeks: [{ weekNumber: 2, days: makeWeekDays() }],
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  userId,
});

describe('PATCH /api/plan/phases/:phaseIndex — data isolation', () => {
  it('user B cannot patch user A plan phase — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Attempt to patch phase as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makePatchReq('0', { name: 'Hacked Phase' });
    const result = await handlers.get('patchPhase')!(req, ctx);

    expect(result.status).toBe(404);

    // Phase should still exist unchanged in DB
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    expect(plan).not.toBeNull();
    expect(plan?.phases[0].name).toBe('Base Building');
  });

  it('user A can patch their own plan phase', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Patch phase as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makePatchReq('0', { name: 'Aerobic Foundation' });
    const result = await handlers.get('patchPhase')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[0].name).toBe('Aerobic Foundation');
  });
});

describe('DELETE /api/plan/phases/last — data isolation', () => {
  it('user B cannot delete user A plan last phase — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Attempt to delete last phase as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeDeleteReq();
    const result = await handlers.get('deleteLastPhase')!(req, ctx);

    expect(result.status).toBe(404);

    // Plan should still have 2 phases in DB
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    expect(plan).not.toBeNull();
    expect(plan?.phases).toHaveLength(2);
  });

  it('user A can delete their own plan last phase', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Delete last phase as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeDeleteReq();
    const result = await handlers.get('deleteLastPhase')!(req, ctx);

    expect(result.status).toBe(200);

    // Plan should now have 1 phase
    expect(result.jsonBody.plan.phases).toHaveLength(1);
    expect(result.jsonBody.plan.phases[0].name).toBe('Base Building');
  });
});

describe('POST /api/plan/phases — data isolation', () => {
  it('user B cannot add phase to user A plan — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Attempt to add phase as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makePostReq({ name: 'Race Prep' });
    const result = await handlers.get('addPhase')!(req, ctx);

    expect(result.status).toBe(404);

    // User A's plan should still have 2 phases
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    expect(plan?.phases).toHaveLength(2);
  });

  it('user A can add phase to their own plan', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Add phase as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makePostReq({ name: 'Race Prep' });
    const result = await handlers.get('addPhase')!(req, ctx);

    expect(result.status).toBe(201);
    expect(result.jsonBody.plan.phases).toHaveLength(3);
    expect(result.jsonBody.plan.phases[2].name).toBe('Race Prep');
  });
});

describe('POST /api/plan/phases/:phaseIndex/weeks — data isolation', () => {
  it('user B cannot add week to user A plan phase — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Attempt to add week as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeAddWeekReq('0');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);

    expect(result.status).toBe(404);

    // User A's plan should be unchanged
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    expect(plan?.phases[0].weeks).toHaveLength(1);
  });

  it('user A can add week to their own plan phase', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Add week as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeAddWeekReq('0');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);

    expect(result.status).toBe(201);
    expect(result.jsonBody.plan.phases[0].weeks).toHaveLength(2);
  });
});
