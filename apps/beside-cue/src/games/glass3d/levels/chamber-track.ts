// The path through the rooms.
// ============================================================
//
// The chambers teach in a fixed order -- the room has a note, the note
// moves the danger, the answer is a sequence -- and three cards in a
// list invite playing them out of that order, which breaks the only
// teaching structure the slice has. So they are a TRACK: entered once,
// walked in order, and it remembers where you got to.
//
// ONE RULE, AND IT COMES FROM SOMEWHERE ELSE. `games/glass/score.ts`
// already says it: passing is a band, not a finish line, and nothing is
// gated by any of it. With "no streaks, ever" beside it, the design is
// settled and this module must not quietly reopen it:
//
//   * A room opens when the one before it is FINISHED, not when it is
//     finished well. Getting through is the condition; the grade is a
//     record kept beside it.
//   * A cleared room stays open. Going back to sing room one better is
//     a thing a player may do without starting again.
//   * Stopping costs nothing. The track is where you left it.
//
// The rules live in `track.ts`, once, because the Sorting Line walks a
// track of its own and two copies of a rule that must never drift is
// how it drifts. This file is the chambers' instance of it, and keeps
// every name it had so nothing that walks a chamber has to change.

import { CHAMBERS } from './chambers'
import { createTrack } from './track'

export type { TrackState } from './track'
export { EMPTY_TRACK } from './track'

const KEY = 'beside-cue:games:chamber-track'

const track = createTrack(CHAMBERS, KEY)

export const roomIndex = track.roomIndex
export const isCleared = track.isCleared
export const reachedIndex = track.reachedIndex
export const isOpen = track.isOpen
export const isFinished = track.isFinished
export const currentRoom = track.currentRoom
export const roomAfter = track.roomAfter
export const recordClear = track.recordClear
export const progressLabel = track.progressLabel
export const walkGrade = track.walkGrade
export const readTrack = track.readTrack
export const writeTrack = track.writeTrack
export const restartTrack = track.restartTrack
