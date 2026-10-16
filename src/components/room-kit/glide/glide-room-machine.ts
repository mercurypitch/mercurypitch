// ============================================================
// A glide room's states: from the intro to the result
// ============================================================
//
//   intro     the path unlit, Merc singing at the first root, his line, the mic
//   starting  the mic opens (inside the singer's tap)
//   settle    no voiceprint and no note kept: the singer sings an easy note
//   run       the count-in and the arches, the world scrolling
//   result    the whole world, lit as the arches lit it
//   blocked   the mic would not open
//
// Where a run is inside itself (count-in, an arch, a breath) is not a state
// here: it is the run's clock against the glide path, read by the
// controller every frame (useGlideRoom.ts). Stopping, a minute of quiet and
// leaving the app drop the run: back to the intro, nothing kept. Lip roll's
// and Ng slides' machines are this one under their own names
// (lip-machine.ts, ng-machine.ts).
//
// `demo` moves the room for the "how it works" demo, which sings its arches
// through the room with no microphone: it never applies while a microphone
// answer is pending or the room is blocked, and it bumps `run` so no answer
// can land in it.

import type { MicState } from '@/components/room-kit/mic-state'

export type GlideRoomPhase =
  | 'intro'
  | 'starting'
  | 'settle'
  | 'run'
  | 'result'
  | 'blocked'

export type GlideRoomBlock = 'denied' | 'unavailable'

/** The phases the demo puts the room in: its start, and an arch. */
export type GlideRoomDemoPhase = 'intro' | 'run'

export interface GlideRoomState {
  readonly phase: GlideRoomPhase
  /** Each start is numbered, so a late answer from an old one is ignored. */
  readonly run: number
  readonly block: GlideRoomBlock | null
}

export type GlideRoomEvent =
  | { readonly type: 'start' }
  | {
      readonly type: 'mic-ready'
      readonly run: number
      readonly rooted: boolean
    }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: GlideRoomBlock
    }
  | { readonly type: 'settled' }
  | { readonly type: 'finished' }
  | { readonly type: 'stop' }
  | { readonly type: 'rest' }
  | { readonly type: 'leave' }
  | { readonly type: 'demo'; readonly phase: GlideRoomDemoPhase }

const RUN_PHASES: ReadonlySet<GlideRoomPhase> = new Set<GlideRoomPhase>([
  'starting',
  'settle',
  'run',
])

/** A run is under way: the microphone is asked for or open. */
export function isRunPhase(phase: GlideRoomPhase): boolean {
  return RUN_PHASES.has(phase)
}

/**
 * The mic's state (mic-state.ts) in a phase. A run is the singer's turn
 * only while an arch is being sung (`singing`: its up, top and down, from
 * the run's clock against the glide path); it waits, open, through the
 * count-in, each landing and breath, and the mic's opening. The settle,
 * an easy note before the arches, is the singer's too. The demo's arches
 * never open the mic: they wait.
 */
export function glideMicState(
  phase: GlideRoomPhase,
  singing: boolean,
  demo: boolean,
): MicState {
  if (phase === 'result') return 'done'
  if (demo) return 'wait'
  switch (phase) {
    case 'settle':
      return 'sing'
    case 'run':
      return singing ? 'sing' : 'wait'
    case 'starting':
      return 'wait'
    case 'intro':
    case 'blocked':
      return 'ready'
  }
}

export function initialGlideRoomState(): GlideRoomState {
  return { phase: 'intro', run: 0, block: null }
}

function onStart(state: GlideRoomState): GlideRoomState {
  const from = state.phase
  if (from !== 'intro' && from !== 'result' && from !== 'blocked') return state
  return { phase: 'starting', run: state.run + 1, block: null }
}

function onMicReady(
  state: GlideRoomState,
  event: Extract<GlideRoomEvent, { type: 'mic-ready' }>,
): GlideRoomState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return { ...state, phase: event.rooted ? 'run' : 'settle' }
}

function onMicFailed(
  state: GlideRoomState,
  event: Extract<GlideRoomEvent, { type: 'mic-failed' }>,
): GlideRoomState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return { ...state, phase: 'blocked', block: event.block }
}

const move =
  (from: GlideRoomPhase, to: GlideRoomPhase) =>
  (state: GlideRoomState): GlideRoomState =>
    state.phase === from ? { ...state, phase: to } : state

/** A run dropped: back to the intro, nothing kept. */
function onDrop(state: GlideRoomState): GlideRoomState {
  return isRunPhase(state.phase) ? { ...state, phase: 'intro' } : state
}

/** The demo's own move, never over a mic being opened or a block. */
function onDemo(
  state: GlideRoomState,
  event: Extract<GlideRoomEvent, { type: 'demo' }>,
): GlideRoomState {
  if (state.phase === 'starting' || state.phase === 'blocked') return state
  return { ...state, phase: event.phase, run: state.run + 1 }
}

type Handlers = {
  readonly [K in GlideRoomEvent['type']]: (
    state: GlideRoomState,
    event: Extract<GlideRoomEvent, { type: K }>,
  ) => GlideRoomState
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

export function glideRoomReducer(
  state: GlideRoomState,
  event: GlideRoomEvent,
): GlideRoomState {
  const handler = HANDLERS[event.type] as (
    state: GlideRoomState,
    event: GlideRoomEvent,
  ) => GlideRoomState
  return handler(state, event)
}
