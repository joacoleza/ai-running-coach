import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before planDays.ts is imported
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

// Side-effect import registers patchDay, deleteDay, addDay handlers
import '../functions/planDays.js';
import { HttpRequest } from '@azure/functions';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

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

// Fixed test user ObjectId — matches getAuthContext mock
const TEST_USER_OID = new ObjectId(TEST_USER_ID);

// Week 1 with days using label-based addressing. Day label 'A' is the run day.
const makeWeekDays = (runOverrides: Partial<Record<string, unknown>> = {}) => [
  { label: 'A', type: 'run', objective: { kind: 'distance', value: 5, unit: 'km' }, guidelines: 'Easy run', completed: false, skipped: false, ...runOverrides },
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
  userId: TEST_USER_OID,
};

describe('PATCH /api/plan/days/:week/:day', () => {
  it('returns 400 for invalid week number', async () => {
    const req = makeReq('PATCH', { week: 'abc', day: 'A' }, { guidelines: 'New text' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid week number');
  });

  it('returns 400 for invalid day label', async () => {
    const req = makeReq('PATCH', { week: '1', day: 'Z' }, { guidelines: 'New text' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('Invalid day label');
  });

  it('can undo a completed day using string false values', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [
        {
          ...validActivePlan.phases[0],
          weeks: [
            {
              weekNumber: 1,
              days: makeWeekDays({ completed: true }),
            },
          ],
        },
      ],
    });

    const req = makeReq('PATCH', { week: '1', day: 'A' }, { completed: 'false', skipped: 'false' });
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
          weeks: [{ weekNumber: 1, days: makeWeekDays({ completed: true }) }],
        },
      ],
    });

    const req = makeReq('PATCH', { week: '1', day: 'A' }, { completed: false as any, skipped: false as any });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(200);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const day = plan?.phases[0]?.weeks[0]?.days[0];
    expect(day?.completed).toBe(false);
  });

  it('updates guidelines for a non-completed day', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });

    const req = makeReq('PATCH', { week: '1', day: 'A' }, { guidelines: 'Updated guidelines' });
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeDefined();
  });

  it('rejects update with no valid fields (400)', async () => {
    const req = makeReq('PATCH', { week: '1', day: 'A' }, {});
    const result = await handlers.get('patchDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('No valid fields');
  });
});

describe('DELETE /api/plan/days/:week/:day', () => {
  beforeEach(async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
  });

  it('converts the run day to rest (does not remove it)', async () => {
    const req = makeReq('DELETE', { week: '1', day: 'A' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(200);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const days = plan?.phases[0]?.weeks[0]?.days;
    expect(days).toHaveLength(7); // week still has 7 days
    const day = days?.find((d: any) => d.label === 'A');
    // After deletion, label A slot is converted to rest with empty label
    expect(day).toBeUndefined(); // label A is gone (converted to rest with label '')
    const formerRunDay = days?.[0]; // first slot was the run day
    expect(formerRunDay?.type).toBe('rest');
    expect(formerRunDay?.label).toBe('');
    expect(formerRunDay?.objective).toBeUndefined();
  });

  it('returns 404 when no active plan exists', async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    const req = makeReq('DELETE', { week: '1', day: 'A' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(404);
  });

  it('returns 409 when trying to delete a completed day', async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...validActivePlan,
      phases: [{ ...validActivePlan.phases[0], weeks: [{ weekNumber: 1, days: makeWeekDays({ completed: true }) }] }],
    });

    const req = makeReq('DELETE', { week: '1', day: 'A' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toContain('Cannot remove a completed day');
  });

  it('returns 400 for invalid week number', async () => {
    const req = makeReq('DELETE', { week: 'nan', day: 'A' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(400);
  });

  it('returns 400 for invalid day label', async () => {
    const req = makeReq('DELETE', { week: '1', day: 'Z' });
    const result = await handlers.get('deleteDay')!(req, ctx);
    expect(result.status).toBe(400);
  });
});

describe('POST /api/plan/days', () => {
  beforeEach(async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    await mongoClient.db('running-coach').collection('plans').insertOne({ ...validActivePlan });
  });

  it('pushes a new day into the week and returns 201', async () => {
    const req = makePostReq({ weekNumber: 1, label: 'B', type: 'run', guidelines: 'Recovery run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(201);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const days = plan?.phases[0]?.weeks[0]?.days;
    const newDay = days?.find((d: any) => d.label === 'B');
    expect(newDay?.type).toBe('run');
    expect(newDay?.guidelines).toBe('Recovery run');
  });

  it('sets objective when provided', async () => {
    const req = makePostReq({ weekNumber: 1, label: 'B', type: 'run', guidelines: 'Long run', objective_kind: 'distance', objective_value: '10', objective_unit: 'km' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(201);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const newDay = plan?.phases[0]?.weeks[0]?.days?.find((d: any) => d.label === 'B');
    expect(newDay?.objective?.value).toBe(10);
    expect(newDay?.objective?.unit).toBe('km');
  });

  it('returns 409 when the label already exists in that week', async () => {
    // Label 'A' already exists in week 1 from the fixture
    const req = makePostReq({ weekNumber: 1, label: 'A', type: 'run', guidelines: 'Duplicate' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(409);
    expect(result.jsonBody.error).toContain('already exists');
  });

  it('returns 404 when the week number does not exist', async () => {
    const req = makePostReq({ weekNumber: 99, label: 'B', type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(404);
    expect(result.jsonBody.error).toContain('Week 99 not found');
  });

  it('returns 400 when weekNumber, label or type missing', async () => {
    const req = makePostReq({ type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(400);
  });

  it('returns 400 for invalid label', async () => {
    const req = makePostReq({ weekNumber: 1, label: 'Z', type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('label must be a single uppercase letter A-G');
  });

  it('returns 400 for invalid type', async () => {
    const req = makePostReq({ weekNumber: 1, label: 'B', type: 'swim' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('type must be run or cross-train');
  });

  it('returns 404 when no active plan exists', async () => {
    await mongoClient.db('running-coach').collection('plans').deleteMany({});
    const req = makePostReq({ weekNumber: 1, label: 'B', type: 'run' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(404);
  });

  it('allows adding a day with completed=true', async () => {
    const req = makePostReq({ weekNumber: 1, label: 'B', type: 'run', completed: 'true' });
    const result = await handlers.get('addDay')!(req, ctx);
    expect(result.status).toBe(201);

    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const newDay = plan?.phases[0]?.weeks[0]?.days?.find((d: any) => d.label === 'B');
    expect(newDay?.completed).toBe(true);
  });
});
