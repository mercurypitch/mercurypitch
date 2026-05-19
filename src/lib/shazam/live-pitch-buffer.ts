// ============================================================
// Live Pitch Buffer -- Mic capture + pitch detection loop
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

/** How long to wait for the first voiced frame before giving up (seconds) */
const INITIAL_WAIT_SEC = 7.0

/** Auto-stop after this many seconds of silence once singing has started */
const MID_SESSION_SILENCE_SEC = 5.0

/** Minimum capture duration (after first voice) before auto-stop is allowed */
const MIN_CAPTURE_SEC = 1.0

export interface LivePitchBufferOptions {
  /** Auto-stop after this many seconds of continuous silence (default: 5.0) */
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
  /** Whether we have heard any voiced frame at all */
  private hasHeardVoice = false
  /** Timestamp of the first voiced frame (for elapsed calculation) */
  private firstVoiceTime = 0

  constructor(audioEngine: AudioEngine, options: LivePitchBufferOptions = {}) {
    this.audioEngine = audioEngine
    this.detector = new PitchDetector({
      sampleRate: audioEngine.getSampleRate(),
      bufferSize: audioEngine.getBufferSize(),
      sensitivity: 7,
    })
    this.options = {
      autoStopSilenceSec: options.autoStopSilenceSec ?? MID_SESSION_SILENCE_SEC,
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
    this.lastVoicedTime = 0
    this.hasHeardVoice = false
    this.firstVoiceTime = 0

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

  cancel(): void {
    this.cancelLoop()
    if (this.audioEngine.isMicActive()) {
      this.audioEngine.stopMic()
    }
    this.frames = []
    this.setState('idle')
  }

  /** Get the accumulated pitch frames so far (for live matching). */
  getCurrentFrames(): TimestampedPitch[] {
    return this.frames
  }

  // -- Private ------------------------------------------------

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
    const wallElapsed = (Date.now() - this.captureStart) / 1000
    const isVoiced = detected.frequency > 0 && detected.clarity > 0

    // -- Phase 1: Waiting for first voice ----------------------
    // Discard frames entirely until the user starts singing.
    // If they stay silent too long, auto-stop gracefully.
    if (!this.hasHeardVoice) {
      if (isVoiced) {
        this.hasHeardVoice = true
        this.firstVoiceTime = Date.now()
        this.lastVoicedTime = Date.now()
        // Fall through to record this first voiced frame
      } else {
        // Still waiting -- fire onFrame for visualization (shows silence)
        // but don't store the frame for matching.
        const frame: TimestampedPitch = { time: wallElapsed, pitch: detected }
        this.options.onFrame(frame)

        if (wallElapsed >= INITIAL_WAIT_SEC) {
          this.options.onAutoStop()
          return
        }
        this.rafId = requestAnimationFrame(this.tick)
        return
      }
    }

    // -- Phase 2: Recording (voice has been heard) -------------
    const sinceFirstVoice = (Date.now() - this.firstVoiceTime) / 1000

    const frame: TimestampedPitch = {
      time: sinceFirstVoice,
      pitch: detected,
    }
    this.frames.push(frame)
    this.options.onFrame(frame)

    // Track last voiced frame for mid-session silence detection
    if (isVoiced) {
      this.lastVoicedTime = Date.now()
    }

    // Auto-stop on prolonged mid-session silence
    const silenceDuration = (Date.now() - this.lastVoicedTime) / 1000
    if (
      sinceFirstVoice >= MIN_CAPTURE_SEC &&
      silenceDuration >= this.options.autoStopSilenceSec
    ) {
      this.options.onAutoStop()
      return
    }

    this.rafId = requestAnimationFrame(this.tick)
  }
}
