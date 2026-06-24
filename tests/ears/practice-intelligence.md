# Practice Intelligence Specification (EARS)

## 1. PURPOSE

Define the behavior of the Practice Intelligence system that analyzes exercise and session history to provide adaptive difficulty, weakness detection, and practice trend insights.

## 2. SCOPE

This specification covers:
- Adaptive difficulty engine (EMA-based per-exercise difficulty)
- Weakness drill generator (exercise, pitch, and interval weakness analysis)
- Practice trends dashboard (sparklines, weekly/monthly trends, improvement rate)
- Difficulty indicator UI on exercise cards
- Weakness panel UI with one-click micro-drills
- Trend insights in the post-run score overlay

Excluded:
- Server-side persistence of difficulty levels (localStorage only)
- ML-based difficulty prediction
- Social sharing of trends
- Push notifications for practice reminders

## 3. DEFINITIONS

### EMA (Exponential Moving Average)
A weighted moving average that gives more importance to recent scores. Computed as `EMA_new = alpha * latestScore + (1-alpha) * EMA_prev` where `alpha = 2/(N+1)` and N=10 (window size).

### Difficulty Level
An integer 1-10 indicating exercise difficulty. Default is 5. Higher values mean harder exercises.

### Weakness Report
A structured analysis of practice history identifying low-scoring exercises, problematic pitch ranges (high cents deviation), and weak interval categories.

### Micro-Drill
A pre-configured one-click exercise targeting a specific weakness with reduced difficulty.

### Sparkline
An inline SVG chart showing recent score trends without axes or labels.

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Adaptive Difficulty Engine

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PI-DIFF-01 | EMA score shall be computed from the last 10 exercise results per type. | High |
| PI-DIFF-02 | Difficulty shall increase by 1 when EMA >= 90 and current difficulty < 10. | High |
| PI-DIFF-03 | Difficulty shall decrease by 1 when EMA <= 50 and current difficulty > 1. | High |
| PI-DIFF-04 | Difficulty shall remain unchanged when EMA is between 51 and 89. | High |
| PI-DIFF-05 | Per-exercise difficulty shall persist in localStorage across sessions. | High |
| PI-DIFF-06 | Difficulty shall update automatically after each exercise completion. | High |
| PI-DIFF-07 | Default difficulty for never-practiced exercises shall be 5. | Medium |
| PI-DIFF-08 | No EMA shall be computed when fewer than 1 entry exists for an exercise type. | Medium |
| PI-DIFF-09 | Difficulty shall be clampable to the valid 1-10 range when set manually. | Medium |

### 4.2 Difficulty Indicator

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PI-IND-01 | Each exercise card in the Exercises tab shall display a difficulty badge. | High |
| PI-IND-02 | Badge shall show difficulty label (Beginner/Easy/Medium/Hard/Expert). | High |
| PI-IND-03 | Badge shall be hidden when difficulty is at default level 5. | Medium |
| PI-IND-04 | Badge color shall reflect difficulty tier. | Medium |

### 4.3 Weakness Analyzer

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PI-WEAK-01 | System shall identify exercise types with recent average score below 65%. | High |
| PI-WEAK-02 | System shall identify specific pitch ranges with average deviation >= 20 cents. | High |
| PI-WEAK-03 | System shall identify weak interval categories from interval-trainer metrics. | Medium |
| PI-WEAK-04 | Weak exercise trend (improving/declining/stable) shall be computed from recent vs overall average. | Medium |
| PI-WEAK-05 | Weakness report shall return empty arrays when no history exists. | Medium |
| PI-WEAK-06 | Weak pitch analysis shall require at least 3 occurrences per note. | Low |

### 4.4 Drill Generator

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PI-DRILL-01 | Precision drill shall be generated for the lowest-scoring exercise at reduced difficulty. | High |
| PI-DRILL-02 | Range drill shall be generated when weak pitches exist (scale-runner targeting those notes). | High |
| PI-DRILL-03 | Interval drill shall be generated when weak interval categories exist. | High |
| PI-DRILL-04 | Stamina drill shall be generated for the most-deviated pitch (long-note exercise). | Medium |
| PI-DRILL-05 | Generated drills shall be capped at 4 maximum. | Medium |
| PI-DRILL-06 | Drill reason text shall include the user's actual performance data. | Medium |
| PI-DRILL-07 | Each drill shall produce a one-click launch button in the WeaknessPanel. | High |

### 4.5 Weakness Panel UI

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PI-PANEL-01 | WeaknessPanel shall render at the top of the Exercises tab. | High |
| PI-PANEL-02 | Panel shall be hidden when no exercise history exists. | High |
| PI-PANEL-03 | Each micro-drill shall show title, description, reason, and Practice button. | High |
| PI-PANEL-04 | Weak pitch badges shall be color-coded (red for >= 30 cents, amber for < 30). | Medium |
| PI-PANEL-05 | Practice button shall navigate to the exercise with auto-start. | High |

### 4.6 Trends Dashboard (Score Overlay)

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PI-TREND-01 | Sparkline shall render in the post-run score overlay after 1+ sessions. | High |
| PI-TREND-02 | Weekly stats shall show session count and overall average. | High |
| PI-TREND-03 | Improvement rate in pts/week shall be shown when 2+ weeks of data exist. | Medium |
| PI-TREND-04 | Weak note badges shall appear in the overlay when weak pitches exist. | Medium |
| PI-TREND-05 | Rolling average (last 5 sessions) shall be shown when >= 5 sessions exist. | Low |

### 4.7 Difficulty Integration

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PI-INT-01 | Every exercise component shall update difficulty via updateDifficultyFromEma after recording a result. | High |
| PI-INT-02 | Difficulty update shall occur after recordExerciseResult so EMA sees the new entry. | High |
| PI-INT-03 | updateDifficultyFromEma shall be called within untrack() to avoid reactive side-effects. | Medium |

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Exercise difficulty auto-adjusts based on performance trends across sessions.
2. Users can see their weak areas and jump into targeted drills with one click.
3. Post-run score overlay shows meaningful trend data after the first session.
4. All 15 exercise types update their difficulty after completion.
5. Difficulty levels persist across browser sessions.
6. Zero console errors or warnings in normal operation.
7. All pure computation functions have unit test coverage.

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- EMA computation should complete in under 1ms (max 100 history entries).
- Weakness report generation should complete in under 5ms.
- Sparkline rendering should not cause layout shift.
- Difficulty store reads should be O(1) per-exercise lookup.

### 6.2 Usability
- Difficulty badges should not distract from exercise selection.
- Weakness panel should not overwhelm with too many suggestions (max 4 drills).
- Trend data should be concise and actionable.
- All UI elements should follow existing design patterns.

### 6.3 Reliability
- localStorage failures should fall back to default difficulty of 5.
- Empty history should produce empty reports (no crashes).
- Exercise types not in the difficulty map should default to 5.
- EMA computation should handle score values from 0 to 100.

## 7. ASSUMPTIONS

1. Exercise history is stored newest-first in localStorage, capped at 100 entries.
2. Session history is stored newest-first, capped at 50 entries.
3. Interval-trainer stores category-level accuracy metrics (smallIntervalAvg, mediumIntervalAvg, largeIntervalAvg).
4. Difficulty levels 1-10 map to exercise-specific parameter ranges in each controller.
5. The score overlay renders only when practiceResult() is non-null.
6. Difficulty updates are synchronous and do not require network access.

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-10 | Claude | Initial EARS specification |
