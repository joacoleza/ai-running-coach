---
phase: 260428-drl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .docs/security.md
autonomous: true
requirements:
  - SECURITY-REVIEW-01
must_haves:
  truths:
    - "A .docs/security.md file exists documenting all security findings"
    - "Each finding has a severity (Critical/High/Medium/Low/Info) and a recommendation"
    - "All OWASP Top 10 relevant areas are addressed in the review"
  artifacts:
    - path: ".docs/security.md"
      provides: "Security review findings with scope, methodology, findings, and recommendations"
      contains: "## Findings"
  key_links:
    - from: ".docs/security.md"
      to: "api/src/middleware/auth.ts"
      via: "documents JWT and auth middleware findings"
      pattern: "requireAuth|JWT"
---

<objective>
Conduct a full security review of the AI Running Coach codebase (API + web frontend) and produce a `.docs/security.md` report documenting findings with severity ratings and remediation recommendations.

Purpose: Identify security vulnerabilities across the entire stack before shipping to users, covering authentication, authorization, input validation, injection risks, secrets management, CORS/headers, rate limiting, JWT handling, XSS/CSRF, and dependency surface area.

Output: `.docs/security.md` — structured security report with scope, methodology, per-finding severity, and prioritized recommendations.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

# Key files to review during execution (already analyzed during planning):
# api/src/middleware/auth.ts        — JWT verification, requireAuth, requireAdmin
# api/src/functions/auth.ts         — login, refresh, logout, change-password handlers
# api/src/functions/admin.ts        — admin-only user management routes
# api/src/functions/chat.ts         — AI streaming endpoint, plan save from chat
# api/src/functions/runs.ts         — run CRUD with userId scoping
# api/src/functions/plan.ts         — plan CRUD with userId scoping
# api/src/functions/planDays.ts     — day patch/delete
# api/src/shared/db.ts              — MongoDB connection, index creation
# api/src/shared/types.ts           — data model interfaces
# api/src/shared/context.ts         — chat context builder (buildContextMessages)
# web/src/contexts/AuthContext.tsx  — token storage in localStorage
# web/src/App.tsx                   — 401 interceptor, auth gate
# web/src/pages/LoginPage.tsx       — JWT decode client-side, login form
# web/index.html                    — CSP headers (absent), viewport meta
# api/host.json                     — Azure Functions host config (no CORS config)
# api/package.json                  — dependency surface
# web/package.json                  — dependency surface
</context>

<tasks>

<task type="auto">
  <name>Task 1: Review codebase for security issues across all OWASP Top 10 categories</name>
  <files>api/src/middleware/auth.ts, api/src/functions/auth.ts, api/src/functions/admin.ts, api/src/functions/chat.ts, api/src/functions/runs.ts, api/src/functions/plan.ts, api/src/functions/planDays.ts, api/src/functions/planPhases.ts, api/src/functions/planArchive.ts, api/src/functions/messages.ts, api/src/functions/usage.ts, api/src/shared/db.ts, api/src/shared/context.ts, api/src/shared/types.ts, web/src/contexts/AuthContext.tsx, web/src/App.tsx, web/src/pages/LoginPage.tsx, web/src/pages/Admin.tsx, web/index.html, api/host.json, api/package.json, web/package.json</files>
  <action>
Read all the files listed above (most have already been loaded — read any not yet seen). Then conduct a systematic security review across these areas:

**1. Authentication and Session Management (OWASP A07)**
- JWT: algorithm (HS256 vs RS256), expiry (15m access / 30d refresh), secret strength requirement
- Refresh token: stored as SHA-256 hash in DB (good) — check for token rotation (is old token invalidated on use?)
- Logout: only deletes current refresh token — check for "logout from all devices" gap
- `requireAuth` DB lookup on every request — validates active flag but adds latency
- `X-Authorization` header used instead of `Authorization` — intentional SWA workaround, note as design decision
- Client-side JWT decode in LoginPage (atob) — UI-only, acceptable but document
- localStorage token storage — XSS risk vs httpOnly cookies

**2. Authorization / Broken Access Control (OWASP A01)**
- All API routes: verify every handler calls `requireAuth` before any DB operation
- Admin routes: verify `requireAdmin` (not just `requireAuth`) is called on all admin handlers
- Data isolation: every query scopes by `userId: new ObjectId(userId)` — audit each collection query in runs.ts, plan.ts, planDays.ts, planPhases.ts, chat.ts
- IDOR: check if plan/run IDs from URL params are validated against userId before use
- `buildContextMessages` in context.ts — does it scope by userId? (it queries by planId only — is planId validated against userId?)
- Admin self-deactivation prevention — implemented, note as positive

