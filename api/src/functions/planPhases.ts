import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ObjectId } from 'mongodb';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import type { Plan, PlanPhase } from '../shared/types.js';
import { assignPlanStructure } from '../shared/planUtils.js';

app.http('patchPhase', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'plan/phases/{phaseIndex}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req);
    if (denied) return denied;
    const { userId } = getAuthContext(req);

    const phaseIndexParam = req.params['phaseIndex'];
    const phaseIndex = Number(phaseIndexParam);
    if (!phaseIndexParam || isNaN(phaseIndex) || phaseIndex < 0 || !Number.isInteger(phaseIndex)) {
      return { status: 400, jsonBody: { error: 'Invalid phaseIndex. Expected a non-negative integer.' } };
    }

    let body: { name?: string; description?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    if (!body.name && body.description === undefined) {
      return { status: 400, jsonBody: { error: 'At least one of name or description must be provided' } };
    }

    const db = await getDb();

    try {
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) });
      if (!plan) return { status: 404, jsonBody: { error: 'No active plan found' } };
      if (phaseIndex >= plan.phases.length) {
        return { status: 404, jsonBody: { error: `Phase index ${phaseIndex} does not exist` } };
      }

      const $set: Record<string, unknown> = {};
      if (body.name !== undefined) {
        $set[`phases.${phaseIndex}.name`] = body.name;
      }
      if (body.description !== undefined) {
        $set[`phases.${phaseIndex}.description`] = body.description;
      }

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) },
        { $set, $currentDate: { updatedAt: true } },
        { returnDocument: 'after' },
      );
      if (!result) return { status: 404, jsonBody: { error: 'Plan not found' } };
      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error patching phase:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

app.http('addPhase', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/phases',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req);
    if (denied) return denied;
    const { userId } = getAuthContext(req);

    let body: { name?: string; description?: string } = {};
    try { body = (await req.json()) as typeof body; } catch { /* body is optional */ }

    const db = await getDb();
    try {
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) });
      if (!plan) return { status: 404, jsonBody: { error: 'No active plan found' } };

      const newPhase: PlanPhase = {
        name: body.name?.trim() || `Phase ${plan.phases.length + 1}`,
        description: body.description ?? '',
        weeks: [{ weekNumber: 0, days: [] }],
      };

      // CRITICAL: use assignPlanStructure to assign correct sequential week numbers
      // Do NOT use $push alone — week numbers must be recomputed globally
      const updatedPhases = assignPlanStructure([...plan.phases, newPhase]);
      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) },
        { $set: { phases: updatedPhases, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      if (!result) return { status: 404, jsonBody: { error: 'Plan not found' } };
      return { status: 201, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error adding phase:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

app.http('addWeekToPhase', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/phases/{phaseIndex}/weeks',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req);
    if (denied) return denied;
    const { userId } = getAuthContext(req);

    const phaseIndexParam = req.params['phaseIndex'];
    const phaseIndex = Number(phaseIndexParam);
    if (!phaseIndexParam || isNaN(phaseIndex) || phaseIndex < 0 || !Number.isInteger(phaseIndex)) {
      return { status: 400, jsonBody: { error: 'Invalid phaseIndex. Expected a non-negative integer.' } };
    }

    const db = await getDb();
    try {
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) });
      if (!plan) return { status: 404, jsonBody: { error: 'No active plan found' } };
      if (phaseIndex >= plan.phases.length) {
        return { status: 404, jsonBody: { error: `Phase index ${phaseIndex} does not exist` } };
      }

      const updatedPhases = plan.phases.map((phase, i) =>
        i === phaseIndex
          ? { ...phase, weeks: [...phase.weeks, { weekNumber: 0, days: [] }] }
          : phase
      );
      const recomputed = assignPlanStructure(updatedPhases);

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) },
        { $set: { phases: recomputed, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      if (!result) return { status: 404, jsonBody: { error: 'Plan not found' } };
      return { status: 201, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error adding week to phase:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

app.http('deleteLastWeekOfPhase', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'plan/phases/{phaseIndex}/weeks/last',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req);
    if (denied) return denied;
    const { userId } = getAuthContext(req);

    const phaseIndexParam = req.params['phaseIndex'];
    const phaseIndex = Number(phaseIndexParam);
    if (!phaseIndexParam || isNaN(phaseIndex) || phaseIndex < 0 || !Number.isInteger(phaseIndex)) {
      return { status: 400, jsonBody: { error: 'Invalid phaseIndex. Expected a non-negative integer.' } };
    }

    const db = await getDb();
    try {
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) });
      if (!plan) return { status: 404, jsonBody: { error: 'No active plan found' } };
      if (phaseIndex >= plan.phases.length) {
        return { status: 404, jsonBody: { error: `Phase index ${phaseIndex} does not exist` } };
      }

      const phase = plan.phases[phaseIndex];

      if (phase.weeks.length <= 1) {
        return { status: 400, jsonBody: { error: 'Cannot delete the only week in a phase' } };
      }

      const lastWeek = phase.weeks[phase.weeks.length - 1];
      if (lastWeek.days.some(d => d.type !== 'rest')) {
        return { status: 400, jsonBody: { error: 'Cannot delete a week that contains workout days' } };
      }

      const updatedPhases = plan.phases.map((p, i) =>
        i === phaseIndex
          ? { ...p, weeks: p.weeks.slice(0, -1) }
          : p
      );
      const recomputed = assignPlanStructure(updatedPhases);

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) },
        { $set: { phases: recomputed, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );
      if (!result) return { status: 404, jsonBody: { error: 'Plan not found' } };
      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error deleting last week of phase:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

app.http('deleteLastPhase', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'plan/phases/last',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req);
    if (denied) return denied;
    const { userId } = getAuthContext(req);

    const db = await getDb();

    try {
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) });
      if (!plan) return { status: 404, jsonBody: { error: 'No active plan found' } };

      if (plan.phases.length <= 1) {
        return { status: 400, jsonBody: { error: 'Cannot delete the only phase' } };
      }

      const lastPhase = plan.phases[plan.phases.length - 1];
      const hasCompletedDays = lastPhase.weeks.flatMap(w => w.days).some(d => d.completed);
      if (hasCompletedDays) {
        return { status: 409, jsonBody: { error: 'Cannot delete a phase with completed days' } };
      }

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] }, userId: new ObjectId(userId) },
        { $pop: { phases: 1 }, $currentDate: { updatedAt: true } } as any,
        { returnDocument: 'after' },
      );
      if (!result) return { status: 404, jsonBody: { error: 'Plan not found' } };
      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error deleting last phase:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});
