import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers
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

// Mock Anthropic SDK to avoid real API calls
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '<training_plan>{"phases":[{"name":"Base","description":"Base","weeks":[{"weekNumber":1,"startDate":"2026-04-07","days":[{"date":"2026-04-07","type":"run","objective":{"kind":"distance","value":5,"unit":"km"},"guidelines":"Easy run","completed":false,"skipped":false}]}]}]}</training_plan>',
          },
        ],
      }),
    },
  })),
}));

// Side-effect import registers importPlan handler
import '../functions/planImport.js';
import { HttpRequest } from '@azure/functions';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

function makeReq(body?: unknown): HttpRequest {
  const req = new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/plan/import',
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
  process.env.ANTHROPIC_API_KEY = 'test-key';
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
  // Clear only stubs (not mocks) between tests to avoid leaking global.fetch stubs
  vi.unstubAllGlobals();
});

describe('POST /api/plan/import', () => {
  it('returns 400 for invalid URL format (not chatgpt.com/share/)', async () => {
    const req = makeReq({ url: 'https://example.com/not-a-chatgpt-url' });
    const result = await handlers.get('importPlan')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('ChatGPT share link');
  });

  it('returns 400 for non-URL string', async () => {
    const req = makeReq({ url: 'not-a-url' });
    const result = await handlers.get('importPlan')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('ChatGPT share link');
  });

  it('returns 400 when extracted text is too short', async () => {
    // Mock global fetch to return minimal HTML (< 200 chars of text)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body>Short.</body></html>'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = makeReq({ url: 'https://chatgpt.com/share/abc123' });
    const result = await handlers.get('importPlan')!(req, ctx);
    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('No training plan content detected');
  });

  it('archives existing active plan before importing', async () => {
    // Insert an active plan
    await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingMode: 'conversational',
      onboardingStep: 6,
      goal: {},
      phases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mock fetch to return sufficient training plan content
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`<html><body>${'Here is a detailed training plan for your marathon. '.repeat(20)}</body></html>`),
    });
    vi.stubGlobal('fetch', mockFetch);

    const req = makeReq({ url: 'https://chatgpt.com/share/abc123' });
    const result = await handlers.get('importPlan')!(req, ctx);

    // The old active plan should now be archived
    const oldPlan = await mongoClient.db('running-coach').collection('plans').findOne({ status: 'archived' });
    expect(oldPlan).not.toBeNull();
    expect(result.status).toBe(201);
  });
});
