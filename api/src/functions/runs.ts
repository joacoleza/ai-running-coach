import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import type { Plan, Run } from '../shared/types.js';

/**
 * Compute pace (minutes per distance unit) from distance and duration string.
 * Duration format: "HH:MM:SS" or "MM:SS"
 */
function computePace(distance: number, duration: string): number {
  const parts = duration.split(':').map(Number);
  let totalMinutes: number;
  if (parts.length === 3) {
    // HH:MM:SS
    totalMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
  } else {
    // MM:SS
    totalMinutes = parts[0] + parts[1] / 60;
  }
  return Math.round((totalMinutes / distance) * 100) / 100;
}


// ── POST /api/runs ─────────────────────────────────────────────────────────
app.http('createRun', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'runs',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    let body: {
      date?: string;
      distance?: number;
      duration?: string;
      avgHR?: number;
      notes?: string;
      weekNumber?: number;
      dayLabel?: string;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const { date, distance, duration } = body;
    if (!date || distance === undefined || !duration) {
      return { status: 400, jsonBody: { error: 'date, distance, and duration are required' } };
    }

    const pace = computePace(distance, duration);
    const now = new Date();

    try {
      const db = await getDb();

      const newRun: Omit<Run, '_id'> = {
        date,
        distance,
        duration,
        pace,
        createdAt: now,
        updatedAt: now,
      };

      if (body.avgHR !== undefined) newRun.avgHR = body.avgHR;
      if (body.notes !== undefined) newRun.notes = body.notes;

      // If weekNumber AND dayLabel provided, link to plan day
      if (body.weekNumber !== undefined && body.dayLabel !== undefined) {
        const weekNum = body.weekNumber;
        const dayLab = body.dayLabel;

        const plan = await db
          .collection<Plan>('plans')
          .findOne({ status: { $in: ['active', 'onboarding'] } });

        if (!plan) {
          return { status: 404, jsonBody: { error: 'No active plan found' } };
        }

        const targetDay = plan.phases
          .flatMap(p => p.weeks.flatMap(w => (w.weekNumber === weekNum ? w.days : [])))
          .find(d => d.label === dayLab);

        if (!targetDay) {
          return { status: 404, jsonBody: { error: `Day ${dayLab} not found in week ${weekNum}` } };
        }
        if (targetDay.completed) {
          return { status: 409, jsonBody: { error: 'Day is already completed' } };
        }

        // Mark the plan day as completed
        await db.collection<Plan>('plans').updateOne(
          { status: { $in: ['active', 'onboarding'] } },
          {
            $set: {
              'phases.$[].weeks.$[week].days.$[day].completed': true,
            },
            $currentDate: { updatedAt: true },
          },
          { arrayFilters: [{ 'week.weekNumber': weekNum }, { 'day.label': dayLab }] },
        );

        newRun.planId = plan._id;
        newRun.weekNumber = weekNum;
        newRun.dayLabel = dayLab;
      }

      const result = await db.collection<Run>('runs').insertOne(newRun as Run);
      const insertedRun = { ...newRun, _id: result.insertedId };

      return { status: 201, jsonBody: insertedRun };
    } catch (err) {
      context.log('Error creating run:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

// ── GET /api/runs ──────────────────────────────────────────────────────────
app.http('listRuns', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'runs',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    try {
      const params = req.query;
      const limit = Math.min(parseInt(params.get('limit') ?? '20', 10), 100);
      const offset = parseInt(params.get('offset') ?? '0', 10);

      const filter: Record<string, unknown> = {};

      const dateFrom = params.get('dateFrom');
      const dateTo = params.get('dateTo');
      if (dateFrom || dateTo) {
        const dateFilter: Record<string, string> = {};
        if (dateFrom) dateFilter['$gte'] = dateFrom;
        if (dateTo) dateFilter['$lte'] = dateTo;
        filter['date'] = dateFilter;
      }

      const distanceMin = params.get('distanceMin');
      const distanceMax = params.get('distanceMax');
      if (distanceMin || distanceMax) {
        const distFilter: Record<string, number> = {};
        if (distanceMin) distFilter['$gte'] = parseFloat(distanceMin);
        if (distanceMax) distFilter['$lte'] = parseFloat(distanceMax);
        filter['distance'] = distFilter;
      }

      const planIdParam = params.get('planId');
      if (planIdParam) {
        filter['planId'] = new ObjectId(planIdParam);
      }

      if (params.get('unlinked') === 'true') {
        filter['planId'] = { $exists: false };
      }

      const db = await getDb();
      const col = db.collection<Run>('runs');

      const [runs, total] = await Promise.all([
        col.find(filter).sort({ date: -1, createdAt: -1 }).skip(offset).limit(limit).toArray(),
        col.countDocuments(filter),
      ]);

      return { status: 200, jsonBody: { runs, total } };
    } catch (err) {
      context.log('Error listing runs:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

// ── GET /api/runs/{id} ─────────────────────────────────────────────────────
app.http('getRun', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'runs/{id}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const id = req.params['id'];
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid run ID format' } };
    }

    try {
      const db = await getDb();
      const run = await db.collection<Run>('runs').findOne({ _id: objectId });
      if (!run) return { status: 404, jsonBody: { error: 'Run not found' } };
      return { status: 200, jsonBody: run };
    } catch (err) {
      context.log('Error fetching run:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

// ── PATCH /api/runs/{id} ───────────────────────────────────────────────────
app.http('updateRun', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'runs/{id}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const id = req.params['id'];
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid run ID format' } };
    }

    let body: {
      date?: string;
      distance?: number;
      duration?: string;
      avgHR?: number;
      notes?: string;
      insight?: string;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    try {
      const db = await getDb();
      const existing = await db.collection<Run>('runs').findOne({ _id: objectId });
      if (!existing) return { status: 404, jsonBody: { error: 'Run not found' } };

      const $set: Record<string, unknown> = { updatedAt: new Date() };

      if (body.date !== undefined) $set['date'] = body.date;
      if (body.distance !== undefined) $set['distance'] = body.distance;
      if (body.duration !== undefined) $set['duration'] = body.duration;
      if (body.avgHR !== undefined) $set['avgHR'] = body.avgHR;
      if (body.notes !== undefined) $set['notes'] = body.notes;
      if (body.insight !== undefined) $set['insight'] = body.insight;

      // Recompute pace if distance or duration changed
      const newDistance = body.distance ?? existing.distance;
      const newDuration = body.duration ?? existing.duration;
      if (body.distance !== undefined || body.duration !== undefined) {
        $set['pace'] = computePace(newDistance, newDuration);
      }

      const updated = await db
        .collection<Run>('runs')
        .findOneAndUpdate({ _id: objectId }, { $set }, { returnDocument: 'after' });

      if (!updated) return { status: 404, jsonBody: { error: 'Run not found' } };
      return { status: 200, jsonBody: updated };
    } catch (err) {
      context.log('Error updating run:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

// ── DELETE /api/runs/{id} ──────────────────────────────────────────────────
app.http('deleteRun', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'runs/{id}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const id = req.params['id'];
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid run ID format' } };
    }

    try {
      const db = await getDb();
      const run = await db.collection<Run>('runs').findOne({ _id: objectId });
      if (!run) return { status: 404, jsonBody: { error: 'Run not found' } };

      if (run.planId) {
        return {
          status: 409,
          jsonBody: {
            error: 'Cannot delete a linked run. Undo the training plan day first.',
          },
        };
      }

      await db.collection<Run>('runs').deleteOne({ _id: objectId });
      return { status: 204 };
    } catch (err) {
      context.log('Error deleting run:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

// ── POST /api/runs/{id}/link ───────────────────────────────────────────────
app.http('linkRun', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'runs/{id}/link',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const id = req.params['id'];
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid run ID format' } };
    }

    let body: { weekNumber?: number; dayLabel?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const { weekNumber, dayLabel } = body;
    if (weekNumber === undefined || !dayLabel) {
      return { status: 400, jsonBody: { error: 'weekNumber and dayLabel are required' } };
    }

    try {
      const db = await getDb();

      const run = await db.collection<Run>('runs').findOne({ _id: objectId });
      if (!run) return { status: 404, jsonBody: { error: 'Run not found' } };

      const plan = await db
        .collection<Plan>('plans')
        .findOne({ status: { $in: ['active', 'onboarding'] } });
      if (!plan) return { status: 404, jsonBody: { error: 'No active plan found' } };

      const targetDay = plan.phases
        .flatMap(p => p.weeks.flatMap(w => (w.weekNumber === weekNumber ? w.days : [])))
        .find(d => d.label === dayLabel);

      if (!targetDay) {
        return { status: 404, jsonBody: { error: `Day ${dayLabel} not found in week ${weekNumber}` } };
      }
      if (targetDay.completed) {
        return { status: 409, jsonBody: { error: 'Day is already completed' } };
      }

      // Mark the plan day as completed
      await db.collection<Plan>('plans').updateOne(
        { status: { $in: ['active', 'onboarding'] } },
        {
          $set: {
            'phases.$[].weeks.$[week].days.$[day].completed': true,
          },
          $currentDate: { updatedAt: true },
        },
        { arrayFilters: [{ 'week.weekNumber': weekNumber }, { 'day.label': dayLabel }] },
      );

      // Update the run with link info
      const updated = await db.collection<Run>('runs').findOneAndUpdate(
        { _id: objectId },
        {
          $set: {
            planId: plan._id,
            weekNumber,
            dayLabel,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      );

      return { status: 200, jsonBody: updated };
    } catch (err) {
      context.log('Error linking run:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});
