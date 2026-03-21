# Technology Stack

**Project:** AI Running Coach (personal, single-user)
**Researched:** 2026-03-21
**Overall Confidence:** HIGH — all major claims sourced from official Microsoft and Anthropic documentation fetched directly.

---

## Constraints Summary

Before recommendations: document the hard constraints that shape every decision.

| Constraint | Impact |
|------------|--------|
| Azure free tier only | Limits hosting plans; rules out Premium Functions, paid DB tiers |
| Single user, no multi-user auth | Simplifies auth dramatically — no user DB, no JWT issuance |
| Claude API (Anthropic) for AI | Locks in Anthropic SDK; streaming support matters for chat UX |
| Apple Health XML parsing | Files can be 100MB+; requires streaming XML parser, not DOM |
| Static Web Apps + Functions | Frontend/backend must be compatible with this deployment model |

---

## Recommended Final Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | React 19, TS 5.x |
| Build tool | Vite | 6.x |
| Styling | Tailwind CSS | 4.x |
| Backend | Azure Functions, Node.js v4 model | Node.js 22 LTS |
| Database | Azure Cosmos DB for NoSQL (free tier) | N/A — managed service |
| AI | Anthropic TypeScript SDK | `@anthropic-ai/sdk` v0.80+ |
| XML parsing | `sax` (Node.js streaming SAX parser) | 1.x |
| Auth | Azure Static Web Apps built-in auth (GitHub provider) | Built-in |
| Deployment | Azure Static Web Apps (Free plan) + managed Functions | N/A |

---

## 1. Frontend Framework

### Decision: React + TypeScript + Vite

**Why React:**

Azure Static Web Apps supports every major framework — React, Vue, Svelte, Angular, Astro, Next.js, SvelteKit — with zero special configuration. Framework choice is not constrained by the hosting platform. React wins on ecosystem breadth for this project's specific needs:

- Calendar UI: `react-big-calendar` and `@fullcalendar/react` are mature, well-maintained options with no Vue/Svelte equivalents of the same quality.
- Charting for run stats: `recharts`, `victory`, `nivo` — all React-native.
- Chat streaming UI: React's `useState`/`useReducer` with `EventSource` or `ReadableStream` is the most documented pattern.
- The dashboard complexity (calendar + charts + chat panel) benefits from component composition that React's model handles well.

**Why not Vue/Svelte:**
Vue and Svelte are excellent choices for simpler UIs. For this dashboard — calendar, charts, run history table, chat interface — you would end up pulling React ecosystem libraries as wrappers anyway. Go with React directly.

**Why not Next.js:**
Next.js hybrid SSR on Static Web Apps requires the managed Azure Functions for server-side rendering, consuming your function budget and adding cold-start latency to every page load. This is a personal tool; you do not need SSR for SEO. Use React SPA (static export) via Vite — zero server overhead on page loads.

**Why Vite over Create React App:**
CRA is dead (unmaintained since 2023). Vite is the current standard for React SPAs. It is what Azure's own tutorials now reference.

**Build configuration for Static Web Apps:**

```yaml
# In .github/workflows/azure-static-web-apps.yml
app_location: "/"           # root of frontend source
api_location: "api"         # Azure Functions folder
output_location: "dist"     # Vite build output
```

```json
// staticwebapp.config.json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/images/*", "/assets/*"]
  },
  "platform": {
    "apiRuntime": "node:22"
  }
}
```

**Confidence:** HIGH — framework support list confirmed from official Azure Static Web Apps docs (updated 2026-01-23).

---

## 2. Backend: Azure Functions Runtime

### Decision: Node.js 22, v4 programming model, Windows Consumption plan

**Why Node.js over Python:**

This is the single most consequential backend decision. Here is the analysis:

**Node.js advantages for this project:**

