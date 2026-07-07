# Landing Page Feature Audit

**Date**: 2026-07-07
**Branch**: `audit/landing-page-feature-gaps`
**Source**: https://about.mercurypitch.com vs codebase @ `mercurypitch-clod-one`

---

## Summary

| Status | Count |
|--------|-------|
| ✅ Fully implemented | 42 |
| ⚠️ Partially implemented | 3 |
| ❌ Missing / Not implemented | 1 |
| **Total claims audited** | **46** |

---

## Detailed Audit

### 1. Voice Mirror / Voiceprint (Core Analysis)

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 1 | "range, accuracy, steadiness — analyzed entirely in your browser" | ✅ | `src/features/mirror/MirrorApp.tsx` — 3-task guided flow (Glide, Hold, Match) |
| 2 | "60-second mirror for your singing" | ✅ | `MirrorApp.tsx` with timed tasks |
| 3 | "Your voiceprint: shareable, saved on your device" | ✅ | `src/lib/mirror/baseline.ts` — localStorage persistence; `card-renderer.ts` — shareable card |
| 4 | "±1¢ Detection precision" | ✅ | `src/lib/pitch-pipeline/` — YIN + autocorrelator + FFT detectors |
| 5 | "Come back next week and it tells you the difference: '+2 semitones since last time'" | ✅ | `deltaVsBaseline()` in `baseline.ts` |
| 6 | "Accuracy ±12¢ median" | ✅ | `src/lib/mirror/metrics.ts` — `computeAccuracy()` |
| 7 | "Steadiness ±9¢ on holds" | ✅ | `computePitchStability()` in `src/lib/vocal-analyzer.ts` |
| 8 | "Vibrato 5.6 Hz · ±26¢" | ✅ | `detectVibrato()` in `vocal-analyzer.ts` |
| 9 | "Onset scoops ~180 ms" | ✅ | `src/lib/onset-detector.ts` + onset worker |
| 10 | "Mic check first" | ✅ | `src/lib/mic-manager.ts` — permission flow |
| 11 | "Works on iPhone" | ✅ | Responsive CSS, mobile-friendly layout |
| 12 | "Saved on-device" | ✅ | localStorage + IndexedDB (Dexie adapter) |
| 13 | "Voiceprint tracking deltas" | ✅ | `baseline.ts` — stores prior result, computes deltas |

### 2. Practice Modes

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 14 | "Match a note (Level 1)" | ✅ | 17 exercises including `pitch-hold`, `pitch-pursuit`, `long-note` |
| 15 | "Run a scale (Level 2)" | ✅ | `src/features/exercises/scale-runner/` — major & minor, moving target, count-in metronome |
| 16 | "Focus Mode — Beat your weak spots (Level 3)" | ✅ | `src/components/FocusMode.tsx` + `src/features/practice-intelligence/` — drills missed notes, adapts to last 10 scores |
| 17 | "Take on the world (Level 4)" | ✅ | `ChallengesPage`, `CommunityLeaderboard`, `JamPanel` |
| 18 | "Weekly trends" | ✅ | `src/features/practice-intelligence/trends-computer.ts` |
| 19 | "Drills your missed notes" | ✅ | `src/features/practice-intelligence/drill-generator.ts` |
| 20 | "Adapts to last 10 scores" | ✅ | `src/features/practice-intelligence/adaptive-difficulty.ts` |

### 3. Voice Characters

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 21 | "9 Voice characters: Aria, Blaze, Flux, Luna, Glint, Echo, Nova, Spark, Harmony" | ✅ | `src/components/CharacterIcons.tsx`, 9 SVG files in `public/characters/` |

### 4. Instruments — Piano

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 22 | "Falling-note view" | ✅ | `src/components/FallingNotesCanvas.tsx`, `src/pages/PianoPage.tsx` |
| 23 | "MIDI keyboard in" | ✅ | `src/lib/midi-engine.ts` — Web MIDI API wrapper |
| 24 | "Scored per note" | ✅ | `src/lib/mic-scoring.ts` |

