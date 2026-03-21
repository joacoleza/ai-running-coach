# Architecture Patterns: AI Running Coach on Azure Free Tier

**Domain:** Personal AI coaching app (single-user, minimal load)
**Researched:** 2026-03-21
**Sources:** Azure official documentation (learn.microsoft.com), verified March 2026

---

## Service Inventory and Free Tier Limits

Before architecture decisions, pin down exactly what the free tier provides.

### Azure Static Web Apps (Free Plan)
- **Bandwidth:** 100 GB/month included (no overage — app is throttled)
- **Storage:** 250 MB per environment, 500 MB total across all environments
- **File count:** 15,000 files
- **Custom domains:** 2
- **Request size limit:** 30 MB (applies to all requests through the SWA proxy)
- **API timeout:** 45 seconds maximum per API request (SWA-enforced)
- **SLA:** None (Free plan has no SLA)
- **APIs:** Managed Azure Functions only (HTTP triggers only, Consumption plan)

Source: https://learn.microsoft.com/en-us/azure/static-web-apps/quotas

### Azure Functions (Consumption Plan — Legacy, Windows)

**Critical note:** The Consumption plan is marked legacy by Microsoft. The new recommended plan is Flex Consumption. However, SWA managed functions run on the legacy Consumption plan (Windows), which is still fully supported through at least September 2028 on Windows. For a single-user personal app this distinction is irrelevant in practice.

- **Free grant:** 1,000,000 executions/month + 400,000 GB-seconds/month (applies to legacy Consumption plan)
- **Timeout:** 5-minute default, 10-minute maximum — hard ceiling
- **HTTP response timeout:** 230 seconds maximum (Azure Load Balancer constraint, applies regardless of function timeout setting)
- **Max request body size:** 100 MB (set in host; platform limit is 210 MB)
- **Cold starts:** Expected for this usage pattern; no always-warm instances on free tier

Source: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale

### Cosmos DB (Free Tier)
- **Throughput:** 1,000 RU/s (shared across all containers in one database)
- **Storage:** 25 GB
- **Limit:** One free tier account per Azure subscription (cannot change to free tier after account creation)
- **Availability:** Provisioned throughput only (not serverless accounts)
- **Multi-region:** Supported, but multi-region replication on free tier RU/s costs money beyond the 1,000 RU/s

Source: https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier

### Azure Blob Storage
- No separate free tier beyond the Azure free account 12-month credit
- Cost after credits: ~$0.018/GB/month for LRS hot tier
- For a single user uploading Apple Health exports: at 100 MB per export, 12 exports/year = 1.2 GB = ~$0.02/month — effectively free

---

## 1. Static Web Apps + Functions Integration

### How Routing Works

SWA acts as a unified entry point. All requests go through the SWA edge proxy:

```
Browser → SWA Edge Proxy (port 4280 locally, CDN endpoint in prod)
               ├── /api/*  → Azure Functions backend
               ├── /*.auth/* → SWA auth/identity service
               └── /* → Static files (CDN)
```

The `/api` prefix is fixed and non-configurable. Every call from the frontend to `/api/anything` is automatically proxied to the Functions app with no CORS configuration required — the SWA proxy handles it. The browser sees a single origin.

**Managed vs. Bring Your Own Functions:**

| | Managed | Bring Your Own |
|--|---------|----------------|
| Plan | Consumption (Windows) | Any plan |
| Triggers | HTTP only | All triggers |
| Managed identity | No | Yes |
| Key Vault references | No | Yes |
| Deployment | Same repo/workflow | Separate deployment |
| Free tier | Yes (SWA Free) | Standard plan required |

**Recommendation:** Use managed functions. Bring Your Own requires the SWA Standard plan ($9/month). For a personal project, managed functions on the SWA Free plan is the right choice. The HTTP-only trigger constraint is not a limitation here since all backend calls are HTTP.

### API Route Structure

