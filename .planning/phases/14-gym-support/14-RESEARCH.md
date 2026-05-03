# Phase 14: Gym Support - Research

**Researched:** 2026-05-03
**Domain:** Multi-discipline UI adaptation, exercise data model, interactive checklist component, form field management, API field marshalling, coach context enrichment
**Confidence:** HIGH

## Summary

Phase 14 builds the first discipline-specific UI layer on top of Phase 13's foundational discipline data model. The phase introduces three user-facing features:

1. **Gym session logging** — Users can select "Gym" discipline when entering a session, which hides the distance field and shows duration+type fields instead.
2. **Exercise log attachment** — After logging a gym session, users can add exercises (name, sets, reps, weight) to the session and save them.
3. **Gym plan day rendering** — Days marked as `discipline: 'gym'` in the Training Plan display a structured exercise target list that users can check off or skip.

Additionally, **discipline-aware UI components** ship in Phase 14 because gym is the first new discipline that triggers them:

4. **Discipline badge on runs** — Each session in the Runs list shows a Run / Gym / Cycle badge.
5. **Discipline filter on Runs list** — Users can filter to show only Gym sessions (or Run, Cycle, All).
6. **Coach context enrichment** — The system prompt tells Claude to include gym sessions + exercise logs in the synthetic plan-state context during chat.

Phase 13 established that `discipline` is optional on Run and PlanDay documents (for backward compatibility with test fixtures). Phase 14 makes discipline *effectively required* in the UI — the session entry form forces users to select a discipline, and new runs/plan days always have it.

**Primary recommendation:** Implement discipline selection as a first-class form control that gates what fields are shown. Use conditional rendering (not hidden fields) so field validation aligns with visible inputs. Store exercise logs as a new subdocument array on the Run document. Render gym plan day exercise targets as a collapsible section in PlanView with checkboxes for tracking completion (but NOT actually marking the day complete — that happens only when the session is logged and linked).

---

<user_constraints>
## User Constraints

No CONTEXT.md file exists for this phase. All research is conducted under Claude's discretion to discover optimal implementation patterns.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GYM-01 | User can log a gym session with date, type, duration, notes (no distance) | Discipline selector gates visible fields in RunEntryForm; POST /api/runs accepts discipline; type is a new enum value for sessions |
| GYM-02 | User can add exercises (name, sets, reps, weight) to a gym session and save | Exercise subdocument array on Run; new UI component for exercise entry; API endpoint or PATCH to save exercises |
| GYM-03 | Gym plan days display exercise targets (name, sets, reps, weight) | PlanDay.exercises array structure; PlanView renders exercise list; Phase 13 allows discipline in <plan:add> tags |
| GYM-04 | User can mark exercises done/skipped from plan view | Checkbox UI in PlanView exercise list; PATCH /api/plan/days to update exercise.completed/skipped |
| GYM-05 | Coach can generate gym plan days via <plan:add> / <plan:update> | System prompt updated in Phase 13; handlers already accept discipline; no new XML tags needed |
| GYM-06 | Coach receives gym session history (exercise log) in chat context | Synthetic plan-state context in chat.ts enriched with exercise log from linked runs |
| DISC-03 | Session log form adapts displayed fields based on discipline | RunEntryForm discipline selector hides/shows distance field; conditional field validation |
| DISC-04 | Runs list shows discipline badge per session | New RunBadge component or Badge variant showing Run/Gym/Cycle icon + text |
| DISC-05 | User can filter Runs list by discipline | Dropdown or tabs in Runs page header; filter applied to API query string |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2.0+ | UI rendering, hooks for form state | Already in project for all web components |
| TypeScript | 5.9.3 | Type-safe exercise data model, form validation | Project language |
| Tailwind CSS | 3.4.1 | Layout, badges, responsive design | Already in project for all styling |
| MongoDB | 7.1.0 | Storing exercise subdocuments on Run; PlanDay.exercises array | Already the project DB driver |

### Supporting (existing patterns, no new packages)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 3.x | Unit tests for API endpoints, form components | Testing discipline filters, exercise CRUD, badge rendering |
| @testing-library/react | Latest | Component testing for RunEntryForm, badge, filter UI | Testing form field visibility based on discipline selection |

