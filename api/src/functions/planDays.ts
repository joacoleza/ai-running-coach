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

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { status: 400, jsonBody: { error: 'Invalid date format. Expected YYYY-MM-DD.' } };
    }

    let body: {
      guidelines?: string;
      objective_kind?: string;
      objective_value?: string;
      objective_unit?: string;
      completed?: string;
      skipped?: string;
      type?: string;
      newDate?: string;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const db = await getDb();

    // Reschedule: swap old date → rest, new date → run (copy details)
    if (body.newDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.newDate)) {
        return { status: 400, jsonBody: { error: 'Invalid newDate format. Expected YYYY-MM-DD.' } };
      }

      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] } });
      const currentDay = plan?.phases.flatMap(p => p.weeks.flatMap(w => w.days)).find(d => d.date === date);
      if (!plan || !currentDay) {
        return { status: 404, jsonBody: { error: 'Day not found' } };
      }

      const swapSet: Record<string, unknown> = {
        'phases.$[].weeks.$[].days.$[oldDay].type': 'rest',
        'phases.$[].weeks.$[].days.$[oldDay].guidelines': 'Rest day',
        'phases.$[].weeks.$[].days.$[oldDay].completed': false,
        'phases.$[].weeks.$[].days.$[oldDay].skipped': false,
        'phases.$[].weeks.$[].days.$[newDay].type': currentDay.type,
        'phases.$[].weeks.$[].days.$[newDay].guidelines': currentDay.guidelines,
        'phases.$[].weeks.$[].days.$[newDay].completed': false,
        'phases.$[].weeks.$[].days.$[newDay].skipped': false,
      };
      if (currentDay.objective) {
        swapSet['phases.$[].weeks.$[].days.$[newDay].objective'] = currentDay.objective;
      }

      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] } },
        {
          $set: swapSet,
          $unset: { 'phases.$[].weeks.$[].days.$[oldDay].objective': '' },
          $currentDate: { updatedAt: true },
        } as any,
        {
          arrayFilters: [{ 'oldDay.date': date }, { 'newDay.date': body.newDate }],
          returnDocument: 'after',
        },
      );

      if (!result) return { status: 404, jsonBody: { error: 'Day not found' } };
      return { status: 200, jsonBody: { plan: result } };
    }

    // Field updates (guidelines, objective, completed, skipped, type)
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
    if (body.completed === 'true' || (body.completed as unknown) === true) {
      $set['phases.$[].weeks.$[].days.$[day].completed'] = true;
    } else if (body.completed === 'false' || (body.completed as unknown) === false) {
      $set['phases.$[].weeks.$[].days.$[day].completed'] = false;
    }
    if (body.skipped === 'true' || (body.skipped as unknown) === true) {
      $set['phases.$[].weeks.$[].days.$[day].skipped'] = true;
    } else if (body.skipped === 'false' || (body.skipped as unknown) === false) {
      $set['phases.$[].weeks.$[].days.$[day].skipped'] = false;
    }

    if (Object.keys($set).length === 0) {
      return { status: 400, jsonBody: { error: 'No valid fields to update' } };
    }

    try {
      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] } },
        { $set, $currentDate: { updatedAt: true } },
        { arrayFilters: [{ 'day.date': date }], returnDocument: 'after' },
      );
      if (!result) return { status: 404, jsonBody: { error: 'Day not found' } };
      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error patching day:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
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
      return { status: 400, jsonBody: { error: 'Invalid date format. Expected YYYY-MM-DD.' } };
    }

    try {
      const db = await getDb();

      // Refuse to delete a completed day
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] } });
      const targetDay = plan?.phases.flatMap(p => p.weeks.flatMap(w => w.days)).find(d => d.date === date);
      if (targetDay?.completed) {
        return { status: 409, jsonBody: { error: 'Cannot remove a completed day' } };
      }

      // Convert to rest day rather than removing — weeks always keep 7 days
      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] } },
        {
          $set: {
            'phases.$[].weeks.$[].days.$[day].type': 'rest',
            'phases.$[].weeks.$[].days.$[day].guidelines': 'Rest day',
            'phases.$[].weeks.$[].days.$[day].completed': false,
            'phases.$[].weeks.$[].days.$[day].skipped': false,
          },
          $unset: { 'phases.$[].weeks.$[].days.$[day].objective': '' },
          $currentDate: { updatedAt: true },
        } as any,
        { arrayFilters: [{ 'day.date': date }], returnDocument: 'after' },
      );

      if (!result) return { status: 404, jsonBody: { error: 'Plan not found' } };
      return { status: 200, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error converting day to rest:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});

app.http('addDay', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plan/days',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    let body: {
      date?: string;
      type?: string;
      guidelines?: string;
      objective_kind?: string;
      objective_value?: string;
      objective_unit?: string;
      // phaseName and weekNumber accepted but not used for DB lookup (date is unique within plan)
      phaseName?: string;
      weekNumber?: number;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const { date, type, guidelines } = body;

    if (!date || !type) {
      return { status: 400, jsonBody: { error: 'date and type are required' } };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { status: 400, jsonBody: { error: 'Invalid date format. Expected YYYY-MM-DD.' } };
    }
    if (type !== 'run' && type !== 'cross-train') {
      return { status: 400, jsonBody: { error: 'type must be run or cross-train' } };
    }

    // Refuse to add a day on a past date
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return { status: 400, jsonBody: { error: `Cannot add a training day in the past (${date} is before today ${today})` } };
    }

    const $set: Record<string, unknown> = {
      'phases.$[].weeks.$[].days.$[day].type': type,
      'phases.$[].weeks.$[].days.$[day].guidelines': guidelines ?? '',
      'phases.$[].weeks.$[].days.$[day].completed': false,
      'phases.$[].weeks.$[].days.$[day].skipped': false,
    };

    if (body.objective_kind && body.objective_value && body.objective_unit) {
      $set['phases.$[].weeks.$[].days.$[day].objective'] = {
        kind: body.objective_kind,
        value: Number(body.objective_value),
        unit: body.objective_unit,
      };
    }

    try {
      const db = await getDb();
      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: 'active' },
        { $set, $currentDate: { updatedAt: true } },
        { arrayFilters: [{ 'day.date': date }], returnDocument: 'after' },
      );

      if (!result) return { status: 404, jsonBody: { error: 'Plan or day not found' } };
      return { status: 201, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error adding day:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});
