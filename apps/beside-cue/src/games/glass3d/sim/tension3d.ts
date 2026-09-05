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

/**
 * How much of his height is torso.
 *
 * `Silhouette.height` is the whole actor, mitts included: the box
 * `createMerc` scales him by. But the mitts hang below the body in the
 * bind pose and beside it in every clip, and a slot has to admit the
 * BODY. MEASURED 2026-09-04: `merc_body` is 1.6509 tall against a whole
 * box of 1.9028, so the torso is 0.8676 of the height everywhere on the
 * sweep -- 0.477 m at rest. maff's phone found the mismatch the other
 * way round: a slot sized to the whole box sat visibly above his head
 * while the sim said he did not fit.
 */
export const TORSO_OF_HEIGHT = 1.6509 / 1.9028

/** The body's own height, without the mitts. */
export const torsoHeight = (s: Silhouette): number => s.height * TORSO_OF_HEIGHT

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

/** The sweep run backwards: the `t` at which he is this tall. Clamped
 * to the sweep, so a height he cannot reach is its nearest end. */
export const tForHeight = (height: number, sweep: Sweep = SWEEP): number =>
  clamp01((height - sweep.flat) / (sweep.tall - sweep.flat))

/** The `t` at which his TORSO is this tall. What a ceiling asks for. */
export const tForTorso = (torso: number, sweep: Sweep = SWEEP): number =>
  tForHeight(torso / TORSO_OF_HEIGHT, sweep)

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

// ------------------------------------------------------------
// The spring: the shape follows the voice, and is the smoother.
// ------------------------------------------------------------

/** Critically damped, ω = 9 rad/s: settles in about half a second with
 * no overshoot. Move slowly and he morphs; a jittery f0 reads as a
 * gentle wobble rather than as Merc convulsing (§2). */
export const SPRING_OMEGA = 9

export interface Spring {
  /** Where the shape is now. */
  readonly t: number
  /** How fast it is moving, in t per second. */
  readonly v: number
}

export const springAt = (t: number): Spring => ({ t, v: 0 })

/** One step toward `target`. Semi-implicit Euler is stable for any dt a
 * frame can hand it, and exact enough at 1/120 that nobody can tell. */
export const springStep = (
  s: Spring,
  target: number,
  dt: number,
  omega: number = SPRING_OMEGA,
): Spring => {
  if (!(dt > 0)) return s
  const a = -2 * omega * s.v - omega * omega * (s.t - target)
  const v = s.v + a * dt
  const t = s.t + v * dt
  return { t: clamp01(t), v }
}

// ------------------------------------------------------------
// The relax: silence holds the shape, and lets go slowly.
// ------------------------------------------------------------

/** Toward rest, from silence: six seconds to go most of the way. This is
 * what makes the world playable one-handed -- sing in short bursts and
 * walk in silence, instead of sustaining a note while a thumb is busy. */
export const RELAX_SECONDS = 6
/** During an f0 gap or a low-confidence frame the relax runs at HALF
 * rate (§6, from The Blackout): a dropout is not a decision, and a
 * shape that snapped to rest on every lost frame would punish the mic. */
export const GAP_RELAX_SECONDS = 12
/** Below this the detector is guessing, and a guess holds rather than
 * moves him. */
export const MIN_CONFIDENCE = 0.5

/** Exponential approach, exact for any dt. */
export const relaxToward = (
  t: number,
  target: number,
  dt: number,
  tau: number,
): number => (dt > 0 ? t + (target - t) * (1 - Math.exp(-dt / tau)) : t)

/** What one detector frame says. `midi` null is silence. */
export interface VoiceFrame {
  readonly midi: number | null
  readonly confidence: number
}

/**
 * One frame of the whole rule: a voiced, confident frame pulls the
 * spring toward where that pitch sits in the range; silence relaxes
 * toward rest at full rate; a doubtful frame relaxes at half rate.
 *
 * Returns the next spring state. The spring's velocity is zeroed by a
 * relax step on purpose: the relax is a drift, not a push, and carrying
 * a stale velocity into the next voiced frame would make a resumed note
 * jump.
 */
export const tensionStep = (
  s: Spring,
  frame: VoiceFrame,
  range: Range,
  dt: number,
  sweep: Sweep = SWEEP,
): Spring => {
  if (frame.midi !== null && frame.confidence >= MIN_CONFIDENCE) {
    return springStep(s, tFor(frame.midi, range), dt)
  }
  const tau = frame.midi === null ? RELAX_SECONDS : GAP_RELAX_SECONDS
  return { t: relaxToward(s.t, restTFor(sweep), dt, tau), v: 0 }
}

// ------------------------------------------------------------
// Gates: the band is the furniture, and it is derived per player.
// ------------------------------------------------------------

/** Which end of the range a gate wants. */
export type GateEnd = 'flat' | 'tall'

/**
 * What a gate asks for, in two units, and the more generous wins (§2.1).
 *
 * `tLimit` is the band's EDGE as a fraction of the working range: a flat
 * gate admits `t <= tLimit`, a tall one `t >= tLimit`. `semis` is the
 * least width the band may have, in semitones, so a narrow voice is not
 * handed a band a wide one would find trivial: when `semis / span` is
 * wider than `tLimit` allows, the semitones win.
 */
