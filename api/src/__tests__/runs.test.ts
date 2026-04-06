import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before modules are imported
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

// Side-effect imports register all handlers
import '../functions/runs.js';
import '../functions/planDays.js';
import '../functions/plan.js';
import { HttpRequest } from '@azure/functions';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

// ── Request helpers ────────────────────────────────────────────────────────

function makeGetReq(url: string): HttpRequest {
  return new HttpRequest({ method: 'GET', url, headers: { 'x-app-password': 'test-pw' } });
}

function makeGetReqWithQuery(baseUrl: string, queryParams: Record<string, string>): HttpRequest {
  const params = new URLSearchParams(queryParams);
  const url = `${baseUrl}?${params.toString()}`;
  return new HttpRequest({ method: 'GET', url, headers: { 'x-app-password': 'test-pw' } });
}

function makePostReq(url: string, body: unknown): HttpRequest {
  const req = new HttpRequest({ method: 'POST', url, headers: { 'x-app-password': 'test-pw' } });
  vi.spyOn(req, 'json').mockResolvedValue(body);
  return req;
}

function makeDeleteReq(url: string, params: Record<string, string> = {}): HttpRequest {
  return new HttpRequest({ method: 'DELETE', url, headers: { 'x-app-password': 'test-pw' }, params });
}

function makePatchReq(url: string, params: Record<string, string> = {}, body?: unknown): HttpRequest {
  const req = new HttpRequest({ method: 'PATCH', url, headers: { 'x-app-password': 'test-pw' }, params });
  if (body !== undefined) {
    vi.spyOn(req, 'json').mockResolvedValue(body);
  }
  return req;
}

// ── DB setup ───────────────────────────────────────────────────────────────

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

// ── Fixtures ───────────────────────────────────────────────────────────────

const makeWeekDays = (runOverrides: Partial<Record<string, unknown>> = {}) => [
  {
    label: 'A',
    type: 'run',
    objective: { kind: 'distance', value: 5, unit: 'km' },
    guidelines: 'Easy run',
    completed: false,
    skipped: false,
    ...runOverrides,
  },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { label: '', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
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
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── POST /api/runs - createRun ─────────────────────────────────────────────

describe('POST /api/runs - createRun', () => {
  it('creates an unlinked run when no weekNumber/dayLabel provided', async () => {
    const req = makePostReq('http://localhost/api/runs', {
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
    });
    const result = await handlers.get('createRun')!(req, ctx);
    expect(result.status).toBe(201);
    expect(result.jsonBody.date).toBe('2026-04-01');
    expect(result.jsonBody.distance).toBe(5);
    expect(result.jsonBody.planId).toBeUndefined();

    const run = await mongoClient.db('running-coach').collection('runs').findOne({ date: '2026-04-01' });
    expect(run).not.toBeNull();
    expect(run?.planId).toBeUndefined();
  });

  it('creates and links run to plan day, marks day completed', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });

    const req = makePostReq('http://localhost/api/runs', {
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      weekNumber: 1,
      dayLabel: 'A',
    });
    const result = await handlers.get('createRun')!(req, ctx);
    expect(result.status).toBe(201);
    expect(result.jsonBody.weekNumber).toBe(1);
    expect(result.jsonBody.dayLabel).toBe('A');
    expect(result.jsonBody.planId).toBeDefined();

    // Day should be marked completed
    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const day = plan?.phases[0]?.weeks[0]?.days[0];
    expect(day?.completed).toBe(true);
  });

  it('returns 409 when day is already completed', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [{ weekNumber: 1, days: makeWeekDays({ completed: true }) }],
        },
      ],
    });

    const req = makePostReq('http://localhost/api/runs', {
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      weekNumber: 1,
      dayLabel: 'A',
    });
    const result = await handlers.get('createRun')!(req, ctx);
    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toContain('already completed');
  });

  it('returns 400 when required fields missing', async () => {
    const req = makePostReq('http://localhost/api/runs', {
      date: '2026-04-01',
      // missing distance and duration
    });
    const result = await handlers.get('createRun')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('required');
  });

  it('computes pace correctly: 5km in 25:00 → pace = 5.0', async () => {
    const req = makePostReq('http://localhost/api/runs', {
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
    });
    const result = await handlers.get('createRun')!(req, ctx);
    expect(result.status).toBe(201);
    expect(result.jsonBody.pace).toBe(5.0);
  });
});

// ── GET /api/runs - listRuns ───────────────────────────────────────────────

