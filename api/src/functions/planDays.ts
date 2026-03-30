import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import type { Plan } from '../shared/types.js';

app.http('patchDay', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'plan/days/{week}/{day}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const weekParam = req.params['week'];
    const dayParam = req.params['day'];

    const week = Number(weekParam);
    if (!weekParam || isNaN(week) || week < 1 || !Number.isInteger(week)) {
      return { status: 400, jsonBody: { error: 'Invalid week number. Expected a positive integer.' } };
    }
    if (!dayParam || !/^[A-G]$/.test(dayParam)) {
      return { status: 400, jsonBody: { error: 'Invalid day label. Expected a single uppercase letter A-G.' } };
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

    const db = await getDb();

    // Field updates (guidelines, objective, completed, skipped, type)
    const $set: Record<string, unknown> = {};

    if (body.guidelines !== undefined) {
      $set['phases.$[].weeks.$[week].days.$[day].guidelines'] = body.guidelines;
    }
    if (body.objective_kind && body.objective_value && body.objective_unit) {
      $set['phases.$[].weeks.$[week].days.$[day].objective'] = {
        kind: body.objective_kind,
        value: Number(body.objective_value),
        unit: body.objective_unit,
      };
    }
    if (body.type !== undefined) {
      $set['phases.$[].weeks.$[week].days.$[day].type'] = body.type;
    }
    if (body.completed === 'true' || (body.completed as unknown) === true) {
      $set['phases.$[].weeks.$[week].days.$[day].completed'] = true;
    } else if (body.completed === 'false' || (body.completed as unknown) === false) {
      $set['phases.$[].weeks.$[week].days.$[day].completed'] = false;
    }
    if (body.skipped === 'true' || (body.skipped as unknown) === true) {
      $set['phases.$[].weeks.$[week].days.$[day].skipped'] = true;
    } else if (body.skipped === 'false' || (body.skipped as unknown) === false) {
      $set['phases.$[].weeks.$[week].days.$[day].skipped'] = false;
    }

    if (Object.keys($set).length === 0) {
      return { status: 400, jsonBody: { error: 'No valid fields to update' } };
    }

    try {
      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] } },
        { $set, $currentDate: { updatedAt: true } },
        {
          arrayFilters: [{ 'week.weekNumber': week }, { 'day.label': dayParam }],
          returnDocument: 'after',
        },
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
  route: 'plan/days/{week}/{day}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const weekParam = req.params['week'];
    const dayParam = req.params['day'];

    const week = Number(weekParam);
    if (!weekParam || isNaN(week) || week < 1 || !Number.isInteger(week)) {
      return { status: 400, jsonBody: { error: 'Invalid week number. Expected a positive integer.' } };
    }
    if (!dayParam || !/^[A-G]$/.test(dayParam)) {
      return { status: 400, jsonBody: { error: 'Invalid day label. Expected a single uppercase letter A-G.' } };
    }

    try {
      const db = await getDb();

      // Refuse to delete a completed day
      const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] } });
      const targetDay = plan?.phases
        .flatMap(p => p.weeks.flatMap(w => w.weekNumber === week ? w.days : []))
        .find(d => d.label === dayParam);
      if (targetDay?.completed) {
        return { status: 409, jsonBody: { error: 'Cannot remove a completed day' } };
      }

      // Convert to rest day rather than removing — weeks always have rest day slots
      const result = await db.collection<Plan>('plans').findOneAndUpdate(
        { status: { $in: ['active', 'onboarding'] } },
        {
          $set: {
            'phases.$[].weeks.$[week].days.$[day].type': 'rest',
            'phases.$[].weeks.$[week].days.$[day].guidelines': 'Rest day',
            'phases.$[].weeks.$[week].days.$[day].label': '',
            'phases.$[].weeks.$[week].days.$[day].completed': false,
            'phases.$[].weeks.$[week].days.$[day].skipped': false,
          },
          $unset: { 'phases.$[].weeks.$[week].days.$[day].objective': '' },
          $currentDate: { updatedAt: true },
        } as any,
        {
          arrayFilters: [{ 'week.weekNumber': week }, { 'day.label': dayParam }],
          returnDocument: 'after',
        },
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
      weekNumber?: number;
      label?: string;
      type?: string;
      guidelines?: string;
      objective_kind?: string;
      objective_value?: string;
      objective_unit?: string;
      completed?: string | boolean;
      skipped?: string | boolean;
      phaseName?: string;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return { status: 400, jsonBody: { error: 'Invalid JSON body' } };
    }

    const { weekNumber, label, type, guidelines } = body;

    if (!weekNumber || !label || !type) {
      return { status: 400, jsonBody: { error: 'weekNumber, label, and type are required' } };
    }
    if (typeof weekNumber !== 'number' || weekNumber < 1 || !Number.isInteger(weekNumber)) {
      return { status: 400, jsonBody: { error: 'weekNumber must be a positive integer' } };
    }
    if (!/^[A-G]$/.test(label)) {
      return { status: 400, jsonBody: { error: 'label must be a single uppercase letter A-G' } };
    }
    if (type !== 'run' && type !== 'cross-train') {
      return { status: 400, jsonBody: { error: 'type must be run or cross-train' } };
    }

    const completedVal = body.completed === 'true' || (body.completed as unknown) === true ? true : false;
    const skippedVal = body.skipped === 'true' || (body.skipped as unknown) === true ? true : false;

    const $set: Record<string, unknown> = {
      'phases.$[].weeks.$[week].days.$[day].type': type,
      'phases.$[].weeks.$[week].days.$[day].label': label,
      'phases.$[].weeks.$[week].days.$[day].guidelines': guidelines ?? '',
      'phases.$[].weeks.$[week].days.$[day].completed': completedVal,
      'phases.$[].weeks.$[week].days.$[day].skipped': skippedVal,
    };

    if (body.objective_kind && body.objective_value && body.objective_unit) {
      $set['phases.$[].weeks.$[week].days.$[day].objective'] = {
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
        {
          arrayFilters: [{ 'week.weekNumber': weekNumber }, { 'day.label': '' }],
          returnDocument: 'after',
        },
      );

      if (!result) return { status: 404, jsonBody: { error: 'Plan or rest-day slot not found' } };
      return { status: 201, jsonBody: { plan: result } };
    } catch (err) {
      context.log('Error adding day:', err);
      return { status: 503, jsonBody: { error: 'Service temporarily unavailable' } };
    }
  },
});
