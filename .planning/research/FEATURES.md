# Feature Landscape: AI Running Coach

**Domain:** Personal AI coaching web app — goal-based running training, Apple Health data ingestion, conversational AI feedback
**Researched:** 2026-03-21
**Confidence:** HIGH (Apple Health XML schema, running periodization, coaching UX — well-established domain with stable patterns)

---

## 1. Apple Health Export Data Points

### What the Export Contains

Apple Health exports a ZIP archive. The relevant file is `export.xml`. The XML structure for a running workout looks like this:

```xml
<Workout
  workoutActivityType="HKWorkoutActivityTypeRunning"
  duration="3542.8"
  durationUnit="min"
  totalDistance="10.02"
  totalDistanceUnit="km"
  totalEnergyBurned="612.4"
  totalEnergyBurnedUnit="Cal"
  sourceName="Apple Watch"
  sourceVersion="9.0"
  device="..."
  creationDate="2024-11-03 07:14:32 -0700"
  startDate="2024-11-03 07:14:32 -0700"
  endDate="2024-11-03 08:03:54 -0700">

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierHeartRate"
    startDate="..."
    endDate="..."
    average="148"
    minimum="102"
    maximum="174"
    unit="count/min"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierDistanceWalkingRunning"
    startDate="..."
    endDate="..."
    sum="10.02"
    unit="km"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierActiveEnergyBurned"
    startDate="..."
    endDate="..."
    sum="612.4"
    unit="Cal"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierBasalEnergyBurned"
    startDate="..."
    endDate="..."
    sum="87.2"
    unit="Cal"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierRunningPower"
    startDate="..."
    endDate="..."
    average="248"
    unit="W"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierRunningGroundContactTime"
    startDate="..."
    endDate="..."
    average="245"
    unit="ms"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierRunningStrideLength"
    startDate="..."
    endDate="..."
    average="1.24"
    unit="m"/>

  <WorkoutStatistics
    type="HKQuantityTypeIdentifierRunningVerticalOscillation"
    startDate="..."
    endDate="..."
    average="8.2"
    unit="cm"/>

  <WorkoutRoute ... />  <!-- GPX data reference, in workout-routes/ folder -->
</Workout>
```

Additionally, the export contains `Record` elements spread throughout the file (not nested in `Workout`) that provide time-series data for the workout window:

```xml
<Record
  type="HKQuantityTypeIdentifierHeartRate"
  unit="count/min"
  value="152"
  sourceName="Apple Watch"
  startDate="2024-11-03 07:14:32 -0700"
  endDate="2024-11-03 07:14:32 -0700"/>

<Record
  type="HKQuantityTypeIdentifierStepCount"
  unit="count"
  value="..."
  .../>

<Record
  type="HKQuantityTypeIdentifierRunningSpeed"
  unit="m/s"
  value="2.84"
  .../>
```

### Fields That Actually Matter for AI Coaching

| Field | Source | Coaching Value | Priority |
|-------|--------|---------------|----------|
| `duration` | Workout element | Base metric for all workouts | Critical |
| `totalDistance` (km/mi) | Workout element | Volume tracking, pace calculation | Critical |
| `startDate` / `endDate` | Workout element | Matches to plan day | Critical |
| Heart rate avg/min/max | WorkoutStatistics | Effort level, aerobic vs anaerobic | Critical |
| `HKQuantityTypeIdentifierRunningSpeed` | Record time-series | Per-km/mi pace, even pacing, fade detection | Critical |
| `totalEnergyBurned` | Workout element | Recovery load approximation | High |
| Step count (cadence proxy) | Record time-series | Running efficiency signal | High |
| `RunningGroundContactTime` | WorkoutStatistics | Form quality, injury risk indicator | Medium |
| `RunningStrideLength` | WorkoutStatistics | Running economy indicator | Medium |
| `RunningVerticalOscillation` | WorkoutStatistics | Efficiency, bouncing gating | Medium |
| `RunningPower` | WorkoutStatistics | Effort independent of terrain | Medium |
| `workoutActivityType` | Workout element | Filter to HKWorkoutActivityTypeRunning | Critical |
| `sourceName` | Workout element | Apple Watch vs iPhone (GPS accuracy differs) | Low |
| Elevation gain | WorkoutRoute / separate Record | Context for pace interpretation | Medium |

### Heart Rate Zones — Derived, Not Stored

