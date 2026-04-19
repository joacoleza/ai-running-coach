import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test-jwt-secret'
const VALID_USER_ID = new ObjectId()

// Hoist mock factories before vi.mock is called
const { mockUsersCollection, mockRefreshTokensCollection, mockBcryptCompare } = vi.hoisted(() => {
  const mockUsersCollection = {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    insertOne: vi.fn(),
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
  }
})

// Mock getDb so handlers do not attempt real MongoDB connections
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
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}))

// Mock jsonwebtoken for login handler tests
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock.jwt.token'),
    verify: vi.fn(),
  },
}))

import { getLoginHandler } from '../functions/auth.js'
import { requireAuth } from '../middleware/auth.js'

function makeLoginRequest(body: unknown): HttpRequest {
  return new HttpRequest({
    method: 'POST',
    url: 'http://localhost/api/auth/login',
    headers: { 'content-type': 'application/json' },
    body: { string: JSON.stringify(body) },
  })
}

function makeAuthRequest(token: string): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: 'http://localhost/api/test',
    headers: { 'x-authorization': `Bearer ${token}` },
  })
}

const activeUser = {
  _id: VALID_USER_ID,
  email: 'user@example.com',
  passwordHash: '$2b$12$hashed',
  isAdmin: false,
  tempPassword: false,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('Login handler — deactivated user', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = TEST_SECRET
    mockUsersCollection.findOne.mockResolvedValue(activeUser)
    mockUsersCollection.updateOne.mockResolvedValue({})
    mockRefreshTokensCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    mockBcryptCompare.mockResolvedValue(true)
  })

  it('returns 401 "Invalid credentials" when user.active === false even with correct password', async () => {
    // User exists, password matches, but account is deactivated
    mockUsersCollection.findOne.mockResolvedValue({ ...activeUser, active: false })
    mockBcryptCompare.mockResolvedValue(true)

    const handler = getLoginHandler()
    const req = makeLoginRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(401)
    expect((result.jsonBody as any).error).toBe('Invalid credentials')
  })

  it('returns 200 when user.active === true (normal login)', async () => {
    mockUsersCollection.findOne.mockResolvedValue({ ...activeUser, active: true })
    mockBcryptCompare.mockResolvedValue(true)

    const handler = getLoginHandler()
    const req = makeLoginRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(200)
  })

  it('returns 200 when user.active field is absent (legacy doc treated as active)', async () => {
    const legacyUser = { ...activeUser }
    delete (legacyUser as any).active
    mockUsersCollection.findOne.mockResolvedValue(legacyUser)
    mockBcryptCompare.mockResolvedValue(true)

    const handler = getLoginHandler()
    const req = makeLoginRequest({ email: 'user@example.com', password: 'correctpassword' })
    const result = await handler(req, {} as never)

    expect(result.status).toBe(200)
  })
})

describe('requireAuth — deactivated user', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = TEST_SECRET
    vi.mocked(jwt.verify).mockReturnValue({
      sub: VALID_USER_ID.toString(),
      email: 'user@example.com',
      isAdmin: false,
    } as any)
    // Default: active user
    mockUsersCollection.findOne.mockResolvedValue(activeUser)
  })

  it('returns 401 "Account is deactivated" when user.active === false', async () => {
    mockUsersCollection.findOne.mockResolvedValue({ ...activeUser, active: false })

    const token = jwt.sign(
      { sub: VALID_USER_ID.toString(), email: 'user@example.com', isAdmin: false },
      TEST_SECRET,
      { expiresIn: '1h' },
    )
    const req = makeAuthRequest('any-valid-looking-token')
    const result = await requireAuth(req)

    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toBe('Account is deactivated')
  })

  it('returns null (authorized) when user.active === true', async () => {
    mockUsersCollection.findOne.mockResolvedValue({ ...activeUser, active: true })

    const req = makeAuthRequest('any-valid-looking-token')
    const result = await requireAuth(req)

    expect(result).toBeNull()
  })

  it('returns null (authorized) when user.active field is absent (legacy doc)', async () => {
    const legacyUser = { ...activeUser }
    delete (legacyUser as any).active
    mockUsersCollection.findOne.mockResolvedValue(legacyUser)

    const req = makeAuthRequest('any-valid-looking-token')
    const result = await requireAuth(req)

    expect(result).toBeNull()
  })
})
