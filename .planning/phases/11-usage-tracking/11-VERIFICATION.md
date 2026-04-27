---
phase: 11-usage-tracking
verified: 2026-04-27T10:10:00Z
status: passed
score: 11/11 must-haves verified
---

# Phase 11: Usage Tracking — Verification Report

**Phase Goal:** Track Claude API token usage per user; compute USD cost from model pricing; show total and monthly breakdown in admin panel; let each user view their own usage via the side menu top-row dropdown.
**Verified:** 2026-04-27T10:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every completed chat API call writes a usage_events document to MongoDB | VERIFIED | `chat.ts:292-307` — try/catch block with `insertOne` after `fm = await stream.finalMessage()` |
| 2 | A failed usage insert does NOT block the SSE response from closing | VERIFIED | Empty catch block at `chat.ts:305`; done SSE at `chat.ts:314` runs regardless |
| 3 | computeCost() returns 0 for unknown models and positive for claude-sonnet-4-20250514 | VERIFIED | `pricing.ts:17-24`; confirmed by 8 passing unit tests in `pricing.test.ts` |
| 4 | usage_events collection has compound index { userId: 1, timestamp: -1 } | VERIFIED | `db.ts:27-28` — two createIndex calls present |
| 5 | GET /api/usage/me returns allTime, thisMonth, and monthly[] for authenticated user | VERIFIED | `usage.ts:7-84` — full aggregation pipeline, try/catch, correct shape returned |
| 6 | GET /api/users/usage-summary returns userId-keyed map for admins only | VERIFIED | `admin.ts:113-172` — requireAdmin guard + aggregation; registered as route `users/usage-summary` |
| 7 | Both endpoints return zero-cost for users with no usage events | VERIFIED | `usage.ts:58-67` — empty rows → allTime {0,0} thisMonth {0,0} monthly []; unit tests confirm |
| 8 | Non-admin request to GET /api/users/usage-summary returns 401 | VERIFIED | `admin.ts:114-116` — requireAdmin(req) at handler entry; unit test for 401 passes |
| 9 | Authenticated user can navigate to /usage via 'My Usage' sidebar item | VERIFIED | `Sidebar.tsx:67-75` — button with aria-label "My Usage", navigate('/usage'), setDropdownOpen(false) |
| 10 | UsagePage stat cards show All-time cost and This month cost formatted as $X.XX | VERIFIED | `Usage.tsx:64-74` — two stat cards; formatCost() returns '$' + n.toFixed(2) |
| 11 | Admin panel user table shows Month and All-time columns with $0.00 for users with no usage | VERIFIED | `Admin.tsx:229-230, 246-247` — th and td cells; usageSummary[user._id]?.thisMonth ?? 0 fallback |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/src/shared/pricing.ts` | MODEL_PRICING map and computeCost() | VERIFIED | Exports both; exact rates match spec (3.00/15.00/3.75/0.30 per million) |
| `api/src/shared/types.ts` | UsageEvent interface with 8 fields | VERIFIED | Interface at line 118 with all required fields including _id?, userId, timestamp, model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens |
| `api/src/shared/db.ts` | usage_events indexes registered at startup | VERIFIED | Two createIndex calls at lines 27-28 |
| `api/src/functions/chat.ts` | usage insert after finalMessage() | VERIFIED | fm capture at line 216; non-fatal insertOne at lines 292-307; UsageEvent imported |
| `api/src/functions/usage.ts` | getUsageMeHandler + route registration | VERIFIED | Full handler; route 'usage/me' registered at line 79 |
| `api/src/functions/admin.ts` | getUsageSummaryHandler in existing file | VERIFIED | Handler at line 113; route 'users/usage-summary' at line 206 |
| `api/src/index.ts` | import './functions/usage.js' registered | VERIFIED | Line 22 |
| `web/src/pages/Usage.tsx` | UsagePage with stat cards and monthly table | VERIFIED | Full implementation; formatCost, formatMonth, loading/error/empty states |
| `web/src/components/layout/Sidebar.tsx` | 'My Usage' dropdown item using useNavigate | VERIFIED | useNavigate at line 2 (existing import); My Usage button at lines 65-75 |
| `web/src/App.tsx` | /usage route registered | VERIFIED | Route at line 135: `<Route path="/usage" element={<Usage />} />` |
| `web/src/pages/Admin.tsx` | Month and All-time columns; parallel fetch | VERIFIED | Promise.all at line 61; usageSummary state; formatCost helper; th/td cells |
| `e2e/usage.spec.ts` | 5 E2E tests | VERIFIED | 5 tests covering sidebar nav, stat cards, monthly table, admin columns, $0.00 |
| `e2e/global-setup.ts` | usage_events seeding for test@example.com | VERIFIED | deleteMany at line 47; insertOne for testUser at lines 111-119 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/src/functions/chat.ts` | usage_events collection | insertOne after stream.finalMessage() | VERIFIED | `db.collection<UsageEvent>('usage_events').insertOne(usageEvent)` inside try/catch at line 304 |
| `api/src/functions/chat.ts` | api/src/shared/pricing.ts | UsageEvent type imported (tokens stored raw) | VERIFIED | `UsageEvent` imported from types.ts at line 8; raw tokens stored, cost computed at query time |
| `api/src/functions/usage.ts` | usage_events collection | MongoDB aggregation grouped by year/month | VERIFIED | `$group: { _id: { year: { $year }, month: { $month } }, ... }` at lines 18-26 |
| `api/src/functions/admin.ts` | usage_events collection | aggregation grouping all users keyed by userId | VERIFIED | `$group: { _id: { userId, year, month } }` at lines 122-133 |
| `web/src/pages/Usage.tsx` | /api/usage/me | fetch with X-Authorization Bearer token in useEffect | VERIFIED | `fetch('/api/usage/me', { headers: { 'X-Authorization': \`Bearer ${token ?? ''}\` } })` at lines 27-29 |
| `web/src/pages/Admin.tsx` | /api/users/usage-summary | Promise.all parallel fetch alongside /api/users | VERIFIED | `Promise.all([fetch('/api/users', ...), fetch('/api/users/usage-summary', ...)])` at lines 61-64 |
| `web/src/components/layout/Sidebar.tsx` | /usage route | useNavigate() + setDropdownOpen(false) on click | VERIFIED | `onClick={() => { setDropdownOpen(false); navigate('/usage'); }}` at line 67 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `web/src/pages/Usage.tsx` | `data` (UsageMeResponse) | `fetch('/api/usage/me')` → `getUsageMeHandler()` → MongoDB aggregation on `usage_events` | Yes — aggregation pipeline queries real collection; global-setup seeds 1 event for test@example.com | FLOWING |
| `web/src/pages/Admin.tsx` | `usageSummary` (Record<string, {thisMonth, allTime}>) | `fetch('/api/users/usage-summary')` → `getUsageSummaryHandler()` → MongoDB aggregation on `usage_events` | Yes — DB aggregation groups all users; falls back to empty {} if fetch fails (shows $0.00) | FLOWING |
| `api/src/functions/chat.ts` | UsageEvent document | `fm.usage` from `stream.finalMessage()` | Yes — Anthropic SDK provides real token counts after every successful stream | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — endpoints require a running API server + MongoDB. The E2E test suite (usage.spec.ts, 5 tests) covers behavioral verification end-to-end with mocked API responses for determinism. Unit tests (23 tests across pricing.test.ts, usage.test.ts, adminUsageSummary.test.ts, usageCapture.test.ts) cover handler behavior.

