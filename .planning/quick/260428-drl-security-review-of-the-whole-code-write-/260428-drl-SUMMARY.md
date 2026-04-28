---
phase: 260428-drl
plan: 01
subsystem: security
tags: [security, audit, owasp, dependencies]
key-files:
  created:
    - .docs/security.md
  modified: []
decisions:
  - SEC-04 (buildContextMessages missing userId) is a correctness bug, not just hardening — treated as P2 fix
  - All npm audit vulnerabilities in api/ and web/ are in dev/build tooling, not production code (except @anthropic-ai/sdk)
  - localStorage token storage accepted as current architecture; httpOnly cookie migration recommended as P3
metrics:
  duration: "~25 minutes"
  completed: "2026-04-28"
  tasks: 2
  files: 1
---

# Phase 260428-drl Plan 01: Security Review Summary

**One-liner:** Full-stack security audit covering OWASP Top 10, identifying 13 findings (1 High: missing CSP, 1 Medium: chat history cross-user scope gap, 1 Medium: no chat rate limiting) with npm audit results and prioritized remediation table.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Review codebase for security issues across all OWASP Top 10 categories | 2ed8ea1 | (review only) |
| 2 | Write .docs/security.md with structured findings and recommendations | 2ed8ea1 | `.docs/security.md` |

## Deviations from Plan

None — plan executed exactly as written. All anticipated findings from the plan were confirmed or revised based on actual code inspection:

- SEC-04 was confirmed: `buildContextMessages` in `context.ts` line 11 uses `find({ planId })` without userId scope. The plan anticipated this correctly.
- SEC-09 (missing security headers) was confirmed: no `staticwebapp.config.json` exists.
- SEC-10 (JWT error leaks library detail) was confirmed: line 62 in `auth.ts` returns `` `Invalid or expired token: ${reason}` `` with jsonwebtoken error internals.
- SEC-05 (lockoutCount reset on success) confirmed at lines 122-127 in `auth.ts`.

## Findings Summary

| ID | Severity | Title |
|----|----------|-------|
| SEC-01 | High | No Content-Security-Policy header |
| SEC-02 | Medium | Access tokens stored in localStorage |
| SEC-03 | Medium | No rate limiting on chat endpoint |
| SEC-04 | Medium | buildContextMessages missing userId scope (cross-user chat history) |
| SEC-05 | Low | JWT error message leaks library error detail |
| SEC-06 | Low | Refresh token not rotated on use |
| SEC-07 | Low | JWT algorithm not explicitly pinned |
| SEC-08 | Low | Progressive lockout resets lockoutCount on success |
| SEC-09 | Low | Missing X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| SEC-10 | Info | Admin password reset returns plaintext temp password (accepted risk) |
| SEC-11 | Info | react-markdown link href not sanitized |
| SEC-12 | Info | CSRF not applicable by design |
| SEC-13 | Info | HSTS not verified at application layer |

## Key Decisions Made

1. `buildContextMessages` userId-scoping gap (SEC-04) classified as a correctness bug (Medium) rather than just a hardening recommendation, because it allows cross-user chat history disclosure when planId is known.

2. All `npm audit` vulnerabilities in both `api/` and `web/` are in dev/build tooling (azure-functions-core-tools, Vite, PostCSS, Vitest) — none affect the deployed production artifacts. The one exception is `@anthropic-ai/sdk` (Memory tool sandbox escape), which is not applicable because the Memory tool is not used.

3. localStorage token storage (SEC-02) classified as Medium (not High) because there is no current XSS vector and React's JSX escaping mitigates the most common XSS paths. Recommended as P3 architectural improvement.

## Self-Check: PASSED

- `.docs/security.md` exists and contains all required sections
- Commit 2ed8ea1 recorded in git log
- 13 findings documented with ID, severity, affected files, description, and recommendation
- npm audit results from both api/ and web/ included in Dependency Audit section
- Recommendations Summary table sorts findings by priority
