// One scalar, and the body it makes.
// ============================================================
//
// The Sorting Line's whole rule, and the reason it is a different game
// from the Standing Wave Chamber rather than a reskin of it: in a
// chamber the voice changes the ROOM and Merc is a cursor walking
// through the consequences. Here the room is inert -- every plate, gap
// and slot would sit there unchanged if the microphone never opened --
// and the voice changes MERC (docs/games/sorting-line.md §2).
//
// Where you sit in your own range is his silhouette. Low is a wide flat
// puddle, high is a narrow tall thread, and the volume of mercury is
// conserved between them, so clearance and support move in OPPOSITE
// directions. Flat gets under low things and spans wide gaps; tall fits
// narrow slots and falls through a grate. That is the mechanic: the
// shape that carries you across is the shape that cannot get you
// through.
//
// This module is the pure half and holds no three.js. `render/merc.ts`
// turns a silhouette into scale factors; nothing here knows that.

/** A body, in metres. Both numbers are the WHOLE actor's, measured the
 * way `Box3.setFromObject` measures him -- see the note on `VOLUME`. */
export interface Silhouette {
  /** Top of his head to the lowest thing hanging off him. */
  readonly height: number
  /** Across the torso shell, hands excluded. See `VOLUME`. */
  readonly width: number
}

/** A vocal range to read a pitch against, in MIDI. */
export interface Range {
  readonly lowMidi: number
  readonly highMidi: number
}

/** The two ends of the sweep, in metres of height. */
export interface Sweep {
  /** At the bottom of the range. */
  readonly flat: number
  /** At the top. */
  readonly tall: number
}

/**
 * Where the flat end stops reading as a character, in metres of height.
 * A MEASUREMENT: step 4a, on the real asset, at 375x812, and then on
 * maff's phone with his own voice (docs/games/sorting-line.md §14).
 *
 *   0.94 tall   a teardrop. Reads beautifully.
 *   0.55        the shipped Merc.
 *   0.42        a squat wide Merc, face clear. Charming.
 *   0.35        still clearly a face. The comfortable floor.
 *   0.28        eyes sliding onto the lower rim. Borderline.
 *   0.16        a puddle with no face -- "squished too much".
 *
 * At the bottom the eyes and mouth flatten onto the silhouette's lower
 * rim and a camera that looks slightly down stops seeing them; he reads
 * as a spill. It is not fixable by scale: `merc_face` is a SkinnedMesh
 * and three cancels a node transform through `bindMatrixInverse`, so
 * the face rides the skeleton. maff chose to dial the sweep rather than
 * fix the face in art, so the default flat end sits ON this line and a
 * test holds it there.
 */
export const FLAT_READS_ABOVE_HEIGHT = 0.32

/**
 * The shipped sweep. `flat` is the readable floor above; `tall` is the
 * end maff called good. Tunable per call -- the probe takes
 * `?flat=&tall=` -- so the numbers can be argued with on a phone rather
 * than in a review.
 */
export const SWEEP: Sweep = { flat: FLAT_READS_ABOVE_HEIGHT, tall: 0.94 }

/** Kept as names for the two ends, for anything that reads better
 * saying "flat" than `SWEEP.flat`. */
export const FLAT_HEIGHT = SWEEP.flat
export const TALL_HEIGHT = SWEEP.tall

/**
 * Rest: silence, and the Merc who already ships.
 *
 * `createMerc`'s default height, written as a literal because it is an
 * independent fact about a different module. It lies ON the sweep --
 * see `restTFor` -- but not at its middle any more: raising the flat
 * end moved the midpoint up, and the shipped body is worth more than a
 * round number. Rest is still a POSITION in this world, not a null
 * state; it is just not 0.5.
 */
export const REST_HEIGHT = 0.55

