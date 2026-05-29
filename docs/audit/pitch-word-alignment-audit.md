# Pitch-Word Alignment: Audit & Configuration Reference

**Date**: 2026-05-30
**Status**: Phase 1 + Phase 2 + Phase 2b complete

---

## Architecture Overview

The pitch-word alignment system maps whisper-transcribed word timestamps to
detected pitch notes, producing `AlignedWord[]` with note/midi/confidence data.

### Data Flow

```
Audio -> PitchDetector -> rawDetections -> mergeConsecutiveNotes -> MergedNote[] (raw)
                                        -> segmentPitchesToNotes -> MelodyItem[] -> melodyItemsToMergedNotes -> MergedNote[] (denoised)

Audio -> WhisperService -> WhisperSegment[] -> filterWordSegments -> splitMultiWordSegments -> filtered segments

MergedNote[] + filtered segments -> alignPitchToWords() -> AlignmentResult { alignedWords, debugEntries }
```

### Note Sources

| Source | Quality | Where Used | Description |
|--------|---------|------------|-------------|
| `offlineMergedNotes` | Raw | StemMixer (fallback) | Direct merge of adjacent same-pitch detections |
| `offlineSegmentedNotes` | Denoised | StemMixer (default) | Clarity-filtered, dropout-bridged, singleton-stripped |
| `segmentedNotes` | Denoised | PitchTestingTab (default) | Same algorithm via `segmentPitchesToNotes()` |
| `analysisResults[0].pitches` | Raw | PitchTestingTab (toggle off) | Raw pitch samples -> mergeConsecutiveNotes |
| Realtime pitch history | Raw | StemMixer (last resort) | Live pitch detections from AudioWorklet |

---

## Configurable Parameters

### AlignmentConfig (`pitch-word-alignment.ts`)

```typescript
interface AlignmentConfig {
  minOverlapRatio?: number  // Default: 0.1 (10%)
}
```

| Parameter | Default | Effect | Tuning Notes |
|-----------|---------|--------|-------------|
| `minOverlapRatio` | 0.1 | Minimum overlap ratio to count word as "mapped" | Lower = more mapped but noisier; higher = fewer but more confident |

### segmentPitchesToNotes (`note-segmenter.ts`)

| Parameter | Default | Effect |
|-----------|---------|--------|
| `minClarity` | 0.6 (global), 0.7 (StemMixer controller) | Pitch confidence threshold |
| `minDuration` | 0.08s | Minimum note length |
| `maxGap` | 0.1s | Max gap to bridge within same pitch |
| `pitchTolerance` | 0.5 semitones | Tolerance for pitch continuity |
| `dropoutBridgeMax` | 0.2s | Look-ahead for same-pitch resumption |

### filterWordSegments

Filler pattern: `/^\[.*\]$|^\(.*\)$|^[.,;:!?...music_symbol~\-en_dash em_dash]+$|^$/`

Filters out: `[Music]`, `(laughing)`, `[applause]`, punctuation-only, unicode music symbols.

---

## Algorithm Improvements (This Session)

### Binary Search for Note Lookup

**Before**: O(W * N) full scan of all notes for each word.
**After**: O(W * log N) binary search to find the first overlapping note, then forward scan with early termination.

### Minimum Overlap Threshold

Words with < 10% temporal overlap with a note are now treated as unmapped.
This prevents spurious mappings where a word barely touches a note edge.

### Expanded Filler Filter

Added support for parenthesized tags `(Music)`, unicode music symbols, dashes, and commas.

### Debug Entries

Each alignment now produces `AlignmentDebugEntry[]` with:
- Word index, text, time range
- Mapped note name, MIDI, time range
- Overlap duration and confidence ratio
- For unmapped words: nearest note name and gap distance

---

## Denoised vs Raw Alignment

### StemMixer

Default: **denoised** (via `offlineSegmentedNotes` from the pitch analysis controller).
Toggle via browser console:
```javascript
window.__stemMixerDebug.setUseDenoised(false)  // switch to raw
window.__stemMixerDebug.setUseDenoised(true)   // back to denoised
```

### PitchTestingTab

Controlled by the "Denoised Melody" toggle (`showSegmentedNotes`).
When ON: uses `segmentedNotes` (denoised). When OFF: uses raw analysis pitches.

---

## Console Logging

After transcription completes, both StemMixer and PitchTestingTab log:

1. **Summary**: `[StemMixer] Word-to-note alignment: 200/248 mapped (81%), 48 unmapped`
2. **Note source**: `[StemMixer] Alignment using denoised notes (150 notes, 248 words)`
3. **Map pairs table**: Per-word mapping with time ranges, note names, confidence, overlap
4. **JSON debug entries**: Full `AlignmentDebugEntry[]` for copy-paste into test fixtures

---

## Vertical Offset Fix (StemMixerLyricsPanelBody)

**Problem**: Unmapped lyric words were wrapped in `.sm-lyrics-word-with-note` (a flex column container), causing vertical offset even when no note label was shown.

**Fix**: Only wrap in `.sm-lyrics-word-with-note` when `noteLabel` is non-null. Unmapped words render as plain `<span class="sm-lyrics-word">` without the flex container.

---

## PitchTestingTab Canvas Wiring (Phase 2b)

**Problem**: `OfflinePitchCanvas` lacked props for `showLyricLabels` and `alignedWords`. The toggle did nothing.

**Fix**:
- Added `showLyricLabels` and `alignedWords` props to `OfflinePitchCanvasProps`
- Canvas draw loop now renders aligned word text below note blocks when `showLyricLabels` is enabled
- `PitchTestingTab` passes `activeAlignment().alignedWords` and `showLyricLabels()` to the canvas

---

## Next Steps

1. **Fuzzy word matching**: Compare whisper output to uploaded lyric text for correction
2. **UI toggle for denoised/raw**: Add visual toggle in StemMixer Vocal Pitch panel
3. **Real data testing**: User to provide additional test data for further tuning
4. **Scale-aware alignment**: Use detected key/scale to filter pitch notes
5. **Per-word LRC sync**: Use word-level LRC timestamps when available
