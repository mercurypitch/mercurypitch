# MercuryPitch -- Feature Proposals

15 features organized by category. Cross-referenced against all remote branches to avoid duplicates.

> **Work in progress (on branches):**
> - Guitar practice page (`feat/guitar-practice`)
> - Vocal analysis enhancements (`feature/vocal-analysis-enhancements`)

---

## Practice Intelligence

### 1. Adaptive Difficulty Engine

**What:** Automatically adjust exercise difficulty based on the user's rolling performance. If someone consistently scores 90%+ on interval-trainer at difficulty 5, bump to 6 next time. If they drop below 60%, ease back.

**Technical approach:**
- New `adaptive-difficulty.ts` in `src/lib/` that reads `exerciseHistory()` and computes a per-exercise difficulty curve
- Uses exponential moving average of last 10 scores per exercise type
- Feeds into `ExerciseConfig.difficulty` which already exists but is hardcoded at 5
- Store the computed difficulty per exercise type in `exercise-history-store.ts`

**Effort:** Medium (2-3 days) | **Value:** High -- makes exercises self-calibrating instead of static

---

### 2. Weakness Drill Generator

**What:** Analyze exercise history to identify the user's weakest areas (e.g., "your interval accuracy drops on descending major 6ths" or "vibrato rate is inconsistent above G4"), then generate targeted micro-drills.

**Technical approach:**
- Extend `ExerciseHistoryEntry.metrics` to capture per-note/per-interval scores (some exercises already do this)
- New `weakness-analyzer.ts` that aggregates metrics across history and ranks failure patterns
- Generates `ChallengeDrill[]` targeting specific weak intervals, notes, or techniques
- Surface as a "Focus on Weaknesses" button in the Exercise menu

**Effort:** Medium-High (3-4 days) | **Value:** High -- personalized practice is the #1 differentiator for vocal training apps

---

### 3. Practice Session Summary & Trends Dashboard

**What:** After completing a routine or set of exercises, show a summary card with: total practice time, exercises completed, score improvements vs. last session, and a sparkline of recent scores. Also a weekly/monthly trends view.

**Technical approach:**
- New `PracticeSummary.tsx` component rendered after routine completion (replaces or augments `SessionCelebration.tsx`)
- Pull from `exerciseHistory()` and `streak-service.ts` data
- Canvas sparkline component (lightweight, reuse `HistoryCanvas.tsx` pattern)
- Weekly view: group `exerciseHistory` by `completedAt` date, aggregate scores per exercise type

**Effort:** Medium (2-3 days) | **Value:** High -- users need feedback loops to stay motivated

---

## Audio & Algorithm Improvements

### 4. Real-Time Formant Visualization

**What:** Display formant frequencies (F1, F2, F3) alongside pitch detection on the PitchCanvas. Formants reveal vowel shape and vocal technique (chest vs head voice, open vs closed throat). Show as colored horizontal bands overlaid on the pitch trace.

**Technical approach:**
- Add LPC (Linear Predictive Coding) or cepstral formant estimation to `pitch-detector.ts` (can run on the same `AnalyserNode` data)
- Extract top 3 formant peaks from the spectral envelope
- Render as semi-transparent colored bands on `PitchCanvas.tsx`
- Toggle-able via settings (off by default -- niche but powerful for serious vocalists)

**Effort:** High (4-5 days) | **Value:** Medium -- differentiator for serious vocal coaches and advanced users

---

### 5. Microphone Latency Calibration Wizard

**What:** A setup wizard that measures and compensates for audio input latency. Plays a click track through speakers, records the mic picking it up, cross-correlates to find the delay, then offsets all pitch detection timestamps.

**Technical approach:**
- New `LatencyCalibrator.tsx` modal triggered from Settings
- Play a known pattern (4 clicks at known intervals) via `AudioEngine`
- Record mic input simultaneously, cross-correlate the two signals
- Store offset in `settings-store.ts` as `micLatencyMs`
- Apply offset in `pitch-detector.ts` when matching pitch to melody notes

**Effort:** Medium (2-3 days) | **Value:** Medium-High -- fixes a pain point that causes "I'm singing on pitch but the app says I'm off" complaints

---

### 6. Pitch Accuracy Heatmap (Post-Practice)

**What:** After a karaoke or practice session, render a heatmap showing pitch accuracy per note/measure. Green = on pitch, yellow = slightly off, red = significantly off. Clickable to replay that section.

**Technical approach:**
- Already have `pitchHistory` data from exercises and `OfflinePitchCanvas.tsx` for post-hoc rendering
- New `PitchHeatmap.tsx` component that maps pitch deviation to a color gradient per time bucket
- Overlay on the melody's note grid (reuse `piano-roll.ts` coordinate system)
- Click-to-seek via `playback-engine.ts`

