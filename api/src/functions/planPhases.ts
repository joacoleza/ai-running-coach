import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import type { Plan } from '../shared/types.js';

app.http('patchPhase', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'plan/phases/{phaseIndex}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

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
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] } });
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
        { status: { $in: ['active', 'onboarding'] } },
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

app.http('deleteLastPhase', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'plan/phases/last',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const db = await getDb();

    try {
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] } });
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
        { status: { $in: ['active', 'onboarding'] } },
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
