// ============================================================
// StemMixer Audio Controller — audio engine, transport, RAF tick
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { installAudioUnlock, unlockAudio } from '@/lib/audio-unlock'
import type { ComparisonPoint, MicScore } from '@/lib/mic-scoring'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import { buildMidiFile, DEFAULT_BPM, detectNotes, MIDI_NOTE_RANGE, PITCH_DETECTOR_DEFAULTS, synthesizeMidiBuffer, } from '@/lib/midi-generator'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import { freqToMidiFloat } from '@/lib/pitch-pipeline/log-pitch'
import { createOctaveCorrector } from '@/lib/pitch-pipeline/octave-corrector'
import { createRunningMedian } from '@/lib/pitch-pipeline/running-median'
import { freqToMidi, midiToFreq, midiToNote } from '@/lib/scale-data'
import { sliderToGain } from '@/lib/volume-curve'
import type { PitchNote } from './types'

// ── Types ──────────────────────────────────────────────────────

interface StemTrack {
  label: string
  url: string
  color: string
  buffer: AudioBuffer | null
  gainNode: GainNode | null
  analyserNode: AnalyserNode | null
  sourceNode: AudioBufferSourceNode | null
  muted: boolean
  soloed: boolean
  volume: number
}

interface CanvasView {
  syncCanvasSizes: () => void
  drawWaveformOverview: () => void
  drawLiveWaveform: () => void
  drawPitchCanvas: () => void
  drawMidiCanvas: () => void
  isUserPanning?: () => boolean
}

export interface StemMixerAudioDeps {
  // Track signals
  vocal: Accessor<StemTrack>
  setVocal: Setter<StemTrack>
  instrumental: Accessor<StemTrack>
  setInstrumental: Setter<StemTrack>
  midi: Accessor<StemTrack>
  setMidi: Setter<StemTrack>
  tracks: Accessor<StemTrack[]>
  anySoloed: Accessor<boolean>

  // Window
  PITCH_WINDOW_FILL_RATIO: number

  // MIDI state setters
  midiNotes: Accessor<MidiNoteEvent[]>
  setMidiNotes: Setter<MidiNoteEvent[]>

  // Canvas (for RAF tick)
  canvas: CanvasView

  // Lyrics (for RAF tick)
  updateCurrentLine: () => void
  setCurrentLineIdx: (idx: number) => void
  setUserScrolled: (v: boolean) => void

  // Mic comparison (for RAF tick) — simplified in Phase 5a
  micActive: Accessor<boolean>
  getMicAnalyserNode: () => AnalyserNode | null
  getMicPitchDetector: () => PitchDetector | null
  getMicPitchHistory: () => PitchNote[]
  setMicPitch: Setter<DetectedPitch | null>
  comparisonData: Accessor<ComparisonPoint[]>
  /** Feed one RAF frame into the compare engine (0 = unvoiced side). */
  pushComparison: (timeSec: number, refFreq: number, micFreq: number) => void
  /** New loop iteration begins (loop wrap) — scopes the live metrics bar. */
  markLoopIteration: () => void
  /** Drop accumulated comparison data (fresh run after a stop). */
  clearComparisonData: () => void
  resetMicPitchHistory: () => void

  // Scoring (called by handleStop / handleRestart)
  computeScore: () => MicScore
  setScore: Setter<MicScore | null>
  setShowScore: Setter<boolean>
  resetScore: () => void

  // Props
  stems: { vocal?: string; instrumental?: string; vocalMidi?: string }
  practiceMode?: 'vocal' | 'instrumental' | 'full' | 'midi'
  requestedStems?: { midi?: boolean }
  songTitle: string

  /** Karaoke mode: keep the vocal stem silent to the speakers but still tap it
   *  (pre-gain) as the pitch reference for scoring. */
  karaokeReferenceVocal?: Accessor<boolean>
  /** Fired only when playback reaches the end of the track naturally (not on a
   *  manual stop). Used by the karaoke playlist to advance to the next song. */
  onPlaybackEnded?: () => void

  showNotification: (
    msg: string,
    type?: 'info' | 'success' | 'warning' | 'error',
  ) => void
}

