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

vi.mock('../middleware/auth.js', () => ({
  requirePassword: vi.fn().mockResolvedValue(null),
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

const basePlan = {
  onboardingMode: 'conversational',
  onboardingStep: 6,
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
  phases: [],
  objective: '10km',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('POST /api/plan/archive', () => {
  it('archives active plan and returns 200', async () => {
    await mongoClient.db('running-coach').collection('plans').insertOne({
      ...basePlan,
      status: 'active',
    });

    const req = makeReq('POST', 'http://localhost/api/plan/archive');
    const result = await handlers.get('archivePlan')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan.status).toBe('archived');
  });

  it('returns 404 when no active plan to archive', async () => {
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
  it('returns single archived plan by id', async () => {
    const insertResult = await mongoClient.db('running-coach').collection('plans').insertOne({
      ...basePlan,
      status: 'archived',
    });
    const id = insertResult.insertedId.toString();

    const req = makeReqWithParams('GET', `http://localhost/api/plans/archived/${id}`, { id });
    const result = await handlers.get('getArchivedPlan')!(req, ctx);
    expect(result.status).toBe(200);
    expect(result.jsonBody.plan).toBeDefined();
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
