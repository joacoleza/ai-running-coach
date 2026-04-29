# Phase 13: Discipline Foundation - Research

**Researched:** 2026-04-29
**Domain:** MongoDB data model extension, startup migration pattern, Azure Functions API, TypeScript type widening, system prompt engineering
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | Every session has a `discipline` field ('run' \| 'gym' \| 'cycle'); existing run sessions migrated to `discipline: 'run'` | `Run` interface in `types.ts` gets the field; `runStartupMigration` pattern used; `POST /api/runs` and `GET /api/runs` already accept optional fields via the body type |
| DISC-02 | Every training plan day has a `discipline` field ('run' \| 'gym' \| 'cycle'); existing plan days migrated to `discipline: 'run'` | `PlanDay` interface gets the field; same startup migration updated; `PATCH /api/plan/days/:week/:day`, `POST /api/plan/days`, `<plan:add>` / `<plan:update>` all accept day-level fields; system prompt updated |
</phase_requirements>

---

## Summary

Phase 13 is a purely backend + data layer change: no UI ships in this phase. The goal is to introduce a `discipline` string union (`'run' | 'gym' | 'cycle'`) as an optional-then-always-present field on two MongoDB documents — `runs` and plan day subdocuments — and update the AI system prompt to understand multi-discipline coaching.

The project already has a startup migration pattern (`runStartupMigration` in `api/src/shared/migration.ts`) that runs idempotently on every cold start and back-fills `userId` into orphaned documents. Phase 13 adds a second migration pass inside the same function: two `updateMany` calls that set `discipline: 'run'` on all `runs` documents and all `plans.phases[].weeks[].days[]` subdocuments where `discipline` is absent. The migration must be idempotent (uses `{ discipline: { $exists: false } }` as the filter) and non-blocking (`.catch()` wrapping the whole call in `index.ts`).

The API surface changes are minimal: `POST /api/runs` and `PATCH /api/runs/:id` accept `discipline` in the request body; `GET /api/runs` returns it (MongoDB returns all stored fields automatically); `POST /api/plan/days` and `PATCH /api/plan/days/:week/:day` accept `discipline` in their body; the `<plan:add>` XML tag in the system prompt gets a `discipline` attribute. The system prompt (`buildSystemPrompt`) needs an updated identity statement and discipline-aware coaching instructions.

**Primary recommendation:** Extend existing interfaces and migration — do not create new infrastructure. Follow the exact patterns already established for `userId` backfill and optional-field API acceptance.

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| mongodb | 7.1.0 | `updateMany` with `$exists: false` filter for idempotent migration | Already the project DB driver |
| vitest | 3.x (4.1.5 latest) | Unit + integration tests | Project test framework |
| mongodb-memory-server | 11.0.1 | In-memory MongoDB for handler tests | Already used across all test files |
| TypeScript | 5.9.3 | Interface widening for `Run.discipline` and `PlanDay.discipline` | Project language |

**Installation:** No new packages required. All dependencies already present.

**Version verification:** `npm view mongodb version` → 7.2.0 (latest). Project uses 7.1.0 — no upgrade needed for this phase.

---

## Architecture Patterns

### Recommended Project Structure

No new files or directories introduced. Changes are confined to:

```
api/src/
├── shared/
│   ├── types.ts           # Add discipline field to Run and PlanDay interfaces
│   ├── migration.ts       # Add discipline backfill inside runStartupMigration
│   └── prompts.ts         # Update identity + add discipline coaching instructions
├── functions/
│   ├── runs.ts            # Accept discipline in POST body + PATCH body
│   └── planDays.ts        # Accept discipline in addDay POST + patchDay PATCH
└── __tests__/
    ├── runs.test.ts        # New discipline test cases
    ├── planDays.test.ts    # New discipline test cases
    └── (migration tests in api/src/shared/migration.test.ts)
```

### Pattern 1: TypeScript Interface Extension (optional field)

