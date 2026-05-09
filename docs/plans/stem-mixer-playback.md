# StemMixer Playback — Stem Mixing with Volume Control & Note Visualization

## Context
Users have no way to actually use their separated stems. UvrResultViewer has "Practice with Vocal", "Practice Instrumental", etc. buttons but they call `onPracticeStart()` which isn't wired to real playback. The user wants:
1. Play back vocal + instrumental stems simultaneously with per-stem volume
2. See a Melodyne-style pitch visualization from the vocal stem
3. Karaoke-style timeline/loudness display
4. High-quality, beautiful UI matching the app's dark theme

## Architecture Decision
Create a **standalone StemMixer component** with its own `AudioContext` and Web Audio API usage. It does NOT extend or modify the existing `AudioEngine` class — that class is designed for oscillator synthesis and the practice pipeline (mic input, pitch detection during live singing). Mixing them would break both.

## Files to Create

### `src/components/StemMixer.tsx`
Standalone component with its own embedded CSS string export.

**State & Props:**
```ts
interface StemMixerProps {
  stems: {
    vocal?: string       // URL to vocal WAV file
    instrumental?: string // URL to instrumental WAV file
    vocalMidi?: string    // URL to MIDI file (future use)
  }
  sessionId: string
  onClose: () => void
}
```

**Core audio pipeline:**
- Own `AudioContext` (lazy-init on first user gesture)
- `fetch()` + `decodeAudioData()` to load stem WAVs as `AudioBuffer`
- Per-stem chain: `AudioBufferSourceNode → GainNode → AnalyserNode → destination`
- Per-stem volume: each chain has its own `GainNode` controlled by slider
- Synchronized playback: both stems started at same `audioCtx.currentTime`
- Vocal chain also feeds a dedicated `AnalyserNode` (fftSize 2048) for pitch detection

**Transport controls:**
- Play/Pause toggle (resume/suspend AudioContext)
- Stop (disconnect sources, reset to beginning)
- Progress bar showing `elapsed / totalDuration` — updated via `requestAnimationFrame` loop

**Per-stem controls:**
- Vertical volume slider (like VolumeGroup pattern)
- Solo button (mutes other stems)
- Mute button
- Stem label with colored indicator (amber=vocal, blue=instrumental)

**Visualizations:**
- Waveform overview for each stem (small canvas, pre-rendered from AudioBuffer peaks)
- Real-time waveform (live analyser data on small canvas)
- Vocal pitch display: runs `PitchDetector` on vocal analyser's time-domain data in rAF loop, shows detected notes as a scrolling piano-roll-style display (notes scroll left as time progresses)

**UI Layout (full-screen modal):**
- Dark glass-morphism overlay using existing modal pattern
- Top bar: stem name, close button
- Left panel (60%): waveform + pitch note visualization area
- Right panel (40%): transport controls, per-stem volume sliders with solo/mute
- Bottom bar: play/pause, stop, progress/seek bar, time display

**Reuses:**
- `PitchDetector` from `src/lib/pitch-detector.ts` — instantiate a new instance for vocal analysis
- `freqToNote` from `src/lib/scale-data.ts` — note name formatting
- `VolumeGroup` slider pattern from `src/components/shared/VolumeGroup.tsx`
- Modal overlay pattern from existing components (`.modal-overlay` + animation)
- CSS variable system: `--bg-primary`, `--bg-secondary`, `--accent`, `--border`, etc.

### Icons to add in `src/components/icons.tsx`
- `Volume2`: speaker with sound waves (for volume)
- `VolumeX`: speaker with X (for mute)
- `SkipBack`: rewind arrow (for restart)
- `SoloStar` or reuse existing: star icon (for solo)

## Files to Modify

### `src/components/UvrPanel.tsx`
- Add `showStemMixer` signal
- When `onPracticeStart` is called (or directly when user clicks practice buttons), set `showStemMixer(true)` with stem URLs from the session's outputs
- Render `<StemMixer>` inside a `<Show when={showStemMixer()}>` block
- Pass stem URLs from `session()?.outputs`

### `src/components/UvrResultViewer.tsx`
- Keep existing practice buttons but wire them differently — instead of calling `props.onStartPractice(mode)` for actual playback, call a new `onOpenMixer` prop that passes stem data
- OR: keep `onStartPractice` but change its contract to open the StemMixer

### `src/components/icons.tsx`
- Add `Volume2`, `VolumeX`, `SkipBack`, `SoloStar` SVG icon components

## Implementation Order
1. Add new icons to `icons.tsx`
2. Create `StemMixer.tsx` with full audio pipeline + UI
3. Modify `UvrPanel.tsx` to render StemMixer
4. Wire practice buttons in `UvrResultViewer.tsx`
5. Type check + build

## Verification
1. `npm run typecheck` — no TS errors
2. `npm run build` — builds cleanly
3. Upload a file through UVR, wait for processing to complete
4. Click "Practice with Vocal" or "Practice Full Mix" → StemMixer opens
5. Play button → both stems play synchronized; pause works; stop resets
6. Adjust vocal volume slider → vocal gets quieter relative to instrumental
7. Solo vocal → only vocal plays; unsolo restores both
8. Mute instrumental → only vocal plays
9. Vocal pitch visualization shows notes scrolling during playback
10. Close button returns to session results view
