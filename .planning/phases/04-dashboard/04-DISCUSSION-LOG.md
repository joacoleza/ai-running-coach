# Phase 4: Dashboard — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 04-dashboard
**Areas discussed:** Charts & metrics, Dashboard layout, Training Plan navigation, Chat history

---

## Charts & Metrics

| Option | Description | Selected |
|--------|-------------|----------|
| A — Volume chart only | Weekly km bars | |
| B — Pace trend only | Line chart over time | |
| C — Both charts | Volume bars + pace line | ✓ |
| D — No charts | Stats cards only | |

**User's choice:** Both charts + stats cards + date range filter

---

## Date Range Filter

| Option | Description | Selected |
|--------|-------------|----------|
| A — Presets only | Fixed preset buttons | ✓ |
| B — Custom date picker | Free-range inputs | |
| C — Both | Presets + custom | |

**User's choice:** Presets: Current Plan (default) / Last 4 weeks / Last 8 weeks / Last 3 months / Last 12 months / This year / All time

**Notes:** User added "This year" and "Last 12 months" to the preset list. Default changed to "Current Plan" (see Navigation discussion below).

---

## Stats Cards

| Option | Description | Selected |
|--------|-------------|----------|
| A — Training load | Total distance, total runs, total time | ✓ |
| B — Goal progress | Weeks elapsed, adherence %, distance toward goal | |
| C — Both sets | All of the above | |

**User's choice:** A (training load). Adherence % added separately as a result of navigation discussion (see below).

---

## Dashboard Layout

| Option | Description | Selected |
|--------|-------------|----------|
| A — Stats first | Stats → Charts → Recent runs | ✓ (modified) |
| B — Current week first | Week schedule → Stats → Charts → Recent runs | |
| C — Charts first | Charts → Stats → Recent runs | |

**User's choice:** A, but no recent runs section — user has the Runs page for that. Final layout: Stats cards → Volume chart → Pace chart.

**Mobile:** Claude's discretion.

---

## Training Plan Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| A — "View Plan" button | Dedicated button/card at top | |
| B — Stats cards clickable | Adherence % card → /plan | ✓ |
| C — Both | Button + clickable stats | |

**User's choice:** B — adherence % card navigates to /plan.

**Notes:** During this discussion, user proposed "Current Plan" as a new default filter that scopes all data to runs linked to the active training plan. This was adopted as D-04 through D-07.

---

## Chat History Section (DASH-04)

| Option | Description | Selected |
|--------|-------------|----------|
| A — Drop entirely | Remove DASH-04 | modified |
| B — Separate page | /coach/history route | |
| C — On dashboard | Collapsible section | |

**User's choice:** Initially inclined to drop. After clarification that chat is plan-scoped, user proposed a better alternative: show readonly chat history in the coach panel when viewing an archived plan.

**New decisions added:** D-17 through D-23 — readonly CoachPanel on ArchivePlan page, same panel position, not auto-opened on mobile, FAB has visual indicator (different color or "History" label).

---

## Claude's Discretion

- Mobile chart layout
- Charting library selection (Recharts recommended)
- Exact visual treatment for readonly panel FAB/indicator

## Deferred Ideas

None.
