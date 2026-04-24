// ============================================================
// PlaybackEngine - Unified audio playback orchestrator
// Manages timing, note playback, and provides clean API for UI
// ============================================================

import type { InstrumentType } from '@/stores/app-store'
import type { MelodyItem } from '@/types'
import { AudioEngine } from './audio-engine'
import { melodyIndexAtBeat } from './scale-data'

/** Playback mode - what happens after melody completes */
export type PlaybackMode = 'once' | 'repeat' | 'practice'

/** Playback state - what component should track */
export type PlaybackState =
  | 'stopped'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'precount'

/** PlaybackEngine event types */
export type PlaybackEventType =
  | 'state'
  | 'beat'
  | 'noteStart'
  | 'noteEnd'
  | 'complete'
  | 'countIn'
  | 'countInComplete'
  | 'metronome'

/** Event payload interface */
export interface PlaybackEvent {
  type: PlaybackEventType
  state?: PlaybackState
  beat?: number
  note?: MelodyItem
  index?: number
  countIn?: number
  isDownbeat?: boolean
}

/** Timekeeper interface - for seeking and measuring time */
export interface PlaybackTimekeeper {
  /** Get current time in seconds since playback started */
  getCurrentTime(): number
  /** Seek to absolute time */
  seekTo(seconds: number): void
  /** Reset to time 0 */
  reset(): void
  /** Get total duration in seconds */
  getDuration(): number
}

/** PlaybackEngine event callback interface */
export interface PlaybackEngineCallbacks {
  /** Called on state change - for UI to track overall state */
  onStateChange?: (state: PlaybackState) => void
  /** Called on beat update - for playhead position */
  onBeatUpdate?: (beat: number) => void
  /** Called when a note starts playing */
  onNoteStart?: (note: MelodyItem, index: number) => void
  /** Called when a note ends */
  onNoteEnd?: () => void
  /** Called when playback completes */
  onComplete?: () => void
  /** Called during count-in */
  onCountIn?: (beat: number) => void
  /** Called when count-in completes */
  onCountInComplete?: () => void
  /** Called for metronome clicks */
  onMetronome?: (beat: number, isDownbeat: boolean) => void
}

/** PlaybackEngine configuration */
export interface PlaybackEngineConfig {
  /** Optional external AudioEngine - otherwise creates its own */
  audioEngine?: AudioEngine
  /** Instrument type for audio output */
  instrumentType?: InstrumentType
  /** Metronome enabled flag */
  metronomeEnabled?: () => boolean
  /** Count-in beats (0-4) */
  countIn?: number
  /** Playback mode (once/repeat/practice) */
  mode?: PlaybackMode
}

/** PlaybackEngine class - single source of truth for playback */
export class PlaybackEngine implements PlaybackTimekeeper {
  // ── Public State ────────────────────────────────────────────
  public state: PlaybackState = 'stopped'
  public currentBeat = 0
  public currentNoteIndex = -1
  public isPlaying = false
  public isPaused = false
  public completed = false

  // ── Private State ───────────────────────────────────────────
  private audioEngine: AudioEngine
  private callbacks: PlaybackEngineCallbacks = {}
  private melody: MelodyItem[] = []
  private animationFrameId: number | null = null
  private startTime = 0
  private pauseOffset = 0
  private countInBeats = 0
  private countInBeat = 0
  private metronomeLastBeat = -1
  private metronomeLastCountInBeat = -1
  private totalBeats = 0
  private mode: PlaybackMode = 'once'

  // ── Config ──────────────────────────────────────────────────
  private beatsPerSecond: number
  private metronomeEnabledFn: () => boolean

  // ── Subscriptions ───────────────────────────────────────────
  private onEventCallbacks = new Map<
    PlaybackEventType,
    Set<(e: PlaybackEvent) => void>
  >()

  constructor(config: PlaybackEngineConfig = {}) {
    this.audioEngine = config.audioEngine ?? new AudioEngine()
    this.audioEngine.setInstrument(config.instrumentType ?? 'sine')

    this.metronomeEnabledFn = config.metronomeEnabled ?? (() => false)
    this.countInBeats = config.countIn ?? 0
    this.mode = config.mode ?? 'once'

    // Calculate beats per second based on a default BPM (will update when BPM changes)
    this.beatsPerSecond = 120 / 60 // 2 beats per second at 120 BPM

    // Listen for BPM changes from appStore through audioEngine
    this._setupBpmListener()
  }

  // ── Timekeeper API ──────────────────────────────────────────