---

## Requirements Coverage

Requirements USAGE-01 through USAGE-11 are defined in the phase CONTEXT.md decisions (D-01 through D-14) rather than a separate REQUIREMENTS.md file. Coverage by plan:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| USAGE-01 | 11-01 | usage_events MongoDB collection with token fields | SATISFIED | `types.ts:118-127` UsageEvent interface; `db.ts:27-28` indexes |
| USAGE-02 | 11-01 | Non-fatal usage capture — failure must not block SSE | SATISFIED | Empty catch at `chat.ts:305`; unit test "Test B" confirms |
| USAGE-03 | 11-01 | Pricing utility: MODEL_PRICING + computeCost() | SATISFIED | `pricing.ts` — 8 passing unit tests |
| USAGE-04 | 11-01 | fm = await stream.finalMessage() captures usage | SATISFIED | `chat.ts:216-218` — let fm declaration + try block capture |
| USAGE-05 | 11-02 | GET /api/usage/me endpoint | SATISFIED | `usage.ts` — full implementation + 6 unit tests |
| USAGE-06 | 11-02 | GET /api/users/usage-summary admin endpoint | SATISFIED | `admin.ts:113-211` — 6 unit tests pass |
| USAGE-07 | 11-02 | usage.ts imported in index.ts | SATISFIED | `index.ts:22` |
| USAGE-08 | 11-03 | /usage route + UsagePage component | SATISFIED | `App.tsx:135`; `Usage.tsx` full implementation |
| USAGE-09 | 11-03 | Sidebar My Usage dropdown item | SATISFIED | `Sidebar.tsx:65-75` |
| USAGE-10 | 11-03 | Admin panel Month/All-time columns | SATISFIED | `Admin.tsx:229-230, 246-247` |
| USAGE-11 | 11-03 | E2E tests + global-setup seeding | SATISFIED | `e2e/usage.spec.ts` 5 tests; `e2e/global-setup.ts:47,111-119` |

