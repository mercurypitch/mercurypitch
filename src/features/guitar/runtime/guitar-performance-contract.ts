// Guitar performance contracts give every host one truthful stage and transport boundary.
// ============================================================

import type { Accessor } from 'solid-js'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'

export type GuitarPerformancePhase =
  | 'ready'
  | 'count-in'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'error'

export interface GuitarHitResult {
  itemIndex: string
  midiNote: number
  noteName: string
  stringIndex: number
  timing: 'perfect' | 'great' | 'good' | 'miss'
  score: number
  timestamp: number
}

/** Canonical media time is always available; score time is nullable until a verified reference is attached. */
export interface GuitarPerformanceTimeline {
  positionSeconds: Accessor<number>
  durationSeconds: Accessor<number>
  playheadBeat: Accessor<number | null>
  tempoBpm: Accessor<number | null>
}

export interface GuitarPerformanceStageSource {
  title: Accessor<string>
  notes: Accessor<readonly GuitarNote[]>
  timeline: GuitarPerformanceTimeline
}

export interface GuitarPerformanceTransport {
  phase: Accessor<GuitarPerformancePhase>
  timeline: GuitarPerformanceTimeline
  playbackRate: Accessor<number>
  play(): Promise<boolean>
  pause(): void
  stop(): void
  seekSeconds(seconds: number): void
  setPlaybackRate(rate: number): Promise<boolean>
}

export interface GuitarPerformanceRuntime {
  stage: GuitarPerformanceStageSource
  transport: GuitarPerformanceTransport
}

export function beatToSeconds(beat: number, bpm: number): number {
  if (!Number.isFinite(beat) || !Number.isFinite(bpm) || bpm <= 0) return 0
  return Math.max(0, beat) * (60 / bpm)
}

export function secondsToBeat(seconds: number, bpm: number): number {
  if (!Number.isFinite(seconds) || !Number.isFinite(bpm) || bpm <= 0) return 0
  return Math.max(0, seconds) * (bpm / 60)
}