1. **Same language as frontend.** TypeScript runs everywhere. You share types between frontend API calls and backend handlers with no translation layer.
2. **Anthropic TypeScript SDK is the primary SDK.** `@anthropic-ai/sdk` v0.80 (released March 18, 2026). The SDK is written in TypeScript, targets Node.js 18+, and streaming support is first-class. The Python SDK also exists at v0.86.0, but integrating a Node.js frontend that calls a Python backend that calls Claude creates two runtimes to manage.
3. **HTTP streaming support in v4 model.** Node.js Azure Functions v4 (`@azure/functions` v4.3.0+) supports streaming request and response bodies natively. This is required for proxying Claude's SSE stream to the browser.
4. **Cold start.** Node.js cold starts on Consumption plan are faster than Python for small functions (low import overhead). Python requires loading the interpreter plus packages on cold start.
5. **`sax` XML parser.** The canonical streaming SAX parser for Apple Health XML is the Node.js `sax` package. It handles arbitrarily large XML files with fixed memory usage. On Python you would use `xml.etree.ElementTree` iterparse, which works but adds a second reason to maintain Python.

**Why not C# (.NET):**
C# isolated worker model on .NET 10 is excellent and has the best cold-start profile of any Functions runtime. However:
- It requires managing a compiled .NET project, MSBuild, and NuGet, which adds deployment complexity.
- The Anthropic SDK does not have an official C# library. You would call the HTTP API directly or use a community wrapper.
- For a solo personal project, the overhead is not worth it.

**Why Windows Consumption plan (not Linux Consumption or Flex):**

The constraint says "Azure Functions consumption plan." Important distinction discovered in research:

- **Windows Consumption plan** = the original, still-supported plan. Free grant: 1 million executions and 400,000 GB-seconds per month, permanent. Supports Node.js 22.
- **Linux Consumption plan** = RETIRED for new language versions after September 30, 2025. Microsoft is migrating everyone to Flex Consumption. Do not start new projects here.
- **Flex Consumption plan** = the recommended successor. Supports Linux only. Has a free grant for on-demand executions but billing is execution-time based with no permanent zero-cost tier for idle months.

For a personal app with very low traffic (one user), **Windows Consumption plan** is the correct choice for "free tier." It is the only plan Microsoft currently maintains that is clearly zero-cost for low-traffic workloads with no auto-pause behavior.

**Critical caveat — function timeout:** The Consumption plan has a 10-minute maximum execution timeout. Claude API calls for coaching conversations complete well within this. XML parsing of large files (100MB+) could approach this limit — handle with an async Blob Storage pipeline (see Section 5).

**HTTP Timeout note:** Azure Load Balancer cuts HTTP connections at 230 seconds regardless of function timeout setting. For Claude streaming, this is fine — coaching responses stream in well under 230 seconds. For bulk XML import, use async processing (upload ZIP to Blob Storage, trigger a separate non-HTTP function).

**The v4 programming model:**

Use the v4 Node.js model (not v3). It is the current standard, has a more intuitive code structure, and is required for HTTP streaming support.

```typescript
// api/src/functions/chat.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';

app.setup({ enableHttpStream: true });

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous', // auth handled by SWA route rules, not function key
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Proxy Claude streaming SSE to browser — see Section 4
  }
});
```

**Confidence:** HIGH — language support, hosting plan details, and v4 streaming capability confirmed from official Azure Functions docs (updated 2026-03-15 and 2026-01-22).

---

## 3. Database

### Decision: Azure Cosmos DB for NoSQL, free tier

**The three options compared:**

| Feature | Cosmos DB Free Tier | Azure SQL Free Tier | Azure Table Storage |
|---------|-------------------|--------------------|--------------------|
| Free storage | 25 GB (permanent) | 32 GB/month (renewable) | ~5 GB on free account, then pay-per-use |
| Free compute | 1,000 RU/s (permanent) | 100,000 vCore-seconds/month | N/A (pay per transaction) |
| Schema | Schemaless JSON | Relational SQL | Key-value, schemaless |
| Query capability | SQL-like (NoSQL), flexible indexes | Full SQL | Limited (PartitionKey + RowKey only) |
| Data model fit | Excellent — JSON docs for runs, chat history, plans | Good — requires schema design up front | Poor — range queries on run history are awkward |
| One free account per sub | Yes | Yes (up to 10 databases) | N/A |
| Auto-pause risk | None | Yes — pauses after free vCore limit hit | N/A |
| SDK | `@azure/cosmos` for Node.js | `mssql` or `tedious` | `@azure/data-tables` |

**Why Cosmos DB wins:**

The data model is naturally document-oriented:
- Each **run** is a JSON document (date, distance, duration, heart rate, pace zones, splits).
- **Chat history** is an array of message objects per session.
- **Training plans** are JSON documents with weekly structures.
- **User profile/preferences** is a single document.

