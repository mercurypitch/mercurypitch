// ============================================================
// The alley's states, as a reducer
// ============================================================
//
// Pure, so every transition the brief names (S4 §2) is a unit test rather
// than a screenshot. The component owns the side effects — the clip, the
// ambient, the shared element, the navigation — and fires them from the
// transition it observes here, inside the same tap.
//
//   rest ──tap-door──▶ selected ──wake──▶ alive ──enter──▶ opening ──covered──▶ open
//    ▲                   │  ▲                │                                    │
//    └────tap-plate──────┘  └──tap-door──────┘ (another door)                     │
//    └──────────settled──── settling ◀───────────────returned─────────────────────┘
//
// A locked door selects and stops there: no wake, no enter. Tapping the
// selected door again is Enter for a room that is open and nothing for one
// that is not. While the shared element is growing nothing is taken.

import type { DoorKey } from './alley-plate'

export type AlleyPhase =
  | 'rest'
  | 'selected'
  | 'alive'
  | 'opening'
  | 'open'
  | 'settling'

export interface AlleyState {
  readonly phase: AlleyPhase
  /** The door the phase is about; null only at rest. */
  readonly door: DoorKey | null
}

export type AlleyEvent =
  | { type: 'tap-door'; key: DoorKey; enterable: boolean }
  /** The selected door's clip and ambient have been started. */
  | { type: 'wake' }
  /** A tap anywhere that is not a door or the card. */
  | { type: 'tap-plate' }
  | { type: 'enter' }
  /** The shared element covers the screen; the room mounts under it. */
  | { type: 'covered' }
  /** The alley is back on screen after a room. */
  | { type: 'returned' }
  | { type: 'settled' }
  /** The tab changed or the app went to the background mid-selection. */
  | { type: 'leave' }

export const ALLEY_REST: AlleyState = { phase: 'rest', door: null }

const selecting = (phase: AlleyPhase): boolean =>
  phase === 'rest' ||
  phase === 'selected' ||
  phase === 'alive' ||
  phase === 'settling'

export function alleyReducer(
  state: AlleyState,
  event: AlleyEvent,
  enterable: (key: DoorKey) => boolean,
): AlleyState {
  switch (event.type) {
    case 'tap-door': {
      if (!selecting(state.phase)) return state
      const again =
        state.door === event.key &&
        (state.phase === 'selected' || state.phase === 'alive')
      if (again) {
        return event.enterable ? { phase: 'opening', door: event.key } : state
      }
      return { phase: 'selected', door: event.key }
    }
    case 'wake':
      if (state.phase !== 'selected' || state.door === null) return state
      return enterable(state.door) ? { ...state, phase: 'alive' } : state
    case 'tap-plate':
      return state.phase === 'selected' || state.phase === 'alive'
        ? ALLEY_REST
        : state
    case 'enter':
      if (state.door === null) return state
      if (state.phase !== 'selected' && state.phase !== 'alive') return state
      return enterable(state.door) ? { ...state, phase: 'opening' } : state
    case 'covered':
      return state.phase === 'opening' ? { ...state, phase: 'open' } : state
    case 'returned':
      // An open that never finished (the app went away mid-grow) comes back
      // the same way: settled into place, not frozen half-open.
      return (state.phase === 'open' || state.phase === 'opening') &&
        state.door !== null
        ? { ...state, phase: 'settling' }
        : state
    case 'settled':
      return state.phase === 'settling' ? ALLEY_REST : state
    case 'leave':
      return state.phase === 'selected' ||
        state.phase === 'alive' ||
        state.phase === 'settling'
        ? ALLEY_REST
        : state
  }
}

/** Selected, alive and settling all draw the door lifted out of the plate. */
export function isLifted(state: AlleyState, key: DoorKey): boolean {
  return (
    state.door === key &&
    (state.phase === 'selected' ||
      state.phase === 'alive' ||
      state.phase === 'opening' ||
      state.phase === 'settling')
  )
}