```
/api/runs          → GET list of runs, POST new run
/api/runs/{id}     → GET single run, PUT, DELETE
/api/goals         → GET/POST goals
/api/plans         → GET current training plan
/api/plans/{id}/sessions → GET sessions for a plan
/api/chat          → POST chat message, GET history
/api/uploads/sas   → POST to get a SAS token for blob upload
/api/health-parse  → POST trigger to parse uploaded health XML
```

### Request Size Limit Warning

SWA imposes a **30 MB request size limit** at the proxy layer. This is below the Azure Functions 100 MB limit. Large Apple Health file uploads (up to 100 MB+) **cannot be sent through the `/api` proxy**. Use the SAS token + direct-to-Blob pattern instead (see Section 3).

---

## 2. Cosmos DB Data Modeling

### Decision: Cosmos DB vs. Azure SQL

**Use Cosmos DB.** Rationale:
- The data is naturally document-shaped (a run has GPS points, lap data, heart rate samples — all variable schema)
- Training plans contain nested arrays of sessions; embedding is natural
- Chat messages are an append-only sequence
- The 1,000 RU/s free tier is generous for single-user workloads
- Azure SQL free tier (32 GB, Basic tier) requires an Azure free account credit and is limited to 5 DTUs — very slow for any non-trivial query

The single risk with Cosmos DB is the 1,000 RU/s shared limit. For a single user this is not a concern — a simple document point-read costs ~1 RU, so 1,000 RU/s means 1,000 reads per second sustained capacity.

### Container Design

Use a **single database with shared throughput** (1,000 RU/s across all containers). This maximizes the free tier — separate databases would each need their own throughput allocation.

```
Database: running-coach (shared, 1000 RU/s)
  ├── Container: user-data       (partition key: /userId)
  ├── Container: runs            (partition key: /userId)
  ├── Container: plans           (partition key: /userId)
  └── Container: chat            (partition key: /userId)
```

Since this is a single-user app, partition key design is not a performance concern. Use `/userId` everywhere as a convention so the schema is extensible to multi-user later without a rewrite.

### Document Schemas

**user-data container** — goals and user profile

```json
{
  "id": "profile",
  "userId": "user-1",
  "type": "profile",
  "name": "John",
  "weeklyGoalKm": 40,
  "targetRace": "marathon",
  "targetRaceDate": "2026-10-15",
  "fitnessLevel": "intermediate",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-03-21T00:00:00Z"
}

{
  "id": "goal-2026-q2",
  "userId": "user-1",
  "type": "goal",
  "description": "Run a sub-4 marathon",
  "targetDate": "2026-10-15",
  "status": "active",
  "metrics": {
    "targetPacePerKm": "5:41",
    "weeklyVolume": 60
  },
  "createdAt": "2026-03-01T00:00:00Z"
}
```

**runs container** — individual completed runs

```json
{
  "id": "run-20260320-001",
  "userId": "user-1",
  "type": "run",
  "date": "2026-03-20",
  "startTime": "2026-03-20T07:15:00Z",
  "durationSeconds": 3600,
  "distanceKm": 10.2,
  "avgPacePerKm": "5:53",
  "avgHeartRate": 148,
  "maxHeartRate": 172,
  "elevationGainM": 85,
  "perceivedEffort": 7,
  "notes": "Felt strong on the hills",
  "appleHealthWorkoutId": "abc123",
  "source": "apple-health",
  "laps": [
    { "lapNum": 1, "distanceKm": 1.0, "pacePerKm": "5:50", "heartRate": 145 }
  ],
  "heartRateSamples": [],
  "createdAt": "2026-03-20T08:30:00Z"
}
```

**Embedding decision for runs:** Embed lap data (typically 10–30 laps max). Do NOT embed full heart rate samples — for a 1-hour run sampled every second that is 3,600 data points, creating a document far too large for routine queries. Store raw HR data in Blob Storage if needed; the run document stores only the aggregate (avgHR, maxHR, zones).

