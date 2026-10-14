// ============================================================
// Echo's room states: a pure reducer
// ============================================================
//
// intro → starting → call → response → between → call ... → result. A run
// is a fixed number of phrases; each one Merc sings (`call`), the singer
// sings back (`response`), and the constellation it made settles
// (`between`) before the next. The last phrase's `next` is the result.
// Again starts a new run from the result: the microphone closes there, so
// every run opens it again.
//
// With no root to start on (no voiceprint and none settled before), the
// microphone opens on `settle`: the singer sings any easy note, and the
// first one they settle on starts the phrases (`settled`).
//
// `starting` covers the microphone prompt, which can take as long as the
// singer likes; `run` is bumped by every start, so an answer that arrives
// for a start the singer already left is dropped. A refused or missing
// microphone is `blocked`, with the reason, until the singer tries again.
//
// "Hear it again" (`replay`) goes back from the response to the call of
// the same phrase. The mic button mid-run (`stop`), leaving the app
// (`leave`) and a minute with no voice (`rest`) each drop the run: back to
// the intro with nothing kept.
//
// `demo` moves the room for the "how it works" demo (demo/), which sings
// its one phrase through the room with no microphone: to the intro as it
// starts and ends, to the call as each take starts, and to the result
// after take 2. The phrase's own steps (`heard`, `phrase-end`) move it as
// they move a run.

export type EchoPhase =
  | 'intro'
  | 'starting'
  | 'settle'
  | 'call'
  | 'response'
  | 'between'
  | 'result'
  | 'blocked'

export type EchoBlock = 'denied' | 'unavailable'

/** The phases the demo puts the room in itself. */
export type EchoDemoPhase = 'intro' | 'call' | 'between' | 'result'

export interface EchoState {
  readonly phase: EchoPhase
  /** The phrase being sung, from 0; -1 before the first. */
  readonly phrase: number
  /** Phrases in a run. */
  readonly phrases: number
  readonly run: number
  readonly block: EchoBlock | null
}

export type EchoEvent =
  | { readonly type: 'start' }
  | {
      readonly type: 'mic-ready'
      readonly run: number
      readonly rooted: boolean
    }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: EchoBlock
    }
  | { readonly type: 'settled' }
  | { readonly type: 'heard' }
  | { readonly type: 'replay' }
  | { readonly type: 'phrase-end' }
  | { readonly type: 'next' }
  | { readonly type: 'stop' }
  | { readonly type: 'rest' }
  | { readonly type: 'leave' }
  | { readonly type: 'demo'; readonly phase: EchoDemoPhase }

/** The phases of a run under way: the microphone is open in all but the first. */
const RUN_PHASES: ReadonlySet<EchoPhase> = new Set<EchoPhase>([
  'starting',
  'settle',
  'call',
  'response',
  'between',
])

/** A run is under way: the microphone is asked for or open. */
export function isRunPhase(phase: EchoPhase): boolean {
  return RUN_PHASES.has(phase)
}

export function initialEchoState(phrases: number): EchoState {
  return { phase: 'intro', phrase: -1, phrases, run: 0, block: null }
}

/** A start: from the intro, a result or a blocked mic; each one numbered. */
function onStart(state: EchoState): EchoState {
  const from = state.phase
  if (from !== 'intro' && from !== 'result' && from !== 'blocked') return state
  return {
    ...state,
    phase: 'starting',
    phrase: -1,
    run: state.run + 1,
    block: null,
  }
}

/** The mic opened for this start: the first call, or the settle first. */
function onMicReady(
  state: EchoState,
  event: Extract<EchoEvent, { type: 'mic-ready' }>,
): EchoState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return event.rooted
    ? { ...state, phase: 'call', phrase: 0 }
    : { ...state, phase: 'settle' }
}

function onMicFailed(
  state: EchoState,
  event: Extract<EchoEvent, { type: 'mic-failed' }>,
): EchoState {
  if (state.phase !== 'starting' || event.run !== state.run) return state
  return { ...state, phase: 'blocked', block: event.block }
}

/** The singer's note settled: it roots the run, and the first call starts. */
function onSettled(state: EchoState): EchoState {
  return state.phase === 'settle'
    ? { ...state, phase: 'call', phrase: 0 }
    : state
}

/** From one phase to another, and nothing from any other phase. */
const move =
  (from: EchoPhase, to: EchoPhase) =>
  (state: EchoState): EchoState =>
    state.phase === from ? { ...state, phase: to } : state

/** After a phrase: the next one's call, or the result after the last. */
function onNext(state: EchoState): EchoState {
  if (state.phase !== 'between') return state
  return state.phrase + 1 < state.phrases
    ? { ...state, phase: 'call', phrase: state.phrase + 1 }
    : { ...state, phase: 'result' }
}

/** A run dropped: back to the intro, nothing kept. */
function onDrop(state: EchoState): EchoState {
  return isRunPhase(state.phase)
    ? { ...state, phase: 'intro', phrase: -1 }
    : state
}

/** The demo's own move: its one phrase is the run's first. */
function onDemo(
  state: EchoState,
  event: Extract<EchoEvent, { type: 'demo' }>,
): EchoState {
  return {
    ...state,
    phase: event.phase,
    phrase: event.phase === 'intro' ? -1 : 0,
    block: null,
  }
}

type Handlers = {
  readonly [K in EchoEvent['type']]: (
    state: EchoState,
    event: Extract<EchoEvent, { type: K }>,
  ) => EchoState
}

const HANDLERS: Handlers = {
  start: onStart,
  'mic-ready': onMicReady,
  'mic-failed': onMicFailed,
  settled: onSettled,
  heard: move('call', 'response'),
  replay: move('response', 'call'),
  'phrase-end': move('response', 'between'),
  next: onNext,
  stop: onDrop,
  rest: onDrop,
  leave: onDrop,
  demo: onDemo,
}

export function echoReducer(state: EchoState, event: EchoEvent): EchoState {
  const handle = HANDLERS[event.type] as (
    state: EchoState,
    event: EchoEvent,
  ) => EchoState
  return handle(state, event)
}
