import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import jwt from 'jsonwebtoken'
import { ObjectId } from 'mongodb'

const TEST_SECRET = 'test-jwt-secret'
const VALID_USER_ID = new ObjectId()

// Hoist mock DB before vi.mock is called
const { mockUsersCollection } = vi.hoisted(() => {
  const mockUsersCollection = {
    findOne: vi.fn(),
  }
  return { mockUsersCollection }
})

// Mock getDb so requireAuth does not attempt a real MongoDB connection
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn(() => mockUsersCollection),
  }),
}))

import { requireAuth, getAuthContext } from '../middleware/auth.js'

function makeRequest(authHeader?: string): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: 'http://localhost/api/test',
    headers: authHeader ? { 'x-authorization': authHeader } : {},
  })
}

function makeValidToken(overrides?: Partial<{ sub: string; email: string; isAdmin: boolean; expiresIn: string | number }>): string {
  const payload = {
    sub: overrides?.sub ?? VALID_USER_ID.toString(),
    email: overrides?.email ?? 'test@example.com',
    isAdmin: overrides?.isAdmin ?? false,
  }
  const expiresIn = overrides?.expiresIn ?? '1h'
  return jwt.sign(payload, TEST_SECRET, { expiresIn } as jwt.SignOptions)
}

// Default active user returned by the mock DB
const activeUser = {
  _id: VALID_USER_ID,
  email: 'test@example.com',
  passwordHash: 'hash',
  isAdmin: false,
  tempPassword: false,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('requireAuth (JWT-based middleware)', () => {
  const originalSecret = process.env.JWT_SECRET

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET
    vi.clearAllMocks()
    mockUsersCollection.findOne.mockResolvedValue(activeUser)
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET
    } else {
      process.env.JWT_SECRET = originalSecret
    }
  })

  it('Test 1: returns null for a valid unexpired JWT signed with JWT_SECRET', async () => {
    const token = makeValidToken()
    const req = makeRequest(`Bearer ${token}`)
    const result = await requireAuth(req)
    expect(result).toBeNull()
  })

  it('Test 2: returns { status: 401 } when Authorization header is missing', async () => {
    const req = makeRequest()
    const result = await requireAuth(req)
    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toBe('Authorization required')
  })

  it('Test 3: returns { status: 401 } when Authorization header has wrong scheme', async () => {
    const req = makeRequest('Basic dXNlcjpwYXNz')
    const result = await requireAuth(req)
    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toBe('Authorization required')
  })

  it('Test 4: returns { status: 401 } for an expired JWT', async () => {
    const token = makeValidToken({ expiresIn: -1 })
    const req = makeRequest(`Bearer ${token}`)
    const result = await requireAuth(req)
    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toContain('Invalid or expired token')
  })

  it('Test 5: returns { status: 401 } for a JWT signed with the wrong secret', async () => {
    const token = jwt.sign({ sub: VALID_USER_ID.toString(), email: 'a@b.com', isAdmin: false }, 'wrong-secret', { expiresIn: '1h' })
    const req = makeRequest(`Bearer ${token}`)
    const result = await requireAuth(req)
    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toContain('Invalid or expired token')
  })

  it('Test 6: returns { status: 401 } for a malformed token string', async () => {
    const req = makeRequest('Bearer not-a-valid-jwt')
    const result = await requireAuth(req)
    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toContain('Invalid or expired token')
  })

  it('Test 7: getAuthContext returns userId/email/isAdmin after successful requireAuth', async () => {
    const userId = new ObjectId()
    mockUsersCollection.findOne.mockResolvedValue({ ...activeUser, _id: userId })
    const token = makeValidToken({ sub: userId.toString(), email: 'runner@test.com', isAdmin: true })
    const req = makeRequest(`Bearer ${token}`)
    await requireAuth(req)
    const ctx = getAuthContext(req)
    expect(ctx.userId).toBe(userId.toString())
    expect(ctx.email).toBe('runner@test.com')
    expect(ctx.isAdmin).toBe(true)
  })

  it('Test 8: getAuthContext throws if called before requireAuth', () => {
    const req = makeRequest()
    expect(() => getAuthContext(req)).toThrow('getAuthContext called before requireAuth')
  })

  it('Test 9: getAuthContext throws if requireAuth returned an error (no context stored)', async () => {
    const req = makeRequest()
    await requireAuth(req) // returns 401, does not set context
    expect(() => getAuthContext(req)).toThrow('getAuthContext called before requireAuth')
  })

  it('Test 10: throws if JWT_SECRET env var is not set', async () => {
    delete process.env.JWT_SECRET
    const token = makeValidToken()
    const req = makeRequest(`Bearer ${token}`)
    await expect(requireAuth(req)).rejects.toThrow('JWT_SECRET environment variable is not set')
  })

  it('Test 11: returns 401 "Account is deactivated" when user.active === false', async () => {
    mockUsersCollection.findOne.mockResolvedValue({ ...activeUser, active: false })
    const token = makeValidToken()
    const req = makeRequest(`Bearer ${token}`)
    const result = await requireAuth(req)
    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toBe('Account is deactivated')
  })

  it('Test 12: returns null (authorized) when user.active is missing (legacy doc treated as active)', async () => {
    // Documents without active field should be treated as active
    const legacyUser = { ...activeUser }
    delete (legacyUser as any).active
    mockUsersCollection.findOne.mockResolvedValue(legacyUser)
    const token = makeValidToken()
    const req = makeRequest(`Bearer ${token}`)
    const result = await requireAuth(req)
    expect(result).toBeNull()
  })

  it('Test 13: returns 401 when user does not exist in DB (deleted after token issued)', async () => {
    mockUsersCollection.findOne.mockResolvedValue(null)
    const token = makeValidToken()
    const req = makeRequest(`Bearer ${token}`)
    const result = await requireAuth(req)
    expect(result?.status).toBe(401)
    expect((result?.jsonBody as any)?.error).toBe('Account is deactivated')
  })
})