  /** Get current playback time in seconds */
  getCurrentTime(): number {
    if (!this.isPlaying || this.isPaused) {
      return (
        this.pauseOffset / 1000 +
        (this.startTime > 0 ? (performance.now() - this.startTime) / 1000 : 0)
      )
    }
    const elapsedMs = performance.now() - this.startTime + this.pauseOffset
    return elapsedMs / 1000
  }

  /** Seek to a specific time (seconds) */
  seekTo(seconds: number): void {
    this.stop()
    this.currentBeat = seconds * this.beatsPerSecond
    this._emit({ type: 'beat', beat: this.currentBeat })
  }

  /** Reset playback to start */
  reset(): void {
    this.stop()
    this.currentBeat = 0
    this.currentNoteIndex = -1
    this.completed = false
    this.pauseOffset = 0
    this._emit({ type: 'state', state: 'stopped' })
  }

  /** Get total duration of current melody in seconds */
  getDuration(): number {
    return this.totalBeats / this.beatsPerSecond
  }

  /** Get current beat position */
  getCurrentBeat(): number {
    return this.currentBeat
  }

  // ── Playback Control ───────────────────────────────────────

  /** Start playback */
  start(): void {
    if (this.isPlaying || this.completed) return

    // Ensure audio engine is initialized
    if (!this.audioEngine.getIsInitialized()) {
      this.audioEngine
        .init()
        .catch((err) => console.error('Audio init error:', err))
    }

    this.isPlaying = true
    this.isPaused = false
    this.completed = false
    this.startTime = performance.now()
    this.pauseOffset = 0
    this.countInBeat = this.countInBeats

    // Emit initial state
    this._emit({
      type: 'state',
      state: this.countInBeats > 0 ? 'playing' : 'playing',
    })

    this._startAnimationLoop()
  }

  /** Pause playback */
  pause(): void {
    if (!this.isPlaying || this.isPaused) return

    this.pauseOffset += performance.now() - this.startTime
    this.isPaused = true

    this._emit({ type: 'state', state: 'paused' })
    this._stopAnimationLoop()
  }

  /** Resume playback */
  resume(): void {
    if (!this.isPlaying || !this.isPaused) return

    this.isPaused = false
    this.startTime = performance.now()

    this._emit({ type: 'state', state: 'playing' })
    this._startAnimationLoop()
  }

  /** Stop playback completely */
  stop(): void {
    this._stopAnimationLoop()
    this.audioEngine.stopTone()
    this.isPlaying = false
    this.isPaused = false
    this.completed = false

    // Don't reset count-in state during precount
    if (this.countInBeats > 0) {
      this.currentBeat = 0
      this.currentNoteIndex = -1
      this.startTime = 0
      this.metronomeLastBeat = -1
      this.metronomeLastCountInBeat = -1
    } else {
      this.currentBeat = 0
      this.currentNoteIndex = -1
      this.startTime = 0
      this.countInBeat = 0
      this.countInBeats = 0
      this.metronomeLastBeat = -1
      this.metronomeLastCountInBeat = -1
    }

    this._emit({ type: 'state', state: 'stopped' })
  }

  /** Set the melody to play */
  setMelody(melody: MelodyItem[]): void {
    this.melody = [...melody]
    this.totalBeats = this._getTotalBeats(melody)
  }

  /** Set BPM - updates timing calculations */
  setBPM(bpm: number): void {
    this.audioEngine.setBPM(bpm)
    this.beatsPerSecond = bpm / 60
  }

  /** Get current BPM */
  getBPM(): number {
    return this.audioEngine.getBpm?.() || 120
  }

  /** Set count-in beats */
  setCountIn(beats: number): void {
    this.countInBeats = Math.max(0, Math.min(4, beats))
  }

  /** Set playback mode */
  setMode(mode: PlaybackMode): void {
    this.mode = mode
  }

  // ── Callback Configuration ───────────────────────────────────

  setCallbacks(callbacks: PlaybackEngineCallbacks): void {
    this.callbacks = callbacks
  }

  // ── Event Subscription API ───────────────────────────────────

  on(eventType: PlaybackEventType, handler: (e: PlaybackEvent) => void): void {
    if (!this.onEventCallbacks.has(eventType)) {
      this.onEventCallbacks.set(eventType, new Set())
    }
    this.onEventCallbacks.get(eventType)!.add(handler)
  }

  off(eventType: PlaybackEventType, handler: (e: PlaybackEvent) => void): void {
    this.onEventCallbacks.get(eventType)?.delete(handler)
  }

  // ── Private Implementation ───────────────────────────────────

  private _setupBpmListener(): void {
    // BPM is managed through audioEngine which reads from appStore
    // We just need to track it here for timing calculations
  }

