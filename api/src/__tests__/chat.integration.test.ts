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
 * Creates a mock Anthropic stream that:
 * - Exposes `on('text', cb)` to register text-chunk listeners
 * - Implements `finalMessage()` which emits text to registered listeners then
 *   resolves with a complete Message object (stop_reason='end_turn').
 *
 * This matches the new tool-use loop in chat.ts which uses:
 *   stream.on('text', cb)
 *   finalMessage = await stream.finalMessage()
 */
function createMockStream(responseText: string) {
  const textListeners: Array<(text: string) => void> = [];

  return {
    on(event: string, cb: (...args: any[]) => void) {
      if (event === 'text') textListeners.push(cb as (text: string) => void);
      return this;
    },
    finalMessage(): Promise<any> {
      return Promise.resolve().then(() => {
        for (const cb of textListeners) cb(responseText);
        return {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: responseText }],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        };
      });
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

const validPlanJson = JSON.stringify({
  goal: { eventType: '5k', targetDate: '2026-06-01', weeklyMileage: 20, availableDays: 3, units: 'km' },
  phases: [
    {
      name: 'Base',
      description: 'Base building',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-04-07',
          days: [
            { date: '2026-04-08', type: 'run', guidelines: 'Easy run', completed: false, skipped: false },
          ],
        },
      ],
    },
  ],
});

function parseSseEvents(raw: string): Record<string, unknown>[] {
  return raw
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => JSON.parse(line.slice(6)) as Record<string, unknown>);
}

describe('Chat - server-side plan saving from <training_plan>', () => {
  it('saves plan to DB and emits planGenerated=true when response contains <training_plan>', async () => {
    const planId = await insertOnboardingPlan();
    const responseText = `Great news! Here is your plan.\n\n<training_plan>${validPlanJson}</training_plan>`;
    mockStream.mockReturnValueOnce(createMockStream(responseText));

    const req = makeReq({ planId, message: 'Create my training plan' });
    const result = await handlers.get('chat')!(req, ctx);
    const streamOutput = await consumeStream(result.body as ReadableStream<Uint8Array>);

    const doneEvent = parseSseEvents(streamOutput).find(p => p.done);
    expect(doneEvent?.planGenerated).toBe(true);

    // Plan saved with active status and correct phases
    const saved = await mongoClient.db('running-coach').collection('plans').findOne({});
    expect(saved?.status).toBe('active');
    expect(saved?.phases).toHaveLength(1);
    expect(saved?.phases[0].name).toBe('Base');
  });

  it('emits planGenerated=false when response has no <training_plan>', async () => {
    const planId = await insertOnboardingPlan();
    mockStream.mockReturnValueOnce(createMockStream('What is your target race?'));

    const req = makeReq({ planId, message: 'Hello' });
    const result = await handlers.get('chat')!(req, ctx);
    const streamOutput = await consumeStream(result.body as ReadableStream<Uint8Array>);

    const doneEvent = parseSseEvents(streamOutput).find(p => p.done);
    expect(doneEvent?.planGenerated).toBe(false);
  });
});

describe('Chat - synthetic plan-state context injection', () => {
  async function insertActivePlanWithPhases() {
    const { insertedId } = await mongoClient.db('running-coach').collection('plans').insertOne({
      status: 'active',
      onboardingStep: 6,
      onboardingMode: 'conversational',
      goal: { eventType: '5k', targetDate: '2026-06-01', weeklyMileage: 20, availableDays: 3, units: 'km' },
      phases: [
        {
          name: 'Base',
          description: '',
          weeks: [
            {
              weekNumber: 1,
              startDate: '2026-04-07',
              days: [
                { date: '2026-04-08', type: 'run', guidelines: 'Easy run 5km', completed: false, skipped: false },
              ],
            },
          ],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return insertedId.toString();
  }

  it('injects synthetic plan-state pair before the user message when plan has phases', async () => {
    const planId = await insertActivePlanWithPhases();
    mockStream.mockReturnValueOnce(createMockStream('Sure, I can help with that!'));

    const req = makeReq({ planId, message: 'Update my Tuesday run', currentDate: '2026-04-06' });
    const result = await handlers.get('chat')!(req, ctx);
    await consumeStream(result.body as ReadableStream<Uint8Array>);

    const callArgs = mockStream.mock.calls[0][0] as { messages: { role: string; content: string }[] };
    const msgs = callArgs.messages;

    // 3 messages: synthetic user (plan state), synthetic assistant (ack), actual user message
    expect(msgs).toHaveLength(3);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toContain('[Current training plan');
    expect(msgs[0].content).toContain('Easy run 5km');
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].content).toContain('Got it');
    expect(msgs[2].role).toBe('user');
    expect(msgs[2].content).toBe('Update my Tuesday run');
  });

  it('does NOT inject synthetic pair when plan has no phases', async () => {
    const planId = await insertOnboardingPlan(); // no phases
    mockStream.mockReturnValueOnce(createMockStream('What is your goal?'));

    const req = makeReq({ planId, message: 'Hello', currentDate: '2026-04-06' });
    const result = await handlers.get('chat')!(req, ctx);
    await consumeStream(result.body as ReadableStream<Uint8Array>);

    const callArgs = mockStream.mock.calls[0][0] as { messages: { role: string; content: string }[] };
    const msgs = callArgs.messages;

    // Only 1 message: the actual user message (no synthetic pair injected)
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('Hello');
  });
});

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
