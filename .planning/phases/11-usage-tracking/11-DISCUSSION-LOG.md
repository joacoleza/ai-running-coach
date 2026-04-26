# Phase 11: Usage Tracking — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 11-usage-tracking
**Areas discussed:** Storage approach, Cost display, User-facing view, Admin view integration

---

## Storage approach

| Option | Description | Selected |
|--------|-------------|----------|
| Per-call event log | One MongoDB doc per chat request with token counts + model | ✓ |
| Monthly aggregates only | Upsert monthly counters, no per-call detail | |
| Hybrid | Per-call events + running monthly aggregate | |

**User's choice:** Per-call event log (recommended)
**Notes:** Model name stored on every event for future-proof cost calculation. User confirmed this explicitly.

---

## Cost display

| Option | Description | Selected |
|--------|-------------|----------|
| USD only | Compute at query time from hardcoded pricing constants | ✓ |
| Tokens + USD | Show both raw counts and dollar amounts | |
| Tokens only | No USD conversion | |

**User's choice:** USD only

**Pricing location follow-up:**

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded constants | `pricing.ts` keyed by model, compute at query time | ✓ |
| Admin-editable in MongoDB | Update rates without redeploy | |

**Notes:** User initially asked whether Anthropic has a pricing API for auto-fetching rates. Confirmed they do not — no public `/pricing` endpoint exists. User accepted hardcoded constants as the practical approach.

---

## User-facing view

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate to /usage page | Full page with stat cards + monthly table | ✓ |
| Inline modal in dropdown | Expand sidebar dropdown to show stats inline | |

**User's choice:** /usage page (selected the mockup preview)

**Monthly row detail follow-up:**

| Option | Description | Selected |
|--------|-------------|----------|
| Cost only | Month + Cost columns | |
| Cost + message count | Month + Cost + Messages columns | ✓ |

**Notes:** User wants message count alongside cost to give context for why cost varies month to month.

---

## Admin view integration

| Option | Description | Selected |
|--------|-------------|----------|
| Inline columns on user list | Month + All-time columns on existing /admin | ✓ |
| Separate /admin/usage page | Dedicated admin usage page | |

**User's choice:** Inline columns (selected the mockup preview)

**Drill-down follow-up:**

| Option | Description | Selected |
|--------|-------------|----------|
| No drill-down | Inline totals are enough | ✓ |
| Click to see monthly history | Expand or navigate to full breakdown per user | |

**Notes:** Admin only needs at-a-glance totals. No drill-down required.

---

## Claude's Discretion

- MongoDB index design for `usage_events`
- TTL policy on event records
- Exact visual design of stat cards (inherit from Dashboard)
- E2E test seeding for usage events

## Deferred Ideas

- Per-user cost limits — already out of scope per PROJECT.md
- Anthropic pricing API auto-fetch — not feasible (no such API exists)
- Admin drill-down into monthly breakdown per user
