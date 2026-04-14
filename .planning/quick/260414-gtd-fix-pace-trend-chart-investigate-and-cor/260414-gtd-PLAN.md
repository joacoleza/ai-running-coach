---
phase: quick-260414-gtd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/hooks/useDashboard.ts
  - web/src/__tests__/useDashboard.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Pace Trend chart shows pace computed from total_duration / total_distance per week, not an average of per-run pace values"
    - "Two runs with different distances in the same week produce a distance-weighted pace, not an arithmetic mean"
  artifacts:
    - path: "web/src/hooks/useDashboard.ts"
      provides: "Fixed groupRunsByWeek using totalDurationMinutes / totalDistance per bucket"
  key_links:
    - from: "groupRunsByWeek"
      to: "WeekBucket.avgPace"
      via: "totalDurationMinutes / totalDistance"
      pattern: "totalDurationMinutes.*totalDistance"
---

<objective>
Fix the Pace Trend chart to compute weekly average pace correctly.

Purpose: The current implementation averages raw per-run pace values (arithmetic mean), which
is mathematically wrong when runs have different distances. The correct formula is
total_duration_minutes / total_distance_km — this gives a distance-weighted pace that
reflects the actual effort across the week.

Example bug: two runs in one week — 5km @ 8:00/km (40min) and 10km @ 7:00/km (70min).
- Arithmetic mean of paces: (8.0 + 7.0) / 2 = 7.50 min/km (WRONG — equally weights both runs)
- Correct: (40 + 70) / (5 + 10) = 110 / 15 = 7.33 min/km (correct weighted pace)

Output: Fixed useDashboard.ts with updated tests covering weighted pace scenario.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix weekly pace aggregation in groupRunsByWeek</name>
  <files>web/src/hooks/useDashboard.ts, web/src/__tests__/useDashboard.test.ts</files>
  <behavior>
    - Test: two runs same week with equal distance/pace → avgPace equals that pace (sanity check)
    - Test: two runs same week with different distances (5km @ 8.0 min/km, 10km @ 7.0 min/km) → avgPace = (40+70)/(5+10) = 7.333... (NOT 7.5)
    - Test: run with duration "0:00" or zero distance → treated as 0 contribution, bucket avgPace is null if no valid runs
    - Test: single run in a week → avgPace equals that run's pace (total_duration / total_distance)
  </behavior>
  <action>
In `web/src/hooks/useDashboard.ts`, update `WeekBucket` and `groupRunsByWeek`:

1. Replace `paceValues: number[]` in `WeekBucket` with `totalDurationMinutes: number` and keep `distance` (already tracked).

2. In the per-run accumulation loop, instead of pushing to `paceValues`, accumulate:
   ```
   bucket.totalDurationMinutes += parseDurationToMinutes(run.duration)
   ```
   Remove the `if (run.pace && run.pace > 0) bucket.paceValues.push(run.pace)` block entirely.

3. When computing `avgPace` in the `.map()` after sorting, replace the arithmetic mean with:
   ```
   const avgPace = bucket.totalDurationMinutes > 0 && bucket.distance > 0
     ? bucket.totalDurationMinutes / bucket.distance
     : null
   ```

4. Export `groupRunsByWeek` (add `export` keyword) so the test file can import and test it directly. Also export the updated `WeekBucket` interface.

5. In `web/src/__tests__/useDashboard.test.ts`, add a `describe('groupRunsByWeek')` block with the four behavior tests above. The mock `Run` objects need: `date`, `distance`, `duration`, `pace` (pace value doesn't matter for the fix — the new code ignores it), and optionally `avgHR`. Use `duration` strings like `"40:00"` (40 min) and `"1:10:00"` (70 min).

Do NOT change `paceBpmData` HR averaging logic (still arithmetic mean of HR values — that is correct).
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm test -- --reporter=verbose useDashboard 2>&1 | tail -30</automated>
  </verify>
  <done>
    All useDashboard tests pass including the new groupRunsByWeek weighted-pace tests.
    Two runs of 5km@8:00/km and 10km@7:00/km in same week produce avgPace ≈ 7.333 (not 7.5).
  </done>
</task>

<task type="auto">
  <name>Task 2: Build verification</name>
  <files>web/src/hooks/useDashboard.ts</files>
  <action>
Run TypeScript build to confirm no type errors introduced by the WeekBucket interface change and the new export.

If build fails, fix any TypeScript errors — likely `paceValues` references that were not fully removed, or the `WeekBucket` export needing adjustment.
  </action>
  <verify>
    <automated>cd /c/dev/ai-running-coach/web && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>
    `npm run build` exits 0 with no TypeScript errors.
  </done>
</task>

</tasks>

<verification>
- `npm test` in `web/` passes all useDashboard tests
- `npm run build` in `web/` exits 0
- groupRunsByWeek uses `totalDurationMinutes / distance` not arithmetic mean of pace values
</verification>

<success_criteria>
Weekly pace in the Pace Trend chart is computed as total_duration_minutes / total_distance for the week, giving a distance-weighted average that correctly reflects multi-run weeks.
</success_criteria>

<output>
After completion, create `.planning/quick/260414-gtd-fix-pace-trend-chart-investigate-and-cor/260414-gtd-SUMMARY.md`
</output>
