---
phase: "06"
slug: backend-auth-foundation
status: complete
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-15
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `api/vitest.config.ts` |
| **Quick run command** | `cd api && npm test -- --reporter=verbose` |
| **Full suite command** | `cd api && npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd api && npm test`
- **After every plan wave:** Run `cd api && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Test File | File Exists | Status |
|---------|------|------|-------------|-----------|-----------|-------------|--------|
| 06-01-T1 | 01 | 1 | AUTH-01, AUTH-02 | infra | `api/package.json` (jsonwebtoken, bcrypt deps) | ✅ | ✅ green |
| 06-01-T2 | 01 | 1 | AUTH-01, AUTH-02 | unit | `api/src/__tests__/types-auth.test.ts` (4 tests) | ✅ | ✅ green |
| 06-02-T1 | 02 | 2 | AUTH-01, AUTH-02, AUTH-05 | unit | `api/src/__tests__/authEndpoints.test.ts` (15 tests) | ✅ | ✅ green |
| 06-02-T2 | 02 | 2 | AUTH-01 | infra | `api/src/index.ts` (import registered) | ✅ | ✅ green |
| 06-03-T1 | 03 | 2 | AUTH-06 | unit | `api/src/__tests__/auth.test.ts` (10 tests) | ✅ | ✅ green |
| 06-03-T2 | 03 | 2 | AUTH-06 | unit | 8 route test files (requireAuth mock applied) | ✅ | ✅ green |
| 06-04-T1 | 04 | 3 | AUTH-06 | unit | `api/src/__tests__/auth.test.ts` (10 tests) | ✅ | ✅ green |
| 06-04-T2 | 04 | 3 | AUTH-01, AUTH-02, AUTH-05 | unit | `api/src/__tests__/authEndpoints.test.ts` (15 tests) | ✅ | ✅ green |
| 06-04-T3 | 04 | 3 | AUTH-06 | unit | `health.test.ts` + 7 other route test files | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No Wave 0 stubs needed — all test infrastructure was in place from prior phases, and Phase 6 delivered new test files alongside implementation (TDD approach).

---

## Requirement Coverage Summary

| Requirement | Description | Test File(s) | Test Count | Status |
|-------------|-------------|-------------|------------|--------|
| AUTH-01 | User can log in with email and password | `authEndpoints.test.ts`, `types-auth.test.ts` | 19 | ✅ COVERED |
| AUTH-02 | System issues a signed JWT on successful login | `authEndpoints.test.ts` | 15 | ✅ COVERED |
| AUTH-05 | User can log out (JWT cleared, refresh token revoked) | `authEndpoints.test.ts` | 15 | ✅ COVERED |
| AUTH-06 | All API routes reject unauthenticated/expired JWTs with 401 | `auth.test.ts` + 8 route test files | 10+ | ✅ COVERED |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MongoDB TTL index actually purges refresh_tokens after 30 days | AUTH-05 | Requires real MongoDB + clock manipulation; unit tests verify document insertion and expiresAt field only | Seed a `refresh_tokens` doc with `expiresAt: Date.now() + 30s`, wait for MongoDB TTL to purge; verify with `db.refresh_tokens.findOne({tokenHash: x})` returns null |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none were MISSING)
- [x] No watch-mode flags
- [x] Feedback latency < 6s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-15