Apple Health does NOT store heart rate zone distributions in the export. Zones must be computed from the HR time-series records during the workout window, using the user's max HR (220 - age, or ideally a tested max). The standard 5-zone model:

| Zone | % Max HR | Coaching Label |
|------|----------|---------------|
| Z1 | <60% | Recovery |
| Z2 | 60-70% | Aerobic base (most long runs should be here) |
| Z3 | 70-80% | Tempo/threshold |
| Z4 | 80-90% | Lactate threshold, hard efforts |
| Z5 | >90% | VO2max, race pace, sprints |

### Computed Metrics Worth Deriving

These are not stored directly but are extremely valuable for coaching:

- **Average pace** — distance / duration, in min/km or min/mi
- **Pace distribution** — from RunningSpeed time-series: did they start too fast? fade badly?
- **Cadence** — step count / (2 * duration_minutes), typical target 170-180 spm
- **HR zones distribution** — from HR Records filtered to workout window
- **Aerobic decoupling** — did HR drift upward while pace held? Signals aerobic fitness or heat
- **Effort vs plan target** — actual pace vs planned pace for the session type

### What to Ignore in v1

- `WorkoutRoute` / GPX data — parsing GPX is scope creep; elevation context can be asked via chat
- `HKQuantityTypeIdentifierVO2Max` — present but requires careful calibration; out of scope for v1
- Sleep data, HRV, resting HR — valuable but adds complexity; defer to later milestone
- `sourceVersion`, `device` attributes — not coaching-relevant
- Records with `type` outside the running domain (blood oxygen, weight, etc.)

---

## 2. Training Plan Structure

### Periodization Fundamentals

Every evidence-based running plan follows a periodized structure. The key principle: stress + recovery = adaptation. Weekly mileage should increase by no more than 10% per week (the "10% rule") with a recovery week (drop ~20-30% volume) every 3-4 weeks.

### Standard Phases

| Phase | Duration | Purpose | Key Sessions |
|-------|----------|---------|-------------|
| **Base building** | 4-8 weeks | Aerobic foundation, connective tissue adaptation | Easy runs, long run, optional strides |
| **Build** | 4-8 weeks | Introduce quality work, increase volume | Tempo runs, progression runs, long run |
| **Peak / Race specific** | 2-4 weeks | Event-specific fitness, sustain max volume | Intervals, race-pace work, long runs with race-pace segments |
| **Taper** | 1-3 weeks | Fatigue shedding, arrive fresh | Reduced volume (30-50%), maintained intensity, short tune-up race |
| **Race week** | 1 week | Arrive rested | Very short easy runs, rest |

### Session Types — What Every Plan Contains

| Session Type | Training Label | Purpose | Typical Pace Target |
|-------------|---------------|---------|---------------------|
| Easy run | "Easy" | Aerobic base, recovery | Z1-Z2, conversational |
| Long run | "Long" | Endurance, fat adaptation | Easy/conversational, Z2 |
| Tempo run | "Tempo" | Lactate threshold | Z3-Z4, "comfortably hard" |
| Interval | "Intervals" | VO2max, speed | Z4-Z5, hard effort |
| Progression run | "Progression" | Teaches pace control, builds fitness | Starts easy, finishes at tempo |
| Fartlek | "Fartlek" | Unstructured speed, fun | Mixed, effort-based |
| Recovery run | "Recovery" | Active recovery | Z1, very easy |
| Strides | "Strides" | Neuromuscular activation, leg turnover | 4-6 x 20-30s at mile pace effort |
| Rest | "Rest" | Full recovery | — |
| Cross-training | "XT" | Aerobic work without run impact | Bike, swim, elliptical |

### Data a Training Plan Session Needs

Minimal normalized schema for a training plan session:

```
Session {
  week_number: int            // 1-based, relative to plan start
  day_of_week: enum           // MON, TUE, WED, THU, FRI, SAT, SUN
  date: date                  // absolute date once plan is anchored
  session_type: enum          // EASY, LONG, TEMPO, INTERVAL, PROGRESSION,
                              //   FARTLEK, RECOVERY, STRIDES, REST, XT
  distance_km: float | null   // target distance; null for REST or XT
  duration_min: int | null    // alternative to distance for time-based plans
  pace_target: {              // optional, nullable per field
    min_min_per_km: float,    // e.g. 6.0 (min/km)
    max_min_per_km: float     // e.g. 6.5
  } | null
  hr_zone_target: int | null  // 1-5; used instead of pace for easy days
  intensity_label: string     // human label: "easy", "at tempo", "Z4 intervals"
  notes: string               // "include 6x strides at the end", "hilly route OK"
  completed: bool             // false until user uploads run data
  actual_run_id: string | null // FK to parsed run once uploaded
}
```

