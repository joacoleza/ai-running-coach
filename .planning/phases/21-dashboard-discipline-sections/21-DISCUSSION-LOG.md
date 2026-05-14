# Phase 21: Dashboard Discipline Sections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 21-dashboard-discipline-sections
**Areas discussed:** All-discipline view, Stat cards placement, WeightProgressionChart default, Cycling speed chart, Section header session count

---

## All-Discipline View

| Option | Description | Selected |
|--------|-------------|----------|
| 3 sections stacked | Remove combined WeeklyVolumeChart; render Run, Cycling, Gym sections vertically one after another | ✓ |
| Overview chart + sections | Keep combined WeeklyVolumeChart at top, per-discipline charts below | |
| Keep current combined view | "All" mode unchanged; sections only activate when a specific discipline is selected | |

**User's choice:** 3 sections stacked
**Notes:** Combined WeeklyVolumeChart is removed entirely.

---

## Stat Cards Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Into each section | Each discipline section has its own 2-3 mini stat cards inline; top-level cards disappear | ✓ |
| Keep top-level summary | Stats stay at the top as combined summary; sections only contain charts | |
| Compact row in section header | Section header shows key stat inline; no separate card grid | |

**User's choice:** Into each section (Recommended)
**Notes:** No global stat card row remains. Each section self-contains its stats.

---

## WeightProgressionChart Default Exercise

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend picks from loaded runs | Count exercise occurrences in already-loaded gym sessions; pass top exercise as defaultExercise prop | ✓ |
| New API endpoint | Add GET /api/runs/exercise-weights/top to return the top exercise server-side | |

**User's choice:** Frontend picks from loaded runs (Recommended)
**Notes:** No new API endpoint needed; computed client-side from runs already in `useDashboard`.

---

## Cycling Speed Chart

| Option | Description | Selected |
|--------|-------------|----------|
| New component mirroring pace chart | Create WeeklySpeedChart.tsx dedicated component with km/h Y-axis | ✓ |
| Extend existing pace chart | Add 'metric' prop to a shared component switching pace/speed | |

**User's choice:** New component mirroring pace chart (Recommended)
**Notes:** `WeeklySpeedChart.tsx` — same structure as pace line chart but km/h axis.

---

## Section Header Session Count

| Option | Description | Selected |
|--------|-------------|----------|
| Count in section heading | Heading shows count inline: e.g. "Run (14 sessions)" | ✓ |
| As a stat card inside section | Count lives in the stat card row only (no duplication in heading) | |
| Both — header badge + stat cards | Small count badge in header AND full stat cards in section | |

**User's choice:** Count in section heading
**Notes:** Use "sessions" universally across all disciplines.

---

## Claude's Discretion

- Section wrapper component vs inline HTML per discipline in Dashboard.tsx
- Styling of section dividers/headers (border, badge, colored accent, etc.)
- Whether `WeeklyDurationChart` for gym is its own component file or inline Recharts

## Deferred Ideas

None.
