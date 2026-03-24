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

// Side-effect import registers getPlan, createPlan, generatePlan handlers
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
});

const validGoal = {
  eventType: '10K',
  targetDate: '2026-06-01',
  weeklyMileage: 30,
  availableDays: 4,
  units: 'km',
};

async function createTestPlan(mode: 'conversational' | 'paste' = 'conversational') {
  const req = makeReq('POST', { mode });
  const result = await handlers.get('createPlan')!(req, ctx);
  return result.jsonBody.plan._id.toString() as string;
}

describe('Plan Generation - JSON extraction (PLAN-01)', () => {
  it('extracts JSON from <training_plan> XML tags', async () => {
    const planId = await createTestPlan();
    const sessions = [{ date: '2026-04-01', distance: 5, duration: 30, avgPace: '6:00', notes: 'Easy run' }];
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `Here is your plan\n<training_plan>${JSON.stringify(sessions)}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.sessions).toHaveLength(1);
    expect(result.jsonBody.plan.sessions[0].notes).toBe('Easy run');
  });

  it('returns 400 when no <training_plan> tags found', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: 'Here is a great plan without the required tags',
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Could not extract training plan');
  });

  it('returns 400 on malformed JSON inside tags (D-15)', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: '<training_plan>not-valid-json{{}}</training_plan>',
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Failed to parse');
  });

  it('generates UUID id for each session', async () => {
    const planId = await createTestPlan();
    const sessions = [
      { date: '2026-04-01', distance: 5, duration: 30, avgPace: '6:00', notes: 'Run 1' },
      { date: '2026-04-03', distance: 8, duration: 45, avgPace: '5:30', notes: 'Run 2' },
    ];
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify(sessions)}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    const savedSessions = result.jsonBody.plan.sessions as Array<{ id: string }>;
    expect(savedSessions).toHaveLength(2);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const s of savedSessions) {
      expect(s.id).toMatch(uuidRegex);
    }
    expect(savedSessions[0].id).not.toBe(savedSessions[1].id);
  });

  it('sets completed: false on all sessions', async () => {
    const planId = await createTestPlan();
    const sessions = [
      { date: '2026-04-01', distance: 5, duration: 30, avgPace: '6:00', notes: 'Run' },
      { date: '2026-04-02', distance: 8, duration: 50, avgPace: '5:45', notes: 'Long run' },
    ];
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify(sessions)}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    for (const s of result.jsonBody.plan.sessions as Array<{ completed: boolean }>) {
      expect(s.completed).toBe(false);
    }
  });
});

describe('Plan Schema (PLAN-02)', () => {
  it('plan document has correct schema fields', async () => {
    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);
    const plan = result.jsonBody.plan;

    expect(plan.status).toBe('onboarding');
    expect(plan.onboardingStep).toBe(0);
    expect(plan.onboardingMode).toBe('conversational');
    expect(plan.goal).toBeDefined();
    expect(plan.sessions).toEqual([]);
    expect(plan.createdAt).toBeDefined();
    expect(plan.updatedAt).toBeDefined();
  });

  it('session subdocument matches D-05 schema', async () => {
    const planId = await createTestPlan();
    const sessions = [{
      date: '2026-04-01',
      distance: 10,
      duration: 60,
      avgPace: '6:00',
      avgBpm: 150,
      notes: 'Long run Sunday',
    }];
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify(sessions)}</training_plan>`,
      goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
    });

    const result = await handlers.get('generatePlan')!(req, ctx);
    const s = result.jsonBody.plan.sessions[0];

    expect(s.id).toBeDefined();
    expect(s.date).toBe('2026-04-01');
    expect(s.distance).toBe(10);
    expect(s.duration).toBe(60);
    expect(s.avgPace).toBe('6:00');
    expect(s.avgBpm).toBe(150);
    expect(s.notes).toBe('Long run Sunday');
    expect(s.completed).toBe(false);
  });
});

describe('Plan CRUD', () => {
  it('POST /api/plan creates plan with status onboarding', async () => {
    const req = makeReq('POST', { mode: 'conversational' });
    const result = await handlers.get('createPlan')!(req, ctx);

    expect(result.status).toBe(201);
    expect(result.jsonBody.plan.status).toBe('onboarding');
  });

  it('POST /api/plan discards existing onboarding plan (D-02)', async () => {
    // Create first plan
    const firstId = await createTestPlan();

    // Create second plan — first should be discarded
    await createTestPlan();

    const firstPlan = await mongoClient
      .db('running-coach')
      .collection('plans')
      .findOne({ _id: new ObjectId(firstId) });
    expect(firstPlan?.status).toBe('discarded');
  });

  it('GET /api/plan returns active or onboarding plan', async () => {
    await createTestPlan();

    const result = await handlers.get('getPlan')!(makeReq('GET'), ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).not.toBeNull();
    expect(['onboarding', 'active']).toContain(result.jsonBody.plan.status);
  });

  it('GET /api/plan does not return completed plans', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'completed',
      onboardingStep: 6,
      goal: {},
      sessions: [],
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