### Typical Marathon Plan Shape (Novice, 18 weeks)

| Weeks | Phase | Weekly Sessions | Long Run |
|-------|-------|----------------|---------|
| 1-6 | Base | 4 runs (3 easy + 1 long) | 12-24 km buildup |
| 7-12 | Build | 4-5 runs (easy + tempo + long) | 24-35 km peak |
| 13-15 | Peak | 5 runs (easy + intervals + tempo + long) | 32 km max |
| 16-17 | Taper | 3-4 runs, reduced distance | 16-20 km |
| 18 | Race week | 2-3 short shakeouts + race | Race day |

### Typical Half Marathon Plan Shape (12-16 weeks)

Long run peaks at 18-22 km. Less volume overall, shorter taper (1 week). Tempo and interval work introduced earlier.

### 5K Plan Shape (8-12 weeks)

Short plan, heavy emphasis on interval and speed work. Long run 12-15 km max. Taper 1 week.

---

## 3. AI Coaching Chat UX Patterns

### Onboarding Conversation Flow

The onboarding must gather enough to generate an initial plan. The coach should ask one or two questions at a time — not a form dump. Progressive disclosure, conversational tone.

**Recommended question sequence:**

1. **Goal** — "What race are you training for, and when is it?" (event type + target date)
2. **Current fitness** — "What does your running look like right now? Roughly how many km/week, and how long since your last run?" (current weekly volume + recency)
3. **History** — "Have you run this distance before? What was your last race or longest run?" (injury context, fitness base)
4. **Availability** — "How many days a week can you commit to running?" (constrains sessions per week)
5. **Constraints** — "Any injuries, health conditions, or life events I should plan around?" (open-ended, free text)
6. **Goal pace** (optional) — "Do you have a time goal, or is finishing the priority?" (determines intensity of plan)

After these, the coach generates a plan. The plan generation message should:
- Briefly summarize what the coach understood
- Present the phase structure ("Here's how your 16 weeks break down")
- Show week 1 explicitly
- Invite the user to ask for changes: "Does this look right? I can adjust any day, add more/less intensity, or swap sessions."

### Post-Run Feedback UX Pattern

After the user uploads an Apple Health export, the coach feedback message should follow a consistent structure:

**Recommended feedback format:**

```
[Acknowledge the run with one sentence — tone matched to effort]

WHAT YOU DID
- Distance: X km in Y min (avg pace Z min/km)
- Heart rate: avg A bpm, max B bpm
- Effort level: Z2 aerobic / Z3 tempo / etc.

VS. THE PLAN
- Today was scheduled as: [session type, target distance/pace]
- You [hit the target / ran X% farther / ran X% slower / missed the session]

WHAT THIS MEANS
[2-3 sentences of coaching insight: was the pace appropriate? signs of fatigue?
aerobic decoupling? pacing too aggressive at the start?]

PLAN ADJUSTMENT (if any)
[0-1 sentences: if notable, say what changes tomorrow or next week]
```

This structure answers the user's real question in order: "What did I do? Was it right? What now?"

### General Chat UX Principles

- **Persistent context**: The coach should always have access to the full conversation history, the current plan, and all past runs. Messages should reference history: "That's three consecutive days with HR above Z3 — let's make sure tomorrow is truly easy."
- **Proactive flags**: If a user uploads a run showing signs of overtraining (HR elevated for easy effort, pace regression week over week), the coach should raise this unprompted.
- **Editable plan via chat**: "Can you move my long run to Sunday?" should work as a natural language command. The coach parses intent and updates the plan in the database.
- **No jargon without explanation**: When using terms like "aerobic decoupling" or "lactate threshold," the coach should briefly explain on first use.
- **Tone**: Encouraging but honest. Don't sugarcoat a bad run ("this was harder than it should have been at that pace") but don't catastrophize.

### Onboarding Edge Cases to Handle

