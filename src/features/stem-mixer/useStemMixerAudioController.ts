// ============================================================
// StemMixer Audio Controller — audio engine, transport, RAF tick
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import type { MidiNoteEvent } from '@/lib/midi-generator'
import { buildMidiFile, DEFAULT_BPM, detectNotes, MIDI_NOTE_RANGE, PITCH_DETECTOR_DEFAULTS, synthesizeMidiBuffer, } from '@/lib/midi-generator'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import { freqToMidi } from '@/lib/scale-data'
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

interface ComparisonPoint {
  time: number
  vocalNote: string
  micNote: string
  centsOff: number
  inTolerance: boolean
}

interface MicScore {
  totalNotes: number
  matchedNotes: number
  accuracyPct: number
  avgCentsOff: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}

interface CanvasView {
  syncCanvasSizes: () => void
  drawWaveformOverview: () => void
  drawLiveWaveform: () => void
  drawPitchCanvas: () => void
  drawMidiCanvas: () => void
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
  setUserScrolled: (v: boolean) => void

  // Mic comparison (for RAF tick) — simplified in Phase 5a
  micActive: Accessor<boolean>
  getMicAnalyserNode: () => AnalyserNode | null
  getMicPitchDetector: () => PitchDetector | null
  setMicPitch: Setter<DetectedPitch | null>
  comparisonData: Accessor<ComparisonPoint[]>
  setComparisonData: Setter<ComparisonPoint[]>
  toleranceCents: Accessor<number>
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
const FADE_OUT_MS = 30

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

  // ── Mutable refs ─────────────────────────────────────────────
  let audioCtx: AudioContext | null = null
  let mainGain: GainNode | null = null
  let vocalAnalyser: AnalyserNode | null = null
  let pitchDetector: PitchDetector | null = null
  let rafId = 0
  let startTime = 0
  let pauseOffset = 0
  let pitchHistory: PitchNote[] = []

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
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  }

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

      const src = ctx.createBufferSource()
      src.buffer = track.buffer

      const gain = ctx.createGain()
      const targetGain = isAudible ? track.volume : 0
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(targetGain, now + 0.02)

      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.8

      src.connect(gain)
      gain.connect(analyser)
      analyser.connect(mainGain!)

      if (track.label === 'Vocal' && vocalAnalyser) {
        gain.connect(vocalAnalyser)
      }

      src.start(now, offset)
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

  // ── Transport ────────────────────────────────────────────────
  const handlePlay = () => {
    ensureAudioCtx()
    disconnectSources()
    createSources(pauseOffset)
    startTime = audioCtx!.currentTime - pauseOffset
    setPlayingLocal(true)
    pitchHistory = []
    deps.resetMicPitchHistory()
    pitchDetector?.resetHistory()
    startRafLoop()
  }

  const handlePause = () => {
    pauseOffset = audioCtx!.currentTime - startTime
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
    pauseOffset = 0
    disconnectSources()
    setPlayingLocal(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    deps.resetMicPitchHistory()
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
    pauseOffset = 0
    disconnectSources()
    setPlayingLocal(false)
    setElapsed(0)
    setCurrentPitch(null)
    pitchHistory = []
    pitchDetector?.resetHistory()
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
    if (playing()) {
      disconnectSources()
      createSources(pauseOffset)
      startTime = audioCtx!.currentTime - pauseOffset
      pitchHistory = []
      pitchDetector?.resetHistory()
    }
    requestAnimationFrame(() => {
      const { canvas } = deps
      canvas.syncCanvasSizes()
      canvas.drawWaveformOverview()
      canvas.drawLiveWaveform()
      canvas.drawPitchCanvas()
      canvas.drawMidiCanvas()
    })
  }

  // ── RAF Loop ─────────────────────────────────────────────────
  const startRafLoop = () => {
    const tick = () => {
      if (!audioCtx || !playing()) return

      const now = audioCtx.currentTime
      const elapsedTime = now - startTime
      setElapsed(Math.min(elapsedTime, duration()))

      // Pitch detection from vocal analyser
      if (vocalAnalyser && deps.vocal().buffer) {
        const timeData = new Float32Array(PITCH_FFT_SIZE)
        vocalAnalyser.getFloatTimeDomainData(timeData)
        const pitch = pitchDetector!.detect(timeData)
        setCurrentPitch(pitch.frequency > 0 ? pitch : null)

        if (pitch.frequency > 0) {
          const midi = freqToMidi(pitch.frequency)
          if (midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max) {
            pitchHistory.push({
              time: elapsedTime,
              noteName: pitch.noteName,
              frequency: pitch.frequency,
              octave: pitch.octave,
            })
          }
        }
      }

      // Mic pitch detection
      if (deps.micActive()) {
        const micAnalyser = deps.getMicAnalyserNode()
        if (micAnalyser) {
          const micData = new Float32Array(PITCH_FFT_SIZE)
          micAnalyser.getFloatTimeDomainData(micData)
          const micPd = deps.getMicPitchDetector()
          const mp = micPd!.detect(micData)
          deps.setMicPitch(mp.frequency > 0 ? mp : null)
          if (mp.frequency > 0) {
            const midi = freqToMidi(mp.frequency)
            if (midi >= MIDI_NOTE_RANGE.min && midi <= MIDI_NOTE_RANGE.max) {
              // Mic pitch history is managed by Phase 5a mic controller
            }
          }
          const vocalPitch = currentPitch()
          if (mp.frequency > 0 && vocalPitch && vocalPitch.frequency > 0) {
            const centsOff =
              1200 * Math.log2(mp.frequency / vocalPitch.frequency)
            const tol = deps.toleranceCents()
            deps.setComparisonData((prev) => [
              ...prev.slice(-12000),
              {
                time: elapsedTime,
                vocalNote: vocalPitch.noteName,
                micNote: mp.noteName,
                centsOff,
                inTolerance: Math.abs(centsOff) <= tol,
              },
            ])
          }
        }
      }

      // Continuous-scroll time window
      const newStart =
        elapsedTime - deps.PITCH_WINDOW_FILL_RATIO * windowDuration()
      setWindowStart(Math.max(0, newStart))

      const { canvas } = deps
      canvas.syncCanvasSizes()
      canvas.drawWaveformOverview()
      canvas.drawPitchCanvas()
      canvas.drawMidiCanvas()
      canvas.drawLiveWaveform()
      deps.updateCurrentLine()

      if (elapsedTime >= duration()) {
        handleStop()
        return
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
    getPitchHistory: () => pitchHistory,
    setPitchHistory: (h: PitchNote[]) => {
      pitchHistory = h
    },
    getAudioCtx: () => audioCtx,
    getRafId: () => rafId,
  }
}
