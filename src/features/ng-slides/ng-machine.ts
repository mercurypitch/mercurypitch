// ============================================================
// Ng slides' states: from the intro to the result
// ============================================================
//
//   intro     the bridge unlit, Merc on the pier, his line, the mic
//   starting  the mic opens (inside the singer's tap)
//   settle    no voiceprint and no note kept: the singer hums an easy note
//   run       the count-in and the five slides, the bridge scrolling
//   result    the whole bridge, lit as the slides lit it
//   blocked   the mic would not open
//
// Where a run is inside itself (count-in, a slide, a breath) is not a
// state here: it is the run's clock against the glide path, read by the
// controller every frame. Stopping, a minute of quiet and leaving the app
// drop the run: back to the intro, nothing kept.

export type NgPhase =
  | 'intro'
  | 'starting'
  | 'settle'
  | 'run'
  | 'result'
  | 'blocked'

export type NgBlock = 'denied' | 'unavailable'

export interface NgState {
  readonly phase: NgPhase
  /** Each start is numbered, so a late answer from an old one is ignored. */
  readonly run: number
  readonly block: NgBlock | null
}

export type NgEvent =
  | { readonly type: 'start' }
  | {
      readonly type: 'mic-ready'
      readonly run: number
      readonly rooted: boolean
    }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: NgBlock
    }
  | { readonly type: 'settled' }
  | { readonly type: 'finished' }
  | { readonly type: 'stop' }
  | { readonly type: 'rest' }
  | { readonly type: 'leave' }

const RUN_PHASES: ReadonlySet<NgPhase> = new Set<NgPhase>([
  'starting',
  'settle',
  'run',
])

/** A run is under way: the microphone is asked for or open. */
export function isRunPhase(phase: NgPhase): boolean {
  return RUN_PHASES.has(phase)
}

export function initialNgState(): NgState {
  return { phase: 'intro', run: 0, block: null }
}

function onStart(state: NgState): NgState {
  const from = state.phase
  if (from !== 'intro' && from !== 'result' && from !== 'blocked') return state
  return { phase: 'starting', run: state.run + 1, block: null }
}

function onMicReady(
  state: NgState,
  event: Extract<NgEvent, { type: 'mic-ready' }>,
): NgState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return { ...state, phase: event.rooted ? 'run' : 'settle' }
}

function onMicFailed(
  state: NgState,
  event: Extract<NgEvent, { type: 'mic-failed' }>,
): NgState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return { ...state, phase: 'blocked', block: event.block }
}

const move =
  (from: NgPhase, to: NgPhase) =>
  (state: NgState): NgState =>
    state.phase === from ? { ...state, phase: to } : state

/** A run dropped: back to the intro, nothing kept. */
function onDrop(state: NgState): NgState {
  return isRunPhase(state.phase) ? { ...state, phase: 'intro' } : state
}

type Handlers = {
  readonly [K in NgEvent['type']]: (
    state: NgState,
    event: Extract<NgEvent, { type: K }>,
  ) => NgState
}

const HANDLERS: Handlers = {
  start: onStart,
  'mic-ready': onMicReady,
  'mic-failed': onMicFailed,
  settled: move('settle', 'run'),
  finished: move('run', 'result'),
  stop: onDrop,
  rest: onDrop,
  leave: onDrop,
}

export function ngReducer(state: NgState, event: NgEvent): NgState {
  const handler = HANDLERS[event.type] as (
    state: NgState,
    event: NgEvent,
  ) => NgState
  return handler(state, event)
}
