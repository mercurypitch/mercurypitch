# Implementation Plan — 10 New Singing Exercises + Infrastructure Wiring

## Audit Findings

| System | Status | Gap |
|--------|--------|-----|
| Exercise types | `interval-trainer` defined in types but never implemented | Need component + controller |
| Challenge drill generator | Only maps to `long-note` and `slide` | Need mappings for all exercise types |
| Streak service | `streak-service.ts` exists with full logic | Never called from exercise completion flow |
| Leaderboard | UI exists but shows mock data | Need to update from actual exercise results |
| VocalChallenges | Complete UI with seed data | `handleStartChallenge()` generates drills but doesn't track results against DB |
| Daily routines | 4 templates, only uses 3 exercise types | Add new exercises to routine templates |
| Exercise history store | Records results but doesn't trigger streaks | Wire up streak service call on record |
| DB seed | Seeds challenges, badges, achievements, leaderboard, user profile | No auto-update from exercise completions |

## Phase 1: 10 New Exercises

### 1. Interval Trainer (`interval-trainer`)
- Type already exists. Component + controller needed.
- Play two sequential notes, user sings them back
- Score based on accuracy of both notes (interval precision)
- Supports configurable intervals: unison → octave

### 2. Scale Runner (`scale-runner`)
- New type. Component + controller.
- Plays a scale (ascending/descending), user follows pitch
- Live pitch-on-scale visualization
- Score: % of notes sung within ±50 cents
- Supports major, minor, pentatonic, chromatic

### 3. Arpeggio Jumper (`arpeggio-jumper`)
- New type. Component + controller.
- Plays chord tones (root, 3rd, 5th, octave), user jumps between them
- Live pitch tracking with note labels
- Score: accuracy of each target note hit

### 4. Drone Intonation (`drone-intonation`)
- New type. Component + controller.
- Continuous drone tone plays, user sings melody over it
- Score: harmonic accuracy (how well each note aligns with drone)
- Pitch canvas with drone frequency reference line

### 5. Siren / Range Explorer (`siren`)
- New type. Component + controller.
- User slides from lowest to highest note
- Detects vocal range boundaries (lowest, highest)
- Visual pitch trace showing range
- Result: lowest/highest notes detected, smoothness score

### 6. Call & Response (`call-response`)
- New type. Component + controller.
- AI plays a rhythmic pitch pattern, user echoes it back
- Phase: Listen → Your Turn
- Score: pitch accuracy + timing accuracy
- Pattern complexity increases with success

### 7. Dynamic Swell (`dynamic-swell`)
- New type. Component + controller.
- Messa di voce: crescendo → sustain → decrescendo
- Score: pitch stability during volume change
- Live amplitude + pitch visualization
- Metrics: pitch drift during swell, volume control

### 8. Chord Stacker (`chord-stacker`)
- New type. Component + controller.
- Sing each note of a chord individually, accumulating the chord
- User hears root → sings root, hears root+3rd → sings 3rd, etc.
- Score: pitch accuracy for each stacked note

### 9. Staccato Precision (`staccato-precision`)
- New type. Component + controller.
- Short, precise note attacks on a sequence of pitches
- Score: note onset accuracy + pitch accuracy
- Detection: onset timing, pitch stability per note

### 10. Daily Routine Sequence (`routine-runner`)
- New type. Component + controller.
- Guided sequence: warmup → exercise chain → cooldown
- Auto-transitions between segments with countdown
- Overall score: weighted average across segments
- Expand existing `dailyRoutines` templates to include new exercises

## Phase 2: Infrastructure Wiring

### Streak Integration
- Call `updatePracticeStreak()` from `recordExerciseResult()`
- Wire `StreakCalendar` to use streak service instead of raw history

### Challenge-Exercise Bridge
- Update `challenge-drill-generator.ts` with new exercise mappings
- Wire `handleStartChallenge()` to launch correct exercise type
- Track challenge progress in DB after exercise completion

### Leaderboard Integration
- Update leaderboard entries from actual exercise results
- Populate best-score, total-sessions, accuracy, streak data

## Task Execution Order

1. Add new ExerciseTypes for all 10 exercises
2. `use-base-exercise.ts` — ensure config handles new patterns
3. Interval Trainer (type exists, implement component + controller)
4. Scale Runner
5. Arpeggio Jumper
6. Drone Intonation
7. Siren / Range Explorer
8. Call & Response
9. Dynamic Swell
10. Chord Stacker
11. Staccato Precision
12. Update ExerciseMenu with new exercise cards
13. Wire challenge-drill-generator to new exercises
14. Update routine templates
15. Wire streak service into exercise completion
16. Wire leaderboard updates from exercise results
17. Update VocalChallenges to track challenge progress
18. CSS styles for new exercises
19. Build verification
