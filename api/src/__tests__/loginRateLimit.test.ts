import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

const {
  mockUsersCollection,
  mockRefreshTokensCollection,
  mockBcryptCompare,
  mockJwtSign,
} = vi.hoisted(() => {
  return {
    mockUsersCollection: { findOne: vi.fn(), updateOne: vi.fn() },
    mockRefreshTokensCollection: { findOne: vi.fn(), insertOne: vi.fn() },
    mockBcryptCompare: vi.fn(),
    mockJwtSign: vi.fn(),
  }
})

vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn((name: string) => {
      if (name === 'users') return mockUsersCollection
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

function makePostRequest(body: unknown): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/login',
    headers: { 'content-type': 'application/json' },
    body: { string: JSON.stringify(body) },
  })
}

describe('Login rate limiting', () => {
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
    // failedLoginAttempts, lockedUntil, lockoutCount absent = 0 / unlocked / 0
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'
    mockUsersCollection.findOne.mockResolvedValue(null)
    mockUsersCollection.updateOne.mockResolvedValue({ modifiedCount: 1 })
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    mockBcryptCompare.mockResolvedValue(false)
    mockJwtSign.mockReturnValue('mock.jwt.token')
  })

  it('Test 1: email not found — returns 401, bcrypt.compare called once against DUMMY_HASH (timing mitigation)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(null)
    const req = makePostRequest({ email: 'nosuchuser@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
    expect(mockBcryptCompare).toHaveBeenCalledTimes(1)
    const [, hashArg] = mockBcryptCompare.mock.calls[0]
    // Second argument must be DUMMY_HASH (starts with $2b$10$)
    expect(hashArg).toMatch(/^\$2b\$10\$/)
  })

  it('Test 2: first wrong password — returns 401 with "4 attempts remaining", updateOne sets failedLoginAttempts: 1', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    const error = (result.jsonBody as { error: string }).error
    expect(error).toContain('4 attempts remaining before account lockout')
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { _id: validUserId },
      expect.objectContaining({ $set: expect.objectContaining({ failedLoginAttempts: 1 }) }),
    )
  })

  it('Test 3: fourth wrong password (failedLoginAttempts: 3) — returns 401 with "1 attempt remaining" (singular)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 3 })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    const error = (result.jsonBody as { error: string }).error
    expect(error).toContain('1 attempt remaining before account lockout')
    expect(error).not.toContain('1 attempts')
  })

  it('Test 4: fifth wrong password (failedLoginAttempts: 4) triggers lockout — returns 429 with Retry-After, updateOne sets lockedUntil + lockoutCount: 1 + failedLoginAttempts: 0', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 4 })
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    expect(result.headers?.['Retry-After']).toBeDefined()
    expect((result.jsonBody as { error: string }).error).toContain('Account locked')
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { _id: validUserId },
      expect.objectContaining({
        $set: expect.objectContaining({
          lockedUntil: expect.any(Date),
          lockoutCount: 1,
          failedLoginAttempts: 0,
        }),
      }),
    )
  })

  it('Test 5: progressive escalation — lockoutCount: 1 triggers second lockout → lockoutCount becomes 2, duration ~30 min', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
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
    expect(lockedUntilMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 1000)
    expect(lockedUntilMs).toBeLessThanOrEqual(after + 30 * 60 * 1000 + 1000)
    expect(setPayload.lockoutCount).toBe(2)
  })

  it('Test 6: account already locked (lockedUntil in future) — returns 429 immediately, updateOne NOT called, bcrypt.compare NOT called', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const futureDate = new Date(Date.now() + 10 * 60 * 1000)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: futureDate, lockoutCount: 1 })
    const req = makePostRequest({ email: 'user@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    expect(mockUsersCollection.updateOne).not.toHaveBeenCalled()
    expect(mockBcryptCompare).not.toHaveBeenCalled()
  })

  it('Test 7: lockout window expired (lockedUntil in past) — treated as unlocked, proceeds to credential check normally', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const pastDate = new Date(Date.now() - 1000)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: pastDate, lockoutCount: 1 })
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
  })

  it('Test 8: successful login resets failedLoginAttempts: 0 and lockoutCount: 0', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
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

  it('Test 9: successful login on user with prior failed attempts — returns 200', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, failedLoginAttempts: 2 })
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
  })

  it('Test 10: locked account 429 body contains "Account locked. Try again in" and minutes value', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const remainingMs = 8 * 60 * 1000 // 8 minutes
    const futureDate = new Date(Date.now() + remainingMs)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: futureDate, lockoutCount: 1 })
    const req = makePostRequest({ email: 'user@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(429)
    const error = (result.jsonBody as { error: string }).error
    expect(error).toContain('Account locked. Try again in')
    expect(error).toMatch(/\d+ minutes/)
  })

  it('Test 11: locked account Retry-After header is a positive integer string (seconds)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const remainingMs = 8 * 60 * 1000
    const futureDate = new Date(Date.now() + remainingMs)
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, lockedUntil: futureDate, lockoutCount: 1 })
    const req = makePostRequest({ email: 'user@example.com', password: 'anypassword' })
    const result = await handler(req, {} as never)
    const headers = result.headers as Record<string, string>
    expect(headers['Retry-After']).toMatch(/^\d+$/)
    expect(parseInt(headers['Retry-After'])).toBeGreaterThan(0)
  })

  it('Test 12: deactivated account returns 401 "Invalid credentials" (not affected by rate limiting)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...baseUser, active: false })
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
    // Should NOT return 429 (rate limiting should not affect deactivated accounts)
    expect(result.status).not.toBe(429)
  })
})