`discipline` is optional in the TypeScript interface because existing MongoDB documents do not have it until migration runs. Post-migration all new documents will always have it.

```typescript
// In api/src/shared/types.ts

export type Discipline = 'run' | 'gym' | 'cycle';

export interface Run {
  // ... existing fields ...
  discipline?: Discipline;   // optional — absent on pre-v3.0 documents until migration
}

export interface PlanDay {
  // ... existing fields ...
  discipline?: Discipline;   // optional — absent on pre-v3.0 documents until migration
}
```

**Why optional not required:** TypeScript `noUncheckedIndexedAccess` is not relevant here, but making the field required would cause TypeScript errors at every test fixture and every place that constructs a `Run` or `PlanDay` object without specifying discipline. Optional with a fallback default is the established pattern (matches how `avgHR`, `notes`, `insight`, `planId` are handled).

### Pattern 2: Idempotent Startup Migration (existing pattern — extend it)

The existing `runStartupMigration` function already:
1. Checks for orphaned documents before doing any work
2. Uses filters that are naturally idempotent
3. Logs progress with `[migration]` prefix
4. Is called non-blocking in `index.ts` via `.catch()`

For DISC-01 + DISC-02 the same function gets extended with a discipline backfill block:

```typescript
// In api/src/shared/migration.ts — add after the userId backfill section

// Discipline backfill: set discipline: 'run' on all existing runs and plan days
// that were created before Phase 13 (i.e. discipline field is absent).
// Filter { discipline: { $exists: false } } makes this idempotent.
const [runsWithoutDiscipline, plansWithoutDiscipline] = await Promise.all([
  db.collection('runs').countDocuments({ discipline: { $exists: false } }),
  db.collection('plans').countDocuments({ 'phases.weeks.days.discipline': { $exists: false } }),
]);

if (runsWithoutDiscipline > 0) {
  const disciplineRunsResult = await db.collection('runs').updateMany(
    { discipline: { $exists: false } },
    { $set: { discipline: 'run' } }
  );
  console.log(`[migration] Discipline backfill: set discipline='run' on ${disciplineRunsResult.modifiedCount} runs`);
}

if (plansWithoutDiscipline > 0) {
  // Use arrayFilters to target only plan day subdocuments missing the field
  const disciplinePlansResult = await db.collection('plans').updateMany(
    { 'phases.weeks.days': { $elemMatch: { discipline: { $exists: false } } } },
    { $set: { 'phases.$[].weeks.$[].days.$[day].discipline': 'run' } },
    { arrayFilters: [{ 'day.discipline': { $exists: false } }] }
  );
  console.log(`[migration] Discipline backfill: updated ${disciplinePlansResult.modifiedCount} plans with discipline='run' on plan days`);
}
```

**Key insight on subdocument migration:** MongoDB `updateMany` with nested array `arrayFilters` is the correct approach for updating subdocuments inside `phases[].weeks[].days[]`. The filter `{ 'phases.weeks.days': { $elemMatch: { discipline: { $exists: false } } } }` selects plans that have at least one day without `discipline`, and `arrayFilters` targets only those specific day subdocuments. This is idempotent because `{ 'day.discipline': { $exists: false } }` only matches days that still lack the field.

### Pattern 3: API Field Acceptance (passthrough optional)

The existing pattern for optional fields in `POST /api/runs` body type:

```typescript
// In runs.ts createRun handler — add discipline to body type + conditional set
let body: {
  date?: string;
  distance?: number;
  duration?: string;
  avgHR?: number;
  notes?: string;
  weekNumber?: number;
  dayLabel?: string;
  discipline?: string;  // NEW
};

// ...
if (body.discipline !== undefined) newRun.discipline = body.discipline as Discipline;
```

Same pattern for `PATCH /api/runs/:id` and `POST /api/plan/days` and `PATCH /api/plan/days/:week/:day`.

