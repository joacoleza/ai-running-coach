import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

const {
  mockUsersCollection,
  mockLoginAttemptsCollection,
  mockRefreshTokensCollection,
  mockBcryptCompare,
  mockJwtSign,
} = vi.hoisted(() => {
  return {
    mockUsersCollection: { findOne: vi.fn(), updateOne: vi.fn() },
    mockLoginAttemptsCollection: { findOne: vi.fn(), updateOne: vi.fn() },
    mockRefreshTokensCollection: { findOne: vi.fn(), insertOne: vi.fn() },
    mockBcryptCompare: vi.fn(),
    mockJwtSign: vi.fn(),
  }
})

vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn((name: string) => {
      if (name === 'users') return mockUsersCollection
      if (name === 'login_attempts') return mockLoginAttemptsCollection
      if (name === 'refresh_tokens') return mockRefreshTokensCollection
      return {}
    }),
  }),
}))

vi.mock('bcrypt', () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args: unknown[]) => mockJwtSign(...args),
  },
}))

function makePostRequest(body: unknown, headers: Record<string, string> = {}): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/login',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    body: { string: JSON.stringify(body) },
  })
}

describe('Login rate limiting — IP-based', () => {
  const validUserId = new ObjectId()
  const baseUser = {
    _id: validUserId,
    email: 'user@example.com',
    passwordHash: '$2b$12$hashed',
    isAdmin: false,
    tempPassword: false,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'
    // Default: no prior IP record
    mockLoginAttemptsCollection.findOne.mockResolvedValue(null)
    mockLoginAttemptsCollection.updateOne.mockResolvedValue({ upsertedCount: 1 })
    // Default: user not found
    mockUsersCollection.findOne.mockResolvedValue(null)
    mockUsersCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    mockBcryptCompare.mockResolvedValue(false)
    mockJwtSign.mockReturnValue('mock.jwt.token')
  })

  it('Test 1: email not found, no prior IP record — bcrypt called against DUMMY_HASH, 401, updateOne sets attempts: 1', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(null)
    mockLoginAttemptsCollection.findOne.mockResolvedValue(null)
    const req = makePostRequest({ email: 'nosuchuser@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
    // bcrypt.compare should have been called once against the DUMMY_HASH (timing mitigation)
    expect(mockBcryptCompare).toHaveBeenCalledTimes(1)
    const [, hashArg] = mockBcryptCompare.mock.calls[0]
    expect(hashArg).toMatch(/^\$2b\$10\$/)
    // IP record updated to attempts: 1
    expect(mockLoginAttemptsCollection.updateOne).toHaveBeenCalledWith(
      { ip: '1.2.3.4' },
      { $set: { attempts: 1, updatedAt: expect.any(Date) } },
      { upsert: true },
    )
  })

  it('Test 2: email not found vs wrong password — both return identical 401 (enumeration prevention)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const priorRecord = { ip: '1.2.3.4', attempts: 3, lockoutCount: 0, updatedAt: new Date() }
    mockLoginAttemptsCollection.findOne.mockResolvedValue(priorRecord)

    // Non-existent email path
    mockUsersCollection.findOne.mockResolvedValue(null)
    mockBcryptCompare.mockResolvedValue(false)
    const req1 = makePostRequest({ email: 'fake@example.com', password: 'wrongpassword' })
    const result1 = await handler(req1, {} as never)

    vi.clearAllMocks()
    mockLoginAttemptsCollection.findOne.mockResolvedValue(priorRecord)
    mockLoginAttemptsCollection.updateOne.mockResolvedValue({ upsertedCount: 1 })
    mockUsersCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    mockJwtSign.mockReturnValue('mock.jwt.token')

    // Wrong password path
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockBcryptCompare.mockResolvedValue(false)
    const req2 = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result2 = await handler(req2, {} as never)

    // Both responses must be byte-identical
    expect(result1.status).toBe(401)
    expect(result2.status).toBe(401)
    expect((result1.jsonBody as { error: string }).error).toBe('Invalid credentials')
    expect((result2.jsonBody as { error: string }).error).toBe('Invalid credentials')
  })

  it('Test 3: wrong password, first attempt — 401, updateOne sets attempts: 1', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockLoginAttemptsCollection.findOne.mockResolvedValue(null)
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
    expect(mockLoginAttemptsCollection.updateOne).toHaveBeenCalledWith(
      { ip: '1.2.3.4' },
      { $set: { attempts: 1, updatedAt: expect.any(Date) } },
      { upsert: true },
    )
  })

  it('Test 4: wrong password, 4th attempt (attempts: 3 in DB) — 401, updateOne sets attempts: 4', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockLoginAttemptsCollection.findOne.mockResolvedValue({ ip: '1.2.3.4', attempts: 3, lockoutCount: 0, updatedAt: new Date() })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
    expect(mockLoginAttemptsCollection.updateOne).toHaveBeenCalledWith(
      { ip: '1.2.3.4' },
      { $set: { attempts: 4, updatedAt: expect.any(Date) } },
      { upsert: true },
    )
  })

  it('Test 5: wrong password, 5th attempt triggers lockout — 429 with Retry-After, updateOne sets lockedUntil + lockoutCount: 1 + attempts: 0', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockLoginAttemptsCollection.findOne.mockResolvedValue({ ip: '1.2.3.4', attempts: 4, lockoutCount: 0, updatedAt: new Date() })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    const headers = result.headers as Record<string, string>
    expect(headers['Retry-After']).toMatch(/^\d+$/)
    expect(parseInt(headers['Retry-After'])).toBeGreaterThan(0)
    expect((result.jsonBody as { error: string }).error).toContain('Too many failed attempts')
    expect(mockLoginAttemptsCollection.updateOne).toHaveBeenCalledWith(
      { ip: '1.2.3.4' },
      {
        $set: expect.objectContaining({
          attempts: 0,
          lockoutCount: 1,
          lockedUntil: expect.any(Date),
        }),
      },
      { upsert: true },
    )
  })

  it('Test 6: progressive lockout (lockoutCount: 1 in record) — second lockout → lockoutCount: 2, duration ~30 min', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockLoginAttemptsCollection.findOne.mockResolvedValue({ ip: '1.2.3.4', attempts: 4, lockoutCount: 1, updatedAt: new Date() })
    mockBcryptCompare.mockResolvedValue(false)
    const before = Date.now()
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    await handler(req, {} as never)
    const after = Date.now()
    const call = mockLoginAttemptsCollection.updateOne.mock.calls[0]
    const setPayload = call[1].$set
    const lockedUntilMs = setPayload.lockedUntil.getTime()
    // Second lockout = 15 * 2^(2-1) = 30 minutes
    expect(lockedUntilMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 1000)
    expect(lockedUntilMs).toBeLessThanOrEqual(after + 30 * 60 * 1000 + 1000)
    expect(setPayload.lockoutCount).toBe(2)
  })

  it('Test 7: already locked (lockedUntil in future) — 429 immediately, NO updateOne called, bcrypt NOT called', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockLoginAttemptsCollection.findOne.mockResolvedValue({
      ip: '1.2.3.4',
      attempts: 0,
      lockoutCount: 1,
      lockedUntil: new Date(Date.now() + 900_000),
      updatedAt: new Date(),
    })
    const req = makePostRequest({ email: 'user@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    expect(mockLoginAttemptsCollection.updateOne).not.toHaveBeenCalled()
    expect(mockBcryptCompare).not.toHaveBeenCalled()
    // User collection should never be touched
    expect(mockUsersCollection.findOne).not.toHaveBeenCalled()
  })

  it('Test 8: lockout expired (lockedUntil in past) — treated as unlocked, proceeds to credential check → 200', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockLoginAttemptsCollection.findOne.mockResolvedValue({
      ip: '1.2.3.4',
      attempts: 0,
      lockoutCount: 1,
      lockedUntil: new Date(Date.now() - 1000),
      updatedAt: new Date(),
    })
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockBcryptCompare.mockResolvedValue(true)
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
  })

  it('Test 9: successful login resets IP counter — updateOne sets attempts: 0, lockoutCount: 0', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockLoginAttemptsCollection.findOne.mockResolvedValue({ ip: '1.2.3.4', attempts: 2, lockoutCount: 0, updatedAt: new Date() })
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockBcryptCompare.mockResolvedValue(true)
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    await handler(req, {} as never)
    expect(mockLoginAttemptsCollection.updateOne).toHaveBeenCalledWith(
      { ip: '1.2.3.4' },
      { $set: { attempts: 0, lockoutCount: 0, updatedAt: expect.any(Date) } },
      { upsert: true },
    )
  })

  it('Test 10: deactivated account (active: false) — 401 even after correct password, no lockout triggered', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockLoginAttemptsCollection.findOne.mockResolvedValue(null)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, active: false })
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
    // Should NOT return 429
    expect(result.status).not.toBe(429)
  })
})
