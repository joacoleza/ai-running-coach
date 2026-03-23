# Phase 2: Coach Chat & Plan Generation - Research

**Researched:** 2026-03-23
**Domain:** Anthropic Claude API streaming, Azure Functions v4 SSE, MongoDB chat persistence, react-big-calendar
**Confidence:** HIGH (stack verified against official sources and npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two ways to start a plan: (1) conversational from scratch — coach asks 4–6 questions sequentially; (2) paste text from an external LLM conversation — coach reads it and derives the plan from that context. No profile form in either case.
- **D-02:** Onboarding is once per active plan. When a plan is completed or discarded, it becomes read-only. A new onboarding starts a new active plan.
- **D-03:** Mid-onboarding state persists — if the user closes the browser after 3 of 6 questions, the next visit resumes from that point. There must also be a visible "start over" option to restart the onboarding from scratch.
- **D-04:** Plan/goal details (goal type, target date, etc.) are visible after onboarding but not editable. The display can be dismissed/collapsed. Editing the plan details would require asking the coach or starting a new plan.
- **D-05:** The session schema stored in MongoDB is: `date`, `distance`, `duration`, `avgPace`, `avgBpm`, `notes` (free-text). This replaces the ROADMAP's `type/pace-target/HR-zone/notes` schema. The session type label (EASY/LONG/etc.) may still be derived from or stored in the free-text `notes` field if the coach includes it.
- **D-06:** Sessions are clickable — clicking opens a detail view with all fields. Fields are inline-editable so the user can correct LLM mistakes without re-prompting the coach.
- **D-07:** `react-big-calendar` weekly view is the primary view. The entire plan must be navigable — use prev/next week arrows for plans spanning multiple weeks.
- **D-08:** Color coding, session card layout, and visual differentiation between session types is Claude's discretion for first implementation. User will provide feedback after seeing it.
- **D-09:** Session block shows minimum: date + distance. Full details (duration, avgPace, avgBpm, notes) visible on click.
- **D-10:** `/coach` page has two tabs: "Chat" (active conversation) and "History" (past conversations for the current plan). Previous plan conversations are accessible from within that plan's record (out of scope for this phase — Phase 4 territory).
- **D-11:** The chat UI is the same component throughout onboarding and ongoing coaching. A step title in the header indicates the current mode: "Onboarding" during initial setup, "Coach Chat" once the plan exists.
- **D-12:** The rolling 20-message window + condensed memory summary mechanic is purely backend. No UI indication that the coach is working from a summary.
- **D-13:** During plan generation, show a loading indicator in the chat (spinner or "Generating your plan..." message). The streaming response content itself serves as the progress once generation begins.
- **D-14:** On Claude API success: the coach's streamed response contains the plan. The backend parses the JSON from the streamed content, saves it to MongoDB, and the frontend receives a "plan ready" signal at stream end.
- **D-15:** On JSON parse failure: surface an error message to the user in the chat ("Something went wrong generating your plan"), log full error detail server-side, and show a retry button. No silent retry.
- **D-16:** Post-generation routing: Claude's discretion (easiest approach — likely a coach message saying the plan is ready with a link or cue to navigate to Training Plan).

### Claude's Discretion

- Color scheme and visual style for session type differentiation on the calendar
- Whether to use SSE or chunked transfer for streaming (SSE preferred per ROADMAP)
- Active thread management (whether user can start a new conversation mid-plan or always has one active thread)
- Exact plan-ready follow-up message from coach after generation succeeds
- MongoDB collection/document structure for chat messages and plan sessions

### Deferred Ideas (OUT OF SCOPE)

- Chat history for previous plans (different plan's conversations) — Phase 4 territory
- Editable plan details (goal type, target date) — would require new plan or coach intervention
- Plan export to calendar format — v1.2 per ROADMAP next milestone ideas
- Settings page for display units (km/miles) — not yet placed; capture for Phase 4 or a dedicated settings phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GOAL-01 | User can set a running goal (event type: 5K/10K/half marathon/marathon, target date) | Collected via onboarding chat; stored in `plans` collection with goal metadata |
| GOAL-02 | User can set profile preferences (current weekly mileage, available days per week, display units: km/miles) | Collected via onboarding chat questions; stored in `plans.profile` subdoc |
| GOAL-03 | Coach conducts an onboarding chat session to gather context before generating the first plan | Implemented as multi-turn Claude conversation; state persists in `messages` collection |
| PLAN-01 | Coach generates a structured training plan from goal and onboarding context | Claude API with structured JSON prompt; parsed server-side after stream completion |
| PLAN-02 | Training plan stored with sessions: date, distance, duration, avgPace, avgBpm, notes | D-05 schema; stored as array in `plans` collection document |
| PLAN-03 | User can view the training plan as a weekly calendar | react-big-calendar 1.19.4 weekly view; sessions mapped to calendar events |
| PLAN-04 | Plan sessions can be marked complete (automatically when a matched run is logged) | `completed` boolean field on session; PATCH endpoint; auto-match in Phase 3 |
| COACH-01 | Chat interface for back-and-forth conversation with the AI coach | React chat UI; `/coach` page with Chat + History tabs |
| COACH-02 | Coach responses stream to the UI in real-time (no waiting for full response) | Azure Functions v4 streaming + ReadableStream + SSE relay |
| COACH-05 | Chat history persists across sessions (user can review past coaching conversations) | MongoDB `messages` collection; History tab reads stored messages |
| COACH-06 | Claude context uses rolling 20-message window + condensed memory summary | Backend-only: query last 20 messages, prepend summary; purely server-side |
</phase_requirements>

---

## Summary

Phase 2 builds the core product loop: conversational onboarding, AI plan generation, and calendar display. The technical work falls into four independent domains that can be developed in parallel: (1) Claude API integration with SSE streaming relay through Azure Functions v4, (2) MongoDB schema for chat messages and training plans, (3) the coach chat React UI with tab navigation, and (4) the training plan calendar using react-big-calendar.

The most critical technical risk is the **Azure Static Web Apps (SWA) SSE streaming proxy issue**. GitHub issue #1180 on the Azure/static-web-apps repo documents a known, unresolved bug where streaming responses from linked Function App backends arrive as a single buffered payload rather than as a stream. This means streaming works locally and when hitting the Function App directly, but fails when requests go through the SWA `/api` proxy in production. The plan must account for this: either by calling the Function App URL directly from the frontend (bypassing SWA proxy) or by using polling as a fallback. Research recommends the direct URL approach with CORS headers on the Function App.

The second important finding is that `app.setup({ enableHttpStream: true })` must be added to `api/src/index.ts` before streaming will work, and requires `@azure/functions >= 4.3.0` (current version in project: `^4.11.2` — satisfied).

**Primary recommendation:** Stream Claude responses via Azure Functions v4 `ReadableStream` with `enableHttpStream: true`. For SWA production, call the Function App URL directly from the frontend (not via `/api` proxy) with CORS configured on the Function App. Use SSE-formatted text chunks relayed from the Anthropic SDK stream.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.80.0 | Claude API client with streaming | Official SDK; handles SSE parsing, retries, TypeScript types |
| `react-big-calendar` | 1.19.4 | Training plan calendar UI | Locked in by D-07; supports weekly view, custom event rendering |
| `date-fns` | 4.1.0 | Date localizer for react-big-calendar | Lighter than moment.js; tree-shakeable; already in ecosystem |
| `@types/react-big-calendar` | 1.16.3 | TypeScript types for calendar | Required for TypeScript project |
| `mongodb` | ^7.1.0 | MongoDB driver | Already in project; reuse existing `getDb()` pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@azure/functions` | ^4.11.2 | Azure Functions v4 (already installed) | Required for streaming; satisfies >= 4.3.0 requirement |
| `date-fns/locale` | (bundled with date-fns) | Calendar locale for week start | Needed for `dateFnsLocalizer` setup |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `date-fns` localizer | `moment` localizer | moment is deprecated, 70KB+ vs date-fns tree-shakeable; date-fns preferred |
| Direct Function App URL for streaming | SWA `/api` proxy | SWA proxy buffers SSE (known bug #1180); direct URL avoids this at cost of CORS config |
| SSE format | Chunked Transfer-Encoding | SSE gives structured events with `data:` prefix; easier to parse; EventSource API in browser |

**Installation (api/):**
```bash
cd api && npm install @anthropic-ai/sdk
```

**Installation (web/):**
```bash
cd web && npm install react-big-calendar date-fns @types/react-big-calendar
```

**Version verification (confirmed 2026-03-23):**
- `@anthropic-ai/sdk`: 0.80.0 (published March 18, 2026)
- `react-big-calendar`: 1.19.4
- `date-fns`: 4.1.0
- `@types/react-big-calendar`: 1.16.3

---

## Architecture Patterns

### Recommended Project Structure

```
api/src/functions/
├── chat.ts          # POST /api/chat — SSE streaming Claude response
├── plan.ts          # GET/POST /api/plan — retrieve or save training plan
└── sessions.ts      # PATCH /api/sessions/:id — update session (inline edit, mark complete)

web/src/
├── pages/
│   ├── Coach.tsx           # /coach — tabs: Chat | History
│   └── TrainingPlan.tsx    # /plan — calendar view
├── components/
│   ├── coach/
│   │   ├── ChatWindow.tsx      # Message list + input; used for both onboarding and chat
│   │   ├── ChatMessage.tsx     # Individual message bubble
│   │   └── ChatHistory.tsx     # History tab: list of past message threads
│   └── plan/
│       ├── PlanCalendar.tsx    # react-big-calendar wrapper; weekly view
│       └── SessionModal.tsx    # Click-to-open session detail; inline editable fields
└── hooks/
    ├── useChat.ts          # Chat state, SSE stream reading, message persistence
    └── usePlan.ts          # Fetch/update plan and sessions
```

### Pattern 1: Azure Functions v4 SSE Streaming

**What:** Enable streaming on the Functions app, return a `ReadableStream` as the response body with SSE-formatted chunks.

**When to use:** The `/api/chat` endpoint relaying Claude API responses to the browser.

**Required setup in `api/src/index.ts`:**
```typescript
// Source: https://techcommunity.microsoft.com/t5/apps-on-azure-blog/azure-functions-support-for-http-streams-in-node-js-is-generally/ba-p/4140209
import { app } from '@azure/functions';
app.setup({ enableHttpStream: true });

import './functions/health.js';
import './functions/ping.js';
import './functions/chat.js';
import './functions/plan.js';
import './functions/sessions.js';
```

**SSE streaming function pattern:**
```typescript
// Source: Azure Functions HTTP streams GA announcement + Anthropic SDK docs
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { requirePassword } from '../middleware/auth.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const { messages, summary } = await req.json() as { messages: Anthropic.MessageParam[], summary?: string };

    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: buildSystemPrompt(summary),
      messages,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        stream.on('text', (text) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        });
        stream.on('message', (message) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, message })}\n\n`));
          controller.close();
        });
        stream.on('error', (err) => {
          context.error('Claude stream error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`));
          controller.close();
        });
      }
    });

    return {
      status: 200,
      body,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',  // Prevents proxy buffering (SWA/nginx)
      },
    };
  },
});
```

**Frontend SSE consumption:**
```typescript
// Source: MDN Web APIs — Using server-sent events (ReadableStream fetch approach, not EventSource)
// EventSource doesn't support POST or custom headers, so use fetch + ReadableStream reader
async function streamChat(messages: Message[], onChunk: (text: string) => void): Promise<void> {
  const response = await fetch('/api/chat', {  // or direct Function App URL in production
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-app-password': localStorage.getItem('app_password') ?? '',
    },
    body: JSON.stringify({ messages }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    // Parse SSE lines: "data: {...}\n\n"
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const payload = JSON.parse(line.slice(6));
        if (payload.text) onChunk(payload.text);
        if (payload.done) return;
      }
    }
  }
}
```

### Pattern 2: MongoDB Collections Schema

**What:** Three collections: `messages` (chat turns), `plans` (active plan + sessions), and `onboarding` (mid-session state).

**When to use:** All new API endpoints read/write these collections via the existing `getDb()` singleton.

```typescript
// messages collection document
interface ChatMessage {
  _id?: ObjectId;
  planId: string;         // links to plan
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  threadId: string;       // for History tab grouping (one thread = one conversation)
}