**Default on create:** When `POST /api/runs` is called without a `discipline` field (e.g. from older clients or the current run form), the created run will not have `discipline` set until migration runs. This is fine for Phase 13 because Phase 14 will add the UI discipline selector. After Phase 14, `discipline` will always be provided in POST bodies. For now, no default injection at the API layer is needed — the migration handles existing data.

### Pattern 4: System Prompt Update

The system prompt in `api/src/shared/prompts.ts` needs three changes:

1. **Identity:** Change "AI running coach" to "AI training coach" in the `You are an AI running coach` sentence (but NOT in the URL slug, package names etc. — those are Phase 17).
2. **Plan day discipline attribute:** Add `discipline` to the `<plan:add>` and `<plan:update>` tag documentation.
3. **Multi-discipline awareness section:** Add a brief section explaining discipline values and when each is used.

Example additions:

```typescript
// In the training plan format section, update <plan:add> examples:
`<plan:add week="3" day="D" type="run" discipline="run" objective_kind="distance" objective_value="5" objective_unit="km" guidelines="Easy pace run" />`
`<plan:add week="3" day="D" type="gym" discipline="gym" guidelines="Upper body strength session" />`
`<plan:add week="3" day="D" type="cycle" discipline="cycle" objective_kind="distance" objective_value="30" objective_unit="km" guidelines="Easy bike ride" />`
```

New section in the system prompt:

```
## Disciplines

Training days and sessions belong to one of three disciplines:
- **run** — running sessions (default for all existing training)
- **gym** — strength/gym sessions (no distance target, duration-based)
- **cycle** — cycling sessions (distance-based, speed metric)

When generating or updating plan days, always include `discipline="run|gym|cycle"` in `<plan:add>` and `<plan:update>` tags. Use the discipline that matches the session type — do not default all days to "run".

For gym days: use `type="cross-train"` with `discipline="gym"`. No distance objective needed.
For cycling days: use `type="cross-train"` with `discipline="cycle"` and a distance objective.
```

**Note on `type` vs `discipline`:** The `PlanDay.type` field currently accepts `'run' | 'rest' | 'cross-train'`. Gym and cycle days are modeled as `type: 'cross-train'` with a `discipline` discriminator. This avoids widening the `type` enum (which would require changes to `addDay` validation, `planUtils`, `assignPlanStructure` etc.) while still giving Phase 14/15 enough information to render correctly. The `type` field drives existing UI logic (rest day filtering, etc.); `discipline` drives the new multi-discipline features.

### Anti-Patterns to Avoid

- **Hardcoding 'run' as a default at the API layer:** Do not inject `discipline: 'run'` when the field is absent from the POST body. That couples the API to the assumption that all new sessions are runs — Phase 14 will send the correct value from the UI. Let migration handle historical data.
- **Widening `PlanDay.type` to include 'gym' | 'cycle':** The `type` field drives existing rest-day filtering (`d.type !== 'rest'`), label assignment, and validation. Adding new values would require touching `planUtils.ts`, `planDays.ts` addDay validation, and every test fixture. Use `discipline` instead as the discriminator.
- **Making `discipline` required in the TypeScript interface now:** Fixtures across 30+ test files construct `Run` and `PlanDay` objects without `discipline`. Making it required would break all of them. Keep optional.
- **Migrating plans in a separate one-off script:** The project established the pattern of startup migration for exactly this use case. Follow it.
- **Running `updateMany` on every cold start for the discipline check:** Do count check first (same as existing `totalOrphans` check) so the migration is a fast no-op after the first run in production.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subdocument array migration | Custom cursor-based script iterating each plan | `updateMany` with `arrayFilters` | MongoDB handles all matching atomically in one round trip |
| Idempotency guard | Custom `migrationVersion` collection tracking | `{ discipline: { $exists: false } }` filter | Simpler, self-describing, and matches existing pattern |
| Discipline type validation | Custom validator in each handler | TypeScript union type + cast | Validation at the type level; runtime cast is sufficient for Phase 13 |

