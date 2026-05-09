# Mic Input Pitch Comparison — StemMixer Feature

## Overview

Allow the user to sing into the microphone while the StemMixer plays, compare mic pitch in real-time against the vocal stem pitch, show visual "diff" lines live, and produce a score at song end.

## User Story

1. User opens StemMixer with a track that has a vocal stem
2. User clicks a mic toggle button in the StemMixer toolbar
3. Browser asks for mic permission
4. During playback, the pitch canvas shows TWO pitch lines:
   - Vocal stem pitch (existing color — green/accent)
   - Mic input pitch (new color — blue/cyan) overlaid on the same canvas
5. Vertical "diff" bars/lines between the two pitches show discrepancy in real-time
6. At song end (or when user stops), a score summary appears: accuracy %, average cents off, section breakdown

## Technical Design

### Audio Pipeline

```
[Existing]                              [New]
Vocal Stem Buffer                        getUserMedia() mic stream
  -> AudioBufferSourceNode                -> MediaStreamAudioSourceNode
  -> GainNode                             -> micGainNode
  -> vocalAnalyser                        -> micAnalyser (createAnalyser, fftSize=2048)
  -> timeDomainData                       -> timeDomainData
  -> pitchDetector.detect()               -> micPitchDetector.detect()
  -> setCurrentPitch()                    -> setMicPitch()
```

Both pitch detectors run in the same RAF tick loop. The StemMixer's existing `AudioContext` handles both sources — no second context needed.

### New Signals

```ts
const [micEnabled, setMicEnabled] = createSignal(false)
const [micActive, setMicActive] = createSignal(false)        // true when stream is live
const [micPitch, setMicPitch] = createSignal<PitchResult | null>(null)
const [micStream, setMicStream] = createSignal<MediaStream | null>(null)
const [micGainNode, setMicGainNode] = createSignal<GainNode | null>(null)
const [micAnalyserNode, setMicAnalyserNode] = createSignal<AnalyserNode | null>(null)
const [micPitchHistory, setMicPitchHistory] = createSignal<PitchHistoryEntry[]>([])
const [score, setScore] = createSignal<MicScore | null>(null)  // null = no score yet
const [showScore, setShowScore] = createSignal(false)

interface PitchHistoryEntry {
  time: number          // seconds elapsed
  noteName: string
  frequency: number
  octave: number
}

interface MicScore {
  totalNotes: number       // number of comparison points
  matchedNotes: number     // notes where mic was within tolerance
  accuracyPct: number      // matchedNotes / totalNotes * 100
  avgCentsOff: number      // average cents deviation across all notes
  sectionBreakdown: Array<{
    startTime: number
    endTime: number
    label: string          // "Verse 1", "Chorus", etc.
    accuracyPct: number
    avgCentsOff: number
  }>
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}
```

### RAF Tick Loop Changes

Inside the existing `tick()` callback (after `setCurrentPitch()`):

```ts
if (micEnabled() && micAnalyserNode()) {
  const micData = new Float32Array(PITCH_FFT_SIZE)
  micAnalyserNode()!.getFloatTimeDomainData(micData)
  const mp = micPitchDetector!.detect(micData)
  setMicPitch(mp.frequency > 0 ? mp : null)
  if (mp.frequency > 0) {
    setMicPitchHistory(prev => [...prev.slice(-4800), {
      time: elapsedTime, noteName: mp.noteName, frequency: mp.frequency, octave: mp.octave
    }])
    // Real-time comparison
    if (currentPitch() !== null) {
      const vocalSemitones = freqToSemitones(currentPitch()!.frequency)
      const micSemitones = freqToSemitones(mp.frequency)
      const centsOff = (micSemitones - vocalSemitones) * 100
      // Collect for scoring — pushed to a comparison buffer
      setComparisonData(prev => [...prev.slice(-12000), {
        time: elapsedTime, vocalNote: currentPitch()!.noteName,
        micNote: mp.noteName, centsOff, inTolerance: Math.abs(centsOff) <= toleranceCents
      }])
    }
  }
}
```

### Pitch Canvas Rendering Changes (`drawPitchCanvas`)

Two approaches visible simultaneously:

1. **Vocal stem pitch**: Keep existing "Melodyne-style pills" (filled bars)
2. **Mic pitch**: Draw as thin line/stroke only (no fill) in cyan/blue, overlaid on same canvas grid
3. **Diff visualization**: When both are active, draw semi-transparent vertical lines between vocal pitch Y position and mic pitch Y position — red when difference > tolerance, yellow when marginal, green when matching

Colors:
- Vocal stem: `#58a6ff` (accent blue)
- Mic pitch: `#ff6b8a` (contrasting pink/rose — easy to distinguish)
- Diff bar: `rgba(251, 160, 80, 0.4)` orange/amber for cents difference

### Mic Toggle Button

Insert in the StemMixer toolbar (near play/pause/stop buttons or in the controls panel):

```html
<button class="sm-mic-toggle-btn" onClick={toggleMic} title="Toggle microphone pitch comparison">
  <svg viewBox="0 0 24 24" width="14" height="14">
    <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
</button>
```

States:
- Default: muted icon (gray)
- Active/recording: filled icon (accent color + subtle pulse animation)
- Permission denied: icon with X (red, shows tooltip)

### `toggleMic()` Handler

