# Phase 3: Run Logging & Feedback — Research

**Researched:** 2026-03-28
**Domain:** Apple Health XML parsing, Azure Blob Storage SAS + Blob trigger, Run data schema, Post-run coaching integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Support BOTH manual entry AND Apple Health ZIP upload. Manual: time + distance (required), avg HR (optional). ZIP: full workout data parsed asynchronously.
- **D-02:** ZIP upload uses SAS token → direct Blob Storage upload → Blob trigger Azure Function SAX-parses `export.xml`, extracts workouts.
- **D-03:** Max HR required for HR zones. Optional — if unset, HR zones are skipped (no error).
- **D-04:** Active plan run-to-day linking rules: match by date → link + mark completed; no entry → create + link; skipped → unskip + link; already completed → 409.
- **D-05:** Archived plan linking: no run linked → link if no run exists; already has run → 409; store unlinked if not completed yet.
- **D-06:** No matching plan date → store run unlinked, no error.
- **D-07:** "Complete" button on active day → prompt for time (required), distance (required), avg BPM (optional) → mark complete + create run.
- **D-08:** Completed days with no linked run → show "Add run data" affordance.
- **D-09:** Coach must ask for time + distance for past runs before creating them. BPM optional.
- **D-10:** Undo on completed day with linked run → unlink only (day reverts, run stays in Runs list).
- **D-11:** Unlinked runs are deletable. Linked runs are protected (must undo day first).
- **D-12:** Coach cannot regenerate plan from scratch if any days have linked run data. Inform + suggest alternatives.
- **D-13:** Archiving with linked run data is allowed.
- **D-14:** Post-run coaching output: (1) streamed chat feedback; (2) insights field on run record; (3) "Latest coach insight" on Training Plan page (always visible); (4) "Estimated finish time" on Training Plan page.
- **D-15:** ZIP upload UX: "Uploading..." → "Parsing..." (polling) → "Done — run logged".
- **D-16:** After successful processing, navigate to Runs page or open Coach panel for feedback.
- **D-17:** Runs page: ALL runs, reverse date order, including archived plan runs.
- **D-18:** Infinite scroll.
- **D-19:** Filters: date range, distance range, time range.
- **D-20:** Run row: date, distance, time, pace, optional bpm. Click → run detail.
- **D-21:** Run detail: all fields + insights + link to plan (if linked).
- **D-22:** Delete button on run detail — visible only if unlinked.
- **D-23:** Max HR added to plan goal/profile. Defaults to empty. Used only for ZIP parse zone computation.

### Claude's Discretion

- HR zone display on run detail: zone breakdown bar/chart vs. zone label (e.g., "Zone 3 — Aerobic").
- ZIP parse scope: all workouts since last upload OR configurable lookback (e.g., 30 days).
- Whether coach feedback fires immediately after parse or after a brief "view your run?" prompt.

### Deferred Ideas (OUT OF SCOPE)

- GPS route display from Apple Health `.gpx` files (v2 ENCO-03).
- HR zone charts — visual zone breakdown per run (v2 ANLX-01). Phase 3 stores zone data; visualization deferred.
- Strava/Garmin integrations.
- Screenshot OCR.
- Weekly volume trends (ANLX-02).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | User can upload an Apple Health export ZIP file | SAS token flow + direct Blob upload; `@azure/storage-blob` already installed |
| RUN-02 | App extracts workout data: distance, duration, avg/max HR, pace, cadence, elevation | `sax` npm package for streaming XML parse from ZIP; Apple Health XML schema documented below |
| RUN-03 | HR zones computed from HR records and user's max HR | Simple percentage-of-max formula; 5-zone model; stored on run record |
| RUN-04 | Parsed run data stored and linked to training plan session | New `runs` MongoDB collection; link via `planId` + `date` foreign keys; `PATCH /api/plan/days/:date` marks complete |
| RUN-05 | Upload is async — browser gets immediate feedback while parsing runs in background | Blob trigger function; upload status stored in MongoDB or Blob metadata; frontend polls `GET /api/runs/upload-status/:uploadId` |
| COACH-03 | Post-run: coach provides feedback (run summary vs plan, one insight, any plan adjustment) | Existing chat streaming infrastructure; new `POST /api/runs/coach-feedback` triggers chat message creation |
| COACH-04 | Coach can adjust the training plan based on run history and conversation | Existing `<plan:update>` tag protocol already wired; system prompt receives run context |
</phase_requirements>

---

## Summary

