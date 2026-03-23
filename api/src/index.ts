import { app } from '@azure/functions';

app.setup({ enableHttpStream: true });

import './functions/health.js';
import './functions/ping.js';
import './functions/chat.js';
import './functions/plan.js';
import './functions/sessions.js';
