import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../shared/db.js';
import { ChatMessage } from '../shared/types.js';

app.http('getMessages', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'messages',
  handler: async (req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requireAuth(req);
    if (denied) return denied;

    const planId = req.query.get('planId');
    if (!planId) {
      return { status: 400, jsonBody: { error: 'planId query parameter is required' } };
    }

    const db = await getDb();
    const results = await db.collection<ChatMessage>('messages').find({ planId }).sort({ timestamp: 1 }).toArray();

    return { status: 200, jsonBody: { messages: results } };
  },
});
