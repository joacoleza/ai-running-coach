import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before planDays.ts is imported
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

// Side-effect import registers patchDay, deleteDay, addDay handlers
import '../functions/planDays.js';
import { HttpRequest } from '@azure/functions';
import { getAuthContext } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makeReq(method: string, params: Record<string, string> = {}, body?: unknown): HttpRequest {
  const weekPart = params['week'] ?? '';
  const dayPart = params['day'] ?? '';
  const url = `http://localhost/api/plan/days/${weekPart}/${dayPart}`;
  const req = new HttpRequest({
    method,
    url,
    headers: { 'x-app-password': 'test-pw' },
    params,
  });
  if (body !== undefined) {
    vi.spyOn(req, 'json').mockResolvedValue(body);
  }
  return req;
}

function makePostReq(body: unknown): HttpRequest {
  const url = 'http://localhost/api/plan/days';
  const req = new HttpRequest({
    method: 'POST',
    url,
    headers: { 'x-app-password': 'test-pw' },
  });
  vi.spyOn(req, 'json').mockResolvedValue(body);
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
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
  userId,
});

describe('PATCH /api/plan/days/:week/:day — data isolation', () => {
  it('user B cannot patch user A plan day — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Attempt to patch day as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeReq('PATCH', { week: '1', day: 'A' }, { guidelines: 'Updated' });
    const result = await handlers.get('patchDay')!(req, ctx);

    expect(result.status).toBe(404);

    // Day should still exist in DB unchanged
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    expect(plan).not.toBeNull();
    expect(plan?.phases[0].weeks[0].days[0].guidelines).toBe('Easy run');
  });

  it('user A can patch their own plan day', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Patch day as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq('PATCH', { week: '1', day: 'A' }, { guidelines: 'Updated to new guidelines' });
    const result = await handlers.get('patchDay')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[0].weeks[0].days[0].guidelines).toBe('Updated to new guidelines');
  });
});

describe('DELETE /api/plan/days/:week/:day — data isolation', () => {
  it('user B cannot delete user A plan day — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Attempt to delete day as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeReq('DELETE', { week: '1', day: 'A' });
    const result = await handlers.get('deleteDay')!(req, ctx);

    expect(result.status).toBe(404);

    // Day should still exist in DB
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    expect(plan).not.toBeNull();
    expect(plan?.phases[0].weeks[0].days[0].label).toBe('A');
  });

  it('user A can delete their own plan day', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Delete day as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq('DELETE', { week: '1', day: 'A' });
    const result = await handlers.get('deleteDay')!(req, ctx);

    expect(result.status).toBe(200);

    // Day should be converted to rest (label removed)
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    expect(plan?.phases[0].weeks[0].days[0].type).toBe('rest');
    expect(plan?.phases[0].weeks[0].days[0].label).toBe('');
  });
});

describe('POST /api/plan/days — data isolation', () => {
  it('user B cannot add day to user A plan — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Attempt to add day as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makePostReq({ weekNumber: 1, label: 'B', type: 'run', guidelines: 'Recovery run' });
    const result = await handlers.get('addDay')!(req, ctx);

    expect(result.status).toBe(404);

    // User A's plan should be unchanged
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    const dayB = plan?.phases[0].weeks[0].days?.find((d: any) => d.label === 'B');
    expect(dayB).toBeUndefined();
  });

  it('user A can add day to their own plan', async () => {
    const db = mongoClient.db('running-coach');

    // Insert plan belonging to user A
    await db.collection('plans').insertOne(makeValidPlan(USER_A_OID));

    // Add day as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makePostReq({ weekNumber: 1, label: 'B', type: 'run', guidelines: 'Recovery run' });
    const result = await handlers.get('addDay')!(req, ctx);

    expect(result.status).toBe(201);

    // Verify day was added
    const plan = await db.collection('plans').findOne({ userId: USER_A_OID });
    const dayB = plan?.phases[0].weeks[0].days?.find((d: any) => d.label === 'B');
    expect(dayB).toBeDefined();
    expect(dayB?.guidelines).toBe('Recovery run');
  });
});
