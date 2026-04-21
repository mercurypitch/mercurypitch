// ============================================================
// MelodyEngine — Wrapper around PlaybackRuntime
// Minimal wrapper for backward compatibility
// ============================================================

import type { MelodyItem } from '@/types'
import { PlaybackRuntime } from './playback-runtime'

export interface MelodyEngineCallbacks {
  onNoteStart?: (item: MelodyItem, noteIndex: number) => void
  onNoteEnd?: (item: MelodyItem, noteIndex: number) => void
  onBeatUpdate?: (currentBeat: number) => void
  onComplete?: () => void
  onCountIn?: (beat: number) => void
  onCountInComplete?: () => void
  onMetronomeTick?: (beat: number, isDownbeat: boolean) => void
}

export interface MelodyEngineOptions {
  bpm: number
  onNoteStart?: (item: MelodyItem, noteIndex: number) => void
  onNoteEnd?: (item: MelodyItem, noteIndex: number) => void
  onBeatUpdate?: (currentBeat: number) => void
  onComplete?: () => void
  onCountIn?: (beat: number) => void
  onCountInComplete?: () => void
  onMetronomeTick?: (beat: number, isDownbeat: boolean) => void
}

export class MelodyEngine {
  private runtime: PlaybackRuntime
  private pauseStartTime = 0
  private pauseOffset = 0

  constructor(options: MelodyEngineOptions) {
    this.runtime = new PlaybackRuntime({
      bpm: options.bpm,
      metronomeEnabled: () => false, // Default disabled
      onNoteStart: options.onNoteStart,
      onNoteEnd: options.onNoteEnd,
      onBeatUpdate: options.onBeatUpdate,
      onComplete: options.onComplete,
    })

    // Set up event forwarding
    this.runtime.on('beat', (e: { beat: number }) => {
      options.onBeatUpdate?.(e.beat)
    })
    this.runtime.on('noteStart', (e: { note: MelodyItem; index: number }) => {
      options.onNoteStart?.(e.note, e.index)
    })
    this.runtime.on('noteEnd', (e: { note: MelodyItem; index: number }) => {
      options.onNoteEnd?.(e.note, e.index)
    })
    this.runtime.on('complete', () => options.onComplete?.())

    // Forward count-in events
    this.runtime.on('countIn', (e: { countIn: number }) => {
      options.onCountIn?.(e.countIn)
    })
    this.runtime.on('countInComplete', () => options.onCountInComplete?.())
    this.runtime.on('metronome', (e: { beat: number; isDownbeat: boolean }) => {
      options.onMetronomeTick?.(e.beat, e.isDownbeat)
    })
  }

  // ── Config ────────────────────────────────────────────────

  setMelody(melody: MelodyItem[]): void {
    this.runtime.setMelody(melody)
  }

  setBPM(_bpm: number): void {
    this.runtime.setBPM(_bpm)
  }

  setCountIn(_beats: number): void {
    // This would require a public API for setting count-in at runtime
    // For now, this is a no-op - count-in must be set before calling start()
  }

  setPlaybackSpeed(_speed: number): void {
    // PlaybackRuntime doesn't support speed yet - would need audio engine support
  }

  getPlaybackSpeed(): number {
    return 1
  }

  getBPM(): number {
    return this.runtime.getBPM()
  }

  getMelody(): MelodyItem[] {
    return this.runtime.getMelody()
  }

  totalBeats(): number {
    const melody = this.runtime.getMelody()
    let max = 0
    for (const item of melody) {
      const end = item.startBeat + item.duration
      if (end > max) max = end
    }
    return max
  }

  // ── State ─────────────────────────────────────────────────

  getIsPlaying(): boolean {
    return this.runtime.getIsPlaying()
  }

  getIsPaused(): boolean {
    return this.runtime.getIsPaused()
  }

  getCurrentBeat(): number {
    return this.runtime.getCurrentBeat()
  }

  getCurrentNoteIndex(): number {
    return this.runtime.getCurrentNoteIndex()
  }

  getPlaybackState(): ReturnType<typeof PlaybackRuntime.prototype.getPlaybackState> {
    return this.runtime.getPlaybackState()
  }

  // ── Playback Control ───────────────────────────────────────

  start(countInBeats: number = 0): void {
    this.runtime.start(countInBeats)
  }

  pause(): void {
    this.runtime.pause()
  }

  resume(): void {
    this.runtime.resume()
  }

  stop(): void {
    this.runtime.stop()
  }

  seekTo(beat: number): void {
    this.runtime.seekTo(beat)
  }

  /** Set count-in beats */
  setCountIn(beats: number): void {
    this.runtime._countInBeats = beats
  }

  /** Get current count-in beat */
  getCountInBeat(): number {
    return this.runtime.countInBeat
  }

  /** Check if in count-in phase */
  isInCountIn(): boolean {
    return this.runtime.countInBeats > 0 && this.runtime.getIsPlaying()
  }

  // ── Subscription API ─────────────────────────────────────

  on(event: 'state', handler: (state: ReturnType<typeof PlaybackRuntime.prototype.getPlaybackState>) => void): void
  on(event: 'beat', handler: (e: { beat: number }) => void): void
  on(event: 'noteStart', handler: (e: { note: MelodyItem; index: number }) => void): void
  on(event: 'noteEnd', handler: (e: { note: MelodyItem; index: number }) => void): void
  on(event: 'complete', handler: () => void): void
  on(event: 'countIn', handler: (e: { countIn: number }) => void): void
  on(event: 'countInComplete', handler: () => void): void
  on(event: 'metronome', handler: (e: { beat: number; isDownbeat: boolean }) => void): void
  on(event: 'beat', handler: (e: unknown) => void): void {
    this.runtime.on(event, handler)
  }

  off(event: 'beat', _handler: (e: unknown) => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'state', _handler: (state: ReturnType<typeof PlaybackRuntime.prototype.getPlaybackState>) => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'noteStart', _handler: (e: { note: MelodyItem; index: number }) => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'noteEnd', _handler: (e: { note: MelodyItem; index: number }) => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'complete', _handler: () => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'countIn', _handler: (e: { countIn: number }) => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'countInComplete', _handler: () => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'metronome', _handler: (e: { beat: number; isDownbeat: boolean }) => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'state', _handler: (state: ReturnType<typeof PlaybackRuntime.prototype.getPlaybackState>) => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'complete', _handler: () => void): void {
    this.runtime.off(event, _handler)
  }

  off(event: 'countInComplete', _handler: () => void): void {
    this.runtime.off(event, _handler)
  }

  // ── Hop Animation ─────────────────────────────────────────

  getHopProgress(): { active: boolean } {
    return { active: false }
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this.runtime.destroy()
  }
}