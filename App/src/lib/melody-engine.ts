// ============================================================
// Melody Engine — Orchestrates melody playback with audio
// ============================================================

import type { MelodyItem, MelodyNote } from '@/types'
import { melodyIndexAtBeat } from './scale-data'

export interface MelodyEngineCallbacks {
  onNoteStart?: (item: MelodyItem, noteIndex: number) => void
  onNoteEnd?: (item: MelodyItem, noteIndex: number) => void
  onBeatUpdate?: (currentBeat: number) => void
  onComplete?: () => void
  onCountIn?: (beat: number) => void // Called during count-in beats
  onCountInComplete?: () => void // Called when count-in finishes
  onMetronomeTick?: (beat: number, isDownbeat: boolean) => void // Called for metronome during playback
}

export interface MelodyEngineOptions {
  bpm: number
  melody: MelodyItem[]
  onNoteStart?: (item: MelodyItem, noteIndex: number) => void
  onNoteEnd?: (item: MelodyItem, noteIndex: number) => void
  onBeatUpdate?: (currentBeat: number) => void
  onComplete?: () => void
  onCountIn?: (beat: number) => void
  onCountInComplete?: () => void
  onMetronomeTick?: (beat: number, isDownbeat: boolean) => void
}

export class MelodyEngine {
  private melody: MelodyItem[] = []
  private bpm: number
  private playbackSpeed = 1.0
  private callbacks: MelodyEngineCallbacks

  private isPlaying = false
  private isPaused = false
  private animFrameId: number | null = null
  private playStartTime = 0
  private pauseOffset = 0
  private currentBeat = 0
  private currentNoteIndex = -1
  private hopActive = false
  private hopStartTime = 0
  private hopFromY = 0
  private hopToY = 0
  private hopDuration = 280

  // Count-in
  private countInBeats = 0
  private countInBeat = 0

  // Metronome
  private metronomeLastBeat = -1

  constructor(options: MelodyEngineOptions) {
    this.bpm = options.bpm
    this.melody = options.melody
    this.callbacks = {
      onNoteStart: options.onNoteStart,
      onNoteEnd: options.onNoteEnd,
      onBeatUpdate: options.onBeatUpdate,
      onComplete: options.onComplete,
      onCountIn: options.onCountIn,
      onCountInComplete: options.onCountInComplete,
      onMetronomeTick: options.onMetronomeTick,
    }
  }

  // ── Config ────────────────────────────────────────────────

  setMelody(melody: MelodyItem[]): void {
    this.melody = melody
  }

  setBPM(bpm: number): void {
    this.bpm = bpm
  }

