import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock is called
const {
  mockUsersCollection,
  mockBcryptHash,
  mockJwtVerify,
  VALID_USER_ID,
} = vi.hoisted(() => {
  const { ObjectId: OId } = require('mongodb') as typeof import('mongodb')
  const mockUsersCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  }
  return {
    mockUsersCollection,
    mockBcryptHash: vi.fn(),
    mockJwtVerify: vi.fn(),
    VALID_USER_ID: new OId(),
  }
})

// Mock getDb
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn((name: string) => {
      if (name === 'users') return mockUsersCollection
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

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: (...args: unknown[]) => mockJwtVerify(...args),
  },
}))

// Mock requireAuth to return null (authorized) and getAuthContext to return test userId
vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthContext: vi.fn().mockReturnValue({ userId: VALID_USER_ID.toString(), email: 'test@example.com', isAdmin: false }),
}))

import { getChangePasswordHandler } from '../functions/auth.js'
import { requireAuth } from '../middleware/auth.js'

const TEST_SECRET = 'test-jwt-secret'

function makePostRequest(body: unknown, headers: Record<string, string> = {}): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/change-password',
    headers: { 'content-type': 'application/json', ...headers },
    body: { string: JSON.stringify(body) },
  })
}

function makeValidAuthHeader(): string {
  // Use a pre-built JWT-like string; mockJwtVerify will intercept the verify call
  return 'Bearer valid.jwt.token'
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = TEST_SECRET
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'

    // Default: requireAuth succeeds (authorized)
    vi.mocked(requireAuth).mockResolvedValue(null)

    // Default: jwt.verify returns a payload with the test user id
    mockJwtVerify.mockReturnValue({ sub: VALID_USER_ID.toString() })

    // Default: bcrypt.hash returns a fake hash
    mockBcryptHash.mockResolvedValue('$2b$10$hashedpassword')

    // Default: updateOne returns matched and modified
    mockUsersCollection.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 })
  })

  it('Test 1: returns 200 and updates password when token is valid and newPassword >= 8 chars', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass1' }, { authorization: makeValidAuthHeader() })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(200)
    expect((result.jsonBody as { message: string }).message).toBe('Password updated')
  })

  it('Test 2: bcrypt-hashes the new password and sets tempPassword to false', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass1' }, { authorization: makeValidAuthHeader() })
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
    const req = makePostRequest({}, { authorization: makeValidAuthHeader() })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(400)
    expect((result.jsonBody as { error: string }).error).toBe('newPassword is required')
  })

  it('Test 4: returns 400 when newPassword is shorter than 8 characters', async () => {
    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'short' }, { authorization: makeValidAuthHeader() })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(400)
    expect((result.jsonBody as { error: string }).error).toBe('Password must be at least 8 characters')
  })

  it('Test 5: returns 401 when Authorization header is missing', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ status: 401, jsonBody: { error: 'Authorization required' } })

    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass1' })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(401)
  })

  it('Test 6: returns 401 when JWT is invalid or expired', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ status: 401, jsonBody: { error: 'Invalid or expired token' } })

    const handler = getChangePasswordHandler()
    const req = makePostRequest({ newPassword: 'newpass1' }, { authorization: 'Bearer invalid.jwt' })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(401)
  })
})
