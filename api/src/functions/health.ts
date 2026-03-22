import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { checkBlocked } from '../middleware/auth.js';

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('Health check requested');

    const blocked = await checkBlocked();
    if (blocked) {
      return {
        status: 503,
        jsonBody: {
          status: 'locked',
          timestamp: new Date().toISOString(),
          error: 'Service temporarily unavailable',
        },
      };
    }

    return {
      status: 200,
      jsonBody: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  },
});
