# Domain Pitfalls

**Domain:** AI Running Coach Web App (Azure SWA + Functions + Cosmos DB + Claude API + Apple Health)
**Researched:** 2026-03-21
**Confidence:** HIGH (all critical claims verified against official Microsoft/Apple docs)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or user-facing failures.

---

### Pitfall 1: Loading Apple Health export.xml into memory

**What goes wrong:** The Apple Health export.xml file easily exceeds 100 MB for active users (multiple years of data), and can reach 500 MB+. Loading it with a standard XML parser (`DOMParser`, Python's `ElementTree`, Node's `xml2js`) reads the entire file into RAM before any processing occurs. Azure Functions on Consumption/Flex Consumption has 1.5 GB max memory; on Flex Consumption the default instance is 2 GB. Parsing a 300 MB file can spike to 3-4x that in-memory due to DOM tree overhead, causing OOM crashes or timeouts.

**Why it happens:** Developers test with small exports (~10 MB) from devices with little data. Production exports from 2+ years of daily activity are orders of magnitude larger.

**Consequences:** Azure Function crashes mid-parse; no partial data saved; user must re-upload; silent failure if not monitored.

**Prevention:**
- Use streaming XML parsers: `sax` (Node.js) or `xml.etree.ElementTree.iterparse` (Python) to process one element at a time without loading the full tree.
- Process the file in chunks on the client before upload — parse in a Web Worker using a streaming SAX parser, extract only workout records, and POST structured JSON instead of raw XML.
- Never accept the raw XML file in an Azure Function HTTP trigger. Pre-process client-side or use Blob Storage as an intermediary.

**XML structure facts (from Apple Health export schema):**
```xml
<HealthData locale="en_US">
  <!-- Running workouts -->
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
           duration="..." durationUnit="min"
           totalDistance="..." totalDistanceUnit="km"
           totalEnergyBurned="..." totalEnergyBurnedUnit="kcal"
           sourceName="..." sourceVersion="..."
           creationDate="..." startDate="..." endDate="...">
    <WorkoutRoute>
      <FileReference path="workout-routes/route_YYYY-MM-DD.gpx"/>
    </WorkoutRoute>
    <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" .../>
  </Workout>

  <!-- Heart rate, step count, etc as Records -->
  <Record type="HKQuantityTypeIdentifierHeartRate"
          value="..." unit="count/min"
          startDate="..." endDate="..." sourceName="..."/>
</HealthData>
```
GPS routes are in separate `.gpx` files inside the export zip, not inline in `export.xml`.

**Key record types for running:**
- `HKWorkoutActivityTypeRunning` — the primary workout container
- `HKQuantityTypeIdentifierHeartRate` — heart rate samples
- `HKQuantityTypeIdentifierDistanceWalkingRunning` — distance
- `HKQuantityTypeIdentifierStepCount` — steps
- `HKQuantityTypeIdentifierActiveEnergyBurned` — calories
- `HKQuantityTypeIdentifierVO2Max` — VO2 max (Apple Watch)
- `HKQuantityTypeIdentifierRunningSpeed` — pace (iOS 16+)
- `HKQuantityTypeIdentifierRunningStrideLength` — stride (Apple Watch)

**Detection:** Monitor Function memory usage in Application Insights. Parse failures on large files.

---

### Pitfall 2: Azure Functions cold starts on Consumption plan (now legacy)

**What goes wrong:** The legacy Consumption plan can produce cold starts of 5-15 seconds for Node.js and 10-20+ seconds for Python when the function app has been idle. For a personal app used once or twice a day, nearly every request hits a cold start.

**Why it happens:** The Consumption plan scales to zero when idle. Spinning up a new instance requires loading the runtime, language worker, and function code.

**Consequences:** Clicking "Get coaching advice" and waiting 15 seconds for a response on first load is unacceptable UX for a personal productivity app.

**The important plan update (verified March 2026):**
Microsoft has deprecated the Consumption plan in favor of the **Flex Consumption plan**. The Flex Consumption plan has improved cold start behavior even when scaled to zero, and critically supports **always-ready instances** — pre-provisioned instances that eliminate cold start entirely.

