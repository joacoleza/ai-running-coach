import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { Plan, PlanGoal, PlanPhase } from '../shared/types.js';

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

      // D-02: Discard any existing onboarding plan before creating a new one
      await db.collection<Plan>('plans').updateMany(
        { status: 'onboarding' },
        { $set: { status: 'archived', updatedAt: new Date() } },
      );

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

app.http('generatePlan', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/generate',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    try {
      const body = (await req.json()) as {
        planId?: string;
        claudeResponseText?: string;
        goal?: PlanGoal;
        objective?: string;
      };

      const { planId, claudeResponseText, goal } = body;
      const objective = body.objective as Plan['objective'] | undefined;

      if (!planId || !claudeResponseText || !goal) {
        return {
          status: 400,
          jsonBody: { error: 'planId, claudeResponseText, and goal are required' },
        };
      }

      // Extract JSON from <training_plan> XML tags (Research Pitfall 3)
      const match = claudeResponseText.match(/<training_plan>([\s\S]*?)<\/training_plan>/);
      if (!match) {
        return {
          status: 400,
          jsonBody: { error: 'Could not extract training plan from response' },
        };
      }

      let parsedPlan: { phases: PlanPhase[] };
      try {
        parsedPlan = JSON.parse(match[1]);
        if (!parsedPlan.phases || !Array.isArray(parsedPlan.phases) || parsedPlan.phases.length === 0) {
          return { status: 400, jsonBody: { error: 'Training plan must contain at least one phase' } };
        }
      } catch {
        return {
          status: 400,
          jsonBody: { error: 'Failed to parse training plan JSON from response' },
        };
      }

      const db = await getDb();

      const { ObjectId } = await import('mongodb');
      let objectId: import('mongodb').ObjectId;
      try {
        objectId = new ObjectId(planId);
      } catch {
        return {
          status: 400,
          jsonBody: { error: 'Invalid planId format' },
        };
      }

      const now = new Date();
      const updateResult = await db.collection<Plan>('plans').findOneAndUpdate(
        { _id: objectId },
        {
          $set: {
            status: 'active',
            goal,
            phases: parsedPlan.phases,
            objective,
            targetDate: goal.targetDate,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' },
      );

      if (!updateResult) {
        return {
          status: 404,
          jsonBody: { error: 'Plan not found' },
        };
      }

      return {
        status: 200,
        jsonBody: { plan: updateResult },
      };
    } catch (err) {
      context.log('Error generating plan:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});