**plans container** — training plans with embedded sessions

```json
{
  "id": "plan-marathon-2026",
  "userId": "user-1",
  "type": "plan",
  "name": "Marathon Training - October 2026",
  "startDate": "2026-04-01",
  "endDate": "2026-10-12",
  "status": "active",
  "generatedByAI": true,
  "generatedAt": "2026-03-21T10:00:00Z",
  "weeks": [
    {
      "weekNumber": 1,
      "startDate": "2026-04-01",
      "totalKm": 45,
      "sessions": [
        {
          "sessionId": "s-001",
          "date": "2026-04-01",
          "type": "easy-run",
          "targetDistanceKm": 10,
          "targetPacePerKm": "6:30",
          "description": "Easy recovery run. Keep HR under 145.",
          "completed": false,
          "completedRunId": null
        },
        {
          "sessionId": "s-002",
          "date": "2026-04-03",
          "type": "tempo",
          "targetDistanceKm": 8,
          "targetPacePerKm": "5:20",
          "description": "Tempo run. Warm up 2km, 5km at threshold pace, cool down 1km.",
          "completed": false,
          "completedRunId": null
        }
      ]
    }
  ]
}
```

**Embedding decision for plans:** Embed sessions inside the plan document. A 16-week marathon plan with 5 sessions/week = 80 sessions. Even at 500 bytes each that is 40 KB — well within Cosmos DB's 2 MB document size limit. Embedding sessions means the entire plan is fetched in one read (1 RU) with no joins.

**chat container** — conversation history

```json
{
  "id": "msg-20260321-001",
  "userId": "user-1",
  "type": "message",
  "conversationId": "conv-default",
  "role": "user",
  "content": "How did my run yesterday compare to my goal pace?",
  "timestamp": "2026-03-21T09:00:00Z",
  "contextSnapshot": {
    "recentRunIds": ["run-20260320-001"],
    "activePlanId": "plan-marathon-2026"
  }
}

{
  "id": "msg-20260321-002",
  "userId": "user-1",
  "type": "message",
  "conversationId": "conv-default",
  "role": "assistant",
  "content": "Your 5:53/km pace yesterday was 12 seconds slower than your target of 5:41/km...",
  "timestamp": "2026-03-21T09:00:05Z",
  "inputTokens": 1850,
  "outputTokens": 320
}
```

**Note on conversation design:** Each message is a separate document, not embedded in a conversation document. This keeps document size bounded as history grows. Query for recent messages with `SELECT TOP 20 * FROM c WHERE c.conversationId = 'conv-default' ORDER BY c.timestamp DESC`. This is a cross-partition query in theory, but since all messages share the same `/userId` partition key, it is a single-partition query within the partition for that user.

### RU Consumption Estimate (Single User)

| Operation | Frequency | RU/op | RU/month |
|-----------|-----------|-------|----------|
| Save run | 5/week | ~10 RU | ~200 RU |
| Read run list | 20/month | ~5 RU | ~100 RU |
| Read plan | 30/month | ~2 RU | ~60 RU |
| Chat: read history (20 msgs) | 40/month | ~5 RU | ~200 RU |
| Chat: write message | 80/month | ~5 RU | ~400 RU |
| Update session completion | 20/month | ~10 RU | ~200 RU |
| **Total** | | | **~1,160 RU/month** |

Average load: ~0.002 RU/second. The 1,000 RU/s limit is effectively never approached. The free tier is more than sufficient.

---

## 3. File Upload Architecture for Apple Health XML

### The Core Problem

Apple Health exports are ZIP files containing `export.xml`, which can be 100 MB to several GB. Three hard constraints make naive upload impossible:

1. SWA proxy request size limit: **30 MB** — any upload through `/api` is rejected
2. Functions consumption plan execution timeout: **10 minutes maximum** (5 min default)
3. Functions HTTP response timeout: **230 seconds** (Azure Load Balancer)
4. Functions in-memory processing of a 500 MB XML file will exhaust the 1.5 GB memory limit

