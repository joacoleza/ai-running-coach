import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient, ObjectId } from 'mongodb'
import { HttpRequest } from '@azure/functions'

let mongod: MongoMemoryServer
let uri: string

let requirePassword: typeof import('../middleware/auth.js').requirePassword
let _resetConnectionForTest: typeof import('../middleware/auth.js')._resetConnectionForTest

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  uri = mongod.getUri()
  process.env.MONGODB_CONNECTION_STRING = uri
  process.env.APP_PASSWORD = 'correct-pw'
}, 30_000)

afterAll(async () => {
  await mongod.stop()
}, 30_000)

beforeEach(async () => {
  // Clear the auth collection between tests using a direct client
  const assertClient = new MongoClient(uri)
  await assertClient.connect()
  await assertClient.db('running-coach').collection('auth').deleteMany({})
  await assertClient.close()

  // Reset the module-level singleton in auth.ts so it reconnects fresh
  vi.resetModules()
  const auth = await import('../middleware/auth.js')
  requirePassword = auth.requirePassword
  _resetConnectionForTest = auth._resetConnectionForTest
  _resetConnectionForTest()
})

function makeRequest(password?: string): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: 'http://localhost/api/test',
    headers: password ? { 'x-app-password': password } : {},
  })
}

async function getAuthDoc(): Promise<Record<string, unknown> | null> {
  const assertClient = new MongoClient(uri)
  await assertClient.connect()
  const doc = await assertClient
    .db('running-coach')
    .collection('auth')
    .findOne({ _id: 'lockout' as unknown as ObjectId })
  await assertClient.close()
  return doc as Record<string, unknown> | null
}

describe('lockout integration tests (real MongoDB via mongodb-memory-server)', () => {
  it('Test 7: Wrong password increments failureCount to 1 in auth collection', async () => {
    await requirePassword(makeRequest('wrong-pw'))

    const doc = await getAuthDoc()
    expect(doc?.failureCount).toBe(1)
  })

  it('Test 8: 3 wrong passwords set failureCount to 3 in auth collection', async () => {
    await requirePassword(makeRequest('wrong-pw'))
    await requirePassword(makeRequest('wrong-pw'))
    await requirePassword(makeRequest('wrong-pw'))

    const doc = await getAuthDoc()
    expect(doc?.failureCount).toBe(3)
  })

  it('Test 9: 30 wrong passwords set blocked=true in auth collection', async () => {
    for (let i = 0; i < 30; i++) {
      await requirePassword(makeRequest('wrong-pw'))
    }

    const doc = await getAuthDoc()
    expect(doc?.blocked).toBe(true)
    expect(doc?.failureCount).toBe(30)
  }, 30_000)

  it('Test 10: Correct password resets failureCount to 0 and blocked to false', async () => {
    // First do some wrong attempts
    await requirePassword(makeRequest('wrong-pw'))
    await requirePassword(makeRequest('wrong-pw'))

    // Now correct password
    const result = await requirePassword(makeRequest('correct-pw'))
    expect(result).toBeNull()

    const doc = await getAuthDoc()
    expect(doc?.failureCount).toBe(0)
    expect(doc?.blocked).toBe(false)
  })

  it('Test 11: When blocked=true, even correct password returns 503 (blocked check runs first)', async () => {
    // Manually insert a blocked lockout document
    const setupClient = new MongoClient(uri)
    await setupClient.connect()
    await setupClient
      .db('running-coach')
      .collection('auth')
      .insertOne({
        _id: 'lockout' as unknown as ObjectId,
        blocked: true,
        failureCount: 30,
      })
    await setupClient.close()

    const result = await requirePassword(makeRequest('correct-pw'))
    expect(result?.status).toBe(503)
  })
})