// plans collection document
interface Plan {
  _id?: ObjectId;
  status: 'onboarding' | 'active' | 'completed' | 'discarded';
  onboardingMode: 'conversational' | 'paste';
  onboardingStep: number; // current question index (0-5); for D-03 resume
  summary?: string;       // condensed memory summary for COACH-06
  goal: {
    eventType: '5K' | '10K' | 'half-marathon' | 'marathon';
    targetDate: string;   // ISO date
    weeklyMileage: number;
    availableDays: number;
    units: 'km' | 'miles';
  };
  sessions: PlanSession[];
  createdAt: Date;
  updatedAt: Date;
}

// session subdocument (D-05 schema)
interface PlanSession {
  id: string;             // uuid for stable reference
  date: string;           // ISO date (YYYY-MM-DD)
  distance: number;       // in goal units (km or miles)
  duration?: number;      // minutes
  avgPace?: string;       // "mm:ss"
  avgBpm?: number;
  notes: string;          // free text; EASY/LONG/TEMPO label embedded here
  completed: boolean;     // PLAN-04
}
```

### Pattern 3: Rolling 20-Message Window + Summary (COACH-06)

**What:** Backend-only context management. Before each Claude call, retrieve the last 20 messages from MongoDB. If a summary exists on the plan document, prepend it as a system context block.

**When to use:** Every call to the `/api/chat` endpoint.

```typescript
// Backend context assembly pattern
async function buildContextMessages(planId: string, db: Db): Promise<Anthropic.MessageParam[]> {
  const messages = await db.collection<ChatMessage>('messages')
    .find({ planId })
    .sort({ timestamp: -1 })
    .limit(20)
    .toArray();

  return messages.reverse().map(m => ({
    role: m.role,
    content: m.content,
  }));
}