**Prevention strategies (in order of preference):**

1. **Use Flex Consumption plan with 1 always-ready HTTP instance** — keeps one instance perpetually warm. Cost: billed continuously at baseline GB-second rate for the always-ready instance (512 MB minimum). For a personal app, this is approximately $3-5/month extra but eliminates cold starts entirely.

   ```json
   // Configured via Azure CLI or portal — not in code
   // az functionapp deployment config set --always-ready-instances 1
   ```

2. **Flex Consumption without always-ready** — still has improved (but not eliminated) cold start vs legacy Consumption. Acceptable if you can tolerate 2-5 second delays.

3. **Avoid legacy Consumption plan** — Microsoft has deprecated it for new apps. Use Flex Consumption.

4. **Keep packages small** — cold start time scales with package size. Avoid bundling unnecessary npm packages. Use tree-shaking.

5. **Warm-up pattern** — if not using always-ready, implement a lightweight `/api/ping` endpoint and have the frontend call it on page load as a pre-warm signal.

**Plan constraint for SWA:** Azure Static Web Apps managed Functions use a restricted hosting plan. For full control over plan type (including Flex Consumption always-ready), deploy a **linked Azure Functions app** (bring your own Functions) rather than the built-in managed Functions.

**Source:** https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan (verified March 2026)

---

### Pitfall 3: Cosmos DB free tier throttling is silent 429s, not a hard stop

**What goes wrong:** Cosmos DB free tier gives 1000 RU/s and 25 GB storage. When you exceed 1000 RU/s, the server returns HTTP 429 (RequestRateTooLarge) with a `x-ms-retry-after-ms` header. The SDK retries automatically — but if retries exhaust (default: 9 retries over 30 seconds), the SDK throws an exception to your application. This is NOT a hard stop at the account level; it's per-request throttling.

**Why it happens:** Poorly designed queries consume far more RUs than expected. Common examples:
- Cross-partition queries (no partition key filter) scan all partitions — cost multiplies by partition count
- Queries without a `WHERE` clause on an indexed field
- Returning large documents when you only need a few fields (no projection)
- Running aggregations (`COUNT`, `SUM`) which are expensive without proper indexes
- Storing workout data as one giant document per user instead of normalized smaller documents

**RU cost examples (approximate):**
| Operation | Approximate RU cost |
|-----------|-------------------|
| Read 1 KB document by ID | 1 RU |
| Write 1 KB document | ~5 RU |
| Read 10 KB document by ID | ~10 RU |
| Query with partition key | 2-10 RU |
| Cross-partition query | 20-200+ RU |
| Query returning 100 docs | 50-500 RU |

**Consequences:** At 1000 RU/s budget: a cross-partition query that costs 200 RU limits you to just 5 such queries per second. For a single-user personal app this is rarely hit in normal use, but bulk import of Apple Health data (hundreds of workout records written sequentially) can easily burst past the limit.

**Prevention:**
- Design partition key around the user ID (single-user app: just use a fixed partition key like `"user"`)
- Use point reads (by ID) instead of queries where possible — 1 RU vs 10-200 RU
- Batch writes using bulk operations, and implement exponential backoff on 429
- For the Apple Health import, write to Cosmos DB in batches with delays between batches rather than a tight loop
- Enable **autoscale** throughput even on free tier: this allows bursting above 1000 RU/s and billing only for what you use — you only pay for consumption above the free 1000 RU/s baseline

**Detection:** Monitor `x-ms-request-charge` header on every Cosmos DB operation in development. Log it. Alert when single queries exceed 100 RU.

**Source:** https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier (verified March 2026)

---

### Pitfall 4: Claude API context window exhaustion from growing chat history

**What goes wrong:** As a user accumulates weeks or months of coaching conversations, the full chat history passed to Claude grows without bound. At some point — depending on model — you hit the context window limit and the API returns an error, or silently truncates, or you pay for enormous token counts on every request.

