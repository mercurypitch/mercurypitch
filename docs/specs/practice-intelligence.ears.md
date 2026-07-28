# Practice Intelligence — EARS Requirements

Requirements for adaptive difficulty, weakness analysis, generated micro-drills,
and the trends overlay.

Source:

- `src/features/practice-intelligence/adaptive-difficulty.ts` — EMA and the
  difficulty ladder (`EMA_WINDOW` 10, `DIFFICULTY_MIN` 1, `MAX` 10, `DEFAULT` 5)
- `src/features/practice-intelligence/drill-generator.ts` — micro-drill synthesis
- `src/features/practice-intelligence/difficulty-store.ts` — persistence
- `src/features/practice-intelligence/components/WeaknessPanel.tsx` — the panel
- `src/stores/exercise-history-store.ts` — the run log the analysis reads

Tests:

- `src/tests/` — adaptive difficulty and drill generation unit tests
  (`REQ-PI-001..027`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Adaptive difficulty — `REQ-PI-001..009`

### REQ-PI-001 — EMA window
The exponential moving average **shall** be computed over the last 10 results
for the exercise type, with alpha `2 / (window + 1)`.

### REQ-PI-002 — Promote
**WHEN** the EMA is at least 90 **AND** current difficulty is below 10, the
engine **shall** raise difficulty by 1.

### REQ-PI-003 — Demote
**WHEN** the EMA is at most 50 **AND** current difficulty is above 1, the
engine **shall** lower difficulty by 1.

### REQ-PI-004 — Hold
**WHILE** the EMA is between 51 and 89 inclusive, difficulty **shall** remain
unchanged.

### REQ-PI-005 — Bounds
Difficulty **shall** be clamped to 1 through 10 inclusive, including when set
manually.

### REQ-PI-006 — Default
**WHEN** an exercise type has never been practised, its difficulty **shall** be
5.

### REQ-PI-007 — No history, no EMA
**IF** fewer than one result exists for a type, **THEN** the engine **shall**
not compute an EMA.

### REQ-PI-008 — Persistence
Per-exercise difficulty **shall** persist across sessions.

### REQ-PI-009 — Updated on completion
**WHEN** an exercise completes, the engine **shall** re-evaluate that type's
difficulty.

## Difficulty indicator — `REQ-PI-010..012`

### REQ-PI-010 — Badge on the card
Each exercise card **shall** display a difficulty badge showing its tier label
(Beginner, Easy, Medium, Hard, Expert).

### REQ-PI-011 — Hidden at default
**WHILE** an exercise sits at the default difficulty of 5, its badge **shall**
be hidden.

### REQ-PI-012 — Colour by tier
The badge colour **shall** reflect the difficulty tier.

## Weakness analysis — `REQ-PI-013..018`

### REQ-PI-013 — Weak exercises
The analyser **shall** flag exercise types whose recent average score is below
65%.

### REQ-PI-014 — Weak pitches
The analyser **shall** flag pitches whose average deviation is at least 20
cents.

### REQ-PI-015 — Minimum sample
**IF** a note has fewer than 3 recorded occurrences, **THEN** it **shall not**
be flagged as a weak pitch.

### REQ-PI-016 — Weak intervals
The analyser **shall** flag weak interval categories using interval-trainer
results.

### REQ-PI-017 — Trend
For each weak exercise, the analyser **shall** classify the trend as improving,
declining, or stable by comparing the recent average against the overall
average.

### REQ-PI-018 — Empty is empty
**IF** no exercise history exists, **THEN** the weakness report **shall**
return empty collections rather than fabricated defaults.

## Micro-drills — `REQ-PI-019..023`

### REQ-PI-019 — Precision drill
**WHERE** a lowest-scoring exercise exists, the generator **shall** emit a
precision drill for it at reduced difficulty.

### REQ-PI-020 — Range drill
**WHERE** weak pitches exist, the generator **shall** emit a scale-runner drill
targeting them.

### REQ-PI-021 — Interval and stamina drills
**WHERE** weak intervals exist the generator **shall** emit an interval drill,
and **WHERE** a most-deviated pitch exists it **shall** emit a long-note
stamina drill.

### REQ-PI-022 — Cap
The generator **shall** emit at most 4 drills.

### REQ-PI-023 — Reasons cite real data
Each drill's reason text **shall** cite the user's actual measured performance,
not a generic description.

## Weakness panel — `REQ-PI-024..026`

### REQ-PI-024 — Placement and empty state
The panel **shall** render at the top of the Exercises tab, and **IF** no
exercise history exists **THEN** it **shall** not render at all.

### REQ-PI-025 — Drill presentation
Each drill **shall** show a title, description, reason, and a control that
launches the exercise with auto-start.

### REQ-PI-026 — Severity colouring
Weak-pitch badges **shall** be coloured by severity, distinguishing deviations
of at least 30 cents from smaller ones.

## Integration — `REQ-PI-027`

### REQ-PI-027 — Order and reactivity
**WHEN** an exercise records a result, difficulty **shall** be updated *after*
`recordExerciseResult` so the EMA includes the new entry, and that update
**shall** run inside `untrack()` to avoid reactive side effects.

## Trends overlay

Sparkline, weekly stats, improvement rate, and rolling average in the post-run
score overlay are specified in
[vocal-analysis-mobile-sessions.ears.md](vocal-analysis-mobile-sessions.ears.md)
and the exercise shell, not here.
