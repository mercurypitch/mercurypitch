# MIDI Channel in StemMixer + Filename + Progress Indicator

## Context

Currently MIDI export works (downloads a valid .mid file), but:
1. The filename is generic (`vocal_midi.mid`) — doesn't include the original song name
2. StemMixer has no MIDI playback capability — when practice mode is `'midi'`, it just shows vocal+instrumental stems with no MIDI rendering
3. No progress feedback during MIDI generation — user clicks download and waits with no indication

Goal: When user enters "midi" practice mode, show a MIDI channel in StemMixer with synthesized audio playback, a pitch canvas displaying MIDI notes with note name labels, a proper filename including the original song name, and a circular progress indicator during generation.

---

## Part A: MIDI Filename with Original Song Name

### A1. Update `UvrPanel.tsx` — `handleExport` and `handleExportSession`

In both functions, replace `a.download = \`${type.replace('-', '_')}${ext}\`` with a filename built from `s.originalFile?.name`:

```ts
const baseName = (s.originalFile?.name ?? 'audio').replace(/\.[^.]+$/, '')  // strip extension
const safeName = baseName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
a.download = `${safeName}_${type.replace('-', '_')}${ext}`
```

This produces e.g. `my_song_vocal_midi.mid` instead of `vocal_midi.mid`.

### A2. Update `UvrResultViewer.tsx` — `handleDownload`

Add `originalFileName?: string` to `ResultViewerProps`. In `handleDownload`, build filename using the same sanitization logic.

### A3. Pass `originalFileName` from UvrPanel to UvrResultViewer

In `UvrPanel.tsx` line ~598, add `originalFileName={session()?.originalFile?.name}` to the `<UvrResultViewer>` props.

---

## Part B: MIDI Channel in StemMixer

### B1. Export MIDI utilities from `midi-generator.ts`

- Export `MidiNoteEvent` interface
- Export `detectNotes` function
- Export `TICKS_PER_BEAT` and `DEFAULT_BPM` constants
- Add and export `synthesizeMidiBuffer(notes, bpm, sampleRate, totalDurationSec)` — uses `OfflineAudioContext` to render MIDI notes as sine-wave audio into an `AudioBuffer`

```ts
export async function synthesizeMidiBuffer(
  notes: MidiNoteEvent[],
  bpm: number,
  sampleRate: number,
  totalDurationSec: number,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDurationSec), sampleRate)
  const beatsPerSec = bpm / 60
  const ticksPerSec = TICKS_PER_BEAT * beatsPerSec
  
  for (const note of notes) {
    const startSec = note.tickOn / ticksPerSec
    const endSec = note.tickOff / ticksPerSec
    const freq = midiToFreq(note.midi)
    
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, startSec)
    gain.gain.linearRampToValueAtTime(0.4, startSec + 0.008)
    gain.gain.setValueAtTime(0.4, endSec - 0.008)
    gain.gain.linearRampToValueAtTime(0, endSec)
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startSec)
    osc.stop(endSec)
  }
  
  return ctx.startRendering()
}
```

### B2. Add `practiceMode` prop to StemMixer

Update `StemMixerProps`:
```ts
interface StemMixerProps {
  stems: { vocal?: string; instrumental?: string; vocalMidi?: string }
  sessionId: string
  songTitle?: string
  practiceMode?: 'vocal' | 'instrumental' | 'full' | 'midi'
  onBack?: () => void
}
```

### B3. Add MIDI track and signals

New signals in StemMixer.tsx:
```ts
const [midiNotes, setMidiNotes] = createSignal<MidiNoteEvent[]>([])
const [midiGenerating, setMidiGenerating] = createSignal(false)
const [midiProgress, setMidiProgress] = createSignal(0)
const [midi, setMidi] = createSignal<StemTrack>({ label: 'MIDI', url: '', color: '#8b5cf6', ... })
```

### B4. Update `loadStems()` for MIDI mode

After loading the vocal AudioBuffer, if `practiceMode === 'midi'`:
1. Set `midiGenerating(true)`
2. Get mono channel data from vocal buffer
3. Call `detectNotes(monoData, sampleRate, (pct) => setMidiProgress(pct))` 
4. Store result in `setMidiNotes(notes)`
5. Call `synthesizeMidiBuffer(notes, DEFAULT_BPM, sampleRate, duration)` to get an AudioBuffer
6. Set the MIDI track's buffer to the synthesized AudioBuffer
7. Set `midiGenerating(false)`

### B5. Update `tracks()`

Include MIDI track when available:
```ts
const tracks = () => [vocal(), instrumental(), midi()].filter(t => t.url || t.buffer)
```