describe('GET /api/runs - listRuns', () => {
  beforeEach(async () => {
    // Insert three runs: different dates to test ordering
    await mongoClient.db('running-coach').collection('runs').insertMany([
      { date: '2026-04-01', distance: 5, duration: '25:00', pace: 5, createdAt: new Date(), updatedAt: new Date() },
      { date: '2026-04-03', distance: 8, duration: '40:00', pace: 5, createdAt: new Date(), updatedAt: new Date() },
      { date: '2026-04-02', distance: 6, duration: '30:00', pace: 5, createdAt: new Date(), updatedAt: new Date() },
    ]);
  });

  it('returns runs in reverse date order', async () => {
    const req = makeGetReq('http://localhost/api/runs');
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(3);
    expect(runs[0].date).toBe('2026-04-03');
    expect(runs[1].date).toBe('2026-04-02');
    expect(runs[2].date).toBe('2026-04-01');
  });

  it('filters by planId when planId query param provided', async () => {
    const planInsert = await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const planId = planInsert.insertedId;

    await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-05',
      distance: 5,
      duration: '25:00',
      pace: 5,
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeGetReqWithQuery('http://localhost/api/runs', { planId: planId.toHexString() });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(1);
    expect(runs[0].date).toBe('2026-04-05');
  });

  it('returns correct total for infinite scroll', async () => {
    const req = makeGetReqWithQuery('http://localhost/api/runs', { limit: '2', offset: '0' });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.runs).toHaveLength(2);
    expect(result.jsonBody.total).toBe(3); // total count of all matching runs
  });
});

// ── GET /api/runs - date and distance filters ─────────────────────────────

describe('GET /api/runs - date and distance filters', () => {
  beforeEach(async () => {
    await mongoClient.db('running-coach').collection('runs').insertMany([
      { date: '2026-03-01', distance: 3, duration: '18:00', pace: 6, createdAt: new Date(), updatedAt: new Date() },
      { date: '2026-04-01', distance: 7, duration: '35:00', pace: 5, createdAt: new Date(), updatedAt: new Date() },
      { date: '2026-05-01', distance: 12, duration: '60:00', pace: 5, createdAt: new Date(), updatedAt: new Date() },
    ]);
  });

  it('filters by dateFrom — returns only runs on or after the given date', async () => {
    const req = makeGetReqWithQuery('http://localhost/api/runs', { dateFrom: '2026-04-01' });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(2);
    expect(runs.map((r: any) => r.date)).toContain('2026-04-01');
    expect(runs.map((r: any) => r.date)).toContain('2026-05-01');
    expect(runs.map((r: any) => r.date)).not.toContain('2026-03-01');
  });

  it('filters by dateTo — returns only runs on or before the given date', async () => {
    const req = makeGetReqWithQuery('http://localhost/api/runs', { dateTo: '2026-04-01' });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(2);
    expect(runs.map((r: any) => r.date)).toContain('2026-03-01');
    expect(runs.map((r: any) => r.date)).toContain('2026-04-01');
    expect(runs.map((r: any) => r.date)).not.toContain('2026-05-01');
  });

  it('filters by dateFrom and dateTo together', async () => {
    const req = makeGetReqWithQuery('http://localhost/api/runs', { dateFrom: '2026-04-01', dateTo: '2026-04-30' });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(1);
    expect(runs[0].date).toBe('2026-04-01');
  });

  it('filters by distanceMin — returns only runs >= that distance', async () => {
    const req = makeGetReqWithQuery('http://localhost/api/runs', { distanceMin: '7' });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(2);
    expect(runs.map((r: any) => r.distance)).toContain(7);
    expect(runs.map((r: any) => r.distance)).toContain(12);
    expect(runs.map((r: any) => r.distance)).not.toContain(3);
  });

  it('filters by distanceMax — returns only runs <= that distance', async () => {
    const req = makeGetReqWithQuery('http://localhost/api/runs', { distanceMax: '7' });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(2);
    expect(runs.map((r: any) => r.distance)).toContain(3);
    expect(runs.map((r: any) => r.distance)).toContain(7);
    expect(runs.map((r: any) => r.distance)).not.toContain(12);
  });

  it('filters by distanceMin and distanceMax together', async () => {
    const req = makeGetReqWithQuery('http://localhost/api/runs', { distanceMin: '5', distanceMax: '10' });
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(1);
    expect(runs[0].distance).toBe(7);
  });
});

// ── GET /api/runs/{id} and PATCH /api/runs/{id} ───────────────────────────

