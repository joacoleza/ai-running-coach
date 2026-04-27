import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import { getDb } from '../shared/db.js';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { computeCost } from '../shared/pricing.js';

export function getUsageMeHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req);
    if (denied) return denied;
    const { userId } = getAuthContext(req);

    try {
      const db = await getDb();
      const rows = await db.collection('usage_events').aggregate([
        { $match: { userId: new ObjectId(userId) } },
        {
          $group: {
            _id: { year: { $year: '$timestamp' }, month: { $month: '$timestamp' } },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' },
            totalCacheWriteTokens: { $sum: '$cacheWriteTokens' },
            totalCacheReadTokens: { $sum: '$cacheReadTokens' },
            messages: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
      ]).toArray() as Array<{
        _id: { year: number; month: number };
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCacheWriteTokens: number;
        totalCacheReadTokens: number;
        messages: number;
      }>;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const monthly = rows.map((row) => {
        // Single-model assumption: aggregation groups by {year,month} without model.
        // If a second model is added, group by {year,month,model} and pass row._id.model here.
        const cost = computeCost(
          'claude-sonnet-4-20250514',
          row.totalInputTokens,
          row.totalOutputTokens,
          row.totalCacheWriteTokens,
          row.totalCacheReadTokens,
        );
        return {
          year: row._id.year,
          month: row._id.month,
          cost,
          messages: row.messages,
        };
      });

      const allTime = monthly.reduce(
        (acc, m) => ({ cost: acc.cost + m.cost, messages: acc.messages + m.messages }),
        { cost: 0, messages: 0 },
      );

      const thisMonthRow = monthly.find(
        (m) => m.year === currentYear && m.month === currentMonth,
      );
      const thisMonth = thisMonthRow
        ? { cost: thisMonthRow.cost, messages: thisMonthRow.messages }
        : { cost: 0, messages: 0 };

      return {
        status: 200,
        jsonBody: { allTime, thisMonth, monthly },
      };
    } catch {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

app.http('usageMe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'usage/me',
  handler: getUsageMeHandler(),
});
