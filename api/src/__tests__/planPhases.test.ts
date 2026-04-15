import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before planPhases.ts is imported
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
  requireAuth: vi.fn().mockResolvedValue(null),
}));

// Side-effect import registers patchPhase and deleteLastPhase handlers
import '../functions/planPhases.js';
import { HttpRequest } from '@azure/functions';

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
});

const makeWeekDays = (runOverrides: Partial<Record<string, unknown>> = {}) => [
  { label: 'A', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy run', completed: false, skipped: false, ...runOverrides },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
];

const validActivePlan = {
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
};

describe('PATCH /api/plan/phases/:phaseIndex', () => {
  beforeEach(async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
  });

  it('returns 400 for invalid phaseIndex (NaN)', async () => {
    const req = makePatchReq('abc', { name: 'New Name' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid phaseIndex');
  });

  it('returns 400 for invalid phaseIndex (negative)', async () => {
    const req = makePatchReq('-1', { name: 'New Name' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid phaseIndex');
  });

  it('returns 400 for invalid phaseIndex (non-integer)', async () => {
    const req = makePatchReq('1.5', { name: 'New Name' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid phaseIndex');
  });

  it('returns 400 on empty body (no name or description)', async () => {
    const req = makePatchReq('0', {});
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('At least one of name or description');
  });

  it('returns 404 when phaseIndex >= phases.length', async () => {
    const req = makePatchReq('99', { name: 'New Name' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('does not exist');
  });

  it('updates name only and returns 200', async () => {
    const req = makePatchReq('0', { name: 'Aerobic Foundation' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[0].name).toBe('Aerobic Foundation');
    expect(result.jsonBody.plan.phases[0].description).toBe('Build aerobic base'); // unchanged
  });

  it('updates description only and returns 200', async () => {
    const req = makePatchReq('1', { description: 'Updated description' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[1].description).toBe('Updated description');
    expect(result.jsonBody.plan.phases[1].name).toBe('Build Phase'); // unchanged
  });

  it('updates both name and description and returns 200', async () => {
    const req = makePatchReq('0', { name: 'Foundation', description: 'New desc' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[0].name).toBe('Foundation');
    expect(result.jsonBody.plan.phases[0].description).toBe('New desc');
  });

  it('allows empty string description', async () => {
    const req = makePatchReq('0', { description: '' });
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[0].description).toBe('');
  });

  it('returns 400 when JSON body is invalid', async () => {
    const req = makePatchReq('0');
    vi.spyOn(req, 'json').mockRejectedValue(new SyntaxError('Invalid JSON'));
    const result = await handlers.get('patchPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid JSON body');
  });

});

describe('POST /api/plan/phases', () => {
  it('returns 404 when no active plan exists', async () => {
    const req = makePostReq();
    const result = await handlers.get('addPhase')!(req, ctx);
    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('No active plan found');
  });

  it('creates a new phase with auto-numbered name when body is empty', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makePostReq();
    const result = await handlers.get('addPhase')!(req, ctx);
    expect(result.status).toBe(201);
    expect(result.jsonBody.plan.phases).toHaveLength(3);
    expect(result.jsonBody.plan.phases[2].name).toBe('Phase 3');
  });

  it('creates a new phase with provided name and description', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makePostReq({ name: 'Race Prep', description: 'Final push' });
    const result = await handlers.get('addPhase')!(req, ctx);
    expect(result.status).toBe(201);
    expect(result.jsonBody.plan.phases[2].name).toBe('Race Prep');
    expect(result.jsonBody.plan.phases[2].description).toBe('Final push');
  });

  it('new phase has correct globally sequential weekNumber via assignPlanStructure', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makePostReq();
    const result = await handlers.get('addPhase')!(req, ctx);
    expect(result.status).toBe(201);
    // validActivePlan has 2 phases each with 1 week (weekNumbers 1,2)
    // new phase's first week should be weekNumber 3
    expect(result.jsonBody.plan.phases[2].weeks[0].weekNumber).toBe(3);
  });

  it('new phase starts with one empty week and no days', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makePostReq();
    const result = await handlers.get('addPhase')!(req, ctx);
    expect(result.status).toBe(201);
    const newPhase = result.jsonBody.plan.phases[2];
    expect(newPhase.weeks).toHaveLength(1);
    expect(newPhase.weeks[0].days).toHaveLength(0);
  });

  it('handles missing body gracefully (no JSON body)', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makePostReq();
    vi.spyOn(req, 'json').mockRejectedValue(new SyntaxError('No body'));
    const result = await handlers.get('addPhase')!(req, ctx);
    // Should still succeed with auto-numbered name
    expect(result.status).toBe(201);
    expect(result.jsonBody.plan.phases[2].name).toBe('Phase 3');
  });
});

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

describe('POST /api/plan/phases/:phaseIndex/weeks', () => {
  it('returns 404 when no active plan exists', async () => {
    const req = makeAddWeekReq('0');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);
    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('No active plan found');
  });

  it('returns 400 for non-integer phaseIndex', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeAddWeekReq('abc');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid phaseIndex');
  });

  it('returns 400 for negative phaseIndex', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeAddWeekReq('-1');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid phaseIndex');
  });

  it('returns 404 when phaseIndex is out of bounds', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeAddWeekReq('5');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);
    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('Phase index 5 does not exist');
  });

  it('adds an empty week to the specified phase and returns 201', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeAddWeekReq('0');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);
    expect(result.status).toBe(201);
    // Phase 0 originally had 1 week; should now have 2
    expect(result.jsonBody.plan.phases[0].weeks).toHaveLength(2);
    expect(result.jsonBody.plan.phases[0].weeks[1].days).toHaveLength(0);
  });

  it('recomputes globally sequential week numbers after adding a week', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeAddWeekReq('0');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);
    expect(result.status).toBe(201);
    // validActivePlan: phase0 week1, phase1 week2. After adding week to phase0:
    // phase0: week1, week2; phase1: week3
    expect(result.jsonBody.plan.phases[0].weeks[0].weekNumber).toBe(1);
    expect(result.jsonBody.plan.phases[0].weeks[1].weekNumber).toBe(2);
    expect(result.jsonBody.plan.phases[1].weeks[0].weekNumber).toBe(3);
  });

  it('does not modify other phases', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeAddWeekReq('1');
    const result = await handlers.get('addWeekToPhase')!(req, ctx);
    expect(result.status).toBe(201);
    // Phase 0 unchanged (still 1 week)
    expect(result.jsonBody.plan.phases[0].weeks).toHaveLength(1);
    // Phase 1 now has 2 weeks
    expect(result.jsonBody.plan.phases[1].weeks).toHaveLength(2);
  });
});