**3. Injection (OWASP A03)**
- MongoDB: all queries use ObjectId() constructor (prevents injection via typed BSON) — check for any raw string interpolation into queries
- User input in chat message stored as-is to DB and sent to Anthropic API — no SQL/NoSQL injection vector but check for prompt injection risks
- `progressFeedback` XML-strip before save — implemented, note as positive
- `notes` field in runs stored directly — no sanitization but served back to same user (low risk)
- Plan guidelines from Claude response stored to DB via `<plan:update>` — Claude-generated content, document risk

**4. Sensitive Data Exposure / Cryptography (OWASP A02)**
- Passwords: bcrypt with 10 rounds — acceptable
- Refresh tokens: 64 random bytes, stored as SHA-256 hash — good
- Temp passwords: `crypto.randomBytes(9).toString('base64url').slice(0, 12)` — 9 bytes = 72 bits entropy, good
- JWT_SECRET: env var, not hardcoded — good; document minimum recommended length
- MONGODB_CONNECTION_STRING: env var — verify not logged
- ANTHROPIC_API_KEY: env var, explicitly cleared in test env — good
- Error messages: check if stack traces leak in 500 responses (they catch `err` and return generic "Internal server error" — good)

**5. Security Misconfiguration (OWASP A05)**
- Azure Functions authLevel: 'anonymous' on all routes — intentional (custom JWT auth), document
- host.json: no CORS configuration — Azure SWA handles CORS at the proxy layer; document
- No Content-Security-Policy header on index.html or from API
- No X-Frame-Options, X-Content-Type-Options, Referrer-Policy headers
- No Strict-Transport-Security (HSTS) — should be Azure SWA default
- Rate limiting: login-only (good) — no rate limiting on chat endpoint (Anthropic costs risk)

**6. XSS (OWASP A03 / frontend)**
- React JSX auto-escapes — no `dangerouslySetInnerHTML` usage expected; verify
- `react-markdown` with `remark-gfm` renders coach responses — check for XSS in markdown
- XML tags stripped from chat messages before display — `replace(/<[^>]+\/>/g, '')` — verify this regex is sufficient and doesn't miss multi-line tags
- Run notes displayed via JSX (auto-escaped)

**7. CSRF**
- API uses JWT in custom `X-Authorization` header (not cookie) — browser same-origin policy prevents cross-site scripts from reading/setting custom headers — CSRF not applicable
- No CSRF tokens needed; document why

**8. Rate Limiting and DoS**
- Login: IP-based lockout after 5 failures, progressive duration — good
- Chat: NO rate limiting — each request hits Anthropic API (cost and abuse risk)
- Admin endpoints: no rate limiting beyond auth
- Plan/runs endpoints: no rate limiting

**9. Dependency Vulnerabilities**
- Run `npm audit` in both api/ and web/ directories to identify known CVEs
- Note major versions in use: jsonwebtoken@9.0.3, bcrypt@6.0.0, mongodb@7.1.0, @anthropic-ai/sdk@0.80.0

**10. Logging and Monitoring**
- Error logging: `context.error()` / `context.log()` used — no apparent PII leak in logs
- Login attempts: tracked in DB but not alerted
- Failed auth attempts: increment IP counter but no alert mechanism
- Usage events: tracked per user per model — good for abuse detection

Document all findings with:
- ID (e.g. SEC-01)
- Title
- Severity: Critical / High / Medium / Low / Info
- Affected file(s)
- Description of the issue
- Recommendation

After completing the review, read any remaining files not yet seen (planPhases.ts, planArchive.ts, messages.ts, usage.ts, Admin.tsx) to catch any missed issues.
  </action>
  <verify>
    <automated>ls .docs/security.md</automated>
  </verify>
  <done>All reviewed files have been read; findings are documented with severity and recommendation before writing the report.</done>
</task>

<task type="auto">
  <name>Task 2: Write .docs/security.md with structured findings and recommendations</name>
  <files>.docs/security.md</files>
  <action>
Create the `.docs/security.md` file. First create the `.docs/` directory if it does not exist. Write the file with this structure:

