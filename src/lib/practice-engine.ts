// ============================================================
// Practice Engine — Mic, pitch detection, accuracy scoring
// ============================================================

import type { AccuracyRating, MelodyNote, NoteResult, PitchResult, PitchSample, PlaybackMode, PracticeResult, } from '@/types'
import type { AudioEngine } from './audio-engine'
import { PitchDetector } from './pitch-detector'

// Accuracy bands (threshold in cents → band score)
const DEFAULT_BANDS: { threshold: number; band: number }[] = [
  { threshold: 0, band: 100 },
  { threshold: 10, band: 90 },
  { threshold: 25, band: 75 },
  { threshold: 50, band: 50 },
  { threshold: 999, band: 0 },
]

export interface PracticeEngineCallbacks {
  onPitchDetected?: (pitch: PitchResult | null) => void
  onNoteComplete?: (result: NoteResult) => void
  onPracticeComplete?: (result: PracticeResult) => void
  onMicStateChange?: (active: boolean, error?: string) => void
}

export class PracticeEngine {
  private audioEngine: AudioEngine
  private detector: PitchDetector

  private callbacks: PracticeEngineCallbacks = {}

  // State
  private micActive = false
  private sensitivity = 5
  private sampleRate = 44100
  private bufferSize = 2048
  private bands: { threshold: number; band: number }[] = [...DEFAULT_BANDS]

  // Playback state (shared with melody engine)
  private isPlaying = false
  private currentNoteIndex = -1
  private currentTargetNote: MelodyNote | null = null
  private currentTargetFreq = 0
  private currentSamples: PitchSample[] = []

  // Practice session
  private noteResults: NoteResult[] = []
  // FIXME: These were moved to App.tsx, but if we refator those, maybe it makes sense to have them
  // in practice engine?
  // private cyclesTotal = 1
  // private cyclesCurrent = 1
  // private allCycleResults: NoteResult[][] = []
  private runsCompleted = 0

  // Mic health check (prevents AudioContext suspension drops)
  // Check every ~10 frames (~167ms at 60fps) — aggressive enough to catch suspensions fast
  private micHealthCounter = 0
  private static readonly MIC_HEALTH_INTERVAL = 10
  // Track consecutive health failures to detect genuine mic drops
  private micHealthFailures = 0
  private static readonly MIC_DROP_THRESHOLD = 5 // Treat as dropped after 5 consecutive failures
  // Last detected pitch to detect mic silence (vs suspension)
  private lastDetectedPitch: PitchResult | null = null

  constructor(
    audioEngine: AudioEngine,
    options: {
      sensitivity?: number
      sampleRate?: number
      bufferSize?: number
    } = {},
  ) {
    this.audioEngine = audioEngine
    this.sensitivity = options.sensitivity ?? 5
    this.sampleRate = options.sampleRate ?? 44100
    this.bufferSize = options.bufferSize ?? 2048
    this.detector = new PitchDetector({
      sampleRate: this.sampleRate,
      bufferSize: this.bufferSize,
      sensitivity: this.sensitivity,
    })
  }

  // ── Config ────────────────────────────────────────────────

  setSensitivity(value: number): void {
    this.sensitivity = Math.max(1, Math.min(10, value))
    this.detector.setSensitivity(this.sensitivity)
  }

  /** Apply all settings at once (called when settings change) */
  syncSettings(config: {
    detectionThreshold?: number
    sensitivity?: number
    minConfidence?: number
    minAmplitude?: number
    bands?: { threshold: number; band: number }[]
  }): void {
    if (config.sensitivity !== undefined) {
      this.sensitivity = Math.max(1, Math.min(10, config.sensitivity))
      this.detector.setSensitivity(this.sensitivity)
    }
    if (config.minConfidence !== undefined) {
      this.detector.setMinConfidence(config.minConfidence)
    }
    if (config.minAmplitude !== undefined) {
      this.detector.setMinAmplitude(config.minAmplitude)
    }
    if (config.bands !== undefined) {
      this.bands = [...config.bands]
    }
  }

  setCallbacks(callbacks: PracticeEngineCallbacks): void {
    this.callbacks = callbacks
  }

  // ── Mic ──────────────────────────────────────────────────

