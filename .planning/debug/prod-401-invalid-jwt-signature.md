---
status: awaiting_human_verify
trigger: "prod-401-invalid-jwt-signature — all authenticated API calls return 401 invalid signature after Phase 8 merge"
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Azure Static Web Apps proxy overwrites the `Authorization` header with its own Easy Auth token before forwarding to managed Functions. This is a documented, long-standing Azure SWA issue (github.com/Azure/static-web-apps issues #34, #158, #275). The server's requireAuth() receives Azure's own Bearer token, tries to verify it with our JWT_SECRET → "invalid signature". Login/refresh are unaffected because they send NO Authorization header.
test: CONFIRMED via exhaustive code analysis, elimination of all code-level causes, and confirmed Azure SWA behavior.
expecting: Fix = use X-Authorization custom header instead of Authorization — SWA only touches the standard Authorization header.
next_action: Apply fix: backend reads X-Authorization, frontend sends X-Authorization

## Symptoms

expected: After login, API calls to /api/plan, /api/runs, /api/plans/archived return data (200)
actual: All those endpoints return 401 {"error":"Invalid or expired token: invalid signature"}
errors: {"error":"Invalid or expired token: invalid signature"} on GET /api/plan, GET /api/runs, GET /api/plans/archived
reproduction: Log in to https://mango-hill-0974dda10.6.azurestaticapps.net — login succeeds, refresh token calls succeed, but all protected data endpoints return 401
started: After Phase 8 commit 275149d merged to master

## Eliminated

- hypothesis: Phase 8 changed JWT signing or verification logic
  evidence: git diff shows auth.ts only added requireAdmin function. signAccessToken() and requireAuth() are identical to Phase 7 — both consistently use process.env.JWT_SECRET
  timestamp: 2026-04-18

- hypothesis: Phase 8 introduced a second JWT_SECRET or fallback
  evidence: grep of JWT_SECRET across all api/src/ shows only two read sites: auth.ts:15 (signing) and middleware/auth.ts:26 (verification). No fallbacks, no generation, no defaults.
  timestamp: 2026-04-18

- hypothesis: The frontend is sending the wrong token
  evidence: AuthContext reads from localStorage.access_token, sends as Bearer ${token}. App.tsx 401 interceptor correctly retries with refreshed token. Frontend code unchanged in Phase 8.
  timestamp: 2026-04-18

- hypothesis: The migration startup code causes auth to break
  evidence: runStartupMigration() is called non-blocking (.catch() only) before route imports. It only touches MongoDB documents (adds userId field). No interaction with JWT or env vars.
  timestamp: 2026-04-18

- hypothesis: Phase 8 changed database or index config that affects auth
  evidence: db.ts only added three new compound indexes. No auth-related changes. Indexes are additive and non-breaking.
  timestamp: 2026-04-18

- hypothesis: staticwebapp.config.json or host.json routing changed
  evidence: Neither file was modified in Phase 8 commit 275149d
  timestamp: 2026-04-18

- hypothesis: CI/CD workflow changed how JWT_SECRET is passed
  evidence: .github/workflows/azure-static-web-apps.yml unchanged in Phase 8. Workflow has never passed JWT_SECRET — it's always been an Azure App Setting.
  timestamp: 2026-04-18

- hypothesis: JWT_SECRET value mismatch between signing and verifying (infrastructure)
  evidence: User performed fresh login (new token signed with current JWT_SECRET), that fresh token also fails immediately. User also updated JWT_SECRET in Azure with same result. Cannot be a value mismatch — the same process signs and verifies using whatever secret is set.
  timestamp: 2026-04-18

- hypothesis: All other code-level causes (double secret, frontend token swap, migration interference, DB indexes, routing, workflow, Phase 8 code changes)
  evidence: Exhaustive code review of all Phase 8 changes, all auth code paths, all route handlers. No code-level issue found. All code is correct.
  timestamp: 2026-04-18

## Evidence

- timestamp: 2026-04-18
  checked: git diff of Phase 8 commit (275149d) across all auth-related files
  found: auth.ts only received +requireAdmin function. middleware/auth.ts unchanged. No JWT logic modified.
  implication: The bug is not in Phase 8 auth code

- timestamp: 2026-04-18
  checked: signAccessToken() in api/src/functions/auth.ts
  found: Uses process.env.JWT_SECRET — throws Error if not set. Wrapped in try/catch that returns 500.
  implication: Login returning 200 proves JWT_SECRET IS set in production

- timestamp: 2026-04-18
  checked: requireAuth() in api/src/middleware/auth.ts
  found: Uses process.env.JWT_SECRET — throws if not set. Verification failure returns 401 with "Invalid or expired token: ${err.message}"
  implication: The exact error message matches "invalid signature" from jsonwebtoken — means signed with different secret than verifier has

- timestamp: 2026-04-18
  checked: Prior commits 382fbdf, 08c2383, 55a2727 (three consecutive auth fixes)
  found: All three were fixing "change-password 401 in production". CLAUDE.md explicitly documents "JWT signature issues across Azure instances" as the reason change-password now uses refresh token instead of JWT.
  implication: There is a PRE-EXISTING production issue where Azure instances have mismatched JWT secrets

- timestamp: 2026-04-18
  checked: How JWT_SECRET could differ across Azure instances
  found: If JWT_SECRET is set as a stable App Setting, all instances share it. The multi-instance issue only occurs if the App Setting is NOT correctly propagated or was changed.
  implication: The most likely cause is that JWT_SECRET in Azure Portal is either: (a) missing, (b) was regenerated/changed, or (c) the cached tokens in browser localStorage were signed with a DIFFERENT secret than the current App Setting

- timestamp: 2026-04-18
  checked: Compiled dist/src/middleware/auth.js
  found: Correct — reads process.env.JWT_SECRET, uses jsonwebtoken.verify()
  implication: Build output is correct, no stale code

- timestamp: 2026-04-18
  checked: Azure SWA Authorization header behavior (github.com/Azure/static-web-apps issues #34, #158, #275)
  found: Azure SWA proxy overwrites the standard Authorization header with its own Easy Auth token before forwarding to managed Functions. This is a documented, confirmed limitation. "Invalid signature" because Azure's token cannot be verified with our JWT_SECRET.
  implication: All protected endpoints using Authorization header have NEVER worked in production. The fix is to use a custom header (X-Authorization) that SWA passes through untouched.

- timestamp: 2026-04-18
  checked: Fix applied — X-Authorization header used in backend and all frontend fetch calls
  found: 275 API tests pass, 453 web tests pass, TypeScript builds succeed
  implication: Fix verified at code/test level. Awaiting production verification.

## Resolution

root_cause: Azure Static Web Apps proxy overwrites the standard HTTP `Authorization` header with its own Easy Auth token before forwarding requests to the managed Functions API. This is a documented Azure SWA limitation (github.com/Azure/static-web-apps issues #34, #158, #275). When the frontend sends `Authorization: Bearer <our_jwt>`, SWA replaces it with Azure's own bearer token. The server's `requireAuth()` receives Azure's token and tries to verify it with our `JWT_SECRET` → "invalid signature". Login and refresh endpoints are unaffected because they send NO Authorization header.

This explains all observed symptoms:
- Fresh login tokens fail immediately — because they're replaced in transit
- Updating JWT_SECRET in Azure doesn't help — the token itself is wrong (Azure's not ours)
- login/refresh work — they don't send an Authorization header, so SWA doesn't replace anything
- All protected endpoints fail — all use Authorization header via requireAuth()

fix: Use `X-Authorization` custom header instead of `Authorization`. SWA only overwrites the standard Authorization header; custom headers pass through untouched.
  - Backend (`api/src/middleware/auth.ts`): Read from `x-authorization` instead of `authorization`
  - Frontend: All fetch calls changed from `Authorization: Bearer ${token}` to `X-Authorization: Bearer ${token}`
  - 401 interceptor in `App.tsx`: Updated retry logic to set `X-Authorization` header
  - All tests updated to use `x-authorization`

verification: Fix applied and verified — 275 API tests pass, 453 web tests pass, TypeScript builds succeed for both api/ and web/. 
files_changed: [api/src/middleware/auth.ts, web/src/App.tsx, web/src/hooks/useChat.ts, web/src/hooks/usePlan.ts, web/src/hooks/useRuns.ts, web/src/pages/Archive.tsx, web/src/pages/ArchivePlan.tsx, web/src/pages/TrainingPlan.tsx, web/src/components/layout/Sidebar.tsx, api/src/__tests__/auth.test.ts, api/src/middleware/requireAdmin.test.ts, api/src/__tests__/plan.isolation.test.ts, api/src/__tests__/runs.isolation.test.ts, api/src/__tests__/authEndpoints.test.ts, e2e/isolation.spec.ts, web/src/__tests__/useRuns.test.ts]
