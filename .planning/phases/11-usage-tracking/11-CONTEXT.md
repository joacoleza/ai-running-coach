# Phase 11: Usage Tracking — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 delivers three capabilities:

1. **Capture usage on every chat call** — After each `anthropic.messages.stream()` completes, save a usage event to MongoDB with token counts and model name.
2. **User-facing `/usage` page** — Accessible via new "My Usage" item in the sidebar dropdown. Shows all-time cost, this-month cost, and a monthly breakdown (Month, Cost, Messages).
3. **Admin panel usage columns** — Add "Month" and "All-time" cost columns inline to the existing user list on `/admin`. No new page, no drill-down.

This phase does NOT include:
- Per-user cost limits or quotas
- Budget alerts or notifications
- Admin drill-down into a user's monthly breakdown
- Pricing sourced from an API (Anthropic has no pricing API)

</domain>

<decisions>
## Implementation Decisions

### Storage

- **D-01:** New MongoDB collection `usage_events`. One document per chat API call:
  ```
  {
    userId: ObjectId,
    timestamp: Date,
    model: string,           // e.g. "claude-sonnet-4-20250514"
    inputTokens: number,
    outputTokens: number,
    cacheWriteTokens: number, // cache_creation_input_tokens (0 if absent)
    cacheReadTokens: number,  // cache_read_input_tokens (0 if absent)
  }
  ```
- **D-02:** Token counts come from `stream.finalMessage().usage` (already awaited in `chat.ts`). Insert happens after `finalMessage()` resolves, before the done SSE event. Failure to insert must NOT block the response — wrap in a non-fatal try/catch.
- **D-03:** Store model name on every event so cost calculation stays correct if the model changes in future.

### Cost Calculation

- **D-04:** No USD stored in events. Cost is computed at query time from token counts × pricing constants.
- **D-05:** New file `api/src/shared/pricing.ts` — a map from model name to per-token rates (USD per token, not per million):
  ```typescript
  // Current rates as of 2026-04 — update when Anthropic changes pricing
  export const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
    'claude-sonnet-4-20250514': {
      input: 3.00 / 1_000_000,
      output: 15.00 / 1_000_000,
      cacheWrite: 3.75 / 1_000_000,
      cacheRead: 0.30 / 1_000_000,
    },
  };
  export function computeCost(model: string, inputTokens: number, outputTokens: number, cacheWriteTokens: number, cacheReadTokens: number): number {
    const rates = MODEL_PRICING[model];
    if (!rates) return 0;
    return inputTokens * rates.input + outputTokens * rates.output + cacheWriteTokens * rates.cacheWrite + cacheReadTokens * rates.cacheRead;
  }
  ```
- **D-06:** Display is USD only — no raw token counts shown in the UI.

### User-Facing View

- **D-07:** New React route `/usage` → `UsagePage` component in `web/src/pages/Usage.tsx`.
- **D-08:** Sidebar dropdown (`web/src/components/layout/Sidebar.tsx`) gets a new item above Logout:
  - Label: "My Usage" (desktop) with an icon
  - Navigates to `/usage` (using `useNavigate` + `setDropdownOpen(false)`)
- **D-09:** `UsagePage` layout:
  - Two stat cards at top: **All-time** (cost) and **This month** (cost)
  - Monthly breakdown table: columns Month | Cost | Messages
  - Rows sorted newest-first; empty state if no usage yet
- **D-10:** New API endpoint `GET /api/usage/me` — authenticated, returns:
  ```json
  {
    "allTime": { "cost": 2.47, "messages": 312 },
    "thisMonth": { "cost": 0.18, "messages": 23 },
    "monthly": [
      { "year": 2026, "month": 4, "cost": 0.18, "messages": 23 },
      { "year": 2026, "month": 3, "cost": 0.94, "messages": 118 }
    ]
  }
  ```
  Implemented via MongoDB aggregation on `usage_events` grouped by `{ year, month }` of `timestamp`.

### Admin View

- **D-11:** Existing `/admin` page (`web/src/pages/Admin.tsx`) gets two new columns in the user table: **Month** and **All-time** (both USD).
- **D-12:** New admin API endpoint `GET /api/users/usage-summary` — admin-only (`requireAdmin`). Returns a map of userId → `{ thisMonth: number, allTime: number }`. Admin.tsx fetches this in parallel with `/api/users` and merges by `_id`.
- **D-13:** If a user has no usage events, both columns show `$0.00`.
- **D-14:** No drill-down from admin panel — totals only, no monthly breakdown per user in admin.

