import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before planDays.ts is imported
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

// Side-effect import registers patchDay, deleteDay, addDay handlers
import '../functions/planDays.js';
import { HttpRequest } from '@azure/functions';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makeReq(method: string, params: Record<string, string> = {}, body?: unknown): HttpRequest {
  const url = `http://localhost/api/plan/days/${params['date'] ?? ''}`;
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

// Week starting 2026-04-06 (Mon) — normalized to 7 days. 2026-04-07 (Tue) is the run day.
const makeWeekDays = (runOverrides: Partial<Record<string, unknown>> = {}) => [
  { date: '2026-04-06', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { date: '2026-04-07', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy run', completed: false, skipped: false, ...runOverrides },
  { date: '2026-04-08', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { date: '2026-04-09', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { date: '2026-04-10', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { date: '2026-04-11', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
  { date: '2026-04-12', type: 'rest', guidelines: 'Rest day', completed: false, skipped: false },
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
      weeks: [{ weekNumber: 1, startDate: '2026-04-06', days: makeWeekDays() }],
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PATCH /api/plan/days/:date', () => {
  it('returns 400 for invalid date format', async () => {
    const req = makeReq('PATCH', { date: 'not-a-date' }, { guidelines: 'New text' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid date format');
  });

  it('can undo a completed day using string false values', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [
            {
              ...validActivePlan.phases[0].weeks[0],
              days: [
                {
                  ...validActivePlan.phases[0].weeks[0].days[0],
                  date: '2026-04-07',
                  completed: true,
                },
              ],
            },
          ],
        },
      ],
    });

    // Undo via string 'false' values (standard client path)
    const req = makeReq('PATCH', { date: '2026-04-07' }, { completed: 'false', skipped: 'false' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(200);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const day = plan?.phases[0]?.weeks[0]?.days[0];
    expect(day?.completed).toBe(false);
    expect(day?.skipped).toBe(false);
  });

  it('can undo a completed day using boolean false values (runtime coercion guard)', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [
            {
              ...validActivePlan.phases[0].weeks[0],
              days: [
                {
                  ...validActivePlan.phases[0].weeks[0].days[0],
                  date: '2026-04-07',
                  completed: true,
                },
              ],
            },
          ],
        },
      ],
    });

    // Undo via boolean false values (defensive — should also work if runtime parses JSON booleans)
    const req = makeReq('PATCH', { date: '2026-04-07' }, { completed: false as any, skipped: false as any });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(200);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const day = plan?.phases[0]?.weeks[0]?.days[0];
    expect(day?.completed).toBe(false);
  });

  it('updates guidelines for a non-completed day', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });

    const req = makeReq('PATCH', { date: '2026-04-07' }, { guidelines: 'Updated guidelines' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeDefined();
  });

  it('rejects update with no valid fields (400)', async () => {
    const req = makeReq('PATCH', { date: '2026-04-07' }, {});
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('No valid fields');
  });

  it('reschedule: old date becomes rest, new date takes the run details', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });

    const req = makeReq('PATCH', { date: '2026-04-07' }, { newDate: '2026-04-09' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(200);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const days = plan?.phases[0]?.weeks[0]?.days;
    const oldDay = days?.find((d: any) => d.date === '2026-04-07');
    const newDay = days?.find((d: any) => d.date === '2026-04-09');
    expect(oldDay?.type).toBe('rest');
    expect(newDay?.type).toBe('run');
    expect(newDay?.objective?.value).toBe(5);
    expect(newDay?.guidelines).toBe('Easy run');
  });

  it('rejects invalid newDate format', async () => {
    const req = makeReq('PATCH', { date: '2026-04-07' }, { newDate: 'not-a-date' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid newDate format');
  });
});

describe('DELETE /api/plan/days/:date', () => {
  beforeEach(async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
  });

  it('converts the run day to rest (does not remove it)', async () => {
    const req = makeReq('DELETE', { date: '2026-04-07' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(200);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const days = plan?.phases[0]?.weeks[0]?.days;
    expect(days).toHaveLength(7); // week still has 7 days
    const day = days?.find((d: any) => d.date === '2026-04-07');
    expect(day?.type).toBe('rest');
    expect(day?.objective).toBeUndefined();
  });

  it('returns 404 when no active plan exists', async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    const req = makeReq('DELETE', { date: '2026-04-07' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(404);
  });

  it('returns 409 when trying to delete a completed day', async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [{ ...validActivePlan.phases[0], weeks: [{ ...validActivePlan.phases[0].weeks[0], days: makeWeekDays({ completed: true }) }] }],
    });

    const req = makeReq('DELETE', { date: '2026-04-07' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toContain('Cannot remove a completed day');
  });

  it('rejects invalid date format (400)', async () => {
    const req = makeReq('DELETE', { date: 'not-a-date' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(400);
  });
});

describe('POST /api/plan/days', () => {
  beforeEach(async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
  });

  it('converts existing rest day to run', async () => {
    const req = makePostReq({ date: '2026-04-09', type: 'run', guidelines: 'Recovery run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(201);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const days = plan?.phases[0]?.weeks[0]?.days;
    expect(days).toHaveLength(7); // still 7 days
    const day = days?.find((d: any) => d.date === '2026-04-09');
    expect(day?.type).toBe('run');
  });

  it('sets objective when provided', async () => {
    const req = makePostReq({ date: '2026-04-09', type: 'run', guidelines: 'Long run', objective_kind: 'distance', objective_value: '10', objective_unit: 'km' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(201);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const day = plan?.phases[0]?.weeks[0]?.days.find((d: any) => d.date === '2026-04-09');
    expect(day?.objective?.value).toBe(10);
    expect(day?.objective?.unit).toBe('km');
  });

  it('returns 400 when date or type missing', async () => {
    const req = makePostReq({ type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    const req = makePostReq({ date: 'bad-date', type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid date format');
  });

  it('returns 400 for invalid type', async () => {
    const req = makePostReq({ date: '2026-04-09', type: 'swim' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('type must be run or cross-train');
  });

  it('returns 404 when no active plan exists', async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    const req = makePostReq({ date: '2026-04-09', type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(404);
  });

  it('returns 400 when adding a day in the past', async () => {
    const pastDate = '2020-01-01';
    const req = makePostReq({ date: pastDate, type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Cannot add a training day in the past');
  });
});
