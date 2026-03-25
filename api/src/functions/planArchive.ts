import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import type { Plan } from '../shared/types.js';

// POST /api/plan/archive — sets the active plan to archived
app.http('archivePlan', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/archive',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    try {
      const db = await getDb();

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: 'active' },
        { $set: { status: 'archived', updatedAt: new Date() } },
        { returnDocument: 'after' },
      );

      if (!result) {
        return {
          status: 404,
          jsonBody: { error: 'No active plan to archive' },
        };
      }

      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error archiving plan:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});

// GET /api/plans/archived — returns list of archived plans
app.http('listArchivedPlans', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'plans/archived',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    try {
      const db = await getDb();

      const results = await db
        .collection<Plan>('plans')
        .find({ status: 'archived' })
        .sort({ createdAt: -1 })
        .project({ _id: 1, objective: 1, goal: 1, createdAt: 1 })
        .toArray();

      return { status: 200, jsonBody: { plans: results } };
    } catch (err) {
      context.log('Error listing archived plans:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});

// GET /api/plans/archived/:id — returns a single archived plan
app.http('getArchivedPlan', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'plans/archived/{id}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const id = req.params['id'];

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid plan ID format' } };
    }

    try {
      const db = await getDb();

      const result = await db.collection<Plan>('plans').findOne({
        _id: objectId,
        status: 'archived',
      });

      if (!result) {
        return { status: 404, jsonBody: { error: 'Archived plan not found' } };
      }

      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error fetching archived plan:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});
