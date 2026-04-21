// ============================================================
// PlaybackRuntime - Unified playback orchestrator
// Manages audio timing and syncs with PianoRollEditor
// ============================================================

import type { MelodyItem } from '@/types'
import type { InstrumentType } from './audio-engine'
import { AudioEngine } from './audio-engine'
import { melodyIndexAtBeat } from './scale-data'

export type PlaybackState = 'stopped' | 'playing' | 'paused'
export interface PlaybackEvent {
  type:
    | 'state'
    | 'beat'
    | 'noteStart'
    | 'noteEnd'
    | 'complete'
    | 'countIn'
    | 'countInComplete'
    | 'metronome'
  state?: PlaybackState
  beat?: number
  note?: MelodyItem
  index?: number
  countIn?: number
  isDownbeat?: boolean
}

export interface PlaybackRuntimeCallbacks {
  onEvent?: (event: PlaybackEvent) => void
  onNoteStart?: (note: MelodyItem, index: number) => void
  onNoteEnd?: (note: MelodyItem, index: number) => void
  onBeatUpdate?: (beat: number) => void
  onComplete?: () => void
}

export interface PlaybackRuntimeOptions {
  /** Existing AudioEngine instance (BPM managed by appStore) */
  audioEngine?: AudioEngine
  metronomeEnabled?: () => boolean
  instrumentType?: InstrumentType
  onEvent?: (event: PlaybackEvent) => void
  onNoteStart?: (note: MelodyItem, index: number) => void
  onNoteEnd?: (note: MelodyItem, index: number) => void
  onBeatUpdate?: (beat: number) => void
  onComplete?: () => void
}

export class PlaybackRuntime {
  private audioEngine: AudioEngine
  private callbacks: PlaybackRuntimeCallbacks
  private isPlaying = false
  private isPaused = false
  private currentBeat = 0
  private currentNoteIndex = -1
  private onEventCallbacks = new Map<string, Set<(e: unknown) => void>>()
  private animationFrameId: number | null = null
  private playStartTime = 0
  private pauseOffset = 0
  private _countInBeats = 0
  private countInBeat = 0
  private metronomeEnabled?: () => boolean
  private metronomeLastBeat = -1
  private _melody: MelodyItem[] = []

  private _getTotalBeats(melody: MelodyItem[]): number {
    let max = 0
    for (const item of melody) {
      const end = item.startBeat + item.duration
      if (end > max) max = end
    }
    return max
  }

  /**
   * Initialize with AudioEngine (BPM should be set via appStore)
   */
  constructor(options: PlaybackRuntimeOptions) {
    this.audioEngine = options.audioEngine ?? new AudioEngine()
    this.audioEngine.setInstrument(options.instrumentType ?? 'sine')
    this.callbacks = options
    this.metronomeEnabled = options.metronomeEnabled
  }

  // ── Subscription API ─────────────────────────────────────

  on(event: 'state', handler: (state: PlaybackState) => void): void
  on(event: 'beat', handler: (e: { beat: number }) => void): void
  on(
    event: 'noteStart',
    handler: (e: { note: MelodyItem; index: number }) => void,
  ): void
  on(
    event: 'noteEnd',
    handler: (e: { note: MelodyItem; index: number }) => void,
  ): void
  on(event: 'complete', handler: () => void): void
  on(event: 'countIn', handler: (e: { countIn: number }) => void): void
  on(event: 'countInComplete', handler: () => void): void
  on(
    event: 'metronome',
    handler: (e: { beat: number; isDownbeat: boolean }) => void,
  ): void
  on(event: PlaybackEvent['type'], handler: unknown): void {
    const _handler = handler as (e: unknown) => void
    if (!this.onEventCallbacks.has(event)) {
      this.onEventCallbacks.set(event, new Set())
    }
    this.onEventCallbacks.get(event)!.add(_handler)
  }

  off(event: PlaybackEvent['type'], handler: unknown): void {
    const _handler = handler as (e: unknown) => void
    this.onEventCallbacks.get(event)?.delete(_handler)
  }

  // ── State ─────────────────────────────────────────────────

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getIsPaused(): boolean {
    return this.isPaused
  }

  getCurrentBeat(): number {
    return this.currentBeat
  }

  getCurrentNoteIndex(): number {
    return this.currentNoteIndex
  }

  getPlaybackState(): PlaybackState {
    if (this.isPaused) return 'paused'
    if (this.isPlaying) return 'playing'
    return 'stopped'
  }

  // ── Playback Control ───────────────────────────────────────

  start(countInBeats: number = 0): void {
    if (this.isPlaying) return

    if (!this.audioEngine.getIsInitialized()) {
      this.audioEngine
        .init()
        .catch((err) => console.error('Audio init error:', err))
    }

    this.isPlaying = true
    this.isPaused = false

    // If we were paused before, restore the current beat position instead of resetting to 0
    if (this.isPaused) {
      // Resume from paused position
      this.playStartTime = performance.now() - this.pauseOffset
      this.isPaused = false
    } else {
      // Fresh start - use count-in beats
      this.currentBeat = 0
      this.currentNoteIndex = -1
      this._countInBeats = countInBeats
      this.countInBeat = 0
    }

    this._emit({ type: 'state', state: 'playing' })

    this._startAnimationLoop()
  }

  pause(): void {
    if (!this.isPlaying || this.isPaused) return

    // Record the time offset to resume correctly
    this.pauseOffset = performance.now() - this.playStartTime
    this.isPaused = true
    this.isPlaying = false
    this._emit({ type: 'state', state: 'paused' })
    this._stopAnimationLoop()
  }