export interface Gate {
  readonly end: GateEnd
  /** The band's edge, 0..1 along the working range. */
  readonly tLimit: number
  /** The band's least width, in semitones. */
  readonly semis: number
}

/** A band of `t` the gate admits. */
export interface Band {
  readonly lo: number
  readonly hi: number
}

/**
 * How far from rest a band must stay, in t.
 *
 * The plan wrote this as a per-gate `clamp` literal (0.42 for the
 * letterbox) against a rest of 0.5. Rest moved to 0.371 when the flat
 * end came up (§14.5), and a literal that quietly admitted the resting
 * drop would turn a gate into a doorway. So the margin is stated once,
 * against wherever rest is, and the letterbox keeps the 0.08 it had.
 */
export const REST_MARGIN = 0.08

/** The band a gate admits, for a voice of this span. */
export const bandFor = (
  gate: Gate,
  range: Range,
  sweep: Sweep = SWEEP,
): Band => {
  const span = Math.max(1e-6, range.highMidi - range.lowMidi)
  const least = gate.semis / span
  const rest = restTFor(sweep)
  if (gate.end === 'flat') {
    return {
      lo: 0,
      hi: Math.min(Math.max(gate.tLimit, least), rest - REST_MARGIN),
    }
  }
  return {
    lo: Math.max(Math.min(gate.tLimit, 1 - least), rest + REST_MARGIN),
    hi: 1,
  }
}

/** The centre of a band: where the ghost stands. */
export const bandCentre = (b: Band): number => (b.lo + b.hi) / 2

/** Whether a shape is inside a band. */
export const inBand = (t: number, b: Band): boolean => t >= b.lo && t <= b.hi

/**
 * The furniture a band becomes, in metres, drawn by the same function
 * that decides whether he fits -- so it cannot lie (§4).
 *
 * A flat gate is a horizontal slot: its height is the tallest TORSO the
 * band admits. A tall gate is a vertical slot: its width is the widest
 * body the band admits. A gap in the floor is the mirror of a slot: it
 * is as wide as the NARROWEST body that still spans it, so a body wider
 * than that is held and a narrower one pours through.
 */
export const slotHeightFor = (b: Band, sweep: Sweep = SWEEP): number =>
  torsoHeight(silhouetteFor(b.hi, sweep))
export const slotWidthFor = (b: Band, sweep: Sweep = SWEEP): number =>
  silhouetteFor(b.lo, sweep).width
export const gapWidthFor = (b: Band, sweep: Sweep = SWEEP): number =>
  silhouetteFor(b.hi, sweep).width

/** Does this body get through a horizontal slot this tall? The torso
 * is what has to fit; the mitts are not the part that bumps. */
export const fitsSlotHeight = (s: Silhouette, slotHeight: number): boolean =>
  torsoHeight(s) <= slotHeight + 1e-9
/** Does this body get through a vertical slot this wide? */
export const fitsSlotWidth = (s: Silhouette, slotWidth: number): boolean =>
  s.width <= slotWidth + 1e-9
/** Is this body wide enough for a gap this wide to hold it up? */
export const supportedBy = (s: Silhouette, gapWidth: number): boolean =>
  s.width >= gapWidth - 1e-9

/** Room 1's letterbox (§4). Kept here so the probe and the level agree. */
export const LETTERBOX: Gate = { end: 'flat', tLimit: 0.23, semis: 4 }

/**
 * Room 2's two asks, which oppose each other on purpose (§5): the mesh
 * holds a body wide enough to span its gaps, the slot admits one narrow
 * enough to fit, and there is exactly one solid place to swap between
 * them. The relax is the room's clock, and the motion tests hold both
 * crossings to one breath with slack.
 */
export const SCREEN_MESH: Gate = { end: 'flat', tLimit: 0.313, semis: 5 }
export const SCREEN_SLOT: Gate = { end: 'tall', tLimit: 0.634, semis: 5 }

/**
 * Room 3's wedge (§16.2): a slot whose ceiling falls along its length,
 * from what `WEDGE_IN` admits at its mouth to what `WEDGE_OUT` admits
 * at its far end. It asks for a glide coupled to walking, which no
 * band can ask for, and it is what §8's impossible gate became.
 */
export const WEDGE_IN: Gate = { end: 'flat', tLimit: 0.3, semis: 5 }
export const WEDGE_OUT: Gate = { end: 'flat', tLimit: 0.06, semis: 2 }

// ------------------------------------------------------------
// The range opens by taking it from the player (§6, from The Span).
// ------------------------------------------------------------

/**
 * A confident note outside the working range, and within an octave of
 * it, widens the range to include it. A baritone on a soprano preset
 * otherwise gets a world whose bottom half does not exist.
 *
 * Within an OCTAVE, and not further: an octave error from the detector
 * is one stable wrong answer, and letting it in would permanently
 * double the control surface (the Span's own judge supplied the
 * correction). Beyond that the note is ignored, not clamped.
 */
export const widenRange = (range: Range, midi: number): Range => {
  if (!Number.isFinite(midi)) return range
  if (midi < range.lowMidi && midi >= range.lowMidi - 12) {
    return { lowMidi: midi, highMidi: range.highMidi }
  }
  if (midi > range.highMidi && midi <= range.highMidi + 12) {
    return { lowMidi: range.lowMidi, highMidi: midi }
  }
  return range
}