**Installation:** No new packages required. All dependencies already present in the codebase.

---

## Architecture Patterns

### Recommended Project Structure

```
api/src/
├── shared/
│   ├── types.ts           # ADD Exercise interface, extend Run + PlanDay
│   └── prompts.ts         # UPDATE system prompt with exercise context enrichment
├── functions/
│   ├── runs.ts            # EXTEND to handle exercise array on POST/PATCH
│   └── chat.ts            # UPDATE synthetic plan-state context to include exercises
└── __tests__/
    ├── runs.test.ts        # ADD exercise field tests
    └── chat.test.ts        # ADD exercise context injection tests

web/src/
├── components/
│   ├── runs/
│   │   ├── RunEntryForm.tsx        # ADD discipline selector; hide/show distance based on discipline
│   │   ├── ExerciseForm.tsx        # NEW: mini form for adding single exercise
│   │   ├── ExerciseList.tsx        # NEW: displays and manages exercises on logged run
│   │   └── RunBadge.tsx            # NEW: discipline icon + label (Run/Gym/Cycle)
│   └── plan/
│       ├── PlanView.tsx            # UPDATE DayRow rendering for gym plan days
│       └── ExerciseChecklistItem.tsx # NEW: exercise row with checkboxes for plan view
├── pages/
│   └── Runs.tsx                     # ADD discipline filter dropdown/tabs
└── __tests__/
    ├── RunEntryForm.test.tsx        # UPDATE for discipline selector + conditional fields
    └── Runs.test.tsx                # ADD discipline filter tests
```

### Pattern 1: Discipline-Gated Form Fields

When the user selects a discipline in RunEntryForm, different fields become required and visible:

```typescript
// In RunEntryForm.tsx
const [discipline, setDiscipline] = useState<'run' | 'gym' | 'cycle'>('run');

// Conditional rendering by discipline
{discipline === 'run' && (
  <>
    <DistanceInput ... />  {/* required for run */}
    <PaceDisplay ... />
  </>
)}

{discipline === 'gym' && (
  <>
    <TypeSelect options={['upper body', 'lower body', 'full body', 'other']} />  {/* required for gym */}
    {/* NO distance field */}
  </>
)}

{discipline === 'cycle' && (
  <>
    <DistanceInput ... />  {/* required for cycle */}
    <SpeedDisplay ... />   {/* speed instead of pace */}
  </>
)}

{/* Always present */}
<DurationInput ... />  {/* required for all disciplines */}
```

**Key insight:** Do NOT use hidden fields (display: none). That breaks form validation — users may submit without filling required fields. Use conditional rendering so the form only validates what's visible.

### Pattern 2: Exercise Data Model

On the Run document, exercises are stored as a new optional subdocument array:

```typescript
// In api/src/shared/types.ts
export interface Exercise {
  name: string;         // "Bench Press", "Squat", etc.
  sets: number;         // 3
  reps: number;         // 8
  weight?: number;      // 185 (optional — body weight exercises have no weight)
  unit?: 'lbs' | 'kg';  // weight unit (if weight present)
  completed?: boolean;  // for plan day exercises
  skipped?: boolean;    // for plan day exercises
}

// Extend Run interface
export interface Run {
  // ... existing fields ...
  exercises?: Exercise[];  // NEW — present only on gym sessions
}

// Extend PlanDay interface
export interface PlanDay {
  // ... existing fields ...
  exercises?: Exercise[];  // NEW — present only on gym plan days
}
```

**Why subdocument not separate collection:** Exercises are always tied to a specific run or plan day — they are not queried independently. A subdocument array is simpler than a separate collection with foreign keys, matches the existing `PlanDay.days` pattern, and keeps the run document self-contained (easier for migration and archival).

### Pattern 3: Exercise Entry & Linking Workflow

After a gym session is logged, a modal appears allowing the user to add exercises:

1. **Log run first** → RunEntryForm saves the run with `discipline: 'gym'`, calls `onSave(run)`.
2. **Modal appears** → Shows ExerciseForm (mini form for name, sets, reps, weight).
3. **User adds exercises** → Click "+" button, fills form, clicks Save. Each save appends to a local `exercises[]` array in the modal state.
4. **User confirms all exercises** → Click "Confirm" or "Done" button. Modal calls a new API endpoint or PATCH `/api/runs/:id` to save the array.