export interface StemMixerAudioController {
  // Signals (accessors only — controller owns the signals)
  loading: Accessor<boolean>
  loadError: Accessor<string>
  loadProgress: Accessor<number>
  midiGenerating: Accessor<boolean>
  midiProgress: Accessor<number>
  midiPhase: Accessor<'detecting' | 'synthesizing' | 'rendering'>
  playing: Accessor<boolean>
  elapsed: Accessor<number>
  duration: Accessor<number>
  currentPitch: Accessor<DetectedPitch | null>

  // Window signals
  windowStart: Accessor<number>
  setWindowStart: Setter<number>
  windowDuration: Accessor<number>
  setWindowDuration: Setter<number>

  // Audio engine
  ensureAudioCtx: () => AudioContext
  disconnectSources: () => void
  loadStems: () => Promise<void>

  // Transport
  handlePlay: () => void
  handlePause: () => void
  handleStop: () => void
  handleRestart: () => void
  seekTo: (time: number) => void
  speed: Accessor<number>
  setSpeed: (speed: number) => void

  // Loop
  loopEnabled: Accessor<boolean>
  setLoopEnabled: Setter<boolean>
  loopStart: Accessor<number>
  setLoopStart: Setter<number>
  loopEnd: Accessor<number>
  setLoopEnd: Setter<number>
  clearLoop: () => void
  loopCount: Accessor<number>
  resetLoopCount: () => void

  // Download
  handleDownload: (track: StemTrack) => Promise<void>

  // Pitch history (read by canvas)
  getPitchHistory: () => PitchNote[]
  setPitchHistory: (history: PitchNote[]) => void

  // Ref accessors (for onCleanup)
  getAudioCtx: () => AudioContext | null
  getRafId: () => number
}

// ── Constants ──────────────────────────────────────────────────

const FFT_SIZE = 256
const PITCH_FFT_SIZE = 1024
const FADE_OUT_MS = 50

// ── Controller ─────────────────────────────────────────────────

