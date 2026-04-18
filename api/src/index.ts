import { app } from '@azure/functions';
import { runStartupMigration } from './shared/migration.js';

app.setup({ enableHttpStream: true });

runStartupMigration().catch((err) =>
  console.error('[migration] Startup migration failed:', err)
);

import './functions/health.js';
import './functions/auth.js';
import './functions/ping.js';
import './functions/chat.js';
import './functions/messages.js';
import './functions/plan.js';
import './functions/planDays.js';
import './functions/planPhases.js';
import './functions/planArchive.js';
import './functions/runs.js';
import './functions/keepAlive.js';
