import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock is called
const {
  mockUsersCollection,
  mockRefreshTokensCollection,
  mockBcryptCompare,
  mockJwtSign,
} = vi.hoisted(() => {
  const mockUsersCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  }
  const mockRefreshTokensCollection = {
    findOne: vi.fn(),
    insertOne: vi.fn(),
    deleteOne: vi.fn(),
  }
  return {
    mockUsersCollection,
    mockRefreshTokensCollection,
    mockBcryptCompare: vi.fn(),
    mockJwtSign: vi.fn(),
  }
})

// Mock getDb
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn((name: string) => {
      if (name === 'users') return mockUsersCollection
      if (name === 'refresh_tokens') return mockRefreshTokensCollection
      return {}
    }),
  }),
}))

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: vi.fn(),
  },
}))

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args: unknown[]) => mockJwtSign(...args),
    verify: vi.fn(),
  },
}))

// Mock requireAuth from middleware/auth.ts
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))

// Import module AFTER mocks
import '../functions/auth.js'

function makePostRequest(body: unknown): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/login',
    headers: { 'content-type': 'application/json' },
    body: { string: JSON.stringify(body) },
  })
}

describe('Login rate limiting — brute-force protection', () => {
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
    mockUsersCollection.findOne.mockResolvedValue(null)
    mockUsersCollection.updateOne.mockResolvedValue({})
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    mockBcryptCompare.mockResolvedValue(false)
    mockJwtSign.mockReturnValue('mock.jwt.token')
  })

  // ───────────────────────────────────────────
  // Timing mitigation (email not found path)
  // ───────────────────────────────────────────

  it('Test RL-1: runs bcrypt.compare against DUMMY_HASH when email is not found (timing mitigation)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(null)
    const req = makePostRequest({ email: 'nosuchuser@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    // Should still return 401
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
    // bcrypt.compare MUST have been called (timing mitigation)
    expect(mockBcryptCompare).toHaveBeenCalledTimes(1)
    // The second argument must be the DUMMY_HASH (starts with $2b$10$)
    const [, hashArg] = mockBcryptCompare.mock.calls[0]
    expect(hashArg).toMatch(/^\$2b\$10\$/)
  })

  // ───────────────────────────────────────────
  // Pre-lockout warnings (attempts 1-4)
  // ───────────────────────────────────────────

  it('Test RL-2: attempt 1 returns 401 with "4 attempts remaining" warning', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    // User has no prior failures (failedLoginAttempts missing)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    const error = (result.jsonBody as { error: string }).error
    expect(error).toContain('4 attempts remaining before account lockout')
  })

  it('Test RL-3: attempt 4 returns 401 with "1 attempt remaining" (singular)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    // User has already failed 3 times
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 3 })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    const error = (result.jsonBody as { error: string }).error
    // Should use singular "attempt" not "attempts"
    expect(error).toContain('1 attempt remaining before account lockout')
    expect(error).not.toContain('1 attempts')
  })

  it('Test RL-4: failed attempt increments failedLoginAttempts via $set', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 2 })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    await handler(req, {} as never)
    // Should increment to 3
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { _id: validUserId },
      expect.objectContaining({ $set: expect.objectContaining({ failedLoginAttempts: 3 }) }),
    )
  })

  // ───────────────────────────────────────────
  // Lockout trigger (5th failed attempt)
  // ───────────────────────────────────────────

  it('Test RL-5: 5th failed attempt returns 429 with Retry-After header', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    // User already failed 4 times → next failure triggers lockout
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 4 })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    expect(result.headers?.['Retry-After']).toBeDefined()
    const retryAfter = Number(result.headers?.['Retry-After'])
    expect(retryAfter).toBeGreaterThan(0)
    const error = (result.jsonBody as { error: string }).error
    expect(error).toContain('Account locked')
  })

  it('Test RL-6: first lockout sets lockedUntil to ~15 minutes from now', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 4 })
    mockBcryptCompare.mockResolvedValue(false)
    const before = Date.now()
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    await handler(req, {} as never)
    const after = Date.now()
    // Check that updateOne was called with lockedUntil ~15 minutes ahead
    const call = mockUsersCollection.updateOne.mock.calls[0]
    const setPayload = call[1].$set
    const lockedUntilMs = setPayload.lockedUntil.getTime()
    const expectedMin = before + 15 * 60 * 1000
    const expectedMax = after + 15 * 60 * 1000
    expect(lockedUntilMs).toBeGreaterThanOrEqual(expectedMin - 1000)
    expect(lockedUntilMs).toBeLessThanOrEqual(expectedMax + 1000)
    // lockoutCount should be 1 (first lockout)
    expect(setPayload.lockoutCount).toBe(1)
    // failedLoginAttempts should be reset to 0
    expect(setPayload.failedLoginAttempts).toBe(0)
  })

  it('Test RL-7: second lockout sets lockedUntil to ~30 minutes (progressive doubling)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    // lockoutCount: 1 means user was already locked once; next lockout doubles to 30m
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 4, lockoutCount: 1 })
    mockBcryptCompare.mockResolvedValue(false)
    const before = Date.now()
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    await handler(req, {} as never)
    const after = Date.now()
    const call = mockUsersCollection.updateOne.mock.calls[0]
    const setPayload = call[1].$set
    const lockedUntilMs = setPayload.lockedUntil.getTime()
    // 30 minutes
    const expectedMin = before + 30 * 60 * 1000
    const expectedMax = after + 30 * 60 * 1000
    expect(lockedUntilMs).toBeGreaterThanOrEqual(expectedMin - 1000)
    expect(lockedUntilMs).toBeLessThanOrEqual(expectedMax + 1000)
    expect(setPayload.lockoutCount).toBe(2)
  })

  it('Test RL-8: lockout duration is capped at 1440 minutes (24 hours)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    // lockoutCount: 10 → uncapped would be 15 * 2^10 = 15360 min; should cap at 1440
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 4, lockoutCount: 10 })
    mockBcryptCompare.mockResolvedValue(false)
    const before = Date.now()
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    await handler(req, {} as never)
    const after = Date.now()
    const call = mockUsersCollection.updateOne.mock.calls[0]
    const setPayload = call[1].$set
    const lockedUntilMs = setPayload.lockedUntil.getTime()
    // 1440 minutes = 24 hours
    const expectedMin = before + 1440 * 60 * 1000
    const expectedMax = after + 1440 * 60 * 1000
    expect(lockedUntilMs).toBeGreaterThanOrEqual(expectedMin - 1000)
    expect(lockedUntilMs).toBeLessThanOrEqual(expectedMax + 1000)
  })

  // ───────────────────────────────────────────
  // Active lockout: rejecting attempts while locked
  // ───────────────────────────────────────────

  it('Test RL-9: returns 429 immediately when account is currently locked', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const futureDate = new Date(Date.now() + 10 * 60 * 1000) // locked for 10 more minutes
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: futureDate, lockoutCount: 1 })
    const req = makePostRequest({ email: 'user@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    expect(result.headers?.['Retry-After']).toBeDefined()
    const error = (result.jsonBody as { error: string }).error
    expect(error).toContain('Account locked')
  })

  it('Test RL-10: attempts during lockout do NOT call bcrypt or increment failedLoginAttempts', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const futureDate = new Date(Date.now() + 10 * 60 * 1000)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: futureDate, lockoutCount: 1 })
    const req = makePostRequest({ email: 'user@example.com', password: 'anypassword' })
    await handler(req, {} as never)
    // Must NOT call bcrypt.compare (short-circuit before password check)
    expect(mockBcryptCompare).not.toHaveBeenCalled()
    // Must NOT call updateOne (no counter increment)
    expect(mockUsersCollection.updateOne).not.toHaveBeenCalled()
  })

  it('Test RL-11: returns 200 (not 429) when lockout window has expired', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const pastDate = new Date(Date.now() - 1000) // expired 1 second ago
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: pastDate, lockoutCount: 1 })
    mockBcryptCompare.mockResolvedValue(true) // correct password this time
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
  })

  // ───────────────────────────────────────────
  // Successful login resets counters
  // ───────────────────────────────────────────

  it('Test RL-12: successful login resets failedLoginAttempts and lockoutCount to 0', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    // User has some prior failures but password is correct this time
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 3, lockoutCount: 1 })
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    await handler(req, {} as never)
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { _id: validUserId },
      expect.objectContaining({
        $set: expect.objectContaining({
          failedLoginAttempts: 0,
          lockoutCount: 0,
          lastLoginAt: expect.any(Date),
        }),
      }),
    )
  })

  it('Test RL-13: Retry-After header on active lockout matches remaining seconds', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const remainingMs = 8 * 60 * 1000 // 8 minutes
    const futureDate = new Date(Date.now() + remainingMs)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: futureDate, lockoutCount: 1 })
    const req = makePostRequest({ email: 'user@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    const retryAfter = Number(result.headers?.['Retry-After'])
    // Should be approximately 480 seconds (8 minutes), allow 2s tolerance
    expect(retryAfter).toBeGreaterThanOrEqual(478)
    expect(retryAfter).toBeLessThanOrEqual(482)
  })
})