All 11 requirement IDs declared across the three plans are accounted for and satisfied.

---

## Anti-Patterns Found

No anti-patterns detected. Scanned:
- `api/src/shared/pricing.ts` — no stubs, no TODOs
- `api/src/functions/usage.ts` — no stubs; error path returns 500 (not a stub)
- `api/src/functions/admin.ts` — no stubs in getUsageSummaryHandler
- `web/src/pages/Usage.tsx` — no stubs; empty state row is intentional UX ("No usage recorded yet")
- `web/src/components/layout/Sidebar.tsx` — no stubs
- `web/src/pages/Admin.tsx` — `usageSummary[user._id]?.thisMonth ?? 0` fallback is intentional design (D-13), not a stub

---

## Test Results

- **API unit tests:** 332 passed, 0 failed (33 test files)
- **Usage-specific unit tests:** 23 passed across pricing.test.ts (8), usage.test.ts (6), adminUsageSummary.test.ts (6), usageCapture.test.ts (3)
- **Web build:** Clean — `npm run build` exits 0 (570ms, 1069 modules)
- **E2E tests:** 5 tests in usage.spec.ts (human verification pending for live run)

---

## Human Verification Required

The following items require a running app to verify visually:

### 1. My Usage sidebar navigation (live app)

**Test:** Log in as a regular user, open the sidebar dropdown (click the logo/email area), confirm "My Usage" appears above "Logout", click it.
**Expected:** Browser navigates to /usage; "My Usage" h1 is visible; two stat cards (All-time, This month) render; monthly table is present.
**Why human:** Requires live running app + MongoDB with seeded usage_events data.

### 2. Admin panel usage columns (live app)

**Test:** Log in as admin@example.com, navigate to /admin, view the user table on desktop viewport.
**Expected:** "Month" and "All-time" column headers visible; deactivate@example.com row shows "$0.00" for both columns.
**Why human:** Requires live running app + real usage_events data from global-setup seeding.

---

## Gaps Summary

No gaps found. All phase 11 must-haves are verified at all four levels (exists, substantive, wired, data flowing).

The implementation is complete and faithful to the plan specifications:
- Plan 01 artifacts (pricing.ts, UsageEvent, db.ts indexes, chat.ts capture) are all present and correct
- Plan 02 artifacts (usage.ts, admin.ts extension, index.ts import) are all present and wired
- Plan 03 artifacts (Usage.tsx, Sidebar.tsx, App.tsx route, Admin.tsx columns, E2E tests, global-setup seeding) are all present and correct
- 332 API unit tests pass; web build is clean

---

_Verified: 2026-04-27T10:10:00Z_
_Verifier: Claude (gsd-verifier)_