export const useStemMixerAudioController = (
  deps: StemMixerAudioDeps,
): StemMixerAudioController => {
  // ── Signals (owned by controller) ─────────────────────────────
  const [loading, setLoading] = createSignal(true)
  const [loadError, setLoadErrorLocal] = createSignal('')
  const [loadProgress, setLoadProgressLocal] = createSignal(0)
  const [midiGenerating, setMidiGeneratingLocal] = createSignal(false)
  const [midiProgress, setMidiProgressLocal] = createSignal(0)
  const [midiPhase, setMidiPhaseLocal] = createSignal<
    'detecting' | 'synthesizing' | 'rendering'
  >('detecting')
  const [playing, setPlayingLocal] = createSignal(false)
  const [elapsed, setElapsed] = createSignal(0)
  const [duration, setDuration] = createSignal(0)
  const [currentPitch, setCurrentPitch] = createSignal<DetectedPitch | null>(
    null,
  )
  const [windowStart, setWindowStart] = createSignal(0)
  const [windowDuration, setWindowDuration] = createSignal(30)
  const [speed, setSpeedLocal] = createSignal(1.0)

  // ── Loop signals ────────────────────────────────────────────
  const [loopEnabled, setLoopEnabled] = createSignal(false)
  const [loopStart, setLoopStart] = createSignal(0)
  const [loopEnd, setLoopEnd] = createSignal(0)
  const [loopCount, setLoopCount] = createSignal(0)

  // When the user manually seeks outside the loop region, we stop
  // enforcing the loop boundary until playback re-enters A–B.
  let seekedOutsideLoop = false

  // ── Mutable refs ─────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  let mainGain: GainNode | null = null
  let vocalAnalyser: AnalyserNode | null = null
  let pitchDetector: PitchDetector | null = null
  let rafId = 0
  let wallPlayStart = 0
  let bufferPlayStart = 0
  let playbackSpeed = 1.0
  let pauseOffset = 0
  let pitchHistory: PitchNote[] = []

  // ── Live pitch smoothing ─────────────────────────────────────
  // Raw per-frame detection flickers (single-frame octave/harmonic errors,
  // consonant scrapes) — the same defence the Singing tab's live pipeline
  // uses: a short median plus the shared octave corrector, applied to both
  // the stem reference and the mic before drawing or scoring. Filters reset
  // after a silence gap so a new phrase may start in any octave.
  const SMOOTH_SILENCE_RESET_SEC = 0.25
  interface PitchSmoother {
    median: ReturnType<typeof createRunningMedian>
    octave: ReturnType<typeof createOctaveCorrector>
    lastVoicedAt: number
  }
  const makeSmoother = (): PitchSmoother => ({
    median: createRunningMedian(3),
    octave: createOctaveCorrector({ confirmFrames: 3 }),
    lastVoicedAt: -1,
  })
  let stemSmoother = makeSmoother()
  let micSmoother = makeSmoother()
  const resetSmoothers = (): void => {
    stemSmoother = makeSmoother()
    micSmoother = makeSmoother()
  }

  /** Median + octave-corrected copy of a raw detection; null when unvoiced. */
  const smoothPitch = (
    s: PitchSmoother,
    raw: DetectedPitch,
    timeSec: number,
  ): DetectedPitch | null => {
    if (raw.frequency <= 0) return null
    if (
      s.lastVoicedAt >= 0 &&
      timeSec - s.lastVoicedAt > SMOOTH_SILENCE_RESET_SEC
    ) {
      s.median.reset()
      s.octave.reset()
    }
    s.lastVoicedAt = timeSec
    const midiFloat = s.octave.correct(
      s.median.push(freqToMidiFloat(raw.frequency)),
    )
    const rounded = Math.round(midiFloat)
    const { name, octave } = midiToNote(rounded)
    return {
      frequency: midiToFreq(midiFloat),
      clarity: raw.clarity,
      noteName: name,
      octave,
      cents: Math.round((midiFloat - rounded) * 100),
    }
  }

  // ── Audio Context ────────────────────────────────────────────
  const ensureAudioCtx = () => {
    if (!audioCtx) {
      audioCtx = new AudioContext()
      mainGain = audioCtx.createGain()
      mainGain.gain.value = 0.7
      mainGain.connect(audioCtx.destination)
      vocalAnalyser = audioCtx.createAnalyser()
      vocalAnalyser.fftSize = PITCH_FFT_SIZE
      vocalAnalyser.smoothingTimeConstant = 0.3
      pitchDetector = new PitchDetector({
        sampleRate: audioCtx.sampleRate,
        ...PITCH_DETECTOR_DEFAULTS,
      })
    }
    if (audioCtx.state !== 'running') {
      void audioCtx.resume().catch(() => {
        // Outside a user gesture (iOS) — audio-unlock retries on the next tap.
      })
    }
    return audioCtx
  }

  // iOS: first tap anywhere primes the playback audio session (the ring/silent
  // switch mutes plain WebAudio) and re-resumes a context iOS suspended while
  // the tab was hidden. See src/lib/audio-unlock.ts.
  onCleanup(installAudioUnlock(() => audioCtx))

  // ── Load Stems ───────────────────────────────────────────────
  const loadStems = async () => {
    setLoading(true)
    setLoadErrorLocal('')
    setLoadProgressLocal(0)

    const ctx = ensureAudioCtx()
    const urls = [deps.stems.vocal, deps.stems.instrumental].filter(
      Boolean,
    ) as string[]
    const total = urls.length
    let loadedCount = 0

    const loadOne = async (url: string): Promise<AudioBuffer> => {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
      const arrayBuf = await resp.arrayBuffer()
      const buf = await ctx.decodeAudioData(arrayBuf)
      loadedCount++
      setLoadProgressLocal(Math.round((loadedCount / total) * 100))
      return buf
    }

    try {
      const results = await Promise.allSettled([
        deps.stems.vocal !== undefined
          ? loadOne(deps.stems.vocal)
          : Promise.reject('no vocal'),
        deps.stems.instrumental !== undefined
          ? loadOne(deps.stems.instrumental)
          : Promise.reject('no inst'),
      ])

      const [vocalResult, instResult] = results

      if (vocalResult.status === 'fulfilled') {
        deps.setVocal((prev) => ({ ...prev, buffer: vocalResult.value }))
        const d = vocalResult.value.duration
        if (d > duration()) setDuration(d)
      } else if (deps.stems.vocal !== undefined) {
        console.warn('Failed to load vocal stem:', vocalResult.reason)
      }

      if (instResult.status === 'fulfilled') {
        deps.setInstrumental((prev) => ({ ...prev, buffer: instResult.value }))
        const d = instResult.value.duration
        if (d > duration()) setDuration(d)
      } else if (deps.stems.instrumental !== undefined) {
        console.warn('Failed to load instrumental stem:', instResult.reason)
      }

      if (total > 0 && loadedCount === 0) {
        const msg =
          'Stems could not be loaded. Audio data may have been lost after a page reload.'
        setLoadErrorLocal(msg)
        deps.showNotification(msg, 'warning')
      }

      // MIDI processing
      const needsMidi =
        deps.practiceMode === 'midi' || deps.requestedStems?.midi === true
      if (needsMidi && deps.vocal().buffer) {
        setMidiGeneratingLocal(true)
        setMidiPhaseLocal('detecting')
        setMidiProgressLocal(0)
        try {
          const vocalBuf = deps.vocal().buffer!
          const sampleRate = vocalBuf.sampleRate
          const monoData = vocalBuf.getChannelData(0)
          const notes = await detectNotes(monoData, sampleRate, (pct) =>
            setMidiProgressLocal(pct),
          )
          deps.setMidiNotes(notes)
          if (notes.length > 0) {
            // Reset progress for synthesis phase so user sees activity
            setMidiPhaseLocal('synthesizing')
            setMidiProgressLocal(0)
            const midiBuf = await synthesizeMidiBuffer(
              notes,
              DEFAULT_BPM,
              sampleRate,
              vocalBuf.duration,
              (pct) => {
                setMidiProgressLocal(pct)
                if (pct >= 100) setMidiPhaseLocal('rendering')
              },
            )
            deps.setMidi((prev) => ({ ...prev, buffer: midiBuf }))
          }
        } catch (e) {
          console.error('MIDI generation failed:', e)
        } finally {
          setMidiGeneratingLocal(false)
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load stems'
      setLoadErrorLocal(msg)
      deps.showNotification(`Stem loading failed: ${msg}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Create Source Nodes ──────────────────────────────────────
  const createSources = (offset: number) => {
    const ctx = audioCtx!
    const now = ctx.currentTime

    if (mainGain) {
      try {
        mainGain.gain.cancelScheduledValues(now)
        mainGain.gain.setValueAtTime(mainGain.gain.value, now)
        mainGain.gain.linearRampToValueAtTime(0.7, now + 0.01)
      } catch (_) {
        mainGain.gain.value = 0.7
      }
    }

    for (const track of deps.tracks()) {
      if (!track.buffer) continue

      const isAudible = track.soloed || (!track.muted && !deps.anySoloed())

      // Karaoke: the vocal is the scoring reference but is silenced via the
      // track's `muted` flag (so the mute button + waveform reflect it). We tap
      // it pre-gain below so muting/lowering it doesn't kill the reference.
      const isVocal = track.label === 'Vocal'
      const karaokeRef = isVocal && deps.karaokeReferenceVocal?.() === true

      const src = ctx.createBufferSource()
      src.buffer = track.buffer

      const gain = ctx.createGain()
      const targetGain = isAudible ? sliderToGain(track.volume) : 0
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(targetGain, now + 0.03)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.8

      src.connect(gain)
      gain.connect(analyser)
      analyser.connect(mainGain!)

      if (isVocal && vocalAnalyser) {
        // Pre-gain tap in karaoke mode so a silenced/lowered vocal still drives
        // the pitch reference; post-gain otherwise (unchanged behaviour).
        if (karaokeRef) src.connect(vocalAnalyser)
        else gain.connect(vocalAnalyser)
      }

      src.start(now, offset)
      src.playbackRate.value = playbackSpeed
      src.onended = () => {
        try {
          src.disconnect()
          gain.disconnect()
          analyser.disconnect()
        } catch (_) {
          /* already disconnected */
        }
      }

      if (track.label === 'Vocal') {
        deps.setVocal((prev) => ({
          ...prev,
          sourceNode: src,
          gainNode: gain,
          analyserNode: analyser,
        }))
      } else if (track.label === 'Instrumental') {
        deps.setInstrumental((prev) => ({
          ...prev,
          sourceNode: src,
          gainNode: gain,
          analyserNode: analyser,
        }))
      } else {
        deps.setMidi((prev) => ({
          ...prev,
          sourceNode: src,
          gainNode: gain,
          analyserNode: analyser,
        }))
      }
    }
  }

  const disconnectSources = () => {
    const ctx = audioCtx

    const nodesToDisconnect = deps.tracks().map((track) => ({
      sourceNode: track.sourceNode,
      gainNode: track.gainNode,
      analyserNode: track.analyserNode,
    }))

    if (ctx) {
      const now = ctx.currentTime
      const fadeOutSecs = FADE_OUT_MS / 1000
      const stopTime = now + fadeOutSecs + 0.01
      for (const nodes of nodesToDisconnect) {
        if (nodes.gainNode) {
          try {
            nodes.gainNode.gain.cancelScheduledValues(now)
            nodes.gainNode.gain.setValueAtTime(nodes.gainNode.gain.value, now)
            nodes.gainNode.gain.linearRampToValueAtTime(0, now + fadeOutSecs)
          } catch (_) {
            /* already disconnected */
          }
        }
        if (nodes.sourceNode) {
          try {
            nodes.sourceNode.stop(stopTime)
          } catch (_) {
            /* already stopped */
          }
        }
      }
    }

    deps.setVocal((prev) => ({
      ...prev,
      sourceNode: null,
      gainNode: null,
      analyserNode: null,
    }))
    deps.setInstrumental((prev) => ({
      ...prev,
      sourceNode: null,
      gainNode: null,
      analyserNode: null,
    }))
    deps.setMidi((prev) => ({
      ...prev,
      sourceNode: null,
      gainNode: null,
      analyserNode: null,
    }))

    setTimeout(() => {
      for (const nodes of nodesToDisconnect) {
        try {
          nodes.sourceNode?.disconnect()
        } catch (_) {
          /* */
        }
        try {
          nodes.gainNode?.disconnect()
        } catch (_) {
          /* */
        }
        try {
          nodes.analyserNode?.disconnect()
        } catch (_) {
          /* */
        }
      }
    }, FADE_OUT_MS + 20)
  }

  // ── Speed ────────────────────────────────────────────────────
  const setSpeed = (newSpeed: number) => {
    const clamped = Math.max(0.25, Math.min(2.0, newSpeed))
    if (clamped === playbackSpeed) return
    playbackSpeed = clamped
    setSpeedLocal(clamped)

    if (playing()) {
      const currentElapsed = elapsed()
      disconnectSources()
      createSources(currentElapsed)
      wallPlayStart = audioCtx!.currentTime
      bufferPlayStart = currentElapsed
    }
  }

  // ── Transport ────────────────────────────────────────────────
  const handlePlay = () => {
    // Runs inside the play gesture — the one moment iOS lets us both resume
    // the context and promote the audio session past the silent switch.
    unlockAudio(ensureAudioCtx())
    disconnectSources()
    createSources(pauseOffset)
    wallPlayStart = audioCtx!.currentTime
    bufferPlayStart = pauseOffset
    setPlayingLocal(true)
    pitchHistory = []
    deps.resetMicPitchHistory()
    pitchDetector?.resetHistory()
    resetSmoothers()
    startRafLoop()
  }

  const handlePause = () => {
    pauseOffset = elapsed()
    disconnectSources()
    setPlayingLocal(false)
    cancelAnimationFrame(rafId)
    const { canvas } = deps
    canvas.syncCanvasSizes()
    canvas.drawWaveformOverview()
    canvas.drawPitchCanvas()
    canvas.drawMidiCanvas()
    canvas.drawLiveWaveform()
  }

  const handleStop = () => {
    if (deps.micActive() && deps.comparisonData().length > 0) {
      const s = deps.computeScore()
      deps.setScore(s)
      deps.setShowScore(true)
    }
    // The score modal holds the materialized result — drop the raw data so
    // the next run starts clean instead of averaging with this one.
    deps.clearComparisonData()
    resetSmoothers()
    setLoopCount(0)
    pauseOffset = 0
    disconnectSources()
    setPlayingLocal(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    deps.resetMicPitchHistory()
    deps.setCurrentLineIdx(-1)
    deps.setUserScrolled(false)
    setWindowStart(0)
    cancelAnimationFrame(rafId)
    const { canvas } = deps
    canvas.syncCanvasSizes()
    canvas.drawWaveformOverview()
    canvas.drawPitchCanvas()
    canvas.drawMidiCanvas()
    canvas.drawLiveWaveform()
  }

  const handleRestart = () => {
    deps.resetScore()
    setLoopCount(0)
    pauseOffset = 0
    disconnectSources()
    setPlayingLocal(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    pitchDetector?.resetHistory()
    deps.setCurrentLineIdx(-1)
    deps.setUserScrolled(false)
    setWindowStart(0)
    cancelAnimationFrame(rafId)
    const { canvas } = deps
    canvas.drawWaveformOverview()
    canvas.drawPitchCanvas()
    canvas.drawMidiCanvas()
    canvas.drawLiveWaveform()
    handlePlay()
  }

  const seekTo = (time: number) => {
    pauseOffset = Math.min(time, duration())
    setElapsed(pauseOffset)

    // Track whether this seek lands outside the active loop region
    if (
      loopEnabled() &&
      loopEnd() > 0 &&
      (pauseOffset < loopStart() || pauseOffset > loopEnd())
    ) {
      seekedOutsideLoop = true
    }

    if (playing()) {
      disconnectSources()
      createSources(pauseOffset)
      wallPlayStart = audioCtx!.currentTime
      bufferPlayStart = pauseOffset
      pitchHistory = []
      pitchDetector?.resetHistory()
      resetSmoothers()
      // Close the compare engine's active note — the time jump would
      // otherwise fuse two distant stretches into one fake segment.
      deps.pushComparison(pauseOffset, 0, 0)
    }
    requestAnimationFrame(() => {
      const { canvas } = deps
      canvas.syncCanvasSizes()
      canvas.drawWaveformOverview()
      canvas.drawLiveWaveform()
      canvas.drawPitchCanvas()
      canvas.drawMidiCanvas()
      deps.updateCurrentLine()
    })
  }
  // ── Scroll State ─────────────────────────────────────────────
  let activeAnchor = deps.PITCH_WINDOW_FILL_RATIO
  let isRecentering = false

  // ── RAF Loop ─────────────────────────────────────────────────
  const startRafLoop = () => {
    const tick = () => {
      if (!audioCtx || !playing()) return

      const now = audioCtx.currentTime
      const elapsedTime =
        bufferPlayStart + (now - wallPlayStart) * playbackSpeed
      setElapsed(Math.min(elapsedTime, duration()))

      // Pitch detection from vocal analyser (median + octave-corrected)
      let stemFreq = 0
      if (vocalAnalyser && deps.vocal().buffer) {
        const timeData = new Float32Array(PITCH_FFT_SIZE)
        vocalAnalyser.getFloatTimeDomainData(timeData)
        const raw = pitchDetector!.detect(timeData)
        const pitch = smoothPitch(stemSmoother, raw, elapsedTime)
        setCurrentPitch(pitch)

        if (pitch) {
          const midi = freqToMidi(pitch.frequency)
          if (midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max) {
            stemFreq = pitch.frequency
            pitchHistory.push({
              time: elapsedTime,
              noteName: pitch.noteName,
              frequency: pitch.frequency,
              octave: pitch.octave,
            })
          }
        }
      }

      // Mic pitch detection (same smoothing), judged by the compare engine —
      // octave-agnostic, transition-graced, note-aggregated (see
      // pitch-compare-engine.ts).
      if (deps.micActive()) {
        const micAnalyser = deps.getMicAnalyserNode()
        if (micAnalyser) {
          // Buffer size follows the global setting (mic analyser fftSize), so
          // read its current size rather than a fixed constant.
          const micData = new Float32Array(micAnalyser.fftSize)
          micAnalyser.getFloatTimeDomainData(micData)
          const rawMic = deps.getMicPitchDetector()!.detect(micData)
          const mp = smoothPitch(micSmoother, rawMic, elapsedTime)
          deps.setMicPitch(mp)
          let micFreq = 0
          if (mp) {
            const midi = freqToMidi(mp.frequency)
            if (midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max) {
              micFreq = mp.frequency
              deps.getMicPitchHistory().push({
                time: elapsedTime,
                noteName: mp.noteName,
                frequency: mp.frequency,
                octave: mp.octave,
              })
            }
          }
          deps.pushComparison(elapsedTime, stemFreq, micFreq)
        }
      }

      // Continuous-scroll time window (skip while user is touch-panning)
      if (deps.canvas.isUserPanning?.() === true) {
        activeAnchor = (elapsedTime - windowStart()) / windowDuration()
        isRecentering = false
      } else {
        // Detect external changes to windowStart (like click-to-seek)
        const expectedStart = elapsedTime - activeAnchor * windowDuration()
        if (Math.abs(windowStart() - expectedStart) > 0.05) {
          activeAnchor = (elapsedTime - windowStart()) / windowDuration()
          isRecentering = activeAnchor > 0.85 || activeAnchor < 0.15
        }

        // Gently pull the playhead back to 30% if we entered the danger zone
        if (isRecentering) {
          activeAnchor += (deps.PITCH_WINDOW_FILL_RATIO - activeAnchor) * 0.05
          if (Math.abs(activeAnchor - deps.PITCH_WINDOW_FILL_RATIO) < 0.01) {
            activeAnchor = deps.PITCH_WINDOW_FILL_RATIO
            isRecentering = false
          }
        }

        const newStart = elapsedTime - activeAnchor * windowDuration()
        setWindowStart(Math.max(0, newStart))
      }

      const { canvas } = deps
      canvas.syncCanvasSizes()
      canvas.drawWaveformOverview()
      canvas.drawPitchCanvas()
      canvas.drawMidiCanvas()
      canvas.drawLiveWaveform()
      deps.updateCurrentLine()

      // End detection is meaningless until the buffers report a real duration.
      // Without this guard a tick that runs before decode finishes sees
      // elapsedTime (~0) >= duration() (0) and reports a spurious "natural
      // end" — in a karaoke playlist that instantly skips the song to the
      // score/summary screen (the "second song ends before it starts" bug).
      if (duration() <= 0) {
        rafId = requestAnimationFrame(tick)
        return
      }

      const endTime = loopEnabled() && loopEnd() > 0 ? loopEnd() : duration()

      // If playback re-entered the loop region, clear the escape flag
      if (
        seekedOutsideLoop &&
        loopEnabled() &&
        elapsedTime >= loopStart() &&
        elapsedTime < loopEnd()
      ) {
        seekedOutsideLoop = false
      }

      if (elapsedTime >= endTime) {
        if (loopEnabled() && !seekedOutsideLoop) {
          setLoopCount(loopCount() + 1)
          deps.markLoopIteration()
          seekTo(loopStart())
          rafId = requestAnimationFrame(tick)
          return
        }
        // Outside loop or loop disabled — stop at end of track
        if (elapsedTime >= duration()) {
          // Natural end (not a manual stop) — notify the playlist to advance.
          deps.onPlaybackEnded?.()
          handleStop()
          return
        }
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
  }

  // ── Download ─────────────────────────────────────────────────
  const handleDownload = async (track: StemTrack) => {
    if (!track.url && track.label !== 'MIDI') return
    try {
      let blob: Blob
      let ext: string

      if (track.label === 'MIDI') {
        const notes = deps.midiNotes()
        if (notes.length === 0) return
        const midiData = buildMidiFile(notes, DEFAULT_BPM)
        if (!midiData) return
        blob = new Blob([midiData.buffer as ArrayBuffer], {
          type: 'audio/midi',
        })
        ext = '.mid'
      } else {
        if (!track.url) return
        const resp = await fetch(track.url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        blob = await resp.blob()
        ext = '.wav'
      }

      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const base = deps.songTitle
        .replace(/\.[^.]+$/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
      a.download =
        track.label === 'MIDI'
          ? `${base}_vocal_midi${ext}`
          : `${base}_${track.label.toLowerCase()}_stem${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  const clearLoop = () => {
    setLoopEnabled(false)
    setLoopStart(0)
    setLoopEnd(0)
    setLoopCount(0)
  }
  return {
    loading,
    loadError,
    loadProgress,
    midiGenerating,
    midiProgress,
    midiPhase,
    playing,
    elapsed,
    duration,
    currentPitch,
    windowStart,
    setWindowStart,
    windowDuration,
    setWindowDuration,
    ensureAudioCtx,
    disconnectSources,
    loadStems,
    handlePlay,
    handlePause,
    handleStop,
    handleRestart,
    seekTo,
    handleDownload,
    speed,
    setSpeed,
    // Loop
    loopEnabled,
    setLoopEnabled,
    loopStart,
    setLoopStart,
    loopEnd,
    setLoopEnd,
    clearLoop,
    loopCount,
    resetLoopCount: () => setLoopCount(0),
    getPitchHistory: () => pitchHistory,
    setPitchHistory: (h: PitchNote[]) => {
      pitchHistory = h
    },
    getAudioCtx: () => audioCtx,
    getRafId: () => rafId,
  }
}
