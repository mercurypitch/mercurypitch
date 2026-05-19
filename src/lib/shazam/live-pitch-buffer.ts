// ============================================================
// Live Pitch Buffer — Mic capture + pitch detection loop
// Phase 2 of Shazam Sing
//
// Wraps the AudioEngine + PitchDetector into a simple start/stop
// API. Captures raw pitch frames, runs onset detection, and
// produces a LivePitchContour ready for DTW matching.
// ============================================================

import type { AudioEngine } from '@/lib/audio-engine'
import { PitchDetector } from '@/lib/pitch-detector'
import { detectOnsets, segmentNotes } from './onset-detector'
import type { BufferState, LivePitchContour, TimestampedPitch } from './types'

/** Default auto-stop silence duration in seconds */
const AUTO_STOP_SILENCE_SEC = 3.0

/** Minimum capture duration before auto-stop is allowed */
const MIN_CAPTURE_SEC = 0.5

export interface LivePitchBufferOptions {
  /** Auto-stop after this many seconds of continuous silence (default: 3.0) */
  autoStopSilenceSec?: number
  /** Called on each frame with the latest pitch (for live visualization) */
  onFrame?: (pitch: TimestampedPitch) => void
  /** Called when state changes */
  onStateChange?: (state: BufferState) => void
  /** Called when auto-stop triggers from silence */
  onAutoStop?: () => void
}

export class LivePitchBuffer {
  private audioEngine: AudioEngine
  private detector: PitchDetector
  private options: Required<LivePitchBufferOptions>

  private state: BufferState = 'idle'
  private frames: TimestampedPitch[] = []
  private rafId: number | null = null
  private captureStart = 0
  private lastVoicedTime = 0

  constructor(audioEngine: AudioEngine, options: LivePitchBufferOptions = {}) {
    this.audioEngine = audioEngine
    this.detector = new PitchDetector({
      sampleRate: audioEngine.getSampleRate(),
      bufferSize: audioEngine.getBufferSize(),
      sensitivity: 7,
    })
    this.options = {
      autoStopSilenceSec: options.autoStopSilenceSec ?? AUTO_STOP_SILENCE_SEC,
      onFrame: options.onFrame ?? (() => {}),
      onStateChange: options.onStateChange ?? (() => {}),
      onAutoStop: options.onAutoStop ?? (() => {}),
    }
  }

  getState(): BufferState {
    return this.state
  }

  getElapsed(): number {
    if (this.state === 'idle') return 0
    return (Date.now() - this.captureStart) / 1000
  }

  getFrameCount(): number {
    return this.frames.length
  }

  /** Start capturing. Returns false if mic access denied. */
  async start(): Promise<boolean> {
    if (this.state !== 'idle') {
      console.warn('[LivePitchBuffer] Already capturing')
      return false
    }

    // Reinitialize detector with actual AudioContext params (handles Android sample rate variance)
    const actualSampleRate = this.audioEngine.getSampleRate()
    const actualBufferSize = this.audioEngine.getBufferSize()
    this.detector = new PitchDetector({
      sampleRate: actualSampleRate,
      bufferSize: actualBufferSize,
      sensitivity: 7,
    })

    const ok = await this.audioEngine.startMic()
    if (!ok) {
      console.warn('[LivePitchBuffer] Mic start failed')
      return false
    }

    this.setState('listening')
    this.frames = []
    this.captureStart = Date.now()
    this.lastVoicedTime = Date.now()

    this.tick()
    return true
  }

  /** Stop capturing and produce a contour for matching. */
  stop(): LivePitchContour {
    this.cancelLoop()

    if (this.audioEngine.isMicActive()) {
      this.audioEngine.stopMic()
    }

    this.setState('processing')

    const durationSec =
      this.frames.length > 0 ? this.frames[this.frames.length - 1].time : 0

    const onsets = detectOnsets(this.frames)
    const segmented = segmentNotes(this.frames, onsets)

    return {
      frames: this.frames,
      onsets,
      durationSec,
      noteSequence: segmented.noteSequence,
      ioiSequence: segmented.ioiSequence,
      noteDurations: segmented.noteDurations,
    }
  }

  /** Cancel capture without producing a contour. */
  cancel(): void {
    this.cancelLoop()
    if (this.audioEngine.isMicActive()) {
      this.audioEngine.stopMic()
    }
    this.frames = []
    this.setState('idle')
  }

  // ── Private ────────────────────────────────────────────────

  private setState(state: BufferState): void {
    this.state = state
    this.options.onStateChange(state)
  }

  private cancelLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  private tick = (): void => {
    if (this.state !== 'listening') return

    const timeData = this.audioEngine.getTimeData()
    const detected = this.detector.detect(timeData)
    const elapsed = (Date.now() - this.captureStart) / 1000

    const frame: TimestampedPitch = {
      time: elapsed,
      pitch: detected,
    }
    this.frames.push(frame)
    this.options.onFrame(frame)

    // Track last voiced frame for auto-stop
    if (detected.frequency > 0 && detected.clarity > 0) {
      this.lastVoicedTime = Date.now()
    }

    // Auto-stop on prolonged silence
    const silenceDuration = (Date.now() - this.lastVoicedTime) / 1000
    if (
      elapsed >= MIN_CAPTURE_SEC &&
      silenceDuration >= this.options.autoStopSilenceSec
    ) {
      this.options.onAutoStop()
      return
    }

    this.rafId = requestAnimationFrame(this.tick)
  }
}