| Edge Case | How to Handle |
|-----------|--------------|
| Race date < 8 weeks away | Warn the plan will be compressed; ask if they want to pick a later race instead |
| User has no recent running history | Start with base building only, no quality work for 4+ weeks |
| Very high current mileage | Validate — if they're already running 80 km/week, a novice plan is wrong |
| Conflicting constraints (5 days/week but only 8 weeks to marathon) | Be explicit about the trade-off; recommend a different goal |
| User imports a plan they already have | Skip onboarding questions, treat imported plan as source of truth, ask only what's missing |

---

## 4. Dashboard Design Patterns

### Information Architecture: At-a-Glance vs Drill-Down

**The key principle**: The dashboard should answer "Am I on track?" in one glance. Everything else is drill-down.

### Above the Fold (Primary Dashboard — At-a-Glance)

| Widget | What to Show | Why |
|--------|-------------|-----|
| **Today's session** | Session type, target distance/pace, "completed / not yet" | Most important daily question |
| **This week's progress** | Sessions done / sessions planned (e.g. 2/4), km done / km planned | Weekly adherence at a glance |
| **Goal countdown** | "42 days to race", progress bar | Motivation + time context |
| **Recent run card** | Last run: date, distance, pace, emoji effort indicator | Quick reference for last workout |
| **Training load trend** | Sparkline of weekly km for last 6-8 weeks | Volume trend, injury risk signal |

### Secondary Level (One Tap/Click Away)

| Section | What to Show |
|---------|-------------|
| **Training calendar** | Monthly calendar with each session as a dot/chip; color-coded by type (easy=green, tempo=orange, long=blue, rest=grey, completed=filled, missed=outline) |
| **Run history list** | Scrollable list — date, distance, pace, HR, session type matched, deviation from plan |
| **Progress charts** | Pace trend over time, weekly volume bar chart, HR zone distribution across recent runs |
| **Chat history** | Chronological thread — see all past conversations with coach |

### Training Calendar Specifics

- Color-code by session type — users scan by color pattern, not labels
- Show planned vs actual: a "completed" indicator should be visually distinct from "planned"
- Missed sessions should show as a distinct state (not just empty), so the coach can reference them
- Clicking a session opens: the plan details, and if completed, the run stats for that day
- Week view and month view both necessary — week is operational, month is motivational

### Metrics Worth Surface-Level Display

| Metric | Display Format | Notes |
|--------|---------------|-------|
| Total km this week | Number + vs. last week | Simplest volume indicator |
| Average pace (last run) | min/km or min/mi | Single biggest "how'd I do" number |
| Average HR (last run) | bpm | Effort context for pace |
| Long run this week | km + vs. planned | Keystone session progress |
| Streak / consistency | "X of last Y sessions completed" | Adherence, not volume |

### Metrics to Defer to Drill-Down (Not At-a-Glance)

- VO2max estimate
- Individual HR zone breakdowns
- Ground contact time, vertical oscillation
- Week-over-week pace trend charts
- Cadence history

### Anti-Patterns for Training Dashboards

- **Metric overload**: Showing 12 numbers at once. Users get numb; they stop reading. Limit primary view to 5-6 signals.
- **No plan context**: Showing "ran 8 km" without "planned 10 km" removes all meaning.
- **Calendar-only view**: A calendar without a stats summary forces users to click into every run to understand trends.
- **Overwhelming charts**: Line charts with 6 series are hard to read. Pick the one line that matters (e.g., pace trend), not all metrics stacked.

---

## 5. Plan Import from LLM Conversations

### What "ChatGPT Gave Me a Plan" Looks Like

A typical LLM-generated training plan output appears as a Markdown-formatted response with:

```
Week 1 (Base Building)
- Monday: Rest
- Tuesday: Easy run 5 km
- Wednesday: Rest
- Thursday: Tempo run 6 km (last 2 km at tempo pace ~5:30/km)
- Friday: Rest
- Saturday: Long run 12 km (easy, conversational pace)
- Sunday: Rest or easy cross-training

Week 2:
...

Pace guidelines:
- Easy pace: 6:00-6:30 min/km
- Tempo pace: 5:15-5:30 min/km
- Long run pace: 6:00-6:30 min/km

Notes:
- Increase long run by ~1-2 km per week
- Take recovery week every 4th week (reduce mileage by 20-30%)
```

Variations include:
- Tables in Markdown: `| Mon | Tue | Wed | ...`
- Prose paragraphs with no structure at all
- Plans that mix distance (km/mi) and time-based targets
- Plans that omit pace targets entirely
- Plans that name phases inconsistently ("Build phase", "Week 3-8", "Intermediate block")
- Plans pasted with extra chat dialogue around them ("Sure! Here's a 16-week plan...")

