// ============================================================
// Glass — session state machine (spec §3.1).
//
// Pure reducer owning the ORDER of the experience:
//
//   idle → mic → calibrate → announce → sing(rep n) → playback →
//        ↻ gap → sing(rep n+1) …           ↘ shatter → results
//
// The component owns timers, audio and rendering; every async
// flow re-checks its generation token against this state so
// orphaned flows die instead of clobbering a successor run.
// ============================================================

import type { RepMetrics } from './metrics'

export type GlassPhase =
  | 'idle'
  | 'mic'
  | 'mic-denied'
  | 'calibrate'
  | 'calibrate-failed'
  | 'announce'
  | 'sing'
  | 'playback'
  | 'gap'
  | 'shatter'
  | 'results'

export interface GlassSessionState {
  phase: GlassPhase
  /** 1-based; 0 before the first rep. */
  rep: number
  calibrationTries: number
  ceilingMidi: number | null
  targetMidi: number | null
  /** The target came from the median fallback, not a clean ceiling. */
  usedFallback: boolean
  repMetrics: RepMetrics[]
  /** Which rep shattered the glass (null: still standing). */
  shatterRep: number | null
}

export type GlassEvent =
  | { type: 'start' }
  | { type: 'mic-granted' }
  | { type: 'mic-denied' }
  | {
      type: 'calibrate-done'
      ok: boolean
      ceilingMidi: number | null
      targetMidi: number | null
      fallbackTargetMidi: number | null
    }
  | { type: 'announce-done' }
  | { type: 'sing-done'; metrics: RepMetrics }
  | { type: 'shattered'; metrics: RepMetrics }
  | { type: 'playback-done' }
  | { type: 'gap-done' }
  | { type: 'shatter-done' }
  | { type: 'end-session' }
  | { type: 'reset' }

export function initialSessionState(): GlassSessionState {
  return {
    phase: 'idle',
    rep: 0,
    calibrationTries: 0,
    ceilingMidi: null,
    targetMidi: null,
    usedFallback: false,
    repMetrics: [],
    shatterRep: null,
  }
}

/** How many calibration attempts before falling back to the median target. */
export const MAX_CALIBRATION_TRIES = 2

export function reduceSession(
  state: GlassSessionState,
  event: GlassEvent,
): GlassSessionState {
  switch (event.type) {
    case 'start':
      return state.phase === 'idle' ? { ...state, phase: 'mic' } : state
    case 'mic-granted':
      return state.phase === 'mic' ? { ...state, phase: 'calibrate' } : state
    case 'mic-denied':
      return state.phase === 'mic' ? { ...state, phase: 'mic-denied' } : state
    case 'calibrate-done': {
      if (state.phase !== 'calibrate') return state
      const tries = state.calibrationTries + 1
      if (event.ok && event.targetMidi !== null) {
        return {
          ...state,
          calibrationTries: tries,
          ceilingMidi: event.ceilingMidi,
          targetMidi: event.targetMidi,
          usedFallback: false,
          phase: 'announce',
        }
      }
      if (tries < MAX_CALIBRATION_TRIES) {
        return { ...state, calibrationTries: tries }
      }
      if (event.fallbackTargetMidi !== null) {
        return {
          ...state,
          calibrationTries: tries,
          ceilingMidi: event.ceilingMidi,
          targetMidi: event.fallbackTargetMidi,
          usedFallback: true,
          phase: 'announce',
        }
      }
      return { ...state, calibrationTries: tries, phase: 'calibrate-failed' }
    }
    case 'announce-done':
      return state.phase === 'announce'
        ? { ...state, phase: 'sing', rep: 1 }
        : state
    case 'sing-done':
      return state.phase === 'sing'
        ? {
            ...state,
            repMetrics: [...state.repMetrics, event.metrics],
            phase: 'playback',
          }
        : state
    case 'shattered':
      return state.phase === 'sing'
        ? {
            ...state,
            repMetrics: [...state.repMetrics, event.metrics],
            shatterRep: state.rep,
            phase: 'shatter',
          }
        : state
    case 'playback-done':
      return state.phase === 'playback' ? { ...state, phase: 'gap' } : state
    case 'gap-done':
      return state.phase === 'gap'
        ? { ...state, phase: 'sing', rep: state.rep + 1 }
        : state
    case 'shatter-done':
      return state.phase === 'shatter' ? { ...state, phase: 'results' } : state
    case 'end-session':
      // The singer bails mid-loop: honest "the glass held" results.
      return state.phase === 'sing' ||
        state.phase === 'playback' ||
        state.phase === 'gap'
        ? { ...state, phase: 'results' }
        : state
    case 'reset':
      return initialSessionState()
  }
}
