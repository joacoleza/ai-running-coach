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

      const planToArchive = await db.collection<Plan>('plans').findOne(
        { status: { $in: ['active', 'onboarding'] } },
        { sort: { createdAt: -1 } },
      );

      if (!planToArchive) {
        return {
          status: 404,
          jsonBody: { error: 'No active plan to archive' },
        };
      }

      // If plan has no workout days (empty/abandoned), delete it to avoid empty archive entries.
      // This covers: no phases at all, OR phases with only rest days / empty weeks.
      const hasWorkoutDays = planToArchive.phases?.some(phase =>
        phase.weeks?.some(week =>
          week.days?.some(day => day.type !== 'rest')
        )
      );
      if (!planToArchive.phases || planToArchive.phases.length === 0 || !hasWorkoutDays) {
        await db.collection<Plan>('plans').deleteOne({ _id: planToArchive._id });
        return { status: 200, jsonBody: { plan: planToArchive } };
      }

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { _id: planToArchive._id },
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
        .project({ _id: 1, objective: 1, goal: 1, createdAt: 1, targetDate: 1 })
        .toArray();

      results.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());

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

      const runs = await db.collection('runs').find({ planId: result._id }).toArray();
      const linkedRuns: Record<string, unknown> = {};
      for (const run of runs) {
        if (run.weekNumber != null && run.dayLabel) {
          linkedRuns[`${run.weekNumber}-${run.dayLabel}`] = run;
        }
      }

      return { status: 200, jsonBody: { plan: result, linkedRuns } };
    } catch (err) {
      context.log('Error fetching archived plan:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});
