import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// Unauthenticated liveness probe — used by Playwright webServer readiness check
app.http('ping', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ping',
  handler: async (_req: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    return { status: 200, jsonBody: { status: 'ok' } };
  },
});