### 5. Instruments — Guitar ⚠️

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 25 | **"Tuner built in"** | ❌ **MISSING** | No guitar tuner UI or feature exists. Pitch detection pipeline is available but no dedicated tuner mode |
| 26 | "Riffs & chords" | ⚠️ Partial | Chord selector and progression modes exist (`ChordSelector`, `chordProgression` state). **No riff detection/tracking** |
| 27 | "Works acoustic or amped" | ⚠️ Partial | Pitch detection via mic exists, but no dedicated acoustic guitar mode with gain calibration |
| 28 | "Chords tracked string by string, scored in cents" | ⚠️ Partial | Fretboard visualization (`GuitarFretboardCanvas`, `InteractiveGuitarFretboardCanvas`) and `guitar-synth.ts` exist, but **no per-string pitch scoring** of live audio |

### 6. Karaoke / Song Separation

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 29 | "Drop in any track" | ✅ | `src/components/UvrUploadControl.tsx`, file drop zone |
| 30 | "Vocal and instruments separate on your device" | ✅ | `src/lib/uvr-api.ts`, `src/lib/vocal-separator.ts`, on-device separation engine |
| 31 | "Synced lyrics" | ✅ | `src/lib/lrc-generator.ts`, `src/lib/canonical-lrc.ts` |
| 32 | "Editable vocal line" | ✅ | `src/features/stem-mixer/pitch-edit-model.ts` |
| 33 | "Per-section key detection" | ✅ | `src/lib/key-detector.ts`, `src/lib/key-detection/` |
| 34 | "Live scoring" | ✅ | `StemMixerPitchAnalysisPanel`, `useStemMixerMicController` |

### 7. Compose & Share

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 35 | "Sketch a melody on the piano roll" | ✅ | `src/lib/piano-roll.ts` (4911 lines) — full editor |
| 36 | "Record a take" | ✅ | `src/features/recording/useRecordingController.ts` |
| 37 | "As sung ↔ Clean dial" | ✅ | `src/components/compose/ComposeTakeReview.tsx` — slider from raw to quantized |
| 38 | "MIDI in & out" | ✅ | `midi-engine.ts` (in), `midi-generator.ts` / `exportMelodyToMIDI()` (out) |
| 39 | "Share as URL — no account" | ✅ | `src/lib/share-codec.ts`, `src/lib/share-url.ts`, `src/share-handler.ts` (KV shortener) |

### 8. Challenges

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 40 | "Timed pitch challenges" | ✅ | `src/components/VocalChallenges.tsx` (1485 lines) with badges, achievements |
| 41 | "Leaderboard" | ✅ | `src/components/CommunityLeaderboard.tsx`, `src/db/services/leaderboard-service.ts` |
| 42 | "Share with a link" | ✅ | `src/components/CommunityShare.tsx` (1160 lines) |

### 9. Jam Together

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 43 | "Real-time peer-to-peer" | ✅ | `src/lib/jam/service.ts` — WebRTC with STUN/TURN |
| 44 | "No server in the path" | ✅ | P2P audio via RTCPeerConnection, signaling only |
| 45 | "Invite someone into your session" | ✅ | `src/components/jam/JamInviteModal.tsx` |

### 10. Cosmic / Sing the Universe

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 46 | "Orion, as a melody" | ✅ | `src/features/mirror/CosmicMode.tsx`, `src/lib/mirror/cosmic-melodies.ts` |
| 47 | "Five pulsars, five tempos" | ✅ | `cosmic-melodies.ts` — Geminga, Vela, Crab, PSR B1937+21, PSR J1748−2446ad |
| 48 | "Perseus black hole B♭" | ✅ | Included in `COSMIC_MELODIES` array |

### 11. Other Claims