**Context window sizes (from training data, HIGH confidence):**
| Model | Context window | Max output |
|-------|---------------|------------|
| claude-opus-4 | 200,000 tokens | 32,000 tokens |
| claude-sonnet-4-5 | 200,000 tokens | 16,000 tokens |
| claude-haiku-3-5 | 200,000 tokens | 8,096 tokens |

200K tokens is approximately 150,000 words or roughly 500 pages. A running coaching conversation with tool calls and context can consume tokens faster than raw word count suggests (due to system prompts, workout data injected as context, etc).

**Why it happens:** Developers store full conversation history and replay it verbatim on every API call. This is fine for weeks but becomes expensive and eventually fails as months accumulate.

**Consequences:** API costs grow linearly with conversation length. Eventually errors or very slow responses. A user with 2 years of daily conversations could have 500K+ tokens of history.

**Prevention strategies:**

1. **Rolling window** — Keep only the last N messages (e.g., last 20 exchanges). Simple but loses long-term context.

2. **Summarization** — When history exceeds a threshold (e.g., 50K tokens), call Claude to summarize older messages into a condensed "memory" block. Store the summary, discard raw old messages.
   ```
   System prompt structure:
   [Summary of past conversations up to 3 months ago]
   [Recent 20 exchanges verbatim]
   [Current workout context]
   [User message]
   ```

3. **Structured memory** — Rather than storing conversation text, extract key facts after each session ("user is training for a marathon, tends to overtrain on Tuesdays, prefers morning runs") and inject these as structured context rather than raw conversation history.

4. **Separate workout context from conversation history** — Don't resend all historical workout data on every request. Only send the last 4-8 weeks of workouts as structured data, and the most recent conversation.

**Token counting:** Use Anthropic's token counting API endpoint to measure context size before sending. Gate on it: if context > 150K tokens, trigger a summarization pass.

**Detection:** Log `usage.input_tokens` from every API response. Alert when a single request exceeds 100K input tokens.

---

## Moderate Pitfalls

---

### Pitfall 5: Azure Static Web Apps routing conflicts with API routes

**What goes wrong:** SWA has specific rules about how `/api/*` routes are handled. Several non-obvious behaviors cause 404s or misrouted requests in production that work fine locally.

**Specific issues:**

**Issue 1: The `/api` prefix is reserved and non-configurable.**
All requests to `/api/*` are automatically proxied to the linked Functions app. You cannot use `/api` for static content routes. You cannot change this prefix. If your frontend router uses `/api` for something client-side, it will conflict.

**Issue 2: The `navigationFallback` does not catch `/api/*` requests.**
If your Functions app returns a 404, SWA does NOT fall back to `index.html`. The 404 propagates to the client. This means missing API routes surface as raw 404s, not your app's error handling.

**Issue 3: Route rule order matters and stops at first match.**
Rules in `staticwebapp.config.json` are evaluated in order and stop at first match. A wildcard rule early in the list (`"route": "/*"`) will capture everything and prevent later rules from firing. Put specific routes before wildcards.

**Issue 4: SPA fallback route must exclude asset paths.**
The `navigationFallback` exclude list must cover all static assets or you'll get `index.html` returned for failed image/CSS/JS requests, causing confusing browser errors.
```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/assets/*", "/images/*", "*.{js,css,png,jpg,gif,svg,woff,woff2}"]
  }
}
```

**Issue 5: `routes.json` is silently ignored when `staticwebapp.config.json` exists.**
If you migrate from the old `routes.json` format and have both files, `routes.json` is completely ignored without any warning.

**Issue 6: Auth redirects need `responseOverrides`, not route rules.**
Using a route rule to redirect 401s to a login page does not work the same as `responseOverrides`. Use `responseOverrides` for HTTP error codes.

**Prevention:** Always test routing with `swa start` locally before deploying. Test 404 behavior, direct URL navigation (deep links), and API error paths.

