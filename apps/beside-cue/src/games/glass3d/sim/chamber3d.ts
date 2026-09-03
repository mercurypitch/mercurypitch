// The room has a pitch, and the pitch decides where the floor is safe.
// ============================================================
//
// A chamber is one room with one fundamental. Sing that fundamental, or
// any whole-number multiple of it, and a standing wave forms along the
// room: a pattern that does not travel. Where the air moves hardest is a
// BELLY and glass there shakes itself apart; where it does not move at
// all is a NODE and the floor there is still enough to stand on.
//
// The positions are not a design choice. For mode n the room divides
// into n equal parts, with nodes on the divisions and bellies at the
// middle of each part, so the whole level layout follows from one
// integer. That is the point of the mechanic: the puzzle -- put a belly
// on that pane while keeping a node under my feet -- has a musical
// answer rather than a memorised one.
//
// Modelled with rigid ends, so both walls are nodes and the shape is
// sin(n * pi * x). A pipe open at one end would put a belly at that end
// and half-integer modes on the ladder; it is a real instrument and a
// worse teacher, because the first thing a player learns here should be
// "the room divides into n" and not "except at that end".
//
// PITCH IS NOT WHERE THE DIFFICULTY LIVES, and this is the part worth
// reading twice. Mode n sounds at n times the fundamental, which in
// semitones is 12*log2(n) above it -- so the ladder's rungs get CLOSER
// as you climb: an octave from 1 to 2, a fifth from 2 to 3, a minor
// third from 5 to 6. A chamber built on modes 4, 5 and 6 asks for about
// seven semitones end to end, which is inside almost any range, while
// one built on 1 and 2 asks for a full octave. So a room is made easier
// to SING by moving it up the ladder and harder to READ at the same
// time, since the node pattern changes more between neighbours up there.

/** A room, as data. Everything else here is derived from it. */
export interface Chamber {
  readonly id: string
  /** Which modes this room is built around, lowest first. */
  readonly modes: readonly number[]
  /** Length along the axis Merc walks, in metres. */
  readonly length: number
  /** Panes to break. `at` is 0..1 along the room. */
  readonly panes: readonly { readonly at: number; readonly height: number }[]
  /** Ledges to stand on, above the floor. */
  readonly platforms: readonly {
    readonly at: number
    readonly width: number
    readonly height: number
  }[]
  /** One line, shown on entry. The room teaches itself. */
  readonly teaches: string
}

/**
 * How hard the air moves at `x01` for a given mode, 0..1.
 *
 * 0 is a node and 1 is a belly. Absolute, because a standing wave's two
 * lobes are equally violent and only their phase differs -- which is
 * audible and not visible, and not something a floor cares about.
 */
export const standingAmplitude = (x01: number, mode: number): number =>
  Math.abs(Math.sin(mode * Math.PI * x01))

/** Where the room is still, for a mode. Includes both walls. */
export const nodesFor = (mode: number): number[] =>
  Array.from({ length: mode + 1 }, (_, i) => i / mode)

/** Where the room shakes hardest, for a mode. */
export const belliesFor = (mode: number): number[] =>
  Array.from({ length: mode }, (_, i) => (i + 0.5) / mode)

/** The pitch of a mode, in MIDI, given the room's fundamental. */
export const modeMidi = (fundamentalMidi: number, mode: number): number =>
  fundamentalMidi + 12 * Math.log2(mode)

/**
 * Which of the room's modes the voice is nearest, and by how much.
 *
 * `mode` is null when nothing is being sung. It is never null merely for
 * being out of tune: a player a whole tone flat of mode 5 is trying to
 * sing mode 5, and telling them "no mode" instead of "flat" is the
 * difference between a hint and a shrug.
 */
export const nearestMode = (
  midi: number | null,
  fundamentalMidi: number,
  modes: readonly number[],
): { mode: number | null; semisOff: number } => {
  if (midi === null || modes.length === 0) {
    return { mode: null, semisOff: Infinity }
  }
  let best = modes[0]!
  let bestOff = Infinity
  for (const mode of modes) {
    const off = midi - modeMidi(fundamentalMidi, mode)
    if (Math.abs(off) < Math.abs(bestOff)) {
      best = mode
      bestOff = off
    }
  }
  return { mode: best, semisOff: bestOff }
}

/** Whether that voice is close enough to actually excite the mode. */
export const isExciting = (semisOff: number, tolSemis: number): boolean =>
  Math.abs(semisOff) <= tolSemis

/**
 * The fundamental that puts this room's modes inside a singer's range.
 *
 * The room is transposed to the player, not the player to the room: the
 * theory fixes the RATIOS between modes and says nothing at all about
 * absolute pitch, so there is no reason to make anyone reach. Centres
 * the mode set on the middle of the measured range.
 *
 * `lowMidi`/`highMidi` come from the range finder. With no measurement
 * to work from, `fallbackCentreMidi` stands in -- around G4, which is
 * where the Hallway's pane already sits.
 */
export const tuneChamber = (
  modes: readonly number[],
  range: { lowMidi: number; highMidi: number } | null,
  fallbackCentreMidi = 67,
): number => {
  if (modes.length === 0) return fallbackCentreMidi
  const centre =
    range === null ? fallbackCentreMidi : (range.lowMidi + range.highMidi) / 2
  // The mode set's own centre, in semitones above the fundamental.
  const spans = modes.map((m) => 12 * Math.log2(m))
  const mid = (Math.min(...spans) + Math.max(...spans)) / 2
  return centre - mid
}

/**
 * Whether the mode set fits the range at all, and by how much it misses.
 *
 * Positive slack is room to spare. A chamber whose slack is negative
 * cannot be sung by that player however it is transposed, and the level
 * should be built from higher modes rather than shipped and failed.
 */
export const rangeSlackSemis = (
  modes: readonly number[],
  range: { lowMidi: number; highMidi: number },
): number => {
  if (modes.length === 0) return Infinity
  const spans = modes.map((m) => 12 * Math.log2(m))
  const needed = Math.max(...spans) - Math.min(...spans)
  return range.highMidi - range.lowMidi - needed
}

/**
 * The floor height at `x01`, or null where there is nothing there.
 *
 * A chamber's floor is continuous -- the danger is what the wave is
 * doing to it, not a hole -- so this only ever answers with the ground
 * or with a platform above it. Which is why `locomotion3d` takes the
 * sampler as an argument and has never heard of a mode.
 */
export const groundIn =
  (chamber: Chamber) =>
  (x: number): number | null => {
    const x01 = x / chamber.length
    let best = 0
    for (const p of chamber.platforms) {
      const half = p.width / 2 / chamber.length
      if (x01 >= p.at - half && x01 <= p.at + half) {
        best = Math.max(best, p.height)
      }
    }
    return best
  }

/**
 * Is the floor under him shaking hard enough to drop him?
 *
 * Deliberately generous at the edges: the threshold is on amplitude, and
 * amplitude near a node changes slowly, so the safe zone around each
 * node is wide enough to stand in without pixel-hunting. A player who
 * can see the pattern should not also have to aim at it.
 */
export const isFloorSafe = (
  x01: number,
  mode: number | null,
  threshold: number,
): boolean => mode === null || standingAmplitude(x01, mode) <= threshold
