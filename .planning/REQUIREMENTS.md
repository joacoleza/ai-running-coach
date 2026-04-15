# Requirements: AI Running Coach — v2.0 Multi-User Support

**Defined:** 2026-04-15
**Core Value:** A persistent coach that remembers your goal, knows your history, and adapts your plan based on what actually happened — not generic training templates.

## v2.0 Requirements

### AUTH — Authentication

- [x] **AUTH-01**: User can log in with email and password via a login page
- [x] **AUTH-02**: System issues a signed JWT on successful login (signed with JWT_SECRET env var)
- [ ] **AUTH-03**: User with a temp-password flag is force-redirected to a change-password page before accessing any other route
- [ ] **AUTH-04**: User can set a new password (enforced on first login; available anytime thereafter)
- [x] **AUTH-05**: User can log out (JWT cleared client-side; redirected to login page)
- [x] **AUTH-06**: All API routes reject unauthenticated or expired JWTs with 401; client auto-redirects to login

### USER — User Management (Admin)

- [ ] **USER-01**: Admin can view a list of all user accounts (email, status, last login date)
- [ ] **USER-02**: Admin can create a new user account; system auto-generates a temp password shown once to the admin (bcrypt-hashed before storage)
- [ ] **USER-03**: Admin can reset any user's password; new temp password generated and shown once; user must change on next login
- [ ] **USER-04**: Admin can delete or deactivate a user account

### DATA — Data Isolation & Migration

- [ ] **DATA-01**: Each user's plans, runs, and chat history are isolated — only visible and accessible to that user
- [ ] **DATA-02**: Existing v1.1 data (plans, runs, messages) is migrated to a seed admin user on first v2.0 deployment (no data lost)
- [ ] **DATA-03**: Admin users have an `isAdmin` flag enabling access to the admin panel

## Future Requirements

### Profile

- **PROF-01**: User can set a display name / profile info
- **PROF-02**: User can change their own email address

### Notifications

- **NOTF-01**: User receives an email when their account is created (with temp password)
- **NOTF-02**: User receives an email for password reset (instead of out-of-band delivery)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Google OAuth / social login | Username+password is simpler; no external OAuth app needed |
| Public self-registration | Closed system — admin provisions all accounts |
| Email-based forgot-password flow | Admin-triggered reset delivers temp password out-of-band (no email infra needed) |
| Per-user Claude API cost limits | Small known user base; cost monitoring sufficient |
| Multi-tenant data at DB level | Single MongoDB instance; `userId` field on documents provides isolation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 6 | Complete |
| AUTH-02 | Phase 6 | Complete |
| AUTH-05 | Phase 6 | Complete |
| AUTH-06 | Phase 6 | Complete |
| AUTH-03 | Phase 7 | Pending |
| AUTH-04 | Phase 7 | Pending |
| DATA-01 | Phase 8 | Pending |
| DATA-02 | Phase 8 | Pending |
| DATA-03 | Phase 8 | Pending |
| USER-01 | Phase 9 | Pending |
| USER-02 | Phase 9 | Pending |
| USER-03 | Phase 9 | Pending |
| USER-04 | Phase 9 | Pending |

**Coverage:**
- v2.0 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 — traceability filled after roadmap creation*