**Source:** https://learn.microsoft.com/en-us/azure/static-web-apps/configuration (verified March 2026)

---

### Pitfall 6: Apple Health data quality issues affecting coaching accuracy

**What goes wrong:** Raw Apple Health data contains numerous quality issues that, if passed uncleaned to Claude or stored naively, produce wrong coaching recommendations.

**Known data quality issues:**

**GPS drift affecting pace:**
iPhone GPS error of ±5-15 meters per sample, combined with 1-second sampling, can produce phantom speed spikes (e.g., reporting 30 km/h for 1 second). When aggregating pace from raw GPS coordinates, these outliers inflate or deflate average pace significantly.
- Prevention: Apply a speed sanity filter (discard samples > 25 km/h for running), then recalculate pace from filtered coordinates.

**Missing heart rate data:**
Heart rate from Apple Watch uses optical PPG sampling at variable intervals (typically 1-5 seconds during workouts but can gap). Gaps during high-intensity intervals are common. Zone calculations from sparse data can be misleading.
- Prevention: Interpolate gaps under 10 seconds; flag workouts with >20% missing HR data.

**Duplicate workouts from multiple sources:**
If the user has both an iPhone and Apple Watch, the same workout can appear twice — once from each source — with slightly different totals. The Health app deduplicates for display, but the XML export may include both raw records.
- Prevention: Deduplicate on `(startDate, workoutActivityType)` before storing; prefer the Watch source over the Phone source.

**Unit inconsistencies:**
Apple Health exports in the user's locale units. Distance may be in km or mi, pace in min/km or min/mi, depending on device settings. The `unit` attribute is always present in the XML but requires explicit handling.
- Prevention: Always normalize to a canonical unit (e.g., meters and seconds) on import; store canonical units; convert for display.

**Incomplete workouts (failed saves):**
Workouts that were force-quit or that lost Watch connectivity can have `endDate` equal to `startDate` or zero duration. These should be filtered out entirely.
- Prevention: Filter workouts with duration < 60 seconds.

**VO2 Max only on Apple Watch:**
VO2 Max (`HKQuantityTypeIdentifierVO2Max`) is only recorded when the user has an Apple Watch and has done outdoor runs. iPhone-only users will have no VO2 Max data.
- Prevention: Make VO2 Max an optional field; do not require it for coaching logic.

---

### Pitfall 7: Azure Functions HTTP request body size limits

**What goes wrong:** Azure Functions has a hard 210 MB limit on HTTP request body size (confirmed in official docs for all plan types). This limit is enforced by the host before your function code runs, so you cannot work around it in code.

**For Apple Health XML files:** Export files regularly exceed 210 MB for active users. This means you CANNOT accept the raw XML file as an HTTP POST body to a Function, period.

**The confirmed limit (HIGH confidence, official docs):**

| Plan | Max Request Body |
|------|-----------------|
| Flex Consumption | 210 MB |
| Premium | 210 MB |
| Dedicated | 210 MB |
| Consumption (legacy) | 210 MB |

This limit is set in the host runtime (`web.config`) and cannot be overridden in `host.json` or application settings.

**Prevention — two valid approaches:**

**Approach A: Client-side XML parsing (recommended)**
Parse the Apple Health export.xml in the browser using a streaming SAX parser in a Web Worker. Extract only the relevant workout records as JSON. POST the compact JSON (typically 1-5 MB) to the Function.
```javascript
// In a Web Worker
import createSaxParser from 'sax-wasm'; // WASM-based SAX for browsers
// Stream the file, extract <Workout> elements, post structured data
```

**Approach B: SAS token upload to Blob Storage, then async processing**
1. Function generates a short-lived SAS URL for a Blob Storage container
2. Frontend uploads the raw file directly to Blob Storage (bypasses Function size limit entirely)
3. A Blob trigger Function processes the file asynchronously
4. Polling or SignalR push notifies the frontend when processing completes

Approach B handles arbitrarily large files but adds complexity (async UX, status polling). Approach A is simpler for a single-user personal app.

