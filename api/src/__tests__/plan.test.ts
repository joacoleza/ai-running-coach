import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before plan.ts is imported
const handlers = vi.hoisted(() => new Map<string, (req: any, ctx: any) => Promise<any>>());
// Fixed test user ID — hoisted so it's available in vi.mock factory
const TEST_USER_ID = vi.hoisted(() => '000000000000000000000001');

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
  getAuthContext: vi.fn().mockReturnValue({ userId: TEST_USER_ID, email: 'test@example.com', isAdmin: false }),
}));

// Side-effect import registers getPlan, createPlan, patchPlan handlers
import '../functions/plan.js';
import { HttpRequest } from '@azure/functions';
import { requireAuth } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makeReq(method: string, body?: unknown): HttpRequest {
  const req = new HttpRequest({
    method,
    url: 'http://localhost/api/plan',
    headers: { 'x-app-password': 'test-pw' },
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
  await mongoClient.db('running-coach').collection('runs').deleteMany({});
});

const TEST_USER_OID = new ObjectId(TEST_USER_ID);

const validGoal = {
  eventType: '10K',
  targetDate: '2026-06-01',
  weeklyMileage: 30,
  availableDays: 4,
  units: 'km',
};

const validPhases = [
  {
    name: 'Base Building',
    description: 'Build aerobic base',
    weeks: [
      {
        weekNumber: 1,
        days: [
          {
            label: 'A',
            type: 'run',
            objective: { kind: 'distance', value: 5, unit: 'km' },
            guidelines: 'Easy run',
            completed: false,
            skipped: false,
          },
        ],
      },
    ],
  },
];

async function createTestPlan(mode: 'conversational' | 'paste' = 'conversational') {
  const req = makeReq('POST', { mode });
  const result = await handlers.get('createPlan')!(req, ctx);
  return result.jsonBody.plan._id.toString() as string;
}

describe('Plan Schema (PLAN-02)', () => {
  it('plan document has correct schema fields', async () => {
    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);
    const plan = result.jsonBody.plan;

    expect(plan.status).toBe('onboarding');
    expect(plan.onboardingStep).toBe(0);
    expect(plan.onboardingMode).toBe('conversational');
    expect(plan.goal).toBeDefined();
    expect(plan.phases).toEqual([]);
    expect(plan.createdAt).toBeDefined();
    expect(plan.updatedAt).toBeDefined();
  });
});

describe('createPlan - active plan guard', () => {
  it('returns 409 when an active plan exists (with completed days)', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: validGoal,
      phases: [{ ...validPhases[0], weeks: [{ ...validPhases[0].weeks[0], days: [{ ...validPhases[0].weeks[0].days[0], completed: true }] }] }],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });

    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);

    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toMatch(/active training plan/i);
  });

  it('returns 409 when an active plan exists (no completed days)', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: validGoal,
      phases: validPhases,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });

    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);

    expect(result.status).toBe(409);
  });

  it('allows creating a new plan when only an onboarding plan exists (onboarding is deleted first)', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'onboarding',
      onboardingMode: 'conversational',
      onboardingStep: 2,
      goal: {},
      phases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });

    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);

    expect(result.status).toBe(201);
  });
});

describe('Plan CRUD', () => {
  it('POST /api/plan creates plan with status onboarding', async () => {
    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);

    expect(result.status).toBe(201);
    expect(result.jsonBody.plan.status).toBe('onboarding');
  });

  it('POST /api/plan deletes existing onboarding plan (D-02) — prevents empty archive entries', async () => {
    // Create first plan (onboarding, no phases — abandoned)
    const firstId = await createTestPlan();

    // Create second plan — first should be DELETED, not archived
    await createTestPlan();

    const firstPlan = await mongoClient
      .db('running-coach')
      .collection('plans')
      .findOne({ _id: new ObjectId(firstId) });
    expect(firstPlan).toBeNull(); // deleted, not archived
  });

  it('GET /api/plan returns active or onboarding plan', async () => {
    await createTestPlan();

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).not.toBeNull();
    expect(['onboarding', 'active']).toContain(result.jsonBody.plan.status);
  });

  it('GET /api/plan does not return archived plans', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'archived',
      onboardingStep: 6,
      goal: {},
      phases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeNull();
  });

  it('GET /api/plan includes linkedRuns map keyed by weekNumber-dayLabel', async () => {
    const planId = await createTestPlan();
    // Patch plan to active with a completed phase/week/day
    await mongoClient.db('running-coach').collection('plans').updateOne(
      { _id: new ObjectId(planId) },
      { $set: { status: 'active', phases: validPhases } }
    );
    // Insert a run linked to this plan
    const planOid = new ObjectId(planId);
    await mongoClient.db('running-coach').collection('runs').insertOne({
      planId: planOid,
      weekNumber: 1,
      dayLabel: 'A',
      date: '2026-04-01',
      distance: 5,
      pace: 5.5,
      duration: '27:30',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.linkedRuns).toBeDefined();
    expect(result.jsonBody.linkedRuns['1-A']).toBeDefined();
    expect(result.jsonBody.linkedRuns['1-A'].distance).toBe(5);
  });

  it('GET /api/plan returns empty linkedRuns when no runs are linked', async () => {
    await createTestPlan();

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.linkedRuns).toEqual({});
  });

  it('GET /api/plan returns null for stale sessions-based plans', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingStep: 6,
      goal: {},
      sessions: [{ id: 'abc', date: '2026-01-01', distance: 5, notes: 'Easy run', completed: false }],
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeNull();
  });

  it('GET /api/plan returns 401 without password', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } } as any);

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(401);
  });
});

describe('PATCH /api/plan - patchPlan', () => {
  async function seedActivePlan() {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: validGoal,
      phases: validPhases,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });
  }

  it('returns 400 when body has no updatable fields', async () => {
    await seedActivePlan();
    const req = makeReq('PATCH', {});
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('No updatable fields provided');
  });

  it('saves progressFeedback and returns 200 (no regression)', async () => {
    await seedActivePlan();
    const req = makeReq('PATCH', { progressFeedback: 'Great week!' });
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(200);
  });

  it('saves targetDate when non-empty and returns 200', async () => {
    await seedActivePlan();
    const req = makeReq('PATCH', { targetDate: '2026-11-01' });
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(200);
    // verify in DB
    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    expect(plan?.targetDate).toBe('2026-11-01');
  });

  it('unsets targetDate when empty string and returns 200', async () => {
    // Insert plan with existing targetDate
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: validGoal,
      phases: validPhases,
      targetDate: '2026-06-01',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: TEST_USER_OID,
    });
    const req = makeReq('PATCH', { targetDate: '' });
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(200);
    // targetDate should be absent (unset), not empty string
    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    expect(plan?.targetDate).toBeUndefined();
  });

  it('saves both targetDate and progressFeedback together', async () => {
    await seedActivePlan();
    const req = makeReq('PATCH', { targetDate: '2026-11-01', progressFeedback: 'On track!' });
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(200);
    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    expect(plan?.targetDate).toBe('2026-11-01');
    expect(plan?.progressFeedback).toBe('On track!');
  });

  it('returns 404 when no active plan exists', async () => {
    const req = makeReq('PATCH', { targetDate: '2026-11-01' });
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(404);
  });
});