```
# Security Review — AI Running Coach

## Scope
[What was reviewed: API (Azure Functions + Node.js) and web frontend (React + Vite). Date. Reviewer.]

## Methodology
[Manual code review across OWASP Top 10 categories. No automated scanner, no penetration test.]

## Executive Summary
[1 paragraph: overall posture, count by severity]

## Findings

### SEC-01: [Title] — [Severity]
**Affected:** [file(s)]
**Description:** [what the issue is and why it matters]
**Recommendation:** [specific fix]

[... all findings ...]

## Positive Security Controls
[Things done right: bcrypt, refresh token hashing, userId scoping, timing-safe dummy hash, IP rate limiting, XML strip before DB save, etc.]

## Dependency Audit
[Results of npm audit from api/ and web/. Known CVEs or "no known vulnerabilities".]

## Recommendations Summary (Prioritized)

| Priority | Finding | Effort |
|----------|---------|--------|
| P1 (fix now) | ... | Low/Med/High |
| P2 (fix soon) | ... | ... |
| P3 (consider) | ... | ... |
```

Severity definitions:
- **Critical**: Immediate data breach or account takeover possible
- **High**: Significant risk requiring prompt remediation
- **Medium**: Risk exists but requires specific conditions or attacker access
- **Low**: Minor risk, defense-in-depth improvement
- **Info**: Observation or design decision worth documenting

Based on the Task 1 analysis, the anticipated findings include (confirm or revise after reading all files):

**High/Medium findings expected:**
- SEC-01: No Content-Security-Policy header (Medium) — XSS impact amplified without CSP
- SEC-02: Access tokens stored in localStorage (Medium) — vulnerable to XSS exfiltration; httpOnly cookies would be safer
- SEC-03: No rate limiting on chat endpoint (Medium) — Anthropic API cost amplification attack, no per-user throttle
- SEC-04: `buildContextMessages` queries messages by planId without userId scope (Medium) — if a user can guess/brute-force another user's planId (MongoDB ObjectId = 12-byte random), they could read another user's chat history via the chat endpoint; chat.ts validates planId against userId for the plan doc but context.ts does not re-validate
- SEC-05: Refresh token not rotated on use (Low-Medium) — stolen refresh token can be reused until 30-day expiry; token rotation (delete old, issue new) would limit window

**Low findings expected:**
- SEC-06: JWT algorithm not pinned in verify() call (Low) — jsonwebtoken v9 defaults to HS256; explicitly passing `{ algorithms: ['HS256'] }` to jwt.verify() prevents algorithm confusion attacks
- SEC-07: Missing security response headers (Low) — X-Frame-Options, X-Content-Type-Options, Referrer-Policy not set
- SEC-08: Admin password reset returns temp password in plaintext response (Info/Low) — necessary by design (no email delivery), document as accepted risk
- SEC-09: Progressive lockout reset on success clears lockoutCount (Low) — `lockoutCount: 0` on success means a patient attacker can indefinitely reset their lockout cycle; should only reset `attempts`, not `lockoutCount`
- SEC-10: Error message reveals token rejection reason (Low) — `Invalid or expired token: ${reason}` leaks JWT library error details in 401 response; use generic message instead
- SEC-11: No HSTS enforcement at application layer (Info) — Azure SWA should enforce; document as platform dependency
- SEC-12: `react-markdown` renders arbitrary coach-generated markdown (Info) — XSS mitigated by React's JSX escaping of output from `react-markdown`; acceptable

Run `npm audit` in both directories and add results to the Dependency Audit section.

Write the complete file using the Write tool.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const content=fs.readFileSync('.docs/security.md','utf8'); const required=['## Scope','## Findings','## Positive Security Controls','## Recommendations Summary']; const missing=required.filter(s=>!content.includes(s)); if(missing.length>0){console.error('Missing sections:',missing);process.exit(1);} console.log('security.md structure OK, size:', content.length, 'chars');"</automated>
  </verify>
  <done>.docs/security.md exists with all required sections (Scope, Methodology, Executive Summary, Findings with severity, Positive Security Controls, Dependency Audit, Recommendations Summary). All findings have ID, affected file, description, and recommendation.</done>
</task>

</tasks>

<verification>
- `.docs/security.md` exists and is readable
- File contains at minimum 8 findings covering auth, headers, rate limiting, data isolation, and dependency audit
- Each finding has: SEC-XX ID, severity label, affected file(s), description, and recommendation
- Dependency Audit section includes actual `npm audit` output or summary
- Recommendations Summary table sorts findings by priority
</verification>

<success_criteria>
`.docs/security.md` is a complete, actionable security report that:
1. Covers all OWASP Top 10 categories relevant to this stack
2. Rates each finding by severity (Critical/High/Medium/Low/Info)
3. References the exact file and line pattern affected
4. Provides a specific, actionable recommendation for each finding
5. Acknowledges what the codebase does well (positive controls)
6. Includes real npm audit results
7. Ends with a prioritized remediation table
</success_criteria>

<output>
After completion, create `.planning/quick/260428-drl-security-review-of-the-whole-code-write-/260428-drl-SUMMARY.md`
</output>
