import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpRequest } from '@azure/functions'
import { ObjectId } from 'mongodb'

// Hoist mock factories before vi.mock is called
const {
  mockUsageCollection,
  mockRequireAuth,
  mockGetAuthContext,
} = vi.hoisted(() => {
  const mockUsageCollection = {
    aggregate: vi.fn(),
  }
  return {
    mockUsageCollection,
    mockRequireAuth: vi.fn(),
    mockGetAuthContext: vi.fn(),
  }
})

// Mock getDb — collection('usage_events') returns mockUsageCollection
vi.mock('../shared/db.js', () => ({
  getDb: vi.fn().mockResolvedValue({
    collection: vi.fn(() => mockUsageCollection),
  }),
}))

// Mock requireAuth and getAuthContext from middleware
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}))

import { getUsageMeHandler } from '../functions/usage.js'

const TEST_USER_ID = new ObjectId()

function makeRequest(
  method: string = 'GET',
  headers: Record<string, string> = {},
): HttpRequest {
  return new HttpRequest({
    method,
    url: 'http://localhost/api/usage/me',
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('GET /api/usage/me — getUsageMeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(null) // authorized
    mockGetAuthContext.mockReturnValue({
      userId: TEST_USER_ID.toString(),
      email: 'test@example.com',
      isAdmin: false,
    })
    // Default: no usage events
    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    })
  })

  it('returns 401 when requireAuth returns a denied response', async () => {
    mockRequireAuth.mockResolvedValue({ status: 401, jsonBody: { error: 'Authorization required' } })
    const handler = getUsageMeHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    expect(result.status).toBe(401)
    expect((result.jsonBody as any).error).toBe('Authorization required')
  })

  it('returns zero-cost response when no events exist', async () => {
    const handler = getUsageMeHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as any
    expect(body.allTime).toEqual({ cost: 0, messages: 0 })
    expect(body.thisMonth).toEqual({ cost: 0, messages: 0 })
    expect(body.monthly).toEqual([])
  })

  it('returns correctly summed allTime.messages equal to total event count', async () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { year: currentYear, month: currentMonth },
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
          messages: 10,
        },
        {
          _id: { year: currentYear, month: currentMonth - 1 || 12 },
          totalInputTokens: 2000,
          totalOutputTokens: 1000,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
          messages: 20,
        },
      ]),
    })
    const handler = getUsageMeHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    expect(result.status).toBe(200)
    const body = result.jsonBody as any
    expect(body.allTime.messages).toBe(30) // 10 + 20
  })

  it('returns monthly[] sorted newest-first', async () => {
    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { year: 2026, month: 4 },
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
          messages: 10,
        },
        {
          _id: { year: 2026, month: 3 },
          totalInputTokens: 2000,
          totalOutputTokens: 1000,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
          messages: 20,
        },
      ]),
    })
    const handler = getUsageMeHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    const body = result.jsonBody as any
    expect(body.monthly).toHaveLength(2)
    // First element is newest (April)
    expect(body.monthly[0].year).toBe(2026)
    expect(body.monthly[0].month).toBe(4)
    expect(body.monthly[1].month).toBe(3)
  })

  it('thisMonth reflects only the current calendar month events', async () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear

    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { year: currentYear, month: currentMonth },
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
          messages: 5,
        },
        {
          _id: { year: previousYear, month: previousMonth },
          totalInputTokens: 5000,
          totalOutputTokens: 2000,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
          messages: 15,
        },
      ]),
    })
    const handler = getUsageMeHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    const body = result.jsonBody as any
    expect(body.thisMonth.messages).toBe(5) // only current month
    expect(body.allTime.messages).toBe(20) // both months combined
  })

  it('allTime.cost equals the sum of all monthly costs (positive for non-zero tokens)', async () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    mockUsageCollection.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: { year: currentYear, month: currentMonth },
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          totalCacheWriteTokens: 0,
          totalCacheReadTokens: 0,
          messages: 10,
        },
      ]),
    })
    const handler = getUsageMeHandler()
    const req = makeRequest()
    const result = await handler(req, {} as never)
    const body = result.jsonBody as any
    // Cost must be positive for non-zero tokens
    expect(body.allTime.cost).toBeGreaterThan(0)
    // allTime.cost must equal sum of monthly costs
    const monthlyCostSum = body.monthly.reduce((sum: number, m: any) => sum + m.cost, 0)
    expect(body.allTime.cost).toBeCloseTo(monthlyCostSum, 10)
  })
})
