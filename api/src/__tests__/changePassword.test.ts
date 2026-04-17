import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock is called
const {
  mockUsersCollection,
  mockRefreshTokensCollection,
  mockBcryptHash,
  VALID_USER_ID,
} = vi.hoisted(() => {
  const { ObjectId: OId } = require('mongodb') as typeof import('mongodb')
  const mockUsersCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  }
  const mockRefreshTokensCollection = {
    findOne: vi.fn(),
  }
  return {
    mockUsersCollection,
    mockRefreshTokensCollection,
    mockBcryptHash: vi.fn(),
    VALID_USER_ID: new OId(),
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
    hash: (...args: unknown[]) => mockBcryptHash(...args),
  },
}))

// Mock jsonwebtoken — sign returns a predictable token
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
  },
}))

import { getChangePasswordHandler } from '../functions/auth.js'

const VALID_REFRESH_TOKEN = 'valid-refresh-token-hex'

function makePostRequest(body: unknown): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/change-password',
    headers: { 'content-type': 'application/json' },
    body: { string: JSON.stringify(body) },
  })
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-jwt-secret'
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'

    // Default: refresh token lookup succeeds
    mockRefreshTokensCollection.findOne.mockResolvedValue({
      _id: new ObjectId(),
      userId: VALID_USER_ID,
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60_000),
    })

    // Default: user lookup succeeds
    mockUsersCollection.findOne.mockResolvedValue({
      _id: VALID_USER_ID,
      email: 'test@example.com',
      isAdmin: false,
      passwordHash: '$2b$10$oldhash',
      tempPassword: true,
    })

    // Default: bcrypt.hash returns a fake hash
    mockBcryptHash.mockResolvedValue('$2b$10$hashedpassword')

    // Default: updateOne returns matched and modified
    mockUsersCollection.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
  })

  it('Test 1: returns 200 with token and updates password when refresh token is valid', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass1', refreshToken: VALID_REFRESH_TOKEN })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(200)
    const body = result.jsonBody as { message: string; token: string; refreshToken: string }
    expect(body.message).toBe('Password updated')
    expect(body.token).toBe('mock.jwt.token')
    expect(body.refreshToken).toBe(VALID_REFRESH_TOKEN)
  })

  it('Test 2: bcrypt-hashes the new password and sets tempPassword to false', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass1', refreshToken: VALID_REFRESH_TOKEN })
    await handler(req, {} as never)

    expect(mockBcryptHash).toHaveBeenCalledWith('newpass1', 10)
    expect(mockUsersCollection.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(ObjectId) },
      expect.objectContaining({
        $set: expect.objectContaining({
          passwordHash: '$2b$10$hashedpassword',
          tempPassword: false,
        }),
      }),
    )
  })

  it('Test 3: returns 400 when newPassword is missing', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ refreshToken: VALID_REFRESH_TOKEN })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(400)
    expect((result.jsonBody as { error: string }).error).toBe('newPassword is required')
  })

  it('Test 4: returns 400 when newPassword is shorter than 8 characters', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'short', refreshToken: VALID_REFRESH_TOKEN })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(400)
    expect((result.jsonBody as { error: string }).error).toBe('Password must be at least 8 characters')
  })

  it('Test 5: returns 401 when refreshToken is missing', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass123' })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Refresh token required')
  })

  it('Test 6: returns 401 when refresh token is not found in DB', async () => {
    mockRefreshTokensCollection.findOne.mockResolvedValue(null)

    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass123', refreshToken: 'invalid-token' })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid or expired refresh token')
  })

  it('Test 7: returns 401 when refresh token is expired', async () => {
    mockRefreshTokensCollection.findOne.mockResolvedValue({
      _id: new ObjectId(),
      userId: VALID_USER_ID,
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() - 1000), // expired
    })

    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass123', refreshToken: VALID_REFRESH_TOKEN })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(401)
    expect((result.jsonBody as { error: string }).error).toBe('Invalid or expired refresh token')
  })
})
