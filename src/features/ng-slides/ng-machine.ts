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
//
// `demo` moves the room for the "how it works" demo (demo/), which hums its
// slides through the room with no microphone: it never applies while a
// microphone answer is pending or the room is blocked, and it bumps `run`
// so no answer can land in it.

import type { MicState } from '@/components/room-kit/mic-state'

export type NgPhase =
  | 'intro'
  | 'starting'
  | 'settle'
  | 'run'
  | 'result'
  | 'blocked'

export type NgBlock = 'denied' | 'unavailable'

/** The phases the demo puts the room in: its start, and a slide. */
export type NgDemoPhase = 'intro' | 'run'

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
  | { readonly type: 'demo'; readonly phase: NgDemoPhase }

const RUN_PHASES: ReadonlySet<NgPhase> = new Set<NgPhase>([
  'starting',
  'settle',
  'run',
])

/** A run is under way: the microphone is asked for or open. */
export function isRunPhase(phase: NgPhase): boolean {
  return RUN_PHASES.has(phase)
}

/**
 * The mic's state (mic-state.ts) in a phase. A run is the singer's turn
 * only while a slide is being sung (`sliding`: its up, top and down, from
 * the run's clock against the glide path); it waits, open, through the
 * count-in, each landing and breath, and the mic's opening. The settle,
 * an easy note before the slides, is the singer's too. The demo's slides
 * never open the mic: they wait.
 */
export function ngMicState(
  phase: NgPhase,
  sliding: boolean,
  demo: boolean,
): MicState {
  if (phase === 'result') return 'done'
  if (demo) return 'wait'
  switch (phase) {
    case 'settle':
      return 'sing'
    case 'run':
      return sliding ? 'sing' : 'wait'
    case 'starting':
      return 'wait'
    case 'intro':
    case 'blocked':
      return 'ready'
  }
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

/** The demo's own move, never over a mic being opened or a block. */
function onDemo(
  state: NgState,
  event: Extract<NgEvent, { type: 'demo' }>,
): NgState {
  if (state.phase === 'starting' || state.phase === 'blocked') return state
  return { ...state, phase: event.phase, run: state.run + 1 }
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
  demo: onDemo,
}

export function ngReducer(state: NgState, event: NgEvent): NgState {
  const handler = HANDLERS[event.type] as (
    state: NgState,
    event: NgEvent,
  ) => NgState
  return handler(state, event)
}