### Normalization Schema

The import pipeline needs to extract and normalize to the `Session` schema defined in Section 2. Key parsing targets:

| Raw Text Signal | Normalized Field |
|----------------|-----------------|
| "Week 1", "Week 2" | `week_number` |
| "Monday", "Mon", "Day 1" | `day_of_week` |
| "Easy run", "easy 5km", "recovery jog" | `session_type: EASY` |
| "Rest", "Off", "Day off" | `session_type: REST` |
| "Long run", "LR 18km" | `session_type: LONG` |
| "Tempo", "threshold", "at tempo pace" | `session_type: TEMPO` |
| "Intervals", "track workout", "8x400m" | `session_type: INTERVAL` |
| "Fartlek" | `session_type: FARTLEK` |
| "5 km", "5K", "3 miles" | `distance_km` (normalize to km) |
| "30 min", "45 minutes" | `duration_min` |
| "5:30/km", "8:30/mile", "at 9 min pace" | `pace_target` (normalize to min/km) |
| "conversational", "easy", "Z2" | `hr_zone_target: 2` |
| "hard", "race pace", "at 5K effort" | infer zone from context |
| Any remaining text | `notes` |

### Import UX Flow

1. User pastes raw text into a textarea (or the chat window)
2. System sends text to Claude with a structured extraction prompt
3. Claude returns JSON matching the Session schema
4. App renders a preview: "I found a 16-week plan with 4 sessions per week. Here's what week 1 looks like — does this look right?"
5. User can correct errors before confirming ("Week 3 day 2 should be 10 km, not 6")
6. On confirmation, the plan is saved and anchored to today as Week 1 Day 1 (or user picks a start date)

### What the Claude Extraction Prompt Needs

The system prompt for plan extraction should include:
- The full Session schema (typed, with enum values spelled out)
- Instructions to return `null` for fields not mentioned, not to invent pace targets if none given
- Instructions to handle unit conversion (miles to km)
- Instructions to extract any global pace guide and apply it to matching sessions
- Example input/output pair for few-shot reliability

### Edge Cases in Plan Import

| Scenario | Handling |
|----------|---------|
| Plan is entirely time-based (no distances) | Use `duration_min`, leave `distance_km` null |
| Plan has no pace targets | Leave `pace_target` null; coach can ask user for pace goals |
| User pastes plan + ChatGPT conversation fluff | Claude should ignore non-plan text |
| Plan is in miles | Convert to km, store preference for display |
| Plan has inconsistent week numbering | Normalize to sequential 1-N |
| Plan is incomplete (only 6 of 18 weeks) | Import what exists, flag the gap in preview |
| No session type identifiable | Default to `EASY`, flag for user review |

---

## 6. Feature Categories: v1 vs Later

### V1: Must Have (Core Loop)

The product is not usable without these. A user should be able to: set a goal, get a plan, upload a run, get feedback.

| Feature | Why v1 | Notes |
|---------|--------|-------|
| Onboarding chat — goal setting, plan generation | Core value prop | Claude generates plan from answers |
| Training plan storage and display | Users must see their plan | Weekly calendar view minimum |
| Apple Health XML upload + parsing | Core data ingestion | Parse `export.xml` from ZIP |
| Run data extraction (distance, duration, pace, HR) | Basis for all feedback | WorkoutStatistics + Record time-series |
| Post-run AI feedback via chat | Closes the coaching loop | Structured prompt with run data context |
| Plan adherence tracking (completed vs planned) | Dashboard makes no sense without this | Boolean per session |
| Dashboard: today's session, weekly progress, goal countdown | Minimum useful dashboard | 4-5 widgets |
| Plan import from pasted LLM text | Explicitly requested feature | Claude parsing + user preview |
| Single-user auth gate | Required for deployed app | Simple shared secret or Azure Static Web Apps auth |
| Azure deployment | Stated requirement | Azure Functions + free DB |

### V1.5: Build After Core Loop Works (High Value, Low Risk)

These require the core loop to be working first, but are straightforward extensions.

