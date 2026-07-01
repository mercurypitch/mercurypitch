// ============================================================
// Voice Mirror — session state machine (pure).
//
// Sequences the guided flow
//   idle → mic → glide-up → glide-down → hold → match(1..5)
//        → compute → results
// as a reducer over events. The UI owns timers and audio; this
// module owns ordering, frame accumulation, target picking and
// the one-free-retry rule for match takes — so the whole flow is
// unit-testable without a microphone.
// ============================================================

import type { F0Frame, MatchTake, MirrorResult, RangeResult } from './metrics'
import { computeAccuracy, computeRange, computeSteadiness, pickMatchTargets, scoreMatchTake, } from './metrics'

export const MATCH_NOTE_COUNT = 5
/** One free retry per match note when no voiced lock happened (§4.2). */
export const MATCH_RETRIES_PER_NOTE = 1

/** Fallback targets (around C3–A3) when the glide produced no usable range. */
const FALLBACK_TARGETS = [48, 50, 52, 55, 57]

export type MirrorPhase =
  | 'idle'
  | 'mic'
  | 'mic-denied'
  | 'glide-up'
  | 'glide-down'
  | 'hold'
  | 'match'
  | 'results'

export interface MirrorSessionState {
  phase: MirrorPhase
  /** Completed glide takes (up, down). */
  glides: F0Frame[][]
  /** Hold-task frames. */
  hold: F0Frame[]
  /** Match targets (integer MIDI), picked from the detected range. */
  targets: number[]
  /** Index of the match note currently being sung, 0-based. */
  matchIndex: number
  /** Completed match takes (the kept take per note). */
  matches: MatchTake[]
  /** Retries already spent on the current match note. When > 0, the last
   *  take on this note had no voiced lock and is being retried. */
  retriesUsed: number
  /** Range computed once from the glides (also feeds the final result). */
  range: RangeResult | null
  result: MirrorResult | null
}

export type MirrorEvent =
  | { type: 'start' }
  | { type: 'mic-granted' }
  | { type: 'mic-denied' }
  | { type: 'glide-done'; frames: F0Frame[] }
  | { type: 'hold-done'; frames: F0Frame[] }
  | { type: 'match-done'; frames: F0Frame[] }
  | { type: 'reset' }

export function initialSessionState(): MirrorSessionState {
  return {
    phase: 'idle',
    glides: [],
    hold: [],
    targets: [],
    matchIndex: 0,
    matches: [],
    retriesUsed: 0,
    range: null,
    result: null,
  }
}

/**
 * Advance the session by one event. Unknown event/phase combinations are
 * ignored (the state is returned unchanged), so stray timers can't corrupt
 * the flow.
 */
export function reduceSession(
  state: MirrorSessionState,
  event: MirrorEvent,
  random: () => number = Math.random,
): MirrorSessionState {
  switch (event.type) {
    case 'reset':
      return initialSessionState()

    case 'start':
      return state.phase === 'idle' ? { ...state, phase: 'mic' } : state

    case 'mic-granted':
      return state.phase === 'mic' || state.phase === 'mic-denied'
        ? { ...state, phase: 'glide-up' }
        : state

    case 'mic-denied':
      return state.phase === 'mic' ? { ...state, phase: 'mic-denied' } : state

    case 'glide-done': {
      if (state.phase === 'glide-up') {
        return {
          ...state,
          phase: 'glide-down',
          glides: [...state.glides, event.frames],
        }
      }
      if (state.phase === 'glide-down') {
        return {
          ...state,
          phase: 'hold',
          glides: [...state.glides, event.frames],
        }
      }
      return state
    }

    case 'hold-done': {
      if (state.phase !== 'hold') return state
      // Targets are picked from the detected range (§4.2) so beginners are
      // never asked to sing outside their voice.
      const range = computeRange(state.glides)
      const targets = range
        ? pickMatchTargets(range.lowMidi, range.highMidi, random)
        : [...FALLBACK_TARGETS]
      return {
        ...state,
        phase: 'match',
        hold: event.frames,
        range,
        targets,
        matchIndex: 0,
        matches: [],
        retriesUsed: 0,
      }
    }

    case 'match-done': {
      if (state.phase !== 'match') return state
      const target = state.targets[state.matchIndex]
      const take = scoreMatchTake(event.frames, target)

      // Mic hiccups shouldn't tank the result: a take with no voiced lock
      // gets one free retry before it is kept as a zero.
      if (!take.locked && state.retriesUsed < MATCH_RETRIES_PER_NOTE) {
        return { ...state, retriesUsed: state.retriesUsed + 1 }
      }

      const matches = [
        ...state.matches,
        { targetMidi: target, frames: event.frames },
      ]
      const isLastNote = state.matchIndex + 1 >= state.targets.length
      if (!isLastNote) {
        return {
          ...state,
          matches,
          matchIndex: state.matchIndex + 1,
          retriesUsed: 0,
        }
      }
      return {
        ...state,
        phase: 'results',
        matches,
        result: {
          range: state.range,
          accuracy: computeAccuracy(
            matches.map((m) => scoreMatchTake(m.frames, m.targetMidi)),
          ),
          steadiness: computeSteadiness(state.hold),
        },
      }
    }
  }
}
