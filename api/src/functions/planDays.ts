import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import type { Plan } from '../shared/types.js';

app.http('patchDay', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'plan/days/{date}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const date = req.params['date'];

    // Validate date format YYYY-MM-DD
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format. Expected YYYY-MM-DD.' },
      };
    }

    let body: {
      guidelines?: string;
      objective_kind?: string;
      objective_value?: string;
      objective_unit?: string;
      completed?: string;
      skipped?: string;
      type?: string;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const $set: Record<string, unknown> = {};

    if (body.guidelines !== undefined) {
      $set['phases.$[].weeks.$[].days.$[day].guidelines'] = body.guidelines;
    }

    if (body.objective_kind && body.objective_value && body.objective_unit) {
      $set['phases.$[].weeks.$[].days.$[day].objective'] = {
        kind: body.objective_kind,
        value: Number(body.objective_value),
        unit: body.objective_unit,
      };
    }

    if (body.type !== undefined) {
      $set['phases.$[].weeks.$[].days.$[day].type'] = body.type;
    }

    if (body.completed === 'true') {
      $set['phases.$[].weeks.$[].days.$[day].completed'] = true;
    } else if (body.completed === 'false') {
      $set['phases.$[].weeks.$[].days.$[day].completed'] = false;
    }

    if (body.skipped === 'true') {
      $set['phases.$[].weeks.$[].days.$[day].skipped'] = true;
    } else if (body.skipped === 'false') {
      $set['phases.$[].weeks.$[].days.$[day].skipped'] = false;
    }

    if (Object.keys($set).length === 0) {
      return { status: 400, jsonBody: { error: 'No valid fields to update' } };
    }

    try {
      const db = await getDb();

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: 'active' },
        {
          $set,
          $currentDate: { updatedAt: true },
        },
        {
          arrayFilters: [{ 'day.date': date }],
          returnDocument: 'after',
        },
      );

      if (!result) {
        return {
          status: 404,
          jsonBody: { error: 'Day not found' },
        };
      }

      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error patching day:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});

app.http('deleteDay', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'plan/days/{date}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const date = req.params['date'];

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format. Expected YYYY-MM-DD.' },
      };
    }

    try {
      const db = await getDb();

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: 'active' },
        {
          $pull: { 'phases.$[].weeks.$[].days': { date } } as unknown as Record<string, unknown>,
          $currentDate: { updatedAt: true },
        },
        { returnDocument: 'after' },
      );

      if (!result) {
        return { status: 404, jsonBody: { error: 'Plan not found' } };
      }

      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error deleting day:', err);
      return {
        status: 503,
        jsonBody: { error: 'Service temporarily unavailable' },
      };
    }
  },
});
