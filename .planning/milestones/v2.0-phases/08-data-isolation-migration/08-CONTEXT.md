# Phase 8: Data Isolation & Migration — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 delivers per-user data isolation and v1.1 data migration:

1. **userId on all collections** — `userId` field added to `plans`, `runs`, and `messages` documents; all queries scoped to the authenticated user's ID via `getAuthContext(req).userId`
2. **Startup migration** — On API cold start, check for orphaned documents (no `userId`). If any exist, find the existing admin user and backfill all orphaned plans/runs/messages to that user. Fast no-op on subsequent starts.
3. **requireAdmin middleware** — Implement `requireAdmin` in `api/src/middleware/auth.ts`. Returns 403 if `isAdmin` is false. No admin routes yet — Phase 9 consumes it.
4. **DATA-03 model** — `isAdmin: true` already on the seed admin user (manually inserted per README). Migration ensures the flag is preserved.

This phase does NOT include:
- Admin panel UI or admin API routes (Phase 9)
- Any new user creation flow (admin provisions manually, as documented in README)
- Apple Health integration
- Login rate limiting (Phase 10)

</domain>

<decisions>
## Implementation Decisions

### Migration Delivery

- **D-01:** Migration runs as an **API startup check** in all environments. On every cold start, `db.ts` (or a `runMigration()` call in `index.ts`) checks if any plans/runs/messages documents lack a `userId` field. If orphaned documents exist, find the admin user (`isAdmin: true`) and backfill all orphaned documents with that user's ObjectId. After the first successful run, subsequent cold starts complete the check in <5ms (single indexed query — no documents match the condition).
- **D-02:** Migration is idempotent — running it multiple times has no effect once all documents have `userId`.

### Seed Admin Setup

- **D-03:** No automated admin user creation in Phase 8. The admin user is manually inserted via MongoDB Compass/mongosh (already done; process documented in README `Seed your first user` section). The startup migration finds the existing admin user by querying `{ isAdmin: true }` and uses their `_id` as the `userId` for backfilling orphaned documents.
- **D-04:** If no admin user exists when migration runs (e.g. fresh dev environment), log a warning and skip backfill — no crash. Documents without `userId` will be invisible until an admin user is created and migration runs again.

### Data Isolation — userId Field

- **D-05:** `userId` is stored as an **ObjectId** on all three collections (`plans`, `runs`, `messages`). The JWT `sub` field is a string (ObjectId serialized); handlers call `new ObjectId(authCtx.userId)` when constructing queries. Consistent with `RefreshToken.userId` (already ObjectId in types.ts).
- **D-06:** All GET/PATCH/DELETE handlers use `getAuthContext(req).userId` to scope queries. Cross-user access returns 404 (not 403) — no information leak about other users' resources.
- **D-07:** `POST /api/runs` and `POST /api/plan` (and related sub-routes) set `userId` from auth context at creation time.

### Message Isolation Strategy

- **D-08:** Add `userId` **directly** to `ChatMessage` documents. No plan-ownership join needed. `GET /api/messages` filters by both `planId` AND `userId`. Migration backfills message `userId` from the linked plan's `userId` (join on `planId` during migration only).
- **D-09:** `chat.ts` sets `userId` on every new `ChatMessage` inserted.

### requireAdmin Middleware

- **D-10:** Implement `requireAdmin(req)` in `api/src/middleware/auth.ts` — calls `requireAuth` first, then checks `getAuthContext(req).isAdmin`. Returns `{ status: 403, jsonBody: { error: 'Admin access required' } }` if not admin. Returns `null` if authorized.
- **D-11:** Phase 8 satisfies success criterion #4 (admin-only route access) via **unit/integration tests of `requireAdmin` directly** — test that it returns `null` for `isAdmin: true` and `403` for `isAdmin: false`. No test endpoint added to the codebase.

### Claude's Discretion

- MongoDB index strategy for `userId` on each collection (compound vs. single field)
- Whether to run the startup migration before or after registering Azure Function routes in `index.ts`
- Error message wording for 403 responses
- Whether `planArchive.ts` and `planPhases.ts` also scope by `userId` (they should — apply consistently)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Layer — Collections to Update
- `api/src/shared/types.ts` — `Plan`, `Run`, `ChatMessage` interfaces need `userId: ObjectId` field; `Run.userId` already exists as `string` (change to `ObjectId`)
- `api/src/shared/db.ts` — MongoDB connection pattern; add `userId` indexes here

