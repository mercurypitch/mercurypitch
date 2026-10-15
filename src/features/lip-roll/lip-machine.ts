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
// (ng-machine.ts).
//
// `demo` moves the room for the "how it works" demo (demo/), which buzzes
// its waves through the room with no microphone: it never applies while a
// microphone answer is pending or the room is blocked, and it bumps `run`
// so no answer can land in it.

import type { MicState } from '@/components/room-kit/mic-state'

export type LipPhase =
  | 'intro'
  | 'starting'
  | 'settle'
  | 'run'
  | 'result'
  | 'blocked'

export type LipBlock = 'denied' | 'unavailable'

/** The phases the demo puts the room in: its start, and a wave. */
export type LipDemoPhase = 'intro' | 'run'

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
  | { readonly type: 'demo'; readonly phase: LipDemoPhase }

const RUN_PHASES: ReadonlySet<LipPhase> = new Set<LipPhase>([
  'starting',
  'settle',
  'run',
])

/** A run is under way: the microphone is asked for or open. */
export function isRunPhase(phase: LipPhase): boolean {
  return RUN_PHASES.has(phase)
}

/**
 * The mic's state (mic-state.ts) in a phase. A run is the singer's turn
 * only while a wave is being ridden (`riding`: its up, top and down, from
 * the run's clock against the glide path); it waits, open, through the
 * count-in, each landing and breath, and the mic's opening. The settle,
 * an easy note before the waves, is the singer's too. The demo's waves
 * never open the mic: they wait.
 */
export function lipMicState(
  phase: LipPhase,
  riding: boolean,
  demo: boolean,
): MicState {
  if (phase === 'result') return 'done'
  if (demo) return 'wait'
  switch (phase) {
    case 'settle':
      return 'sing'
    case 'run':
      return riding ? 'sing' : 'wait'
    case 'starting':
      return 'wait'
    case 'intro':
    case 'blocked':
      return 'ready'
  }
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

/** The demo's own move, never over a mic being opened or a block. */
function onDemo(
  state: LipState,
  event: Extract<LipEvent, { type: 'demo' }>,
): LipState {
  if (state.phase === 'starting' || state.phase === 'blocked') return state
  return { ...state, phase: event.phase, run: state.run + 1 }
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
  demo: onDemo,
}

export function lipReducer(state: LipState, event: LipEvent): LipState {
  const handler = HANDLERS[event.type] as (
    state: LipState,
    event: LipEvent,
  ) => LipState
  return handler(state, event)
}