  async startMic(): Promise<boolean> {
    try {
      await this.audioEngine.init()
      await this.audioEngine.resume()

      // Reinitialize PitchDetector with the actual AudioContext sample rate
      // This is critical for Android where the sample rate may differ from the default 44100
      const actualSampleRate = this.audioEngine.getSampleRate()
      const actualBufferSize = this.audioEngine.getBufferSize()
      if (
        actualSampleRate !== this.sampleRate ||
        actualBufferSize !== this.bufferSize
      ) {
        console.info(
          `[PracticeEngine] Reinitializing PitchDetector: ${this.sampleRate}Hz → ${actualSampleRate}Hz, buffer ${this.bufferSize} → ${actualBufferSize}`,
        )
        this.sampleRate = actualSampleRate
        this.bufferSize = actualBufferSize
        this.detector = new PitchDetector({
          sampleRate: this.sampleRate,
          bufferSize: this.bufferSize,
          sensitivity: this.sensitivity,
        })
      }

      const ok = await this.audioEngine.startMic()
      if (ok) {
        this.micActive = true
        this.detector.resetHistory()
        console.info('[PracticeEngine] Mic started successfully')
        this.callbacks.onMicStateChange?.(true)
        return true
      }
      console.warn('[PracticeEngine] Mic start failed - access denied')
      this.callbacks.onMicStateChange?.(false, 'Microphone access denied')
      return false
    } catch (err) {
      console.error('[PracticeEngine] Mic start error:', err)
      this.callbacks.onMicStateChange?.(false, String(err))
      return false
    }
  }

  stopMic(): void {
    if (!this.micActive) {
      console.info('[PracticeEngine] Mic already stopped')
      return
    }
    console.info('[PracticeEngine] Stopping mic...')
    this.audioEngine.stopMic()
    this.micActive = false
    this.callbacks.onMicStateChange?.(false)
  }

  isMicActive(): boolean {
    // Also check audioEngine state for consistency
    const engineActive = this.audioEngine.isMicActive()
    if (engineActive !== this.micActive) {
      console.warn(
        '[PracticeEngine] Mic state mismatch: practiceEngine=',
        this.micActive,
        'audioEngine=',
        engineActive,
      )
      this.micActive = engineActive
    }
    return this.micActive
  }

  /** Get waveform time-domain data from microphone (for visualization) */
  getWaveformData(): Float32Array {
    return this.audioEngine.getTimeData()
  }

  // ── Pitch Detection ──────────────────────────────────────

  detectPitch(): {
    frequency: number
    clarity: number
    noteName: string
    octave: number
    cents: number
  } | null {
    if (!this.micActive) return null

    const timeData = this.audioEngine.getTimeData()
    const result = this.detector.detect(timeData)

    if (!result.noteName || result.frequency === 0) {
      return null
    }

    return {
      frequency: result.frequency,
      clarity: result.clarity,
      noteName: result.noteName,
      octave: result.octave,
      cents: result.cents,
    }
  }

  // ── Note Tracking ────────────────────────────────────────

  /** Call this every animation frame while playing */
  update(): PitchResult | null {
    if (!this.micActive) {
      this.callbacks.onPitchDetected?.({
        freq: 0,
        midi: 0,
        note: '',
        noteName: '',
        targetMidi: 0,
        targetNote: '',
        frequency: 0,
        clarity: 0,
        cents: 0,
        octave: 0,
      })
      return null
    }

    // Periodic AudioContext health check — resume if suspended (prevents mic drops)
    this.micHealthCounter++
    if (this.micHealthCounter >= PracticeEngine.MIC_HEALTH_INTERVAL) {
      this.micHealthCounter = 0
      this.audioEngine.resume().catch(() => {})
    }

    const pitch = this.detectPitch()

    // Track last detected pitch for genuine mic drop detection
    if (pitch && pitch.frequency !== 0) {
      this.lastDetectedPitch = {
        freq: pitch.frequency,
        midi: 0,
        note: pitch.noteName + pitch.octave,
        noteName: pitch.noteName,
        targetMidi: 0,
        targetNote: '',
        frequency: pitch.frequency,
        clarity: pitch.clarity,
        cents: pitch.cents ?? 0,
        octave: pitch.octave,
      }
      this.micHealthFailures = 0
    }

    if (pitch && this.isPlaying && this.currentTargetNote) {
      // Compute cents relative to target
      const cents = Math.round(
        1200 * Math.log2(pitch.frequency / this.currentTargetFreq),
      )

      if (pitch.clarity >= 0.2) {
        this.currentSamples.push({
          freq: pitch.frequency,

          time: (performance as unknown as { now: () => number }).now(),
          cents,
        })
      }
    }

    if (pitch && this.currentTargetNote) {
      this.callbacks.onPitchDetected?.({
        freq: pitch.frequency,
        midi: 0,
        note: pitch.noteName + pitch.octave,
        noteName: pitch.noteName,
        targetMidi: this.currentTargetNote.midi,
        targetNote: this.currentTargetNote.name + this.currentTargetNote.octave,
        frequency: pitch.frequency,
        clarity: pitch.clarity,
        cents: pitch.cents ?? 0,
        octave: pitch.octave,
      })

      return {
        freq: pitch.frequency,
        midi: 0,
        note: pitch.noteName + pitch.octave,
        noteName: pitch.noteName,
        targetMidi: this.currentTargetNote.midi,
        targetNote: this.currentTargetNote.name + this.currentTargetNote.octave,
        frequency: pitch.frequency,
        clarity: pitch.clarity,
        cents: pitch.cents ?? 0,
        octave: pitch.octave,
      }
    } else {
      this.callbacks.onPitchDetected?.(null)
      return null
    }
  }

