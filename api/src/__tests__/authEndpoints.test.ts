import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock is called
const {
  mockUsersCollection,
  mockRefreshTokensCollection,
  mockBcryptCompare,
  mockJwtSign,
  mockJwtVerify,
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
    mockJwtVerify: vi.fn(),
  }
})

// Mock getDb
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn((name: string) => {
      if (name === 'users') return mockUsersCollection
      if (name === 'refresh_tokens') return mockRefreshTokensCollection
      if (name === 'login_attempts') return { findOne: vi.fn().mockResolvedValue(null), updateOne: vi.fn().mockResolvedValue({ upsertedCount: 1 }) }
      return {}
    }),
  }),
}))

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
  },
}))

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args: unknown[]) => mockJwtSign(...args),
    verify: (...args: unknown[]) => mockJwtVerify(...args),
  },
}))

// Mock requireAuth from middleware/auth.ts
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))

// Import the functions module AFTER mocks are set up
// This will trigger registration of app.http handlers
import '../functions/auth.js'
import { requireAuth } from '../middleware/auth.js'

// We need to test via the handlers directly — extract from the Azure Functions app
// Since Azure Functions v4 registers handlers, we need to test the logic directly
// We'll test by calling the module which registers handlers, then extract and invoke them

// Helper to make POST requests
function makePostRequest(body: unknown, headers: Record<string, string> = {}): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/login',
    headers: { 'content-type': 'application/json', ...headers },
    body: { string: JSON.stringify(body) },
  })
}

// We need to re-export handlers for testing — but Azure Functions registers globally
// Instead, let's test the handlers by importing them from the module directly
// The test strategy: we call the handlers extracted from the registered app