describe('GET /api/runs/:id - getRun', () => {
  it('returns a run by id', async () => {
    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = runInsert.insertedId.toHexString();
    const req = new HttpRequest({ method: 'GET', url: `http://localhost/api/runs/${runId}`, headers: { 'x-app-password': 'test-pw' }, params: { id: runId } });
    const result = await handlers.get('getRun')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.date).toBe('2026-04-01');
  });

  it('returns 404 for unknown id', async () => {
    const unknownId = new ObjectId().toHexString();
    const req = new HttpRequest({ method: 'GET', url: `http://localhost/api/runs/${unknownId}`, headers: { 'x-app-password': 'test-pw' }, params: { id: unknownId } });
    const result = await handlers.get('getRun')!(req, ctx);
    expect(result.status).toBe(404);
  });

  it('returns 400 for invalid id format', async () => {
    const req = new HttpRequest({ method: 'GET', url: 'http://localhost/api/runs/not-an-id', headers: { 'x-app-password': 'test-pw' }, params: { id: 'not-an-id' } });
    const result = await handlers.get('getRun')!(req, ctx);
    expect(result.status).toBe(400);
  });
});

describe('PATCH /api/runs/:id - updateRun', () => {
  it('updates run fields and recomputes pace when distance changes', async () => {
    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = runInsert.insertedId.toHexString();
    const req = new HttpRequest({ method: 'PATCH', url: `http://localhost/api/runs/${runId}`, headers: { 'x-app-password': 'test-pw' }, params: { id: runId } });
    vi.spyOn(req, 'json').mockResolvedValue({ distance: 10, duration: '50:00' });
    const result = await handlers.get('updateRun')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.distance).toBe(10);
    expect(result.jsonBody.pace).toBe(5.0);
  });

  it('saves insight field when provided', async () => {
    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = runInsert.insertedId.toHexString();
    const req = new HttpRequest({ method: 'PATCH', url: `http://localhost/api/runs/${runId}`, headers: { 'x-app-password': 'test-pw' }, params: { id: runId } });
    vi.spyOn(req, 'json').mockResolvedValue({ insight: 'Great tempo effort today' });
    const result = await handlers.get('updateRun')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.insight).toBe('Great tempo effort today');
  });
});

// ── POST /api/runs - HH:MM:SS duration ───────────────────────────────────

describe('POST /api/runs - HH:MM:SS duration format', () => {
  it('computes pace correctly for 1:30:00 duration (90 min / 18km = 5.0)', async () => {
    const req = makePostReq('http://localhost/api/runs', {
      date: '2026-04-01',
      distance: 18,
      duration: '1:30:00',
    });
    const result = await handlers.get('createRun')!(req, ctx);
    expect(result.status).toBe(201);
    expect(result.jsonBody.pace).toBe(5.0);
  });
});

// ── GET /api/runs?unlinked=true - listRuns (unlinked filter) ──────────────

describe('GET /api/runs?unlinked=true - listRuns unlinked filter', () => {
  it('returns only runs where planId does not exist', async () => {
    const planInsert = await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const planId = planInsert.insertedId;

    await mongoClient.db('running-coach').collection('runs').insertMany([
      {
        date: '2026-04-01',
        distance: 5,
        duration: '25:00',
        pace: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        date: '2026-04-02',
        distance: 8,
        duration: '40:00',
        pace: 5,
        planId,
        weekNumber: 1,
        dayLabel: 'A',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const req = makeGetReq('http://localhost/api/runs?unlinked=true');
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    const runs = result.jsonBody.runs;
    expect(runs).toHaveLength(1);
    expect(runs[0].date).toBe('2026-04-01');
  });

  it('excludes runs that have planId set', async () => {
    const planInsert = await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const planId = planInsert.insertedId;

    await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-02',
      distance: 8,
      duration: '40:00',
      pace: 5,
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeGetReq('http://localhost/api/runs?unlinked=true');
    const result = await handlers.get('listRuns')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.runs).toHaveLength(0);
  });
});

// ── DELETE /api/runs/{id} - deleteRun ─────────────────────────────────────

describe('DELETE /api/runs/:id - deleteRun', () => {
  it('deletes unlinked run, returns 204', async () => {
    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = runInsert.insertedId.toHexString();

    const req = makeDeleteReq(`http://localhost/api/runs/${runId}`, { id: runId });
    const result = await handlers.get('deleteRun')!(req, ctx);
    expect(result.status).toBe(204);

    const run = await mongoClient.db('running-coach').collection('runs').findOne({ _id: runInsert.insertedId });
    expect(run).toBeNull();
  });

  it('returns 409 when run is linked to a plan day', async () => {
    const planInsert = await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
    const planId = planInsert.insertedId;

    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = runInsert.insertedId.toHexString();

    const req = makeDeleteReq(`http://localhost/api/runs/${runId}`, { id: runId });
    const result = await handlers.get('deleteRun')!(req, ctx);
    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toContain('Cannot delete a linked run');
  });
});

// ── POST /api/runs/{id}/link - linkRun ────────────────────────────────────

describe('POST /api/runs/:id/link - linkRun', () => {
  it('links run to plan day and marks day completed', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });

    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = runInsert.insertedId.toHexString();

    // Use a fake req object that provides the params and json body
    const fakeReq = {
      params: { id: runId },
      json: async () => ({ weekNumber: 1, dayLabel: 'A' }),
      headers: { get: () => 'test-pw' },
    } as any;

    const result = await handlers.get('linkRun')!(fakeReq, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.planId).toBeDefined();
    expect(result.jsonBody.weekNumber).toBe(1);
    expect(result.jsonBody.dayLabel).toBe('A');

    // Day should be marked completed in the plan
    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const day = plan?.phases[0]?.weeks[0]?.days[0];
    expect(day?.completed).toBe(true);
  });

  it('returns 200 when day is completed but has no linked run (allows retroactive link)', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [{ weekNumber: 1, days: makeWeekDays({ completed: true }) }],
        },
      ],
    });

    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = runInsert.insertedId.toHexString();

    const fakeReq = {
      params: { id: runId },
      json: async () => ({ weekNumber: 1, dayLabel: 'A' }),
      headers: { get: () => 'test-pw' },
    } as any;

    const result = await handlers.get('linkRun')!(fakeReq, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.weekNumber).toBe(1);
  });

  it('returns 409 when day is already completed and already has a linked run', async () => {
    const planInsert = await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [{ weekNumber: 1, days: makeWeekDays({ completed: true }) }],
        },
      ],
    });
    const planId = planInsert.insertedId;

    // Insert existing linked run for the same day
    await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-03-31',
      distance: 6,
      duration: '30:00',
      pace: 5,
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const newRunInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const runId = newRunInsert.insertedId.toHexString();

    const fakeReq = {
      params: { id: runId },
      json: async () => ({ weekNumber: 1, dayLabel: 'A' }),
      headers: { get: () => 'test-pw' },
    } as any;

    const result = await handlers.get('linkRun')!(fakeReq, ctx);
    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toContain('already has a linked run');
  });
});