describe('DELETE /api/plan/phases/last', () => {
  it('returns 400 when only one phase exists', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [validActivePlan.phases[0]],
    });
    const req = makeDeleteReq();
    const result = await handlers.get('deleteLastPhase')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Cannot delete the only phase');
  });

  it('returns 409 when last phase has completed days', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        validActivePlan.phases[0],
        {
          name: 'Build Phase',
          description: 'Increase intensity',
          weeks: [{ weekNumber: 2, days: makeWeekDays({ completed: true }) }],
        },
      ],
    });
    const req = makeDeleteReq();
    const result = await handlers.get('deleteLastPhase')!(req, ctx);
    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toContain('Cannot delete a phase with completed days');
  });

  it('returns 200 and deletes last phase', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeDeleteReq();
    const result = await handlers.get('deleteLastPhase')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases).toHaveLength(1);
    expect(result.jsonBody.plan.phases[0].name).toBe('Base Building');
  });

  it('does not affect earlier phases when deleting last phase', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const req = makeDeleteReq();
    const result = await handlers.get('deleteLastPhase')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.phases[0].name).toBe('Base Building');
    expect(result.jsonBody.plan.phases[0].description).toBe('Build aerobic base');
    expect(result.jsonBody.plan.phases[0].weeks).toHaveLength(1);
  });

  it('returns 404 when no active plan exists', async () => {
    const req = makeDeleteReq();
    const result = await handlers.get('deleteLastPhase')!(req, ctx);
    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('No active plan found');
  });

});