**Key insight:** MongoDB `updateMany` with nested `arrayFilters` is purpose-built for this subdocument scenario and handles thousands of documents atomically without cursor management.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `runs` collection: all existing documents have no `discipline` field | Data migration in `runStartupMigration` — `updateMany` sets `discipline: 'run'` |
| Stored data | `plans` collection: all `phases[].weeks[].days[]` subdocuments have no `discipline` field on non-rest days | Data migration in `runStartupMigration` — `updateMany` with `arrayFilters` sets `discipline: 'run'` |
| Live service config | None — no external services store discipline | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars introduced | None |
| Build artifacts | None — no new packages installed | None |

**Migration is the only data action.** The migration runs automatically on cold start (non-blocking). No manual data steps required.

---

## Common Pitfalls

### Pitfall 1: `arrayFilters` with nested arrays

**What goes wrong:** The `updateMany` for plan day subdocuments uses three levels of nesting: `phases[].weeks[].days[]`. If you write `{ 'phases.$[].weeks.$[].days.$[].discipline': 'run' }` with no `arrayFilters`, MongoDB will set discipline on ALL days including rest days (which have `type: 'rest'`). Rest days should not get a discipline value since they are not real training sessions.

**Why it happens:** Without an `arrayFilter`, `$[]` matches every element unconditionally.

**How to avoid:** Use `arrayFilters: [{ 'day.discipline': { $exists: false }, 'day.type': { $ne: 'rest' } }]` to restrict the update to only non-rest days missing the discipline field.

**Warning signs:** After migration, rest days have `discipline: 'run'` — this is incorrect.

### Pitfall 2: Migration count check for subdocuments

**What goes wrong:** `db.collection('plans').countDocuments({ 'phases.weeks.days.discipline': { $exists: false } })` does not work as expected. MongoDB's `$exists` on a nested array path checks if ANY element matches but the path notation differs from `$elemMatch`.

**Why it happens:** The correct check is `{ 'phases.weeks.days': { $elemMatch: { discipline: { $exists: false } } } }` when using a compound check. However, for the count check (to decide whether migration is needed), a simpler approach is to count `runs` documents directly and do a `findOne` check on plans.

**How to avoid:** Use `db.collection('plans').findOne({ 'phases.weeks.days': { $elemMatch: { discipline: { $exists: false } } } })` for the "is migration needed?" check, rather than relying on a count of plans.

### Pitfall 3: System prompt `type` vs `discipline` confusion

**What goes wrong:** If the system prompt instructs Claude to emit `type="gym"` in `<plan:add>` tags, the `addDay` handler will reject with 400 because the validation `if (type !== 'run' && type !== 'cross-train')` does not accept 'gym'.

**Why it happens:** Phase 13 does not widen the `type` enum — that's deferred to Phase 14.

**How to avoid:** System prompt must instruct Claude to use `type="cross-train"` for both gym and cycling plan days, with `discipline="gym"` or `discipline="cycle"` as the discriminator. The `addDay` handler does not need to be changed in Phase 13 (it accepts and stores whatever fields are present; `discipline` just passes through since it is not in the validation path).

### Pitfall 4: `PATCH /api/plan/days/:week/:day` body type does not include `discipline`

**What goes wrong:** The patchDay handler's body type only covers known fields. If `discipline` is not added, the handler will silently ignore it even when Claude emits `<plan:update week="N" day="X" discipline="gym"/>`.

**Why it happens:** The body type is explicit — unknown properties are stripped by TypeScript.

**How to avoid:** Add `discipline?: string` to the `body` type in `patchDay` and include `if (body.discipline !== undefined) { $set['phases.$[].weeks.$[week].days.$[day].discipline'] = body.discipline; }` in the update builder.

### Pitfall 5: `addDay` validation rejects `discipline` field silently

**What goes wrong:** The `addDay` handler constructs `newDay` manually from known fields. If `discipline` is not explicitly picked up, it won't be stored even when the body contains it.

**Why it happens:** `newDay` is built field-by-field, not spread from the body.