### Recommended Pattern: SAS Token + Direct Browser-to-Blob Upload

The browser uploads directly to Azure Blob Storage, bypassing the SWA proxy entirely. The Function only generates a short-lived SAS token and later processes the already-uploaded file.

```
Step 1: Frontend requests upload permission
  Browser → POST /api/uploads/sas → Azure Function
  Function generates SAS token (write permission, 15-min expiry)
  Function returns: { sasUrl: "https://account.blob.core.windows.net/uploads/filename.zip?sv=...&sig=..." }

Step 2: Frontend uploads directly to Blob Storage
  Browser → PUT {sasUrl} (multipart or chunked upload)
  Azure Blob Storage receives the file directly (no Function involved)
  Browser shows progress bar using XMLHttpRequest.upload.onprogress

Step 3: Frontend triggers parsing
  Browser → POST /api/health-parse { blobName: "filename.zip" }
  Function downloads the blob from Blob Storage (server-side)
  Function unzips, parses export.xml, extracts workout data
  Function saves run records to Cosmos DB
  Function returns { processedWorkouts: 42 }
```

This pattern bypasses all SWA and Function request size limits for the upload itself. The parsing function accesses the blob directly from Azure infrastructure (no internet egress costs within the same region).

### SAS Token Security

Use a Service SAS (signed with storage account key) scoped to a specific blob path:

```typescript
// In the Azure Function (POST /api/uploads/sas)
import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from "@azure/storage-blob";

const blobName = `uploads/${userId}/${Date.now()}-health-export.zip`;
const sasToken = generateBlobSASQueryParameters({
  containerName: "health-uploads",
  blobName,
  permissions: BlobSASPermissions.parse("w"),  // write only
  startsOn: new Date(Date.now() - 60_000),      // 1 min clock skew buffer
  expiresOn: new Date(Date.now() + 15 * 60_000), // 15 min window
}, sharedKeyCredential).toString();

return { sasUrl: `${blobClient.url}?${sasToken}`, blobName };
```

### XML Parsing Strategy

Apple Health `export.xml` uses a flat structure: thousands of `<Record>` elements with a `type` attribute. For a running coach, only workout records matter:

```xml
<Workout workoutActivityType="HKWorkoutActivityTypeRunning"
         duration="60.0" durationUnit="min"
         totalDistance="10.2" totalDistanceUnit="km"
         startDate="2026-03-20 07:15:00 +0000"
         endDate="2026-03-20 08:15:00 +0000">
  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" average="148" maximum="172"/>
</Workout>
```

Use a **streaming XML parser** (not DOM loading) for large files. In Node.js, `sax` or `@xmldom/xmldom` with streaming can handle files of any size. Only buffer `<Workout>` elements, discard all other records.

```typescript
// Streaming parse approach
import * as unzipper from 'unzipper';
import * as sax from 'sax';

const zipStream = blobClient.download();
const zip = zipStream.pipe(unzipper.Parse());
zip.on('entry', (entry) => {
  if (entry.path === 'apple_health_export/export.xml') {
    const parser = sax.createStream(true, { lowercase: true });
    parser.on('opentag', (node) => {
      if (node.name === 'workout' &&
          node.attributes.workoutactivitytype === 'HKWorkoutActivityTypeRunning') {
        // buffer this workout
      }
    });
    entry.pipe(parser);
  } else {
    entry.autodrain(); // skip all other files
  }
});
```

### Timeout Risk for Large Files

If parsing a very large export (500 MB+) exceeds 10 minutes, the Function will timeout mid-parse.

**Mitigation for this personal app:** Apple Health exports that contain only running workouts and filter out all other health records are typically 10–50 MB. For a single user running 5 times/week, the realistic export size is small. Implement a check at the start of the parse function:

```typescript
const properties = await blobClient.getProperties();
if (properties.contentLength > 200 * 1024 * 1024) {
  return { error: "File too large. Export only workout data from Apple Health." };
}
```

If larger file support is needed later, the "bring your own Functions" pattern on a Premium plan (no timeout limit) is the escape hatch.

---

## 4. Claude API Chat Architecture

### Conversation Context Strategy

Claude has no persistent memory between API calls. Every call must include the conversation history needed for context. The strategy is:

1. Store every message (user and assistant) in the `chat` Cosmos DB container
2. On each new message, fetch the last N messages from the DB
3. Build the messages array and call the Claude API
4. Stream the response back to the browser
5. Store the completed assistant message to the DB

### Context Window Management

Claude claude-sonnet-4-6 has a 200,000 token context window. A typical chat message is 50–200 tokens. The last 50 messages = ~5,000–10,000 tokens. In practice, include:
- System prompt with user profile + recent run data: ~1,000 tokens
- Last 20 conversation messages: ~3,000 tokens
- Current user message: ~200 tokens

Total context per request: ~4,200 tokens. Well within limits.

**Recommended approach:** Fetch last 20 messages by timestamp (descending), reverse them for chronological order in the API call.

```typescript
// POST /api/chat
export async function chatFunction(req: HttpRequest): Promise<HttpResponse> {
  const { message, userId } = await req.json();

  // 1. Fetch recent history from Cosmos DB
  const { resources: recentMessages } = await container.items
    .query({
      query: `SELECT TOP 20 * FROM c
              WHERE c.userId = @userId AND c.type = 'message'
              ORDER BY c.timestamp DESC`,
      parameters: [{ name: "@userId", value: userId }]
    })
    .fetchAll();

  recentMessages.reverse(); // chronological order

  // 2. Fetch user context for system prompt
  const profile = await getUserProfile(userId);
  const recentRuns = await getRecentRuns(userId, 5);

  // 3. Build messages for Claude API
  const systemPrompt = buildSystemPrompt(profile, recentRuns);
  const messages = [
    ...recentMessages.map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: message }
  ];

  // 4. Store user message
  await container.items.create({
    id: `msg-${Date.now()}-user`,
    userId,
    type: "message",
    role: "user",
    content: message,
    timestamp: new Date().toISOString()
  });

  // 5. Call Claude API with streaming
  const claudeStream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages
  });

  // 6. Stream response back (see streaming section below)
  // 7. Store completed assistant message to DB after stream ends
}
```

### Streaming Responses

Azure Functions supports streaming responses. The frontend reads the stream using `fetch` with `response.body.getReader()`.

**Backend (Azure Function — Node.js):**

```typescript
// Stream Claude response back to client
const stream = new ReadableStream({
  async start(controller) {
    let fullResponse = '';
    for await (const chunk of claudeStream) {
      if (chunk.type === 'content_block_delta') {
        const text = chunk.delta.text;
        fullResponse += text;
        controller.enqueue(new TextEncoder().encode(text));
      }
    }
    controller.close();
    // Store completed response to DB
    await storeAssistantMessage(userId, fullResponse);
  }
});

return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

**Frontend (React):**

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message, userId }),
  headers: { 'Content-Type': 'application/json' }
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();
let assistantMessage = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  assistantMessage += chunk;
  setCurrentMessage(assistantMessage); // update UI incrementally
}
```

**Important constraint:** The SWA API timeout is **45 seconds**. For Claude responses, this is a realistic constraint if the model generates a long response. Keep `max_tokens` reasonable (512–1024 for coaching advice). If the model is slow, 45 seconds is usually sufficient for a complete response, but not guaranteed. Monitor this in production.

### System Prompt Design

The system prompt should include dynamic context injected at call time:

```typescript
function buildSystemPrompt(profile: UserProfile, recentRuns: Run[]): string {
  return `You are an expert running coach assistant for ${profile.name}.

