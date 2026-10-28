// ============================================================
// Hear it again — when a run may sound its question twice.
//
// One rule for every engine, written once so the engines and the room
// that draws the button cannot disagree. Before an answer, a replay is
// help, so only a practice staircase gets one, once a question, and the
// plate says how many were taken. A rated run and a sealed calibration
// get none: their numbers are only honest heard once. After the answer
// the question is spent and listening again is how the verdict lands,
// so it is never limited. Nothing replays over a sound already playing.
//
// Only the native room (EAR_LAB_WITH_MERC) offers the button; the web's
// stages never call it.
// ============================================================

/** The honesty rules a run is under. A Today's short run is practice
 *  with fewer turns, and replays like one. */
export type ReplayRun = 'practice' | 'rated' | 'sealed'

/** Where the question is: sounding, waiting on an answer, or answered. */
export type ReplayBeat = 'listen' | 'answer' | 'reveal' | 'other'

export interface ReplayState {
  run: ReplayRun
  beat: ReplayBeat
  /** A test sound is playing, the question's or a replay's. */
  sounding: boolean
  /** Replays already taken on this question before its answer. */
  usedThisQuestion: number
}

/** Replays a practice question allows before its answer. */
export const PRACTICE_REPLAYS_PER_QUESTION = 1

export function canReplay(state: ReplayState): boolean {
  if (state.sounding) return false
  if (state.beat === 'reveal') return true
  if (state.beat !== 'answer') return false
  return (
    state.run === 'practice' &&
    state.usedThisQuestion < PRACTICE_REPLAYS_PER_QUESTION
  )
}
