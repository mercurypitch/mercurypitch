// Three rooms, as data.
// ============================================================
//
// `sim/chamber3d` knows what a standing wave does. This knows which
// rooms are worth walking into, and it is checked-in data rather than
// code because a level that needs a function is a level nobody else can
// edit (docs/games/standing-wave-chamber.md §4).
//
// Each room is built backwards from ONE sentence it teaches, and each
// one is only allowed to teach the next thing:
//
//   1  the room has a pitch, and glass sits where the air moves hardest
//   2  changing the note moves the danger
//   3  the answer is a sequence, not a position
//
// The numbers are not taste. A pane at `at` breaks when the amplitude
// there passes `breakAt`, and the amplitude is `|sin(n*pi*at)|` -- so
// "mode 3 breaks this one and mode 4 cannot" is arithmetic, and the
// tests beside this file are what stop a plausible-looking edit from
// shipping a room that cannot be finished.
//
// THE FLOOR SHAKES; A PLATFORM DOES NOT. Standing on a ledge is safe
// whatever is being sung, which is the whole reason a chamber can have
// vertical space at all -- otherwise every mode change would be a fall.

import type { Chamber } from '../sim/chamber3d'

export interface ChamberLevel extends Chamber {
  /** How hard the air has to move at a pane to shake it apart. Well
   * short of 1, so a pane does not demand a belly to the centimetre --
   * and well clear of the amplitude the OTHER mode makes there, which
   * is what keeps "which note breaks this" a real question. */
  readonly breakAt: number
  /** How hard the floor may move under him before it drops him. 1 or
   * more means this room never does: amplitude never exceeds 1, so the
   * check simply passes everywhere. That is how a teaching room turns
   * failure off without a flag to forget. */
  readonly floorThreshold: number
  /** Where he comes in, 0..1 along the room. Kept off a belly of every
   * mode, or the room kills him for arriving. */
  readonly startAt: number
  /** Reaching this finishes the chamber. */
  readonly exitAt: number
}

/**
 * One mode, one pane, and nothing that can go wrong.
 *
 * Mode 3 puts a belly dead centre, which is where the pane is and where
 * the eye goes anyway. The floor is inert (`floorThreshold: 1`) because
 * a first room should be allowed to be wrong at without being fatal.
 */
export const CHAMBER_1: ChamberLevel = {
  id: 'chamber-1',
  modes: [3],
  length: 6,
  panes: [{ at: 0.5, height: 1.05 }],
  platforms: [],
  teaches: 'The room has a note. Sing it, and the glass gives.',
  breakAt: 0.8,
  floorThreshold: 1,
  startAt: 0.03,
  exitAt: 0.96,
}

/**
 * Two modes, two panes, and each one deaf to the other's note.
 *
 * The centre is the hinge: 0.5 is a BELLY of mode 3 and a NODE of mode
 * 4, so the first pane is the one place in the room where the two modes
 * disagree completely. The second pane sits at 0.625 -- a belly of mode
 * 4, where mode 3 only manages 0.38 -- so the room cannot be finished on
 * one note however long it is held.
 *
 * The floor is live from here on, and the sequence it forces is the
 * lesson: stand at 1/3 (a node of 3) to break the centre pane, then at
 * 0.5 (a node of 4, and now walkable) to break the second.
 */
export const CHAMBER_2: ChamberLevel = {
  id: 'chamber-2',
  modes: [3, 4],
  length: 7,
  panes: [
    { at: 0.5, height: 1.05 },
    { at: 0.625, height: 1.05 },
  ],
  platforms: [],
  teaches: 'Change the note and the danger moves with it.',
  breakAt: 0.8,
  floorThreshold: 0.55,
  startAt: 0.03,
  exitAt: 0.96,
}

/**
 * Two modes, two panes, and a ledge over the worst of the floor.
 *
 * Modes 4 and 5 are 3.9 semitones apart -- a smaller ask than the room
 * before it, and a harder read, because the node pattern changes much
 * more between neighbours up the ladder. That inversion is the point:
 * the singing gets easier as the puzzle gets harder.
 *
 * The sequence has a silence in it. Breaking the first pane needs mode 4
 * from the node at 0.25; reaching the node at 0.6 to break the second
 * means crossing 0.375, which is a belly of the very mode that got him
 * there. He has to stop singing to walk -- and the platform is where he
 * can hold a note while he thinks.
 */
export const CHAMBER_3: ChamberLevel = {
  id: 'chamber-3',
  modes: [4, 5],
  length: 8,
  panes: [
    { at: 0.375, height: 1.05 },
    { at: 0.7, height: 1.05 },
  ],
  platforms: [{ at: 0.5, width: 1.1, height: 0.62 }],
  teaches: 'The answer is an order, not a place.',
  breakAt: 0.8,
  floorThreshold: 0.5,
  startAt: 0.02,
  exitAt: 0.97,
}

/** In the order they are meant to be played. */
export const CHAMBERS: readonly ChamberLevel[] = [
  CHAMBER_1,
  CHAMBER_2,
  CHAMBER_3,
]

export const chamberById = (id: string): ChamberLevel | null =>
  CHAMBERS.find((c) => c.id === id) ?? null