## Athlete Profile
- Goal: ${profile.targetRace} on ${profile.targetRaceDate}
- Current weekly volume: ~${profile.weeklyGoalKm} km/week
- Fitness level: ${profile.fitnessLevel}

## Recent Training (last 5 runs)
${recentRuns.map(r =>
  `- ${r.date}: ${r.distanceKm}km at ${r.avgPacePerKm}/km, avg HR ${r.avgHeartRate}`
).join('\n')}

## Instructions
- Be specific and actionable. Reference the athlete's actual data.
- Keep responses concise (under 300 words unless detail is requested).
- Flag concerning patterns (overtraining, injury risk).
- When asked about pacing, reference their recent pace data.`;
}
```

---

## 5. Local Development Workflow

### Tool Stack

| Tool | Purpose | Install |
|------|---------|---------|
| Azure Static Web Apps CLI (`@azure/static-web-apps-cli`) | Unified local proxy + auth emulation | `npm install -g @azure/static-web-apps-cli` |
| Azure Functions Core Tools v4 | Run Functions locally | `npm install -g azure-functions-core-tools@4` |
| Azurite | Local Blob Storage emulator | `npm install -g azurite` or Docker |
| Azure Cosmos DB Emulator | Local Cosmos DB | Windows app or Docker |

### Local Port Map

```
http://localhost:4280   ← SWA CLI unified entry point (use this in browser)
http://localhost:3000   ← Frontend dev server (Vite/React)
http://localhost:7071   ← Azure Functions Core Tools
http://localhost:10000  ← Azurite Blob Storage
http://localhost:8081   ← Cosmos DB Emulator data explorer
```

### Startup Commands (Three Terminals)

**Terminal 1 — Cosmos DB Emulator + Azurite:**
```bash
# Start Azurite (local blob storage)
azurite --location .azurite --debug .azurite/debug.log

# Start Cosmos DB Emulator (Windows: installed separately)
# Access data explorer at https://localhost:8081/_explorer/index.html
```

**Terminal 2 — Azure Functions:**
```bash
cd api
func start --port 7071
```

**Terminal 3 — SWA CLI (unified entry point):**
```bash
# After running swa init once to generate swa-cli.config.json:
swa start http://localhost:3000 --api-location http://localhost:7071

# Or with auto-start of the frontend dev server:
swa start --api-location ./api
```

### swa-cli.config.json

```json
{
  "configurations": {
    "ai-running-coach": {
      "appLocation": "./src",
      "apiLocation": "./api",
      "outputLocation": "dist",
      "appDevserverUrl": "http://localhost:3000",
      "apiDevserverUrl": "http://localhost:7071"
    }
  }
}
```

### local.settings.json (Azure Functions)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_ENDPOINT": "https://localhost:8081",
    "COSMOS_DB_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b58Oeouq+U3+GqxvM/oIJlcFByXGvA==",
    "COSMOS_DB_DATABASE": "running-coach",
    "BLOB_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "CLAUDE_MODEL": "claude-sonnet-4-6"
  }
}
```

The Cosmos DB Emulator key shown above is the well-known public emulator key — safe to commit (it is not a real credential).

### Auth Emulation

When running locally via SWA CLI, navigate to `http://localhost:4280/.auth/login/github` to get a mock authentication form. Set any username and the CLI injects a fake identity header into all subsequent requests. Your Functions can read `req.headers['x-ms-client-principal']` as normal.

---

## 6. Cost Estimation

### Monthly Usage Assumptions

- 1 user, 5 runs/week (20 runs/month)
- 10 chat interactions/week (40 conversations/month, ~5 messages each = 200 messages)
- 1 Apple Health import/month (ZIP upload + parse)
- App is accessed daily for ~15 minutes

### Service Cost Breakdown