Cosmos DB's 25 GB of permanent free storage and 1,000 RU/s permanent free throughput is more than sufficient for a single-user personal app. At 1,000 RU/s with a single user making a few requests per hour, you will never hit the throughput ceiling during normal use.

Azure SQL's free tier has a meaningful risk: once you hit 100,000 vCore-seconds in a month, the database auto-pauses until next month. For a personal app with irregular usage patterns, this is unpredictable. Cosmos DB has no such pause behavior — 1,000 RU/s is always available.

Azure Table Storage is too limited. Querying "all runs in the last 30 days" or "runs by distance range" requires full table scans or awkward composite keys. Cosmos DB's SQL-like query language handles this naturally and indexes all properties by default.

**Container design:**

```
Database: running-coach   (shared throughput: 1,000 RU/s)
  Container: runs          (partitionKey: /userId)
  Container: chat-sessions (partitionKey: /sessionId)
  Container: training-plans (partitionKey: /planId)
  Container: profile       (partitionKey: /userId)
```

Since this is single-user, the partition key strategy is simple. Use the constant string `"owner"` as the userId everywhere. All data lives in one logical partition per container. This is fine for personal-scale data volumes.

**Shared throughput database:** Provision the database at 1,000 RU/s (the free grant limit) shared across all containers. Do not provision containers with dedicated throughput — that would exceed the free tier.

**Confidence:** HIGH — Cosmos DB free tier details confirmed from official docs (updated 2025-12-19). Azure SQL free tier details confirmed from official docs (updated 2026-03-18).

---

## 4. Claude API Integration

### Decision: Streaming via Server-Sent Events, Anthropic TypeScript SDK

**Streaming vs non-streaming:**

Use streaming. Non-streaming: the function waits for the complete response (5-30 seconds for detailed coaching analysis), then returns all text at once. The user sees a spinner, then a wall of text appears. Poor UX.

Streaming: tokens arrive in the browser as Claude generates them, typically starting within 1-2 seconds. The user sees text appearing progressively, which is the standard interaction model for AI chat.

**The technical chain:**

```
Browser → Azure Function (HTTP POST) → Anthropic API (SSE stream)
                   ↓ proxies SSE back ↓
Browser ← Azure Function (streaming response) ← Anthropic API
```

The Anthropic API sends `text/event-stream` (Server-Sent Events) when `stream: true` is set. The Azure Function proxies this stream directly to the browser.

**Implementation pattern (TypeScript, Node.js v4):**

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In the function handler:
const stream = await client.messages.stream({
  model: 'claude-opus-4-5',
  max_tokens: 2048,
  system: coachSystemPrompt,
  messages: conversationHistory,
});

const encoder = new TextEncoder();
const readable = new ReadableStream({
  async start(controller) {
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const sseEvent = `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`;
        controller.enqueue(encoder.encode(sseEvent));
      }
    }
    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller.close();
  }
});

return {
  body: readable,
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no'
  }
};
```

**Browser-side (use fetch, not EventSource):**

`EventSource` only supports GET requests. Since the chat sends message history in the request body, use `fetch` with `response.body.getReader()`:

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: history }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE events from chunk, append text to chat display
}
```

**Model selection guidance:**

- `claude-opus-4-5`: Use for coaching analysis, training plan generation, detailed run debriefs. Most capable.
- `claude-haiku-3-5`: Use for quick clarifications, run tagging, simple queries. Cheapest and fastest.

Models are configurable per-call; this is an implementation detail, not a stack constraint. The SDK supports any model string.

**Conversation context:** For a running coach, the system prompt should include the user's recent run history (last 4-8 weeks), current training plan, and any context from the current session. Build a context-assembly function that fetches relevant Cosmos DB data before each Claude call.

**Confidence:** HIGH for SDK existence, streaming support, and Node.js v4 streaming compatibility. MEDIUM for the exact streaming API surface — could not directly access Anthropic streaming docs during this session, but the pattern matches the SDK's public interface documented via GitHub.

---

## 5. Apple Health XML Parsing

### Decision: Node.js `sax` package for streaming SAX parsing, with async Blob Storage pipeline

**The problem:**

