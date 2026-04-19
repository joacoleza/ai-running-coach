import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock is called
const {
  mockUsersCollection,
  mockRequireAdmin,
  mockGetAuthContext,
  mockBcryptHash,
} = vi.hoisted(() => {
  const mockUsersCollection = {
    find: vi.fn(),
    findOne: vi.fn(),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  }
  return {
    mockUsersCollection,
    mockRequireAdmin: vi.fn(),
    mockGetAuthContext: vi.fn(),
    mockBcryptHash: vi.fn(),
  }
})

// Mock getDb
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn(() => mockUsersCollection),
  }),
}))

// Mock requireAdmin and getAuthContext from middleware
vi.mock('../middleware/auth.js', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: (...args: unknown[]) => mockBcryptHash(...args),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

import {
  getListUsersHandler,
  getCreateUserHandler,
  getResetPasswordHandler,
  getToggleActiveHandler,
} from '../functions/admin.js'

const ADMIN_USER_ID = new ObjectId()
const TARGET_USER_ID = new ObjectId()

function makeRequest(
  method: string,
  body?: unknown,
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
): HttpRequest {
  const req = new HttpRequest({
    method,
    url: `http://localhost/api/admin/users`,
    headers: { 'content-type': 'application/json', ...headers },
    body: body != null ? { string: JSON.stringify(body) } : undefined,
  })
  // Inject params manually (Azure Functions test helper)
  Object.defineProperty(req, 'params', { value: params, writable: true })
  return req
}

describe('GET /api/admin/users — getListUsersHandler', () => {
  const sampleUsers = [
    {
      _id: TARGET_USER_ID,
      email: 'user@example.com',
      isAdmin: false,
      tempPassword: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(null) // authorized
    mockUsersCollection.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(sampleUsers),
      }),
    })
  })

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue({ status: 403, jsonBody: { error: 'Admin access required' } })
    const handler = getListUsersHandler()
    const req = makeRequest('GET')
    const result = await handler(req, {} as never)
    expect(result.status).toBe(403)
    expect((result.jsonBody as any).error).toBe('Admin access required')
  })

  it('returns 200 with users array (no passwordHash) when admin', async () => {
    const handler = getListUsersHandler()
    const req = makeRequest('GET')
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as { users: any[] }
    expect(Array.isArray(body.users)).toBe(true)
    expect(body.users).toHaveLength(1)
    expect(body.users[0].email).toBe('user@example.com')
    expect(body.users[0].passwordHash).toBeUndefined()
  })
})

describe('POST /api/admin/users — getCreateUserHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(null) // authorized
    mockUsersCollection.findOne.mockResolvedValue(null) // no existing user
    mockUsersCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() })
    mockBcryptHash.mockResolvedValue('hashed-password')
  })

  it('returns 400 when email is missing', async () => {
    const handler = getCreateUserHandler()
    const req = makeRequest('POST', {})
    const result = await handler(req, {} as never)
    expect(result.status).toBe(400)
    expect((result.jsonBody as any).error).toContain('email')
  })

  it('returns 409 when email already exists', async () => {
    mockUsersCollection.findOne.mockResolvedValue({
      _id: TARGET_USER_ID,
      email: 'existing@example.com',
    })
    const handler = getCreateUserHandler()
    const req = makeRequest('POST', { email: 'existing@example.com' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(409)
    expect((result.jsonBody as any).error).toContain('already')
  })

  it('returns 201 with user and tempPassword when email is new', async () => {
    const handler = getCreateUserHandler()
    const req = makeRequest('POST', { email: 'newuser@example.com' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(201)
    const body = result.jsonBody as { user: { email: string }; tempPassword: string }
    expect(body.user.email).toBe('newuser@example.com')
    expect(typeof body.tempPassword).toBe('string')
    expect(body.tempPassword.length).toBeGreaterThan(0)
  })

  it('normalizes email to lowercase on create', async () => {
    const handler = getCreateUserHandler()
    const req = makeRequest('POST', { email: 'NewUser@EXAMPLE.COM' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(201)
    const body = result.jsonBody as { user: { email: string } }
    expect(body.user.email).toBe('newuser@example.com')
  })
})

describe('POST /api/admin/users/:id/reset-password — getResetPasswordHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(null) // authorized
    mockBcryptHash.mockResolvedValue('new-hashed-password')
  })

  it('returns 404 when user not found', async () => {
    mockUsersCollection.updateOne.mockResolvedValue({ matchedCount: 0 })
    const handler = getResetPasswordHandler()
    const req = makeRequest('POST', {}, { id: TARGET_USER_ID.toString() })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(404)
    expect((result.jsonBody as any).error).toContain('not found')
  })

  it('returns 200 with tempPassword string on success', async () => {
    mockUsersCollection.updateOne.mockResolvedValue({ matchedCount: 1 })
    const handler = getResetPasswordHandler()
    const req = makeRequest('POST', {}, { id: TARGET_USER_ID.toString() })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as { tempPassword: string }
    expect(typeof body.tempPassword).toBe('string')
    expect(body.tempPassword.length).toBeGreaterThan(0)
  })

  it('returns 400 for invalid user id', async () => {
    const handler = getResetPasswordHandler()
    const req = makeRequest('POST', {}, { id: 'not-valid-id' })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(400)
  })
})

describe('PATCH /api/admin/users/:id — getToggleActiveHandler', () => {
  const updatedUser = {
    _id: TARGET_USER_ID,
    email: 'target@example.com',
    isAdmin: false,
    tempPassword: false,
    active: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(null) // authorized
    mockGetAuthContext.mockReturnValue({
      userId: ADMIN_USER_ID.toString(),
      email: 'admin@example.com',
      isAdmin: true,
    })
    mockUsersCollection.findOneAndUpdate.mockResolvedValue(updatedUser)
  })

  it('returns 400 with self-deactivation message when id matches caller userId', async () => {
    mockGetAuthContext.mockReturnValue({
      userId: TARGET_USER_ID.toString(),
      email: 'admin@example.com',
      isAdmin: true,
    })
    const handler = getToggleActiveHandler()
    const req = makeRequest('PATCH', { active: false }, { id: TARGET_USER_ID.toString() })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(400)
    expect((result.jsonBody as any).error).toBe('You cannot deactivate your own account.')
  })

  it('returns 404 when user not found', async () => {
    mockUsersCollection.findOneAndUpdate.mockResolvedValue(null)
    const handler = getToggleActiveHandler()
    const req = makeRequest('PATCH', { active: false }, { id: TARGET_USER_ID.toString() })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(404)
    expect((result.jsonBody as any).error).toContain('not found')
  })

  it('returns 200 with updated user on success', async () => {
    const handler = getToggleActiveHandler()
    const req = makeRequest('PATCH', { active: false }, { id: TARGET_USER_ID.toString() })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as { user: any }
    expect(body.user.email).toBe('target@example.com')
    expect(body.user.passwordHash).toBeUndefined()
  })

  it('returns 400 when active field is missing or non-boolean', async () => {
    const handler = getToggleActiveHandler()
    const req = makeRequest('PATCH', { active: 'yes' }, { id: TARGET_USER_ID.toString() })
    const result = await handler(req, {} as never)
    expect(result.status).toBe(400)
    expect((result.jsonBody as any).error).toContain('active')
  })
})