Alternatively (simpler): The run is saved without exercises, and a new section appears on the run detail modal showing "Add Exercise" buttons. Users can edit the run's exercise list inline. This avoids a modal-within-modal pattern.

**Recommendation:** Use the inline approach (edit exercises on the run detail modal). Simpler UX, fewer modals.

### Pattern 4: Gym Plan Day Rendering

In PlanView, a gym plan day (identified by `day.discipline === 'gym'`) renders an expandable exercise target section:

```typescript
// In DayRow or a new GymDayRow component
{day.discipline === 'gym' ? (
  <>
    <div className="font-medium">{day.label}: {day.guidelines}</div>
    <button onClick={() => setExpandedExercises(!expandedExercises)}>
      ▼ Exercises (expand)
    </button>
    {expandedExercises && day.exercises && (
      <div className="pl-4 space-y-2">
        {day.exercises.map((ex, i) => (
          <ExerciseChecklistItem
            key={i}
            exercise={ex}
            onCheck={() => handleExerciseCheck(day, ex, true)}
            onSkip={() => handleExerciseCheck(day, ex, false)}
          />
        ))}
      </div>
    )}
  </>
) : (
  <DayRow ... />  // existing run/cycle rendering
)}
```

**Key insight:** Checking off an exercise does NOT mark the plan day as complete. Completion only happens when the user logs a run and links it to the day. The checkboxes are visual progress tracking for the user. The `completed` and `skipped` flags on Exercise are stored in the plan day subdocuments (not visible to user initially, but settable if we add "Mark day as completed" from the checklist — Phase 14 scope is TBD).

### Pattern 5: Discipline Badge in Runs List

A new `<RunBadge discipline="gym" />` component shows next to each run's name:

```typescript
// In Runs.tsx or RunRow component
<RunBadge discipline={run.discipline ?? 'run'} />

// RunBadge.tsx
function RunBadge({ discipline }: { discipline: 'run' | 'gym' | 'cycle' }) {
  const icon = discipline === 'run' ? '🏃' : discipline === 'gym' ? '💪' : '🚴';
  const label = discipline === 'run' ? 'Run' : discipline === 'gym' ? 'Gym' : 'Cycle';
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      {icon} {label}
    </span>
  );
}
```

### Pattern 6: Discipline Filter on Runs Page

Add a filter dropdown or tab bar at the top of the Runs page:

```typescript
// In Runs.tsx
const [disciplineFilter, setDisciplineFilter] = useState<'all' | 'run' | 'gym' | 'cycle'>('all');

// Pass to fetch:
const params = new URLSearchParams();
if (disciplineFilter !== 'all') params.append('discipline', disciplineFilter);
const runs = await fetchRuns(params);

// UI: Tab bar or dropdown
<div className="flex gap-2">
  {['all', 'run', 'gym', 'cycle'].map(d => (
    <button
      key={d}
      onClick={() => setDisciplineFilter(d as any)}
      className={disciplineFilter === d ? 'text-blue-600 font-bold' : 'text-gray-600'}
    >
      {d === 'all' ? 'All' : d === 'run' ? 'Runs' : d === 'gym' ? 'Gym' : 'Cycling'}
    </button>
  ))}
</div>
```

### Pattern 7: Coach Context — Exercise Log in Synthetic Plan State

The system prompt tells Claude to reference exercises when giving feedback. The synthetic plan-state context in `chat.ts` needs to enrich completed days with linked run data including exercise logs:

```typescript
// In chat.ts buildSyntheticPlanContext (existing pattern for runs, extend for exercises)
// Existing pattern:
// `Week 1 Day A [COMPLETED]: 5km — Easy run | Ran: 05/01/2026, 5.2km @ 5:10/km | Notes: felt great`

// NEW for gym days with exercises:
// `Week 2 Day B [COMPLETED]: Strength | Gym session 05/02/2026 | Exercises: Bench Press 3x8 @ 185lbs, Squat 3x5 @ 315lbs | Notes: strong day`

// Implementation: when enriching with run data, check if run.exercises exists and format as comma-separated list
```