describe('POST /api/auth/login', () => {
  const validUserId = new ObjectId()
  const validUser = {
    _id: validUserId,
    email: 'user@example.com',
    passwordHash: '$2b$12$hashed',
    isAdmin: false,
    tempPassword: false,
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

  it('Test 1: returns 400 when email is missing', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const req = makePostRequest({ password: 'secret' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(400)
    expect((result.jsonBody as { error: string }).error).toContain('required')
  })

  it('Test 2: returns 400 when password is missing', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    const req = makePostRequest({ email: 'user@example.com' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(400)
    expect((result.jsonBody as { error: string }).error).toContain('required')
  })

  it('Test 3: returns 401 when user does not exist', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(null)
    const req = makePostRequest({ email: 'notexist@example.com', password: 'secret' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
  })

  it('Test 4: returns 401 when password is wrong (with rate limiting warning)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(validUser)
    mockBcryptCompare.mockResolvedValue(false)
    const req = makePostRequest({ email: 'user@example.com', password: 'wrongpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toContain('Invalid credentials')
  })

  it('Test 5: returns 200 with token, refreshToken, expiresIn on valid credentials', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(validUser)
    mockBcryptCompare.mockResolvedValue(true)
    mockJwtSign.mockReturnValue('valid.jwt.token')
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as { token: string; refreshToken: string; expiresIn: number }
    expect(body.token).toBe('valid.jwt.token')
    expect(body.refreshToken).toBeDefined()
    expect(body.expiresIn).toBe(900)
  })

  it('Test 6: updates lastLoginAt on successful login', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(validUser)
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    await handler(req, {} as never)
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { _id: validUser._id },
      expect.objectContaining({ $set: expect.objectContaining({ lastLoginAt: expect.any(Date) }) }),
    )
  })

  it('Test 6b: returns 401 when user.active === false (deactivated account)', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue({ ...validUser, active: false })
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid credentials')
  })

  it('Test 7: stores SHA-256 hash of refresh token (not raw) in refresh_tokens', async () => {
    const { getLoginHandler } = await import('../functions/auth.js')
    const handler = getLoginHandler()
    mockUsersCollection.findOne.mockResolvedValue(validUser)
    mockBcryptCompare.mockResolvedValue(true)
    const req = makePostRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)
    const body = result.jsonBody as { refreshToken: string }
    // The insertOne should have been called with tokenHash (not the raw refresh token)
    expect(mockRefreshTokensCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.any(String),
        userId: validUser._id,
        expiresAt: expect.any(Date),
      }),
    )
    // The stored hash should NOT equal the raw token
    const insertCall = mockRefreshTokensCollection.insertOne.mock.calls[0][0]
    expect(insertCall.tokenHash).not.toBe(body.refreshToken)
    // The stored hash should be a SHA-256 hex (64 hex chars)
    expect(insertCall.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('POST /api/auth/refresh', () => {
  const validUserId = new ObjectId()
  const validUser = {
    _id: validUserId,
    email: 'user@example.com',
    passwordHash: '$2b$12$hashed',
    isAdmin: false,
    tempPassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'
    mockUsersCollection.findOne.mockResolvedValue(validUser)
    mockRefreshTokensCollection.findOne.mockResolvedValue(null)
    mockJwtSign.mockReturnValue('new.jwt.token')
  })

  it('Test 8: returns 401 when refreshToken is missing', async () => {
    const { getRefreshHandler } = await import('../functions/auth.js')
    const handler = getRefreshHandler()
    const req = makePostRequest({})
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
  })

  it('Test 9: returns 401 when refresh token is not found in DB', async () => {
    const { getRefreshHandler } = await import('../functions/auth.js')
    const handler = getRefreshHandler()
    mockRefreshTokensCollection.findOne.mockResolvedValue(null)
    const req = makePostRequest({ refreshToken: 'invalid-token' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
  })

  it('Test 10: returns 401 when refresh token is expired', async () => {
    const { getRefreshHandler } = await import('../functions/auth.js')
    const handler = getRefreshHandler()
    mockRefreshTokensCollection.findOne.mockResolvedValue({
      _id: new ObjectId(),
      userId: validUserId,
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() - 1000), // expired
    })
    const req = makePostRequest({ refreshToken: 'expired-token' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
  })

  it('Test 11: returns 200 with new token on valid refresh token', async () => {
    const { getRefreshHandler } = await import('../functions/auth.js')
    const handler = getRefreshHandler()
    mockUsersCollection.updateOne.mockResolvedValue({})
    mockRefreshTokensCollection.findOne.mockResolvedValue({
      _id: new ObjectId(),
      userId: validUserId,
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // valid for 1 hour
    })
    const req = makePostRequest({ refreshToken: 'valid-refresh-token' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as { token: string; expiresIn: number }
    expect(body.token).toBe('new.jwt.token')
    expect(body.expiresIn).toBe(900)
  })

  it('Test 11b: updates lastLoginAt on successful token refresh', async () => {
    const { getRefreshHandler } = await import('../functions/auth.js')
    const handler = getRefreshHandler()
    mockUsersCollection.updateOne.mockResolvedValue({})
    mockRefreshTokensCollection.findOne.mockResolvedValue({
      _id: new ObjectId(),
      userId: validUserId,
      tokenHash: 'somehash',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // valid for 1 hour
    })
    const req = makePostRequest({ refreshToken: 'valid-refresh-token' })
    await handler(req, {} as never)
    // Allow microtask queue to flush (fire-and-forget updateOne)
    await Promise.resolve()
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { _id: validUserId },
      { $set: { lastLoginAt: expect.any(Date) } },
    )
  })
})

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'
    mockRefreshTokensCollection.deleteOne.mockResolvedValue({ deletedCount: 1 })
    vi.mocked(requireAuth).mockResolvedValue(null)
  })

  it('Test 12: returns 401 when no auth token provided', async () => {
    const { getLogoutHandler } = await import('../functions/auth.js')
    const handler = getLogoutHandler()
    vi.mocked(requireAuth).mockResolvedValue({ status: 401, jsonBody: { error: 'Unauthorized' } })
    const req = makePostRequest({})
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
  })

  it('Test 13: returns 204 when valid Bearer token and refreshToken provided', async () => {
    const { getLogoutHandler } = await import('../functions/auth.js')
    const handler = getLogoutHandler()
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makePostRequest({ refreshToken: 'some-token' }, { 'x-authorization': 'Bearer valid.jwt.token' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(204)
  })

  it('Test 14: deletes refresh token from DB on logout', async () => {
    const { getLogoutHandler } = await import('../functions/auth.js')
    const handler = getLogoutHandler()
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makePostRequest({ refreshToken: 'some-raw-token' }, { 'x-authorization': 'Bearer valid.jwt.token' })
    await handler(req, {} as never)
    expect(mockRefreshTokensCollection.deleteOne).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: expect.any(String) }),
    )
  })

  it('Test 15: returns 204 even when no refreshToken in body (best-effort logout)', async () => {
    const { getLogoutHandler } = await import('../functions/auth.js')
    const handler = getLogoutHandler()
    vi.mocked(requireAuth).mockResolvedValue(null)
    const req = makePostRequest({}, { 'x-authorization': 'Bearer valid.jwt.token' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(204)
  })
})
