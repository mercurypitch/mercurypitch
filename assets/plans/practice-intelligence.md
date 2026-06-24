# Practice Intelligence — Implementation Plan

**Branch**: `feat/practice-intelligence`  
**Repo**: `/root/mercurypitch-clod-second`  
**Date**: 2026-06-10

---

## Overview

Three features that analyze practice history to provide intelligent feedback:

1. **Adaptive Difficulty Engine** — auto-adjust exercise difficulty from rolling performance
2. **Weakness Drill Generator** — analyze weak areas, generate targeted micro-drills
3. **Practice Summary & Trends Dashboard** — post-routine summary card with sparklines and trends

---

## Architecture Context

### Data Sources Available

| Source | Shape | Storage |
|--------|-------|---------|
| `exercise-history-store` | `ExerciseHistoryEntry[]` (type, score, metrics, completedAt) — last 100 | localStorage |
| `practice-session-store` | `SessionResult[]` (score, itemsCompleted, practiceItemResult[], completedAt) — last 50 | localStorage |
| `session-service` | `SessionRecord[]` (score, accuracy, notesHit, notesTotal, streak) | IndexedDB (Dexie) |
| `streak-service` | `UserProfile.currentStreak`, `lastPracticeDate` | IndexedDB |

### Scoring System

- Scores are 0-100 per note and session
- Ratings: perfect (≤5¢), excellent (≤15¢), good (≤25¢), okay (≤50¢), off (>50¢)
- Each exercise type has its own `metrics: Record<string, number>`

### UI Architecture

- SolidJS + signals/stores pattern
- Practice tab (`TAB_SINGING`) renders `PitchCanvas` + `SharedControlToolbar`
- Score overlay (`#score-card`) shows after each run
- Session summary overlay shows after session completion
- Exercises tab (`TAB_EXERCISES`) has 15 exercise types with controllers

---

## Feature 1: Adaptive Difficulty Engine

### Goal
Auto-adjust exercise difficulty based on rolling performance so users are always challenged at the right level.

### Algorithm
- **EMA (Exponential Moving Average)** of last N scores per exercise type
- `EMA_new = α × latestScore + (1 - α) × EMA_prev` where α = 2/(N+1), N = 10
- Map EMA to difficulty levels 1-10:
  - EMA ≥ 90 → difficulty +1 (harder)
  - EMA ≤ 50 → difficulty -1 (easier)
  - Otherwise → stay at current level
- Persist per-exercise difficulty level in localStorage

### New Files
```
src/features/practice-intelligence/
├── adaptive-difficulty.ts          # EMA computation + difficulty mapping
├── difficulty-store.ts             # Per-exercise difficulty state (persisted signal)
├── weakness-analyzer.ts            # Weak area detection
├── drill-generator.ts              # Micro-drill generation
├── trends-computer.ts              # Weekly/monthly trends computation
├── components/
│   ├── PracticeSummaryCard.tsx     # Post-routine summary with sparklines
│   ├── SparklineChart.tsx          # Inline SVG sparkline component
│   ├── WeaknessPanel.tsx           # Weakness drill suggestions UI
│   └── DifficultyIndicator.tsx     # Visual difficulty level indicator
└── index.ts                        # Barrel exports
```

### Integration Points
- **`difficulty-store.ts`**: Reads `exerciseHistory()` from `exercise-history-store`, computes EMA, exposes `getDifficulty(type)` and `getSuggestedDifficulty(type)` signals
- **Exercise controllers**: Each controller reads `getSuggestedDifficulty(exerciseType)` on start, maps 1-10 to exercise-specific parameters (note range, tempo, interval size, etc.)
- **`ExerciseMenu.tsx`**: Show current difficulty level next to each exercise

### Implementation Steps
1. Create `adaptive-difficulty.ts` with EMA computation
2. Create `difficulty-store.ts` with persisted signals
3. Wire into 2-3 exercise controllers as proof of concept (long-note, interval-trainer, scale-runner)
4. Add difficulty indicator to ExerciseMenu

---

## Feature 2: Weakness Drill Generator

### Goal
Analyze history to find weak areas and generate targeted micro-drills that users can jump into with one click.

### Algorithm
- Scan `ExerciseHistoryEntry[]` for exercise types with lowest recent scores
- Scan `SessionResult[]` + `PracticeResult.noteResult[]` for specific MIDI notes with high avgCents deviation
- Identify "weak patterns":
  - Low-scoring exercise types
  - Problematic pitch ranges (e.g., consistently flat on high notes)
  - Intervals that cause trouble (from interval-trainer metrics)
- Generate 2-4 targeted micro-drills:
  - **Range drill**: Focus on the problematic octave range
  - **Interval drill**: Practice the specific intervals that were missed
  - **Precision drill**: Repeat the lowest-scoring exercise at reduced difficulty
  - **Stamina drill**: Long-note on weak pitches

### New Data Model
```typescript
interface WeaknessReport {
  weakExercises: { type: ExerciseType; recentAvg: number; trend: 'improving' | 'declining' | 'stable' }[]
  weakPitches: { midi: number; noteName: string; avgDeviation: number }[]
  weakIntervals: { fromMidi: number; toMidi: number; accuracy: number }[]
  generatedAt: number
}

interface MicroDrill {
  id: string
  title: string
  description: string
  exerciseType: ExerciseType
  config: ExerciseConfig  // pre-configured for the weakness
  reason: string  // "You're averaging 45% on this"
}
```

