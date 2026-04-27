import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../shared/db.js';
import { User } from '../shared/types.js';
import { requireAdmin, getAuthContext } from '../middleware/auth.js';
import { computeCost } from '../shared/pricing.js';

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

export function getListUsersHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    try {
      const db = await getDb();
      const users = await db.collection<User>('users')
        .find({}, { projection: { passwordHash: 0 } })
        .sort({ createdAt: -1 })
        .toArray();
      return { status: 200, jsonBody: { users } };
    } catch {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

export function getCreateUserHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    try {
      const { email } = (await req.json()) as { email?: string };
      if (!email) return { status: 400, jsonBody: { error: 'email is required' } };
      const db = await getDb();
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await db.collection<User>('users').findOne({ email: normalizedEmail });
      if (existing) return { status: 409, jsonBody: { error: 'Email already in use' } };
      const tempPw = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPw, 10);
      const now = new Date();
      const result = await db.collection<User>('users').insertOne({
        email: normalizedEmail,
        passwordHash,
        isAdmin: false,
        tempPassword: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      } as User);
      return {
        status: 201,
        jsonBody: { user: { _id: result.insertedId, email: normalizedEmail }, tempPassword: tempPw },
      };
    } catch {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

export function getResetPasswordHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    try {
      const id = req.params['id'];
      if (!id || !ObjectId.isValid(id)) return { status: 400, jsonBody: { error: 'Invalid user id' } };
      const db = await getDb();
      const tempPw = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPw, 10);
      const result = await db.collection<User>('users').updateOne(
        { _id: new ObjectId(id) },
        { $set: { passwordHash, tempPassword: true, updatedAt: new Date() } },
      );
      if (result.matchedCount === 0) return { status: 404, jsonBody: { error: 'User not found' } };
      return { status: 200, jsonBody: { tempPassword: tempPw } };
    } catch {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

export function getToggleActiveHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAdmin(req);
    if (denied) return denied;
    try {
      const id = req.params['id'];
      if (!id || !ObjectId.isValid(id)) return { status: 400, jsonBody: { error: 'Invalid user id' } };
      const authCtx = getAuthContext(req);
      if (id === authCtx.userId) {
        return { status: 400, jsonBody: { error: 'You cannot deactivate your own account.' } };
      }
      const { active } = (await req.json()) as { active?: boolean };
      if (typeof active !== 'boolean') return { status: 400, jsonBody: { error: 'active (boolean) is required' } };
      const db = await getDb();
      const result = await db.collection<User>('users').findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { active, updatedAt: new Date() } },
        { returnDocument: 'after', projection: { passwordHash: 0 } },
      );
      if (!result) return { status: 404, jsonBody: { error: 'User not found' } };
      return { status: 200, jsonBody: { user: result } };
    } catch {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

export function getUsageSummaryHandler() {
  return async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAdmin(req);
    if (denied) return denied;

    try {
      const db = await getDb();
      const rows = await db.collection('usage_events').aggregate([
        {
          $group: {
            _id: {
              userId: '$userId',
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
            },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' },
            totalCacheWriteTokens: { $sum: '$cacheWriteTokens' },
            totalCacheReadTokens: { $sum: '$cacheReadTokens' },
          },
        },
      ]).toArray() as Array<{
        _id: { userId: ObjectId; year: number; month: number };
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCacheWriteTokens: number;
        totalCacheReadTokens: number;
      }>;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const summary: Record<string, { thisMonth: number; allTime: number }> = {};

      for (const row of rows) {
        const userKey = row._id.userId.toString();
<<<<<<< HEAD
        // Single-model assumption: aggregation groups by {year,month,userId} without model.
        // If a second model is added, group by {year,month,userId,model} and pass row._id.model here.
=======
>>>>>>> feat(11-02): add GET /api/users/usage-summary and register usage.ts in index - 6 tests pass
        const cost = computeCost(
          'claude-sonnet-4-20250514',
          row.totalInputTokens,
          row.totalOutputTokens,
          row.totalCacheWriteTokens,
          row.totalCacheReadTokens,
        );

        if (!summary[userKey]) {
          summary[userKey] = { thisMonth: 0, allTime: 0 };
        }
        summary[userKey].allTime += cost;
        if (row._id.year === currentYear && row._id.month === currentMonth) {
          summary[userKey].thisMonth += cost;
        }
      }

      return { status: 200, jsonBody: { summary } };
    } catch {
      return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
  };
}

// Register Azure Functions handlers
// NOTE: Azure Functions Core Tools reserves the '/admin' route prefix for the host management API.
// To avoid conflicts, these routes use 'users' as their prefix (accessed at /api/users).
// All handlers are protected by requireAdmin() so non-admin requests are rejected with 401.
app.http('adminListUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users',
  handler: getListUsersHandler(),
});

app.http('adminCreateUser', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'users',
  handler: getCreateUserHandler(),
});

app.http('adminResetPassword', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'users/{id}/reset-password',
  handler: getResetPasswordHandler(),
});

app.http('adminToggleActive', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'users/{id}',
  handler: getToggleActiveHandler(),
});

app.http('adminUsageSummary', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/usage-summary',
  handler: getUsageSummaryHandler(),
});
