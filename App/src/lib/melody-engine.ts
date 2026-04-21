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
      metronomeEnabled: () => false,
      onNoteStart: options.onNoteStart,
      onNoteEnd: options.onNoteEnd,
      onBeatUpdate: options.onBeatUpdate,
      onComplete: options.onComplete,
    })

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

    this.runtime.on('countIn', (e: { countIn: number }) => {
      options.onCountIn?.(e.countIn)
    })
    this.runtime.on('countInComplete', () => options.onCountInComplete?.())
    this.runtime.on('metronome', (e: { beat: number; isDownbeat: boolean }) => {
      options.onMetronomeTick?.(e.beat, e.isDownbeat)
    })
  }

  setMelody(melody: MelodyItem[]): void {
    this.runtime.setMelody(melody)
  }

  setBPM(_bpm: number): void {
    this.runtime.setBPM(_bpm)
  }

  setCountIn(_beats: number): void {
    // Store count-in beats internally (PlaybackRuntime would need to be updated)
    // For now, just validate the input
    const clamped = Math.max(0, Math.min(4, _beats))
    this._countInBeats = clamped
  }

  // Internal method to access count-in beats
  private _countInBeats: number = 0
  getCountIn(): number {
    return this._countInBeats
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

  // ── Hop Animation ─────────────────────────────────────────

  getHopProgress(): { active: boolean } {
    return { active: false }
  }

  destroy(): void {
    this.runtime.destroy()
  }
}