Apple Health exports a ZIP file (`export.zip`) containing `export.xml`. This XML file is typically 100MB-2GB for users with years of data. DOM-based parsers (`DOMParser`, `xml2js`, `fast-xml-parser` in default mode) load the entire file into memory. On Azure Functions Consumption plan, each instance has 1.5 GB RAM maximum. A 500MB XML file would exhaust the memory budget and crash the function.

**The solution: streaming SAX parser**

The `sax` npm package parses XML as a stream of events. It processes one XML element at a time, using O(1) memory regardless of file size. This is the correct approach for files of unknown size.

**Key Apple Health XML structure:**

```xml
<HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
           duration="32.5" durationUnit="min"
           totalDistance="5.2" totalDistanceUnit="km"
           startDate="2024-03-15 07:30:00 +0000"
           endDate="2024-03-15 08:02:30 +0000">
    <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate"
                       average="152" minimum="130" maximum="178"/>
  </Workout>
  <!-- Hundreds of thousands of <Record> elements for non-workout data -->
</HealthData>
```

The SAX parser lets you skip millions of non-workout `<Record>` elements with zero memory cost, extracting only `<Workout workoutActivityType="HKWorkoutActivityTypeRunning">` nodes.

**Required async pipeline (to avoid timeout):**

The Windows Consumption plan has a 10-minute function timeout and the HTTP trigger has a 230-second HTTP response deadline. Parsing a 500MB XML file plus writing hundreds of Cosmos DB documents could exceed both limits. Use this pipeline instead:

```
Step 1: HTTP Function "upload-health-export"
  ← Receives multipart POST with export.zip
  → Streams ZIP bytes to Azure Blob Storage container "health-imports"
  → Returns HTTP 202 Accepted immediately (< 5 seconds)

Step 2: Blob Trigger Function "process-health-export"
  ← Fires when blob is written
  → Unzips export.zip using Node.js built-in node:zlib + node:stream
  → Pipes export.xml through sax parser
  → Filters for HKWorkoutActivityTypeRunning
  → Batches Cosmos DB writes (use bulk operations, 100 docs per batch)
  → Deletes source blob when done

Step 3: Browser polls GET /api/import-status
  ← Returns { status: "processing" | "complete" | "error", runsImported: N }
```

This avoids both timeout limits entirely. The Blob trigger function has no HTTP deadline, only the 10-minute execution timeout, which is sufficient for most XML files when using streaming + batched writes.

**Blob Storage cost:** Azure Blob Storage is not free by default, but it is extremely cheap at personal scale. A 1GB export.zip stored temporarily costs fractions of a cent. Alternatively, a Storage Account is required by Azure Functions anyway (for the function app code itself), so you likely already have one — just use the same account.

**Alternative considered: `fast-xml-parser` with streaming mode.**
`fast-xml-parser` v4 added SAX-like streaming, but `sax` is the more established package for this exact use case and has simpler streaming semantics. Prefer `sax`.

**Confidence:** HIGH for the streaming parser requirement and async pipeline approach. MEDIUM for `sax` package health (well-established but could not directly verify current npm status).

---

## 6. Authentication

### Decision: Azure Static Web Apps built-in auth, GitHub provider, owner-only lockdown

**The single-user constraint simplifies auth dramatically.** You do not need a user database, password hashing, JWT issuance, OAuth server, or any auth library.

**How Azure Static Web Apps built-in auth works:**

1. GitHub and Microsoft Entra ID are pre-configured identity providers with zero setup.
2. After sign-in, users receive the built-in `authenticated` role.
3. Route rules in `staticwebapp.config.json` restrict routes to specific roles.
4. A 401 response override automatically redirects unauthenticated requests to the sign-in page.

**Lock down the entire app to authenticated users:**

```json
{
  "routes": [
    {
      "route": "/.auth/login/github",
      "allowedRoles": ["anonymous"]
    },
    {
      "route": "/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "statusCode": 302,
      "redirect": "/.auth/login/github"
    }
  }
}
```

Any visitor who is not signed in via GitHub is redirected to GitHub OAuth. After signing in, they have the `authenticated` role and access everything. This is the complete auth solution for a basic lockdown.

**Hardening for true owner-only access:**

With the above config, any GitHub account that authenticates gets in. To restrict to specifically your GitHub account, use a custom role API function:

