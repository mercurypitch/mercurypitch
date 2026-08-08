// ============================================================
// Practice Engine — Mic, pitch detection, accuracy scoring
// ============================================================

import { PLAYBACK_MODE_SESSION } from '@/features/tabs/constants'
import { micLatencyMs } from '@/stores/mic-latency-store'
import { showNotification } from '@/stores/notifications-store'
import type { AccuracyRating, MelodyNote, NoteResult, PitchResult, PitchSample, PlaybackMode, PracticeResult, } from '@/types'
import type { AudioEngine } from './audio-engine'
import { micManager } from './mic-manager'
import type { PitchAlgorithm } from './pitch-detector'
import { PitchDetector } from './pitch-detector'
import type { ScoreMode } from './score-window'
import { scoreWindow } from './score-window'

// Accuracy constants (cents deviation thresholds)
const CENTS_PERFECT = 10
const CENTS_EXCELLENT = 25
const CENTS_GOOD = 50
const SCORE_PERFECT = 100
const SCORE_EXCELLENT = 90
const SCORE_GOOD = 75
const SCORE_OKAY = 50
const PRACTICE_MIC_OWNER = 'practice-engine'

// Accuracy bands (threshold in cents → band score)
const DEFAULT_BANDS: { threshold: number; band: number }[] = [
  { threshold: 0, band: SCORE_PERFECT },
  { threshold: CENTS_PERFECT, band: SCORE_EXCELLENT },
  { threshold: CENTS_EXCELLENT, band: SCORE_GOOD },
  { threshold: CENTS_GOOD, band: SCORE_OKAY },
  { threshold: Number.MAX_SAFE_INTEGER, band: 0 },
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

  private callbackSets = new Set<PracticeEngineCallbacks>()

  // State
  private micActive = false
  private sensitivity = 5
  private sampleRate = 44100
  private bufferSize = 2048
  private bands: { threshold: number; band: number }[] = [...DEFAULT_BANDS]
  /** Which part of a note is scored. Must match the settings-store default. */
  private scoreMode: ScoreMode = 'settled'

  // Playback state (shared with melody engine)
  private isPlaying = false
  private currentNoteIndex = -1
  private currentTargetNote: MelodyNote | null = null
  private currentTargetFreq = 0
  private currentSamples: PitchSample[] = []

  /**
   * Note starts the scheduler has announced but the singer has not been heard
   * on yet. A frame that reaches us now was sung `micLatencyMs` ago, so the
   * note it belongs to is the one that was running then, not the one running
   * now — without this, the tail of every note is scored against the next one.
   *
   * At the default offset of zero every start is due immediately and this
   * queue is drained on the same call that fills it, which is why an
   * unmeasured device behaves exactly as it did before.
   *
   * A `note` of null is a rest boundary: it closes the note before it and
   * scores nothing until the next real note starts.
   */
  private pendingNoteStarts: {
    note: MelodyNote | null
    index: number
    announcedAt: number
  }[] = []

  // Practice session
  private noteResults: NoteResult[] = []
  private runsCompleted = 0

  // Mic health check (prevents AudioContext suspension drops)
  // Check every ~10 frames (~167ms at 60fps) — aggressive enough to catch suspensions fast
  private micHealthCounter = 0
  private static readonly MIC_HEALTH_INTERVAL = 10
  private _resumeFailedNotified = false
  private _micMismatchWarned = false
  // Last detected pitch to detect mic silence (vs suspension)

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
    // The OS can kill the mic under us (unplugged, taken by another app,
    // device switch). The engine resets itself and tells us here — emit so
    // the UI icon follows reality instead of showing a live mic over dead
    // tracks.
    this.audioEngine.onMicLost(() => {
      if (!this.micActive) return
      this.micActive = false
      this.emit(
        'onMicStateChange',
        false,
        'Microphone disconnected — it may have been unplugged or taken by another app.',
      )
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
    algorithm?: PitchAlgorithm
    bufferSize?: number
    scoreMode?: ScoreMode
  }): void {
    // Buffer size requires recreating the detector (it's a construction param)
    if (
      config.bufferSize !== undefined &&
      config.bufferSize !== this.bufferSize
    ) {
      this.bufferSize = config.bufferSize
      this.detector = new PitchDetector({
        sampleRate: this.sampleRate,
        bufferSize: this.bufferSize,
        sensitivity: this.sensitivity,
        algorithm: config.algorithm ?? this.detector.getAlgorithm(),
      })
    }
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
    if (config.algorithm !== undefined) {
      this.detector.setAlgorithm(config.algorithm)
    }
    if (config.scoreMode !== undefined) {
      this.scoreMode = config.scoreMode
    }
  }

  /**
   * Subscribe a callback set. Registration is additive: the app-level practice
   * controller listens for the whole app lifetime (it keeps the shared
   * mic-state signal in sync), while shorter-lived subsystems subscribe and
   * unsubscribe as they mount. The old replace-wholesale setter let an
   * exercise silently disconnect the app listener — after visiting any
   * exercise, mic toggles elsewhere no longer updated the UI.
   *
   * Returns an unsubscribe function; callers with a shorter lifetime than the
   * app must call it on cleanup.
   */
  addCallbacks(callbacks: PracticeEngineCallbacks): () => void {
    this.callbackSets.add(callbacks)
    return () => {
      this.callbackSets.delete(callbacks)
    }
  }

  private emit<K extends keyof PracticeEngineCallbacks>(
    event: K,
    ...args: Parameters<NonNullable<PracticeEngineCallbacks[K]>>
  ): void {
    for (const cbs of this.callbackSets) {
      ;(cbs[event] as ((...a: typeof args) => void) | undefined)?.(...args)
    }
  }

  // ── Mic ──────────────────────────────────────────────────

  async startMic(): Promise<boolean> {
    try {
      await this.audioEngine.init()
      await this.audioEngine.resume()
      this._resumeFailedNotified = false

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

      const ok = await this.audioEngine.startMic(PRACTICE_MIC_OWNER)
      if (ok) {
        this.micActive = true
        this.detector.resetHistory()
        console.info('[PracticeEngine] Mic started successfully')
        this.emit('onMicStateChange', true)
        return true
      }
      const message =
        micManager.getError()?.message ??
        'The microphone could not start. Check browser permission and the selected input device.'
      console.warn('[PracticeEngine] Mic start failed:', message)
      this.emit('onMicStateChange', false, message)
      return false
    } catch (err) {
      console.error('[PracticeEngine] Mic start error:', err)
      this.emit('onMicStateChange', false, String(err))
      return false
    }
  }

  stopMic(): void {
    if (!this.micActive) {
      console.info('[PracticeEngine] Mic already stopped')
      return
    }
    console.info('[PracticeEngine] Stopping mic...')
    this.audioEngine.stopMic(PRACTICE_MIC_OWNER)
    this.micActive = false
    this.emit('onMicStateChange', false)
  }

  isMicActive(): boolean {
    // Also check audioEngine state for consistency
    const engineActive = this.audioEngine.isMicActive()
    if (engineActive !== this.micActive) {
      if (!this._micMismatchWarned) {
        this._micMismatchWarned = true
        console.warn(
          '[PracticeEngine] Mic state mismatch: practiceEngine=',
          this.micActive,
          'audioEngine=',
          engineActive,
          '— syncing',
        )
      }
      this.micActive = engineActive
      // The old silent sync left the UI signal (fed only by this emit) on
      // the WRONG side forever — the exact "icon off, pitch still
      // detecting" desync. Healing must be announced, not whispered.
      this.emit('onMicStateChange', engineActive)
    } else if (this._micMismatchWarned) {
      // Reset throttle once states are back in agreement
      this._micMismatchWarned = false
    }
    return this.micActive
  }

  /** Get waveform time-domain data from microphone (for visualization) */
  getWaveformData(): Float32Array {
    return this.audioEngine.getTimeData()
  }

  /**
   * Current microphone input level as RMS amplitude (0–1) of the live
   * time-domain signal. 0 when the mic is off. Compare against the detector's
   * `minAmplitude` threshold to tell "audible but too quiet to detect" apart
   * from "silent" and "detecting".
   */
  getInputLevel(): number {
    if (!this.micActive) return 0
    const data = this.audioEngine.getTimeData()
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
    return data.length > 0 ? Math.sqrt(sum / data.length) : 0
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
      this.emit('onPitchDetected', {
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
      this.audioEngine.resume().catch((err) => {
        console.warn('AudioContext resume failed during mic health check:', err)
        if (!this._resumeFailedNotified) {
          this._resumeFailedNotified = true
          showNotification(
            'Audio interrupted — tap or click anywhere to resume',
            'warning',
          )
        }
      })
    }

    // Frames arriving now answer whatever note was running one round trip
    // ago, so resolve the boundaries before attributing this frame to one.
    this.applyDueNoteStarts(performance.now())

    const pitch = this.detectPitch()

    if (pitch && this.isPlaying && this.currentTargetNote) {
      // Compute cents relative to target
      const cents = Math.round(
        1200 * Math.log2(pitch.frequency / this.currentTargetFreq),
      )

      if (pitch.clarity >= 0.2) {
        this.currentSamples.push({
          freq: pitch.frequency,

          time: performance.now(),
          cents,
        })
      }
    }

    if (pitch) {
      const result: PitchResult = {
        freq: pitch.frequency,
        midi: 0,
        note: pitch.noteName + pitch.octave,
        noteName: pitch.noteName,
        targetMidi: this.currentTargetNote?.midi ?? 0,
        targetNote: this.currentTargetNote
          ? this.currentTargetNote.name + this.currentTargetNote.octave
          : '',
        frequency: pitch.frequency,
        clarity: pitch.clarity,
        cents: pitch.cents ?? 0,
        octave: pitch.octave,
      }

      this.emit('onPitchDetected', result)
      return result
    } else {
      this.emit('onPitchDetected', null)
      return null
    }
  }

  /** Called when a new note starts */
  onNoteStart(note: MelodyNote, noteIndex: number): void {
    this.pendingNoteStarts.push({
      note,
      index: noteIndex,
      announcedAt: performance.now(),
    })
    // With no measured offset the start is due the moment it is announced,
    // so it takes effect on this call rather than waiting for the next frame.
    this.applyDueNoteStarts(performance.now())
  }

  /**
   * Called when a note's own duration is over. Until this existed a note was
   * only closed by the *next* note starting, so anything sung in the silence
   * between them was averaged into the note that had already finished —
   * feeling out the coming pitch during a rest, a tone or a third away, was
   * enough to score a well-sung note 'off'. A run with rests between the notes
   * scored every note far worse than the identical run without them.
   *
   * Deferred by the measured round trip like a start is: frames arriving just
   * after the note ended were sung while it was still sounding, and they are
   * still that note's.
   */
  onNoteEnd(): void {
    this.pendingNoteStarts.push({
      note: null,
      index: -1,
      announcedAt: performance.now(),
    })
    this.applyDueNoteStarts(performance.now())
  }

  /**
   * Promote every announced note start whose audio has had time to come back.
   * Called once per frame before the pitch is attributed.
   */
  private applyDueNoteStarts(now: number): void {
    const dueBy = now - micLatencyMs()
    while (
      this.pendingNoteStarts.length > 0 &&
      this.pendingNoteStarts[0].announcedAt <= dueBy
    ) {
      const pending = this.pendingNoteStarts.shift()!
      this.activateNote(pending.note, pending.index)
    }
  }

  private activateNote(note: MelodyNote | null, noteIndex: number): void {
    // Finalize the previous note's result
    if (this.currentNoteIndex >= 0) {
      this.finalizeNoteResult()
    }

    // A rest leaves no target, and `update` only collects samples while there
    // is one — so the rest itself is silent as far as scoring is concerned.
    this.currentNoteIndex = note === null ? -1 : noteIndex
    this.currentTargetNote = note
    this.currentTargetFreq = note?.freq ?? 0
    this.currentSamples = []
  }

  /** Called when playback completes */
  onPlaybackComplete(): NoteResult[] | null {
    // Anything still queued never got its share of frames, but its result is
    // still owed — a run that ends mid-offset must not silently drop notes.
    for (const pending of this.pendingNoteStarts) {
      this.activateNote(pending.note, pending.index)
    }
    this.pendingNoteStarts = []

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
      // Score only the window the mode keeps — 'settled' drops the slide into
      // the note, 'core' the release out of it too. The trim is over ALL of
      // the note's frames so it stays proportional to the note's length;
      // pitchFreq stays the first detection, windowed or not, because it
      // reports what was heard, not what was scored.
      const scored = scoreWindow(this.currentSamples, this.scoreMode)
      let sumCents = 0
      let validCount = 0
      for (const s of scored) {
        if (s.freq != null) {
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
    this.emit('onNoteComplete', result)
  }

  // ── Playback lifecycle ────────────────────────────────────

  startSession(): void {
    this.isPlaying = true
    this.noteResults = []
    this.currentSamples = []
    this.currentNoteIndex = -1
    this.pendingNoteStarts = []
  }

  endSession(): NoteResult[] {
    this.isPlaying = false
    for (const pending of this.pendingNoteStarts) {
      this.activateNote(pending.note, pending.index)
    }
    this.pendingNoteStarts = []
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
    this.pendingNoteStarts = []
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
    mode: PlaybackMode = PLAYBACK_MODE_SESSION,
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
  if (avgCents === null) return 'off'
  if (avgCents <= CENTS_PERFECT / 2) return 'perfect'
  if (avgCents <= CENTS_PERFECT * 1.5) return 'excellent'
  if (avgCents <= CENTS_EXCELLENT) return 'good'
  if (avgCents <= CENTS_GOOD) return 'okay'
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
      return SCORE_PERFECT
    case 'excellent':
      return SCORE_EXCELLENT
    case 'good':
      return SCORE_GOOD
    case 'okay':
      return SCORE_OKAY
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
