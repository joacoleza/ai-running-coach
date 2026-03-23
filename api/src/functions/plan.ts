import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { randomUUID } from 'crypto';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { Plan, PlanGoal, PlanSession } from '../shared/types.js';

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
        { $set: { status: 'discarded', updatedAt: new Date() } },
      );

      const now = new Date();
      const newPlan: Omit<Plan, '_id'> = {
        status: 'onboarding',
        onboardingMode: mode,
        onboardingStep: 0,
        goal: {} as PlanGoal,
        sessions: [],
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
      };

      const { planId, claudeResponseText, goal } = body;

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

      let parsedSessions: Array<Omit<PlanSession, 'id' | 'completed'>>;
      try {
        parsedSessions = JSON.parse(match[1]);
      } catch {
        return {
          status: 400,
          jsonBody: { error: 'Failed to parse training plan JSON from response' },
        };
      }

      // Map each session, assigning a UUID and defaulting completed to false
      const sessions: PlanSession[] = parsedSessions.map((s) => ({
        id: randomUUID(),
        date: s.date,
        distance: s.distance,
        duration: s.duration,
        avgPace: s.avgPace,
        avgBpm: s.avgBpm,
        notes: s.notes ?? '',
        completed: false,
      }));

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
            sessions,
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