**Effort:** Medium (3 days) | **Value:** High -- visual feedback is the core value prop of the app

---

## Social & Collaboration

### 7. Jam Room Chat & Emoji Reactions

**What:** Add text chat and quick emoji reactions to Jam rooms. Currently Jam is audio-only via WebRTC. Chat helps coordinate ("let's do C major scale"), and reactions give real-time feedback ("nice vibrato!").

**Technical approach:**
- Extend `JamRoom` Durable Object to handle `type: 'chat'` and `type: 'reaction'` WebSocket messages
- Add a chat panel to `JamPanel.tsx` (collapsible, below the peer list)
- Reactions: overlay floating emojis on the peer's pitch display canvas (fade-out animation)
- Message history stored in Durable Object state (capped at last 100 messages)

**Effort:** Medium (2-3 days) | **Value:** Medium -- makes Jam feel like a real collaborative space

---

### 8. Routine Sharing via URL

**What:** Let users create custom routine templates and share them via a short URL (like melody sharing). Recipients can import and run the routine.

**Technical approach:**
- Already have share infrastructure (`share-codec.ts`, `share-handler.ts`, KV-backed URLs)
- Add `encodeRoutine()` / `decodeRoutine()` to `share-codec.ts` for `RoutineTemplate`
- Generate short URL via `/api/share/` endpoint (same as melody shares)
- `loadSharedRoutine()` already exists in `use-daily-routine.ts` -- wire it to URL decode

**Effort:** Low (1 day) | **Value:** Medium -- coaches can send practice routines to students

---

### 9. Exercise Leaderboard Filtering

**What:** The leaderboard exists but is a single global list. Add per-exercise-type filtering so users can compete on specific skills (e.g., "Best interval-trainer scores this week").

**Technical approach:**
- Extend `leaderboard-service.ts` to store `exerciseType` per entry
- Add a filter dropdown to `CommunityLeaderboard.tsx`
- Query filtered results from IndexedDB (Dexie `.where('exerciseType').equals(...)`)
- Time-range filter: "This Week" / "All Time"

**Effort:** Low-Medium (1-2 days) | **Value:** Medium -- adds competitive depth

---

## UX & Quality of Life

### 10. Keyboard Shortcut System

**What:** Global keyboard shortcuts for common actions: Space = play/pause, M = toggle mic, R = restart, 1-9 = switch tabs, Esc = close modal, left/right = seek. Show overlay with `?` key.

**Technical approach:**
- New `useKeyboardShortcuts()` hook in `src/utils/` that attaches `keydown` listeners
- Map to existing store actions (`togglePlayback`, `toggleMic`, `setActiveTab`, etc.)
- `KeyboardShortcutsModal.tsx` -- simple table overlay triggered by `?`
- Respect focus context: suppress shortcuts when typing in input/textarea

**Effort:** Low-Medium (1-2 days) | **Value:** High -- power users will love this, basic UX expectation

---

### 11. Onboarding Flow with Voice Type Detection

**What:** Replace the current `WelcomeScreen` with a 3-step onboarding: (1) Mic permission + test, (2) Voice type detection (auto-detect range by singing ascending scale), (3) Recommended first routine. Currently `VoiceTypeDetectorModal` exists but is buried in settings.

**Technical approach:**
- New `OnboardingFlow.tsx` multi-step wizard component
- Step 1: Reuse `MicButton` + test tone playback
- Step 2: Embed `VoiceTypeDetectorModal` logic inline (already detects range via ascending pitch)
- Step 3: Recommend routine from `routine-templates.ts` based on detected voice type
- Store `hasCompletedOnboarding` in `settings-store.ts`

**Effort:** Medium (2-3 days) | **Value:** High -- first impression determines retention

---

### 12. Practice Timer with Break Reminders

**What:** A configurable practice timer that runs in the background. After N minutes of active practice, show a gentle reminder to rest the voice ("You've been singing for 25 minutes -- take a 5-minute break"). Pomodoro-style.

**Technical approach:**
- New `practice-timer.ts` in `src/lib/` -- tracks cumulative mic-active time
- Listens to `micStore` active state changes to count active singing time
- Configurable work/break intervals in Settings (default: 25min/5min)
- Shows notification via `notifications-store.ts` with a "Dismiss" / "Start Break" action

**Effort:** Low (1 day) | **Value:** Medium -- vocal health feature, shows the app cares about the user

---

### 13. Theme Auto-Switch & Accent Colors

