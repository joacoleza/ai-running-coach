---
phase: quick
plan: 260510-j7c
subsystem: api, web, e2e
tags: [bug-fix, validation, data-integrity]
dependency_graph:
  requires: []
  provides: [duration-validation-patch, duration-validation-create, duration-validation-client]
  affects: [api/src/functions/runs.ts, web/src/components/runs/RunDetailModal.tsx]
tech_stack:
  added: []
  patterns: [anchored-regex-validation, guard-before-db-call, client-side-form-guard]
key_files:
  created: []
  modified:
    - api/src/functions/runs.ts
    - api/src/__tests__/runs.test.ts
    - web/src/components/runs/RunDetailModal.tsx
    - web/src/__tests__/RunDetailModal.test.tsx
    - e2e/runs.spec.ts
    - CLAUDE.md
decisions:
  - isValidDuration uses anchored regex (^ and $) so "12:0011" fails the MM:SS pattern
  - PATCH guard placed after JSON parse, before getDb() — no wasted DB round-trip on invalid input
  - Client guard conditioned on editDuration !== run.duration (stored value is assumed valid from create)
metrics:
  duration: ~15 minutes
  completed: 2026-05-10
  tasks: 3
  files: 6
---

# Quick Task 260510-j7c: Fix Duration Validation on Session Update — Summary

**One-liner:** Added server-side `isValidDuration()` guard to PATCH and POST /api/runs, and client-side guard in RunDetailModal, preventing corrupted durations like "12:0011" from reaching the database.

## What Was Done

### Task 1: Server-side duration validation (TDD)

Added `isValidDuration()` helper to `api/src/functions/runs.ts` immediately after `computePace()`:

```typescript
function isValidDuration(duration: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(duration) || /^\d{1,3}:\d{2}:\d{2}$/.test(duration);
}
```

The anchored regex prevents inputs like "12:0011" (which would pass a naive contains-check).

Guards added:
- **PATCH /api/runs/:id** — after body JSON parse, before `getDb()` call. Returns 400 with `"Invalid duration format. Use MM:SS or HH:MM:SS."` immediately.
- **POST /api/runs** — after required-field check. Defense-in-depth since create form already validates client-side, but the API must not trust client data.

9 new unit tests added to `api/src/__tests__/runs.test.ts`:
- PATCH with "12:0011" → 400
- PATCH with "1:00asdasda" → 400
- PATCH with "9:5" (single-digit seconds) → 400
- PATCH with "25:00" (valid MM:SS) → 200
- PATCH with "1:30:00" (valid HH:MM:SS) → 200
- PATCH with no duration field (notes update) → 200
- POST with "12:0011" → 400
- POST with "9:5" → 400
- POST with "9:05" → 201

**Commit:** `7e86873`

### Task 2: Client-side guard in RunDetailModal, E2E test, CLAUDE.md update

Added `durationValid` check in `web/src/components/runs/RunDetailModal.tsx` `handleSave()`:

```typescript
const durationValid =
  /^\d{1,2}:\d{2}$/.test(editDuration) || /^\d{1,3}:\d{2}:\d{2}$/.test(editDuration);
```

Guard in `handleSave` (after date check, before `setIsSaving`):
```typescript
if (editDuration !== run.duration && !durationValid) {
  setError('Invalid duration format. Use MM:SS or HH:MM:SS.');
  return;
}
```

2 new unit tests in `web/src/__tests__/RunDetailModal.test.tsx`:
- Shows error and does NOT call `updateRun` when saving with "12:0011"
- Allows saving with valid "1:30:00" (calls `updateRun` with duration field)

1 new E2E test in `e2e/runs.spec.ts` ("RunDetailModal: rejects invalid duration on update"):
- Routes runs list, opens RunDetailModal by clicking run row, fills "12:0011", clicks Save — expects error message to appear.

CLAUDE.md updated in Git Workflow section — added explicit sentence: "Creating a commit on master locally is NOT allowed — always branch first."

**Commit:** `ac126bd`

### Task 3: Full test suite + TypeScript build

All suites pass:
- API: 413 tests, 36 test files — all pass
- Web: 639 tests, 45 test files — all pass
- TypeScript build: clean (`vite build` succeeds, chunk size warning is pre-existing)
- E2E: skipped (Docker/MongoDB not available in this environment; client-side guard makes E2E a smoke test only)

## Deviations from Plan

None — plan executed exactly as written. The POST guard was already in the plan spec (step 3 of Task 1 action).

## Known Stubs

None.

## Self-Check: PASSED

Files verified:
- `api/src/functions/runs.ts` — contains `isValidDuration`
- `api/src/__tests__/runs.test.ts` — contains `PATCH /api/runs/:id - duration validation` describe block
- `web/src/components/runs/RunDetailModal.tsx` — contains `durationValid` and duration guard in `handleSave`
- `web/src/__tests__/RunDetailModal.test.tsx` — contains `RunDetailModal — duration validation` describe block
- `e2e/runs.spec.ts` — contains `RunDetailModal duration validation` describe block
- `CLAUDE.md` — contains "Creating a commit on master locally is NOT allowed"

Commits verified:
- `7e86873` — server-side validation
- `ac126bd` — client-side guard + E2E + CLAUDE.md
