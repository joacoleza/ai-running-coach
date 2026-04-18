import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { _resetDbForTest } from '../shared/db.js';

// Capture Azure Functions HTTP handlers before messages.ts is imported
const handlers = vi.hoisted(() => new Map<string, (req: any, ctx: any) => Promise<any>>());

// Two distinct test user IDs — hoisted so they're available in vi.mock factory
const USER_A_ID = vi.hoisted(() => 'aaaaaaaaaaaaaaaaaaaaaaaa');
const USER_B_ID = vi.hoisted(() => 'bbbbbbbbbbbbbbbbbbbbbbbb');

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

// Default: authenticated as user A
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthContext: vi.fn().mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false }),
}));

// Side-effect import registers getMessages handler
import '../functions/messages.js';
import { HttpRequest } from '@azure/functions';
import { getAuthContext } from '../middleware/auth.js';

const ctx = { log: vi.fn() } as any;

function makeReq(planId?: string): HttpRequest {
  const url = planId
    ? `http://localhost/api/messages?planId=${planId}`
    : 'http://localhost/api/messages';
  return new HttpRequest({
    method: 'GET',
    url,
    headers: { 'x-app-password': 'test-pw' },
  });
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
  await mongoClient.db('running-coach').collection('messages').deleteMany({});
  // Reset auth context to user A for each test
  vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
});

const USER_A_OID = new ObjectId(USER_A_ID);
const USER_B_OID = new ObjectId(USER_B_ID);

describe('GET /api/messages — data isolation', () => {
  it('user B cannot read user A messages for a plan — returns empty array', async () => {
    const db = mongoClient.db('running-coach');
    const planIdA = new ObjectId().toString();

    // Insert messages for user A and planIdA
    await db.collection('messages').insertMany([
      { planId: planIdA, role: 'user', content: 'first message', timestamp: new Date('2026-04-07T10:00:00Z'), userId: USER_A_OID },
      { planId: planIdA, role: 'assistant', content: 'second message', timestamp: new Date('2026-04-07T10:01:00Z'), userId: USER_A_OID },
    ]);

    // Request messages as user B for the same planId
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_B_ID, email: 'b@test.com', isAdmin: false });
    const req = makeReq(planIdA);
    const result = await handlers.get('getMessages')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.messages).toHaveLength(0);
  });

  it('user A can read their own messages for a plan', async () => {
    const db = mongoClient.db('running-coach');
    const planIdA = new ObjectId().toString();

    // Insert messages for user A and planIdA
    await db.collection('messages').insertMany([
      { planId: planIdA, role: 'user', content: 'first message', timestamp: new Date('2026-04-07T10:00:00Z'), userId: USER_A_OID },
      { planId: planIdA, role: 'assistant', content: 'second message', timestamp: new Date('2026-04-07T10:01:00Z'), userId: USER_A_OID },
    ]);

    // Request messages as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq(planIdA);
    const result = await handlers.get('getMessages')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.messages).toHaveLength(2);
    expect(result.jsonBody.messages[0].content).toBe('first message');
    expect(result.jsonBody.messages[1].content).toBe('second message');
  });

  it('user A cannot see messages for same planId that belong to user B', async () => {
    const db = mongoClient.db('running-coach');
    const planId = new ObjectId().toString();

    // Insert messages for user B and planId
    await db.collection('messages').insertMany([
      { planId, role: 'user', content: 'user B message', timestamp: new Date('2026-04-07T10:00:00Z'), userId: USER_B_OID },
    ]);

    // Request messages as user A for the same planId
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq(planId);
    const result = await handlers.get('getMessages')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.messages).toHaveLength(0);
  });

  it('messages are filtered by both planId AND userId', async () => {
    const db = mongoClient.db('running-coach');
    const planIdA = new ObjectId().toString();
    const planIdB = new ObjectId().toString();

    // Insert messages for user A across two plans
    await db.collection('messages').insertMany([
      { planId: planIdA, role: 'user', content: 'plan A message', timestamp: new Date('2026-04-07T10:00:00Z'), userId: USER_A_OID },
      { planId: planIdB, role: 'assistant', content: 'plan B message', timestamp: new Date('2026-04-07T10:01:00Z'), userId: USER_A_OID },
    ]);

    // Also insert message for user B on plan A (should not be visible)
    await db.collection('messages').insertOne({
      planId: planIdA,
      role: 'user',
      content: 'user B on plan A',
      timestamp: new Date('2026-04-07T10:02:00Z'),
      userId: USER_B_OID,
    });

    // Request messages for planIdA as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq(planIdA);
    const result = await handlers.get('getMessages')!(req, ctx);

    expect(result.status).toBe(200);
    // Should only see user A's message for planIdA (1 message)
    expect(result.jsonBody.messages).toHaveLength(1);
    expect(result.jsonBody.messages[0].content).toBe('plan A message');
    expect(result.jsonBody.messages[0].userId.toString()).toBe(USER_A_ID);
  });

  it('messages are sorted by timestamp in ascending order', async () => {
    const db = mongoClient.db('running-coach');
    const planId = new ObjectId().toString();

    // Insert messages out of order
    await db.collection('messages').insertMany([
      { planId, role: 'assistant', content: 'third', timestamp: new Date('2026-04-07T10:02:00Z'), userId: USER_A_OID },
      { planId, role: 'user', content: 'first', timestamp: new Date('2026-04-07T10:00:00Z'), userId: USER_A_OID },
      { planId, role: 'assistant', content: 'second', timestamp: new Date('2026-04-07T10:01:00Z'), userId: USER_A_OID },
    ]);

    // Request messages as user A
    vi.mocked(getAuthContext).mockReturnValue({ userId: USER_A_ID, email: 'a@test.com', isAdmin: false });
    const req = makeReq(planId);
    const result = await handlers.get('getMessages')!(req, ctx);

    expect(result.status).toBe(200);
    expect(result.jsonBody.messages).toHaveLength(3);
    expect(result.jsonBody.messages[0].content).toBe('first');
    expect(result.jsonBody.messages[1].content).toBe('second');
    expect(result.jsonBody.messages[2].content).toBe('third');
  });
});
