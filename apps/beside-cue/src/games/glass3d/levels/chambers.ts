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
//   4  the way out is not always on the floor
//   5  three notes, and the order is not the order they stand in
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
  // 0.42, not 0.62. The jump reaches 0.5 (`CHAMBER_CONFIG.locomotion`),
  // so the ledge as first written could not be jumped onto at all --
  // and the only reason it was ever stood on is that walking into its
  // shadow used to lift him onto it. Both halves of that are fixed:
  // `groundIn` no longer hands him a surface above his feet, and this
  // is now a height a jump can actually clear.
  platforms: [{ at: 0.5, width: 1.1, height: 0.42 }],
  teaches: 'The answer is an order, not a place.',
  breakAt: 0.8,
  floorThreshold: 0.5,
  startAt: 0.02,
  exitAt: 0.97,
}

/**
 * The room you have to leave upwards.
 *
 * Modes 5 and 6 are 3.16 semitones apart, a shade tighter than the room
 * before it, and the hinge is chamber 2's one rung higher: 0.5 is a
 * BELLY of 5 and a NODE of 6, so the second pane is deaf to the note
 * that opened the first. The first sits on 5/12, a belly of 6 where 5
 * musters 0.26.
 *
 * What is new is the way out. The exit stands on a ledge, and reaching
 * it means jumping: every other room could be finished by walking, and
 * the jump has been in the controls since slice 2 with nothing to do.
 * Nothing about the glass changes -- the panes still gate the ledge,
 * and the ledge only gates the last step.
 */
export const CHAMBER_4: ChamberLevel = {
  id: 'chamber-4',
  modes: [5, 6],
  length: 9,
  panes: [
    { at: 5 / 12, height: 1.05 },
    { at: 0.5, height: 1.05 },
  ],
  // Wide enough to land on without aiming, and it runs PAST the far wall
  // on purpose. At 0.92/1.3 its right lip fell at x 8.93 inside a room
  // that ends at 9, leaving a 7 cm pocket of bare floor beyond it that
  // is inside the exit's x window and can never satisfy it -- walk off
  // the end of the ledge and the way out is unreachable until you walk
  // back and jump again. A ledge that reaches the wall has no pocket.
  platforms: [{ at: 0.95, width: 1.4, height: 0.42 }],
  teaches: 'The way out is up.',
  breakAt: 0.8,
  floorThreshold: 0.6,
  // 0.015, not the 0.03 the other rooms use. Mode 6 is what opens this
  // room's first pane, so singing it where he lands is the first thing
  // the room asks for -- and at 0.03 the safe band ahead of him is 3.7
  // CENTIMETRES, a thirtieth of a second's walk. Worse, the floor strip
  // he is standing on samples its own centre, which at 0.0347 is over
  // the threshold, so the room painted the ground red under a man who
  // was safe. At 0.015 the headroom is 0.17 m and the strip reads safe.
  startAt: 0.015,
  exitAt: 0.95,
}

/**
 * Three notes, and the room does not say which order.
 *
 * The panes run 0.3, 0.625, 0.75 and want modes 5, 4, 6 -- not up the
 * ladder, not down it. Every room so far could be solved by trying the
 * modes in turn; this one has to be READ, because the answer is a
 * different rung each time and the pattern on the floor is the only
 * thing that says which.
 *
 * The ledge is the safety net for the mistake this room invites. The
 * perch for the second pane is the centre, which is a NODE of mode 4
 * and the BELLY of mode 5 -- so walking there still holding the note
 * that opened the first pane drops him. The ledge sits over exactly
 * that spot: somewhere to stand whatever is coming out of his mouth.
 */
export const CHAMBER_5: ChamberLevel = {
  id: 'chamber-5',
  modes: [4, 5, 6],
  length: 10,
  panes: [
    { at: 0.3, height: 1.05 },
    { at: 0.625, height: 1.05 },
    { at: 0.75, height: 1.05 },
  ],
  platforms: [{ at: 0.5, width: 1.2, height: 0.42 }],
  teaches: 'Three notes, and the room does not say which order.',
  breakAt: 0.8,
  floorThreshold: 0.55,
  startAt: 0.02,
  exitAt: 0.96,
}

/** In the order they are meant to be played. */
export const CHAMBERS: readonly ChamberLevel[] = [
  CHAMBER_1,
  CHAMBER_2,
  CHAMBER_3,
  CHAMBER_4,
  CHAMBER_5,
]
