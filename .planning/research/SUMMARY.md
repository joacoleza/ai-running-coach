# Research Summary — AI Running Coach

## Recommended Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + TypeScript + Vite | Best ecosystem for calendar (`react-big-calendar`), charts (`recharts`), streaming chat UI |
| Hosting | Azure Static Web Apps (Free tier) | Free, built-in auth, SWA CLI for local dev |
| Backend | Azure Functions v4, Node.js 22, Windows Consumption plan | Permanent free tier (1M executions/month), Node.js-native Claude SDK, HTTP streaming support |
| Database | Cosmos DB free tier (1,000 RU/s, 25 GB) | JSON-native, no auto-pause risk (unlike Azure SQL free tier) |
| File storage | Azure Blob Storage | Required for Apple Health ZIP uploads (SWA proxy hard limit: 30 MB) |
| AI | Claude API (claude-sonnet-4-6) | Streaming SSE via Functions, ~$1–3/month for personal use |
| Auth | SWA built-in GitHub OAuth + custom role function | Zero infrastructure — check GitHub username against env var |

## Critical Architecture Decisions

### Apple Health Upload Flow
The SWA API proxy has a hard **30 MB** request body limit. Apple Health exports can be 100–500 MB. The only valid path:
1. Frontend requests a SAS token from an API function
2. Browser uploads ZIP directly to Blob Storage (bypasses SWA)
3. Blob trigger fires a background Function that SAX-parses the XML
4. Function writes structured run data to Cosmos DB

**Alternative**: Parse client-side in a Web Worker (SAX), POST compact JSON to the API. This avoids Blob Storage setup but requires more frontend complexity.

### Azure Functions Plan
Use **Windows Consumption plan** (the original, permanent free grant). Do NOT use:
- Linux Consumption — retired for new language versions as of Sept 30, 2025
- Flex Consumption — not free tier, different billing model

### Auth
SWA built-in auth with GitHub OAuth. Lock `/*` to `authenticated` role. A single role-assignment function checks the authenticated GitHub username against an `OWNER_GITHUB_USERNAME` environment variable — grants or denies the `owner` role. ~20 lines of code, zero external auth services.

### Cosmos DB Modeling
Single shared-throughput database, all containers share the 1,000 RU/s free grant. Key containers:
- `runs` — parsed workout data (distance, pace, HR, splits)
- `plans` — training plan with embedded sessions array (a plan is ≤40 KB)
- `chat_messages` — individual message documents (not embedded in conversation)
- `profile` — user goal, preferences, units setting

Rolling 20-message chat window + condensed memory summary to manage Claude context costs.

## Key Feature Decisions

### Training Plan Schema
Each session needs: `week`, `dayOfWeek`, `type` (EASY/LONG/TEMPO/INTERVAL/RECOVERY/REST/XT), `distanceKm`, `durationMin`, `paceTarget` (min/km range), `hrZoneTarget`, `notes`, `completed`, `actualRunId`.

### Apple Health Data
- HR zones must be computed (not stored in export) from HR records vs. user's max HR
- Fields: distance, duration, avg/max HR, cadence, elevation, pace — via `WorkoutStatistics` child elements
- GPS routes in separate `.gpx` files (optional to parse for v1)
- Running power/ground contact time requires Apple Watch Series 8+/Ultra — treat as optional

### Post-Run Feedback Format
Four sections: (1) acknowledge the run, (2) what was done vs plan, (3) one coaching insight, (4) any plan adjustment. Consistent, readable, not overwhelming.

### Plan Import
User pastes raw LLM conversation text. Claude extracts to normalized schema with a system prompt. **Must show preview before saving** — LLMs make unit errors and ambiguous session labels.

## Cost Estimate
- Azure: **$0/month** (all free tier services)
- Claude API: **~$1–3/month** (~40 API calls/week for one user)
- Optional: Flex Consumption always-ready instance: ~$3–5/month (eliminates cold starts)

## Open Questions (Flagged for Implementation)
1. Validate `WorkoutStatistics` type strings against a real `export.xml` before building the parser
2. Decide default display units (km vs miles) — store in km, user preference for display
3. Cold start tolerance: accept occasional cold start (free) vs. ~$4/month for always-ready instance