| Feature | Why Defer | Notes |
|---------|-----------|-------|
| Training calendar — monthly view | Week view works for v1; monthly is nicer | Add after week view is shipped |
| Pace trend chart (run history) | Needs 3+ runs of data to be useful | Ship after users accumulate data |
| HR zone breakdown per run | Requires careful HR time-series parsing | Heavier parsing work |
| Plan adjustment via chat ("move long run to Sunday") | Requires plan-update logic in DB | More complex than read-only |
| Missed session handling ("I didn't run Thursday — what now?") | Conversational edge case | Coach responds but plan update is harder |
| Coach proactive flags (overtraining signals) | Needs run history depth | Build after 2-3 weeks of data patterns |

### V2: Later (Valuable but Significant Scope)

These are meaningful features but add material complexity.

| Feature | Complexity | Why Later |
|---------|-----------|-----------|
| Cadence analysis (step count time-series) | Medium | Requires time-series parsing of Record elements |
| Running form metrics (ground contact time, vertical oscillation) | Medium | Only available for Apple Watch; not all users have it |
| HRV / resting HR trends | High | Requires daily Record parsing, not just workouts |
| Sleep data integration | High | Out of scope per PROJECT.md |
| Elevation gain context | Medium | Requires WorkoutRoute / GPX parsing |
| Week-over-week training load comparison (TSS proxy) | Medium | Useful but needs several weeks of data |
| Race-day strategy chat (target splits, pacing plan) | Low-medium | High value, relatively simple prompt engineering |
| Multiple concurrent goals | High | Architecture change |
| Push notifications / reminders | High | Requires service worker or native notification |

### Anti-Features: Do Not Build

| Feature | Why Not |
|---------|---------|
| Strava / Garmin integration | Scope creep; Apple Health covers the use case |
| Multi-user / social features | Explicitly out of scope; changes architecture entirely |
| Screenshot OCR for run data | Less reliable than XML; more work |
| Native mobile app | Web app is sufficient; adds platform overhead |
| Real-time Apple Watch sync | Requires native app; export flow is simpler |
| Gamification (badges, streaks leaderboard) | Distraction; this is a coaching tool not a game |
| Pre-built static plan templates | Undermines the AI coaching value prop |

---

## Feature Dependencies

```
Auth gate
  └── Everything else

Apple Health upload + parsing
  └── Post-run AI feedback
      └── Plan adherence tracking
          └── Dashboard widgets
              └── Pace/HR trend charts (needs 3+ runs)

Onboarding chat
  └── Plan generation (Claude)
      └── Training plan storage
          └── Training calendar display
              └── Plan adjustment via chat

Plan import (paste)
  └── Training plan storage (same storage layer)
```

---

## MVP Recommendation

Build in this order to get to a working coaching loop fastest:

1. **Auth gate** — simple, unblocks everything else
2. **Onboarding chat + plan generation** — establishes the plan in the DB
3. **Training calendar display** — makes the plan real/visible
4. **Apple Health XML parser** — the data ingestion layer
5. **Post-run AI feedback** — closes the coaching loop
6. **Plan adherence tracking** — marks sessions complete
7. **Dashboard (minimal)** — today's session + weekly progress + goal countdown
8. **Plan import from pasted text** — leverages existing plan storage

Defer until the loop is proven:
- Trend charts (need data)
- Monthly calendar view (week view is sufficient to start)
- Plan adjustment via chat (complex, not blocking)
- HR zone breakdowns (heavier parsing, not blocking)

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Apple Health XML schema | HIGH | Well-documented, stable since iOS 14; schema attributes are consistent across versions |
| Training plan periodization | HIGH | Established sports science; Higdon, Pfitzinger, Daniels plans all follow same structure |
| Session type taxonomy | HIGH | Universal across coaching literature |
| AI chat UX patterns | MEDIUM-HIGH | Informed by conversational UX principles + fitness app patterns; no live source verification |
| Dashboard design patterns | MEDIUM-HIGH | Based on Strava, TrainingPeaks, Garmin Connect patterns; solid but not live-verified |
| Plan import / LLM output format | MEDIUM | Based on direct experience with LLM plan outputs; representative but variable in practice |
| V1 vs later prioritization | HIGH | Follows standard product iteration logic; matches stated requirements |

**Note:** WebSearch and most WebFetch calls were blocked in this environment. All findings are drawn from training knowledge. The Apple Health XML schema in particular is stable and well-established; the field names and structure presented here are consistent with iOS 14 through iOS 18 exports. Recommend spot-checking the `WorkoutStatistics` attribute list against an actual export before building the parser.
