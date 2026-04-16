/**
 * AUTH-03: POST /api/auth/login response must include tempPassword boolean
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock
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
    hash: vi.fn().mockResolvedValue('$2b$10$hash'),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args: unknown[]) => mockJwtSign(...args),
    verify: vi.fn().mockReturnValue({ sub: 'user-id' }),
  },
}))

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn().mockResolvedValue(null),
}))

import { getLoginHandler } from '../functions/auth.js'

function makeLoginRequest(email: string, password: string): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/login',
    headers: { 'content-type': 'application/json' },
    body: { string: JSON.stringify({ email, password }) },
  })
}

describe('POST /api/auth/login — tempPassword field in response', () => {
  const userId = new ObjectId()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'
    mockBcryptCompare.mockResolvedValue(true)
    mockJwtSign.mockReturnValue('mock.jwt.token')
    mockUsersCollection.updateOne.mockResolvedValue({})
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
  })

  it('login response includes tempPassword: false for a normal user', async () => {
    mockUsersCollection.findOne.mockResolvedValue({
      _id: userId,
      email: 'user@example.com',
      passwordHash: '$2b$12$hash',
      isAdmin: false,
      tempPassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const handler = getLoginHandler()
    const req = makeLoginRequest('user@example.com', 'password123')
    const result = await handler(req, {} as never)

    expect(result.status).toBe(200)
    const body = result.jsonBody as { token: string; refreshToken: string; expiresIn: number; tempPassword: boolean }
    expect(body.tempPassword).toBe(false)
  })

  it('login response includes tempPassword: true for a temp-password user', async () => {
    mockUsersCollection.findOne.mockResolvedValue({
      _id: userId,
      email: 'temp@example.com',
      passwordHash: '$2b$12$hash',
      isAdmin: false,
      tempPassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const handler = getLoginHandler()
    const req = makeLoginRequest('temp@example.com', 'password123')
    const result = await handler(req, {} as never)

    expect(result.status).toBe(200)
    const body = result.jsonBody as { token: string; refreshToken: string; expiresIn: number; tempPassword: boolean }
    expect(body.tempPassword).toBe(true)
  })
})
