import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { Plan, PlanGoal } from '../shared/types.js';

app.http('getPlan', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'plan',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    try {
      const db = await getDb();
      const plan = await db
        .collection<Plan>('plans')
        .findOne(
          { status: { $in: ['onboarding', 'active'] } },
          { sort: { createdAt: -1 } },
        );

      // Stale plan migration: old plans have sessions[] but no phases[]
      if (plan && (!plan.phases || plan.phases.length === 0) && (plan as any).sessions?.length > 0) {
        return { status: 200, jsonBody: { plan: null } };
      }

      return {
        status: 200,
        jsonBody: { plan: plan ?? null },
      };
    } catch (err) {
      context.log('Error getting plan:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});

app.http('createPlan', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    try {
      const body = (await req.json()) as { mode?: 'conversational' | 'paste' };
      const mode = body.mode ?? 'conversational';

      const db = await getDb();

      // D-02: Delete abandoned/legacy plans on every new start to keep the DB clean:
      // - 'onboarding': empty abandoned plans from previous starts
      // - 'discarded': legacy status from an old schema, no longer used
      // - plans with a 'sessions' array but no 'phases': old schema format, fully superseded
      await db.collection<Plan>('plans').deleteMany({
        $or: [
          { status: 'onboarding' },
          { status: 'discarded' },
          { sessions: { $exists: true }, phases: { $exists: false } },
        ],
      } as any);

      const now = new Date();
      const newPlan: Omit<Plan, '_id'> = {
        status: 'onboarding',
        onboardingMode: mode,
        onboardingStep: 0,
        goal: {} as PlanGoal,
        phases: [],
        createdAt: now,
        updatedAt: now,
      };

      const result = await db.collection<Plan>('plans').insertOne(newPlan as Plan);

      const insertedPlan = { ...newPlan, _id: result.insertedId };

      return {
        status: 201,
        jsonBody: { plan: insertedPlan },
      };
    } catch (err) {
      context.log('Error creating plan:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});

app.http('patchPlan', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'plan',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    let body: { progressFeedback?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    if (body.progressFeedback === undefined) {
      return { status: 400, jsonBody: { error: 'No updatable fields provided' } };
    }

    try {
      const db = await getDb();
      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] } },
        { $set: { progressFeedback: body.progressFeedback, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      if (!result) return { status: 404, jsonBody: { error: 'No active plan found' } };
      return { status: 200, jsonBody: result };
    } catch (err) {
      context.log('Error patching plan:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

