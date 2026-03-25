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

// Side-effect import registers patchDay handler
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

const validActivePlan = {
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 6,
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
  phases: [
    {
      name: 'Base Building',
      description: 'Build aerobic base',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-04-07',
          days: [
            {
              date: '2026-04-07',
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

  it('does not update guidelines for a completed day (completed day guard via arrayFilters)', async () => {
    // Insert an active plan with a completed day
    const originalGuidelines = 'Original guidelines - must not change';
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
                  guidelines: originalGuidelines,
                  completed: true, // already completed
                },
              ],
            },
          ],
        },
      ],
    });

    const req = makeReq('PATCH', { date: '2026-04-07' }, { guidelines: 'New guidelines attempt' });
    await handlers.get('patchDay')!(req, ctx);

    // Verify the day was NOT actually updated in the DB (arrayFilters guard works)
    const plan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'active' });
    const day = plan?.phases[0]?.weeks[0]?.days[0];
    expect(day?.guidelines).toBe(originalGuidelines);
    expect(day?.completed).toBe(true);
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
});