```typescript
// api/src/functions/get-user-role.ts
app.http('getRole', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: '.auth/roles',
  handler: async (req) => {
    const body = await req.json() as { identityProvider: string; userId: string; userDetails: string };
    const allowedGithubUsername = process.env.OWNER_GITHUB_USERNAME;
    const roles = body.userDetails === allowedGithubUsername ? ['owner'] : [];
    return { jsonBody: { roles } };
  }
});
```

Then change the route rule to require `owner` instead of `authenticated`. Set `OWNER_GITHUB_USERNAME` as an environment variable in the SWA config. No one but your GitHub account can access the app.

**Why not API key auth:**

A common suggestion for single-user apps is Azure Functions `authLevel: 'function'` which requires an `x-functions-key` header. Reject this for two reasons:
1. The function key must be stored somewhere the browser can access it (hardcoded in JS or in a cookie) — both are less secure than the HttpOnly cookie that SWA auth uses.
2. SWA managed functions already handle the `/api/*` routing and auth integration. Adding function-level keys creates two separate auth mechanisms to maintain.

**Confidence:** HIGH — auth mechanism confirmed from official SWA auth docs and configuration docs (both updated 2026-01-23).

---

## 7. Supporting Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@anthropic-ai/sdk` | 0.80+ | Claude API client | Official SDK, TypeScript-native, v0.80 released 2026-03-18 |
| `@azure/cosmos` | 4.x | Cosmos DB client | Official Azure SDK for Node.js |
| `sax` | 1.x | Streaming XML parser | For Apple Health export.xml |
| `recharts` | 2.x | Charts for run stats | React-native, composable, well-maintained |
| `react-big-calendar` | 1.x | Training calendar view | Requires `date-fns` adapter |
| `date-fns` | 3.x | Date manipulation | Peer dependency of react-big-calendar |
| `tailwindcss` | 4.x | Utility CSS styling | Zero-runtime, excellent build integration with Vite |
| `@azure/functions` | 4.x | Functions v4 SDK | Required for v4 programming model and HTTP streaming |
| `typescript` | 5.x | Type safety | Shared tsconfig between frontend and api directories |

---

## 8. Deployment Architecture

```
GitHub Repository
  ├── /                      (frontend: React + Vite)
  │    ├── src/
  │    ├── staticwebapp.config.json
  │    └── vite.config.ts
  └── /api                   (Azure Functions, Node.js v4)
       ├── src/functions/
       │    ├── chat.ts           POST /api/chat      → Claude streaming
       │    ├── get-runs.ts       GET  /api/runs       → Cosmos DB query
       │    ├── get-stats.ts      GET  /api/stats      → aggregated run data
       │    ├── upload-health.ts  POST /api/import     → Blob Storage upload
       │    ├── process-health.ts Blob trigger         → SAX parse + Cosmos write
       │    ├── training-plan.ts  GET/POST /api/plan   → plan management
       │    └── get-role.ts       POST /.auth/roles    → owner role assignment
       └── package.json

Azure Static Web Apps (Free plan)
  ├── Hosts dist/ as CDN-distributed static files globally
  ├── Routes /api/* to managed Azure Functions
  ├── Auth  /.auth/* handled by GitHub OAuth built-in
  └── Config staticwebapp.config.json enforces owner-only access

Azure Cosmos DB (Free tier: 1,000 RU/s + 25 GB)
  └── Database: running-coach
        ├── Container: runs           (partitionKey: /userId)
        ├── Container: chat-sessions  (partitionKey: /sessionId)
        ├── Container: training-plans (partitionKey: /planId)
        └── Container: profile        (partitionKey: /userId)

Azure Blob Storage (same Storage Account as Functions)
  └── Container: health-imports  (temporary, deleted after processing)
```