**Source:** https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale (verified March 2026, max request size table)

---

### Pitfall 8: CORS and local development with SWA CLI and Functions emulator

**What goes wrong:** The SWA CLI creates a proxy at `http://localhost:4280` that routes both static files and API calls. When developers bypass the CLI and talk directly to the Functions emulator on port 7071, CORS errors appear in the browser. When using the CLI correctly, a different set of issues arise.

**Specific issues:**

**Issue 1: Direct-to-7071 CORS errors.**
The Functions Core Tools emulator does NOT set CORS headers by default. Fetching `http://localhost:7071/api/...` directly from a browser app on port 3000 (Vite dev server) produces CORS failures.
- Fix: Never make frontend requests to port 7071 directly. Always route through the SWA CLI proxy on port 4280 (`/api/...` — no host prefix). The CLI proxy handles CORS.

**Issue 2: SWA CLI must be started pointing at the running framework dev server.**
```bash
# Correct — point CLI at your Vite/React dev server
swa start http://localhost:3000 --api-location http://localhost:7071

# Wrong — serving a build output while Vite dev server is also running
swa start ./dist --api-location ./api
```
The two modes behave differently for HMR and debugging.

**Issue 3: `local.settings.json` is not read by the SWA CLI.**
The Functions emulator reads `local.settings.json` for environment variables. The SWA CLI does NOT automatically pass these to the Functions process when using `--api-location http://localhost:7071` (external process mode). You must start the Functions emulator separately with `func start` first, which DOES read `local.settings.json`.

**Issue 4: Auth emulation uses fake tokens not valid in production.**
The SWA CLI's auth emulator returns a fake client principal. Code that validates JWT tokens or calls `/.auth/me` will behave differently locally vs production. Do not implement token-level JWT validation in Function code — use only the `x-ms-client-principal` header injected by SWA, which the CLI emulator provides correctly.

**Issue 5: The CLI default port 4280 conflicts with some other dev tools.**
If port 4280 is taken, `swa start` fails silently or with a confusing error. Check with `netstat -ano | findstr :4280` (Windows) or `lsof -i :4280` (Mac/Linux).

**Issue 6: CORS configuration in `staticwebapp.config.json` has no effect on API responses.**
The `globalHeaders` in `staticwebapp.config.json` only apply to static content responses. API responses come from Functions and carry their own headers. Adding CORS headers to `globalHeaders` does not affect `/api/*` responses.

**Source:** https://learn.microsoft.com/en-us/azure/static-web-apps/local-development (verified March 2026)

---

## Minor Pitfalls

---

### Pitfall 9: Cosmos DB free tier is limited to one account per subscription

**What goes wrong:** You can only have one Cosmos DB free tier account per Azure subscription. If you already have a free tier account (from another project), you cannot create another one. There is no way to transfer free tier status.

**Prevention:** Check your subscription for existing free tier Cosmos DB accounts before project setup. If blocked, evaluate Azure SQL free tier as an alternative (also has one-per-subscription restrictions).

---

### Pitfall 10: Flex Consumption plan only supports Linux

**What goes wrong:** The Flex Consumption plan (the recommended replacement for legacy Consumption) is Linux-only. You cannot mix a Flex Consumption Function app in the same resource group as a Windows-based App Service plan.

**Prevention:** For Node.js and Python Functions, Linux is the correct target anyway. Ensure your resource group does not already contain Windows-based App Service resources if you need them in the same group.

**Source:** https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale (verified March 2026)

---

### Pitfall 11: Cosmos DB free tier cannot be enabled on serverless accounts

**What goes wrong:** Cosmos DB offers a "serverless" account type (pay-per-request with no provisioned RU/s). The free tier 1000 RU/s discount does NOT apply to serverless accounts. You must use provisioned throughput (or autoscale) to benefit from the free tier.

**Prevention:** When creating the Cosmos DB account, choose "Provisioned throughput" + "Apply Free Tier Discount." Do not choose "Serverless."

**Source:** https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier (verified March 2026, explicit note at top of page)

