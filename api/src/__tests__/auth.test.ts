import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'

// Use vi.hoisted to create mock functions before vi.mock hoisting
const { mockFindOne, mockFindOneAndUpdate, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFindOneAndUpdate: vi.fn(),
  mockUpdateOne: vi.fn(),
}))

// Hoist mock to module level — must come before imports of auth.ts
vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    db: vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue({
        findOne: mockFindOne,
        findOneAndUpdate: mockFindOneAndUpdate,
        updateOne: mockUpdateOne,
      }),
    }),
  })),
}))

// Import AFTER mock is set up
import { requirePassword, checkBlocked, _resetConnectionForTest } from '../middleware/auth.js'

function makeRequest(password?: string): HttpRequest {
  return new HttpRequest({
    method: 'GET',
    url: 'http://localhost/api/test',
    headers: password ? { 'x-app-password': password } : {},
  })
}

describe('requirePassword and checkBlocked (unit — mocked MongoDB)', () => {
  beforeEach(() => {
    // Reset mock call history and restore default return values
    vi.clearAllMocks()
    // Default: not blocked (findOne returns null)
    mockFindOne.mockResolvedValue(null)
    mockFindOneAndUpdate.mockResolvedValue({ failureCount: 1 })
    mockUpdateOne.mockResolvedValue({})
    // Reset the module-level client/db singleton in auth.ts
    _resetConnectionForTest()
    process.env.APP_PASSWORD = 'test-secret'
    process.env.MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017'
  })

  it('Test 1: returns null when password matches APP_PASSWORD', async () => {
    // Default mock: findOne returns null (not blocked)
    const result = await requirePassword(makeRequest('test-secret'))
    expect(result).toBeNull()
  })

  it('Test 2: returns { status: 401 } when password is wrong', async () => {
    // Default mock: findOne returns null (not blocked)
    const result = await requirePassword(makeRequest('wrong-password'))
    expect(result?.status).toBe(401)
  })

  it('Test 3: returns { status: 401 } when x-app-password header is missing', async () => {
    // Default mock: findOne returns null (not blocked)
    const result = await requirePassword(makeRequest())
    expect(result?.status).toBe(401)
  })

  it('Test 4: returns { status: 503 } when checkBlocked finds blocked=true', async () => {
    // Configure findOne to return a blocked document
    mockFindOne.mockResolvedValue({ _id: 'lockout', blocked: true, failureCount: 30 })

    const result = await requirePassword(makeRequest('test-secret'))
    expect(result?.status).toBe(503)
  })

  it('Test 5: checkBlocked returns false when no lockout document exists (findOne returns null)', async () => {
    // Default mock: findOne returns null
    const result = await checkBlocked()
    expect(result).toBe(false)
  })

  it('Test 6: checkBlocked returns true when lockout document has blocked=true', async () => {
    mockFindOne.mockResolvedValue({ _id: 'lockout', blocked: true, failureCount: 30 })

    const result = await checkBlocked()
    expect(result).toBe(true)
  })
})