**What:** Theme preference already exists, but add auto-switching: follow system preference (`prefers-color-scheme`), or set a schedule (dark after 8pm). Also add accent color customization (currently hardcoded OKLCH palette).

**Technical approach:**
- Extend `theme-store.ts` to support `'auto' | 'light' | 'dark'` modes
- `auto` mode: `matchMedia('(prefers-color-scheme: dark)')` listener
- Accent color picker in Settings (6-8 preset palettes + custom)
- CSS variables already use `oklch()` -- just swap the hue/chroma tokens

**Effort:** Low-Medium (1-2 days) | **Value:** Medium -- personalization increases attachment

---

## New Exercise Types

### 14. Rhythm Accuracy Exercise

**What:** A rhythm-focused exercise where the user must clap or sing notes at exact rhythmic intervals. The app plays a beat pattern, and the user reproduces it. Scores timing accuracy (not pitch). Complements the pitch-focused exercises.

**Technical approach:**
- New `rhythm-accuracy/` exercise directory
- Uses onset detection from `shazam/onset-detector.ts` (already exists) to detect clap/note attacks
- Generates random rhythmic patterns (quarter, eighth, dotted, triplet) at a given BPM
- Score based on timing deviation from expected beat positions (ms offset)
- Reuse `ExerciseController` interface, `use-base-exercise.ts` for lifecycle

**Effort:** Medium (2-3 days) | **Value:** High -- fills a major gap (rhythm is 50% of singing but currently untrained)

---

### 15. Sight-Singing Reading Exercise

**What:** Display a sequence of notes on a staff (or simplified solfege notation), and the user must sing them without hearing them first. Unlike mirror-melody (which plays the note, then you copy), this tests internal pitch memory.

**Technical approach:**
- New `sight-singing/` exercise directory
- Note sequence generator that produces progressively harder patterns (stepwise -> skips -> leaps)
- Simple staff renderer using Canvas 2D (treble clef, notes on lines/spaces -- no fancy engraving needed)
- Scoring: compare sung pitch sequence to target sequence using DTW from `shazam/dtw.ts`
- Difficulty levels: C major only -> all keys -> chromatic

**Effort:** Medium-High (3-4 days) | **Value:** High -- core musicianship skill, no competitor does this well in-browser

---

## Summary Table

| # | Feature | Category | Effort | Value | Dependencies |
|---|---------|----------|--------|-------|-------------|
| 1 | Adaptive Difficulty Engine | Practice Intelligence | Medium | High | exercise-history-store |
| 2 | Weakness Drill Generator | Practice Intelligence | Medium-High | High | exercise-history-store, challenge-drill-generator |
| 3 | Practice Summary Dashboard | Practice Intelligence | Medium | High | exercise-history-store, streak-service |
| 4 | Formant Visualization | Audio/Algorithm | High | Medium | pitch-detector, PitchCanvas |
| 5 | Mic Latency Calibration | Audio/Algorithm | Medium | Medium-High | AudioEngine, settings-store |
| 6 | Pitch Accuracy Heatmap | Audio/Algorithm | Medium | High | OfflinePitchCanvas, piano-roll |
| 7 | Jam Room Chat | Social | Medium | Medium | Durable Objects, JamPanel |
| 8 | Routine Sharing via URL | Social | Low | Medium | share-codec, use-daily-routine |
| 9 | Exercise Leaderboard Filtering | Social | Low-Medium | Medium | leaderboard-service |
| 10 | Keyboard Shortcuts | UX | Low-Medium | High | stores, utils |
| 11 | Onboarding Flow | UX | Medium | High | VoiceTypeDetectorModal, WelcomeScreen |
| 12 | Practice Timer | UX | Low | Medium | mic-store, notifications-store |
| 13 | Theme Auto-Switch + Accent | UX | Low-Medium | Medium | theme-store, CSS variables |
| 14 | Rhythm Accuracy Exercise | New Exercise | Medium | High | onset-detector, use-base-exercise |
| 15 | Sight-Singing Exercise | New Exercise | Medium-High | High | dtw, Canvas 2D |

---

## Recommended Priority (Quick Wins First)

1. **Keyboard Shortcuts** (#10) -- Low effort, high value, every app should have this
2. **Routine Sharing via URL** (#8) -- Low effort, reuses existing share infra
3. **Practice Timer** (#12) -- Low effort, vocal health differentiator
4. **Adaptive Difficulty** (#1) -- Medium effort, transforms static exercises into dynamic ones
5. **Rhythm Accuracy Exercise** (#14) -- Fills the biggest gap in the exercise suite
6. **Onboarding Flow** (#11) -- Directly impacts user retention
7. **Pitch Accuracy Heatmap** (#6) -- Visual wow factor, core value prop