### Functions to Update (scope all queries by userId)
- `api/src/functions/plan.ts` — GET active plan, POST generate, PATCH plan, POST archive
- `api/src/functions/planDays.ts` — GET/PATCH/DELETE/POST plan days
- `api/src/functions/planPhases.ts` — POST/PATCH/DELETE plan phases
- `api/src/functions/planArchive.ts` — GET archived plans, GET single archive
- `api/src/functions/runs.ts` — GET/POST/PATCH/DELETE runs, link/unlink
- `api/src/functions/messages.ts` — GET messages by planId
- `api/src/functions/chat.ts` — POST chat (inserts messages, reads plan)

### Middleware
- `api/src/middleware/auth.ts` — add `requireAdmin` here (alongside `requireAuth`, `getAuthContext`)

### Migration
- No existing migration infrastructure — new file: `api/src/shared/migration.ts` (or similar)

### README
- `README.md` §"Seed your first user" — manual admin insert process; do not change this section

### Architecture References
- `CLAUDE.md` §Architecture Decisions — MongoDB pattern, Azure Functions v4 structure, WeakMap auth context
- `.planning/phases/06-backend-auth-foundation/06-CONTEXT.md` — D-10: JWT payload `{ sub: userId (string) }`, D-12: `requireAuth` + `getAuthContext` pattern
- `REQUIREMENTS.md` — DATA-01, DATA-02, DATA-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireAuth` + `getAuthContext(req)` in `api/src/middleware/auth.ts` — already returns `{ userId, email, isAdmin }`; `requireAdmin` will follow the same middleware signature
- `getDb()` singleton pattern in `api/src/shared/db.ts` — startup migration calls this same function
- Every protected handler already calls `const denied = await requireAuth(req); if (denied) return denied;` — add `getAuthContext(req)` call immediately after to get `userId`

### Current Query Pattern (no userId scoping yet)
```ts
// Current — no isolation
const plan = await db.collection<Plan>('plans').findOne({ status: { $in: ['active', 'onboarding'] } });

// After Phase 8 — scoped
const { userId } = getAuthContext(req);
const plan = await db.collection<Plan>('plans').findOne({
  status: { $in: ['active', 'onboarding'] },
  userId: new ObjectId(userId)
});
```

### Integration Points
- `api/src/index.ts` — call `runStartupMigration()` before registering routes (or as first async operation)
- All 7 protected function files need `getAuthContext` import added and `userId` filter on every query
- `types.ts` — `Run.userId` already typed as `string`; change to `ObjectId` for consistency

### What Doesn't Change
- Frontend code — data isolation is entirely server-side
- Auth flow (AuthContext, 401 interceptor, LoginPage) — Phase 7 shipped, untouched
- Plan/Run data shape visible to the frontend — `userId` is a backend-only filter field, not returned in API responses

</code_context>

<specifics>
## Specific Requirements

- **Startup migration logic:**
  1. Count documents in `plans` / `runs` / `messages` without `userId` field
  2. If count > 0: find `{ isAdmin: true }` user; if found, `$set: { userId: adminUser._id }` on all matching documents via `updateMany`; log how many documents were migrated
  3. If no admin user found: log warning, skip (no crash)
  4. Total migration completes in a single async sequence before first request is served
- **userId type consistency:** `ObjectId` on all collections. `new ObjectId(getAuthContext(req).userId)` in every query.
- **Cross-user 404 rule:** If a user requests a resource that exists but belongs to another user, return 404 (not 403). Never expose that a resource exists.
- **`requireAdmin` signature:** Same as `requireAuth` — `async function requireAdmin(req: HttpRequest): Promise<HttpResponseInit | null>`. Calls `requireAuth` internally or assumes it has already been called. Prefer: call `requireAuth` first in the handler, then call `requireAdmin` separately (two-step guard in handler).
- **Message backfill in migration:** `messages` don't have `userId` yet. During migration, for each message without `userId`, look up the linked plan by `planId` to get its `userId`, then set it. (Or: since all orphaned plans are being assigned to the admin user anyway, simply set all orphaned messages to admin `userId` directly — no per-message plan lookup needed.)

</specifics>

<deferred>
## Deferred Ideas

- **Per-user settings** (preferred units, display name) — future profile phase
- **Admin audit log** — track who changed what, when — future admin phase
- **Cascade delete** — deleting a user also deletes their plans/runs/messages — Phase 9 (USER-04) or beyond
- **httpOnly cookie for JWT** — noted in Phase 6 context as a future security improvement

</deferred>

---

*Phase: 08-data-isolation-migration*
*Context gathered: 2026-04-18*