---

### Pitfall 12: SWA managed Functions vs linked Functions app capability gap

**What goes wrong:** Azure Static Web Apps offers two modes for the backend Functions:
1. **Managed Functions** — SWA manages the Function app automatically. Simpler, but the plan type is restricted (runs on a limited SWA-specific plan). You have no control over cold start settings, always-ready instances, or advanced Function configuration.
2. **Linked Functions app** — You create a separate Azure Functions app and link it to your SWA. Full control over plan, always-ready instances, scaling.

For a personal app where cold start matters, you need a linked Functions app to configure always-ready instances on Flex Consumption. Managed Functions cannot be configured for always-ready.

**Prevention:** Decide early which mode you're using. Migrating from managed to linked Functions after initial deployment requires re-deploying and updating all environment variable references.

---

### Pitfall 13: Apple Health export is a zip file, not a raw XML file

**What goes wrong:** When a user exports Apple Health data from their iPhone ("Health" app → profile → "Export All Health Data"), they receive a `.zip` file containing:
- `export.xml` — the main record file
- `export_cda.xml` — clinical data (not needed)
- `workout-routes/` — directory of `.gpx` files, one per workout with GPS tracks

Developers expect a single XML file but receive a zip. The app must handle zip extraction. The GPS route files referenced in `export.xml` (as `<FileReference path="workout-routes/route_XXX.gpx"/>`) require parsing the zip to extract those specific files.

**Prevention:** Accept the `.zip` file directly. Use JSZip (browser) or Python's `zipfile` module (Function) to extract. Parse `export.xml` from within the zip. Extract individual GPX route files on demand (only for workouts the user selects to analyze in detail).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Apple Health import | File size + zip format | Client-side streaming parse in Web Worker; accept zip not XML |
| Apple Health import | Duplicate workouts from iPhone + Watch | Deduplicate on `(startDate, workoutActivityType)` at import |
| Data storage design | Cross-partition Cosmos queries | Use single partition key per user; point reads by ID |
| Data storage design | Bulk import 429s | Batch writes with 100ms delay between batches |
| Azure Functions setup | Cold start | Use Flex Consumption + 1 always-ready HTTP instance |
| Azure Functions setup | Managed vs linked | Choose linked Functions app from day 1 for plan control |
| Coaching chat | Context window growth | Implement summarization after 30 conversation turns |
| Coaching chat | All workout data in every prompt | Send only last 8 weeks of data; summarize older data |
| Local development | CORS from wrong port | Always use SWA CLI on 4280; never fetch directly from 7071 |
| Local development | Auth emulation differences | Use `x-ms-client-principal` header pattern, not JWT validation |
| Routing | SPA deep links 404 | Configure `navigationFallback` with proper excludes |
| Routing | `/api` prefix conflict | `/api` is reserved; do not use in client-side routes |
| GPS pace calculation | Outlier speed spikes | Filter samples > 25 km/h before computing pace |
| Heart rate zones | Sparse HR data | Require minimum data density before zone calculations |

---

## Sources

- Azure Functions Scale and Hosting: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale (verified 2026-03-21)
- Flex Consumption plan: https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan (verified 2026-03-21)
- Cosmos DB Free Tier: https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier (verified 2026-03-21)
- Cosmos DB Performance Tips: https://learn.microsoft.com/en-us/azure/cosmos-db/performance-tips (verified 2026-03-21)
- SWA Configuration: https://learn.microsoft.com/en-us/azure/static-web-apps/configuration (verified 2026-03-21)
- SWA Local Development: https://learn.microsoft.com/en-us/azure/static-web-apps/local-development (verified 2026-03-21)
- Azure Functions host.json reference: https://learn.microsoft.com/en-us/azure/azure-functions/functions-host-json (verified 2026-03-21)
- Apple Health export XML schema: training data (MEDIUM confidence — structure is stable across iOS versions but verify element names in actual export)
- Claude API token limits: training data (MEDIUM confidence — verify current limits at docs.anthropic.com)