  private _getTotalBeats(melody: MelodyItem[]): number {
    let max = 0
    for (const item of melody) {
      const end = item.startBeat + item.duration
      if (end > max) max = end
    }
    return max
  }

  private _startAnimationLoop(): void {
    const countIn = this.countInBeats > 0 ? this.countInBeats : 0

    const animate = () => {
      if (!this.isPlaying || this.isPaused) return

      const now = performance.now()
      const elapsedMs = now - this.startTime + this.pauseOffset
      const elapsedSeconds = elapsedMs / 1000
      const currentBeat = elapsedSeconds * this.beatsPerSecond

      // Count-in phase
      if (countIn > 0 && elapsedSeconds < countIn / this.beatsPerSecond) {
        const countInElapsed = elapsedSeconds * this.beatsPerSecond
        const currentBeatNum = Math.max(0, countIn - Math.floor(countInElapsed))
        const currentIntBeat = Math.floor(currentBeatNum)

        if (currentIntBeat !== this.countInBeat) {
          this.countInBeat = currentIntBeat
          this._emit({ type: 'countIn', countIn: this.countInBeat })
        }

        // Only trigger metronome on beat boundaries during count-in
        if (this.metronomeEnabledFn() && currentIntBeat !== this.metronomeLastCountInBeat) {
          this._triggerMetronome(currentIntBeat)
          this.metronomeLastCountInBeat = currentIntBeat
        }

        this.animationFrameId = requestAnimationFrame(animate)
        return
      }

      // Main melody phase
      const intBeat = Math.floor(currentBeat)

      // Metronome handling
      if (this.metronomeEnabledFn() && intBeat !== this.metronomeLastBeat) {
        this._triggerMetronome(currentBeat)
        this.metronomeLastBeat = intBeat
      }

      // Note handling
      const newIndex = this._findNoteAtBeat(currentBeat)

      if (newIndex !== this.currentNoteIndex) {
        if (this.currentNoteIndex >= 0) {
          this._emit({ type: 'noteEnd' })
          this._stopNote()
        }
        this.currentNoteIndex = newIndex
        if (newIndex >= 0) {
          this._emit({
            type: 'noteStart',
            note: this.melody[newIndex],
            index: newIndex,
          })
          this._playNote()
        }
      }

      this.currentBeat = currentBeat
      this._emit({ type: 'beat', beat: currentBeat })

      // Completion check
      if (currentBeat >= this.totalBeats) {
        this._emit({ type: 'complete' })
        if (this.mode === 'repeat') {
          // Restart without resetting timekeeper state
          this.reset()
          this.start()
        } else {
          this.stop()
        }
        return
      }

      this.animationFrameId = requestAnimationFrame(animate)
    }

    this.startTime = performance.now()
    this.animationFrameId = requestAnimationFrame(animate)
  }

  private _stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private _emit(event: PlaybackEvent): void {
    // Call direct callbacks first
    switch (event.type) {
      case 'state':
        this.callbacks.onStateChange?.(event.state!)
        break
      case 'beat':
        this.callbacks.onBeatUpdate?.(event.beat!)
        break
      case 'noteStart':
        this.callbacks.onNoteStart?.(event.note!, event.index!)
        break
      case 'noteEnd':
        this.callbacks.onNoteEnd?.()
        break
      case 'complete':
        this.callbacks.onComplete?.()
        break
      case 'countIn':
        this.callbacks.onCountIn?.(event.countIn!)
        break
      case 'countInComplete':
        this.callbacks.onCountInComplete?.()
        break
    }

    // Emit to subscribers
    this.onEventCallbacks.get(event.type)?.forEach((h) => h(event))
  }

  private _findNoteAtBeat(beat: number): number {
    return melodyIndexAtBeat(this.melody, beat)
  }

  private _triggerMetronome(currentBeat: number): void {
    const intBeat = Math.floor(currentBeat)
    const isDownbeat = intBeat % 4 === 0
    this.audioEngine.playMetronomeClick(isDownbeat)
    this._emit({ type: 'metronome', beat: intBeat, isDownbeat })
  }

  private _playNote(): void {
    const note = this.melody[this.currentNoteIndex]
    if (note?.note.midi !== 0) {
      const beatDurationMs = 60000 / this.getBPM()
      this.audioEngine.playTone(note.note.freq, note.duration * beatDurationMs)
    }
  }

  private _stopNote(): void {
    this.audioEngine.stopTone()
  }

  // ── Cleanup ─────────────────────────────────────────────────

  destroy(): void {
    this.stop()
    this.audioEngine.destroy()
  }
}
