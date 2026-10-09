// ============================================================
// Long note's room states — a pure reducer
// ============================================================
//
// intro → starting → listen → hold → result, and Again round through
// starting with the same note (design §2): the microphone is closed at the
// result, so every take opens it again. `starting` covers the microphone
// prompt, which can take as long as the singer likes; `run` is bumped by
// every start, so an answer that arrives for a start the singer already
// abandoned is dropped instead of opening a room they left. A refused or
// missing microphone is `blocked`, with the reason, until the singer tries
// again.
//
// `targetMidi` is null when there is no note yet: no voiceprint and nothing
// held before. The singer then sings any easy note, and the first one they
// settle on (`settle`) becomes the note to hold.

export type LongNotePhase =
  | 'intro'
  | 'starting'
  | 'listen'
  | 'hold'
  | 'result'
  | 'blocked'

export type LongNoteBlock = 'denied' | 'unavailable'

export interface LongNoteState {
  readonly phase: LongNotePhase
  readonly targetMidi: number | null
  readonly run: number
  readonly block: LongNoteBlock | null
}

export type LongNoteEvent =
  | { readonly type: 'target'; readonly midi: number }
  | { readonly type: 'start' }
  | { readonly type: 'mic-ready'; readonly run: number }
  | {
      readonly type: 'mic-failed'
      readonly run: number
      readonly block: LongNoteBlock
    }
  | { readonly type: 'settle'; readonly midi: number }
  | { readonly type: 'voice' }
  | { readonly type: 'false-start' }
  | { readonly type: 'end' }
  | { readonly type: 'cancel' }
  | { readonly type: 'again' }
  | { readonly type: 'change-note' }

export function initialLongNoteState(targetMidi: number | null): LongNoteState {
  return { phase: 'intro', targetMidi, run: 0, block: null }
}

type Handler<T extends LongNoteEvent['type']> = (
  state: LongNoteState,
  event: Extract<LongNoteEvent, { type: T }>,
) => LongNoteState

/** One rule per event. An event that does not fit the phase changes nothing. */
const HANDLERS: { [T in LongNoteEvent['type']]: Handler<T> } = {
  // The note is chosen before the first breath, never mid-run.
  target: (state, event) =>
    state.phase === 'intro' ? { ...state, targetMidi: event.midi } : state,
  start: (state) =>
    state.phase === 'intro' || state.phase === 'blocked'
      ? { ...state, phase: 'starting', run: state.run + 1, block: null }
      : state,
  'mic-ready': (state, event) =>
    state.phase === 'starting' && event.run === state.run
      ? { ...state, phase: 'listen' }
      : state,
  'mic-failed': (state, event) =>
    state.phase === 'starting' && event.run === state.run
      ? { ...state, phase: 'blocked', block: event.block }
      : state,
  // Only a take still looking for its note takes the singer's own.
  settle: (state, event) =>
    state.phase === 'listen' && state.targetMidi === null
      ? { ...state, targetMidi: event.midi }
      : state,
  voice: (state) =>
    state.phase === 'listen' && state.targetMidi !== null
      ? { ...state, phase: 'hold' }
      : state,
  // A cough or a stray frame started the hold and never found the note: not
  // a run, so the room listens again without a result.
  'false-start': (state) =>
    state.phase === 'hold' ? { ...state, phase: 'listen' } : state,
  end: (state) =>
    state.phase === 'hold' ? { ...state, phase: 'result' } : state,
  // The singer stopped listening before a note: back to the intro.
  cancel: (state) =>
    state.phase === 'listen' ? { ...state, phase: 'intro' } : state,
  again: (state) =>
    state.phase === 'result'
      ? { ...state, phase: 'starting', run: state.run + 1 }
      : state,
  'change-note': (state) =>
    state.phase === 'result' ? { ...state, phase: 'intro' } : state,
}

export function longNoteReducer(
  state: LongNoteState,
  event: LongNoteEvent,
): LongNoteState {
  // The table pairs each handler with its own event type; TypeScript cannot
  // follow that pairing through an index, hence the widening.
  const handle = HANDLERS[event.type] as (
    state: LongNoteState,
    event: LongNoteEvent,
  ) => LongNoteState
  return handle(state, event)
}
