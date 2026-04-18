import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before planArchive.ts is imported
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

// Side-effect import registers archivePlan, listArchivedPlans, getArchivedPlan handlers
import '../functions/planArchive.js';
import { HttpRequest } from '@azure/functions';
import { getAuthContext } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makeReq(method: string, url: string, body?: unknown): HttpRequest {
  const req = new HttpRequest({
    method,
    url,
    headers: { 'x-app-password': 'test-pw' },
  });
  if (body !== undefined) {
    vi.spyOn(req, 'json').mockResolvedValue(body);
  }
  return req;
}

function makeReqWithParams(method: string, url: string, params: Record<string, string>): HttpRequest {
  const req = new HttpRequest({
    method,
    url,
    headers: { 'x-app-password': 'test-pw' },
    params,
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
  await mongoClient.db('running-coach').collection('runs').deleteMany({});
  // Reset auth context to user A for each test
  vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
});

const USER_A_OID = new ObjectId(USER_A_ID);
const USER_B_OID = new ObjectId(USER_B_ID);

const makeWeekDays = (runOverrides: Partial<Record<string, unknown>> = {}) => [
  { label: 'A', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy run', completed: false, skipped: false, ...runOverrides },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
];

const basePlan = (userId: ObjectId) => ({
  onboardingMode: 'conversational',
  onboardingStep: 6,
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
  phases: [],
  objective: '10km',
  userId,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const planWithPhases = (userId: ObjectId) => ({
  ...basePlan(userId),
  phases: [
    {
      name: 'Base Building',
      description: '',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-04-07',
          days: makeWeekDays(),
        },
      ],
    },
  ],
});

describe('GET /api/plans/archived — data isolation', () => {
  it('user B cannot see user A archived plans — returns empty list', async () => {
    const db = mongoClient.db('running-coach');

    // Insert archived plans for user A
    await db.collection('plans').insertMany([
      { ...planWithPhases(USER_A_OID), status: 'archived' },
      { ...planWithPhases(USER_A_OID), status: 'archived' },
    ]);

    // Request archived plans as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeReq('GET', 'http://localhost/api/plans/archived');
    const result = await handlers.get('listArchivedPlans')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plans).toHaveLength(0);
  });

  it('user A can see their own archived plans', async () => {
    const db = mongoClient.db('running-coach');

    // Insert archived plans for user A
    await db.collection('plans').insertMany([
      { ...planWithPhases(USER_A_OID), status: 'archived' },
      { ...planWithPhases(USER_A_OID), status: 'archived' },
    ]);

    // Also insert archived plans for user B (should not be visible)
    await db.collection('plans').insertMany([
      { ...planWithPhases(USER_B_OID), status: 'archived' },
    ]);

    // Request archived plans as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq('GET', 'http://localhost/api/plans/archived');
    const result = await handlers.get('listArchivedPlans')!(req, ctx);

    expect(result.status).toBe(200);
    // Should only see user A's plans (2), not user B's plan (1)
    expect(result.jsonBody.plans).toHaveLength(2);
  });
});

describe('GET /api/plans/archived/:id — data isolation', () => {
  it('user B cannot get user A archived plan — returns 404', async () => {
    const db = mongoClient.db('running-coach');

    // Insert archived plan for user A
    const { insertedId } = await db.collection('plans').insertOne({
      ...planWithPhases(USER_A_OID),
      status: 'archived',
    });

    // Attempt to get plan as user B
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const id = insertedId.toString();
    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);

    expect(result.status).toBe(404);
  });

  it('user A can get their own archived plan', async () => {
    const db = mongoClient.db('running-coach');

    // Insert archived plan for user A
    const { insertedId } = await db.collection('plans').insertOne({
      ...planWithPhases(USER_A_OID),
      status: 'archived',
    });

    // Get plan as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const id = insertedId.toString();
    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeDefined();
    expect(result.jsonBody.plan.userId.toString()).toBe(USER_A_ID);
  });

  it('user A cannot access archived plan from user B even with valid ID', async () => {
    const db = mongoClient.db('running-coach');

    // Insert archived plan for user B
    const { insertedId } = await db.collection('plans').insertOne({
      ...planWithPhases(USER_B_OID),
      status: 'archived',
    });

    // Attempt to get plan as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const id = insertedId.toString();
    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);

    expect(result.status).toBe(404);
  });

  it('linked runs are only returned if they belong to authenticated user', async () => {
    const db = mongoClient.db('running-coach');

    // Insert archived plan for user A
    const { insertedId: planId } = await db.collection('plans').insertOne({
      ...planWithPhases(USER_A_OID),
      status: 'archived',
    });

    // Insert a run linked to the plan, also belonging to user A
    await db.collection('runs').insertOne({
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      date: '2026-04-01',
      distance: 10,
      duration: '50:00',
      pace: 5.0,
      userId: USER_A_OID,
    });

    // Get archived plan as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const id = planId.toString();
    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.linkedRuns['1-A']).toBeDefined();
    expect(result.jsonBody.linkedRuns['1-A'].userId.toString()).toBe(USER_A_ID);
  });
});