Phase 3 adds two input paths (manual form entry and Apple Health ZIP upload) that both converge on the same run record creation, plan-day linking, and post-run coaching trigger. The most technically complex piece is the ZIP upload path: the browser requests a SAS token, uploads directly to Azure Blob Storage (bypassing the 30 MB SWA proxy limit), and a Blob trigger Azure Function asynchronously decompresses the ZIP, SAX-parses `export.xml`, and extracts running workouts.

All critical Azure dependencies are already installed: `@azure/storage-blob@12.31.0` is in `api/package.json` and Azurite is in `docker-compose.yml`. The `sax` npm package (v1.6.0) is the recommended streaming XML parser for large Apple Health exports (100–500 MB). The `unzipper` npm package handles streaming ZIP extraction without loading the whole archive into memory. Both need to be installed.

The post-run coaching path reuses the existing chat streaming infrastructure entirely — no new streaming machinery needed. The Blob trigger writes a run record to MongoDB and triggers the coach via the same `POST /api/chat` endpoint or a dedicated trigger. The system prompt must be extended to include run context when post-run coaching is active.

**Primary recommendation:** Use `sax` (streaming) + `unzipper` (streaming) to process Apple Health ZIPs without memory pressure. Store upload/parse status in a `uploads` MongoDB collection polled by the frontend. Reuse `useChat` / chat streaming for post-run coaching — no new streaming plumbing.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@azure/storage-blob` | 12.31.0 (already installed) | SAS token generation, Blob upload, Blob trigger binding | Already in api/package.json; official Azure SDK |
| `sax` | 1.6.0 | Streaming SAX XML parser for `export.xml` | Battle-tested, zero dependencies, handles large files without loading into memory; Apple Health files 100–500 MB |
| `unzipper` | 0.12.3 | Streaming ZIP extraction | Never loads whole archive into memory; pipe-friendly for Node.js streams |
| `mongodb` | 7.1.0 (already installed) | Runs collection, upload status collection | Already in use; new `runs` and `uploads` collections follow existing patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@azure/functions` | 4.12.0 (already installed) | Blob trigger registration via `app.storageBlob()` | New blob trigger function for ZIP processing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sax` | `saxes` | saxes is stricter and faster but has no Stream API — requires manual chunked writes; sax's stream API is simpler for piping from unzipper |
| `unzipper` | `adm-zip` | adm-zip loads entire ZIP into memory — unsuitable for 500 MB files |
| MongoDB upload status | Azure Blob metadata | Blob metadata requires extra SDK calls; MongoDB is already connected in every function |

**Installation (new packages only):**
```bash
cd api && npm install sax unzipper
npm install --save-dev @types/sax @types/unzipper
```

**Version verification (confirmed 2026-03-28):**
- `sax`: 1.6.0
- `unzipper`: 0.12.3
- `@azure/storage-blob`: 12.31.0 (already installed)

---

## Architecture Patterns

### New Collections

```
MongoDB: running-coach database
├── plans          (existing)
├── messages       (existing)
├── runs           (NEW) — one document per logged run
└── uploads        (NEW) — one document per ZIP upload attempt, tracks parse status
```

**Run document shape:**
```typescript
interface Run {
  _id?: ObjectId;
  date: string;           // YYYY-MM-DD (local date of the run)
  source: 'manual' | 'apple-health';
  distance: number;       // km
  duration: number;       // minutes
  avgHR?: number;         // bpm
  maxHR?: number;         // bpm
  pace?: string;          // "mm:ss" per km
  cadence?: number;       // steps per minute
  elevationGain?: number; // meters
  hrZone?: number;        // dominant zone (1–5) computed from time-in-zone
  hrZoneLabel?: string;   // e.g., "Zone 3 — Aerobic"
  planId?: string;        // ObjectId string of linked plan (if any)
  planDayDate?: string;   // YYYY-MM-DD of linked plan day (if any)
  insights?: string;      // post-run coaching note stored here
  createdAt: Date;
}
```

**Upload document shape:**
```typescript
interface Upload {
  _id?: ObjectId;
  status: 'pending' | 'processing' | 'done' | 'error';
  blobName: string;        // name in Blob Storage container
  runsExtracted?: number;  // count of runs parsed out
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### New API Endpoints

```
POST  /api/runs/sas-token     — request SAS URL for direct Blob upload
GET   /api/runs/upload-status/:uploadId — poll status of a ZIP parse job
POST  /api/runs              — create a run (manual entry OR post-parse internal)
GET   /api/runs              — list all runs (reverse date, with filters)
GET   /api/runs/:id          — single run detail
DELETE /api/runs/:id         — delete unlinked run only
POST  /api/runs/:id/coach-feedback — trigger post-run coaching chat message
```

### New Azure Function Files

```
api/src/functions/
├── runSasToken.ts     — POST /api/runs/sas-token (HTTP trigger)
├── runs.ts            — GET/POST /api/runs, GET/DELETE /api/runs/:id (HTTP trigger)
├── runCoach.ts        — POST /api/runs/:id/coach-feedback (HTTP trigger)
└── runBlobTrigger.ts  — Blob trigger on 'apple-health-uploads/{name}'
```

### Recommended Project Structure

```
api/src/
├── functions/
│   ├── runSasToken.ts         # SAS token endpoint
│   ├── runs.ts                # CRUD endpoints
│   ├── runCoach.ts            # Post-run coaching trigger
│   └── runBlobTrigger.ts      # Blob trigger + parse pipeline
├── shared/
│   ├── types.ts               # Add Run, Upload interfaces
│   ├── runParser.ts           # SAX parser logic (pure, testable)
│   └── hrZones.ts             # HR zone computation (pure, testable)
web/src/
├── pages/Runs.tsx             # Full implementation
├── pages/RunDetail.tsx        # New page
├── hooks/useRuns.ts           # Fetch/mutation hook for runs
├── components/runs/
│   ├── RunRow.tsx             # Row in list
│   ├── RunUploadForm.tsx      # ZIP upload form with status polling
│   └── ManualRunForm.tsx      # Manual entry form
└── components/plan/
    └── DayRow.tsx             # Extended: Complete button → run form
```

### Pattern 1: SAS Token + Direct Upload

**What:** Browser requests a pre-signed URL from the API, then uploads directly to Azure Blob Storage using that URL. The SWA proxy never sees the ZIP body.
**When to use:** Files > 1 MB or > 30 MB (SWA proxy limit). Apple Health ZIPs are 30–500 MB.

```typescript
// Source: https://learn.microsoft.com/en-us/azure/storage/blobs/sas-service-create-javascript
// api/src/functions/runSasToken.ts
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
} from '@azure/storage-blob';

const blobName = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`;
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const sasOptions = {
  containerName: 'apple-health-uploads',
  blobName,
  startsOn: new Date(),
  expiresOn: new Date(Date.now() + 15 * 60 * 1000), // 15 min
  permissions: BlobSASPermissions.parse('cw'),        // create + write
};
const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
const uploadUrl = `https://${accountName}.blob.core.windows.net/apple-health-uploads/${blobName}?${sasToken}`;
```

**Frontend upload (PUT directly to Blob Storage):**
```typescript
// web/src/components/runs/RunUploadForm.tsx
const { uploadId, uploadUrl } = await fetch('/api/runs/sas-token', { ... }).then(r => r.json());
await fetch(uploadUrl, { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob' }, body: file });
// Now poll: GET /api/runs/upload-status/:uploadId
```

### Pattern 2: Blob Trigger — Azure Functions v4

**What:** `app.storageBlob()` registers a function that fires when a blob is written to the container. The handler receives the blob as a `Buffer`.
**When to use:** Async post-upload processing (ZIP parse, run extraction).

```typescript
// Source: https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-blob-trigger
// api/src/functions/runBlobTrigger.ts
import { app, InvocationContext } from '@azure/functions';

app.storageBlob('parseAppleHealthUpload', {
  path: 'apple-health-uploads/{name}',
  connection: 'AzureWebJobsStorage',  // matches local.settings.json key
  handler: async (blob: Buffer, context: InvocationContext) => {
    const blobName = context.triggerMetadata?.name as string;
    // 1. Find upload record by blobName, set status='processing'
    // 2. Extract export.xml from ZIP using unzipper
    // 3. SAX-parse export.xml, extract HKWorkoutActivityTypeRunning workouts
    // 4. For each workout: compute HR zones, create Run record, link to plan
    // 5. Trigger post-run coaching
    // 6. Set upload status='done'
  },
});
```

**Critical note:** Azure Functions Node.js blob trigger loads the entire blob into `Buffer`. For 500 MB ZIPs this means 500 MB in-memory. The Consumption plan has a 1.5 GB memory limit. Apple Health ZIPs are compressed; a 500 MB ZIP typically contains a 100–300 MB `export.xml`. This is within limits but must be noted. If memory becomes an issue, use the Event Grid source type (lower latency, more resilient) rather than the polling blob trigger.

### Pattern 3: Streaming ZIP + SAX Parse Pipeline

**What:** Use `unzipper` to extract `export.xml` entry as a stream, pipe into `sax` stream parser, collect workouts without loading full XML into memory.
**When to use:** XML files > 100 MB.

```typescript
// api/src/shared/runParser.ts
import unzipper from 'unzipper';
import sax from 'sax';

export async function parseAppleHealthZip(zipBuffer: Buffer): Promise<ParsedWorkout[]> {
  const workouts: ParsedWorkout[] = [];
  const directory = await unzipper.Open.buffer(zipBuffer);
  const exportFile = directory.files.find(f => f.path === 'apple_health_export/export.xml');
  if (!exportFile) throw new Error('export.xml not found in ZIP');

  const xmlStream = exportFile.stream();
  const saxStream = sax.createStream(true /* strict */);

  let currentWorkout: Partial<ParsedWorkout> | null = null;

  saxStream.on('opentag', (node) => {
    if (node.name === 'Workout' &&
        node.attributes['workoutActivityType'] === 'HKWorkoutActivityTypeRunning') {
      currentWorkout = {
        startDate: node.attributes['startDate'] as string,
        endDate:   node.attributes['endDate'] as string,
        duration:  parseFloat(node.attributes['duration'] as string),
        // totalDistance may be null for treadmill — check totalDistanceUnit
        distance:  node.attributes['totalDistance']
                     ? parseFloat(node.attributes['totalDistance'] as string)
                     : 0,
      };
    }
    if (currentWorkout && node.name === 'WorkoutStatistics') {
      const type = node.attributes['type'] as string;
      if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') { /* skip */ }
      if (type === 'HKQuantityTypeIdentifierHeartRate') {
        currentWorkout.avgHR = parseFloat(node.attributes['average'] as string);
        currentWorkout.maxHR = parseFloat(node.attributes['maximum'] as string);
      }
      if (type === 'HKQuantityTypeIdentifierRunningCadence') {
        currentWorkout.cadence = parseFloat(node.attributes['average'] as string);
      }
    }
  });

  saxStream.on('closetag', (name) => {
    if (name === 'Workout' && currentWorkout?.startDate) {
      workouts.push(currentWorkout as ParsedWorkout);
      currentWorkout = null;
    }
  });

  await new Promise<void>((resolve, reject) => {
    xmlStream.pipe(saxStream);
    saxStream.on('end', resolve);
    saxStream.on('error', reject);
  });

  return workouts;
}
```

### Pattern 4: HR Zone Computation

**What:** Compute 5-zone breakdown from avg HR and user's max HR using percentage-of-max method.
**When to use:** Any run with HR data + user has maxHR set.

```typescript
// api/src/shared/hrZones.ts
export function computeHrZone(avgHR: number, maxHR: number): { zone: number; label: string } {
  const pct = avgHR / maxHR;
  if (pct < 0.60) return { zone: 1, label: 'Zone 1 — Recovery' };
  if (pct < 0.70) return { zone: 2, label: 'Zone 2 — Aerobic Base' };
  if (pct < 0.80) return { zone: 3, label: 'Zone 3 — Aerobic' };
  if (pct < 0.90) return { zone: 4, label: 'Zone 4 — Threshold' };
  return { zone: 5, label: 'Zone 5 — Maximum' };
}
```

### Pattern 5: Post-Run Coaching Trigger

**What:** After a run is created and linked, trigger a post-run coaching chat message using the existing streaming chat infrastructure.
**When to use:** Every time a run is successfully logged (either path).

The cleanest approach is to call the post-run coaching from the same function that creates the run, passing the run context as a system-level message prepended to the chat request. The existing `POST /api/chat` endpoint already handles SSE streaming and message persistence. The frontend polls for run creation, then the coach panel auto-opens.

**System prompt extension needed:** `buildSystemPrompt` must accept an optional `latestRun` parameter so the post-run coaching prompt can include run stats inline.

### Anti-Patterns to Avoid

- **Loading full ZIP into DOM parser:** Do not use `DOMParser` or `xml2js` — they require the entire document in memory.
- **Synchronous ZIP extraction (adm-zip):** For 500 MB files, blocks the event loop and may OOM.
- **Storing full HR time-series from export.xml:** Apple Health files contain thousands of individual HR `Record` elements per run. Extract only the aggregated avg/max from `WorkoutStatistics`, not individual samples.
- **Blocking the Blob trigger on coaching:** The Blob trigger should persist the run and enqueue coaching asynchronously; do not call Claude API synchronously in the blob trigger (long timeouts, retry storms).
- **Using `npx func start`:** Per CLAUDE.md — always use `npm run start` from `api/` which uses `node_modules/.bin/func`.

---

## Apple Health export.xml Schema (Confirmed by Community Analysis)

### Workout Element

```xml
<Workout
  workoutActivityType="HKWorkoutActivityTypeRunning"
  duration="45.23"
  durationUnit="min"
  totalDistance="8.50"
  totalDistanceUnit="km"
  totalEnergyBurned="550"
  totalEnergyBurnedUnit="kcal"
  sourceName="Joa's Apple Watch"
  sourceVersion="9.5"
  creationDate="2026-03-15 08:45:22 +0000"
  startDate="2026-03-15 07:00:00 +0000"
  endDate="2026-03-15 07:45:14 +0000">

  <!-- Aggregate stats per metric -->
  <WorkoutStatistics
    type="HKQuantityTypeIdentifierHeartRate"
    startDate="2026-03-15 07:00:00 +0000"
    endDate="2026-03-15 07:45:14 +0000"
    average="148"
    minimum="120"
    maximum="172"
    unit="count/min"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierRunningCadence"
    average="172"
    unit="count/min"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierActiveEnergyBurned"
    sum="548.3"
    unit="Cal"/>

  <!-- Elevation gain in some exports: -->
  <WorkoutStatistics
    type="HKQuantityTypeIdentifierFlightsClimbed"
    sum="12"
    unit="count"/>

  <WorkoutRoute>...</WorkoutRoute>
</Workout>
```

**Key attributes for running workouts:**
- `workoutActivityType` = `"HKWorkoutActivityTypeRunning"` (filter to this)
- `duration` + `durationUnit` — actual workout duration
- `totalDistance` + `totalDistanceUnit` — may be empty for treadmill runs
- `startDate` — use this for the date key, convert to YYYY-MM-DD local
- `WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate"` — `average` and `maximum` attributes

**Date handling:** Dates in export.xml are in format `"2026-03-15 07:00:00 +0000"`. Parse with `new Date(dateStr)` — works in Node.js. Convert to local YYYY-MM-DD for plan matching.

**Confidence:** MEDIUM — confirmed via community analysis; exact attribute names verified against multiple independent sources. Actual export.xml not available to inspect directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP extraction | Custom binary parser | `unzipper` (npm) | ZIP format has complex edge cases (Zip64, encoding, compression methods) |
| XML streaming parse | String scan / regex | `sax` (npm) | XML escaping, namespaces, encoding, CDATA — all handled; regex breaks on `>` in attributes |
| SAS token generation | Manual HMAC-SHA256 | `@azure/storage-blob` `generateBlobSASQueryParameters` | Canonicalization rules are complex; SDK already installed |
| Blob metadata polling | Custom event bus | MongoDB `uploads` collection + HTTP poll | Simplest approach for single-user app; no extra infra |
| HR zones | External service call | Pure function with constants | Simple percentage-of-max formula; no library needed |
| Run-to-plan date matching | Fuzzy distance matching | Exact date match first, then ±1 day fallback | User decides the date, not the algorithm; avoid false matches |

**Key insight:** The ZIP + XML pipeline is the only genuinely complex piece. Both libraries are mature, well-maintained, and used in production for Apple Health data processing.

---

## Common Pitfalls

### Pitfall 1: Blob Trigger Memory Pressure

**What goes wrong:** For large Apple Health ZIPs (300–500 MB), the Azure Functions Consumption plan may hit the 1.5 GB memory limit when the blob is loaded as a `Buffer` AND `unzipper` holds the extracted XML in memory simultaneously.

**Why it happens:** The v4 Node.js blob trigger model loads the entire blob into a `Buffer` before calling the handler. There is no streaming blob input for Node.js (unlike C#).

**How to avoid:** Instruct users that Phase 3 supports exports up to ~200 MB comfortably. For large exports, `unzipper.Open.buffer()` streams the XML entry without loading it fully — memory pressure comes only from the compressed blob buffer itself. A typical Apple Health ZIP is highly compressed (XML compresses 5–10x), so a 50 MB ZIP contains ~300 MB XML but the Buffer is only 50 MB.

**Warning signs:** Azure Function timeout (5-minute default on Consumption), OOM crash in Application Insights.

### Pitfall 2: Apple Health Date Timezone Mismatch

**What goes wrong:** `export.xml` dates are in UTC (`+0000` suffix). A run at 11 PM local time appears as the next day in UTC. Plan matching fails.

**Why it happens:** `new Date("2026-03-15 23:30:00 +0000").toISOString().split('T')[0]` returns `"2026-03-16"` for UTC+0, but the user logged the run on March 15 locally.

**How to avoid:** Parse the `startDate` attribute and apply the user's UTC offset. Since all data comes from a single Apple Watch on a single device, the offset is embedded in the export string. Use the offset from the date string (`+0000`, `-0500`, etc.) to reconstruct the local date. The plan date (YYYY-MM-DD) was entered in local time, so matching must be done in local time.

**Warning signs:** Runs appear linked to the wrong plan day; coach references wrong training session.

### Pitfall 3: Duplicate Workout Extraction

**What goes wrong:** Apple Health exports contain ALL historical workouts. If the user uploads multiple times, the same runs get parsed and inserted again.

**Why it happens:** The blob trigger runs on every new upload; there is no built-in deduplication.

**How to avoid:** Before inserting each parsed workout, query the `runs` collection for an existing record with the same `startDate` (exact match). If found, skip insertion. Alternatively, use `startDate` as a unique index on the `runs` collection.

**Warning signs:** Duplicate runs in the Runs list; plan days marked complete twice (409 on second attempt).

### Pitfall 4: Azurite Blob Trigger Not Firing Locally

**What goes wrong:** `AzureWebJobsStorage: "UseDevelopmentStorage=true"` in `local.settings.json` points to Azurite, but the blob trigger may not fire when using the default polling trigger mechanism.

**Why it happens:** The default blob trigger uses a polling mechanism that only checks every 10 seconds. With Azurite, blob events may be delayed or missed if Azurite is not running when the function starts.

**How to avoid:** Ensure Azurite is started before `func start`. Since `docker compose up -d azurite` starts it, add this to dev docs. Test the blob trigger with a dedicated integration test that uploads a fixture ZIP to Azurite and waits for the handler to complete.

**Warning signs:** Blob trigger never fires in local dev; function only works in Azure.

### Pitfall 5: `<plan:add>` vs `<plan:update>` Confusion in Coaching

**What goes wrong:** After a run is logged for a date with no plan entry, the coach creates a `<plan:add>` for a past date. The existing `addDay` handler returns 400 for past dates without `completed: true`.

**Why it happens:** The D-04 rule says "create a new day entry" for unmatched dates. But `POST /api/plan/days` currently rejects past dates unless `completed` or `skipped` flags are set.

**How to avoid:** When the system creates a day via run logging (not via the coach), bypass the past-date check OR always set `completed: true` on the created day. The API endpoint at `POST /api/plan/days` already supports `completed: true` for past dates — the run logging code must always pass this flag.

### Pitfall 6: SAS Token CORS for Direct Blob Upload

**What goes wrong:** Browser `PUT` to `*.blob.core.windows.net` is blocked by CORS when the storage account doesn't have CORS configured.

**Why it happens:** Azure Storage accounts require explicit CORS configuration to accept cross-origin PUT requests from the browser.

**How to avoid:** Configure CORS on the storage account: allow origin `*` (or the SWA domain), methods `PUT`, headers `x-ms-blob-type`. In local dev with Azurite, CORS is permissive by default.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Azure Functions v3 with `function.json` | v4 model with `app.storageBlob()` in TypeScript | 2023 GA | No `function.json` file needed; handler registered in code |
| `xml2js` for parsing | `sax` streaming | N/A — sax has always been recommended for large files | Memory-safe for 100–500 MB Apple Health exports |

**Deprecated/outdated:**
- `function.json` blob trigger configuration: Replaced by `app.storageBlob()` in v4 model. Do NOT create `function.json` — this project already uses the v4 model.
- `azure-storage` npm package: Replaced by `@azure/storage-blob`. Already using the correct package.

---

## Open Questions

1. **Blob trigger memory ceiling for 500 MB ZIPs**
   - What we know: v4 Node.js blob trigger loads blob into `Buffer`. Consumption plan limit is 1.5 GB. A 500 MB ZIP = 500 MB buffer + ~50 MB for unzipper overhead = ~550 MB, within limits.
   - What's unclear: Whether Apple Watch exports with multi-year history can exceed 500 MB ZIP.
   - Recommendation: Enforce a 200 MB client-side file size check before upload with a user-friendly error. Document workaround (export shorter date range) if rejected.

2. **How to trigger post-run coaching without double-streaming**
   - What we know: The Blob trigger can write the run to MongoDB. The coach feedback should flow through the existing chat SSE infrastructure.
   - What's unclear: The Blob trigger is a background process — it cannot directly open an SSE connection to the browser. The frontend must poll for run completion, then trigger coaching via a separate HTTP call.
   - Recommendation: After frontend detects `status=done` via polling, frontend calls `POST /api/runs/:id/coach-feedback` which sends a synthetic user message to the chat endpoint ("I just completed my run..."). This keeps all coaching through the existing stream path.

3. **Apple Health export.xml path inside ZIP**
   - What we know: Community sources and Apple documentation indicate the file is at `apple_health_export/export.xml` inside the ZIP.
   - What's unclear: Whether this path has changed across iOS versions.
   - Recommendation: Search for any file matching `*/export.xml` pattern rather than hardcoding the full path, with a fallback log if not found.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MongoDB | Run + Upload persistence | ✓ | 7 (docker-compose) | — (required per CLAUDE.md) |
| Azurite (Azure Storage emulator) | Blob trigger + SAS token local dev | ✓ | in docker-compose.yml | — |
| `@azure/storage-blob` | SAS token generation | ✓ | 12.31.0 (installed) | — |
| `sax` | XML streaming parse | ✗ (not installed) | 1.6.0 available | — (required for ZIP path) |
| `unzipper` | ZIP streaming extraction | ✗ (not installed) | 0.12.3 available | — (required for ZIP path) |
| Azure Functions Core Tools | Local `func start` | ✓ | v4 (local dev dependency in api/) | — |
| Docker | Azurite + MongoDB containers | ✓ (assumed — used in prior phases) | — | — |

**Missing dependencies with no fallback:**
- `sax` and `unzipper` — must be installed in `api/` before ZIP upload path can be implemented.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.4 |
| Config file | `api/vitest.config.ts`, `web/vitest.config.ts` |
| Quick run command | `cd api && npm test` or `cd web && npm test` |
| Full suite command | `cd api && npm test && cd ../web && npm test && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | SAS token endpoint returns uploadUrl + uploadId | unit | `cd api && npm test -- --grep "sas-token"` | ❌ Wave 0 |
| RUN-01 | Frontend uploads file to blob URL using PUT | unit (mock fetch) | `cd web && npm test -- --grep "RunUploadForm"` | ❌ Wave 0 |
| RUN-02 | SAX parser extracts running workouts from export.xml fixture | unit | `cd api && npm test -- --grep "runParser"` | ❌ Wave 0 |
| RUN-02 | WorkoutStatistics avg/max HR parsed correctly | unit | included in runParser tests | ❌ Wave 0 |
| RUN-03 | HR zone computed correctly for each boundary value | unit | `cd api && npm test -- --grep "hrZones"` | ❌ Wave 0 |
| RUN-04 | Manual run POST creates run + patches plan day completed | integration | `cd api && npm test -- --grep "runs"` | ❌ Wave 0 |
| RUN-04 | Undo on completed day with linked run unlinks run only | integration | included in runs tests | ❌ Wave 0 |
| RUN-04 | Linked run blocks delete; unlinked run allows delete | integration | included in runs tests | ❌ Wave 0 |
| RUN-05 | Upload status polling returns pending → done | integration | included in runs tests | ❌ Wave 0 |
| COACH-03 | Post-run feedback stored as `insights` on run record | integration | included in runCoach tests | ❌ Wave 0 |
| COACH-03 | "Latest coach insight" visible on Training Plan page | E2E | `npx playwright test --grep "coach insight"` | ❌ Wave 0 |
| COACH-04 | plan:update from post-run coaching updates plan day | unit | `cd web && npm test -- --grep "planUpdate"` | ✅ (existing planUpdate.test.ts) |

### Sampling Rate
- **Per task commit:** `cd api && npm test` (unit + integration)
- **Per wave merge:** `cd api && npm test && cd web && npm test`
- **Phase gate:** `cd api && npm test && cd web && npm test && npx playwright test` — all green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `api/src/__tests__/runParser.test.ts` — covers RUN-02 (SAX parsing with fixture XML)
- [ ] `api/src/__tests__/hrZones.test.ts` — covers RUN-03 (zone boundary values)
- [ ] `api/src/__tests__/runs.test.ts` — covers RUN-04, RUN-05 (CRUD, linking, status polling)
- [ ] `api/src/__tests__/runSasToken.test.ts` — covers RUN-01 (SAS endpoint)
- [ ] `api/src/__tests__/runBlobTrigger.test.ts` — covers RUN-02 end-to-end (trigger mock)
- [ ] `web/src/__tests__/Runs.test.tsx` — covers Runs page list + filter rendering
- [ ] `web/src/__tests__/RunUploadForm.test.tsx` — covers RUN-01 frontend upload flow
- [ ] `web/src/__tests__/ManualRunForm.test.tsx` — covers manual entry form
- [ ] `e2e/run-logging.spec.ts` — covers COACH-03 E2E (upload → feedback visible)
- [ ] Test fixture: `api/src/__tests__/fixtures/sample-export.xml` — minimal valid Apple Health XML with 2 running workouts

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives apply to this phase and must be honored by the planner:

- **MongoDB must be running** — all API requests return 503 if MongoDB is down. No graceful degradation.
- **`func start` from `api/` only** — use `npm run start` (not `npx func start`). `azure-functions-core-tools@4` is the local dev dependency.
- **`FUNCTIONS_WORKER_RUNTIME=node`** — must be set explicitly. Already in `local.settings.json`.
- **`ANTHROPIC_API_KEY` never in test environments** — mock `@anthropic-ai/sdk` via `vi.mock()`. `playwright.config.ts` sets `ANTHROPIC_API_KEY=''` in webServer env.
- **`<plan:update>` and `<plan:add>` stripped during streaming** — already wired in `useChat.ts`. Post-run coaching reuses this.
- **Plan replace guard** — `POST /api/plan/generate` must also check for linked run data (D-12). Extend the existing guard.
- **`DELETE /api/plan/days/:date` returns 409 for completed days** — already enforced. Run unlinking (undo) goes through existing `PATCH` endpoint.
- **`POST /api/plan/days` requires `completed: true` for past dates** — run logging for past dates must always pass this flag.
- **Tests are part of execution** — unit + integration + E2E all run as part of every phase. Never ask user to run tests.
- **E2E tests are mandatory** — run `npx playwright test` after every set of changes.
- **Never commit to `master`** — feature branch required.
- **Always rebase onto master before pushing**.
- **Ask for confirmation before pushing**.

---

## Sources

### Primary (HIGH confidence)
- `api/package.json` — confirms `@azure/storage-blob@12.31.0` already installed; `sax` and `unzipper` not installed
- `api/host.json` — confirms ExtensionBundle `[4.*, 5.0.0)` — blob trigger extension included
- `docker-compose.yml` — confirms Azurite already in local dev stack
- `api/local.settings.json` — confirms `AzureWebJobsStorage: "UseDevelopmentStorage=true"` and `BLOB_CONNECTION_STRING`
- `api/src/shared/types.ts` — confirmed current Plan/PlanDay schema to extend
- `api/src/functions/planDays.ts` — confirmed Azure Functions v4 `app.http()` pattern in use
- [Microsoft Learn — Azure Blob Storage SAS for JavaScript](https://learn.microsoft.com/en-us/azure/storage/blobs/sas-service-create-javascript) — `generateBlobSASQueryParameters` API confirmed
- [Microsoft Learn — Azure Blob Storage Trigger](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-blob-trigger) — `app.storageBlob()` v4 syntax confirmed

### Secondary (MEDIUM confidence)
- [sax npm](https://www.npmjs.com/package/sax) — v1.6.0 confirmed; stream API confirmed
- [unzipper npm](https://www.npmjs.com/package/unzipper) — v0.12.3 confirmed; streaming, no full-buffer load
- [saxes npm](https://www.npmjs.com/package/saxes) — v6.0.0; faster but no Stream API — excluded
- Apple Health XML schema — confirmed via multiple community analysis articles (R-bloggers, Python guides); element names cross-verified across 3+ sources

### Tertiary (LOW confidence)
- Apple Health ZIP internal path `apple_health_export/export.xml` — confirmed by community but not official Apple documentation. Planner should implement flexible path search.
- Blob trigger memory limits (1.5 GB Consumption plan) — from Microsoft Q&A and community sources; should be validated against current Azure documentation at execution time.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions verified from npm registry; Azure SDK already installed in project
- Architecture: HIGH — follows established project patterns; new endpoints mirror existing `planDays.ts` shape
- Apple Health XML schema: MEDIUM — confirmed by community analysis; not official Apple docs
- Pitfalls: MEDIUM — Azurite blob trigger behavior and memory limits from community/Q&A sources

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable libraries; Azure Functions v4 and @azure/storage-blob are stable APIs)