| Service | Free Allowance | Estimated Usage | Monthly Cost |
|---------|---------------|-----------------|-------------|
| SWA (Free plan) | 100 GB bandwidth, 250 MB storage | ~50 MB storage, <1 GB bandwidth | **$0** |
| Azure Functions | 1M executions, 400K GB-seconds | ~500 executions, ~100 GB-seconds | **$0** |
| Cosmos DB (Free tier) | 1,000 RU/s, 25 GB | ~1,200 RU/month, <1 GB | **$0** |
| Blob Storage | None (pay as you go) | ~200 MB (health exports) | **~$0.004** |
| Claude API | Pay per token | ~40 calls × 5K tokens avg | **~$1–3** |
| **Total** | | | **~$1–3/month** |

**Blob Storage calculation:** 200 MB stored at $0.018/GB/month LRS hot = $0.0036/month. Negligible.

**Claude API cost** (claude-sonnet-4-6 as of 2026-03-21, verify current pricing):
- Input: $3/M tokens. 40 calls × 5,000 input tokens = 200,000 tokens = $0.60
- Output: $15/M tokens. 40 calls × 500 output tokens = 20,000 tokens = $0.30
- Monthly: ~$0.90. Budget $1–3/month for variance.

**The dominant cost is Claude API.** All Azure services stay within free tier comfortably.

### Free Tier Risk Flags

- **Cosmos DB:** Only one free tier account per subscription. If you already have a Cosmos DB free tier account in this subscription (e.g., from another project), you cannot use the free tier here.
- **SWA bandwidth:** 100 GB/month is the hard cap with no overage option on the free plan. For a single user this is not a concern.
- **Functions timeout:** If an Apple Health parse job exceeds 10 minutes, the function fails silently. Design the parse to fail fast with a user-friendly error and instructions to export fewer data types.

---

## Component Diagram

```
[Browser / React App]
       |
       | HTTPS (all traffic)
       v
[Azure Static Web Apps Edge]
   |              |
   | /api/*       | /* (static)
   v              v
[Azure Functions]  [CDN / Static Files]
   |    |    |
   |    |    +-- [Anthropic Claude API]
   |    |
   |    +-- [Azure Cosmos DB]
   |         (runs, plans, chat, profile)
   |
   +-- [Azure Blob Storage]
        (Apple Health ZIP uploads)

[Browser] ----SAS token upload---> [Azure Blob Storage]
   (direct, bypasses SWA proxy)
```

---

## Key Architecture Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Functions type | Managed (SWA Free) | Avoids $9/month Standard plan |
| Database | Cosmos DB (free tier) | Document model fits, 1 free account |
| File upload | SAS token + direct browser upload | SWA 30 MB proxy limit makes through-the-API upload impossible |
| XML parsing | Streaming SAX parser | Avoids OOM on large exports |
| Chat context | Last 20 messages + profile context | Balances context quality vs token cost |
| Claude streaming | ReadableStream + EventSource | Better UX than waiting for full response |
| Local dev | SWA CLI + Functions Core Tools | Official recommended toolchain |

---

## Sources

- Azure Static Web Apps plans and quotas: https://learn.microsoft.com/en-us/azure/static-web-apps/plans and https://learn.microsoft.com/en-us/azure/static-web-apps/quotas
- SWA API support and constraints: https://learn.microsoft.com/en-us/azure/static-web-apps/apis-overview and https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions
- SWA local development: https://learn.microsoft.com/en-us/azure/static-web-apps/local-development
- Azure Functions scale and service limits: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale
- Azure Functions Consumption plan (legacy): https://learn.microsoft.com/en-us/azure/azure-functions/consumption-plan
- Azure Functions Flex Consumption plan: https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan
- Cosmos DB free tier: https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier
- Cosmos DB data modeling example: https://learn.microsoft.com/en-us/azure/cosmos-db/model-partition-example
- Azure Blob Storage SAS overview: https://learn.microsoft.com/en-us/azure/storage/common/storage-sas-overview
- Azure Blob Storage upload patterns: https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-upload
