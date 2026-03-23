import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requirePassword } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { PlanSession } from '../shared/types.js';

app.http('updateSession', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const sessionId = req.params.sessionId;
    if (!sessionId) {
      return { status: 400, jsonBody: { error: 'sessionId is required' } };
    }

    const updates = (await req.json()) as Partial<PlanSession>;
    // Remove id from updates to prevent overwriting the session identifier
    delete (updates as Record<string, unknown>).id;

    const db = await getDb();

    // Build $set object for positional update: sessions.$.field = value
    const setObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      setObj[`sessions.$.${key}`] = value;
    }
    setObj['updatedAt'] = new Date();

    const result = await db.collection('plans').updateOne(
      { 'sessions.id': sessionId },
      { $set: setObj },
    );

    if (result.matchedCount === 0) {
      return { status: 404, jsonBody: { error: 'Session not found' } };
    }

    return { status: 200, jsonBody: { ok: true } };
  },
});