```ts
const toggleMic = async () => {
  if (micActive()) {
    // Stop mic
    micStream()?.getTracks().forEach(t => t.stop())
    if (micGainNode()) micGainNode()!.disconnect()
    if (micAnalyserNode()) micAnalyserNode()!.disconnect()
    setMicStream(null)
    setMicGainNode(null)
    setMicAnalyserNode(null)
    setMicActive(false)
    setMicEnabled(false)
    micPitchDetector = null
  } else {
    // Start mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      })
      const source = audioCtx!.createMediaStreamSource(stream)
      const gainNode = audioCtx!.createGain()
      gainNode.gain.value = 1.0
      const analyser = audioCtx!.createAnalyser()
      analyser.fftSize = PITCH_FFT_SIZE
      analyser.smoothingTimeConstant = 0.3
      source.connect(gainNode)
      gainNode.connect(analyser)
      // Do NOT connect to destination — mic monitoring not needed unless user wants it
      // Option: connect to destination at low volume for latency-free monitoring

      micPitchDetector = new PitchDetector({
        sampleRate: audioCtx!.sampleRate,
        bufferSize: PITCH_FFT_SIZE,
        minConfidence: 0.35,
        minAmplitude: 0.01,
      })

      setMicStream(stream)
      setMicGainNode(gainNode)
      setMicAnalyserNode(analyser)
      setMicActive(true)
      setMicEnabled(true)
      setMicPitchHistory([])
      setScore(null)
      setShowScore(false)
    } catch (err) {
      // Show toast or inline error
      setMicEnabled(false)
    }
  }
}
```

### Scoring

Comparison data is collected continuously during playback into a buffer:

```ts
const [comparisonData, setComparisonData] = createSignal<ComparisonPoint[]>([])
const [toleranceCents, setToleranceCents] = createSignal(50) // default tolerance

interface ComparisonPoint {
  time: number
  vocalNote: string
  micNote: string
  centsOff: number      // positive = mic is sharp, negative = flat
  inTolerance: boolean
}
```

Score is computed when playback stops or finishes:

```ts
const computeScore = (): MicScore => {
  const data = comparisonData()
  if (data.length === 0) return { totalNotes: 0, matchedNotes: 0, accuracyPct: 0, avgCentsOff: 0, sectionBreakdown: [], grade: 'D' }

  const total = data.length
  const matched = data.filter(d => d.inTolerance).length
  const avgCents = data.reduce((s, d) => s + Math.abs(d.centsOff), 0) / total
  const accuracy = matched / total * 100

  // Grade thresholds
  const grade = accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D'

  return { totalNotes: total, matchedNotes: matched, accuracyPct: Math.round(accuracy), avgCentsOff: Math.round(avgCents), sectionBreakdown: [], grade }
}
```

Score display: small card/popover in the StemMixer panel that appears when playback ends and mic was active. Shows grade prominently with breakdown numbers.

### CSS for Diff Visualization

The diff visualization is drawn on canvas — no CSS needed for the lines. CSS needed only for:
- `.sm-mic-toggle-btn` — toolbar button styling
- `.sm-mic-toggle-btn--active` — lit state when mic is live
- `.sm-mic-score-card` — score summary card
- `.sm-mic-grade` — big grade letter

### Section Breakdown (Future Enhancement)

If lyrics with block data are available, sections can be labeled:
- Use the existing `blocks` and `blockInstances` signals
- Map `comparisonData` time ranges to block instances
- Compute per-section accuracy in `computeScore()`

This is a nice-to-have — initial implementation can skip it.

## Files Changed

| File | Changes |
|------|---------|
| `src/components/StemMixer.tsx` | New signals, `toggleMic()` handler, mic pitch detection in tick loop, pitch canvas drawing changes (dual-pitch + diffs), mic toggle button, score display |

All changes are in StemMixer.tsx only — no new files required. The existing `PitchDetector` class is reused.

## Implementation Phases

### Phase 1: Core Mic Input (estimated: medium effort)
1. Add mic signals (`micEnabled`, `micActive`, `micPitch`, `micStream`, etc.)
2. Implement `toggleMic()` handler
3. Add mic pitch detection in RAF tick loop
4. Add mic toggle button to StemMixer transport toolbar
5. CSS for the mic button

### Phase 2: Visualization (estimated: medium effort)
1. Modify `drawPitchCanvas()` to overlay mic pitch as thin colored line
2. Add vertical diff bars between vocal and mic pitch positions
3. Color-code diffs based on tolerance (green/yellow/red)

### Phase 3: Scoring (estimated: small effort)
1. Add comparison data buffer
2. Implement `computeScore()`
3. Score card UI on playback stop/end
4. Grade display with breakdown

### Phase 4: Polish (estimated: small effort)
1. Tolerance setting (maybe in controls panel)
2. Mic monitoring toggle (hear own voice)
3. Section breakdown from block data
4. Save scores to localStorage per session

## Open Questions

1. **Mic monitoring**: Should the user hear their own voice through the speakers? Or just see the visual feedback? (Default: no monitoring, visual only — less latency/pitch issues)
2. **Tolerance range**: Default 50 cents (half a semitone)? Adjustable?
3. **Score persistence**: Save scores per session in localStorage? Show history?
4. **Section breakdown**: Tie into existing block system from the start, or add later?