### Claude's Discretion

- MongoDB index design for `usage_events` (e.g., `{ userId: 1, timestamp: -1 }` for per-user queries)
- Whether to add a TTL index on `usage_events` (e.g., keep 2 years of history) or keep forever
- Exact visual design of the stat cards on `UsagePage` (reuse Dashboard card style for consistency)
- Whether to add `usage_events` seeding to `e2e/global-setup.ts` for E2E test coverage

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Code — Integration Points
- `api/src/functions/chat.ts` — Where `anthropic.messages.stream()` is called and `stream.finalMessage()` is awaited; usage insert goes here
- `web/src/components/layout/Sidebar.tsx` — The sidebar dropdown with current Logout item; add "My Usage" here
- `web/src/pages/Admin.tsx` — Admin user list; add Month/All-time columns and parallel fetch here
- `api/src/functions/admin.ts` — Admin route handlers; add `GET /api/users/usage-summary` here

### Shared Utilities
- `api/src/shared/pricing.ts` — **New file** to create; model → rates map + computeCost helper
- `api/src/shared/types.ts` — Add `UsageEvent` interface here
- `api/src/shared/db.ts` — MongoDB connection; `usage_events` collection accessed via `db.collection('usage_events')`
- `api/src/middleware/auth.ts` — `requireAuth` / `requireAdmin` / `getAuthContext` — same patterns as all other handlers

### Architecture Decisions (CLAUDE.md)
- Auth middleware pattern: every handler calls `requireAuth(req)` then `getAuthContext(req)` — follow exactly
- Admin routes use `/api/users` prefix (not `/api/admin/users`) — Azure Functions reserves `/admin`
- Route `GET /api/users/usage-summary` fits the existing pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dashboard stat cards (`web/src/pages/Dashboard.tsx`) — reuse the same card style for all-time/this-month on `UsagePage`
- `useAuth()` hook — provides `token` for Bearer header on all fetch calls
- Admin panel fetch pattern in `Admin.tsx` — parallel fetch with error handling; extend same pattern for usage-summary

### Established Patterns
- Stream handler in `chat.ts`: all post-stream DB writes go in the `stream.on('message', ...)` block after `finalMessage()` resolves — insert usage event here with try/catch
- MongoDB handler structure: exported factory function `getFooHandler()` returns async handler; registered in `index.ts`
- Route registration: `app.http('usageMe', { methods: ['GET'], authLevel: 'anonymous', route: 'usage/me', handler: getUsageMeHandler() })` in `api/src/index.ts`

### Integration Points
- `chat.ts:216` — `await stream.finalMessage()` — insert usage event immediately after this line (in the existing try/catch block)
- `Sidebar.tsx:62` — dropdown open block — add "My Usage" button before the Logout button
- `Admin.tsx:52` — `fetchUsers` function — fetch usage-summary in parallel and merge
- `App.tsx` — routes list — add `<Route path="/usage" element={<UsagePage />} />` inside the authenticated app routes

</code_context>

<specifics>
## Specific Ideas

- User chose `/usage` page (full page, not inline dropdown) with the layout:
  ```
  ┌────────────────────────────────────┐
  │  My Usage                          │
  │                                    │
  │  All-time         $2.47            │
  │  This month       $0.18            │
  │                                    │
  │  Month            Cost   Messages  │
  │  ──────────────────────────────    │
  │  Apr 2026         $0.18       23   │
  │  Mar 2026         $0.94      118   │
  └────────────────────────────────────┘
  ```
- Admin panel user list adds two columns:
  ```
  Email               Month    All-time  Actions
  alice@example.com   $0.18    $2.47     [Reset] [Deactivate]
  ```

</specifics>

<deferred>
## Deferred Ideas

- Per-user cost limits / budget caps — explicitly out of scope per PROJECT.md
- Auto-fetching Anthropic pricing from an API — Anthropic has no public pricing API; hardcoded constants are the practical approach
- Admin drill-down into monthly breakdown per user — user said inline totals are enough for now

</deferred>

---

*Phase: 11-usage-tracking*
*Context gathered: 2026-04-26*
