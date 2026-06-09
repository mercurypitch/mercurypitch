# Plan: Singing Exercises & Engagement Improvement (Issue #63)

> **Issue**: [#63 — Singing Exercises Improvement](https://github.com/mercurypitch/mercurypitch/issues/63)
> **Branch**: `feat/issue-63-singing-exercises`
> **Status**: Planning — awaiting review
> **Date**: 2026-05-19

---

## Overview

This plan addresses five goals from Issue #63:

1. Make fun exercises to sing
2. Include vibrato practice and slide in/out practice
3. Include one note practice (long note)
4. Add practice routines that make challenges meaningful
5. Make the experience fun to practice

The plan leverages existing infrastructure (pitch detection, vocal analysis DSP, challenge/badge/streak systems, practice session engine) and fills the gap between raw vocal analysis and structured, engaging practice.

---

## Current State

### What exists

| Capability | Status | Location |
|---|---|---|
| Vocal analysis (6 types: belting, falsetto, crescendo, decrescendo, riff, run) | Done | `VocalAnalysis.tsx`, `vocal-analyzer.ts` |
| Practice session engine (rAF loop, pitch history, scoring) | Done | `usePracticeController.ts`, `practice-session-store.ts` |
| Challenge system (5 categories, 12 challenges, 8 badges, 7 achievements) | Done | `VocalChallenges.tsx`, `challenges-service.ts` |
| Streak tracking | Done | `streak-service.ts` |
| Vibrato detection (FFT + zero-crossing) | Done | `vocal-analyzer.ts`, `live-pitch-analysis.ts` |
| Slide detection (stable-region analysis) | Done | `vocal-analyzer.ts`, `live-pitch-analysis.ts` |
| Falling notes engine (Synthesia-like) | Done | `falling-notes-engine.ts` |
| Audio synthesis (piano/organ/strings/synth, reverb, ADSR) | Done | Audio engine |
| Session history persistence | Done | `practice-session-store.ts` |

### What's missing

- No **structured exercise mode** — the VocalAnalysis tab analyzes but doesn't guide practice
- No **vibrato-specific practice routine** — vibrato is detected but users can't train it
- No **slide practice routine** — slides are classified but users can't drill them
- No **long-note / sustained-note practice** — no breath-support or pitch-stability drill
- **Challenges are disconnected from practice** — challenges track progress but don't generate practice routines
- No **fun/game-like exercises** — the experience is functional but not engaging
- No **daily practice routine generator** — no guided "today's practice" flow

---

## Phase 1: Core Exercise Types (3 new exercises)

### 1A. Vibrato Practice

**Goal**: Help users develop controlled, even vibrato.

**Exercise flow**:
1. User selects a target note (or system suggests one in their range)
2. App plays the reference pitch
3. User sustains the note with vibrato
4. Real-time overlay shows:
   - Live vibrato frequency (Hz) vs. ideal range (4-7 Hz for classical)
   - Live vibrato depth (cents) vs. target (10-50 cents)
   - A "vibrato circle" visualization — a dot orbiting a center at the detected rate/depth
5. Scoring: consistency of rate + depth over the sustained note (variance penalty)

**Files to create/modify**:
- New: `src/features/exercises/vibrato-exercise/` — controller + component
- Reuse: `detectVibrato()` from `vocal-analyzer.ts` (already handles rate + depth + classification)
- Reuse: `usePracticeController.ts` pitch callback pattern

**UI sketch**:
```
┌─────────────────────────────────────────┐
│  Vibrato Practice          Score: 87%   │
│                                         │
│         ┌─────────────────┐             │
│         │   ○  orbiting   │             │
│         │  ╱   at 5.2 Hz  │             │
│         │ ●    depth 32¢  │             │
│         │                 │             │
│         └─────────────────┘             │
│                                         │
│  Rate: ████████████░░ 5.2 Hz (target 4-7)│
│  Depth: ██████████░░░░ 32 ¢ (target 20-40)│
│  Consistency: ████████░░░░ 78%           │
│                                         │
│  [Target: A3] [Start] [Stop]            │
└─────────────────────────────────────────┘
```

### 1B. Slide In/Out Practice

**Goal**: Train clean note transitions — scoop-free attacks and controlled releases.

**Exercise flow**:
1. System presents a pair of notes (e.g., C4 → E4)
2. User sings the first note, then slides to the second
3. Real-time pitch trace shows:
   - Slide duration (ms)
   - Slide smoothness (straight line vs. wobble)
   - Whether the slide overshoots or undershoots
   - Classification: clean / scoop / fall / overshoot / wobble
4. Scoring: clean arrival at target + smooth transition + no overshoot

**Exercise variants**:
- **Slide up** (ascending intervals: minor 2nd through octave)
- **Slide down** (descending intervals)
- **Slide to target** (from arbitrary starting pitch to a fixed target note)
- **Precision slide** (fast, exact arrival — no scooping)

**Files to create/modify**:
- New: `src/features/exercises/slide-exercise/` — controller + component
- Reuse: `detectSlides()` from `vocal-analyzer.ts` (already classifies clean/scoop/fall/overshoot/wobble)
- Reuse: Pitch history from `usePracticeController.ts`

**UI sketch**:
```
┌─────────────────────────────────────────┐
│  Slide Practice            Score: 92%   │
│                                         │
│  C4 ───────────────────── E4            │
│         ╱                               │
│       ╱    ← pitch trace                │
│     ╱                                   │
│  ──●──────────────────●──               │
│                                         │
│  Classification: CLEAN ✓                │
│  Slide time: 340 ms                     │
│  Overshoot: 8 cents (good)              │
│  Smoothness: ████████████░ 94%          │
│                                         │
│  Next: E4 → G4  [Start]                 │
└─────────────────────────────────────────┘
```

### 1C. Long Note (Sustained Pitch) Practice

**Goal**: Build breath support and pitch stability for sustained notes.

**Exercise flow**:
1. User selects a target note
2. Reference tone plays
3. User sustains the note as long and steady as possible
4. Real-time visualization:
   - Pitch line over time (should be flat)
   - Volume meter (breath support indicator)
   - Drift gauge — cumulative cents deviation from target
   - Timer counting up
5. Scoring: duration × stability (longer + steadier = better). Bonus for minimal volume drop-off.

**Metrics displayed**:
- Duration (seconds)
- Pitch stability (standard deviation in cents)
- Max pitch drift (max deviation from target)
- Volume consistency (RMS variance)
- "Steady zone" — % of time within ±15 cents of target

**Files to create/modify**:
- New: `src/features/exercises/long-note-exercise/` — controller + component
- Reuse: Pitch detection + pitch history from `usePracticeController.ts`
- New: Stability scoring logic (simple std-dev over pitch history window)

**UI sketch**:
```
┌─────────────────────────────────────────┐
│  Long Note Practice        Score: 91%   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │  ·······●········●·····●·········· ││  ← pitch trace (flat = good)
│  │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁ ││  ← volume
│  └─────────────────────────────────────┘│
│                                         │
│  Duration: 24.3s  ████████████░░        │
│  Stability: ±11¢  █████████████░        │
│  Steady zone: 87% ████████████░░        │
│  Volume drop: -2dB ██████████████       │
│                                         │
│  [Target: G3] [Start] [Stop]            │
└─────────────────────────────────────────┘
```

---

## Phase 2: Engagement & Gamification

### 2A. Daily Practice Routine Generator

**Goal**: Give users a structured "today's practice" without decision fatigue.

**How it works**:
1. On app open, check if user has completed today's routine
2. Generate a 5-10 minute routine from a template:
   - **Warmup** (1-2 min): Ascending/descending scale through comfortable range
   - **Technique drill** (2-3 min): Rotates between vibrato / slide / long-note
   - **Challenge prep** (2-3 min): Exercise targeting the user's active challenge
   - **Cool-down** (1-2 min): Simple melody or free sing
3. Progress bar shows completion % through the routine
4. Completing the daily routine awards a streak point + bonus challenge progress

**Routine templates** (stored as data, extensible):

```typescript
const dailyRoutines: RoutineTemplate[] = [
  {
    id: 'vibrato-focus',
    name: 'Vibrato Focus',
    segments: [
      { type: 'warmup', duration: 90, config: { pattern: 'ascending-scale', range: 'comfortable' } },
      { type: 'exercise', duration: 180, config: { exercise: 'vibrato', notes: ['C4', 'E4', 'G4'] } },
      { type: 'challenge-prep', duration: 120, config: { challengeCategory: 'perfect' } },
      { type: 'cooldown', duration: 60, config: { mode: 'free-sing' } },
    ],
  },
  // ... more templates
];
```

**Files to create/modify**:
- New: `src/features/routines/daily-routine-controller.ts`
- New: `src/features/routines/DailyRoutinePanel.tsx`
- New: `src/data/routine-templates.ts` — routine definitions
- Modify: `src/stores/` — add routine state store
- Modify: `App.tsx` — add routine panel / integrate into sing tab or new tab

### 2B. Challenge-to-Practice Bridge

**Goal**: Challenges should generate actionable practice routines, not just track progress.

**Current problem**: Challenges show goals but don't tell users *how* to practice for them.

**Solution**: Each challenge category gets a practice drill generator:

| Challenge Category | Practice Drill |
|---|---|
| `high-notes` | Progressive ascending scale — start at C4, step up by semitone when >90% accuracy |
| `low-notes` | Progressive descending scale — same in reverse |
| `speed` | Riff/run drills — increasing BPM, note density |
| `perfect` | Long-note stability drill — sustain with <±15¢ deviation |
| `scales` | Scale patterns in increasing key complexity |

**Implementation**:
- `generateChallengeDrill(challengeId)` function that reads challenge definition and returns exercise config
- "Practice This Challenge" button on each challenge card
- Challenge progress auto-updates from practice session results

**Files to create/modify**:
- New: `src/features/challenges/challenge-drill-generator.ts`
- Modify: `VocalChallenges.tsx` — add "Practice" button per challenge
- Modify: `challenges-service.ts` — wire practice results → challenge progress

### 2C. Progress Visualization & Feedback

**Goal**: Make progress visible and rewarding (not just numbers).

**Elements**:

1. **Session result celebration**: After completing a session, show animated summary with:
   - Accuracy sparkline
   - Best moment highlight (best 3-second window)
   - Comparison to previous best ("New personal best: +3% accuracy!")
   - Badge unlock animation if earned

2. **Streak calendar heatmap**: A GitHub-style grid in the sidebar showing last 90 days of practice activity. Cells colored by session duration or score. Already in todo.md — implement it.

3. **Skill tree visualization** (stretch): Visual representation of unlocked capabilities:
   ```
   Beginner ──→ Steady Voice ──→ Vibrato ──→ Advanced Vibrato
            │                 │
            └──→ Pitch Match ─┴──→ Slide Master
   ```

4. **Sound/audio feedback**: Subtle audio cues for:
   - Perfect note hit (pleasant chime)
   - New best score (ascending arpeggio)
   - Streak milestone (fanfare snippet)

**Files to create/modify**:
- New: `src/components/SessionCelebration.tsx`
- New: `src/components/StreakCalendar.tsx`
- Modify: `src/stores/ui-store.ts` — add celebration state
- Modify: Audio engine — add short SFX playback capability

### 2D. Fun Exercise Modes

**Goal**: Exercises that feel like games, not drills.

**Concepts**:

1. **Pitch Pursuit** (falling-notes integration):
   - Notes fall from top of screen (reuse `falling-notes-engine.ts`)
   - User must match pitch before notes reach the bottom
   - Combo multiplier for consecutive hits
   - Difficulty ramps: more notes, faster fall, wider pitch range
   - This is already partially built — needs scoring UI + exercise wrapper

2. **Mirror the Melody**:
   - App plays a short melodic phrase
   - User sings it back
   - Pitch overlay shows deviation from original
   - Score based on pitch accuracy + timing accuracy
   - Phrases get progressively longer/complex

3. **Pitch Hold Challenge**:
   - A target pitch line appears
   - User must keep their pitch within the line for as long as possible
   - The line slowly drifts (adds difficulty)
   - "You held it for 18 seconds!" — leaderboard-able

4. **Interval Trainer**:
   - App plays two notes
   - User identifies the interval by singing both notes back
   - Trains relative pitch + vocal control simultaneously
   - Difficulty: smaller intervals (major 2nd → minor 2nd)

---

## Phase 3: Technical Architecture

### Component Tree (new)

```
App.tsx
├── SingTab (existing)
│   └── PracticeSession (existing)
├── VocalAnalysis (existing, enhanced)
├── VocalChallenges (existing)
│   └── ChallengeDrillLauncher (new)
├── ExercisesTab (new — top-level tab: #exercises)
│   ├── ExerciseMenu (new — pick exercise type)
│   ├── VibratoExercise (new)
│   ├── SlideExercise (new)
│   ├── LongNoteExercise (new)
│   ├── PitchPursuit (new — wraps falling-notes-engine)
│   ├── MirrorMelody (new)
│   └── IntervalTrainer (new)
├── DailyRoutinePanel (new — sidebar or modal)
├── StreakCalendar (new — sidebar widget)
└── SessionCelebration (new — modal overlay)
```

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│  Exercise Controllers (new)                         │
│  vibrato / slide / long-note / pitch-pursuit / ...  │
│                                                     │
│  Each controller:                                   │
│   - Reads pitch from usePracticeController          │
│   - Reads analysis from vocal-analyzer.ts           │
│   - Computes exercise-specific scoring              │
│   - Emits result → practice-session-store           │
│   - Emits progress → challenge-service              │
│   - Emits streak → streak-service                   │
└──────────────┬──────────────────────────────────────┘
               │
    ┌──────────▼────────────┐
    │  practice-session-store │  ← existing, enhanced
    │  (session results)     │
    └──────────┬────────────┘
               │
    ┌──────────▼────────────┐
    │  Dexie.js IndexedDB    │  ← existing
    │  + localStorage        │
    └───────────────────────┘
```

### Scoring Model

Each exercise type has its own scoring formula, but all normalize to 0-100:

| Exercise | Formula |
|---|---|
| Vibrato | `(rateScore × 0.4) + (depthScore × 0.3) + (consistencyScore × 0.3)` |
| Slide | `(smoothnessScore × 0.4) + (arrivalAccuracy × 0.4) + (speedScore × 0.2)` |
| Long Note | `(durationScore × 0.3) + (stabilityScore × 0.5) + (volumeScore × 0.2)` |
| Pitch Pursuit | `(hitCount / totalNotes × 0.6) + (comboMultiplier × 0.4)` |

---

## Phase 4: Implementation Order

### Milestone 1 — Core Exercises (week 1)
1. Create `src/features/exercises/` module with shared exercise controller interface
2. Implement **Long Note exercise** (simplest — mostly reuse existing pitch detection)
3. Implement **Vibrato exercise** (reuses `detectVibrato()`)
4. Implement **Slide exercise** (reuses `detectSlides()`)
5. Add exercise selector UI + exercises tab route (`#exercises`)

### Milestone 2 — Engagement Loop (week 2)
6. Implement **Daily Routine Generator** with 3 initial templates
7. Implement **Challenge-to-Practice Bridge** (drill generator + "Practice" buttons)
8. Implement **Session Celebration** modal with sparkline + best moment
9. Implement **Streak Calendar** heatmap widget

### Milestone 3 — Fun Modes (week 3)
10. Implement **Pitch Pursuit** (falling-notes scoring wrapper)
11. Implement **Mirror the Melody**
12. Implement **Pitch Hold Challenge**
13. Add audio SFX for feedback events

### Milestone 4 — Polish (week 4)
14. Exercise result history view (per-exercise-type filter)
15. Skill progresion tracking across exercise types
16. Leaderboard integration for exercise scores
17. A/B test placement (exercise tab vs. integrated into sing flow)

---

## Files Summary

### New files (~15)

| File | Purpose |
|---|---|
| `src/features/exercises/types.ts` | Shared exercise interfaces (ExerciseConfig, ExerciseResult, ExerciseType) |
| `src/features/exercises/use-exercise-controller.ts` | Base controller — wraps usePracticeController with exercise-specific scoring |
| `src/features/exercises/vibrato/VibratoExercise.tsx` | Vibrato practice component |
| `src/features/exercises/vibrato/use-vibrato-controller.ts` | Vibrato scoring + state machine |
| `src/features/exercises/slide/SlideExercise.tsx` | Slide practice component |
| `src/features/exercises/slide/use-slide-controller.ts` | Slide scoring + state machine |
| `src/features/exercises/long-note/LongNoteExercise.tsx` | Long note practice component |
| `src/features/exercises/long-note/use-long-note-controller.ts` | Long note scoring + state machine |
| `src/features/exercises/ExerciseMenu.tsx` | Exercise type picker |
| `src/features/routines/types.ts` | Routine template types |
| `src/features/routines/DailyRoutinePanel.tsx` | Today's routine UI |
| `src/features/routines/use-daily-routine.ts` | Routine state controller |
| `src/data/routine-templates.ts` | Routine template definitions |
| `src/features/challenges/challenge-drill-generator.ts` | Maps challenge → practice drill |
| `src/components/SessionCelebration.tsx` | Post-session celebration overlay |
| `src/components/StreakCalendar.tsx` | 90-day activity heatmap |
| `src/features/exercises/pitch-pursuit/PitchPursuit.tsx` | Falling-notes game mode |
| `src/features/exercises/mirror-melody/MirrorMelody.tsx` | Call-and-response exercise |
| `src/features/exercises/pitch-hold/PitchHold.tsx` | Sustained pitch game |

### Modified files (~8)

| File | Change |
|---|---|
| `App.tsx` | Add `#exercises` route + exercises tab; integrate DailyRoutinePanel |
| `VocalChallenges.tsx` | Add "Practice" button per challenge card |
| `challenges-service.ts` | Wire practice results → challenge progress updates |
| `practice-session-store.ts` | Add exercise-type field to session results |
| `ui-store.ts` | Add celebration state, exercise sub-mode |
| `features/tabs/constants.ts` | Add TAB_EXERCISES constant |
| `lib/falling-notes-engine.ts` | Expose scoring hooks for PitchPursuit |
| `stores/index.ts` | Add exercise store to appStore (or export standalone) |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Two parallel vibrato/slide implementations diverge | Exercise controllers use `vocal-analyzer.ts` (FFT-based) as authoritative; `live-pitch-analysis.ts` used only for real-time UI updates |
| Exercise tab competes with existing Sing tab | Consider embedding exercises as "modes" within the Sing tab instead of a separate tab; A/B test placement |
| App.tsx is already ~75KB — adding routes bloats it further | Extract tab rendering to `src/features/tabs/TabRouter.tsx` as part of this work |
| Challenge system may need schema changes | All additions are additive; use optional fields on existing entities |
| Performance of real-time DSP for multiple exercise types | Each exercise only activates one analysis path; DSP is already real-time capable |

---

## Success Metrics

- **Exercise completion rate**: % of started exercises completed
- **Daily routine adherence**: % of days user completes the daily routine
- **Return rate**: % of users who practice 2+ days in a week
- **Challenge engagement**: % of challenges with non-zero progress
- **Time-in-app**: Average session duration
- **Feature adoption**: % of users who try each exercise type at least once