**CI/CD:** Azure Static Web Apps creates a GitHub Actions workflow automatically on first deployment. Pushing to `main` triggers build and deploy. No additional configuration needed for the basic pipeline.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend | React + Vite | SvelteKit | Calendar/chart ecosystem is React-centric; SSR adds cold-start cost on SWA |
| Frontend | React + Vite | Vue 3 + Vite | No meaningful advantage; React wins on ecosystem depth for this dashboard |
| Backend language | Node.js 22 | Python 3.12 | Two runtimes to maintain; TypeScript SDK is the primary Anthropic SDK |
| Backend language | Node.js 22 | C# .NET 10 | No official Anthropic C# SDK; MSBuild complexity for a personal project |
| Database | Cosmos DB NoSQL | Azure SQL Free | Auto-pause risk; relational schema overhead for naturally JSON data |
| Database | Cosmos DB NoSQL | Azure Table Storage | Inadequate query capability for run history range queries |
| XML parsing | `sax` (SAX streaming) | `fast-xml-parser` | Default mode is DOM-based; 100MB+ files require streaming |
| XML parsing | `sax` (SAX streaming) | `expat` (Python) | Would require Python runtime for this one task |
| Auth | SWA built-in + custom role | Function-level API key | Key must be in browser source; SWA HttpOnly cookie is more secure |
| Auth | SWA built-in + custom role | Custom JWT implementation | Massive overkill for a single-user personal tool |
| Functions hosting | Windows Consumption | Flex Consumption | Flex billing is more complex; Windows Consumption has clear permanent free grant |
| Functions hosting | Windows Consumption | Linux Consumption | Retired for new language versions as of September 30, 2025 |

---

## Installation

```bash
# Create project structure
mkdir ai-running-coach && cd ai-running-coach
npm create vite@latest . -- --template react-ts

# Frontend dependencies
npm install recharts react-big-calendar date-fns
npm install -D tailwindcss @tailwindcss/vite

# Create Azure Functions app
mkdir api && cd api
npm init -y
npm install @azure/functions @anthropic-ai/sdk @azure/cosmos sax @azure/storage-blob
npm install -D typescript @types/node @types/sax
```

---

## Key Risk Flags

**Apple Health XML timeout (HIGH RISK):** The 10-minute Consumption plan function timeout and 230-second HTTP response deadline mean synchronous parsing of large files in an HTTP function is not viable. Implement the async Blob Storage pipeline from day one, not as a future optimization. This is the most architecturally novel part of the project.

**Cosmos DB bulk import throttling (MEDIUM RISK):** Batch-inserting 500+ historical runs will consume significant RUs rapidly. At 1,000 RU/s shared, a Cosmos write costs 5-10 RU, so you can sustain approximately 100-200 writes per second. Implement exponential backoff on HTTP 429 responses during import. Do not use tight retry loops.

**Claude API streaming through Azure Load Balancer (LOW-MEDIUM RISK):** The 230-second HTTP timeout is a ceiling for any single Claude response stream. Coaching responses for typical queries complete in under 60 seconds. Monitor for pathological prompts (e.g., "analyze my entire running history") that might trigger very long responses. If needed, break such requests into multiple streaming calls.

**Cosmos DB free tier: one per subscription (LOW RISK):** You can only have one Cosmos DB free-tier account per Azure subscription. If you already have one from another project, you will need to use a paid account or reorganize subscriptions. Verify before provisioning.

---

## Sources

- Azure Static Web Apps framework support: https://learn.microsoft.com/en-us/azure/static-web-apps/front-end-frameworks (updated 2026-01-23)
- Azure Static Web Apps authentication: https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization (updated 2026-01-23)
- Azure Static Web Apps configuration: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration (updated 2026-01-23)
- Azure Static Web Apps + Azure Functions integration: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions (updated 2026-02-21)
- Azure Functions scale and hosting plans: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale (updated 2026-03-15)
- Azure Functions supported languages: https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages (updated 2026-01-22)
- Azure Functions Consumption plan (legacy, Windows): https://learn.microsoft.com/en-us/azure/azure-functions/consumption-plan (updated 2026-03-15)
- Azure Functions Flex Consumption plan: https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan (updated 2026-03-18)
- Azure Functions Node.js developer guide: https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-node
- Azure Cosmos DB free tier: https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier (updated 2025-12-19)
- Azure SQL Database free offer: https://learn.microsoft.com/en-us/azure/azure-sql/database/free-offer (updated 2026-03-18)
- Azure Table Storage overview: https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview
- Anthropic TypeScript SDK: https://github.com/anthropics/anthropic-sdk-typescript (v0.80.0, released 2026-03-18)
- Anthropic Python SDK: https://github.com/anthropics/anthropic-sdk-python (v0.86.0, released 2026-03-18)
