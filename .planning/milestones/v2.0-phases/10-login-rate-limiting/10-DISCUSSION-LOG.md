# Phase 10: Login Rate Limiting — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 10-login-rate-limiting
**Areas discussed:** 429 response detail, Storage location, Attempt-during-lockout, Admin unlock, Timing attack mitigation

---

## 429 Response Detail

| Option | Description | Selected |
|--------|-------------|----------|
| Time remaining + header | Body: 'Account locked. Try again in X minutes.' + Retry-After header | ✓ |
| Generic message only | 'Too many failed login attempts. Try again later.' No timing info | |
| Full detail | Exact unlock timestamp + remaining attempts shown before lockout too | |

**User's choice:** Time remaining in message + `Retry-After: <seconds>` header

---

## Pre-Lockout Warnings

| Option | Description | Selected |
|--------|-------------|----------|
| Warn on remaining attempts | 401 includes remaining count: 'Invalid credentials. 3 attempts remaining.' | ✓ |
| Silent until lockout | 401 stays as 'Invalid credentials' with no attempt count | |

**User's choice:** Include remaining attempt count in 401 responses

---

## Storage Location

| Option | Description | Selected |
|--------|-------------|----------|
| User document | failedLoginAttempts + lockedUntil + lockoutCount on User doc | ✓ |
| Separate collection | New rate_limits collection, second DB read on every login | |

**User's choice:** User document — consistent with existing per-user auth state pattern

---

## Attempt-During-Lockout (Timer Behavior)

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 15 min from trigger | Timer set once; subsequent attempts don't extend deadline | ✓ |
| Extend on each attempt | Every attempt during lockout resets the clock | |

**User's choice:** Fixed from trigger
**Notes:** User initially asked about the brute-force defense context. After clarification that "extend" could cause DoS against own users (persistent attack permanently freezes account), user confirmed fixed timer.

---

## Admin Unlock

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to future phase | Phase 10 API-only; admin unlock endpoint + UI button in future | ✓ |
| Include in this phase | POST /api/users/:id/unlock endpoint + admin panel button now | |

**User's choice:** Defer entirely — both API endpoint and admin panel button go in a future phase
**Notes:** User added: "Admin can unlock at any time from the dashboard" (future phase). Admin user lockout recovery = clear directly in MongoDB.

**Progressive lockout (raised during admin unlock discussion):**
User requested progressive escalation instead of flat 15 min:
- 15 min → 30 min → 60 min → 120 min → 240 min → 480 min → 1440 min (24h cap)
- Formula: `15 * 2^(lockoutCount - 1)`, capped at 1440 min
- lockoutCount resets to 0 on first successful login

---

## Lockout Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 24 hours | 15→30→60→120→240→480→1440 min (stays at 1440) | ✓ |
| Cap at 1 hour | 15→30→60 min (stays at 60) | |
| No cap | Keeps doubling indefinitely | |

**User's choice:** 24-hour cap

---

## Lockout Counter Reset

| Option | Description | Selected |
|--------|-------------|----------|
| Never (lifetime escalation) | lockoutCount only grows | |
| Reset after successful logins | N clean logins resets counter | |
| Reset after 30 days | Time-based amnesty | |
| Reset on first successful login | Both failedLoginAttempts and lockoutCount → 0 on success | ✓ |

**User's choice:** Reset both counters on first successful login (free text response)

---

## Timing Attack Mitigation

| Option | Description | Selected |
|--------|-------------|----------|
| Include dummy bcrypt | Run bcrypt against dummy hash when email not found | ✓ |
| Skip | Keep current fast-fail for non-existent email | |

**User's choice:** Include timing attack mitigation
**Context:** User asked about additional security improvements beyond lockout. Claude identified timing attack as the most practical improvement fitting Phase 10 scope. IP-based rate limiting noted as future/CDN concern.

---

## Claude's Discretion

- Exact dummy hash value
- Whether to extract rate limiting into helper function or keep inline
- Error message wording (singular/plural)
- DB index decisions

## Deferred Ideas

- Admin unlock endpoint (POST /api/users/:id/unlock) + admin panel button — future phase
- IP-based rate limiting — future phase or CDN-level
- Audit log for failed login events — future observability work