### Anti-Patterns to Avoid

- **Hardcoding gym field list in RunEntryForm:** If cycle support arrives in Phase 15, a third discipline with different fields will require re-editing. Instead, define a `DISCIPLINE_FIELDS` map: `{ run: ['distance', 'pace'], gym: ['type'], cycle: ['distance', 'speed'] }` and iterate.
- **Storing exercises in a separate `exercises` collection:** Exercises belong to a run context; a subdocument keeps them together and simplifies cascading deletes (if a run is deleted, exercises go with it).
- **Making exercise.unit required:** Some exercises (push-ups, pull-ups) have no weight. Make `weight` and `unit` both optional.
- **Allowing users to edit exercises on a linked run:** If a run is linked to a plan day, its exercises are locked (or editable but don't auto-sync to the plan day target). Clarify the contract in Phase 14 planning.
- **Rendering exercise checklist in modal instead of inline:** Avoid nested modals. Show exercise checklist expansion inline in PlanView.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exercise validation | Custom regex for sets/reps | TypeScript type + number input `min="1"` | HTML5 number input handles parsing and validation |
| Form field conditional rendering | Manual show/hide with CSS display | React conditional (ternary/&&) | Cleaner code; avoids validation confusion with hidden fields |
| Discipline filter query building | Manual URL string concatenation | URLSearchParams API | Automatic encoding; handles missing values |
| Exercise data migration | One-off cursor script | Not needed in Phase 14 | Exercises only exist on new runs; no pre-existing data to migrate |

**Key insight:** Exercise data is additive (new field on new documents). No historical migration needed until Phase 15 adds cycling (and even then, only if cycling uses exercises — Phase 15 spec is TBD).

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | No existing gym or cycle sessions (first time introducing exercises) | None — exercises only on new sessions; no data migration needed |
| Live service config | None — no external services track exercise data | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars needed | None |
| Build artifacts | None — no compiled binaries affected by gym session field changes | None |

**No migrations needed.** Exercises are a new field on new documents only.

---

## Common Pitfalls

### Pitfall 1: Validating Hidden Fields

**What goes wrong:** RunEntryForm uses `display: none` to hide the distance field when `discipline === 'gym'`. User submits the form. TypeScript validation requires distance, but it was hidden, so the error message is confusing (field is invisible but form says it's required).

**Why it happens:** CSS hiding doesn't prevent form submission; validation still expects the field.

**How to avoid:** Use conditional rendering (JSX `{discipline === 'run' && <Distance .../>}`) not `display: none`. The field doesn't exist in the DOM, so validation naturally skips it.

**Warning signs:** Users report form won't submit, but when they inspect, distance field is empty and hidden.

### Pitfall 2: Exercise `unit` Defaulting to 'lbs'

**What goes wrong:** A user logs a gym session and adds a body-weight exercise (push-ups, pull-ups) that has no weight. The API defaults `unit: 'lbs'` when weight is absent, resulting in saved exercise like `{ name: 'Pull-ups', sets: 3, reps: 8, weight: undefined, unit: 'lbs' }`. Later, the UI displays `"Pull-ups 3x8 @ lbs"` (weird).

**Why it happens:** The Exercise interface makes `weight` optional but `unit` required. Someone defaulted it.

**How to avoid:** Make BOTH optional: `weight?: number; unit?: 'lbs' | 'kg'`. Only show unit UI when weight is provided.

**Warning signs:** Body-weight exercises display with a unit but no weight value.

### Pitfall 3: Plan Day Exercise Completion vs. Run Linking

**What goes wrong:** User expands the gym plan day exercise list and checks off "Bench Press 3x8 @ 185lbs". The checkbox is now checked. Later, the user logs a different gym session (different date, different exercises) and links it to the same plan day. The plan day now shows the newly-logged exercises, but the "Bench Press" checkbox is still checked from before, which is now incorrect/confusing.

**Why it happens:** Exercise.completed is stored on the plan day subdocument, but it's decoupled from the actual logged run's exercises.

**How to avoid:** In Phase 14, define clearly: do checkboxes on gym plan day exercise list represent "user intends to do this exercise" (a reminder/plan) or "user has completed this exercise in a logged run"? Recommendation: they represent intent. When a run is linked, the UI shows which exercises from the logged run matched the plan targets, but doesn't auto-check the plan's checkboxes. The user still needs to manually track (or we compute matches in Phase 16 with a "compare exercises" feature).

**Warning signs:** After linking a run, plan day exercises show old checkmarks.

### Pitfall 4: Exercise Array Grows Without Limit

**What goes wrong:** User logs a gym session, adds 30 exercises to it (mistakes, typos, repeated adds). The Run document balloons in size. MongoDB has a 16MB document size limit. Although 30 exercises won't hit this limit immediately, it's an unbounded growth risk.

**Why it happens:** No UI prevents adding duplicates or enforces a reasonable limit.

**How to avoid:** In the ExerciseForm modal/section, deduplicate by name (warn if user tries to add "Bench Press" twice), and set a practical limit (e.g., max 20 exercises per session, show a warning at 15). These are UX guardrails, not strict API limits.

**Warning signs:** Very large run documents in the database; slow queries.

### Pitfall 5: Discipline Filter Not Persisted

**What goes wrong:** User filters Runs to show only "Gym" sessions. They navigate away (to Dashboard, to Plan) and return to Runs. The filter has reset to "All". Frustrating.

**Why it happens:** Filter state is only in React component state, not persisted to URL or localStorage.

**How to avoid:** Store filter in URL query parameter (`?discipline=gym`). When Runs page mounts, read from URL. When filter changes, update URL via `useNavigate` or `window.location`. This gives users a shareable URL and persists across navigation.

**Warning signs:** Users report filter resets.

### Pitfall 6: Missing `type` Value on Gym Session

**What goes wrong:** Coach emits `<plan:add week="2" day="B" type="cross-train" discipline="gym" guidelines="Upper body" />`. Later, a user tries to log a gym session matching this plan day. The form has a "Type" dropdown (upper body, lower body, full body, other) but there's no initial value to suggest which type was planned.

**Why it happens:** The plan day stores guidelines and exercise targets, but not the user's intended session type.

**How to avoid:** Add an optional `sessionType` or `type` field to PlanDay for gym days (separate from the day's `type` which remains 'run'/'cross-train'/'rest'). When emitting `<plan:add type="cross-train" discipline="gym" sessionType="upper body" ...>`, the system prompt includes the field. The RunEntryForm shows the gym plan day's suggested type when linking.

**Warning signs:** Coach describes a "lower body" day, but the user has no hint when logging the run.

---

## Code Examples

### Exercise Data Model (TypeScript)

```typescript
// Source: Phase 14 types.ts — extend existing Run and PlanDay interfaces
export interface Exercise {
  name: string;         // "Bench Press", "Squat", etc.
  sets: number;         // 3
  reps: number;         // 8
  weight?: number;      // 185
  unit?: 'lbs' | 'kg';  // weight unit
  completed?: boolean;  // for plan day exercises only
  skipped?: boolean;    // for plan day exercises only
}

// Extend Run interface (add at the end before closing brace):
export interface Run {
  // ... existing fields ...
  exercises?: Exercise[];  // optional — only on gym sessions
}

// Extend PlanDay interface:
export interface PlanDay {
  // ... existing fields ...
  exercises?: Exercise[];  // optional — only on gym plan days
}
```

### Discipline-Gated Form Fields

```typescript
// Source: Phase 14 RunEntryForm.tsx — conditional rendering pattern
export function RunEntryForm({ weekNumber, dayLabel, dayGuidelines, onSave, onCancel }: RunEntryFormProps) {
  const [discipline, setDiscipline] = useState<'run' | 'gym' | 'cycle'>('run');
  const [date, setDate] = useState(todayISO());
  const [distance, setDistance] = useState('');
  const [type, setType] = useState('upper body');  // for gym
  const [duration, setDuration] = useState('');
  const [avgHR, setAvgHR] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    // Validate only fields visible for the selected discipline
    if (discipline === 'run' && (!distance || parseFloat(distance) <= 0)) {
      setError('Distance required for runs');
      return;
    }
    if (discipline === 'gym' && !type) {
      setError('Session type required for gym');
      return;
    }
    // All disciplines require date and duration
    if (!isValidDate(date) || !duration.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      setError('Please fill in date and duration');
      return;
    }

    const run = await createRun({
      date,
      distance: discipline === 'run' ? parseFloat(distance) : undefined,
      duration,
      discipline,
      type: discipline === 'gym' ? type : undefined,
      avgHR: avgHR ? parseInt(avgHR, 10) : undefined,
      notes: notes || undefined,
      weekNumber,
      dayLabel,
    });
    onSave(run);
  };

  return (
    <div className="space-y-3">
      {/* Discipline Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Discipline</label>
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value as any)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
        >
          <option value="run">Run</option>
          <option value="gym">Gym</option>
          <option value="cycle">Cycling</option>
        </select>
      </div>

      {/* Date — always shown */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
        <DateInput value={date} onChange={setDate} ... />
      </div>

      {/* Discipline-specific fields */}
      {discipline === 'run' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Distance (km)</label>
          <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} ... />
        </div>
      )}

      {discipline === 'gym' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Session Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="...">
            <option value="upper body">Upper Body</option>
            <option value="lower body">Lower Body</option>
            <option value="full body">Full Body</option>
            <option value="other">Other</option>
          </select>
        </div>
      )}

      {discipline === 'cycle' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Distance (km)</label>
          <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} ... />
        </div>
      )}

      {/* Duration — always shown */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
        <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45:30" ... />
      </div>

      {/* Avg HR — always shown */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Avg HR (optional)</label>
        <input type="number" value={avgHR} onChange={(e) => setAvgHR(e.target.value)} ... />
      </div>

      {/* Notes — always shown */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} ... />
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={!isValid} className="...">Save Session</button>
    </div>
  );
}
```

### Discipline Badge Component

```typescript
// Source: Phase 14 RunBadge.tsx — new component
import type { Discipline } from '../../hooks/useRuns';

interface RunBadgeProps {
  discipline: Discipline;
}

export function RunBadge({ discipline }: RunBadgeProps) {
  const badges = {
    run: { icon: '🏃', label: 'Run', color: 'bg-blue-100 text-blue-700' },
    gym: { icon: '💪', label: 'Gym', color: 'bg-orange-100 text-orange-700' },
    cycle: { icon: '🚴', label: 'Cycling', color: 'bg-green-100 text-green-700' },
  };

  const badge = badges[discipline];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
}
```

### API: Extend createRun to Accept Exercise Array

```typescript
// Source: Phase 14 runs.ts — extend existing createRun handler
// After the discipline field acceptance (already in Phase 13), add exercise handling:

let body: {
  // ... existing fields ...
  discipline?: string;
  exercises?: Array<{ name: string; sets: number; reps: number; weight?: number; unit?: string }>;
};

// ... after creating newRun ...

if (body.exercises !== undefined && body.exercises.length > 0) {
  // Validate exercise array (basic checks: name, sets, reps are numbers > 0)
  const validExercises = body.exercises.filter(
    (ex) => ex.name && typeof ex.sets === 'number' && ex.sets > 0 && typeof ex.reps === 'number' && ex.reps > 0
  );
  if (validExercises.length > 0) {
    newRun.exercises = validExercises as Exercise[];
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single discipline (run only) | Multi-discipline with adaptive UI | Phase 13 foundation; Phase 14 realization | Form fields, badges, filters now vary by discipline |
| Distance + Pace for all sessions | Distance/Pace for run, Duration/Type for gym, Distance/Speed for cycle | Phase 14 gym, Phase 15 cycle | UI must detect discipline and show appropriate fields |
| No session type tracking | Session type stored for gym/cycle (upper/lower/full body for gym, not yet for cycle) | Phase 14 for gym | Enables coaches to recommend balanced training load |

---

## Open Questions

1. **Should gym sessions store a sessionType field, or just use guidelines?**
   - What we know: Plan day has `guidelines` (text). Coach can write "Upper body strength day" there.
   - What's unclear: Is a structured `type: 'upper body' | 'lower body' | 'full body'` field needed for reporting/filtering?
   - Recommendation: Add optional `type` field to Run for gym/cycle sessions. Simple enum, enables filtering and dashboard stats ("X upper body days completed"). Keep it optional for runs without discipline (backward compat).

2. **When a user logs a gym session and later links it to a plan day with different exercises, what should happen?**
   - What we know: Plan day has exercise targets (e.g., Bench Press 3x8). User logs a session with actual exercises (e.g., Incline Press 3x8).
   - What's unclear: Do we show a comparison? Assume user accomplished the goal even though exercise names differ? Ignore the mismatch?
   - Recommendation: Phase 14 leaves this as user responsibility (no auto-matching). Phase 16 could add a "Compare to plan" feature if needed.

3. **Should the exercise list on a gym plan day show checkboxes for marking exercises complete, or just informational targets?**
   - What we know: Phase 14 scope says "User can tap a checkbox next to each exercise target to mark it done or skip it" (GYM-04).
   - What's unclear: Does marking a checkbox change the plan day's completion status? Or just track user's intent to do that exercise?
   - Recommendation: Checkboxes track user's intent / progress reminder (like a checklist). They do NOT mark the plan day complete. Completion happens only when the user logs a run and links it. This keeps the plan day state clean and decoupled from checkbox state.

4. **API design: Should exercises be saved in a separate PATCH call after run creation, or bundled in POST /api/runs?**
   - What we know: POST /api/runs creates the run document.
   - What's unclear: User might add exercises one-by-one in a modal after creation. Do we PATCH /api/runs/:id multiple times? Or collect all exercises and PATCH once? Or POST them individually to a separate endpoint?
   - Recommendation: Collect all exercises in a modal, then PATCH /api/runs/:id once with the full array. Fewer API round-trips, simpler error handling.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API runtime | ✓ | 24.14.0 | — |
| React | Web frontend | ✓ | 18.2.0+ | — |
| MongoDB | Exercise storage | ✓ | Existing instance | — |
| Tailwind CSS | UI styling | ✓ | 3.4.1 | — |

All dependencies are already available. No new external tools or services required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 3.x + @testing-library/react |
| Config file | `api/vitest.config.ts`, `web/vite.config.ts` (with vitest plugin) |
| Quick run command | `cd api && npm test` + `cd web && npm test` |
| Full suite command | `cd api && npm test && cd ../web && npm test && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GYM-01 | RunEntryForm hides distance field when discipline is "gym" | unit | `cd web && npm test -- RunEntryForm.test.tsx` | ✅ extend existing |
| GYM-01 | POST /api/runs accepts type field when discipline is "gym" | unit | `cd api && npm test -- runs.test.ts` | ✅ extend existing |
| GYM-02 | Exercise array can be POSTed with run creation | unit | `cd api && npm test -- runs.test.ts` | ✅ extend existing |
| GYM-02 | PATCH /api/runs/:id accepts and updates exercises array | unit | `cd api && npm test -- runs.test.ts` | ✅ extend existing |
| GYM-02 | ExerciseForm renders input fields for name, sets, reps, weight | unit | `cd web && npm test -- ExerciseForm.test.tsx` | ✅ Wave 0 new file |
| GYM-03 | PlanView renders exercise targets for gym plan days | unit | `cd web && npm test -- PlanView.test.tsx` | ✅ extend existing |
| GYM-04 | Clicking exercise checkbox updates exercise.completed flag | unit | `cd web && npm test -- ExerciseChecklistItem.test.tsx` | ✅ Wave 0 new file |
| GYM-04 | PATCH /api/plan/days/:week/:day accepts exercise[].completed/skipped | unit | `cd api && npm test -- planDays.test.ts` | ✅ extend existing |
| GYM-06 | Chat context includes exercise log for linked gym runs | unit | `cd api && npm test -- chat.test.ts` | ✅ extend existing |
| DISC-03 | RunEntryForm conditional rendering hides/shows distance for all disciplines | unit | `cd web && npm test -- RunEntryForm.test.tsx` | ✅ extend existing |
| DISC-04 | RunBadge displays discipline icon and label | unit | `cd web && npm test -- RunBadge.test.tsx` | ✅ Wave 0 new file |
| DISC-05 | Runs page discipline filter updates API query and re-fetches | unit | `cd web && npm test -- Runs.test.tsx` | ✅ extend existing |

### Sampling Rate

- **Per task commit:** `cd api && npm test` + `cd web && npm test`
- **Per wave merge:** Full API + Web test suite + TypeScript build check
- **Phase gate:** Full suite (`api`, `web`, Playwright) green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `web/src/components/runs/ExerciseForm.tsx` — Exercise entry form component
- [ ] `web/src/components/runs/ExerciseList.tsx` — Exercise list display with edit/delete
- [ ] `web/src/components/runs/RunBadge.tsx` — Discipline badge component
- [ ] `web/src/components/plan/ExerciseChecklistItem.tsx` — Exercise row with checkboxes for plan view
- [ ] `web/src/__tests__/ExerciseForm.test.tsx` — Tests for exercise form
- [ ] `web/src/__tests__/ExerciseChecklistItem.test.tsx` — Tests for plan exercise checkboxes
- [ ] `web/src/__tests__/RunBadge.test.tsx` — Tests for discipline badge
- [ ] API PATCH /api/runs/:id handler extension — accept exercise array updates
- [ ] API tests for exercise CRUD — extend `runs.test.ts`
- [ ] Chat context test updates — extend `chat.test.ts` to inject exercise logs

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md apply to this phase:

- **No discipline default injection at API layer** — Phase 14 requires users to select discipline in UI; if they don't, the run is created without it until they re-submit. The API does not inject `discipline: 'run'` as a default. Phase 13 migration covers historical data.
- **MongoDB DB name derived from connection string** — all DB operations use `getDb()`, never hardcode 'running-coach'
- **Feature branch required** — `git checkout -b feature/phase-14-gym-support` before starting
- **All interactive elements must have `cursor-pointer`** — Discipline selector dropdown, exercise checkboxes, filter tabs all get `cursor-pointer` class
- **E2E tests are mandatory** — All UI features must be testable in Playwright (selecting discipline, adding exercises, filtering by discipline)
- **`npm run build` in web/ required before committing** — TypeScript build must pass for all new components
- **Tests are part of execution** — All Unit, Integration, E2E must be green before phase completion

---

## Sources

### Primary (HIGH confidence)

- **Phase 13 RESEARCH.md** — Confirmed discipline field optional on Run/PlanDay; Phase 13 completes data model foundation
- **Phase 13 code review** — Confirmed types.ts, migration.ts, runs.ts, planDays.ts patterns in production
- **CLAUDE.md** — Confirmed architecture constraints (MongoDB, Feature branches, cursor-pointer, E2E tests, build checks)
- **Codebase direct reading:**
  - `web/src/components/runs/RunEntryForm.tsx` — Confirmed existing form structure and field patterns
  - `web/src/components/plan/PlanView.tsx` — Confirmed day rendering pattern (DayRow component)
  - `api/src/functions/runs.ts` — Confirmed POST/PATCH handler patterns for optional fields
  - `api/src/functions/planDays.ts` — Confirmed plan day PATCH pattern with arrayFilters
  - `api/src/shared/types.ts` — Confirmed Run/PlanDay interface shapes; Exercise interface not yet added

### Secondary (MEDIUM confidence)

- **MongoDB documentation (training data)** — `updateMany` with nested arrayFilters for subdocument updates; well-established pattern since MongoDB 3.6

### Tertiary (LOW confidence)

- None — all critical patterns verified directly from codebase

---

## Metadata

**Confidence breakdown:**

- **Standard Stack: HIGH** — All required libraries already installed; no new dependencies
- **Architecture: HIGH** — Patterns directly observed in Phase 13 and existing codebase; form field gating is standard React practice
- **Data Model: HIGH** — Exercise subdocument array follows established Run/PlanDay structure
- **Pitfalls: MEDIUM** — Identified through code reading and common UI/form mistakes; discipline filter persistence (Pitfall 5) is a discovered pattern, not strictly phase-blocking but valuable to avoid
- **API Design: MEDIUM** — Exercise PATCH approach is inferential from existing patterns but not directly verified (Phase 14 planner will clarify)

**Research date:** 2026-05-03
**Valid until:** 2026-05-17 (2 weeks — Phase 14 shipping soon; stack is stable)

