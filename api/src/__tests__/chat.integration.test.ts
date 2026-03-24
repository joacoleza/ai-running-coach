import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Shared mock for the Anthropic stream — configured per test
const mockStream = vi.hoisted(() => vi.fn());
const handlers = vi.hoisted(() => new Map<string, (req: any, ctx: any) => Promise<any>>());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      stream: mockStream,
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Summary' }],
      }),
    },
  })),
}));

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

// Side-effect import registers chat handler
import '../functions/chat.js';
import { HttpRequest } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';

const ctx = { log: vi.fn(), error: vi.fn() } as any;

/**
 * Creates a mock Anthropic stream emitter that fires text + message events after all
 * three event listeners (text, message, error) have been registered by start().
 *
 * Using Promise microtasks instead of setTimeout avoids a race condition where setTimeout
 * fires during the handler's async database operations (before start() runs).
 */
function createMockStream(responseText: string) {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();

  return {
    on(event: string, cb: (...args: any[]) => void) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(cb);
      // The chat handler registers exactly 3 listeners: 'text', 'message', 'error'.
      // Once all three are registered (i.e. start() has completed), schedule delivery.
      if (listeners.size === 3) {
        Promise.resolve()
          .then(() => {
            // Enqueue the text chunk — controller buffers it for the waiting reader
            for (const textCb of listeners.get('text') ?? []) textCb(responseText);
          })
          .then(() => {
            // Trigger the message handler (async: inserts to DB, closes stream)
            for (const msgCb of listeners.get('message') ?? []) msgCb();
          });
      }
      return this;
    },
  };
}

/** Reads a ReadableStream to completion and returns the concatenated text. */
async function consumeStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) result += decoder.decode(value, { stream: true });
  }
  return result;
}

function makeReq(body?: unknown): HttpRequest {
  const req = new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/chat',
    headers: { 'x-app-password': 'test-pw', 'content-type': 'application/json' },
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
  // Set fake key so handler's ANTHROPIC_API_KEY check passes; real SDK is mocked
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  mongoClient = new MongoClient(mongod.getUri());
  await mongoClient.connect();
}, 30_000);

afterAll(async () => {
  await mongoClient.close();
  _resetDbForTest();
  delete process.env.ANTHROPIC_API_KEY;
  await mongod.stop();
}, 30_000);

beforeEach(async () => {
  _resetDbForTest();
  vi.clearAllMocks();
  vi.mocked(requirePassword).mockResolvedValue(null);
  await mongoClient.db('running-coach').collection('plans').deleteMany({});
  await mongoClient.db('running-coach').collection('messages').deleteMany({});
});

async function insertOnboardingPlan() {
  const { insertedId } = await mongoClient.db('running-coach').collection('plans').insertOne({
    status: 'onboarding',
    onboardingStep: 0,
    onboardingMode: 'conversational',
    goal: {},
    sessions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return insertedId.toString();
}

describe('Chat Integration (COACH-01)', () => {
  it('POST /api/chat saves user message to messages collection', async () => {
    const planId = await insertOnboardingPlan();
    mockStream.mockReturnValueOnce(createMockStream('Hello! What is your goal race?'));

    const req = makeReq({ planId, message: 'I want to start a training plan' });
    const result = await handlers.get('chat')!(req, ctx);
    await consumeStream(result.body as ReadableStream<Uint8Array>);

    const userMsg = await mongoClient
      .db('running-coach')
      .collection('messages')
      .findOne({ planId, role: 'user' });
    expect(userMsg?.content).toBe('I want to start a training plan');
  });

  it('POST /api/chat saves assistant message after stream completes', async () => {
    const planId = await insertOnboardingPlan();
    mockStream.mockReturnValueOnce(createMockStream('What is your target race distance?'));

    const req = makeReq({ planId, message: 'Hello coach' });
    const result = await handlers.get('chat')!(req, ctx);
    await consumeStream(result.body as ReadableStream<Uint8Array>);

    const assistantMsg = await mongoClient
      .db('running-coach')
      .collection('messages')
      .findOne({ planId, role: 'assistant' });
    expect(assistantMsg?.content).toBe('What is your target race distance?');
  });

  it('POST /api/chat returns 400 when planId is missing', async () => {
    const req = makeReq({ message: 'hello' }); // no planId

    const result = await handlers.get('chat')!(req, ctx);

    expect(result.status).toBe(400);
    expect(result.jsonBody.error).toContain('required');
  });

  it('POST /api/chat returns 401 when password is wrong', async () => {
    vi.mocked(requirePassword).mockResolvedValueOnce({ status: 401, jsonBody: { error: 'Unauthorized' } } as any);

    const req = makeReq({ planId: 'any-plan', message: 'hello' });
    const result = await handlers.get('chat')!(req, ctx);

    expect(result.status).toBe(401);
  });
});