**How to avoid:** After the existing `newDay` construction, add: `if (body.discipline !== undefined) newDay['discipline'] = body.discipline;`

---

## Code Examples

### Migration: Runs Discipline Backfill
```typescript
// Source: existing runStartupMigration pattern in api/src/shared/migration.ts
const runsNeedingDiscipline = await db.collection('runs')
  .countDocuments({ discipline: { $exists: false } });

if (runsNeedingDiscipline > 0) {
  const result = await db.collection('runs').updateMany(
    { discipline: { $exists: false } },
    { $set: { discipline: 'run' } }
  );
  console.log(`[migration] Discipline backfill runs: ${result.modifiedCount}`);
}
```

### Migration: Plan Day Discipline Backfill
```typescript
// Source: MongoDB arrayFilters docs — targets subdocuments matching a filter
const plansNeedingDiscipline = await db.collection('plans')
  .findOne({ 'phases.weeks.days': { $elemMatch: { discipline: { $exists: false }, type: { $ne: 'rest' } } } });

if (plansNeedingDiscipline) {
  const result = await db.collection('plans').updateMany(
    { 'phases.weeks.days': { $elemMatch: { discipline: { $exists: false }, type: { $ne: 'rest' } } } },
    { $set: { 'phases.$[].weeks.$[].days.$[day].discipline': 'run' } },
    { arrayFilters: [{ 'day.discipline': { $exists: false }, 'day.type': { $ne: 'rest' } }] }
  );
  console.log(`[migration] Discipline backfill plans: ${result.modifiedCount} plans updated`);
}
```

### API: Accept discipline in POST /api/runs body
```typescript
// Source: existing optional field pattern in api/src/functions/runs.ts
let body: {
  // ...existing fields...
  discipline?: string;
};
// ...
if (body.discipline !== undefined) newRun.discipline = body.discipline as Discipline;
```

### TypeScript type
```typescript
// Source: pattern consistent with existing union types in api/src/shared/types.ts
export type Discipline = 'run' | 'gym' | 'cycle';

// In Run interface:
discipline?: Discipline;

// In PlanDay interface:
discipline?: Discipline;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-discipline hardcoded (run only) | Multi-discipline via `discipline` field | Phase 13 | All downstream phases (14–16) depend on this field being present |
| `PlanDay.type` as sole workout discriminator | `PlanDay.type` for rest/non-rest + `PlanDay.discipline` for sub-type | Phase 13 | `type` retains existing semantics; `discipline` adds new dimension |

---

## Open Questions

1. **Should `discipline` default to `'run'` at the API layer for `POST /api/runs` when not provided?**
   - What we know: Phase 14 will add the discipline selector to the UI. Until then, all new sessions are runs.
   - What's unclear: Whether to inject the default at the handler layer or only via migration.
   - Recommendation: Do NOT default at the handler layer. Migration handles history. Phase 14 always sends the field. An absent field is a valid signal (pre-Phase-14 client).

2. **Should `<plan:update>` support changing the `discipline` of an existing day?**
   - What we know: The system prompt docs describe `<plan:update>` as modifying guidelines, objectives, completed, skipped, type.
   - What's unclear: Whether Phase 13 needs the coach to be able to update discipline on existing days.
   - Recommendation: Yes — add `discipline` to the `patchDay` body type. It is a low-cost addition with no downside, and it makes the coach capable from day one.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API runtime | ✓ | 24.14.0 | — |
| MongoDB | Data migration | ✓ | Existing instance | — |
| mongodb-memory-server | Unit tests | ✓ | 11.0.1 | — |
| vitest | Unit tests | ✓ | installed | — |

No new external dependencies. Step 2.6: All dependencies available — no blockers.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `api/vitest.config.ts` |
| Quick run command | `cd api && npm test` |
| Full suite command | `cd api && npm test && cd ../web && npm test && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | `POST /api/runs` stores discipline field when provided | unit | `cd api && npm test -- runs.test.ts` | ✅ (extend existing) |
| DISC-01 | `GET /api/runs` returns discipline field on each run | unit | `cd api && npm test -- runs.test.ts` | ✅ (extend existing) |
| DISC-01 | Migration sets `discipline: 'run'` on runs without it | unit | `cd api && npm test -- migration.test.ts` | ✅ (extend existing) |
| DISC-01 | Migration is idempotent (second run is no-op) | unit | `cd api && npm test -- migration.test.ts` | ✅ (extend existing) |
| DISC-02 | `POST /api/plan/days` stores discipline on new day | unit | `cd api && npm test -- planDays.test.ts` | ✅ (extend existing) |
| DISC-02 | `PATCH /api/plan/days/:week/:day` updates discipline | unit | `cd api && npm test -- planDays.test.ts` | ✅ (extend existing) |
| DISC-02 | Migration sets `discipline: 'run'` on non-rest plan days without it | unit | `cd api && npm test -- migration.test.ts` | ✅ (extend existing) |
| DISC-02 | Migration skips rest days (no discipline set on rest) | unit | `cd api && npm test -- migration.test.ts` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `cd /c/dev/ai-running-coach/api && npm test`
- **Per wave merge:** `cd /c/dev/ai-running-coach/api && npm test` + TypeScript build check
- **Phase gate:** Full suite (`api`, `web`, Playwright) green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. Tests are added to existing files (`runs.test.ts`, `planDays.test.ts`, `migration.test.ts`).

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md apply to this phase:

- **MongoDB DB name derived from connection string** — migration must use `getDb()` (not `client.db('running-coach')` directly)
- **`runStartupMigration` is non-blocking** — migration call in `index.ts` uses `.catch()` only; failures must not crash the API
- **`npm run build` in `web/` is mandatory before committing** — must run even though Phase 13 has no frontend changes (TypeScript build verifies no type regressions)
- **E2E tests are mandatory** — `npx playwright test` required; no new E2E spec needed for Phase 13 (purely backend, no UI observable change), but existing E2E suite must stay green
- **Never create a `discipline` index unless needed for query performance** — Phase 13 queries do not filter by discipline (that is Phase 16); no new index needed in `db.ts`
- **Feature branch required** — `git checkout -b feature/phase-13-discipline-foundation` before any code changes
- **ANTHROPIC_API_KEY must never be set in test environments** — no change needed; existing mocks are sufficient
- **Tests are part of execution** — migration tests and handler tests must be written and green before marking the phase complete

---

## Sources

### Primary (HIGH confidence)
- Codebase direct reading: `api/src/shared/migration.ts` — confirmed startup migration pattern
- Codebase direct reading: `api/src/shared/types.ts` — confirmed `Run`, `PlanDay`, current interface shapes
- Codebase direct reading: `api/src/functions/runs.ts` — confirmed optional field acceptance pattern
- Codebase direct reading: `api/src/functions/planDays.ts` — confirmed `addDay` construction and `patchDay` body type
- Codebase direct reading: `api/src/shared/prompts.ts` — confirmed system prompt structure and tag documentation
- Codebase direct reading: `api/src/shared/db.ts` — confirmed index creation pattern and connection string handling
- Codebase direct reading: `api/src/shared/migration.test.ts` — confirmed test mock pattern for migration
- Codebase direct reading: `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` — confirmed phase scope

### Secondary (MEDIUM confidence)
- MongoDB documentation knowledge: `arrayFilters` for nested array subdocument updates — well-established MongoDB feature (v3.6+); project uses MongoDB 7.x so fully supported

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed; no new dependencies
- Architecture: HIGH — patterns directly observed in the existing codebase; migration strategy follows established `runStartupMigration` pattern exactly
- Pitfalls: HIGH — identified by reading the actual handler code, especially the `addDay` field-by-field construction and `patchDay` explicit body type

**Research date:** 2026-04-29
**Valid until:** 2026-06-29 (stable stack — 60 days)