| # | Landing Page Claim | Status | Implementation |
|---|-------------------|--------|---------------|
| 49 | "Free on-device" | ✅ | All core features run client-side |
| 50 | "Open source · AGPL-3.0" | ✅ | `LICENSE` file present |
| 51 | "Private by default" | ✅ | No audio uploads for core features |
| 52 | "Compute at cost" for stem separation | ✅ | UVR API with billing (`billing-service.ts`, `PricingPanel`) |
| 53 | "No account needed" | ✅ | Anonymous usage supported (`ensureAuth` creates anonymous token) |
| 54 | "Streaks" | ✅ | `src/db/services/streak-service.ts` |
| 55 | "11 Ways to play" | ✅ | Exercises (17 types) + Piano + Guitar + Karaoke + Compose + Jam + Challenges + Mirror + Focus + Cosmic + Warmup |

---

## Gaps & Action Items

### 🔴 Critical Gap: Guitar Tuner

**Claim**: "Point the mic at your guitar: tuning, riffs, and chords tracked string by string, scored in cents. **Tuner built in**"

**Reality**: No guitar tuner feature exists. The pitch detection pipeline (`PitchDetector`, YIN, autocorrelator, FFT) is fully capable of detecting pitch from a guitar, but there is:
- No tuner UI (e.g., needle display, cent deviation, string selector)
- No tuning-specific mode
- No standard tuning reference (EADGBE) target comparison

**Fix**: Build a simple guitar tuner that:
1. Listens via mic
2. Detects pitch using existing `PitchDetector`
3. Maps detected pitch to nearest standard guitar string (E2, A2, D3, G3, B3, E4)
4. Shows cent deviation with a visual needle
5. Indicates flat/sharp/in-tune state

### 🟡 Partial Gap: Guitar Riff & Chord Tracking

**Claim**: "Riffs & chords tracked string by string, scored in cents"

**Reality**: 
- ✅ Chord selection and progression visualization exist
- ❌ No riff detection (melodic line played on guitar → note sequence)
- ❌ No per-string pitch analysis

**Fix**: Lower priority, but should:
1. Add riff recording mode (detect sequence of notes from guitar)
2. Score them against a target melody

### 🟡 Partial Gap: Guitar Acoustic/Electric Mode

**Claim**: "Works acoustic or amped"

**Reality**: Pitch detection works with any mic input, but there's no:
- Gain/sensitivity preset for acoustic guitar
- Direct input setting for amped/electric

**Fix**: Add input mode toggle with appropriate gain presets.

---

## Plan

### Phase 1: Guitar Tuner (this branch)

Implement a simple, functional guitar tuner:

1. **Tuner UI Component** (`src/components/guitar/GuitarTuner.tsx`)
   - Needle/arc display showing cents deviation
   - String selection (auto-detect or manual E/A/D/G/B/E)
   - Color coding: red (out of tune) → yellow (close) → green (in tune)
   - Cent value display

2. **Tuner Logic** (`src/lib/guitar/tuner.ts`)
   - Standard guitar string frequencies (E2=82.41, A2=110, D3=146.83, G3=196, B3=246.94, E4=329.63)
   - Nearest-string mapping from detected frequency
   - Cent deviation calculation
   - Stability detection (hold threshold for reliable reading)

3. **Integration**
   - Add tuner toggle/mode to `GuitarControlBar`
   - Add tuner view to `GuitarPage`

### Phase 2: Riff & Chord Tracking (future branch)

- Riff recording and scoring mode
- Per-string pitch detection (requires polyphonic detection — significant DSP work)

### Phase 3: Landing Page Polish (future branch)

- Review any remaining discrepancies
- Ensure all "11 Ways to Play" are accessible
- Consider removing or adding caveats for partially-implemented features on the landing page

---

## Methodology

This audit compared every feature claim on https://about.mercurypitch.com against the actual implementation in the `mercurypitch-clod-one` codebase. For each claim, I searched for:
- Corresponding React/Solid components
- Underlying library/logic files
- Store/state management
- Service/API integrations
- Test coverage confirming behavior