  resume(): void {
    if (!this.isPlaying || !this.isPaused) return

    this.isPaused = false
    this.isPlaying = true
    // Resume from paused position by adjusting playStartTime
    this.playStartTime = performance.now() - this.pauseOffset
    this._emit({ type: 'state', state: 'playing' })
    this._startAnimationLoop()
  }

  stop(): void {
    this._stopAnimationLoop()
    this.audioEngine.stopTone()
    this.isPlaying = false
    this.isPaused = false
    this.currentBeat = 0
    this.currentNoteIndex = -1
    this.playStartTime = 0
    this.countInBeat = 0
    this._countInBeats = 0
    this.metronomeLastBeat = -1
    this._emit({ type: 'state', state: 'stopped' })
  }

  seekTo(beat: number): void {
    this.stop()
    this.currentBeat = Math.max(0, beat)
    this._emit({ type: 'beat', beat: this.currentBeat })
  }

  /**
   * Set count-in beats (0-4). Count-in is shown before playback starts.
   */
  setCountIn(beats: number): void {
    this._countInBeats = Math.max(0, Math.min(4, beats))
  }

  getCountIn(): number {
    return this._countInBeats
  }

  setMelody(melody: MelodyItem[]): void {
    this._melody = melody
  }

  /**
   * Get current BPM from AudioEngine (which reads from appStore)
   */
  getBPM(): number {
    return this.audioEngine.getBPM?.() || 120
  }

  getMelody(): MelodyItem[] {
    return this._melody
  }

  // ── Private Implementation ─────────────────────────────────

  private _startAnimationLoop(): void {
    const countIn = this._countInBeats > 0 ? this._countInBeats : 0

    const animate = () => {
      if (!this.isPlaying || this.isPaused) return

      const now = performance.now()
      const beatDuration = 60000 / this._bpm
      const elapsed = now - this.playStartTime

      if (countIn > 0) {
        const rawBeat = elapsed / beatDuration + countIn
        const currentInt = Math.floor(rawBeat)

        if (currentInt !== this.countInBeat) {
          this.countInBeat = currentInt
          this._emit({ type: 'beat', beat: rawBeat })
          this._emit({ type: 'countIn', countIn: this.countInBeat + 1 })
        }
        this.animationFrameId = requestAnimationFrame(animate)
      } else {
        const beat = elapsed / beatDuration

        const intBeat = Math.floor(beat)

        // Check if metronome click should play
        const shouldPlayMetronome = this.metronomeEnabled?.() ?? false
        const isDownbeat = intBeat % 4 === 0

        if (
          intBeat !== this.metronomeLastBeat &&
          this.metronomeLastBeat >= 0 &&
          shouldPlayMetronome
        ) {
          this.audioEngine.playMetronomeClick(isDownbeat)
          this._emit({
            type: 'metronome',
            beat: intBeat,
            isDownbeat,
          })
        }
        this.metronomeLastBeat = intBeat

        const melody = this._melody ?? []
        const newIndex = melodyIndexAtBeat(melody, beat)

        if (newIndex !== this.currentNoteIndex) {
          if (this.currentNoteIndex >= 0) {
            this._emit({
              type: 'noteEnd',
              note: melody[this.currentNoteIndex],
              index: this.currentNoteIndex,
            })
            this._playNoteEnd()
          }
          this.currentNoteIndex = newIndex
          if (newIndex >= 0) {
            this._emit({
              type: 'noteStart',
              note: melody[newIndex],
              index: newIndex,
            })
            this._playNoteStart()
          }
        }

        this.currentBeat = beat
        this._emit({ type: 'beat', beat })

        const totalBeats = this._getTotalBeats(melody)
        if (beat >= totalBeats) {
          this._emit({ type: 'complete' })
          this.stop()
          return
        }

        this.animationFrameId = requestAnimationFrame(animate)
      }
    }

    this.playStartTime = performance.now()
    this.animationFrameId = requestAnimationFrame(animate)
  }

  private _stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  private _emit(event: PlaybackEvent): void {
    this.callbacks.onEvent?.(event)
    this.onEventCallbacks.get(event.type)?.forEach((h) => h(event as never))

    switch (event.type) {
      case 'state':
        this.callbacks.onNoteStart = undefined
        break
      case 'beat':
        this.callbacks.onBeatUpdate?.(event.beat!)
        break
      case 'noteStart':
        this.callbacks.onNoteStart?.(event.note!, event.index!)
        break
      case 'noteEnd':
        this.callbacks.onNoteEnd?.(event.note!, event.index!)
        break
      case 'complete':
        this.callbacks.onComplete?.()
        break
    }
  }

  private _playNoteStart(): void {
    const note = this._melody[this.currentNoteIndex]
    if (note?.note.midi !== 0) {
      const beatDurationMs = 60000 / this._bpm
      this.audioEngine.playTone(note.note.freq, note.duration * beatDurationMs)
    }
  }

  private _playNoteEnd(): void {
    this.audioEngine.stopTone()
  }

  // ── Config Accessors ───────────────────────────────────────

  get _bpm(): number {
    const bpm = this.audioEngine.getBPM?.()
    return bpm !== undefined ? bpm : 120
  }

  set _bpm(bpm: number) {
    const audioEngine = this.audioEngine as unknown as {
      setBPM?: (bpm: number) => void
    }
    audioEngine.setBPM?.(bpm)
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this.stop()
    this.audioEngine.destroy()
  }
}