// ── PATCH /api/plan/days/:week/:day - undo unlinks run ────────────────────

describe('PATCH /api/plan/days/:week/:day - undo unlinks run', () => {
  it('undoing a completed day clears planId/weekNumber/dayLabel from linked run', async () => {
    const planInsert = await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [{ weekNumber: 1, days: makeWeekDays({ completed: true }) }],
        },
      ],
    });
    const planId = planInsert.insertedId;

    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Undo the completion via PATCH
    const req = makeReq('PATCH', { week: '1', day: 'A' }, { completed: 'false', skipped: 'false' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(200);

    // Run should have planId/weekNumber/dayLabel unset
    const run = await mongoClient.db('running-coach').collection('runs').findOne({ _id: runInsert.insertedId });
    expect(run?.planId).toBeUndefined();
    expect(run?.weekNumber).toBeUndefined();
    expect(run?.dayLabel).toBeUndefined();
  });

  it('unlinked run remains in runs collection after undo (not deleted)', async () => {
    const planInsert = await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [{ weekNumber: 1, days: makeWeekDays({ completed: true }) }],
        },
      ],
    });
    const planId = planInsert.insertedId;

    const runInsert = await mongoClient.db('running-coach').collection('runs').insertOne({
      date: '2026-04-01',
      distance: 5,
      duration: '25:00',
      pace: 5,
      planId,
      weekNumber: 1,
      dayLabel: 'A',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeReq('PATCH', { week: '1', day: 'A' }, { completed: 'false' });
    await handlers.get('patchDay')!(req, ctx);

    // Run still exists
    const run = await mongoClient.db('running-coach').collection('runs').findOne({ _id: runInsert.insertedId });
    expect(run).not.toBeNull();
    expect(run?.date).toBe('2026-04-01');
  });
});

// ── PATCH /api/plan - patchPlan ────────────────────────────────────────────

describe('PATCH /api/plan - patchPlan', () => {
  beforeEach(async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
  });

  it('saves progressFeedback to active plan', async () => {
    const req = makePatchPlanReq({ progressFeedback: 'Great work this week!' });
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.progressFeedback).toBe('Great work this week!');
  });

  it('returns 400 when no updatable fields provided', async () => {
    const req = makePatchPlanReq({});
    const result = await handlers.get('patchPlan')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('No updatable fields');
  });
});

// ── Helpers used in undo tests ─────────────────────────────────────────────

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

function makePatchPlanReq(body: unknown): HttpRequest {
  const url = 'http://localhost/api/plan';
  const req = new HttpRequest({
    method: 'PATCH',
    url,
    headers: { 'x-app-password': 'test-pw' },
  });
  vi.spyOn(req, 'json').mockResolvedValue(body);
  return req;
}