// Summary generation — triggered when message count exceeds threshold (e.g., 25)
async function maybeSummarize(planId: string, db: Db, client: Anthropic): Promise<void> {
  const count = await db.collection('messages').countDocuments({ planId });
  if (count < 25) return;

  const allMessages = await db.collection<ChatMessage>('messages')
    .find({ planId })
    .sort({ timestamp: 1 })
    .limit(count - 10)  // summarize all but last 10
    .toArray();

  const summaryResponse = await client.messages.create({
    model: 'claude-haiku-4-5',  // cheap model for summarization
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Summarize this coaching conversation for context:\n\n${allMessages.map(m => `${m.role}: ${m.content}`).join('\n')}`
    }]
  });

  const summary = (summaryResponse.content[0] as { text: string }).text;
  await db.collection('plans').updateOne({ _id: new ObjectId(planId) }, { $set: { summary } });
}
```

### Pattern 4: react-big-calendar with date-fns Localizer

**What:** Weekly calendar view for training sessions. Sessions mapped to calendar event objects.

**When to use:** `TrainingPlan.tsx` page — replace stub with full calendar component.

```typescript
// Source: react-big-calendar README + date-fns localizer docs
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
});

// Map PlanSession to calendar event
interface CalendarEvent {
  title: string;          // e.g., "Easy Run — 8km"
  start: Date;
  end: Date;              // same day as start (all-day-ish block)
  resource: PlanSession;  // full session for click handler
}

function sessionToEvent(session: PlanSession): CalendarEvent {
  const date = new Date(session.date);
  return {
    title: `${session.distance}${session.units} — ${session.notes.split(' ')[0]}`,
    start: date,
    end: date,
    resource: session,
  };
}

// Component
export function PlanCalendar({ sessions }: { sessions: PlanSession[] }) {
  const [selectedSession, setSelectedSession] = useState<PlanSession | null>(null);
  const events = sessions.map(sessionToEvent);

  return (
    <>
      <Calendar
        localizer={localizer}
        events={events}
        defaultView="week"
        views={['week']}
        style={{ height: 600 }}
        onSelectEvent={(event) => setSelectedSession(event.resource)}
        startAccessor="start"
        endAccessor="end"
      />
      {selectedSession && (
        <SessionModal session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </>
  );
}
```

### Anti-Patterns to Avoid

- **Using `EventSource` for streaming:** `EventSource` is GET-only and cannot send POST bodies or custom headers (needed for `x-app-password`). Use `fetch` + `ReadableStream` reader instead.
- **Parsing plan JSON with `JSON.parse` on partial stream:** Wait for the full `message` event (stream complete) before attempting to parse the embedded JSON plan. Partial chunks are not valid JSON.
- **Skipping `app.setup({ enableHttpStream: true })`:** Without this call in `index.ts`, the Azure Functions runtime does not enable streaming support. The response body will be buffered.
- **Trusting the SWA `/api` proxy for streaming in production:** The Azure/static-web-apps issue #1180 (open, unresolved) documents that the SWA linked backend proxy buffers streaming responses. This affects production deployments. Local dev (direct `func start`) is not affected.
- **Registering new functions in `index.ts` without importing:** `api/src/index.ts` must import each new function file (`import './functions/chat.js'`) for `app.http()` registrations to execute.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE parsing from Claude API | Custom EventSource parser | `@anthropic-ai/sdk` stream helper | SDK handles reconnection, partial event buffering, error events |
| Calendar rendering | Custom calendar grid | `react-big-calendar` | Navigation, event layout, overlap detection all handled |
| Date arithmetic for weekly nav | Manual date math | `date-fns` functions | DST edge cases, locale week-start differences |
| Token counting for context window | Character-based estimation | Count messages (20-message window per D-12) | Simpler, deterministic; message count proxy is sufficient for v1 |
| JSON extraction from Claude response | Regex on streamed text | Parse full `finalMessage()` content after stream ends | Streaming text may split across JSON boundaries |

**Key insight:** The Claude SDK's `stream.on('message', ...)` event fires once with the complete assembled `Message` object after streaming ends. Use this event (not individual text chunks) to extract the embedded JSON training plan.

---

## Common Pitfalls

### Pitfall 1: SWA Proxy Buffers SSE in Production

**What goes wrong:** Streaming works locally and in direct Function App calls, but in production the entire response arrives at once. The UI appears to hang, then shows all text at once.

**Why it happens:** Azure Static Web Apps' linked backend proxy does not support streaming (GitHub issue #1180, open since 2023).

**How to avoid:** For the chat streaming endpoint, consider calling the Function App URL directly from the frontend rather than routing through `window.origin/api/`. Alternatively, accept that streaming only works locally for v1 and use the `finalMessage()` non-streaming approach for production. Recommend direct URL approach. The `X-Accel-Buffering: no` response header may help if SWA respects it.

**Warning signs:** SSE works in local dev (`http://localhost:7071`) but production shows single-payload delivery.

### Pitfall 2: `app.setup({ enableHttpStream: true })` Must Run Before Function Registration

**What goes wrong:** Streaming response body is ignored or buffered even though the code returns a `ReadableStream`.

**Why it happens:** The Azure Functions v4 runtime only enables stream support after `app.setup()` is called. Since `index.ts` imports function files that call `app.http()`, `app.setup()` must be called before those imports.

**How to avoid:** Put `app.setup({ enableHttpStream: true })` as the first call in `index.ts`, before any function imports.

**Warning signs:** No streaming locally despite returning `ReadableStream`; `content-type: text/event-stream` header not present in response.

### Pitfall 3: Claude Plan JSON Embedded in Streamed Text

**What goes wrong:** Code tries to parse `JSON.parse(streamedText)` mid-stream and throws because only partial JSON has arrived.

**Why it happens:** Claude generates JSON inline inside its text response as it streams. The JSON is split across multiple SSE chunks.

**How to avoid:** Collect the full streamed text first (accumulate in `useChat` hook), then parse the JSON after the stream closes. Use a clear delimiter in the system prompt (e.g., the JSON block must be enclosed in `<training_plan>...</training_plan>` XML tags) so extraction is reliable.

**Warning signs:** `SyntaxError: Unexpected end of JSON input` in catch blocks.

### Pitfall 4: SSE Chunk Boundary Splitting

**What goes wrong:** A single SSE `data:` event is split across two `ReadableStream` reads, causing the JSON parse to fail on the incomplete first read.

**Why it happens:** TCP does not guarantee that `data: {...}\n\n` arrives in one chunk.

**How to avoid:** Maintain a buffer in the frontend SSE reader. Accumulate chunks until `\n\n` delimiter is found before attempting to parse. The example pattern in this document handles this by splitting on `\n` and checking for `data:` prefix — incomplete lines without the prefix are harmless.

**Warning signs:** Intermittent JSON parse errors on some chunks but not others.

### Pitfall 5: Missing `ANTHROPIC_API_KEY` in `local.settings.json`

**What goes wrong:** Claude API calls fail with `401 Unauthorized` or `ANTHROPIC_API_KEY not set` error.

**Why it happens:** `local.settings.json` is gitignored. The key must be manually added to local dev environment and set in Azure Function App settings for production.

**How to avoid:** Document the required env vars. Add `ANTHROPIC_API_KEY` to `local.settings.json` (gitignored) for local dev. Add to Azure Function App application settings for production. Add a startup check that throws clearly if the key is missing.

**Warning signs:** 500 errors from `/api/chat` with generic error messages.

### Pitfall 6: react-big-calendar CSS Not Imported

**What goes wrong:** Calendar renders with no visual structure — events overlap, grid lines missing, navigation broken.

**Why it happens:** react-big-calendar requires its CSS to be explicitly imported.

**How to avoid:** Import `'react-big-calendar/lib/css/react-big-calendar.css'` in the component or global CSS entry point. With Tailwind v4, this import goes in the component file, not in CSS (since there's no `tailwind.config.js` to extend).

**Warning signs:** Calendar component renders but looks completely unstyled.

---

## Code Examples

### Anthropic SDK — Streaming with Final Message

```typescript
// Source: https://platform.claude.com/docs/en/api/messages-streaming
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// High-level stream — gives text events AND final assembled message
const stream = client.messages.stream({
  model: 'claude-opus-4-6',
  max_tokens: 4096,
  system: 'You are an AI running coach...',
  messages: [{ role: 'user', content: 'Create my training plan' }],
});

// Relay text chunks to client
stream.on('text', (text: string) => {
  // enqueue SSE chunk to ReadableStream controller
});

// Get complete message after stream ends (for JSON extraction)
const finalMessage = await stream.finalMessage();
const fullText = finalMessage.content.find(b => b.type === 'text')?.text ?? '';
```

### react-big-calendar CSS Import

```typescript
// In PlanCalendar.tsx
import 'react-big-calendar/lib/css/react-big-calendar.css';
```

### MongoDB Session PATCH Handler Pattern

```typescript
// Source: existing auth.ts pattern + MongoDB v7 docs
app.http('updateSession', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}',
  handler: async (req, context) => {
    const denied = await requirePassword(req);
    if (denied) return denied;

    const { sessionId } = req.params;
    const updates = await req.json() as Partial<PlanSession>;
    const db = await getDb();

    const result = await db.collection('plans').updateOne(
      { 'sessions.id': sessionId },
      { $set: Object.fromEntries(Object.entries(updates).map(([k, v]) => [`sessions.$.${k}`, v])) }
    );

    if (result.matchedCount === 0) return { status: 404, jsonBody: { error: 'Session not found' } };
    return { status: 200, jsonBody: { ok: true } };
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `EventSource` for browser SSE | `fetch` + `ReadableStream` reader | When POST+custom headers needed | Works with password auth header requirement |
| Moment.js localizer | date-fns localizer | react-big-calendar v1+ | Smaller bundle, modern date lib |
| Cosmos DB SQL API | MongoDB API | Phase 01.1 decision | Use existing `getDb()` and `mongodb` npm package |
| Azure SWA GitHub OAuth | Simple password (`x-app-password` header) | Phase 01.1 decision | All new API functions must call `requirePassword` first |

**Deprecated/outdated:**
- `EventSource`: Cannot send POST body or custom headers — not viable for this project's password auth pattern.
- `moment` localizer with react-big-calendar: moment is in maintenance mode, heavy bundle weight.

---

## Open Questions

1. **SWA SSE Streaming in Production**
   - What we know: SWA linked backend proxy buffers streaming responses (issue #1180, unresolved). Local dev works fine.
   - What's unclear: Whether `X-Accel-Buffering: no` header is respected by SWA's proxy layer; whether the issue was quietly fixed.
   - Recommendation: During Phase 2 implementation, test deployed production streaming early. If SWA buffers, fall back to the `fetch` non-streaming approach for production, or call the Function App URL directly. This is a plan execution risk, not a blocking research gap.

2. **Plan JSON Extraction Strategy**
   - What we know: D-14 says backend parses JSON from streamed content. Streaming text may wrap the JSON in plain text narrative.
   - What's unclear: Best delimiter strategy for extracting plan JSON reliably.
   - Recommendation: Use XML-tag delimiters in the system prompt (`<training_plan>...</training_plan>`). Parse with regex extraction after full text accumulation, then `JSON.parse`. More reliable than asking Claude to respond with pure JSON (it often adds explanatory text).

3. **Model Selection for Plan Generation**
   - What we know: Anthropic SDK v0.80.0 has `claude-opus-4-6` as shown in official examples.
   - What's unclear: Whether `claude-3-5-sonnet` or `claude-3-5-haiku` is a better cost/quality tradeoff for this use case at the time of implementation.
   - Recommendation: Use `claude-3-5-sonnet-20241022` for plan generation (better structured output) and `claude-3-5-haiku-20241022` for summarization (cheaper). Verify model availability and pricing before finalizing.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `api/vitest.config.ts` + `web/vitest.config.ts` |
| Quick run command (api) | `cd api && npm test` |
| Quick run command (web) | `cd web && npm test` |
| Full suite command | `npm test` (root — runs both) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COACH-06 | Rolling 20-message window returns last N messages | unit | `cd api && npm test -- --reporter=verbose chat` | ❌ Wave 0 |
| COACH-06 | Summary prepended when plan has summary field | unit | `cd api && npm test -- --reporter=verbose chat` | ❌ Wave 0 |
| PLAN-01 | Plan generation parses JSON from Claude response | unit (mock Anthropic) | `cd api && npm test -- --reporter=verbose plan` | ❌ Wave 0 |
| PLAN-02 | Plan session saved to MongoDB with correct schema | integration | `cd api && npm test -- --reporter=verbose plan` | ❌ Wave 0 |
| PLAN-04 | Session PATCH endpoint marks completed=true | unit | `cd api && npm test -- --reporter=verbose sessions` | ❌ Wave 0 |
| COACH-01 | Chat message stored in MongoDB after stream | integration | `cd api && npm test -- --reporter=verbose chat.integration` | ❌ Wave 0 |
| COACH-02 | SSE chunks arrive before stream closes | manual-only | Manual browser test — SSE timing not automatable in unit | N/A |
| PLAN-03 | Calendar renders sessions as events | unit (React) | `cd web && npm test -- --reporter=verbose PlanCalendar` | ❌ Wave 0 |
| D-03 | Onboarding resume: plan with onboardingStep=3 resumes at step 3 | unit | `cd api && npm test -- --reporter=verbose onboarding` | ❌ Wave 0 |
| D-15 | JSON parse failure returns error to client | unit (mock Anthropic) | `cd api && npm test -- --reporter=verbose plan` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd api && npm test` (unit tests only, fast)
- **Per wave merge:** `npm test` (root — api + web unit tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `api/src/__tests__/chat.test.ts` — covers COACH-06 (rolling window), message storage
- [ ] `api/src/__tests__/chat.integration.test.ts` — covers COACH-01 with mongodb-memory-server
- [ ] `api/src/__tests__/plan.test.ts` — covers PLAN-01 (JSON extraction), PLAN-02 schema, D-15 error
- [ ] `api/src/__tests__/sessions.test.ts` — covers PLAN-04 PATCH endpoint
- [ ] `web/src/__tests__/PlanCalendar.test.tsx` — covers PLAN-03 calendar rendering
- [ ] `api/src/__tests__/onboarding.test.ts` — covers D-03 resume logic

---

## Sources

### Primary (HIGH confidence)

- [@anthropic-ai/sdk npm registry + GitHub](https://github.com/anthropics/anthropic-sdk-typescript) — version 0.80.0, streaming API (`stream()`, `.on('text', ...)`, `.finalMessage()`)
- [Anthropic Streaming Messages docs](https://platform.claude.com/docs/en/api/messages-streaming) — SSE event format, TypeScript SDK examples
- [Azure Functions HTTP Streams GA announcement](https://techcommunity.microsoft.com/t5/apps-on-azure-blog/azure-functions-support-for-http-streams-in-node-js-is-generally/ba-p/4140209) — `app.setup({ enableHttpStream: true })`, version requirements, response pattern
- [react-big-calendar npm](https://www.npmjs.com/package/react-big-calendar) — version 1.19.4 confirmed
- [date-fns npm](https://www.npmjs.com/package/date-fns) — version 4.1.0 confirmed

### Secondary (MEDIUM confidence)

- [Azure/static-web-apps issue #1180](https://github.com/Azure/static-web-apps/issues/1180) — SWA proxy buffering of streaming responses; open issue confirmed from GitHub
- [react-big-calendar date-fns localizer docs](https://jquense.github.io/react-big-calendar/examples/index.html?path=/story/guides-localizers--page) — `dateFnsLocalizer` setup pattern
- [MongoDB rolling window + summarization patterns](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — context management strategies

### Tertiary (LOW confidence)

- WebSearch results on SSE chunk boundary handling — general web dev pattern, not Azure-specific verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-03-23
- Architecture: HIGH — patterns from official Azure Functions and Anthropic docs
- SWA streaming pitfall: HIGH — verified open GitHub issue on official repo
- Pitfalls: MEDIUM-HIGH — most verified against official sources; SSE chunk buffering is general web dev knowledge

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable libraries; SWA streaming issue status may change)
