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

const validPhases = [
  {
    name: 'Base Building',
    description: 'Build aerobic base',
    weeks: [
      {
        weekNumber: 1,
        startDate: '2026-04-01',
        days: [
          {
            date: '2026-04-01',
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

describe('Plan Generation - JSON extraction (PLAN-01)', () => {
  it('extracts JSON with phases from <training_plan> XML tags', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `Here is your plan\n<training_plan>${JSON.stringify({ phases: validPhases })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases).toHaveLength(1);
    expect(result.jsonBody.plan.phases[0].name).toBe('Base Building');
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

  it('returns 400 when phases array is empty', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: [] })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('at least one phase');
  });

  it('stores phases with correct structure', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: validPhases })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    const phase = result.jsonBody.plan.phases[0];
    expect(phase.name).toBe('Base Building');
    expect(phase.weeks).toHaveLength(1);
    expect(phase.weeks[0].days).toHaveLength(7); // normalized to 7 days
    const runDay = phase.weeks[0].days.find((d: any) => d.type === 'run');
    expect(runDay).toBeDefined();
    expect(runDay.completed).toBe(false);
  });

  it('derives objective from goal embedded in training_plan JSON (fixes wrong title bug)', async () => {
    const planId = await createTestPlan();
    const embeddedGoal = { eventType: '10km', targetDate: '2026-06-27', weeklyMileage: 15, availableDays: 2, units: 'km' };
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ goal: embeddedGoal, phases: validPhases })}</training_plan>`,
      goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
      objective: 'marathon',
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    // Embedded goal in training_plan JSON takes precedence over client-passed goal/objective
    expect(result.jsonBody.plan.objective).toBe('10km');
    expect(result.jsonBody.plan.goal.eventType).toBe('10km');
  });

  it('falls back to client-passed goal when training_plan has no embedded goal', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: validPhases })}</training_plan>`,
      goal: { eventType: 'half-marathon', targetDate: '2026-09-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.objective).toBe('half-marathon');
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
    expect(plan.phases).toEqual([]);
    expect(plan.createdAt).toBeDefined();
    expect(plan.updatedAt).toBeDefined();
  });

  it('PlanDay subdocument matches D-01 schema', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: validPhases })}</training_plan>`,
      goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
    });

    const result = await handlers.get('generatePlan')!(req, ctx);
    const days = result.jsonBody.plan.phases[0].weeks[0].days;
    // After normalization, week has 7 days — find run day by date
    const day = days.find((d: any) => d.date === '2026-04-01');

    expect(day.date).toBe('2026-04-01');
    expect(day.type).toBe('run');
    expect(day.objective.kind).toBe('distance');
    expect(day.objective.value).toBe(5);
    expect(day.guidelines).toBe('Easy run');
    expect(day.completed).toBe(false);
    expect(day.skipped).toBe(false);
  });
});

describe('Plan Generation - past dates allowed on initial creation', () => {
  const pastDate = '2026-03-25'; // Tuesday of the current week (before today 2026-03-28)

  const phasesWithPastCompleted = [
    {
      name: 'Base Building',
      description: 'Build aerobic base',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-03-23',
          days: [
            {
              date: pastDate,
              type: 'run',
              objective: { kind: 'distance', value: 5, unit: 'km' },
              guidelines: 'Easy run (already done)',
              completed: true,
              skipped: false,
            },
          ],
        },
      ],
    },
  ];

  const phasesWithPastSkipped = [
    {
      name: 'Base Building',
      description: 'Build aerobic base',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-03-23',
          days: [
            {
              date: pastDate,
              type: 'run',
              objective: { kind: 'distance', value: 5, unit: 'km' },
              guidelines: 'Easy run (missed)',
              completed: false,
              skipped: true,
            },
          ],
        },
      ],
    },
  ];

  const phasesWithPastNoFlag = [
    {
      name: 'Base Building',
      description: 'Build aerobic base',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-03-23',
          days: [
            {
              date: pastDate,
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

  it('preserves past run days with completed: true (training history)', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: phasesWithPastCompleted })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    const allDays = result.jsonBody.plan.phases.flatMap((p: any) => p.weeks.flatMap((w: any) => w.days));
    const pastDay = allDays.find((d: any) => d.date === pastDate);
    expect(pastDay).toBeDefined();
    expect(pastDay.type).toBe('run');
    expect(pastDay.completed).toBe(true);
    expect(pastDay.skipped).toBe(false);
  });

  it('preserves past run days with skipped: true (missed session)', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: phasesWithPastSkipped })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    const allDays = result.jsonBody.plan.phases.flatMap((p: any) => p.weeks.flatMap((w: any) => w.days));
    const pastDay = allDays.find((d: any) => d.date === pastDate);
    expect(pastDay).toBeDefined();
    expect(pastDay.type).toBe('run');
    expect(pastDay.completed).toBe(false);
    expect(pastDay.skipped).toBe(true);
  });

  it('preserves past run days without flags (not converted to rest)', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: phasesWithPastNoFlag })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    const allDays = result.jsonBody.plan.phases.flatMap((p: any) => p.weeks.flatMap((w: any) => w.days));
    const pastDay = allDays.find((d: any) => d.date === pastDate);
    expect(pastDay).toBeDefined();
    // Must remain a run day, NOT converted to rest
    expect(pastDay.type).toBe('run');
  });

  it('plan with past completed days still normalizes weeks to 7 days', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: phasesWithPastCompleted })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[0].weeks[0].days).toHaveLength(7);
  });
});

describe('Plan Generation - completed-day guard removed', () => {
  it('allows generating plan even when plan has completed days', async () => {
    const planId = await createTestPlan();

    // Mark the day as completed directly in DB
    await mongoClient.db('running-coach').collection('plans').updateOne(
      {},
      { $set: { phases: [{ ...validPhases[0], weeks: [{ ...validPhases[0].weeks[0], days: [{ ...validPhases[0].weeks[0].days[0], completed: true }] }] } ] } }
    );

    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: validPhases })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
  });

  it('allows generating plan even when another active plan has completed days', async () => {
    // Active plan with history — simulates a scenario where the client has stale state
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: validGoal,
      phases: [{ ...validPhases[0], weeks: [{ ...validPhases[0].weeks[0], days: [{ ...validPhases[0].weeks[0].days[0], completed: true }] }] }],
      createdAt: new Date(Date.now() - 60_000),
      updatedAt: new Date(),
    });

    // A newer onboarding plan with no completed days — the client sends this planId
    const newPlan = await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'onboarding',
      onboardingMode: 'conversational',
      onboardingStep: 0,
      goal: {},
      phases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const newPlanId = newPlan.insertedId.toString();

    const req = makeReq('POST', {
      planId: newPlanId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: validPhases })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
  });

  it('allows generating plan when no days are completed', async () => {
    const planId = await createTestPlan();
    const req = makeReq('POST', {
      planId,
      claudeResponseText: `<training_plan>${JSON.stringify({ phases: validPhases })}</training_plan>`,
      goal: validGoal,
    });

    const result = await handlers.get('generatePlan')!(req, ctx);

    expect(result.status).toBe(200);
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
