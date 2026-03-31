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
  requirePassword: vi.fn().mockResolvedValue(null),
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