/**
 * How wide the shipped Merc's torso is when he stands 0.55 tall.
 *
 * MEASURED, on 2026-09-04, from `public/games/glass3d/merc.glb` through
 * the same `Box3.setFromObject` that `createMerc` scales him with:
 *
 *   whole actor   1.8274 x 1.9028 x 1.2639  ->  0.5282 wide at h=0.55
 *   `merc_body`   1.2437 x 1.6509 x 1.2375  ->  0.3595 wide at h=0.55
 *
 * WIDTH HERE MEANS THE TORSO, NOT THE WHOLE ACTOR, and the difference is
 * 8.4 cm per side of dangling mitt. The torso is the honest number to
 * build a slot around: the hands are separate shells on their own bones,
 * so gating level geometry on them would gate it on a limb pose that any
 * clip can move. §4b's `fitsSlot` inherits this convention and should
 * say so where a player can see the consequence.
 *
 * The value kept here is the DOC's 0.36 rather than the measured
 * 0.3595, and the 0.15% between them is deliberate. §2's table is the
 * shared artifact this world is designed against, and it has to
 * reproduce from these constants exactly; `render/merc.ts` is handed
 * ratios against rest rather than metres, so nothing downstream pays
 * for the rounding -- rest still poses him at the shipped scale
 * uniformly, to the last bit.
 */
export const REST_WIDTH = 0.36

/**
 * `w^2 * h`, held constant across the whole sweep.
 *
 * Mercury does not gain or lose mass when you sing at it. Height is
 * linear in `t` and width falls out of the conservation, which is what
 * makes the two ends physical opposites rather than two settings of one
 * dial -- and what makes the trade in §2 real instead of decorative.
 */
export const VOLUME = REST_WIDTH * REST_WIDTH * REST_HEIGHT

export const clamp01 = (n: number): number =>
  n < 0 ? 0 : n > 1 ? 1 : Number.isFinite(n) ? n : 0

/** The body at a given position in the range. */
export const silhouetteFor = (t: number, sweep: Sweep = SWEEP): Silhouette => {
  const height = sweep.flat + (sweep.tall - sweep.flat) * clamp01(t)
  return { height, width: Math.sqrt(VOLUME / height) }
}

/** Where on a sweep the shipped Merc sits. 0.37 for the default. */
export const restTFor = (sweep: Sweep = SWEEP): number =>
  clamp01((REST_HEIGHT - sweep.flat) / (sweep.tall - sweep.flat))

/**
 * How far in from each end the playable range sits, in semitones.
 *
 * The extremes of a measured range are the notes a singer JUST reached
 * once, under instruction, in a quiet room. Asking for them again to
 * hold a shape would make the two ends of this world the two places it
 * is least playable. Trimming inward means the shape bottoms out a
 * semitone before the voice does.
 */
export const RANGE_TRIM_SEMIS = 1

/**
 * Below this the trim is skipped rather than applied.
 *
 * A range narrow enough that trimming two semitones off it leaves
 * almost nothing would turn the whole world into a hair trigger, and a
 * narrower one still would invert the ends. A voice this narrow is
 * usually a bad measurement, and the right answer to a bad measurement
 * is to use it untrimmed, not to refuse to play.
 */
export const MIN_WORKING_SEMIS = 4

/** The range a room actually reads against: the measurement, pulled in
 * at both ends when there is room to pull. */
export const workingRange = (range: Range): Range => {
  const span = range.highMidi - range.lowMidi
  if (span - 2 * RANGE_TRIM_SEMIS < MIN_WORKING_SEMIS) return range
  return {
    lowMidi: range.lowMidi + RANGE_TRIM_SEMIS,
    highMidi: range.highMidi - RANGE_TRIM_SEMIS,
  }
}

/**
 * Where a sung note sits in a voice's own span, 0 at the bottom.
 *
 * A range with no width has no answer, and the honest one is rest: an
 * unusable measurement should leave Merc the shape he already is, not
 * throw inside a game and not pin him flat.
 */
export const tFor = (midi: number, range: Range): number => {
  const span = range.highMidi - range.lowMidi
  if (!(span > 0) || !Number.isFinite(midi)) return 0.5
  return clamp01((midi - range.lowMidi) / span)
}
