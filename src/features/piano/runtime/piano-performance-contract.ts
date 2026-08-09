// ============================================================
// Piano performance contract — one beat-native stage and transport boundary
// ============================================================
//
// Legacy falling-notes practice and the standalone Piano Night shell can
// share this vocabulary without sharing a component tree. Score beats remain
// authoritative here: hosts may project them for display, but this contract
// never creates or advances a second clock.

import type { Accessor } from 'solid-js'

export type PianoPerformancePhase =
  | 'ready'
  | 'count-in'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'error'

export interface PianoPerformanceNote {
  id: string | number
  midi: number
  name: string
  startBeat: number
  /** Duration in score beats. */
  duration: number
  targetFreq: number
  isBacking?: boolean
  trackId?: string
}

/** The runtime's existing beat timeline, exposed without conversion. */
export interface PianoPerformanceTimeline {
  playheadBeat: Accessor<number>
  totalBeats: Accessor<number>
  tempoBpm: Accessor<number>
}

export interface PianoPerformanceStageSource {
  title: Accessor<string>
  notes: Accessor<readonly PianoPerformanceNote[]>
  timeline: PianoPerformanceTimeline
}

export interface PianoPerformanceTransport {
  phase: Accessor<PianoPerformancePhase>
  timeline: PianoPerformanceTimeline
  speed: Accessor<number>
  /** Resolves false when no playable notes are available. */
  play(): Promise<boolean>
  pause(): void
  stop(): void
  seekToBeat(beat: number): void
  setTempoBpm(bpm: number): void
  setSpeed(speed: number): void
}

export interface PianoPerformanceRuntime {
  stage: PianoPerformanceStageSource
  transport: PianoPerformanceTransport
}
