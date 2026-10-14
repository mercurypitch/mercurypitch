// ============================================================
// Lip roll's states: from the intro to the result
// ============================================================
//
//   intro     the bay unlit, Merc buzzing at the first root, his line, the mic
//   starting  the mic opens (inside the singer's tap)
//   settle    no voiceprint and no note kept: the singer sings an easy note
//   run       the count-in and the three waves, the bay scrolling
//   result    the whole bay, lit as the waves lit it
//   blocked   the mic would not open
//
// Where a run is inside itself (count-in, a wave, a breath) is not a state
// here: it is the run's clock against the glide path, read by the
// controller every frame. Stopping, a minute of quiet and leaving the app
// drop the run: back to the intro, nothing kept. Ng slides' machine
// (ng-machine.ts), before its demo.

export type LipPhase =
  | 'intro'
  | 'starting'
  | 'settle'
  | 'run'
  | 'result'
  | 'blocked'

export type LipBlock = 'denied' | 'unavailable'

export interface LipState {
  readonly phase: LipPhase
  /** Each start is numbered, so a late answer from an old one is ignored. */
  readonly run: number
  readonly block: LipBlock | null
}

export type LipEvent =
  | { readonly type: 'start' }
  | {
      readonly type: 'mic-ready'
      readonly run: number
      readonly rooted: boolean
    }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: LipBlock
    }
  | { readonly type: 'settled' }
  | { readonly type: 'finished' }
  | { readonly type: 'stop' }
  | { readonly type: 'rest' }
  | { readonly type: 'leave' }

const RUN_PHASES: ReadonlySet<LipPhase> = new Set<LipPhase>([
  'starting',
  'settle',
  'run',
])

/** A run is under way: the microphone is asked for or open. */
export function isRunPhase(phase: LipPhase): boolean {
  return RUN_PHASES.has(phase)
}

export function initialLipState(): LipState {
  return { phase: 'intro', run: 0, block: null }
}

function onStart(state: LipState): LipState {
  const from = state.phase
  if (from !== 'intro' && from !== 'result' && from !== 'blocked') return state
  return { phase: 'starting', run: state.run + 1, block: null }
}

function onMicReady(
  state: LipState,
  event: Extract<LipEvent, { type: 'mic-ready' }>,
): LipState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return { ...state, phase: event.rooted ? 'run' : 'settle' }
}

function onMicFailed(
  state: LipState,
  event: Extract<LipEvent, { type: 'mic-failed' }>,
): LipState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return { ...state, phase: 'blocked', block: event.block }
}

const move =
  (from: LipPhase, to: LipPhase) =>
  (state: LipState): LipState =>
    state.phase === from ? { ...state, phase: to } : state

/** A run dropped: back to the intro, nothing kept. */
function onDrop(state: LipState): LipState {
  return isRunPhase(state.phase) ? { ...state, phase: 'intro' } : state
}

type Handlers = {
  readonly [K in LipEvent['type']]: (
    state: LipState,
    event: Extract<LipEvent, { type: K }>,
  ) => LipState
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

export function lipReducer(state: LipState, event: LipEvent): LipState {
  const handler = HANDLERS[event.type] as (
    state: LipState,
    event: LipEvent,
  ) => LipState
  return handler(state, event)
}
