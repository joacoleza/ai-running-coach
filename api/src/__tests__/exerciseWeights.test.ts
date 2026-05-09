import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before modules are imported
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

// Side-effect import registers all handlers including getExerciseWeights
import '../functions/runs.js';
import { HttpRequest } from '@azure/functions';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

// ── Request helpers ────────────────────────────────────────────────────────

function makeGetReqWithQuery(baseUrl: string, queryParams: Record<string, string>): HttpRequest {
  const params = new URLSearchParams(queryParams);
  const url = `${baseUrl}?${params.toString()}`;
  return new HttpRequest({ method: 'GET', url, headers: { 'x-app-password': 'test-pw' } });
}

function makeGetReq(url: string): HttpRequest {
  return new HttpRequest({ method: 'GET', url, headers: { 'x-app-password': 'test-pw' } });
}

// ── DB setup ───────────────────────────────────────────────────────────────

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
  await mongoClient.db('ai-training-coach').collection('runs').deleteMany({});
});

// ── Seed helpers ────────────────────────────────────────────────────────────

function makeGymRun(overrides: Partial<any> = {}) {
  return {
    userId: new ObjectId(TEST_USER_ID),
    date: '2026-04-01',
    distance: 0,
    duration: '45:00',
    pace: 0,
    discipline: 'gym',
    exercises: [{ name: 'Squat', sets: 3, reps: 8, weight: 80, unit: 'kg' }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/runs/exercise-weights', () => {
  it('Test 1: Missing ?exercise param → returns 400', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    const req = makeGetReq('http://localhost/api/runs/exercise-weights');
    const res = await handler!(req, ctx);

    expect(res.status).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'exercise query parameter required' });
  });

  it('Test 2: Valid ?exercise=Squat with no gym sessions → returns 200 with empty data array', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    const req = makeGetReqWithQuery('http://localhost/api/runs/exercise-weights', { exercise: 'Squat' });
    const res = await handler!(req, ctx);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({ exercise: 'Squat', data: [] });
  });

  it('Test 3: Gym session with Squat (80kg) on 2026-04-01 → returns data point', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    await mongoClient.db('ai-training-coach').collection('runs').insertOne(makeGymRun());

    const req = makeGetReqWithQuery('http://localhost/api/runs/exercise-weights', { exercise: 'Squat' });
    const res = await handler!(req, ctx);

    expect(res.status).toBe(200);
    expect(res.jsonBody.exercise).toBe('Squat');
    expect(res.jsonBody.data).toHaveLength(1);
    expect(res.jsonBody.data[0]).toEqual({ date: '2026-04-01', maxWeight: 80, unit: 'kg' });
  });

  it('Test 4: Two gym sessions with Squat → separate data points sorted ascending by date', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    await mongoClient.db('ai-training-coach').collection('runs').insertMany([
      makeGymRun({ date: '2026-04-01', exercises: [{ name: 'Squat', sets: 3, reps: 8, weight: 80, unit: 'kg' }] }),
      makeGymRun({ date: '2026-04-08', exercises: [{ name: 'Squat', sets: 3, reps: 8, weight: 90, unit: 'kg' }] }),
    ]);

    const req = makeGetReqWithQuery('http://localhost/api/runs/exercise-weights', { exercise: 'Squat' });
    const res = await handler!(req, ctx);

    expect(res.status).toBe(200);
    expect(res.jsonBody.data).toHaveLength(2);
    expect(res.jsonBody.data[0]).toEqual({ date: '2026-04-01', maxWeight: 80, unit: 'kg' });
    expect(res.jsonBody.data[1]).toEqual({ date: '2026-04-08', maxWeight: 90, unit: 'kg' });
  });

  it('Test 5: Gym session with Squat but no weight set → data array is empty', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    await mongoClient.db('ai-training-coach').collection('runs').insertOne(
      makeGymRun({ exercises: [{ name: 'Squat', sets: 3, reps: 8 }] })
    );

    const req = makeGetReqWithQuery('http://localhost/api/runs/exercise-weights', { exercise: 'Squat' });
    const res = await handler!(req, ctx);

    expect(res.status).toBe(200);
    expect(res.jsonBody.data).toHaveLength(0);
  });

  it('Test 6: Run session (discipline: run) with exercises field populated → NOT returned', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    await mongoClient.db('ai-training-coach').collection('runs').insertOne({
      userId: new ObjectId(TEST_USER_ID),
      date: '2026-04-01',
      distance: 10,
      duration: '60:00',
      pace: 6,
      discipline: 'run',
      exercises: [{ name: 'Squat', sets: 3, reps: 8, weight: 80, unit: 'kg' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeGetReqWithQuery('http://localhost/api/runs/exercise-weights', { exercise: 'Squat' });
    const res = await handler!(req, ctx);

    expect(res.status).toBe(200);
    expect(res.jsonBody.data).toHaveLength(0);
  });

  it('Test 7: Different user\'s gym session with Squat → NOT returned (userId isolation)', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    const otherUserId = '000000000000000000000002';
    await mongoClient.db('ai-training-coach').collection('runs').insertOne({
      userId: new ObjectId(otherUserId),
      date: '2026-04-01',
      distance: 0,
      duration: '45:00',
      pace: 0,
      discipline: 'gym',
      exercises: [{ name: 'Squat', sets: 3, reps: 8, weight: 100, unit: 'kg' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeGetReqWithQuery('http://localhost/api/runs/exercise-weights', { exercise: 'Squat' });
    const res = await handler!(req, ctx);

    expect(res.status).toBe(200);
    expect(res.jsonBody.data).toHaveLength(0);
  });

  it('Test 8: Gym session with multiple exercises, only Squat has weight → returns only Squat data point', async () => {
    const handler = handlers.get('getExerciseWeights');
    expect(handler).toBeDefined();

    await mongoClient.db('ai-training-coach').collection('runs').insertOne(
      makeGymRun({
        exercises: [
          { name: 'Squat', sets: 3, reps: 8, weight: 80, unit: 'kg' },
          { name: 'Push-up', sets: 3, reps: 20 },
          { name: 'Plank', sets: 3, reps: 1 },
        ],
      })
    );

    const req = makeGetReqWithQuery('http://localhost/api/runs/exercise-weights', { exercise: 'Squat' });
    const res = await handler!(req, ctx);

    expect(res.status).toBe(200);
    expect(res.jsonBody.data).toHaveLength(1);
    expect(res.jsonBody.data[0]).toEqual({ date: '2026-04-01', maxWeight: 80, unit: 'kg' });
  });
});
