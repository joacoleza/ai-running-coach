import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock is called
const {
  mockUsageCollection,
  mockRequireAdmin,
  mockGetAuthContext,
} = vi.hoisted(() => {
  const mockUsageCollection = {
    aggregate: vi.fn(),
  }
  return {
    mockUsageCollection,
    mockRequireAdmin: vi.fn(),
    mockGetAuthContext: vi.fn(),
  }
})

// Mock getDb — collection('usage_events') returns mockUsageCollection
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn(() => mockUsageCollection),
  }),
}))

// Mock requireAdmin and getAuthContext from middleware
vi.mock('../middleware/auth.js', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  requireAuth: vi.fn().mockResolvedValue(null),
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

// Mock bcrypt (required by admin.ts import)
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed'),
    compare: vi.fn().mockResolvedValue(true),
  },
}))

import { getUsageSummaryHandler } from '../functions/admin.js'

const USER_A = new ObjectId()
const USER_B = new ObjectId()

function makeRequest(method: string = 'GET'): HttpRequest {
  return new HttpRequest({
    method,
    url: 'http://localhost/api/users/usage-summary',
    headers: { 'content-type': 'application/json' },
  })
}

describe('GET /api/users/usage-summary — getUsageSummaryHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(null) // authorized admin
    mockGetAuthContext.mockReturnValue({
      userId: USER_A.toString(),
      email: 'admin@example.com',
      isAdmin: true,
    })
    // Default: no usage events
    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    })
  })

  it('returns 401 when requireAdmin returns denied (non-admin user)', async () => {
    mockRequireAdmin.mockResolvedValue({ status: 401, jsonBody: { error: 'Authorization required' } })
    const handler = getUsageSummaryHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as any).error).toBe('Authorization required')
  })

  it('returns { summary: {} } when no usage events exist', async () => {
    const handler = getUsageSummaryHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as any
    expect(body.summary).toEqual({})
  })

  it('returns a map keyed by userId strings with { thisMonth, allTime } values', async () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { userId: USER_A, year: currentYear, month: currentMonth },
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
        },
      ]),
    })
    const handler = getUsageSummaryHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as any
    const keys = Object.keys(body.summary)
    expect(keys).toHaveLength(1)
    expect(keys[0]).toBe(USER_A.toString())
    expect(typeof body.summary[USER_A.toString()].thisMonth).toBe('number')
    expect(typeof body.summary[USER_A.toString()].allTime).toBe('number')
    expect(body.summary[USER_A.toString()].allTime).toBeGreaterThan(0)
  })

  it('thisMonth for each user reflects only current calendar month events', async () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear

    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { userId: USER_A, year: currentYear, month: currentMonth },
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
        },
        {
          _id: { userId: USER_A, year: previousYear, month: previousMonth },
          totalInputTokens: 5000,
          totalOutputTokens: 2000,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
        },
      ]),
    })
    const handler = getUsageSummaryHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    const body = result.jsonBody as any
    const userSummary = body.summary[USER_A.toString()]
    // thisMonth should only count current month
    expect(userSummary.thisMonth).toBeGreaterThan(0)
    // allTime should be greater than thisMonth (two months of data)
    expect(userSummary.allTime).toBeGreaterThan(userSummary.thisMonth)
  })

  it('a user with events only in a prior month has thisMonth: 0 but allTime > 0', async () => {
    const now = new Date()
    const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { userId: USER_B, year: previousYear, month: previousMonth },
          totalInputTokens: 3000,
          totalOutputTokens: 1000,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
        },
      ]),
    })
    const handler = getUsageSummaryHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    const body = result.jsonBody as any
    const userSummary = body.summary[USER_B.toString()]
    expect(userSummary.thisMonth).toBe(0)
    expect(userSummary.allTime).toBeGreaterThan(0)
  })

  it('handles multiple users in the summary map', async () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { userId: USER_A, year: currentYear, month: currentMonth },
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
        },
        {
          _id: { userId: USER_B, year: currentYear, month: currentMonth },
          totalInputTokens: 2000,
          totalOutputTokens: 1000,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
        },
      ]),
    })
    const handler = getUsageSummaryHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    const body = result.jsonBody as any
    expect(Object.keys(body.summary)).toHaveLength(2)
    expect(body.summary[USER_A.toString()]).toBeDefined()
    expect(body.summary[USER_B.toString()]).toBeDefined()
  })
})