  /** Called when a new note starts */
  onNoteStart(note: MelodyNote, noteIndex: number): void {
    // Finalize the previous note's result
    if (this.currentNoteIndex >= 0) {
      this.finalizeNoteResult()
    }

    this.currentNoteIndex = noteIndex
    this.currentTargetNote = note
    this.currentTargetFreq = note.freq
    this.currentSamples = []
  }

  /** Called when playback completes */
  onPlaybackComplete(): NoteResult[] | null {
    if (this.currentNoteIndex >= 0) {
      this.finalizeNoteResult()
    }
    return this.noteResults.length > 0 ? this.noteResults : null
  }

  private finalizeNoteResult(): void {
    if (!this.currentTargetNote) return

    let avgCents: number | null = null
    let pitchFreq = 0

    if (this.currentSamples.length > 0) {
      let sumCents = 0
      let validCount = 0
      for (const s of this.currentSamples) {
        if (s.cents !== undefined && s.freq !== null) {
          sumCents += Math.abs(s.cents)
          validCount++
        }
      }
      avgCents = validCount > 0 ? sumCents / validCount : null
      pitchFreq = this.currentSamples[0]?.freq ?? 0
    }

    const rating = centsToRating(avgCents, this.bands)

    const result: NoteResult = {
      item: { id: 0, note: this.currentTargetNote, duration: 1, startBeat: 0 },
      pitchFreq,
      pitchCents: avgCents ?? 0,
      time: this.currentSamples.length * (1000 / 60),
      rating,
      avgCents: avgCents ?? 0,
      targetNote: this.currentTargetNote.name + this.currentTargetNote.octave,
    }

    this.noteResults.push(result)
    this.callbacks.onNoteComplete?.(result)
  }

  // ── Playback lifecycle ────────────────────────────────────

  startSession(): void {
    this.isPlaying = true
    this.noteResults = []
    this.currentSamples = []
    this.currentNoteIndex = -1
  }

  endSession(): NoteResult[] {
    this.isPlaying = false
    if (this.currentNoteIndex >= 0) {
      this.finalizeNoteResult()
    }
    const results = [...this.noteResults]
    return results
  }

  resetSession(): void {
    this.noteResults = []
    this.currentSamples = []
    this.currentNoteIndex = -1
    this.currentTargetNote = null
    this.currentTargetFreq = 0
    this.runsCompleted++
  }

  // ── Score calculation ─────────────────────────────────────

  calculateScore(results: NoteResult[]): number {
    if (results.length === 0) return 0
    let total = 0
    for (const r of results) {
      total += ratingToScore(r.rating)
    }
    return Math.round(total / results.length)
  }

  calculatePracticeResult(
    results: NoteResult[],
    name = 'Session',
    mode = 'practice' as PlaybackMode,
  ): PracticeResult {
    return {
      score: this.calculateScore(results),
      noteCount: results.length,
      avgCents:
        results.length > 0
          ? results.reduce((s, r) => s + Math.abs(r.avgCents), 0) /
            results.length
          : 0,
      itemsCompleted: results.length,
      name,
      mode,
      completedAt: Date.now(),
      noteResult: results,
    }
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this.stopMic()
  }
}

// ============================================================
// Utility functions
// ============================================================

export function centsToRating(
  avgCents: number | null,
  _bands?: { threshold: number; band: number }[],
): AccuracyRating {
  // Use fixed thresholds matching the old app (not configurable) for rating labels
  // Bands are used only for the numeric score calculation
  if (avgCents === null) return 'off'
  if (avgCents <= 5) return 'perfect'
  if (avgCents <= 15) return 'excellent'
  if (avgCents <= 25) return 'good'
  if (avgCents <= 50) return 'okay'
  return 'off'
}

export function centsToBand(
  avgCents: number | null,
  bands?: { threshold: number; band: number }[],
): number {
  const useBands = bands ?? DEFAULT_BANDS
  if (avgCents === null) return 0
  for (const b of useBands) {
    if (avgCents <= b.threshold) return b.band
  }
  return 0
}

export function ratingToScore(rating: AccuracyRating): number {
  switch (rating) {
    case 'perfect':
      return 100
    case 'excellent':
      return 90
    case 'good':
      return 75
    case 'okay':
      return 50
    case 'off':
      return 0
  }
}

export function scoreGrade(score: number): { label: string; cls: string } {
  if (score >= 90) return { label: 'Pitch Perfect!', cls: 'grade-perfect' }
  if (score >= 80) return { label: 'Excellent!', cls: 'grade-excellent' }
  if (score >= 65) return { label: 'Good!', cls: 'grade-good' }
  if (score >= 50) return { label: 'Okay!', cls: 'grade-okay' }
  return { label: 'Needs Work', cls: 'grade-needs-work' }
}