### Integration Points
- **`WeaknessPanel.tsx`**: New component shown in Exercises tab (or as a card in the practice view)
- **`ExerciseMenu.tsx`**: "Weakness Drills" section at top
- **After session completion**: Optionally show weakness suggestions in the session summary overlay

### Implementation Steps
1. Create `weakness-analyzer.ts` (scan history, build WeaknessReport)
2. Create `drill-generator.ts` (generate MicroDrill[] from report)
3. Create `WeaknessPanel.tsx` component
4. Integrate into Exercises tab and session summary overlay

---

## Feature 3: Practice Summary & Trends Dashboard

### Goal
Show a rich post-routine summary card with sparklines, weekly/monthly trends, and actionable insights.

### Data Computation
- **Sparkline data**: Last 10-20 session scores for inline SVG sparkline
- **Weekly trend**: Group sessions by ISO week, compute average score per week
- **Monthly trend**: Group by month
- **Rolling averages**: 5-session and 10-session moving averages
- **Best/worst**: Best session ever, worst session, current streak
- **Time-based stats**: Total practice time (estimate from session durations), sessions this week
- **Improvement rate**: Slope of the trend line (are they getting better?)

### UI Design

#### Post-Routine Summary Card (extends existing score overlay)
```
┌─────────────────────────────────┐
│  Run Complete!                  │
│  ┌─────────────────────────┐    │
│  │  ▁▂▃▄▅▆▇█▇▆▅  (sparkline) │    │
│  └─────────────────────────┘    │
│  85%  Excellent!                │
│  12 notes · 8.3¢ avg            │
│  ─────────────────────────────  │
│  This Week: ████████░░ 85% avg  │
│  Trend: ↑ +5% from last week    │
│  Streak: 🔥 7 days              │
│  ─────────────────────────────  │
│  Weak Spots:                    │
│  • High notes (A4-C5) -12¢ flat │
│  • Interval: minor 6th ↓ 62%    │
│  [Practice These]               │
└─────────────────────────────────┘
```

#### Trends Dashboard (new section or tab content)
- Weekly score chart (bar chart, last 4-12 weeks)
- Per-exercise-type breakdown
- Practice frequency calendar heatmap (like GitHub contributions)

### New Components
- **`SparklineChart.tsx`**: Pure SVG sparkline, accepts `number[]`, renders polyline + optional gradient fill
- **`PracticeSummaryCard.tsx`**: Enhanced post-run overlay with trends and weakness callouts
- **`TrendsPanel.tsx`**: Full trends view (accessible from sidebar or settings)
- **`CalendarHeatmap.tsx`**: Day-by-day practice heatmap

### Integration Points
- **Score overlay** (`App.tsx` around line 2026): Replace or extend current `#score-card` with `PracticeSummaryCard`
- **Session summary overlay** (line 2143): Show trend data
- **Sidebar**: Add "Trends" link to open `TrendsPanel`

### Implementation Steps
1. Create `trends-computer.ts` (weekly/monthly aggregation, rolling averages, slope)
2. Create `SparklineChart.tsx` component
3. Create `PracticeSummaryCard.tsx` — enhanced score overlay
4. Create `CalendarHeatmap.tsx` component
5. Create `TrendsPanel.tsx` — full dashboard view
6. Wire into App.tsx score overlay and session summary

---

## Implementation Order

The features build on each other, so the recommended order is:

### Phase 1: Foundation (shared utilities)
1. `trends-computer.ts` — aggregation/trend utilities needed by all features
2. `adaptive-difficulty.ts` + `difficulty-store.ts`

### Phase 2: Adaptive Difficulty
3. `DifficultyIndicator.tsx`
4. Wire into 2-3 exercise controllers (long-note, interval-trainer, scale-runner)
5. Show difficulty in ExerciseMenu

### Phase 3: Weakness Drills
6. `weakness-analyzer.ts`
7. `drill-generator.ts`
8. `WeaknessPanel.tsx`
9. Integrate into Exercises tab

### Phase 4: Trends Dashboard
10. `SparklineChart.tsx`
11. `CalendarHeatmap.tsx`
12. `PracticeSummaryCard.tsx`
13. Wire into App.tsx score/session overlays
14. `TrendsPanel.tsx` (optional stretch goal)

---

## Files to Modify (existing)

| File | Change |
|------|--------|
| `src/App.tsx` | Wire `PracticeSummaryCard` into score overlay and session summary |
| `src/features/exercises/ExerciseMenu.tsx` | Add difficulty indicators and weakness section |
| `src/features/exercises/use-base-exercise.ts` | Read suggested difficulty from store |
| `src/features/exercises/types.ts` | `ExerciseConfig.difficulty` already exists (1-10) |
| `src/stores/exercise-history-store.ts` | Export helper to get recent entries for EMA |

## Non-goals (for now)
- Server-side persistence of difficulty levels (localStorage only)
- ML-based difficulty prediction
- Real-time difficulty adjustment mid-exercise
- Social sharing of trends
- Push notifications for practice reminders