  setCountIn(beats: number): void {
    this.countInBeats = Math.max(0, Math.min(4, beats))
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.25, Math.min(2.0, speed))
  }

  getPlaybackSpeed(): number {
    return this.playbackSpeed
  }

  getMelody(): MelodyItem[] {
    return this.melody
  }

  totalBeats(): number {
    let max = 0
    for (const item of this.melody) {
      const end = item.startBeat + item.duration
      if (end > max) max = end
    }
    return max
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

  isInCountIn(): boolean {
    return this.countInBeats > 0 && this.currentBeat < 0
  }

  getCountInBeat(): number {
    return this.countInBeat
  }

  /** Returns the performance.now() timestamp when playback started (count-in adjusted).
   *  Used by the piano roll editor to sync its animation timeline. */
  getPlayStartTime(): number {
    return this.playStartTime
  }

  // ── Playback ──────────────────────────────────────────────

  start(countInBeats = 0): void {
    if (this.isPlaying) return

    this.isPlaying = true
    this.isPaused = false
    this.countInBeat = 0
    this.metronomeLastBeat = -1

    if (countInBeats > 0) {
      // Start with count-in phase
      this.currentBeat = -countInBeats // Negative beats for count-in
      this.countInBeats = countInBeats
    } else {
      // Start immediately
      this.currentBeat = 0
      this.countInBeats = 0
    }

    this.pauseOffset = 0
    this.playStartTime = performance.now()
    this.hopActive = false
    this.hopStartTime = 0
    this.currentNoteIndex = -1

    this._tick()
  }

  pause(): void {
    if (!this.isPlaying || this.isPaused) return

    this.isPaused = true
    this.pauseOffset = performance.now() - this.playStartTime
    this._stopTick()
  }

  resume(): void {
    if (!this.isPlaying || !this.isPaused) return

    this.isPaused = false
    this.playStartTime = performance.now() - this.pauseOffset
    this._tick()
  }

  stop(): void {
    this._stopTick()
    this.isPlaying = false
    this.isPaused = false
    this.currentBeat = 0
    this.currentNoteIndex = -1
  }

  /** Seek to a specific beat position (while playing or paused) */
  seekTo(targetBeat: number): void {
    const beatDurationMs = 60000 / this.bpm
    this.playStartTime =
      performance.now() - (targetBeat * beatDurationMs) / this.playbackSpeed
    this.pauseOffset = (targetBeat * beatDurationMs) / this.playbackSpeed
    this.currentBeat = targetBeat
    // Recalculate current note index based on new beat position
    const sorted = [...this.melody].sort((a, b) => a.startBeat - b.startBeat)
    let newNoteIndex = -1
    for (let i = 0; i < sorted.length; i++) {
      if (
        sorted[i].startBeat <= targetBeat &&
        sorted[i].startBeat + sorted[i].duration > targetBeat
      ) {
        newNoteIndex = this.melody.findIndex((m) => m.id === sorted[i].id)
        break
      }
    }
    this.currentNoteIndex = newNoteIndex
  }

  private _tick(): void {
    this.animFrameId = requestAnimationFrame(() => this._onFrame())
  }

  private _stopTick(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }

  private _onFrame(): void {
    if (!this.isPlaying || this.isPaused) return

    const elapsed =
      (performance.now() - this.playStartTime) * this.playbackSpeed
    const beatsPerMs = this.bpm / 60000
    const rawBeat = elapsed * beatsPerMs

    // Handle count-in phase
    if (this.countInBeats > 0 && rawBeat < 0) {
      // Still in count-in phase
      const countInPos = rawBeat + this.countInBeats // 0 to countInBeats-1
      const currentCountInBeat = Math.floor(countInPos)

      // Check if count-in beat changed
      if (currentCountInBeat !== this.countInBeat) {
        this.countInBeat = currentCountInBeat
        // Callback for count-in beat (play tick sound, show "1", "2", etc.)
        this.callbacks.onCountIn?.(this.countInBeat + 1)
      }

      this.currentBeat = rawBeat
      this.callbacks.onBeatUpdate?.(this.currentBeat)
      this._tick()
      return
    }

    // Transition from count-in to actual playback
    if (this.countInBeats > 0 && rawBeat >= 0 && this.countInBeats > 0) {
      // Count-in just completed
      this.callbacks.onCountInComplete?.()
      this.countInBeats = 0
    }

    this.currentBeat = rawBeat

    // Metronome tick on each beat during playback
    const currentBeatInt = Math.floor(this.currentBeat)
    if (
      currentBeatInt !== this.metronomeLastBeat &&
      this.metronomeLastBeat >= 0
    ) {
      const isDownbeat = currentBeatInt % 4 === 0
      this.callbacks.onMetronomeTick?.(currentBeatInt, isDownbeat)
    }
    this.metronomeLastBeat = currentBeatInt

    const total = this.totalBeats()

    // Check for end
    if (this.currentBeat >= total) {
      this.currentBeat = total
      this.callbacks.onBeatUpdate?.(this.currentBeat)
      this.callbacks.onComplete?.()
      return
    }

    // Check for note change
    const newIndex = melodyIndexAtBeat(this.melody, this.currentBeat)
    if (newIndex !== this.currentNoteIndex) {
      // End previous note
      if (this.currentNoteIndex >= 0) {
        this.callbacks.onNoteEnd?.(
          this.melody[this.currentNoteIndex],
          this.currentNoteIndex,
        )
      }

      // Trigger hop
      if (this.currentNoteIndex >= 0 && newIndex >= 0) {
        this.hopFromY = this.currentNoteIndex
        this.hopToY = newIndex
        this.hopActive = true
        this.hopStartTime = performance.now()
      }

      this.currentNoteIndex = newIndex
      if (newIndex >= 0) {
        this.callbacks.onNoteStart?.(this.melody[newIndex], newIndex)
      }
    }

    this.callbacks.onBeatUpdate?.(this.currentBeat)
    this._tick()
  }

  // ── Hop animation ─────────────────────────────────────────

  getHopProgress(): {
    active: boolean
    progress: number
    from: number
    to: number
  } {
    if (!this.hopActive) {
      return { active: false, progress: 0, from: 0, to: 0 }
    }
    const elapsed = performance.now() - this.hopStartTime
    const progress = Math.min(1, elapsed / this.hopDuration)
    if (progress >= 1) this.hopActive = false
    return {
      active: this.hopActive,
      progress,
      from: this.hopFromY,
      to: this.hopToY,
    }
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this._stopTick()
  }
}
