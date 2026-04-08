import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before plan.ts is imported
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

// Side-effect import registers getPlan, createPlan, patchPlan handlers
import '../functions/plan.js';
import { HttpRequest } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';

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
  await mongoClient.db('running-coach').collection('runs').deleteMany({});
});

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

describe('createPlan - no completed-day guard', () => {
  it('allows creating a new plan even when active plan has completed days', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: validGoal,
      phases: [{ ...validPhases[0], weeks: [{ ...validPhases[0].weeks[0], days: [{ ...validPhases[0].weeks[0].days[0], completed: true }] }] }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);

    expect(result.status).toBe(201);
  });

  it('allows creating a new plan when active plan has no completed days', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: validGoal,
      phases: validPhases, // no completed days
      createdAt: new Date(),
      updatedAt: new Date(),
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
    });

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeNull();
  });

  it('GET /api/plan returns 401 without password', async () => {
    vi.mocked(requirePassword).mockResolvedValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } } as any);

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(401);
  });
});
