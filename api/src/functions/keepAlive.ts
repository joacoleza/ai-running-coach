import { app, InvocationContext, Timer } from '@azure/functions';

// Timer trigger that fires every 20 minutes to prevent cold starts on the Consumption plan.
// The invocation itself keeps the function app warm — no external HTTP call needed.
app.timer('keepAlive', {
  schedule: '0 */20 * * * *',
  runOnStartup: false,
  handler: async (_myTimer: Timer, context: InvocationContext): Promise<void> => {
    context.log('Keep-alive ping');
  },
});
