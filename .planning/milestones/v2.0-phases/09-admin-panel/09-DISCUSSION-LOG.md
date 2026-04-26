# Phase 9: Admin Panel — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 09-admin-panel
**Areas discussed:** Delete vs Deactivate, Temp password UX, Status column meaning, Admin self-protection

---

## Delete vs Deactivate

| Option | Description | Selected |
|--------|-------------|----------|
| Both, separate buttons | Deactivate blocks login but keeps data; Delete removes permanently with confirmation | |
| Delete only | Single destructive action; data gone permanently | |
| Deactivate only | Safer — nothing permanently deleted; data stays, login stops working | ✓ |

**User's choice:** Deactivate only

**Follow-up: Can a deactivated user be re-activated?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, toggle | Deactivate button becomes Activate when deactivated; single PATCH endpoint | ✓ |
| No, one-way | Once deactivated, stays deactivated; simpler | |

**User's choice:** Yes, toggle (Recommended)

---

## Temp Password UX

| Option | Description | Selected |
|--------|-------------|----------|
| Modal with copy button | Modal after create/reset with temp password + Copy button; dismissed manually; gone once closed | ✓ |
| Inline in the row | Password briefly shown in table row after action; fades after 30s | |
| Alert / banner at top | Full-width dismissible banner with the password | |

**User's choice:** Modal with copy button (Recommended)

---

## Status Column Meaning

| Option | Description | Selected |
|--------|-------------|----------|
| Active / Pending / Deactivated | Active = set own password; Pending = tempPassword flag; Deactivated = blocked | ✓ |
| Active / Deactivated only | Two-state; pending shown via tempPassword badge separately | |

**User's choice:** Active / Pending / Deactivated (Recommended)

**Follow-up: How is status derived?**

| Option | Description | Selected |
|--------|-------------|----------|
| Add 'active' boolean to User doc | active: boolean (default true); status logic: !active→Deactivated, active&&tempPassword→Pending, active&&!tempPassword→Active | ✓ |
| Separate 'deactivatedAt' timestamp | Null = active, date set = deactivated; more info but more complex | |

**User's choice:** Add 'active' boolean to User doc (Recommended)

---

## Admin Self-Protection

| Option | Description | Selected |
|--------|-------------|----------|
| Prevent self-deactivation only | API returns 400 if admin tries to deactivate themselves; password reset on self is fine | ✓ |
| No restrictions | Admin is trusted; they can deactivate themselves | |
| Prevent all self-actions | Admin cannot deactivate, reset, or modify own account from admin panel | |

**User's choice:** Prevent self-deactivation only (Recommended)

---

## Claude's Discretion

- Temp password generation format (length, character set)
- Whether to show `createdAt` column in user table
- Admin route URL structure
- Badge colors and exact styling
- Whether "Create User" is inline or in a modal

## Deferred Ideas

- Cascade delete (permanently remove user + all data) — future phase
- Admin audit log — future enhancement
- Email notifications for account creation / reset — NOTF-01/NOTF-02 future requirements
- Per-user data view from admin panel — out of scope