### B6. Update mute/solo/volume controls

Add `'MIDI'` branch to `toggleMute`, `toggleSolo`, and volume slider to handle the third track.

### B7. MIDI Pitch Canvas

Add a new canvas ref: `let midiCanvasRef: HTMLCanvasElement | undefined`

Add `drawMidiCanvas()` function that:
- Uses same grid layout as `drawPitchCanvas` (C-B rows, time-based x-axis)
- Draws MIDI note blocks as rounded rectangles in violet (`#8b5cf6`)
- Labels each block with the note name + octave (e.g., "C4", "D#5") using `midiToNote()` from `scale-data.ts`
- Renders a playhead line synced with `elapsed()`
- Only draws when `midiNotes().length > 0`

Call `drawMidiCanvas()` in: RAF loop, `handlePause`, `handleStop`, `handleRestart`, `seekTo`.

### B8. MIDI Controls UI

Add a third channel row in the mixer panel for MIDI, with:
- Label "MIDI Melody" with violet accent color
- Volume slider
- Mute/Solo buttons
- Download MIDI button (reuses existing pattern)

---

## Part C: Circular Progress Indicator

### C1. Create inline circular progress SVG

Add a `CircularProgress` render helper in `StemMixer.tsx` (inline, not a separate component):

```tsx
const CircularProgress = (props: { pct: number; size?: number }) => {
  const s = props.size ?? 24
  const r = (s - 4) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - props.pct / 100)
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} class="circular-progress">
      <circle cx={s/2} cy={s/2} r={r} fill="none" stroke="var(--border, #30363d)" stroke-width="2" />
      <circle cx={s/2} cy={s/2} r={r} fill="none" stroke="var(--accent, #58a6ff)" stroke-width="2"
        stroke-dasharray={circ} stroke-dashoffset={offset}
        stroke-linecap="round" transform={`rotate(-90 ${s/2} ${s/2})`} />
    </svg>
  )
}
```

### C2. Show progress in StemMixer during MIDI loading

When `midiGenerating()` is true, show the CircularProgress with `midiProgress()` value in the loading overlay, replacing the spinner:

```tsx
<Show when={midiGenerating()}>
  <div class="sm-loading">
    <CircularProgress pct={midiProgress()} size={40} />
    <span>Generating MIDI melody... {midiProgress()}%</span>
  </div>
</Show>
```

### C3. Show progress in download buttons (UvrResultViewer + UvrPanel)

For the download buttons in `UvrResultViewer.tsx`:
- Add a `midiGenerating` signal
- When MIDI download starts, swap the download icon for `CircularProgress`
- When done, trigger the actual download

For `UvrPanel.tsx` `handleExport` / `handleExportSession`:
- Add a `midiExportProgress` signal
- Show a toast or inline progress during export

---

## Files Modified

1. **`src/lib/midi-generator.ts`** — export `MidiNoteEvent`, `detectNotes`, `TICKS_PER_BEAT`, `DEFAULT_BPM`; add `synthesizeMidiBuffer()`
2. **`src/components/StemMixer.tsx`** — add `practiceMode` prop, MIDI track, `drawMidiCanvas()`, MIDI controls, circular progress
3. **`src/components/UvrPanel.tsx`** — pass `practiceMode` + `originalFileName` to children, update download filenames
4. **`src/components/UvrResultViewer.tsx`** — add `originalFileName` prop, circular progress on MIDI download

## Verification

1. `npm run typecheck` — no errors
2. `npm run build` — builds cleanly
3. Test: click "Play" on MIDI stem card → StemMixer opens with MIDI channel
4. Test: MIDI notes appear on the new pitch canvas with note labels (D, E, F, etc.)
5. Test: MIDI audio plays back (synthesized melody audible)
6. Test: MIDI volume/mute/solo controls work
7. Test: Download MIDI from StemMixer → filename includes original song name
8. Test: Download MIDI from session results → filename includes original song name
9. Test: Circular progress appears during MIDI generation
10. Test: Stop/pause/seek — MIDI canvas updates in sync

---

## Task List

- [ ] #236 Export MIDI utilities from midi-generator.ts (MidiNoteEvent, detectNotes, constants, synthesizeMidiBuffer)
- [ ] #237 Add original song name to MIDI download filenames (UvrPanel + UvrResultViewer)
- [ ] #238 Add MIDI channel to StemMixer (practiceMode, track, synthesis, canvas, controls)
- [ ] #239 Add circular progress indicator for MIDI generation
- [ ] #240 Commit and push all changes
