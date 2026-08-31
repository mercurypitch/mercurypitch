// ============================================================
// Piano performance take — active-time player-note capture
// ============================================================
//
// The recorder consumes only normalized live-input voice lifetimes. Score and
// Hear lanes never pass through this boundary, and paused wall time is removed
// before the completed performance is handed to the deterministic renderer.

import type { PianoInputSourceKind, PianoInputUpdate, PianoInputVoice, } from '@/features/piano/input/piano-input-state'

export const PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS = 5 * 60 * 1000
export const PIANO_PERFORMANCE_TAKE_MAX_NOTES = 10_000

const MINIMUM_NOTE_DURATION_MS = 8

export interface PianoPerformanceTakeNote {
  readonly id: string
  readonly midi: number
  readonly velocity: number
  readonly softPedalValue: number
  readonly releaseVelocity: number
  readonly inputKind: PianoInputSourceKind
  readonly startMs: number
  readonly endMs: number
}

export interface PianoPerformanceTakeCapture {
  readonly notes: readonly PianoPerformanceTakeNote[]
  readonly inputKinds: readonly PianoInputSourceKind[]
  readonly durationMs: number
}

export type PianoPerformanceTakeFinishResult =
  | Readonly<{ ok: true; capture: PianoPerformanceTakeCapture }>
  | Readonly<{
      ok: false
      reason: 'empty' | 'duration-limit' | 'note-limit' | 'not-capturing'
    }>

export interface PianoPerformanceTakeRecorder {
  begin(timestampMs: number): void
  resume(timestampMs: number): boolean
  record(update: PianoInputUpdate): void
  pause(timestampMs: number): boolean
  finish(timestampMs: number): PianoPerformanceTakeFinishResult
  discard(): void
  phase(): 'idle' | 'capturing' | 'paused' | 'invalid'
}

interface ActiveTakeNote {
  readonly takeId: string
  readonly voice: PianoInputVoice
  readonly startMs: number
}

function finiteTimestamp(timestampMs: number): number {
  return Number.isFinite(timestampMs) ? Math.max(0, timestampMs) : 0
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** Capture one contiguous pass while excluding time spent paused. */
export function createPianoPerformanceTakeRecorder(): PianoPerformanceTakeRecorder {
  let recorderPhase: ReturnType<PianoPerformanceTakeRecorder['phase']> = 'idle'
  let segmentStartedAtMs = 0
  let elapsedActiveMs = 0
  let invalidReason: 'duration-limit' | 'note-limit' | null = null
  let noteSerial = 0
  const activeNotes = new Map<string, ActiveTakeNote>()
  const completedNotes: PianoPerformanceTakeNote[] = []
  const inputKinds = new Set<PianoInputSourceKind>()

  const activeTimeAt = (timestampMs: number): number => {
    if (recorderPhase !== 'capturing') return elapsedActiveMs
    return (
      elapsedActiveMs +
      Math.max(0, finiteTimestamp(timestampMs) - segmentStartedAtMs)
    )
  }

  const reset = (): void => {
    recorderPhase = 'idle'
    segmentStartedAtMs = 0
    elapsedActiveMs = 0
    invalidReason = null
    noteSerial = 0
    activeNotes.clear()
    completedNotes.length = 0
    inputKinds.clear()
  }

  const invalidate = (reason: 'duration-limit' | 'note-limit'): void => {
    invalidReason = reason
    recorderPhase = 'invalid'
    activeNotes.clear()
  }

  const closeVoice = (voice: PianoInputVoice, atMs: number): void => {
    const active = activeNotes.get(voice.id)
    if (active === undefined) return
    activeNotes.delete(voice.id)
    completedNotes.push(
      Object.freeze({
        id: active.takeId,
        midi: Math.min(127, Math.max(0, Math.round(active.voice.midi))),
        velocity: clamp01(active.voice.velocity),
        softPedalValue: clamp01(active.voice.softPedalValue),
        releaseVelocity: clamp01(voice.releaseVelocity),
        inputKind: active.voice.source.kind,
        startMs: active.startMs,
        endMs: Math.max(active.startMs + MINIMUM_NOTE_DURATION_MS, atMs),
      }),
    )
    if (completedNotes.length > PIANO_PERFORMANCE_TAKE_MAX_NOTES) {
      invalidate('note-limit')
    }
  }

  return {
    begin(timestampMs) {
      reset()
      recorderPhase = 'capturing'
      segmentStartedAtMs = finiteTimestamp(timestampMs)
    },

    resume(timestampMs) {
      if (recorderPhase !== 'paused') return false
      recorderPhase = 'capturing'
      segmentStartedAtMs = finiteTimestamp(timestampMs)
      return true
    },

    record(update) {
      if (recorderPhase !== 'capturing') return
      const eventTime = activeTimeAt(update.event.timestampMs)
      if (eventTime > PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS) {
        invalidate('duration-limit')
        return
      }

      for (const voice of update.soundingStarted) {
        if (
          completedNotes.length + activeNotes.size >=
          PIANO_PERFORMANCE_TAKE_MAX_NOTES
        ) {
          invalidate('note-limit')
          return
        }
        inputKinds.add(voice.source.kind)
        noteSerial += 1
        activeNotes.set(voice.id, {
          takeId: `player-note-${noteSerial}`,
          voice,
          startMs: eventTime,
        })
      }
      for (const voice of update.soundingStopped) {
        closeVoice(voice, eventTime)
        if (invalidReason !== null) return
      }
    },

    pause(timestampMs) {
      if (recorderPhase !== 'capturing') return false
      const pausedAtMs = activeTimeAt(timestampMs)
      if (pausedAtMs > PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS) {
        invalidate('duration-limit')
        return false
      }
      elapsedActiveMs = pausedAtMs
      for (const active of Array.from(activeNotes.values())) {
        closeVoice(active.voice, elapsedActiveMs)
      }
      if (invalidReason === null) recorderPhase = 'paused'
      return recorderPhase === 'paused'
    },

    finish(timestampMs) {
      if (invalidReason !== null) {
        return Object.freeze({ ok: false, reason: invalidReason! })
      }
      if (recorderPhase !== 'capturing' && recorderPhase !== 'paused') {
        return Object.freeze({ ok: false, reason: 'not-capturing' })
      }
      const finishedAtMs = activeTimeAt(timestampMs)
      if (finishedAtMs > PIANO_PERFORMANCE_TAKE_MAX_DURATION_MS) {
        invalidate('duration-limit')
        return Object.freeze({ ok: false, reason: 'duration-limit' })
      }
      for (const active of Array.from(activeNotes.values())) {
        closeVoice(active.voice, finishedAtMs)
      }
      if (invalidReason !== null) {
        return Object.freeze({ ok: false, reason: invalidReason! })
      }
      const durationMs = Math.max(
        finishedAtMs,
        ...completedNotes.map((note) => note.endMs),
      )
      recorderPhase = 'idle'
      if (completedNotes.length === 0) {
        reset()
        return Object.freeze({ ok: false, reason: 'empty' })
      }
      const capture = Object.freeze({
        notes: Object.freeze([...completedNotes]),
        inputKinds: Object.freeze([...inputKinds].sort()),
        durationMs,
      })
      activeNotes.clear()
      completedNotes.length = 0
      inputKinds.clear()
      elapsedActiveMs = 0
      segmentStartedAtMs = 0
      invalidReason = null
      return Object.freeze({ ok: true, capture })
    },

    discard: reset,

    phase() {
      return recorderPhase
    },
  }
}
