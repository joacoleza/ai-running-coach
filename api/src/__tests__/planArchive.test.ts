import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before planArchive.ts is imported
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

const TEST_USER_ID = vi.hoisted(() => '000000000000000000000001');

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthContext: vi.fn().mockReturnValue({ userId: TEST_USER_ID, email: 'test@example.com', isAdmin: false }),
}));

// Side-effect import registers archivePlan, listArchivedPlans, getArchivedPlan handlers
import '../functions/planArchive.js';
import { HttpRequest } from '@azure/functions';

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
  // Warm up getDb() once so index creation doesn't eat into individual test timeouts.
  // _resetDbForTest() is NOT called in beforeEach — the URI is constant within this file.
  const { getDb } = await import('../shared/db.js');
  await getDb();
}, 30_000);

afterAll(async () => {
  await mongoClient.close();
  _resetDbForTest();
  await mongod.stop();
}, 30_000);

beforeEach(async () => {
  await mongoClient.db('running-coach').collection('plans').deleteMany({});
});

const TEST_USER_OID = new ObjectId('000000000000000000000001');

const basePlan = {
  onboardingMode: 'conversational',
  onboardingStep: 6,
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
  phases: [],
  objective: '10km',
  userId: TEST_USER_OID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const planWithPhases = {
  ...basePlan,
  phases: [
    {
      name: 'Base Building',
      description: '',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-04-07',
          days: [{ date: '2026-04-07', type: 'run', guidelines: 'Easy run', completed: false, skipped: false }],
        },
      ],
    },
  ],
};

describe('POST /api/plan/archive', () => {
  it('archives active plan with phases and returns 200 with archived status', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...planWithPhases,
      status: 'active',
    });

    const req = makeReq('POST', 'http://localhost/api/plan/archive');
    const result = await handlers.get('archivePlan')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.status).toBe('archived');

    const inDb = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'archived' });
    expect(inDb).not.toBeNull();
  });

  it('deletes (not archives) active plan with no phases to prevent empty archive entries', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...basePlan,
      status: 'active',
    });

    const req = makeReq('POST', 'http://localhost/api/plan/archive');
    const result = await handlers.get('archivePlan')!(req, ctx);
    expect(result.status).toBe(200);

    // Plan should be deleted, not in archived collection
    const archived = await mongoClient.db('running-coach').collection('plans').find({ status: 'archived' }).toArray();
    expect(archived).toHaveLength(0);
    const remaining = await mongoClient.db('running-coach').collection('plans').countDocuments();
    expect(remaining).toBe(0);
  });

  it('deletes (not archives) onboarding plan with no phases', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...basePlan,
      status: 'onboarding',
    });

    const req = makeReq('POST', 'http://localhost/api/plan/archive');
    const result = await handlers.get('archivePlan')!(req, ctx);
    expect(result.status).toBe(200);

    const archived = await mongoClient.db('running-coach').collection('plans').find({ status: 'archived' }).toArray();
    expect(archived).toHaveLength(0);
  });

  it('deletes (not archives) plan with phases but only rest days — no actual workouts', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...basePlan,
      status: 'active',
      phases: [
        {
          name: 'Base',
          description: '',
          weeks: [
            {
              weekNumber: 1,
              startDate: '2026-04-07',
              days: [
                { date: '2026-04-07', type: 'rest', guidelines: 'Rest', completed: false, skipped: false },
                { date: '2026-04-08', type: 'rest', guidelines: 'Rest', completed: false, skipped: false },
              ],
            },
          ],
        },
      ],
    });

    const req = makeReq('POST', 'http://localhost/api/plan/archive');
    const result = await handlers.get('archivePlan')!(req, ctx);
    expect(result.status).toBe(200);

    // Plan with only rest days should be deleted, not archived
    const archived = await mongoClient.db('running-coach').collection('plans').find({ status: 'archived' }).toArray();
    expect(archived).toHaveLength(0);
    const remaining = await mongoClient.db('running-coach').collection('plans').countDocuments();
    expect(remaining).toBe(0);
  });

  it('returns 404 when no active or onboarding plan to archive', async () => {
    const req = makeReq('POST', 'http://localhost/api/plan/archive');
    const result = await handlers.get('archivePlan')!(req, ctx);
    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('No active plan');
  });
});

describe('GET /api/plans/archived', () => {
  it('returns list of archived plans', async () => {
    await mongoClient.db('running-coach').collection('plans').insertMany([
      { ...basePlan, status: 'archived' },
      { ...basePlan, status: 'archived' },
    ]);

    const req = makeReq('GET', 'http://localhost/api/plans/archived');
    const result = await handlers.get('listArchivedPlans')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plans).toHaveLength(2);
  });

  it('returns empty array when no archived plans exist', async () => {
    const req = makeReq('GET', 'http://localhost/api/plans/archived');
    const result = await handlers.get('listArchivedPlans')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plans).toHaveLength(0);
  });
});

describe('GET /api/plans/archived/:id', () => {
  it('returns single archived plan by id with linkedRuns', async () => {
    const insertResult = await mongoClient.db('running-coach').collection('plans').insertOne({
      ...basePlan,
      status: 'archived',
    });
    const id = insertResult.insertedId.toString();

    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeDefined();
    expect(result.jsonBody.linkedRuns).toBeDefined();
    expect(typeof result.jsonBody.linkedRuns).toBe('object');
  });

  it('returns linkedRuns keyed by weekNumber-dayLabel for runs linked to archived plan', async () => {
    const insertResult = await mongoClient.db('running-coach').collection('plans').insertOne({
      ...basePlan,
      status: 'archived',
    });
    const planId = insertResult.insertedId;

    await mongoClient.db('running-coach').collection('runs').insertOne({
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      date: '2026-04-01',
      distance: 10,
      duration: '50:00',
      pace: 5.0,
      userId: TEST_USER_OID,
    });

    const id = planId.toString();
    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.linkedRuns['1-A']).toBeDefined();
    expect(result.jsonBody.linkedRuns['1-A'].date).toBe('2026-04-01');

    await mongoClient.db('running-coach').collection('runs').deleteMany({ planId });
  });

  it('returns 400 for invalid ObjectId format', async () => {
    const req = makeReqWithParams('GET', 'http://localhost/api/plans/archived/not-valid', { id: 'not-valid' });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid plan ID format');
  });

  it('returns 404 when archived plan not found', async () => {
    const id = new ObjectId().toString();
    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);
    expect(result.status).toBe(404);
  });
});
