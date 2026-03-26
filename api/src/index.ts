import { app } from '@azure/functions';

app.setup({ enableHttpStream: true });

import './functions/health.js';
import './functions/ping.js';
import './functions/chat.js';
import './functions/messages.js';
import './functions/plan.js';
import './functions/planDays.js';
import './functions/planArchive.js';
import './functions/sessions.js';
