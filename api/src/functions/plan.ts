import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { Plan, PlanGoal, PlanPhase } from '../shared/types.js';
import { normalizeWeekDays } from '../shared/planUtils.js';

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

      // Refuse to start a new plan if there's already an active plan with training history —
      // the user must archive first to avoid losing completed-day records
      const activePlanWithHistory = await db.collection<Plan>('plans').findOne({
        status: 'active',
        'phases.weeks.days.completed': true,
      });
      if (activePlanWithHistory) {
        return {
          status: 409,
          jsonBody: {
            error: 'Cannot start a new plan while training history exists. Archive your current plan first.',
          },
        };
      }

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

      let parsedPlan: { goal?: PlanGoal; phases: PlanPhase[] };
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

      // Derive objective from the goal embedded in the training plan JSON (more reliable than client extraction)
      const resolvedGoal: PlanGoal = parsedPlan.goal ?? goal;
      function deriveObjective(eventType?: string): Plan['objective'] | undefined {
        if (!eventType) return undefined;
        const et = eventType.toLowerCase().replace(/[\s_]+/g, '-');
        if (et.includes('half')) return 'half-marathon';
        if (et.includes('marathon')) return 'marathon';
        if (et.includes('15k')) return '15km';
        if (et.includes('10k')) return '10km';
        if (et.includes('5k')) return '5km';
        return undefined;
      }
      const resolvedObjective = deriveObjective(resolvedGoal?.eventType) ?? objective;

      // Past run/cross-train days are intentionally preserved — the user may have provided their
      // recent training history during onboarding and Claude will mark those days completed/skipped.
      // Only future sessions without completed/skipped flags count as upcoming training.

      // Normalize every week to exactly 7 days (Mon–Sun), filling gaps with rest days
      const normalizedPhases = parsedPlan.phases.map((phase: PlanPhase) => ({
        ...phase,
        weeks: phase.weeks.map(normalizeWeekDays),
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

      // Refuse to replace a plan that has any completed days — history must not be erased.
      // Check 1: the specific plan being updated
      const existingPlan = await db.collection<Plan>('plans').findOne({ _id: objectId });
      if (existingPlan) {
        const hasCompleted = existingPlan.phases
          ?.flatMap(p => p.weeks.flatMap(w => w.days))
          .some(d => d.completed);
        if (hasCompleted) {
          return {
            status: 409,
            jsonBody: {
              error: 'Cannot replace a plan that has completed days. Use plan:add and plan:update commands to make targeted changes instead.',
            },
          };
        }
      }
      // Check 2: any other active plan with completed days (guards against stale-client planId exploits
      // where the client sends a newer onboarding plan's ID that has no history, while the real active
      // plan with completed days still exists in the DB)
      const otherActiveWithHistory = await db.collection<Plan>('plans').findOne({
        status: 'active',
        'phases.weeks.days.completed': true,
      });
      if (otherActiveWithHistory) {
        return {
          status: 409,
          jsonBody: {
            error: 'Cannot replace a plan that has completed days. Use plan:add and plan:update commands to make targeted changes instead.',
          },
        };
      }

      const now = new Date();
      const updateResult = await db.collection<Plan>('plans').findOneAndUpdate(
        { _id: objectId },
        {
          $set: {
            status: 'active',
            goal: resolvedGoal,
            phases: normalizedPhases,
            objective: resolvedObjective,
            targetDate: resolvedGoal?.targetDate ?? goal?.targetDate,
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
